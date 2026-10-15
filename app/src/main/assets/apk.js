// apk.js — puente entre las páginas web y la app Android (window.AndroidBridge).
// Fuera del APK (navegador) cada función cae en el comportamiento web normal.
'use strict';

const Apk = (() => {
  const bridge = () => window.AndroidBridge;
  const disponible = () => !!bridge();

  /** Guarda un archivo (contenido en base64) en Descargas. Devuelve un mensaje. */
  function guardarBase64(base64, nombre, mime) {
    if (disponible()) return bridge().saveFile(base64, nombre, mime);
    const a = document.createElement('a');
    a.href = 'data:' + mime + ';base64,' + base64;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return 'Archivo descargado';
  }

  /** Guarda un documento jsPDF en Descargas (y lo abre en el celular). */
  function guardarPdf(doc, nombre) {
    if (disponible()) return bridge().saveFile(doc.output('datauristring').split(',')[1], nombre, 'application/pdf');
    doc.save(nombre);
    return 'PDF generado';
  }

  /** Guarda texto (por ejemplo JSON) en Descargas. */
  function guardarTexto(texto, nombre, mime) {
    const base64 = btoa(unescape(encodeURIComponent(texto)));
    return guardarBase64(base64, nombre, mime || 'application/json');
  }

  /** Abre un enlace externo (WhatsApp, Google, etc.) fuera de la app. */
  function abrirExterno(url) {
    if (disponible()) { bridge().openUrl(url); return; }
    window.open(url, '_blank', 'noopener');
  }

  /**
   * Abre el calendario del celular con el evento precargado.
   * evento: { titulo, descripcion, fecha: 'yyyy-mm-dd', hora: 'hh:mm' | '' }
   */
  function agendarEnCelular(evento) {
    if (!disponible()) throw new Error('Solo disponible en la app Android.');
    const conHora = !!evento.hora;
    const inicio = conHora
      ? new Date(evento.fecha + 'T' + evento.hora + ':00')
      // Eventos de todo el día: Android los espera en UTC a medianoche.
      : new Date(Date.UTC(+evento.fecha.slice(0, 4), +evento.fecha.slice(5, 7) - 1, +evento.fecha.slice(8, 10)));
    const fin = new Date(inicio.getTime() + (conHora ? 30 * 60000 : 24 * 3600000));
    return bridge().addCalendarEvent(evento.titulo, evento.descripcion || '', inicio.getTime(), fin.getTime(), !conHora);
  }

  /**
   * Comparte archivos con otra app. files: [{nombre, mime, base64}].
   * aDrive = true abre directo "Guardar en Google Drive" (si está instalado).
   * En el navegador, los descarga.
   */
  function compartir(files, titulo, aDrive) {
    if (disponible() && bridge().shareFiles) {
      return bridge().shareFiles(JSON.stringify(files.map((f) => ({ name: f.nombre, mime: f.mime, base64: f.base64 }))), titulo || 'Compartir', !!aDrive);
    }
    files.forEach((f) => guardarBase64(f.base64, f.nombre, f.mime));
    return 'Archivos descargados';
  }

  const textoABase64 = (texto) => btoa(unescape(encodeURIComponent(texto)));
  const pdfABase64 = (doc) => doc.output('datauristring').split(',')[1];

  /** Programa los avisos de internación: [{key, at (ms), title, text, url}]. Reemplaza los anteriores. */
  function programarAvisos(avisos) {
    if (disponible() && bridge().scheduleAlarms) return bridge().scheduleAlarms(JSON.stringify(avisos));
    return '';
  }

  /** Pide permiso de notificaciones (Android 13+); no hace nada si ya está dado. */
  function pedirNotificaciones() {
    if (disponible() && bridge().requestNotifications) bridge().requestNotifications();
  }

  return { disponible, guardarBase64, guardarPdf, guardarTexto, abrirExterno, agendarEnCelular, compartir, textoABase64, pdfABase64, programarAvisos, pedirNotificaciones };
})();
