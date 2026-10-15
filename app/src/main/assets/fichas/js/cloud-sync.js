// cloud-sync.js — respaldo de la ficha clínica en la nube.
//
// Soporta tres conectores intercambiables, configurables desde la pantalla
// de Ajustes (todo se guarda localmente en IndexedDB, nunca en un servidor
// propio):
//   1) OneDrive vía Microsoft Graph API (OAuth2 con MSAL.js para SPA).
//   2) Google Drive API (OAuth2 con Google Identity Services + fetch a Drive v3).
//   3) Webhook genérico (compatible con n8n / Make / Power Automate) que
//      recibe el JSON + el PDF en base64 y se encarga de organizarlos en la
//      nube que el usuario prefiera, sin necesidad de credenciales OAuth
//      embebidas en la app.
'use strict';

const CloudSync = (() => {

  const MSAL_SDK = 'https://cdn.jsdelivr.net/npm/@azure/msal-browser@3/lib/msal-browser.min.js';
  const GIS_SDK = 'https://accounts.google.com/gsi/client';

  let msalApp = null;
  let gisTokenClient = null;
  let gdriveAccessToken = null;

  function slug(str) {
    return (str || 'sin_dato')
      .normalize('NFD').replace(/[̀-ͯ]/g, '') // saca acentos
      .replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
  }

  function nombreCarpeta(paciente) {
    const especie = paciente.paciente.especie === 'felino' ? 'Felino' : 'Canino';
    return [
      'Historias_Clinicas',
      `${slug(especie)}_${slug(paciente.paciente.nombre)}_${slug(paciente.tutor.nombre)}_${slug(paciente.id)}`,
    ].join('/');
  }

  async function getConfig() {
    return (await DB.settings.get('cloudConfig')) || {
      provider: 'webhook',
      msalClientId: '', msalTenant: 'common',
      gdriveClientId: '', gdriveApiKey: '',
      webhookUrl: '',
    };
  }

  function setConfig(cfg) {
    return DB.settings.put('cloudConfig', cfg);
  }

  async function construirArchivos(paciente, ficha) {
    const jsonTexto = JSON.stringify({ paciente, ficha, exportadoEl: new Date().toISOString() }, null, 2);
    const jsonBlob = new Blob([jsonTexto], { type: 'application/json' });
    const doc = PdfExport.generarPdfFicha(paciente, ficha);
    const pdfBlob = doc.output('blob');
    return { jsonBlob, pdfBlob, jsonName: 'historia_clinica.json', pdfName: 'ficha_clinica.pdf' };
  }

  // ---------------------------------------------------------------- OneDrive

  async function ensureMsal(cfg) {
    await Utils.cargarScript(MSAL_SDK);
    if (!msalApp) {
      msalApp = new msal.PublicClientApplication({
        auth: {
          clientId: cfg.msalClientId,
          authority: `https://login.microsoftonline.com/${cfg.msalTenant || 'common'}`,
          redirectUri: window.location.origin + window.location.pathname,
        },
        cache: { cacheLocation: 'localStorage' },
      });
      await msalApp.initialize();
    }
    return msalApp;
  }

  async function tokenOneDrive(cfg) {
    const app = await ensureMsal(cfg);
    const scopes = ['Files.ReadWrite'];
    const cuentas = app.getAllAccounts();
    try {
      if (cuentas.length) {
        const res = await app.acquireTokenSilent({ scopes, account: cuentas[0] });
        return res.accessToken;
      }
      throw new Error('sin sesión');
    } catch (_e) {
      const res = await app.loginPopup({ scopes });
      return res.accessToken;
    }
  }

  /**
   * Sube un archivo por ruta a OneDrive. Microsoft Graph crea automáticamente
   * las carpetas intermedias que no existan al subir por ruta ("path addressing").
   */
  async function subirArchivoOneDrive(token, rutaCompleta, blob) {
    const url = `https://graph.microsoft.com/v1.0/me/drive/root:/${rutaCompleta}:/content`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': blob.type || 'application/octet-stream' },
      body: blob,
    });
    if (!res.ok) throw new Error(`OneDrive: error ${res.status} al subir ${rutaCompleta}`);
    return res.json();
  }

  async function respaldarOneDrive(paciente, ficha, cfg) {
    if (!cfg.msalClientId) throw new Error('Falta configurar el Client ID de Azure AD en Ajustes → OneDrive.');
    const token = await tokenOneDrive(cfg);
    const carpeta = nombreCarpeta(paciente);
    const { jsonBlob, pdfBlob, jsonName, pdfName } = await construirArchivos(paciente, ficha);
    await subirArchivoOneDrive(token, `${carpeta}/${jsonName}`, jsonBlob);
    await subirArchivoOneDrive(token, `${carpeta}/${pdfName}`, pdfBlob);
    return { provider: 'OneDrive', carpeta };
  }

  // ------------------------------------------------------------ Google Drive

  async function ensureGis(cfg) {
    await Utils.cargarScript(GIS_SDK);
    if (!gisTokenClient) {
      gisTokenClient = google.accounts.oauth2.initTokenClient({
        client_id: cfg.gdriveClientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: () => {}, // se sobreescribe por invocación, ver tokenGoogle()
      });
    }
    return gisTokenClient;
  }

  function tokenGoogle(cfg) {
    return new Promise(async (resolve, reject) => {
      const client = await ensureGis(cfg);
      client.callback = (resp) => {
        if (resp.error) return reject(new Error('Google Drive: ' + resp.error));
        gdriveAccessToken = resp.access_token;
        resolve(resp.access_token);
      };
      client.requestAccessToken({ prompt: gdriveAccessToken ? '' : 'consent' });
    });
  }

  async function buscarOCrearCarpeta(token, nombre, parentId) {
    const q = encodeURIComponent(
      `name='${nombre.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false` +
      (parentId ? ` and '${parentId}' in parents` : " and 'root' in parents")
    );
    const buscar = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json());
    if (buscar.files && buscar.files.length) return buscar.files[0].id;

    const crear = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: nombre,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : undefined,
      }),
    }).then(r => r.json());
    return crear.id;
  }

  async function subirArchivoGoogle(token, nombre, blob, parentId) {
    const metadata = { name: nombre, parents: [parentId] };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) throw new Error(`Google Drive: error ${res.status} al subir ${nombre}`);
    return res.json();
  }

  async function respaldarGoogleDrive(paciente, ficha, cfg) {
    if (!cfg.gdriveClientId) throw new Error('Falta configurar el Client ID de Google Cloud en Ajustes → Google Drive.');
    const token = await tokenGoogle(cfg);
    const carpetaRaiz = await buscarOCrearCarpeta(token, 'Historias_Clinicas', null);
    const nombreSub = nombreCarpeta(paciente).split('/')[1];
    const subcarpeta = await buscarOCrearCarpeta(token, nombreSub, carpetaRaiz);
    const { jsonBlob, pdfBlob, jsonName, pdfName } = await construirArchivos(paciente, ficha);
    await subirArchivoGoogle(token, jsonName, jsonBlob, subcarpeta);
    await subirArchivoGoogle(token, pdfName, pdfBlob, subcarpeta);
    return { provider: 'Google Drive', carpeta: `Historias_Clinicas/${nombreSub}` };
  }

  // -------------------------------------------------------------- Webhook

  async function blobToBase64(blob) {
    const buf = await blob.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  async function respaldarWebhook(paciente, ficha, cfg) {
    if (!cfg.webhookUrl) throw new Error('Falta configurar la URL del Webhook en Ajustes → Webhook.');
    const carpeta = nombreCarpeta(paciente);
    const { jsonBlob, pdfBlob, jsonName, pdfName } = await construirArchivos(paciente, ficha);
    const payload = {
      carpeta,
      paciente: { id: paciente.id, nombre: paciente.paciente.nombre, especie: paciente.paciente.especie, tutor: paciente.tutor.nombre },
      archivos: [
        { nombre: jsonName, mime: 'application/json', base64: await blobToBase64(jsonBlob) },
        { nombre: pdfName, mime: 'application/pdf', base64: await blobToBase64(pdfBlob) },
      ],
    };
    const res = await fetch(cfg.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Webhook: error ${res.status}`);
    return { provider: 'Webhook', carpeta };
  }

  // ---------------------------------------------------------------- API

  async function respaldar(paciente, ficha) {
    const cfg = await getConfig();
    if (cfg.provider === 'onedrive') return respaldarOneDrive(paciente, ficha, cfg);
    if (cfg.provider === 'gdrive') return respaldarGoogleDrive(paciente, ficha, cfg);
    return respaldarWebhook(paciente, ficha, cfg);
  }

  return { getConfig, setConfig, respaldar, nombreCarpeta };
})();
