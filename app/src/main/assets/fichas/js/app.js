// app.js — router, autoguardado y orquestación de la PWA.
'use strict';

(() => {
  // #app es reemplazado por un clon vacío en cada cambio de ruta (ver
  // resetAppContainer) para que los listeners delegados de la pantalla
  // anterior no queden pegados y se disparen varias veces en la nueva.
  let appEl = document.getElementById('app');
  const VITAL_BASE_CLASS = 'w-full rounded-xl border-2 px-3 py-2.5 text-base focus:ring-2 focus:ring-emerald-500 outline-none';

  function resetAppContainer() {
    const clone = appEl.cloneNode(false);
    appEl.replaceWith(clone);
    appEl = clone;
  }

  // ------------------------------------------------------------- utilidades UI

  function showToast(msg, type = 'info') {
    const el = document.createElement('div');
    const colores = { info: 'bg-slate-800', ok: 'bg-emerald-600', error: 'bg-red-600' };
    el.className = `fixed left-1/2 -translate-x-1/2 bottom-20 z-50 text-white text-sm px-4 py-3 rounded-xl shadow-lg ${colores[type] || colores.info} max-w-[90vw] text-center`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .4s'; el.style.opacity = '0'; }, 2600);
    setTimeout(() => el.remove(), 3200);
  }

  function renderInto(html) {
    const abiertos = {};
    appEl.querySelectorAll('details[id]').forEach(d => { abiertos[d.id] = d.open; });
    appEl.innerHTML = html;
    appEl.querySelectorAll('details[id]').forEach(d => {
      if (d.id in abiertos) d.open = abiertos[d.id];
    });
  }

  // ------------------------------------------------------------- data binding

  function bindGenericForm(container, data, { onSave, onStructuralChange }) {
    const debouncedSave = Utils.debounce(() => onSave(data), 500);

    container.addEventListener('input', (e) => {
      const el = e.target;
      if (!el.dataset.path) return;
      const value = el.type === 'checkbox' ? el.checked : el.value;
      Utils.setPath(data, el.dataset.path, value);
      debouncedSave();

      if (el.dataset.vital) {
        const rango = FCV.RANGOS_VITALES[data.__especie || 'canino'][el.dataset.vital.split('.').pop()];
        if (rango) {
          const estado = FCV.evaluarConstante(value, rango);
          const cls = estado === 'alerta'
            ? 'border-red-400 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
            : estado === 'normal'
              ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
              : 'border-slate-300 dark:border-slate-600';
          el.className = VITAL_BASE_CLASS + ' ' + cls;
        }
      }

      const rxMatch = el.dataset.path.match(/^tratamiento\.prescripciones\.(\d+)\.(dosisMgKg|concentracionMgMl)$/);
      if (rxMatch || el.dataset.path === 'peso') {
        recalcularDosis(container, data);
      }
    });

    container.addEventListener('change', (e) => {
      const el = e.target;
      if (!el.dataset.path) return;
      const value = el.type === 'checkbox' ? el.checked : el.value;
      Utils.setPath(data, el.dataset.path, value);
      onSave(data);
      // Los campos de texto disparan "change" al perder el foco: redibujar ahí
      // reemplazaría el botón que se está tocando y ese toque se perdería.
      // (La raza sí redibuja: muestra las predisposiciones de la lista.)
      const esTexto = el.tagName === 'TEXTAREA' ||
        (el.tagName === 'INPUT' && !el.hasAttribute('list') && /^(text|number|tel|email|search|url)$/.test(el.type));
      if (onStructuralChange && !esTexto) onStructuralChange();
    });
  }

  function recalcularDosis(scopeEl, ficha) {
    (ficha.tratamiento.prescripciones || []).forEach((rx, i) => {
      const div = scopeEl.querySelector(`#rx-calc-${i}`) || document.querySelector(`#rx-calc-${i}`);
      if (!div) return;
      const calc = Utils.calcularVolumenDosis(rx.dosisMgKg, ficha.peso, rx.concentracionMgMl);
      div.innerHTML = Render.rxCalcHtml(calc, ficha.peso);
    });
  }

  async function bindFileInputs(container, data, onSave, rerender) {
    container.addEventListener('change', async (e) => {
      const el = e.target;
      if (el.dataset.fileTarget && el.files && el.files.length) {
        const actual = Utils.getPath(data, el.dataset.fileTarget) || [];
        for (const file of Array.from(el.files)) {
          try {
            const dataUrl = await Utils.fileToDataURL(file);
            actual.push({ nombre: file.name, tipo: file.type, dataUrl });
          } catch (_e) { /* se ignora archivo no legible */ }
        }
        Utils.setPath(data, el.dataset.fileTarget, actual);
        await onSave(data);
        rerender();
      }
    });
    container.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-file-remove]');
      if (!btn) return;
      const path = btn.dataset.fileRemove;
      const idx = parseInt(btn.dataset.fileIndex, 10);
      const arr = Utils.getPath(data, path) || [];
      arr.splice(idx, 1);
      Utils.setPath(data, path, arr);
      await onSave(data);
      rerender();
    });
  }

  function bindQuickInsert(container, data, onSave) {
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-quick-insert]');
      if (!btn) return;
      const path = btn.dataset.quickInsert;
      const actual = Utils.getPath(data, path) || '';
      const agregado = actual.trim() ? `${actual.trim()}. ${btn.dataset.quickText}` : btn.dataset.quickText;
      Utils.setPath(data, path, agregado);
      const textarea = container.querySelector(`[data-path="${path}"]`);
      if (textarea) textarea.value = agregado;
      onSave(data);
    });
  }

  // ------------------------------------------------------------- router

  // Herramientas de pantalla para módulos externos (internación).
  function ayudas() {
    return { root: appEl, renderInto, showToast };
  }

  const routes = {
    '': screenPacientes,
    pacientes: screenPacientes,
    paciente: screenPacienteDetalle,
    consulta: screenConsulta,
    config: screenConfig,
    internados: () => Internacion.screenLista(ayudas()),
    internacion: (id) => Internacion.screenDetalle(id, ayudas()),
    alta: (id) => Alta.screen(id, ayudas()),
  };

  function parseHash() {
    const h = (location.hash || '#/pacientes').replace(/^#\/?/, '');
    const [route, id] = h.split('/');
    return { route, id };
  }

  async function router() {
    const { route, id } = parseHash();
    const fn = routes[route] || screenPacientes;
    resetAppContainer();
    try {
      await fn(id);
    } catch (err) {
      console.error(err);
      renderInto(`<div class="p-6 text-center text-red-600">Ocurrió un error al mostrar esta pantalla.<br><span class="text-xs text-slate-400">${Utils.escapeHtml(err.message)}</span></div>`);
    }
    window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------- pantallas

  async function screenPacientes() {
    const patients = await DB.patients.getAll();
    const fichas = await DB.fichas.getAll();
    const ultimaPorPaciente = {};
    fichas.forEach(f => {
      if (!ultimaPorPaciente[f.patientId] || f.fechaAtencion > ultimaPorPaciente[f.patientId].fechaAtencion) {
        ultimaPorPaciente[f.patientId] = f;
      }
    });
    renderInto(Render.patientListScreen(patients, ultimaPorPaciente));

    document.getElementById('btn-nuevo-paciente').addEventListener('click', async () => {
      const p = FCV.nuevoPaciente();
      await DB.patients.put(p);
      location.hash = `#/paciente/${p.id}`;
    });

    const buscador = document.getElementById('buscador-pacientes');
    buscador.addEventListener('input', Utils.debounce(() => {
      const q = buscador.value.trim().toLowerCase();
      const filtrados = !q ? patients : patients.filter(p =>
        (p.paciente.nombre || '').toLowerCase().includes(q) ||
        (p.tutor.nombre || '').toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q));
      document.getElementById('lista-pacientes').innerHTML = Render.patientListItems(filtrados, ultimaPorPaciente);
    }, 200));
  }

  async function screenPacienteDetalle(id) {
    const p = await DB.patients.get(id);
    if (!p) { location.hash = '#/pacientes'; return; }
    const fichas = await DB.fichas.getByPatient(id);
    renderInto(Render.patientDetailScreen(p, fichas));

    const guardar = async (data) => {
      data.updatedAt = new Date().toISOString();
      await DB.patients.put(data);
    };
    const contBase = document.getElementById('form-paciente-base');
    bindGenericForm(contBase, p, {
      onSave: guardar,
      onStructuralChange: () => { renderInto(Render.patientDetailScreen(p, fichas)); rebind(); },
    });

    function rebind() {
      const c = document.getElementById('form-paciente-base');
      bindGenericForm(c, p, {
        onSave: guardar,
        onStructuralChange: () => { renderInto(Render.patientDetailScreen(p, fichas)); rebind(); },
      });
      document.getElementById('btn-nueva-consulta').addEventListener('click', crearConsulta);
    }

    document.getElementById('btn-nueva-consulta').addEventListener('click', crearConsulta);
    appEl.addEventListener('click', async (e) => {
      if (e.target.closest('#btn-internar-paciente')) { await guardar(p); Internacion.internar(ayudas(), p); return; }
      if (!e.target.closest('#btn-drive-historia')) return;
      try {
        await guardar(p);
        const todas = await DB.fichas.getByPatient(p.id);
        await guardarHistoriaEnDrive(p, todas);
      } catch (err) {
        console.error(err);
        showToast('No se pudo preparar la historia: ' + err.message, 'error');
      }
    });
    async function crearConsulta() {
      // `p` ya tiene en memoria los últimos cambios tecleados (setPath corre
      // sincrónico en cada input); forzamos el guardado antes de navegar para
      // no perder una edición reciente que el autoguardado debounced todavía
      // no haya escrito en IndexedDB.
      await guardar(p);
      const f = FCV.nuevaFicha(p.id);
      await DB.fichas.put(f);
      location.hash = `#/consulta/${f.id}`;
    }
  }

  // Nota: `#app` es un nodo persistente (solo su innerHTML se reemplaza en
  // cada renderInto). Los listeners delegados de esta pantalla se atan una
  // única vez sobre ese nodo; nunca se vuelven a atar tras un re-render,
  // porque duplicarían el binding y cada evento se dispararía N veces.
  async function screenConsulta(id) {
    const f = await DB.fichas.get(id);
    if (!f) { location.hash = '#/pacientes'; return; }
    const p = await DB.patients.get(f.patientId);
    f.__especie = p.paciente.especie;
    // Contexto para que las calculadoras guarden en esta consulta.
    try { localStorage.setItem('uv.ctx', JSON.stringify({ patientId: p.id, fichaId: f.id, nombre: p.paciente.nombre, ts: Date.now() })); } catch (_e) { /* */ }
    renderInto(Render.consultaScreen(f, p));

    const guardar = async (data) => {
      data.updatedAt = new Date().toISOString();
      const { __especie, ...limpio } = data;
      await DB.fichas.put(limpio);
    };

    const root = appEl;
    bindGenericForm(root, f, {
      onSave: guardar,
      onStructuralChange: () => renderInto(Render.consultaScreen(f, p)),
    });
    bindFileInputs(root, f, guardar, () => renderInto(Render.consultaScreen(f, p)));
    bindQuickInsert(root, f, guardar);

    root.addEventListener('click', async (e) => {
      if (e.target.id === 'btn-add-rx') {
        f.tratamiento.prescripciones.push(FCV.nuevaPrescripcion());
        await guardar(f);
        renderInto(Render.consultaScreen(f, p));
        return;
      }
      const quitar = e.target.closest('[data-remove-rx]');
      if (quitar) {
        f.tratamiento.prescripciones.splice(parseInt(quitar.dataset.removeRx, 10), 1);
        await guardar(f);
        renderInto(Render.consultaScreen(f, p));
        return;
      }

      if (e.target.id === 'btn-add-recordatorio') {
        f.recordatorios = f.recordatorios || [];
        f.recordatorios.push(FCV.nuevoRecordatorio());
        await guardar(f);
        renderInto(Render.consultaScreen(f, p));
        return;
      }
      const quitarRecordatorio = e.target.closest('[data-remove-recordatorio]');
      if (quitarRecordatorio) {
        f.recordatorios.splice(parseInt(quitarRecordatorio.dataset.removeRecordatorio, 10), 1);
        await guardar(f);
        renderInto(Render.consultaScreen(f, p));
        return;
      }
      const btnAgendar = e.target.closest('[data-agendar-recordatorio]');
      if (btnAgendar && Apk.disponible()) {
        // En la app Android se usa el calendario del celular (sin login de Google).
        const r = f.recordatorios[parseInt(btnAgendar.dataset.agendarRecordatorio, 10)];
        if (!r.fecha) { showToast('Cargá una fecha antes de agendar.', 'error'); return; }
        const icono = p.paciente.especie === 'felino' ? '🐱' : '🐶';
        const descripcion = [
          `Paciente: ${p.paciente.nombre || '—'} (${p.id})`,
          `Tutor: ${p.tutor.nombre || '—'}${p.tutor.telefono ? ' · ' + p.tutor.telefono : ''}`,
          r.notas ? `Notas: ${r.notas}` : '',
        ].filter(Boolean).join('\n');
        const msg = Apk.agendarEnCelular({ titulo: `${icono} ${r.tipo} · ${p.paciente.nombre || 'paciente'}`, descripcion, fecha: r.fecha, hora: r.hora });
        r.agendadoEnCelular = true;
        await guardar(f);
        renderInto(Render.consultaScreen(f, p));
        showToast(msg || 'Abriendo el calendario…', 'ok');
        return;
      }
      if (btnAgendar) {
        const i = parseInt(btnAgendar.dataset.agendarRecordatorio, 10);
        const original = btnAgendar.textContent;
        btnAgendar.textContent = 'Agendando...'; btnAgendar.disabled = true;
        try {
          const cfg = await CloudSync.getConfig();
          const { googleEventId, googleEventLink } = await CalendarSync.agendarEvento(p, f.recordatorios[i], cfg.gdriveClientId);
          f.recordatorios[i].googleEventId = googleEventId;
          f.recordatorios[i].googleEventLink = googleEventLink;
          await guardar(f);
          renderInto(Render.consultaScreen(f, p));
          showToast('Evento agendado en Google Calendar ✅', 'ok');
        } catch (err) {
          console.error(err);
          showToast(err.message + ' — configurá el Client ID de Google en Ajustes.', 'error');
          btnAgendar.textContent = original; btnAgendar.disabled = false;
        }
        return;
      }
      const btnCancelarRecordatorio = e.target.closest('[data-cancelar-recordatorio]');
      if (btnCancelarRecordatorio) {
        const i = parseInt(btnCancelarRecordatorio.dataset.cancelarRecordatorio, 10);
        const original = btnCancelarRecordatorio.textContent;
        btnCancelarRecordatorio.textContent = 'Cancelando...'; btnCancelarRecordatorio.disabled = true;
        try {
          const cfg = await CloudSync.getConfig();
          await CalendarSync.cancelarEvento(f.recordatorios[i].googleEventId, cfg.gdriveClientId);
          f.recordatorios[i].googleEventId = '';
          f.recordatorios[i].googleEventLink = '';
          await guardar(f);
          renderInto(Render.consultaScreen(f, p));
          showToast('Evento cancelado en Google Calendar', 'ok');
        } catch (err) {
          console.error(err);
          showToast(err.message, 'error');
          btnCancelarRecordatorio.textContent = original; btnCancelarRecordatorio.disabled = false;
        }
        return;
      }

      const irA = e.target.closest('#btn-ir-dosis, #btn-ir-anestesia');
      if (irA) {
        // Comparte especie, peso y nombre con la calculadora y la ficha anestésica.
        await guardar(f);
        try {
          localStorage.setItem('uv.sp', JSON.stringify(p.paciente.especie === 'felino' ? 'g' : 'p'));
          if (f.peso) localStorage.setItem('uv.weight', JSON.stringify(String(f.peso).replace('.', ',')));
          localStorage.setItem('uv.patient', JSON.stringify({ nombre: p.paciente.nombre || '', raza: p.paciente.raza || '', edad: Utils.formatEdad(Utils.calcEdad(p.paciente.fechaNacimiento)) }));
        } catch (_e) { /* sin almacenamiento */ }
        location.href = irA.id === 'btn-ir-dosis' ? '../index.html' : '../anestesia.html';
        return;
      }
      if (e.target.closest('#btn-pdf')) {
        try {
          const doc = PdfExport.generarPdfFicha(p, f);
          const msg = Apk.guardarPdf(doc, PdfExport.nombreArchivo(p, f));
          showToast((msg || 'PDF generado') + ' ✅', 'ok');
        } catch (err) {
          console.error(err);
          showToast('No se pudo generar el PDF: ' + err.message, 'error');
        }
        return;
      }
      if (e.target.closest('#btn-whatsapp')) {
        if (!p.tutor.telefono) showToast('Cargá el teléfono del tutor para enviar por WhatsApp.', 'error');
        WhatsApp.abrirResumen(p, f);
        return;
      }
      if (e.target.closest('#btn-alta-consulta')) { await guardar(f); location.hash = `#/alta/${f.id}`; return; }
      if (e.target.closest('#btn-internar-consulta')) {
        await guardar(f);
        Internacion.internar(ayudas(), p, f.id);
        return;
      }
      const quitarReg = e.target.closest('[data-remove-registro]');
      if (quitarReg) {
        if (!confirm('¿Quitar este registro de la consulta?')) return;
        f.registros = (f.registros || []).filter((r) => r.id !== quitarReg.dataset.removeRegistro);
        await guardar(f);
        renderInto(Render.consultaScreen(f, p));
        return;
      }
      const abrirReg = e.target.closest('[data-abrir-registro-pdf]');
      if (abrirReg) {
        const r = (f.registros || []).find((x) => x.id === abrirReg.dataset.abrirRegistroPdf);
        if (r && r.pdf) showToast(Apk.guardarBase64(r.pdf.dataUrl.split(',')[1], r.pdf.nombre || 'registro.pdf', 'application/pdf'), 'ok');
        return;
      }
      const btnCloud = e.target.closest('#btn-cloud-sync');
      if (btnCloud && Apk.disponible()) {
        // En la app: compartir a Google Drive (PDF de la consulta + respaldo JSON).
        try {
          await guardar(f);
          const { __especie, ...limpio } = f;
          const base = `${PdfExport.nombreHistoria(p)}_consulta_${f.fechaAtencion}`;
          const archivos = [
            { nombre: base + '.pdf', mime: 'application/pdf', base64: Apk.pdfABase64(PdfExport.generarPdfFicha(p, limpio)) },
            { nombre: base + '.json', mime: 'application/json', base64: Apk.textoABase64(JSON.stringify({ app: 'DosisVet-FCV', tipo: 'consulta', paciente: p, ficha: limpio, exportado: new Date().toISOString() })) },
            ...adjuntosRegistros(limpio),
          ];
          showToast(Apk.compartir(archivos, `Consulta de ${p.paciente.nombre || 'paciente'}`, true), 'ok');
        } catch (err) {
          console.error(err);
          showToast('No se pudo preparar el archivo: ' + err.message, 'error');
        }
        return;
      }
      if (btnCloud) {
        const original = btnCloud.textContent;
        btnCloud.textContent = 'Subiendo...'; btnCloud.disabled = true;
        try {
          const resultado = await CloudSync.respaldar(p, f);
          showToast(`Respaldado en ${resultado.provider}: ${resultado.carpeta}`, 'ok');
        } catch (err) {
          console.error(err);
          showToast(err.message + ' — configurá el respaldo en Ajustes.', 'error');
        } finally {
          btnCloud.textContent = original; btnCloud.disabled = false;
        }
        return;
      }
      if (e.target.closest('#btn-finalizar')) {
        f.status = f.status === 'finalizada' ? 'borrador' : 'finalizada';
        await guardar(f);
        renderInto(Render.consultaScreen(f, p));
      }
    });
  }

  async function screenConfig() {
    const cfg = await CloudSync.getConfig();
    renderInto(`
      <div class="p-4 pb-28">
        <a href="#/pacientes" class="text-sm text-emerald-700 dark:text-emerald-400 mb-3 inline-block">← Pacientes</a>
        <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Ajustes de respaldo en la nube</h2>
        <p class="text-xs text-slate-500 mb-4">Elegí un conector. Las credenciales quedan guardadas solo en este dispositivo (IndexedDB), nunca se envían a un servidor propio.</p>
        ${Apk.disponible() ? '<p class="text-xs rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-3 py-2 mb-4">En la app Android, OneDrive y Google Drive no permiten iniciar sesión. Usá el Webhook, o la copia de seguridad de abajo.</p>' : ''}
        <div id="form-config">
          ${Render.radioGroup({ label: 'Conector activo', path: 'provider', value: cfg.provider, options: [{ value: 'webhook', label: 'Webhook (n8n / Make / Power Automate)' }, { value: 'onedrive', label: 'OneDrive (Microsoft Graph)' }, { value: 'gdrive', label: 'Google Drive' }] })}
          <div class="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 mt-3">
            <h3 class="text-sm font-semibold mb-2">Webhook genérico</h3>
            ${Render.field({ label: 'URL del Webhook', path: 'webhookUrl', value: cfg.webhookUrl, extra: 'placeholder="https://tu-n8n.dominio.com/webhook/ficha-clinica"' })}
          </div>
          <div class="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 mt-3">
            <h3 class="text-sm font-semibold mb-2">OneDrive (Microsoft Graph / MSAL)</h3>
            ${Render.field({ label: 'Client ID (Azure AD App Registration)', path: 'msalClientId', value: cfg.msalClientId })}
            ${Render.field({ label: 'Tenant', path: 'msalTenant', value: cfg.msalTenant || 'common', hint: 'Usá "common" si no tenés un tenant corporativo propio.' })}
          </div>
          <div class="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 mt-3">
            <h3 class="text-sm font-semibold mb-2">Google (Drive + Calendar)</h3>
            ${Render.field({ label: 'Client ID (Google Cloud OAuth)', path: 'gdriveClientId', value: cfg.gdriveClientId, hint: 'Se usa tanto para el respaldo en Google Drive como para agendar recordatorios en Google Calendar. Habilitá ambas APIs en tu proyecto de Google Cloud.' })}
          </div>
        </div>
        <button id="btn-guardar-config" class="w-full rounded-xl bg-emerald-600 text-white py-3 text-sm font-medium mt-4">Guardar ajustes</button>

        <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100 mt-8 mb-1">Copia de seguridad</h2>
        <p class="text-xs text-slate-500 mb-3">Todos los pacientes, consultas (con adjuntos) y la ficha anestésica en curso quedan guardados solo en este celular. Exportá una copia seguido y guardala fuera del teléfono (Drive, mail, PC): si desinstalás la app o cambiás de celular, la importás acá.</p>
        <button id="btn-drive-todo" class="w-full rounded-xl bg-blue-600 text-white py-3 text-sm font-medium mb-3">☁️ Guardar copia completa en Google Drive</button>
        <button id="btn-exportar-todo" class="w-full rounded-xl bg-slate-800 dark:bg-slate-700 text-white py-3 text-sm font-medium">⬇️ Exportar copia de seguridad (Descargas)</button>
        <label class="block w-full rounded-xl border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 py-3 text-sm font-medium text-center mt-3">
          ⬆️ Importar copia de seguridad
          <input id="input-importar" type="file" accept="application/json,.json" class="hidden">
        </label>
      </div>`);

    const cont = document.getElementById('form-config');
    bindGenericForm(cont, cfg, { onSave: () => {}, onStructuralChange: () => {} });
    document.getElementById('btn-guardar-config').addEventListener('click', async () => {
      await CloudSync.setConfig(cfg);
      showToast('Ajustes guardados ✅', 'ok');
    });
    document.getElementById('btn-exportar-todo').addEventListener('click', () => exportarCopia(false));
    document.getElementById('btn-drive-todo').addEventListener('click', () => exportarCopia(true));
    document.getElementById('input-importar').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (file) importarCopia(file);
    });
  }

  // ------------------------------------------------------------- Google Drive

  // PDFs adjuntos a los registros (ej. ficha anestésica) como archivos sueltos.
  function adjuntosRegistros(f) {
    return (f.registros || []).filter((r) => r.pdf && r.pdf.dataUrl).map((r) => ({
      nombre: r.pdf.nombre || `registro_${r.id}.pdf`, mime: 'application/pdf', base64: r.pdf.dataUrl.split(',')[1],
    }));
  }

  // Historia completa: PDF con todas las consultas + JSON + PDFs adjuntos.
  async function guardarHistoriaEnDrive(p, fichas) {
    const base = PdfExport.nombreHistoria(p);
    const archivos = [
      { nombre: base + '.pdf', mime: 'application/pdf', base64: Apk.pdfABase64(PdfExport.generarPdfHistoria(p, fichas)) },
      { nombre: base + '.json', mime: 'application/json', base64: Apk.textoABase64(JSON.stringify({ app: 'DosisVet-FCV', tipo: 'historia', version: 1, exportado: new Date().toISOString(), patients: [p], fichas })) },
    ];
    fichas.forEach((f) => archivos.push(...adjuntosRegistros(f)));
    const msg = Apk.compartir(archivos, `Historia clínica de ${p.paciente.nombre || 'paciente'}`, true);
    showToast(msg, 'ok');
  }

  // ------------------------------------------------------------- copia de seguridad

  // Claves de localStorage de la calculadora de dosis y la ficha anestésica.
  const CLAVES_LOCALES = ['vetAnesthesiaChart_v1', 'uv.sp', 'uv.weight'];

  async function exportarCopia(aDrive) {
    try {
      const local = {};
      CLAVES_LOCALES.forEach(k => { const v = localStorage.getItem(k); if (v !== null) local[k] = v; });
      const copia = {
        app: 'DosisVet-FCV', version: 1, exportado: new Date().toISOString(),
        patients: await DB.patients.getAll(),
        fichas: await DB.fichas.getAll(),
        internaciones: await DB.internaciones.getAll(),
        localStorage: local,
      };
      const nombre = `copia_dosisvet_${Utils.todayISO()}.json`;
      const msg = aDrive
        ? Apk.compartir([{ nombre, mime: 'application/json', base64: Apk.textoABase64(JSON.stringify(copia)) }], 'Copia de seguridad Dosis Vet', true)
        : Apk.guardarTexto(JSON.stringify(copia), nombre, 'application/json');
      showToast(`${msg} · ${copia.patients.length} paciente(s), ${copia.fichas.length} consulta(s)`, 'ok');
    } catch (err) {
      console.error(err);
      showToast('No se pudo exportar: ' + err.message, 'error');
    }
  }

  async function importarCopia(file) {
    let copia;
    try {
      copia = JSON.parse(await file.text());
    } catch (_e) {
      showToast('El archivo no es una copia válida.', 'error');
      return;
    }
    // Una consulta exportada a Drive también se puede importar.
    if (copia && copia.tipo === 'consulta' && copia.paciente && copia.ficha) {
      copia.patients = [copia.paciente]; copia.fichas = [copia.ficha];
    }
    if (!copia || copia.app !== 'DosisVet-FCV' || !Array.isArray(copia.patients) || !Array.isArray(copia.fichas)) {
      showToast('El archivo no es una copia de esta app.', 'error');
      return;
    }
    if (!confirm(`Importar ${copia.patients.length} paciente(s) y ${copia.fichas.length} consulta(s)? Los registros con el mismo N° de HC se reemplazan por los de la copia.`)) return;
    for (const p of copia.patients) await DB.patients.put(p);
    for (const f of copia.fichas) await DB.fichas.put(f);
    for (const i of (copia.internaciones || [])) await DB.internaciones.put(i);
    Internacion.sincronizarAvisos();
    Object.entries(copia.localStorage || {}).forEach(([k, v]) => {
      if (CLAVES_LOCALES.includes(k)) { try { localStorage.setItem(k, v); } catch (_e) { /* sin espacio */ } }
    });
    showToast('Copia importada ✅', 'ok');
    location.hash = '#/pacientes';
  }

  // ------------------------------------------------------------- tema oscuro

  async function initDarkMode() {
    const guardado = await DB.settings.get('darkMode');
    const prefiereOscuro = guardado ?? window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', prefiereOscuro);
    document.getElementById('btn-dark-toggle').addEventListener('click', async () => {
      const activo = document.documentElement.classList.toggle('dark');
      await DB.settings.put('darkMode', activo);
    });
  }

  // ------------------------------------------------------------- arranque

  // Botón "atrás" de Android: sube un nivel dentro de Fichas; desde la lista
  // de pacientes vuelve a la calculadora.
  window.appBack = () => {
    const { route } = parseHash();
    if (!route || route === 'pacientes' || route === 'internados') { location.href = '../index.html'; return true; }
    const volver = appEl.querySelector('a[href^="#/"]');
    location.hash = volver ? volver.getAttribute('href') : '#/pacientes';
    return true;
  };

  window.addEventListener('hashchange', router);
  window.addEventListener('DOMContentLoaded', async () => {
    await initDarkMode();
    router();
    Internacion.sincronizarAvisos();
  });
})();
