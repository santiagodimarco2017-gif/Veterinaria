// internacion.js — hoja de internación: pizarra de internados, tratamientos
// con horario, tareas para tildar, controles y alta con registro en la
// historia clínica. Los avisos se programan en Android (ver Apk.programarAvisos).
'use strict';

const Internacion = (() => {
  const esc = Utils.escapeHtml;
  const HORA = 3600000;
  const VENTANA_ATRAS = 12 * HORA;  // tareas atrasadas que se muestran
  const VENTANA_ADELANTE = 24 * HORA;
  const VIAS = ['EV', 'IM', 'SC', 'PO', 'Tópica', 'Oftálmica', 'Ótica', 'Inhalatoria', 'Rectal'];
  const INTERVALOS = [
    { v: 0, l: 'Una vez / según necesidad' }, { v: 1, l: 'c/1 h' }, { v: 2, l: 'c/2 h' }, { v: 4, l: 'c/4 h' },
    { v: 6, l: 'c/6 h' }, { v: 8, l: 'c/8 h' }, { v: 12, l: 'c/12 h' }, { v: 24, l: 'c/24 h' }, { v: 48, l: 'c/48 h' },
  ];

  // ───────── utilidades de fecha ─────────
  const pad = (n) => String(n).padStart(2, '0');
  const hhmm = (ms) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const diaHora = (ms) => { const d = new Date(ms); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${hhmm(ms)}`; };
  // Valor para <input type="datetime-local"> en hora local.
  const aLocalInput = (ms) => { const d = new Date(ms); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const desdeLocalInput = (v) => (v ? new Date(v).getTime() : NaN);
  const diasInternado = (i) => Math.max(1, Math.ceil(((i.alta || Date.now()) - i.ingreso) / (24 * HORA)));

  // ───────── modelo ─────────
  function nuevaInternacion(p, fichaId) {
    return {
      id: Utils.uuid(), patientId: p.id, fichaId: fichaId || '',
      ingreso: Date.now(), alta: null, motivo: '', peso: '', jaula: '',
      tratamientos: [], administraciones: [], controles: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
  }

  // Horarios programados de un tratamiento dentro de [desde, hasta).
  function horarios(t, i, desde, hasta) {
    const out = [];
    const inicio = t.inicio;
    let fin = t.duracionDias > 0 ? inicio + t.duracionDias * 24 * HORA : Infinity;
    if (t.suspendido) fin = Math.min(fin, t.suspendido);
    if (i.alta) fin = Math.min(fin, i.alta);
    if (!(t.intervaloH > 0)) {
      if (inicio >= desde && inicio < hasta && inicio < fin + 1) out.push(inicio);
      return out;
    }
    const paso = t.intervaloH * HORA;
    let k = Math.max(0, Math.ceil((desde - inicio) / paso));
    for (let x = inicio + k * paso; x < hasta && x < fin; x = inicio + (++k) * paso) out.push(x);
    return out;
  }

  const admDe = (i, tId, ms) => i.administraciones.find((a) => a.tratamientoId === tId && a.programada === ms);

  // Tareas (dosis programadas) en la ventana, con su estado.
  function tareas(i, desde, hasta) {
    const ahora = Date.now();
    const out = [];
    i.tratamientos.forEach((t) => horarios(t, i, desde, hasta).forEach((ms) => {
      const a = admDe(i, t.id, ms);
      let estado = 'pendiente';
      if (a && a.hecha) estado = 'hecha';
      else if (a && a.omitida) estado = 'omitida';
      else if (ms < ahora - 30 * 60000) estado = 'atrasada';
      else if (ms <= ahora + 30 * 60000) estado = 'ahora';
      out.push({ t, ms, a, estado });
    }));
    return out.sort((x, y) => x.ms - y.ms);
  }

  function resumenPizarra(i) {
    const ahora = Date.now();
    const ts = tareas(i, ahora - VENTANA_ATRAS, ahora + VENTANA_ADELANTE);
    return {
      atrasadas: ts.filter((x) => x.estado === 'atrasada').length,
      ahora: ts.filter((x) => x.estado === 'ahora').length,
      proxima: ts.find((x) => x.estado === 'pendiente' || x.estado === 'ahora'),
    };
  }

  async function guardar(i) {
    i.updatedAt = new Date().toISOString();
    await DB.internaciones.put(i);
    sincronizarAvisos();
  }

  // ───────── avisos en el celular ─────────
  async function sincronizarAvisos() {
    if (!Apk.disponible() || !Apk.programarAvisos) return;
    try {
      const [ints, patients] = [await DB.internaciones.getAll(), await DB.patients.getAll()];
      const ahora = Date.now();
      const avisos = [];
      ints.filter((i) => !i.alta).forEach((i) => {
        const p = patients.find((x) => x.id === i.patientId);
        const nombre = (p && p.paciente.nombre) || 'Paciente';
        tareas(i, ahora, ahora + 48 * HORA).filter((x) => x.estado === 'pendiente' || x.estado === 'ahora').forEach((x) => {
          if (x.ms <= ahora) return;
          avisos.push({
            key: `${i.id}|${x.t.id}|${x.ms}`, at: x.ms,
            title: `🏥 ${nombre}: ${x.t.nombre}`,
            text: `${x.t.dosis || ''} ${x.t.via || ''} · ${hhmm(x.ms)}${i.jaula ? ' · ' + i.jaula : ''}`.trim(),
            url: `fichas/index.html#/internacion/${i.id}`,
          });
        });
      });
      avisos.sort((a, b) => a.at - b.at);
      Apk.programarAvisos(avisos.slice(0, 150));
    } catch (e) { console.warn('No se pudieron programar avisos', e); }
  }

  // ───────── estilos de botones ─────────
  const BTN = 'rounded-xl py-2.5 px-3 text-sm font-medium';
  const B_PRI = `${BTN} bg-emerald-600 text-white`;
  const B_SEC = `${BTN} border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200`;
  const INPUT = 'w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-base text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500';
  const LBL = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 mt-2';
  const CARD = 'rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-4 mb-4';

  // ═════════════════ PIZARRA DE INTERNADOS ═════════════════
  async function screenLista(h) {
    const [ints, patients] = [await DB.internaciones.getAll(), await DB.patients.getAll()];
    const activas = ints.filter((i) => !i.alta).sort((a, b) => a.ingreso - b.ingreso);
    const altas = ints.filter((i) => i.alta).sort((a, b) => b.alta - a.alta).slice(0, 10);
    const pac = (i) => patients.find((p) => p.id === i.patientId);

    const tarjeta = (i) => {
      const p = pac(i);
      const r = resumenPizarra(i);
      const color = r.atrasadas ? 'border-red-400' : r.ahora ? 'border-amber-400' : 'border-emerald-400';
      return `<a href="#/internacion/${i.id}" class="block rounded-2xl border-2 ${color} bg-white dark:bg-slate-800/60 p-3 mb-3 active:bg-slate-50">
        <div class="flex justify-between items-start gap-2">
          <div>
            <div class="font-semibold text-slate-800 dark:text-slate-100">${p && p.paciente.especie === 'felino' ? '🐱' : '🐶'} ${esc((p && p.paciente.nombre) || 'Paciente')}${i.jaula ? ` <span class="text-xs text-slate-400">· ${esc(i.jaula)}</span>` : ''}</div>
            <div class="text-xs text-slate-500">${esc(i.motivo || 'Sin motivo')} · día ${diasInternado(i)} · ${i.tratamientos.filter((t) => !t.suspendido).length} tratamiento(s)</div>
          </div>
          <div class="text-right text-xs shrink-0">
            ${r.atrasadas ? `<div class="font-bold text-red-600">${r.atrasadas} atrasada(s)</div>` : ''}
            ${r.ahora ? `<div class="font-bold text-amber-600">${r.ahora} para ahora</div>` : ''}
            ${r.proxima ? `<div class="text-slate-500">Próx: ${hhmm(r.proxima.ms)} ${esc(r.proxima.t.nombre)}</div>` : '<div class="text-slate-400">Sin tareas</div>'}
          </div>
        </div></a>`;
    };

    h.renderInto(`<div class="p-4 pb-28">
      <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">🏥 Internados</h2>
      <p class="text-xs text-slate-500 mb-3">Rojo: tareas atrasadas · Ámbar: para ahora · Verde: al día.</p>
      ${activas.map(tarjeta).join('') || '<p class="text-sm text-slate-400 mb-4">No hay pacientes internados.</p>'}
      <button id="btn-internar" class="w-full ${B_PRI} py-3 mb-6">+ Internar paciente</button>
      ${altas.length ? `<h3 class="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Altas recientes</h3>
        ${altas.map((i) => `<a href="#/internacion/${i.id}" class="block text-sm rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 mb-2">${esc((pac(i) && pac(i).paciente.nombre) || 'Paciente')} · alta ${diaHora(i.alta)}</a>`).join('')}` : ''}
    </div>`);

    h.root.addEventListener('click', async (e) => {
      if (e.target.closest('#btn-internar')) elegirPaciente(h, patients);
      const b = e.target.closest('[data-internar]');
      if (b) await internar(h, patients.find((p) => p.id === b.dataset.internar));
    });
    sincronizarAvisos();
  }

  function elegirPaciente(h, patients) {
    const lista = patients.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    const cont = document.createElement('div');
    cont.className = 'fixed inset-0 z-50 bg-black/50 flex items-end';
    cont.innerHTML = `<div class="w-full max-h-[85vh] overflow-auto rounded-t-2xl bg-white dark:bg-slate-900 p-4 pb-8">
      <h3 class="font-bold mb-2">Internar paciente</h3>
      ${lista.length ? `<input type="search" placeholder="Buscar…" class="${INPUT} mb-3">` : '<p class="text-sm text-slate-500 mb-3">No hay pacientes: crealos en Fichas.</p>'}
      <div class="lista">${lista.map((p) => `<button data-internar="${esc(p.id)}" class="block w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 mb-2">${p.paciente.especie === 'felino' ? '🐱' : '🐶'} ${esc(p.paciente.nombre || 'Sin nombre')}<span class="block text-xs text-slate-500">${esc(p.tutor.nombre || '')} · ${esc(p.id)}</span></button>`).join('')}</div>
      <button class="cerrar w-full ${B_SEC} mt-2">Cancelar</button></div>`;
    h.root.appendChild(cont);
    const inp = cont.querySelector('input');
    if (inp) inp.addEventListener('input', () => {
      const q = inp.value.toLowerCase();
      cont.querySelectorAll('[data-internar]').forEach((b) => { b.hidden = q && !b.textContent.toLowerCase().includes(q); });
    });
    cont.addEventListener('click', (e) => { if (e.target === cont || e.target.closest('.cerrar')) cont.remove(); });
  }

  async function internar(h, p, fichaId) {
    if (!p) return;
    const ints = await DB.internaciones.getByPatient(p.id);
    const abierta = ints.find((i) => !i.alta);
    if (abierta) { location.hash = `#/internacion/${abierta.id}`; return; }
    const i = nuevaInternacion(p, fichaId);
    const fichas = await DB.fichas.getByPatient(p.id);
    const ultima = fichas.sort((a, b) => (b.fechaAtencion || '').localeCompare(a.fechaAtencion || ''))[0];
    if (!i.fichaId && ultima) i.fichaId = ultima.id;
    if (ultima && ultima.peso) i.peso = ultima.peso;
    if (ultima && ultima.anamnesis && ultima.anamnesis.motivoConsulta) i.motivo = ultima.anamnesis.motivoConsulta;
    await guardar(i);
    if (Apk.pedirNotificaciones) Apk.pedirNotificaciones();
    location.hash = `#/internacion/${i.id}`;
  }

  // ═════════════════ HOJA DE UN PACIENTE ═════════════════
  async function screenDetalle(id, h) {
    const i = await DB.internaciones.get(id);
    if (!i) { location.hash = '#/internados'; return; }
    const p = await DB.patients.get(i.patientId);
    let verHechas = false;
    let editando = null; // id de tratamiento en edición, 'nuevo' o null
    let controlAbierto = false;

    const nombreFarmacos = (typeof DRUGS !== 'undefined' ? DRUGS.map((d) => d.name) : []);

    function formTratamiento(t) {
      const v = t || { nombre: '', dosis: '', via: 'EV', intervaloH: 12, inicio: Date.now(), duracionDias: '', notas: '' };
      return `<div class="${CARD}" id="form-trat">
        <h3 class="font-semibold mb-1">${t ? 'Editar tratamiento' : 'Nuevo tratamiento'}</h3>
        <label class="${LBL}">Fármaco / indicación</label>
        <input id="tr-nombre" list="lista-farmacos" class="${INPUT}" value="${esc(v.nombre)}" placeholder="Ej: Cefalexina, Fluidos RL, Curación herida">
        <datalist id="lista-farmacos">${nombreFarmacos.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
        <label class="${LBL}">Dosis a administrar</label>
        <input id="tr-dosis" class="${INPUT}" value="${esc(v.dosis)}" placeholder="Ej: 2 ml (250 mg) · 1 comprimido · 30 ml/h">
        <div class="text-xs text-slate-500 mt-1">Podés calcularla en 💊 Dosis o 💧 Infusión.</div>
        <div class="grid grid-cols-2 gap-x-3">
          <div><label class="${LBL}">Vía</label><select id="tr-via" class="${INPUT}">${VIAS.map((x) => `<option ${x === v.via ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
          <div><label class="${LBL}">Frecuencia</label><select id="tr-int" class="${INPUT}">${INTERVALOS.map((x) => `<option value="${x.v}" ${x.v === Number(v.intervaloH) ? 'selected' : ''}>${x.l}</option>`).join('')}</select></div>
          <div><label class="${LBL}">Primera dosis</label><input id="tr-inicio" type="datetime-local" class="${INPUT}" value="${aLocalInput(v.inicio)}"></div>
          <div><label class="${LBL}">Duración (días)</label><input id="tr-dias" type="number" min="0" step="1" class="${INPUT}" value="${esc(v.duracionDias)}" placeholder="Hasta el alta"></div>
        </div>
        <label class="${LBL}">Notas</label>
        <input id="tr-notas" class="${INPUT}" value="${esc(v.notas)}" placeholder="Ej: diluir en 10 ml, pasar lento">
        <div class="grid grid-cols-2 gap-3 mt-3">
          <button data-accion="cancelar-trat" class="${B_SEC}">Cancelar</button>
          <button data-accion="guardar-trat" class="${B_PRI}">Guardar</button>
        </div></div>`;
    }

    function formControl() {
      return `<div class="${CARD}" id="form-ctrl">
        <h3 class="font-semibold mb-1">Nuevo control</h3>
        <div class="grid grid-cols-3 gap-x-3">
          <div><label class="${LBL}">T° (°C)</label><input id="c-temp" type="number" step="0.1" class="${INPUT}"></div>
          <div><label class="${LBL}">FC</label><input id="c-fc" type="number" class="${INPUT}"></div>
          <div><label class="${LBL}">FR</label><input id="c-fr" type="number" class="${INPUT}"></div>
          <div><label class="${LBL}">Mucosas</label><input id="c-muc" class="${INPUT}" placeholder="Rosadas"></div>
          <div><label class="${LBL}">TLLC (s)</label><input id="c-tllc" class="${INPUT}" placeholder="<2"></div>
          <div><label class="${LBL}">Dolor</label><input id="c-dolor" class="${INPUT}" placeholder="0-10"></div>
        </div>
        <div class="grid grid-cols-3 gap-x-3">
          <div><label class="${LBL}">Comió</label><select id="c-come" class="${INPUT}"><option></option><option>Sí</option><option>Poco</option><option>No</option></select></div>
          <div><label class="${LBL}">Orina</label><select id="c-orina" class="${INPUT}"><option></option><option>Normal</option><option>Poca</option><option>No</option><option>Anormal</option></select></div>
          <div><label class="${LBL}">Heces</label><select id="c-heces" class="${INPUT}"><option></option><option>Normal</option><option>Blandas</option><option>Diarrea</option><option>No</option></select></div>
        </div>
        <label class="${LBL}">Observaciones</label>
        <textarea id="c-nota" rows="2" class="${INPUT}"></textarea>
        <div class="grid grid-cols-2 gap-3 mt-3">
          <button data-accion="cancelar-ctrl" class="${B_SEC}">Cancelar</button>
          <button data-accion="guardar-ctrl" class="${B_PRI}">Guardar control</button>
        </div></div>`;
    }

    function filaTarea(x) {
      const est = {
        hecha: ['bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300', '✅'],
        omitida: ['bg-slate-100 dark:bg-slate-800 border-slate-300', '⏭️'],
        atrasada: ['bg-red-50 dark:bg-red-900/30 border-red-400', '⏰'],
        ahora: ['bg-amber-50 dark:bg-amber-900/30 border-amber-400', '🔔'],
        pendiente: ['bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700', '🕒'],
      }[x.estado];
      const key = `${x.t.id}|${x.ms}`;
      return `<div class="rounded-xl border ${est[0]} p-3 mb-2">
        <div class="flex justify-between items-center gap-2">
          <div class="min-w-0">
            <div class="text-sm font-semibold">${est[1]} ${diaHora(x.ms)} · ${esc(x.t.nombre)}</div>
            <div class="text-xs text-slate-600 dark:text-slate-300">${esc(x.t.dosis || '')} ${esc(x.t.via || '')}${x.t.notas ? ' · ' + esc(x.t.notas) : ''}</div>
            ${x.a && x.a.hecha ? `<div class="text-xs text-emerald-700 dark:text-emerald-400">Hecha ${hhmm(x.a.hecha)}${x.a.nota ? ' · ' + esc(x.a.nota) : ''}</div>` : ''}
            ${x.a && x.a.omitida ? `<div class="text-xs text-slate-500">Omitida${x.a.nota ? ' · ' + esc(x.a.nota) : ''}</div>` : ''}
          </div>
          <div class="flex gap-1 shrink-0">
            ${x.estado === 'hecha' || x.estado === 'omitida'
              ? `<button data-deshacer="${key}" class="text-xs rounded-lg border border-slate-300 px-2 py-1.5">Deshacer</button>`
              : `<button data-hecha="${key}" class="text-sm rounded-lg bg-emerald-600 text-white px-3 py-1.5 font-semibold">✓</button>
                 <button data-omitir="${key}" class="text-xs rounded-lg border border-slate-300 px-2 py-1.5">Omitir</button>`}
          </div>
        </div></div>`;
    }

    function render() {
      const ahora = Date.now();
      const ts = tareas(i, ahora - VENTANA_ATRAS, ahora + VENTANA_ADELANTE).filter((x) => verHechas || (x.estado !== 'hecha' && x.estado !== 'omitida'));
      const activos = i.tratamientos.filter((t) => !t.suspendido);
      const suspendidos = i.tratamientos.filter((t) => t.suspendido);
      const tratCard = (t) => `<div class="rounded-xl border border-slate-200 dark:border-slate-700 p-3 mb-2 ${t.suspendido ? 'opacity-60' : ''}">
          <div class="flex justify-between gap-2">
            <div class="min-w-0"><div class="text-sm font-semibold">${esc(t.nombre)}</div>
              <div class="text-xs text-slate-500">${esc(t.dosis || '—')} · ${esc(t.via || '')} · ${(INTERVALOS.find((x) => x.v === Number(t.intervaloH)) || {}).l || ''} · desde ${diaHora(t.inicio)}${t.duracionDias ? ` · ${t.duracionDias} días` : ''}${t.suspendido ? ` · suspendido ${diaHora(t.suspendido)}` : ''}</div>
              ${t.notas ? `<div class="text-xs text-slate-500">${esc(t.notas)}</div>` : ''}</div>
            ${i.alta ? '' : `<div class="flex flex-col gap-1 shrink-0">
              <button data-editar="${t.id}" class="text-xs rounded-lg border border-slate-300 px-2 py-1">Editar</button>
              <button data-suspender="${t.id}" class="text-xs rounded-lg border border-slate-300 px-2 py-1">${t.suspendido ? 'Reanudar' : 'Suspender'}</button></div>`}
          </div></div>`;
      const ctrls = i.controles.slice().sort((a, b) => b.fecha - a.fecha);

      h.renderInto(`<div class="p-4 pb-28">
        <a href="#/internados" class="text-sm text-emerald-700 dark:text-emerald-400 mb-3 inline-block">← Internados</a>
        <div class="${CARD}">
          <div class="flex justify-between items-start">
            <div>
              <h2 class="text-lg font-bold">${p && p.paciente.especie === 'felino' ? '🐱' : '🐶'} ${esc((p && p.paciente.nombre) || 'Paciente')}</h2>
              <p class="text-xs text-slate-500">Ingreso ${diaHora(i.ingreso)} · día ${diasInternado(i)}${i.alta ? ` · <b>ALTA ${diaHora(i.alta)}</b>` : ''}</p>
            </div>
            ${p ? `<a href="#/paciente/${p.id}" class="text-xs text-emerald-700 dark:text-emerald-400">Ver ficha</a>` : ''}
          </div>
          <div class="grid grid-cols-3 gap-x-3">
            <div class="col-span-2"><label class="${LBL}">Motivo</label><input data-campo="motivo" class="${INPUT}" value="${esc(i.motivo)}"></div>
            <div><label class="${LBL}">Peso (kg)</label><input data-campo="peso" type="number" step="0.01" class="${INPUT}" value="${esc(i.peso)}"></div>
            <div class="col-span-3"><label class="${LBL}">Jaula / ubicación</label><input data-campo="jaula" class="${INPUT}" value="${esc(i.jaula)}" placeholder="Ej: Jaula 3"></div>
          </div>
        </div>

        ${i.alta ? '' : `<div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-semibold text-slate-500 uppercase tracking-wide">Tareas (12 h atrás · 24 h adelante)</h3>
          <label class="text-xs flex items-center gap-1"><input type="checkbox" id="ver-hechas" ${verHechas ? 'checked' : ''}> Ver hechas</label>
        </div>
        ${ts.map(filaTarea).join('') || '<p class="text-sm text-slate-400 mb-4">No hay tareas en este período.</p>'}`}

        <div class="flex items-center justify-between mt-5 mb-2">
          <h3 class="text-sm font-semibold text-slate-500 uppercase tracking-wide">Tratamientos</h3>
          ${i.alta ? '' : '<button data-accion="nuevo-trat" class="text-xs rounded-full bg-emerald-600 text-white px-3 py-1.5 font-medium">+ Tratamiento</button>'}
        </div>
        ${editando === 'nuevo' ? formTratamiento(null) : ''}
        ${activos.map((t) => (editando === t.id ? formTratamiento(t) : tratCard(t))).join('') || (editando === 'nuevo' ? '' : '<p class="text-sm text-slate-400">Sin tratamientos.</p>')}
        ${suspendidos.map(tratCard).join('')}

        <div class="flex items-center justify-between mt-5 mb-2">
          <h3 class="text-sm font-semibold text-slate-500 uppercase tracking-wide">Controles</h3>
          ${i.alta ? '' : '<button data-accion="nuevo-ctrl" class="text-xs rounded-full bg-emerald-600 text-white px-3 py-1.5 font-medium">+ Control</button>'}
        </div>
        ${controlAbierto ? formControl() : ''}
        ${ctrls.map((c) => `<div class="rounded-xl border border-slate-200 dark:border-slate-700 p-3 mb-2 text-xs">
            <div class="font-semibold text-sm">${diaHora(c.fecha)}</div>
            <div>${textoControl(c)}</div></div>`).join('') || (controlAbierto ? '' : '<p class="text-sm text-slate-400">Sin controles.</p>')}

        <div class="grid grid-cols-2 gap-3 mt-6">
          <button data-accion="pdf" class="${B_SEC}">📄 Hoja en PDF</button>
          ${i.alta ? `<button data-accion="reabrir" class="${B_SEC}">Reabrir internación</button>
            <a href="#/alta/${i.fichaId}" class="col-span-2 text-center ${B_PRI} py-3">📝 Indicaciones al alta para el tutor</a>`
            : `<button data-accion="alta" class="${BTN} bg-blue-600 text-white">🏠 Dar de alta</button>`}
        </div>
      </div>`);
    }

    function textoControl(c) {
      return [c.temp && `T° ${c.temp} °C`, c.fc && `FC ${c.fc}`, c.fr && `FR ${c.fr}`, c.muc && `Mucosas ${c.muc}`, c.tllc && `TLLC ${c.tllc}`,
        c.dolor && `Dolor ${c.dolor}`, c.come && `Comió: ${c.come}`, c.orina && `Orina: ${c.orina}`, c.heces && `Heces: ${c.heces}`, c.nota]
        .filter(Boolean).map(esc).join(' · ');
    }

    // ───────── PDF de la hoja ─────────
    function pdfHoja() {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const T = PdfExport.pdfTxt;
      doc.setFillColor(6, 129, 54); doc.rect(0, 0, 210, 18, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
      doc.text(T(`Hoja de internación — ${(p && p.paciente.nombre) || 'Paciente'}`), 10, 11);
      doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.text(T(`N° HC ${i.patientId} · Ingreso ${diaHora(i.ingreso)}${i.alta ? ' · Alta ' + diaHora(i.alta) : ''} · Peso ${i.peso || '—'} kg · ${i.motivo || ''}`), 10, 25);
      doc.autoTable({
        startY: 30, head: [['Tratamiento', 'Dosis', 'Vía', 'Frecuencia', 'Desde', 'Estado']],
        body: i.tratamientos.length ? i.tratamientos.map((t) => [T(t.nombre), T(t.dosis), T(t.via), T((INTERVALOS.find((x) => x.v === Number(t.intervaloH)) || {}).l || ''), diaHora(t.inicio), t.suspendido ? 'Suspendido ' + diaHora(t.suspendido) : 'Activo']) : [['Sin tratamientos', '', '', '', '', '']],
        theme: 'striped', styles: { fontSize: 8 }, headStyles: { fillColor: [6, 129, 54] }, margin: { left: 10, right: 10 },
      });
      const adms = i.administraciones.slice().sort((a, b) => a.programada - b.programada);
      doc.autoTable({
        startY: doc.lastAutoTable.finalY + 6, head: [['Programada', 'Tratamiento', 'Realizada', 'Nota']],
        body: adms.length ? adms.map((a) => { const t = i.tratamientos.find((x) => x.id === a.tratamientoId); return [diaHora(a.programada), T(t ? `${t.nombre} ${t.dosis || ''}` : '—'), a.hecha ? diaHora(a.hecha) : 'OMITIDA', T(a.nota || '')]; }) : [['Sin administraciones registradas', '', '', '']],
        theme: 'striped', styles: { fontSize: 8 }, headStyles: { fillColor: [6, 129, 54] }, margin: { left: 10, right: 10 },
      });
      const cs = i.controles.slice().sort((a, b) => a.fecha - b.fecha);
      doc.autoTable({
        startY: doc.lastAutoTable.finalY + 6, head: [['Control', 'T°', 'FC', 'FR', 'Mucosas/TLLC', 'Dolor', 'Comió/Orina/Heces', 'Obs.']],
        body: cs.length ? cs.map((c) => [diaHora(c.fecha), c.temp || '', c.fc || '', c.fr || '', T(`${c.muc || ''} ${c.tllc || ''}`), T(c.dolor || ''), T([c.come, c.orina, c.heces].filter(Boolean).join(' / ')), T(c.nota || '')]) : [['Sin controles', '', '', '', '', '', '', '']],
        theme: 'striped', styles: { fontSize: 7.5 }, headStyles: { fillColor: [6, 129, 54] }, margin: { left: 10, right: 10 },
      });
      return { doc, nombre: `Internacion_${((p && p.paciente.nombre) || 'paciente').replace(/[^\w-]+/g, '_')}_${Utils.todayISO()}.pdf` };
    }

    // Resumen en texto para el registro de la historia clínica.
    function lineasResumen() {
      const L = [`Ingreso ${diaHora(i.ingreso)} · alta ${i.alta ? diaHora(i.alta) : '—'} · ${diasInternado(i)} día(s) · motivo: ${i.motivo || '—'}`];
      if (i.tratamientos.length) L.push('— Tratamientos —');
      i.tratamientos.forEach((t) => {
        const hechas = i.administraciones.filter((a) => a.tratamientoId === t.id && a.hecha).length;
        const omit = i.administraciones.filter((a) => a.tratamientoId === t.id && a.omitida).length;
        L.push(`${t.nombre}: ${t.dosis || ''} ${t.via || ''} ${(INTERVALOS.find((x) => x.v === Number(t.intervaloH)) || {}).l || ''} · ${hechas} dosis dadas${omit ? `, ${omit} omitidas` : ''}${t.suspendido ? ' · suspendido ' + diaHora(t.suspendido) : ''}`);
      });
      if (i.controles.length) L.push('— Controles —');
      i.controles.slice().sort((a, b) => a.fecha - b.fecha).forEach((c) => L.push(`${diaHora(c.fecha)}: ${textoControl(c).replace(/&[^;]+;/g, '')}`));
      return L;
    }

    async function registrarEnHistoria(pdf) {
      let f = i.fichaId ? await DB.fichas.get(i.fichaId) : null;
      if (!f) {
        f = FCV.nuevaFicha(i.patientId);
        f.peso = i.peso || '';
        f.anamnesis.motivoConsulta = 'Internación: ' + (i.motivo || '');
        i.fichaId = f.id;
      }
      f.registros = f.registros || [];
      f.registros = f.registros.filter((r) => r.internacionId !== i.id); // reemplaza el anterior si se re-da el alta
      f.registros.push({
        id: Utils.uuid(), fecha: new Date().toISOString(), tipo: 'Internación', internacionId: i.id,
        titulo: `Internación — ${(p && p.paciente.nombre) || ''} (${diasInternado(i)} día/s)`,
        lineas: lineasResumen(), pdf: { nombre: pdf.nombre, dataUrl: pdf.doc.output('datauristring') },
      });
      f.updatedAt = new Date().toISOString();
      await DB.fichas.put(f);
    }

    // ───────── eventos ─────────
    const buscarAdm = (key) => { const [tId, ms] = key.split('|'); return { tId, ms: Number(ms), a: admDe(i, tId, Number(ms)) }; };

    h.root.addEventListener('change', async (e) => {
      const el = e.target;
      if (el.id === 'ver-hechas') { verHechas = el.checked; render(); return; }
      if (el.dataset.campo) { i[el.dataset.campo] = el.value; await guardar(i); }
    });

    h.root.addEventListener('click', async (e) => {
      const t = e.target;
      const hecha = t.closest('[data-hecha]');
      const omitir = t.closest('[data-omitir]');
      const desh = t.closest('[data-deshacer]');
      if (hecha || omitir) {
        const { tId, ms, a } = buscarAdm((hecha || omitir).dataset.hecha || (hecha || omitir).dataset.omitir);
        const crudo = omitir ? prompt('Motivo por el que se omite (opcional):') : '';
        if (omitir && crudo === null) return;
        const nota = crudo || '';
        const reg = a || { id: Utils.uuid(), tratamientoId: tId, programada: ms };
        if (!a) i.administraciones.push(reg);
        if (hecha) { reg.hecha = Date.now(); reg.omitida = false; } else { reg.omitida = true; reg.hecha = null; reg.nota = nota; }
        await guardar(i); render(); return;
      }
      if (desh) {
        const { a } = buscarAdm(desh.dataset.deshacer);
        if (a) i.administraciones = i.administraciones.filter((x) => x !== a);
        await guardar(i); render(); return;
      }
      const ed = t.closest('[data-editar]');
      if (ed) { editando = ed.dataset.editar; render(); return; }
      const sus = t.closest('[data-suspender]');
      if (sus) {
        const tr = i.tratamientos.find((x) => x.id === sus.dataset.suspender);
        if (tr.suspendido) tr.suspendido = null;
        else if (confirm(`¿Suspender ${tr.nombre} desde ahora?`)) tr.suspendido = Date.now();
        await guardar(i); render(); return;
      }
      const acc = t.closest('[data-accion]');
      if (!acc) return;
      switch (acc.dataset.accion) {
        case 'nuevo-trat': editando = 'nuevo'; render(); break;
        case 'cancelar-trat': editando = null; render(); break;
        case 'guardar-trat': {
          const v = (id) => document.getElementById(id).value.trim();
          if (!v('tr-nombre')) { h.showToast('Cargá el fármaco o la indicación.', 'error'); return; }
          const inicio = desdeLocalInput(v('tr-inicio'));
          const datos = { nombre: v('tr-nombre'), dosis: v('tr-dosis'), via: v('tr-via'), intervaloH: Number(v('tr-int')),
            inicio: isNaN(inicio) ? Date.now() : inicio, duracionDias: Number(v('tr-dias')) || '', notas: v('tr-notas') };
          if (editando === 'nuevo') i.tratamientos.push({ id: Utils.uuid(), suspendido: null, ...datos });
          else Object.assign(i.tratamientos.find((x) => x.id === editando), datos);
          editando = null;
          await guardar(i);
          if (Apk.pedirNotificaciones) Apk.pedirNotificaciones();
          render(); h.showToast('Tratamiento guardado: se programaron los avisos', 'ok');
          break;
        }
        case 'nuevo-ctrl': controlAbierto = true; render(); break;
        case 'cancelar-ctrl': controlAbierto = false; render(); break;
        case 'guardar-ctrl': {
          const v = (id) => document.getElementById(id).value.trim();
          const c = { id: Utils.uuid(), fecha: Date.now(), temp: v('c-temp'), fc: v('c-fc'), fr: v('c-fr'), muc: v('c-muc'), tllc: v('c-tllc'),
            dolor: v('c-dolor'), come: v('c-come'), orina: v('c-orina'), heces: v('c-heces'), nota: v('c-nota') };
          i.controles.push(c);
          controlAbierto = false;
          await guardar(i); render();
          break;
        }
        case 'pdf': {
          const r = pdfHoja();
          h.showToast(Apk.guardarPdf(r.doc, r.nombre), 'ok');
          break;
        }
        case 'alta': {
          if (!confirm('¿Dar de alta? Se suspenden los avisos y se guarda el resumen (con la hoja en PDF) en la historia clínica.')) return;
          i.alta = Date.now();
          await registrarEnHistoria(pdfHoja());
          await guardar(i); render();
          h.showToast('Alta registrada en la historia clínica ✅', 'ok');
          break;
        }
        case 'reabrir':
          i.alta = null; await guardar(i); render(); break;
        default:
      }
    });

    render();
    sincronizarAvisos();
  }

  return { screenLista, screenDetalle, internar, sincronizarAvisos, tareas, horarios };
})();
