// render.js — generación de HTML para cada pantalla y campo del formulario.
// Los inputs usan `data-path` para que app.js los ligue automáticamente al
// objeto de datos en memoria (paciente o ficha) y dispare el autoguardado.
'use strict';

const Render = (() => {

  const esc = Utils.escapeHtml;

  // --- generadores de campo ------------------------------------------------

  function field({ label, path, value = '', type = 'text', extra = '', hint = '' }) {
    return `
      <label class="block mb-3">
        <span class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">${label}</span>
        <input type="${type}" data-path="${path}" value="${esc(value)}" ${extra}
          class="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-base text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
        ${hint ? `<span class="block text-xs text-slate-500 mt-1">${hint}</span>` : ''}
      </label>`;
  }

  function textarea({ label, path, value = '', rows = 3, extra = '', hint = '' }) {
    return `
      <label class="block mb-3">
        <span class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">${label}</span>
        <textarea data-path="${path}" rows="${rows}" ${extra}
          class="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-base text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none">${esc(value)}</textarea>
        ${hint ? `<span class="block text-xs text-slate-500 mt-1">${hint}</span>` : ''}
      </label>`;
  }

  function select({ label, path, value = '', options, extra = '' }) {
    const opts = options.map(o => {
      const v = typeof o === 'string' ? o : o.value;
      const l = typeof o === 'string' ? o : o.label;
      return `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(l)}</option>`;
    }).join('');
    return `
      <label class="block mb-3">
        <span class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">${label}</span>
        <select data-path="${path}" ${extra}
          class="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-base text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none">
          ${opts}
        </select>
      </label>`;
  }

  function radioGroup({ label, path, value = '', options }) {
    const opts = options.map(o => {
      const v = typeof o === 'string' ? o : o.value;
      const l = typeof o === 'string' ? o : o.label;
      const id = `${path}-${v}`.replace(/[^\w-]/g, '_');
      return `
        <label for="${id}" class="flex items-center gap-2 rounded-xl border px-3 py-2.5 cursor-pointer select-none
          ${v === value ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200' : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300'}">
          <input id="${id}" type="radio" name="${path}" data-path="${path}" value="${esc(v)}" ${v === value ? 'checked' : ''} class="accent-emerald-600" />
          <span class="text-sm">${esc(l)}</span>
        </label>`;
    }).join('');
    return `
      <div class="mb-3">
        <span class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">${label}</span>
        <div class="flex flex-wrap gap-2">${opts}</div>
      </div>`;
  }

  function checkbox({ label, path, checked = false, extra = '' }) {
    return `
      <label class="flex items-center gap-2 py-2 cursor-pointer select-none">
        <input type="checkbox" data-path="${path}" ${checked ? 'checked' : ''} ${extra}
          class="w-5 h-5 rounded accent-emerald-600" />
        <span class="text-sm text-slate-700 dark:text-slate-300">${label}</span>
      </label>`;
  }

  function accordion(title, icon, innerHtml, { open = false, id = '' } = {}) {
    return `
      <details ${open ? 'open' : ''} ${id ? `id="${id}"` : ''} class="ficha-accordion mb-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 overflow-hidden">
        <summary class="flex items-center gap-3 px-4 py-4 cursor-pointer list-none font-semibold text-slate-800 dark:text-slate-100 active:bg-slate-50 dark:active:bg-slate-700/50">
          <span class="text-xl">${icon}</span>
          <span class="flex-1">${title}</span>
          <span class="chevron text-slate-400">▾</span>
        </summary>
        <div class="px-4 pb-5 pt-1 border-t border-slate-100 dark:border-slate-700">${innerHtml}</div>
      </details>`;
  }

  // --- pantalla: lista de pacientes ----------------------------------------

  function patientCard(p, ultimaFicha) {
    const edad = Utils.formatEdad(Utils.calcEdad(p.paciente.fechaNacimiento));
    const especieIcon = p.paciente.especie === 'felino' ? '🐱' : '🐶';
    return `
      <a href="#/paciente/${p.id}" class="block rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 p-4 mb-3 active:scale-[0.99] transition">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-2xl">${especieIcon}</div>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-slate-800 dark:text-slate-100 truncate">${esc(p.paciente.nombre) || 'Sin nombre'}</div>
            <div class="text-xs text-slate-500 truncate">${esc(p.paciente.raza) || '—'} · ${edad}</div>
            <div class="text-xs text-slate-400">Tutor: ${esc(p.tutor.nombre) || '—'}</div>
          </div>
          <div class="text-right">
            <div class="text-[10px] font-mono text-slate-400">${p.id}</div>
            ${ultimaFicha ? `<div class="text-xs text-emerald-600 mt-1">${Utils.formatFechaCorta(ultimaFicha.fechaAtencion)}</div>` : ''}
          </div>
        </div>
      </a>`;
  }

  function patientListItems(patients, ultimaFichaPorPaciente) {
    return patients
      .slice()
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
      .map(p => patientCard(p, ultimaFichaPorPaciente[p.id]))
      .join('') || `<p class="text-center text-slate-400 py-10">Todavía no cargaste pacientes.<br>Tocá "+ Nuevo paciente" para empezar.</p>`;
  }

  function patientListScreen(patients, ultimaFichaPorPaciente) {
    const items = patientListItems(patients, ultimaFichaPorPaciente);
    return `
      <div class="p-4 pb-28">
        <div class="mb-4">
          <input id="buscador-pacientes" type="search" placeholder="Buscar por nombre, tutor o N° de HC..."
            class="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-base focus:ring-2 focus:ring-emerald-500 outline-none" />
        </div>
        <div id="lista-pacientes">${items}</div>
      </div>
      <button id="btn-nuevo-paciente" aria-label="Nuevo paciente"
        class="fixed right-5 bottom-24 w-14 h-14 rounded-full bg-emerald-600 text-white text-3xl leading-none shadow-lg flex items-center justify-center active:scale-95 transition">+</button>`;
  }

  // --- sección 1: paciente, tutor y referencia -----------------------------

  function seccionReferencia(p) {
    return accordion('Datos del paciente y referencia', '🪪', `
      <div class="grid grid-cols-2 gap-x-3">
        <div class="col-span-2 mb-3 rounded-xl bg-slate-50 dark:bg-slate-700/40 px-3 py-2 flex justify-between items-center">
          <span class="text-xs text-slate-500">N° de Historia Clínica</span>
          <span class="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-400">${p.id}</span>
        </div>
        ${field({ label: 'Fecha de atención', path: '__fechaAtencion', value: '', type: 'hidden' })}
        <div class="col-span-2">${field({ label: 'Nombre del paciente', path: 'paciente.nombre', value: p.paciente.nombre })}</div>
        <div>${radioGroup({ label: 'Especie', path: 'paciente.especie', value: p.paciente.especie, options: [{ value: 'canino', label: 'Canina 🐶' }, { value: 'felino', label: 'Felina 🐱' }] })}</div>
        <div>${field({ label: 'Fecha de nacimiento', path: 'paciente.fechaNacimiento', value: p.paciente.fechaNacimiento, type: 'date', hint: `Edad: ${Utils.formatEdad(Utils.calcEdad(p.paciente.fechaNacimiento))}` })}</div>
        <div class="col-span-2">
          ${razaField(p)}
        </div>
        <div>${radioGroup({ label: 'Sexo', path: 'paciente.sexo', value: p.paciente.sexo, options: [{ value: 'M', label: 'Macho' }, { value: 'H', label: 'Hembra' }] })}</div>
        <div>${radioGroup({ label: 'Estado reproductivo', path: 'paciente.estadoReproductivo', value: p.paciente.estadoReproductivo, options: [{ value: 'entero', label: 'Entero/a' }, { value: 'castrado', label: 'Castrado/a' }] })}</div>
        ${p.paciente.estadoReproductivo === 'castrado' ? `<div class="col-span-2">${field({ label: 'Edad al momento de la esterilización', path: 'paciente.edadEsterilizacion', value: p.paciente.edadEsterilizacion })}</div>` : ''}
        <div>${field({ label: 'Tipo de pelaje', path: 'paciente.pelajeTipo', value: p.paciente.pelajeTipo, extra: 'placeholder="Corto, largo, doble capa..."' })}</div>
        <div>${field({ label: 'Color de manto', path: 'paciente.pelajeColor', value: p.paciente.pelajeColor })}</div>
      </div>
      <hr class="my-4 border-slate-200 dark:border-slate-700" />
      <h4 class="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Tutor / Propietario</h4>
      <div class="grid grid-cols-2 gap-x-3">
        <div class="col-span-2">${field({ label: 'Nombre y apellido', path: 'tutor.nombre', value: p.tutor.nombre })}</div>
        <div>${field({ label: 'Teléfono / WhatsApp', path: 'tutor.telefono', value: p.tutor.telefono, type: 'tel', extra: 'placeholder="+54 9 341..."' })}</div>
        <div>${field({ label: 'DNI', path: 'tutor.dni', value: p.tutor.dni })}</div>
        <div class="col-span-2">${field({ label: 'Domicilio', path: 'tutor.domicilio', value: p.tutor.domicilio })}</div>
        <div class="col-span-2">${field({ label: 'Localidad', path: 'tutor.localidad', value: p.tutor.localidad })}</div>
      </div>
    `, { open: true, id: 'acc-referencia' });
  }

  function razaField(p) {
    const lista = p.paciente.especie === 'felino' ? FCV.RAZAS_FELINAS : FCV.RAZAS_CANINAS;
    const match = lista.find(r => r.nombre === p.paciente.raza);
    const datalistId = 'lista-razas';
    const options = lista.map(r => `<option value="${esc(r.nombre)}">`).join('');
    return `
      <label class="block mb-1">
        <span class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Raza</span>
        <input type="text" list="${datalistId}" data-path="paciente.raza" value="${esc(p.paciente.raza)}" placeholder="Escribí para buscar..."
          class="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-base focus:ring-2 focus:ring-emerald-500 outline-none" />
        <datalist id="${datalistId}">${options}</datalist>
      </label>
      ${match && match.predisposicion ? `<div class="text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-lg px-3 py-2 mt-1">⚠️ Predisposiciones raciales: ${esc(match.predisposicion)}</div>` : ''}
    `;
  }

  // --- sección 2: entorno, convivencia y manejo ----------------------------

  function seccionEntorno(p) {
    const e = p.entorno;
    return accordion('Entorno, convivencia y manejo', '🏠', `
      <div class="mb-3">${checkbox({ label: '¿Convive con otros animales?', path: 'entorno.conviveOtros', checked: e.conviveOtros })}</div>
      ${e.conviveOtros ? `
        <div class="grid grid-cols-2 gap-x-3 mb-2 pl-2 border-l-2 border-emerald-200 dark:border-emerald-800">
          <div>${field({ label: 'N° de caninos', path: 'entorno.nCaninos', value: e.nCaninos, type: 'number', extra: 'min="0"' })}</div>
          <div>${field({ label: 'N° de felinos', path: 'entorno.nFelinos', value: e.nFelinos, type: 'number', extra: 'min="0"' })}</div>
          <div class="col-span-2">${field({ label: 'Otros (especies/cantidad)', path: 'entorno.otrosDesc', value: e.otrosDesc })}</div>
        </div>` : ''}
      <div class="grid grid-cols-2 gap-x-3">
        <div>${select({ label: 'Alimentación', path: 'entorno.alimentacionTipo', value: e.alimentacionTipo, options: ['Balanceado', 'Comida natural', 'Mixta'] })}</div>
        <div>${field({ label: 'Frecuencia / marca', path: 'entorno.alimentacionFrecuencia', value: e.alimentacionFrecuencia, extra: 'placeholder="2 veces/día, ad libitum..."' })}</div>
        <div class="col-span-2">${select({ label: 'Hábitat', path: 'entorno.habitat', value: e.habitat, options: ['Fuera de la casa', 'Dentro de la casa', 'Mixto'] })}</div>
        <div class="col-span-2">${checkbox({ label: '¿Vagabundea / tiene acceso a la vía pública?', path: 'entorno.vagabundea', checked: e.vagabundea })}</div>
        ${e.vagabundea ? `<div class="col-span-2">${select({ label: 'Frecuencia', path: 'entorno.vagabundeaFrecuencia', value: e.vagabundeaFrecuencia, options: ['Todo el día', 'Por la noche', 'Ocasionalmente'] })}</div>` : ''}
      </div>
    `, { id: 'acc-entorno' });
  }

  // --- sección 3: plan sanitario -------------------------------------------

  function seccionPlanSanitario(p) {
    const ps = p.planSanitario;
    const vacunasHtml = ps.vacunas.map((v, i) => `
      <div class="rounded-xl border border-slate-200 dark:border-slate-700 p-3 mb-2">
        ${checkbox({ label: v.nombre, path: `planSanitario.vacunas.${i}.aplicada`, checked: v.aplicada })}
        ${v.aplicada ? `
          <div class="grid grid-cols-2 gap-x-3 mt-1 pl-1">
            <div>${field({ label: 'Fecha', path: `planSanitario.vacunas.${i}.fecha`, value: v.fecha, type: 'date' })}</div>
            <div>${field({ label: 'Marca / lote', path: `planSanitario.vacunas.${i}.lote`, value: v.lote })}</div>
          </div>` : ''}
      </div>`).join('');

    const alertaCertificado = !ps.certificadoVeterinario
      ? `<div class="mt-2 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm px-3 py-2">
           ⚠️ Plan sanitario no respaldado legalmente: considerar inicio de cero.
         </div>` : '';

    return accordion('Plan sanitario de base', '💉', `
      <h4 class="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Desparasitación</h4>
      <div class="grid grid-cols-1 gap-x-3">
        ${select({ label: 'Última fecha de desparasitación', path: 'planSanitario.desparasitacionUltimaFecha', value: ps.desparasitacionUltimaFecha, options: FCV.OPCIONES_ULTIMA_DESPARASITACION })}
        ${field({ label: '¿Con qué está desparasitado? (principio activo y dosis)', path: 'planSanitario.desparasitacionProducto', value: ps.desparasitacionProducto })}
      </div>
      <hr class="my-4 border-slate-200 dark:border-slate-700" />
      <h4 class="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Vacunación (último año)</h4>
      ${vacunasHtml}
      ${checkbox({ label: '¿Vacunación certificada por veterinario matriculado?', path: 'planSanitario.certificadoVeterinario', checked: ps.certificadoVeterinario })}
      ${alertaCertificado}
    `, { id: 'acc-sanitario' });
  }

  // --- sección 4: anamnesis -------------------------------------------------

  function seccionAnamnesis(f) {
    const pares = FCV.PARES_SEMIOLOGICOS.map(par => `
      <div class="flex gap-2 mb-1.5">
        <button type="button" data-quick-insert="anamnesis.motivoConsulta" data-quick-text="${esc(par.a)}"
          class="flex-1 text-xs rounded-lg border border-slate-300 dark:border-slate-600 py-2 px-2 active:bg-emerald-50 dark:active:bg-emerald-900/40">${esc(par.a)}</button>
        <span class="text-xs text-slate-400 self-center">vs.</span>
        <button type="button" data-quick-insert="anamnesis.motivoConsulta" data-quick-text="${esc(par.b)}"
          class="flex-1 text-xs rounded-lg border border-slate-300 dark:border-slate-600 py-2 px-2 active:bg-emerald-50 dark:active:bg-emerald-900/40">${esc(par.b)}</button>
      </div>`).join('');
    return accordion('Anamnesis y motivo de consulta', '📋', `
      ${textarea({ label: 'Motivo de consulta (transcripción literal del tutor)', path: 'anamnesis.motivoConsulta', value: f.anamnesis.motivoConsulta, rows: 4 })}
      <div class="mb-3">
        <span class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Asistente semiológico rápido</span>
        <p class="text-xs text-slate-500 mb-2">Tocá un signo para agregarlo al motivo de consulta.</p>
        ${pares}
      </div>
      ${textarea({ label: 'Otros datos de interés (antecedentes, cirugías, fármacos recientes)', path: 'anamnesis.otrosDatos', value: f.anamnesis.otrosDatos, rows: 3, hint: 'Ej: administración previa de paracetamol, diclofenac u otros AINEs' })}
    `, { id: 'acc-anamnesis' });
  }

  // --- sección 5: examen objetivo general ----------------------------------

  function semaforoClase(estado) {
    if (estado === 'alerta') return 'border-red-400 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300';
    if (estado === 'normal') return 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';
    return 'border-slate-300 dark:border-slate-600';
  }

  function constanteVital({ label, path, value, rango, especie }) {
    const estado = FCV.evaluarConstante(value, rango);
    const cls = semaforoClase(estado);
    return `
      <label class="block mb-3">
        <span class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">${label} <span class="text-xs text-slate-400">(${rango.min}–${rango.max} ${rango.unidad})</span></span>
        <input type="number" step="0.1" data-path="${path}" data-vital="${path}" value="${esc(value)}"
          class="w-full rounded-xl border-2 ${cls} px-3 py-2.5 text-base focus:ring-2 focus:ring-emerald-500 outline-none" />
      </label>`;
  }

  function seccionEOG(f, especie) {
    const eog = f.eog;
    const rangos = FCV.RANGOS_VITALES[especie] || FCV.RANGOS_VITALES.canino;
    const ganglios = FCV.GANGLIOS.map(g => {
      const gg = eog.ganglios[g] || { alterado: false, desc: '' };
      return `
        <div class="rounded-xl border border-slate-200 dark:border-slate-700 p-3 mb-2">
          ${checkbox({ label: FCV.GANGLIOS_LABEL[g], path: `eog.ganglios.${g}.alterado`, checked: gg.alterado })}
          ${gg.alterado ? field({ label: 'Tamaño, forma, movilidad, temperatura, dolor', path: `eog.ganglios.${g}.desc`, value: gg.desc }) : ''}
        </div>`;
    }).join('');

    return accordion('Examen objetivo general (EOG)', '🩺', `
      <div class="grid grid-cols-1 gap-x-3">
        ${radioGroup({ label: 'Estado general', path: 'eog.estadoGeneral', value: eog.estadoGeneral, options: ['Favorable', 'Regular', 'Grave'] })}
        ${select({ label: 'Estado del sensorio', path: 'eog.sensorio', value: eog.sensorio, options: ['Alerta / Vivaz', 'Depresión / Obnubilación', 'Estupor', 'Sopor', 'Coma'] })}
        ${select({ label: 'Hidratación estimada', path: 'eog.hidratacionPorcentaje', value: eog.hidratacionPorcentaje, options: ['0-5% (normal)', '6-8% (moderada)', '9-10% (severa)', '>10% (crítica)'], extra: '' })}
        <p class="text-xs text-slate-500 -mt-2 mb-3">Evaluar por prueba del pliegue cutáneo, hundimiento ocular y humedad de encías.</p>
      </div>
      <h4 class="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Constantes vitales</h4>
      <div class="grid grid-cols-1 gap-x-3">
        ${constanteVital({ label: 'Temperatura', path: 'eog.temperatura', value: eog.temperatura, rango: rangos.temperatura })}
        ${constanteVital({ label: 'Frecuencia cardíaca', path: 'eog.fc', value: eog.fc, rango: rangos.fc })}
        ${constanteVital({ label: 'Frecuencia respiratoria', path: 'eog.fr', value: eog.fr, rango: rangos.fr })}
        ${select({ label: 'Mucosas aparentes', path: 'eog.mucosas', value: eog.mucosas, options: ['Rosadas (normales)', 'Pálidas', 'Ictéricas', 'Cianóticas', 'Congestivas'] })}
        ${field({ label: 'Tiempo de llenado capilar (TLLC, seg)', path: 'eog.tllc', value: eog.tllc, type: 'number', extra: 'step="0.1"', hint: 'Normal: 1-2 segundos' })}
      </div>
      <hr class="my-4 border-slate-200 dark:border-slate-700" />
      <h4 class="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Palpación de ganglios / linfonódulos</h4>
      ${ganglios}
    `, { id: 'acc-eog' });
  }

  // --- sección 6: exploración por sistemas (EOP) ---------------------------

  function seccionEOP(f) {
    const sistemas = FCV.SISTEMAS_EOP.map(s => {
      const data = f.eop[s.key];
      return `
        <div class="rounded-xl border border-slate-200 dark:border-slate-700 p-3 mb-2">
          <div class="font-medium text-sm text-slate-800 dark:text-slate-100 mb-1">${s.label}</div>
          <p class="text-xs text-slate-500 mb-2">${s.hint}</p>
          ${radioGroup({ label: '', path: `eop.${s.key}.estado`, value: data.estado, options: [{ value: 'normal', label: 'Normal' }, { value: 'patologico', label: 'Patológico' }] })}
          ${data.estado === 'patologico' ? textarea({ label: 'Descripción del hallazgo', path: `eop.${s.key}.desc`, value: data.desc, rows: 2 }) : ''}
        </div>`;
    }).join('');
    return accordion('Exploración clínica particular (EOP)', '🔬', sistemas, { id: 'acc-eop' });
  }

  // --- sección 7: diagnóstico, pronóstico y plan ----------------------------

  /** Previsualización de un adjunto: miniatura si es imagen, ícono + nombre si es PDF u otro archivo. */
  function adjuntoPreview(archivo, path, idx) {
    const esImagen = (archivo.tipo || '').startsWith('image/');
    const contenido = esImagen
      ? `<img src="${archivo.dataUrl}" class="w-16 h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-600" />`
      : `<div class="w-16 h-16 flex flex-col items-center justify-center gap-0.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-300">
          <span class="text-xl">📄</span>
          <span class="text-[9px] px-1 truncate max-w-[60px]">${esc(archivo.nombre || 'archivo')}</span>
        </div>`;
    return `
      <div class="relative">
        <a href="${archivo.dataUrl}" download="${esc(archivo.nombre || 'archivo')}" target="_blank" rel="noopener" title="${esc(archivo.nombre || '')}">${contenido}</a>
        <button type="button" data-file-remove="${path}" data-file-index="${idx}"
          class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-600 text-white text-xs leading-5">×</button>
      </div>`;
  }

  function seccionDiagnostico(f) {
    const d = f.diagnostico;
    const metodos = d.metodosComplementarios.map((m, i) => `
      <div class="rounded-xl border border-slate-200 dark:border-slate-700 p-3 mb-2">
        ${checkbox({ label: m.tipo, path: `diagnostico.metodosComplementarios.${i}.solicitado`, checked: m.solicitado })}
        ${m.solicitado ? `
          <div class="grid grid-cols-2 gap-x-3 pl-1">
            <div>${field({ label: 'Fecha', path: `diagnostico.metodosComplementarios.${i}.fecha`, value: m.fecha, type: 'date' })}</div>
            <div class="col-span-2">${textarea({ label: 'Resultado', path: `diagnostico.metodosComplementarios.${i}.resultado`, value: m.resultado, rows: 2 })}</div>
            <div class="col-span-2">
              <span class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Adjuntar resultado (foto o PDF)</span>
              <p class="text-xs text-slate-500 mb-1">Podés sacar una foto o elegir un archivo ya guardado (ej. un PDF de laboratorio).</p>
              <input type="file" accept="image/*,application/pdf,.pdf" multiple data-file-target="diagnostico.metodosComplementarios.${i}.archivos"
                class="block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:text-white file:px-3 file:py-2" />
              <div class="flex flex-wrap gap-2 mt-2" data-file-preview="diagnostico.metodosComplementarios.${i}.archivos">
                ${(m.archivos || []).map((a, ai) => adjuntoPreview(a, `diagnostico.metodosComplementarios.${i}.archivos`, ai)).join('')}
              </div>
            </div>
          </div>` : ''}
      </div>`).join('');

    return accordion('Juicio diagnóstico, pronóstico y plan', '🧠', `
      ${textarea({ label: 'Diagnóstico presuntivo', path: 'diagnostico.presuntivo', value: d.presuntivo, rows: 2 })}
      ${textarea({ label: 'Diagnósticos diferenciales (jerarquizados)', path: 'diagnostico.diferenciales', value: d.diferenciales, rows: 3 })}
      <hr class="my-4 border-slate-200 dark:border-slate-700" />
      <h4 class="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Métodos complementarios de diagnóstico</h4>
      ${metodos}
      <hr class="my-4 border-slate-200 dark:border-slate-700" />
      ${textarea({ label: 'Diagnóstico definitivo', path: 'diagnostico.definitivo', value: d.definitivo, rows: 2 })}
      ${select({ label: 'Clasificación del diagnóstico', path: 'diagnostico.clasificacionDefinitivo', value: d.clasificacionDefinitivo, options: ['', ...FCV.CLASIFICACION_DIAGNOSTICO_DEFINITIVO] })}
      ${radioGroup({ label: 'Pronóstico', path: 'diagnostico.pronostico', value: d.pronostico, options: ['Favorable', 'Desfavorable', 'Reservado'] })}
    `, { id: 'acc-diagnostico' });
  }

  // --- sección 8: tratamiento con calculadora de dosis ----------------------

  function prescripcionCard(rx, i, pesoKg) {
    const calc = Utils.calcularVolumenDosis(rx.dosisMgKg, pesoKg, rx.concentracionMgMl);
    return `
      <div class="rounded-xl border border-slate-200 dark:border-slate-700 p-3 mb-3">
        <div class="flex justify-between items-center mb-2">
          <span class="text-xs font-mono text-slate-400">Fármaco ${i + 1}</span>
          <button type="button" data-remove-rx="${i}" class="text-xs text-red-600">Quitar</button>
        </div>
        <div class="grid grid-cols-2 gap-x-3">
          <div class="col-span-2">${field({ label: 'Principio activo', path: `tratamiento.prescripciones.${i}.principioActivo`, value: rx.principioActivo })}</div>
          <div>${field({ label: 'Dosis (mg/kg)', path: `tratamiento.prescripciones.${i}.dosisMgKg`, value: rx.dosisMgKg, type: 'number', extra: 'step="0.01"' })}</div>
          <div>${field({ label: 'Concentración comercial (mg/ml)', path: `tratamiento.prescripciones.${i}.concentracionMgMl`, value: rx.concentracionMgMl, type: 'number', extra: 'step="0.01"' })}</div>
          <div>${field({ label: 'Intervalo (horas)', path: `tratamiento.prescripciones.${i}.intervalo`, value: rx.intervalo, type: 'number' })}</div>
          <div>${field({ label: 'Duración (días)', path: `tratamiento.prescripciones.${i}.duracionDias`, value: rx.duracionDias, type: 'number' })}</div>
        </div>
        <div id="rx-calc-${i}">${rxCalcHtml(calc, pesoKg)}</div>
      </div>`;
  }

  function rxCalcHtml(calc, pesoKg) {
    return calc
      ? `<div class="rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 text-sm px-3 py-2 mt-1">
            💊 Administrar <strong>${calc.ml} ml</strong> (${calc.mgTotales} mg totales) por dosis, con el peso actual (${pesoKg} kg).
          </div>`
      : `<p class="text-xs text-slate-400">Completá dosis, peso y concentración para calcular el volumen a administrar.</p>`;
  }

  function seccionTratamiento(f) {
    const t = f.tratamiento;
    const pesoKg = f.peso;
    const rxs = (t.prescripciones || []).map((rx, i) => prescripcionCard(rx, i, pesoKg)).join('');
    return accordion('Tratamiento', '💊', `
      ${textarea({ label: 'Indicaciones médicas inmediatas / intrahospitalarias', path: 'tratamiento.indicacionesInmediatas', value: t.indicacionesInmediatas, rows: 3 })}
      <h4 class="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2 mt-2">Prescripción para el hogar — calculadora de dosis</h4>
      ${!pesoKg ? '<p class="text-xs text-amber-600 mb-2">⚠️ Cargá el peso actual del paciente para habilitar el cálculo automático.</p>' : ''}
      ${rxs}
      <button type="button" id="btn-add-rx" class="w-full rounded-xl border-2 border-dashed border-emerald-400 text-emerald-700 dark:text-emerald-400 py-3 text-sm font-medium active:bg-emerald-50 dark:active:bg-emerald-900/30">+ Agregar fármaco</button>
    `, { id: 'acc-tratamiento' });
  }

  // --- sección 9: recordatorios / próximas citas (Google Calendar) ---------

  function recordatorioCard(r, i) {
    const agendado = !!r.googleEventId;
    const enCelular = Apk.disponible();
    return `
      <div class="rounded-xl border border-slate-200 dark:border-slate-700 p-3 mb-3">
        <div class="flex justify-between items-center mb-2">
          <span class="text-xs font-mono text-slate-400">Recordatorio ${i + 1}</span>
          <button type="button" data-remove-recordatorio="${i}" class="text-xs text-red-600">Quitar</button>
        </div>
        <div class="grid grid-cols-2 gap-x-3">
          <div class="col-span-2">${select({ label: 'Tipo', path: `recordatorios.${i}.tipo`, value: r.tipo, options: FCV.TIPOS_RECORDATORIO })}</div>
          <div>${field({ label: 'Fecha', path: `recordatorios.${i}.fecha`, value: r.fecha, type: 'date' })}</div>
          <div>${field({ label: 'Hora (opcional)', path: `recordatorios.${i}.hora`, value: r.hora, type: 'time', hint: 'Sin hora queda como evento de todo el día' })}</div>
          <div class="col-span-2">${field({ label: 'Notas', path: `recordatorios.${i}.notas`, value: r.notas, extra: 'placeholder="Ej: refuerzo antirrábica, control post-quirúrgico..."' })}</div>
        </div>
        <div id="recordatorio-estado-${i}">
          ${agendado ? `
            <div class="rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 text-sm px-3 py-2 mt-1 flex items-center justify-between gap-2">
              <span>📅 Agendado en Google Calendar</span>
              <a href="${esc(r.googleEventLink)}" target="_blank" rel="noopener" class="underline shrink-0">Ver evento</a>
            </div>
            <button type="button" data-cancelar-recordatorio="${i}" class="w-full rounded-xl border border-red-300 text-red-600 py-2 text-xs font-medium mt-2">Cancelar en Google Calendar</button>
          ` : enCelular ? `
            ${r.agendadoEnCelular ? '<div class="rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 text-sm px-3 py-2 mt-1">📅 Enviado al calendario del celular</div>' : ''}
            <button type="button" data-agendar-recordatorio="${i}" class="w-full rounded-xl bg-emerald-600 text-white py-2.5 text-sm font-medium mt-2">📅 ${r.agendadoEnCelular ? 'Agendar de nuevo' : 'Agendar en el calendario del celular'}</button>
          ` : `
            <button type="button" data-agendar-recordatorio="${i}" class="w-full rounded-xl bg-emerald-600 text-white py-2.5 text-sm font-medium mt-1">📅 Agendar en Google Calendar</button>
          `}
        </div>
      </div>`;
  }

  function seccionRecordatorios(f) {
    const items = (f.recordatorios || []).map((r, i) => recordatorioCard(r, i)).join('');
    return accordion('Recordatorios y próximas citas', '📅', `
      <p class="text-xs text-slate-500 mb-3">${Apk.disponible()
        ? 'Programá la próxima vacunación, desparasitación o visita de control y agendala en el calendario del celular (con su aviso).'
        : 'Programá la próxima vacunación, desparasitación o visita de control y mandala directo a Google Calendar. Requiere configurar el Client ID de Google en Ajustes.'}</p>
      ${items}
      <button type="button" id="btn-add-recordatorio" class="w-full rounded-xl border-2 border-dashed border-emerald-400 text-emerald-700 dark:text-emerald-400 py-3 text-sm font-medium active:bg-emerald-50 dark:active:bg-emerald-900/30">+ Agregar recordatorio</button>
    `, { id: 'acc-recordatorios' });
  }

  // --- ficha de peso ---------------------------------------------------------

  function sparkline(puntos, width = 300, height = 70) {
    if (!puntos.length) return '<p class="text-xs text-slate-400">Sin registros de peso todavía.</p>';
    const pesos = puntos.map(p => p.peso);
    const min = Math.min(...pesos), max = Math.max(...pesos);
    const range = (max - min) || 1;
    const stepX = puntos.length > 1 ? width / (puntos.length - 1) : 0;
    const coords = puntos.map((p, i) => {
      const x = stepX * i;
      const y = height - ((p.peso - min) / range) * (height - 16) - 8;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const circles = puntos.map((p, i) => {
      const [x, y] = coords[i].split(',');
      return `<circle cx="${x}" cy="${y}" r="3" fill="#059669" />`;
    }).join('');
    return `
      <svg viewBox="0 0 ${width} ${height}" class="w-full h-20">
        <polyline fill="none" stroke="#059669" stroke-width="2" points="${coords.join(' ')}" />
        ${circles}
      </svg>
      <div class="flex justify-between text-xs text-slate-400 mt-1">
        <span>${Utils.formatFechaCorta(puntos[0].fecha)} · ${puntos[0].peso} kg</span>
        <span>${Utils.formatFechaCorta(puntos[puntos.length - 1].fecha)} · ${puntos[puntos.length - 1].peso} kg</span>
      </div>`;
  }

  // --- pantalla de detalle de paciente (base + historial de consultas) -----

  // --- registros de cálculos y procedimientos (desde las calculadoras) ------

  function fechaHora(iso) {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function seccionRegistros(f) {
    const regs = (f.registros || []).slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    const items = regs.map((r) => `
      <div class="rounded-xl border border-slate-200 dark:border-slate-700 p-3 mb-3">
        <div class="flex justify-between items-start gap-2">
          <div>
            <span class="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">${esc(r.tipo || 'Registro')}</span>
            <div class="text-sm font-semibold text-slate-800 dark:text-slate-100">${esc(r.titulo || '')}</div>
            <div class="text-xs text-slate-400">${fechaHora(r.fecha)}</div>
          </div>
          <button type="button" data-remove-registro="${esc(r.id)}" class="text-xs text-red-600 shrink-0">Quitar</button>
        </div>
        <ul class="mt-2 text-xs text-slate-600 dark:text-slate-300 list-disc pl-4 space-y-0.5">${(r.lineas || []).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
        ${r.pdf ? `<button type="button" data-abrir-registro-pdf="${esc(r.id)}" class="mt-2 w-full rounded-xl border border-slate-300 dark:border-slate-600 py-2 text-xs font-medium">📄 Abrir ${esc(r.pdf.nombre || 'PDF')}</button>` : ''}
      </div>`).join('');
    return accordion(`Registros de cálculos y procedimientos${regs.length ? ` (${regs.length})` : ''}`, '🧾', `
      <p class="text-xs text-slate-500 mb-3">Dosis, infusiones, fluidoterapia, transfusión, nutrición y fichas anestésicas guardadas desde las otras pestañas con "📋 Guardar en historia clínica". Se incluyen en el PDF.</p>
      ${items || '<p class="text-xs text-slate-400">Sin registros todavía.</p>'}
    `, { id: 'acc-registros', open: regs.length > 0 });
  }

  function patientDetailScreen(p, fichas) {
    const edad = Utils.formatEdad(Utils.calcEdad(p.paciente.fechaNacimiento));
    const historial = fichas.filter(f => f.peso).map(f => ({ fecha: f.fechaAtencion, peso: parseFloat(f.peso) })).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const consultasList = fichas
      .slice().sort((a, b) => (b.fechaAtencion || '').localeCompare(a.fechaAtencion || ''))
      .map(f => `
        <a href="#/consulta/${f.id}" class="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-3 mb-2 active:bg-slate-50 dark:active:bg-slate-700/40">
          <div>
            <div class="text-sm font-medium text-slate-800 dark:text-slate-100">${Utils.formatFechaLarga(f.fechaAtencion)}</div>
            <div class="text-xs text-slate-500">${esc((f.anamnesis && f.anamnesis.motivoConsulta) || 'Sin motivo cargado').slice(0, 60)}</div>
          </div>
          <span class="text-xs px-2 py-1 rounded-full ${f.status === 'finalizada' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}">${f.status === 'finalizada' ? 'Finalizada' : 'Borrador'}</span>
        </a>`).join('') || '<p class="text-xs text-slate-400">Sin consultas registradas.</p>';

    return `
      <div class="p-4 pb-28">
        <a href="#/pacientes" class="text-sm text-emerald-700 dark:text-emerald-400 mb-3 inline-block">← Pacientes</a>
        <div class="rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-4 mb-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100">${esc(p.paciente.nombre) || 'Sin nombre'}</h2>
              <p class="text-xs text-slate-500">${esc(p.paciente.raza)} · ${edad} · ${p.paciente.sexo === 'M' ? 'Macho' : 'Hembra'}</p>
            </div>
            <span class="text-3xl">${p.paciente.especie === 'felino' ? '🐱' : '🐶'}</span>
          </div>
          <p class="text-xs text-slate-400 font-mono mt-1">${p.id}</p>
        </div>

        <button id="btn-drive-historia" class="w-full rounded-xl bg-blue-600 text-white py-3 text-sm font-medium mb-4">☁️ Guardar historia clínica completa en Google Drive</button>

        <h3 class="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Curva de peso</h3>
        <div class="rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-4 mb-4">
          ${sparkline(historial)}
        </div>

        <div id="form-paciente-base">
          ${seccionReferencia(p)}
          ${seccionEntorno(p)}
          ${seccionPlanSanitario(p)}
        </div>

        <div class="flex items-center justify-between mt-4 mb-2">
          <h3 class="text-sm font-semibold text-slate-500 uppercase tracking-wide">Consultas</h3>
          <button id="btn-nueva-consulta" class="text-xs rounded-full bg-emerald-600 text-white px-3 py-1.5 font-medium">+ Nueva consulta</button>
        </div>
        ${consultasList}
      </div>`;
  }

  // --- pantalla de consulta (ficha) -----------------------------------------

  function consultaScreen(f, p) {
    return `
      <div class="p-4 pb-32">
        <a href="#/paciente/${p.id}" class="text-sm text-emerald-700 dark:text-emerald-400 mb-3 inline-block">← ${esc(p.paciente.nombre)}</a>
        <div class="rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-4 mb-4">
          <div class="grid grid-cols-2 gap-x-3">
            ${field({ label: 'Fecha de atención', path: 'fechaAtencion', value: f.fechaAtencion, type: 'date' })}
            ${field({ label: 'Peso actual (kg)', path: 'peso', value: f.peso, type: 'number', extra: 'step="0.01" min="0"' })}
          </div>
        </div>
        <div id="form-consulta">
          ${seccionAnamnesis(f)}
          ${seccionEOG(f, p.paciente.especie)}
          ${seccionEOP(f)}
          ${seccionDiagnostico(f)}
          ${seccionTratamiento(f)}
          ${seccionRecordatorios(f)}
          ${seccionRegistros(f)}
        </div>

        <div class="grid grid-cols-2 gap-3 mt-4">
          <button id="btn-ir-dosis" class="rounded-xl border-2 border-emerald-500 text-emerald-700 dark:text-emerald-400 py-3 text-sm font-medium">💊 Calcular dosis</button>
          <button id="btn-ir-anestesia" class="rounded-xl border-2 border-emerald-500 text-emerald-700 dark:text-emerald-400 py-3 text-sm font-medium">🩺 Ficha anestésica</button>
        </div>
        <div class="grid grid-cols-2 gap-3 mt-3">
          <button id="btn-pdf" class="rounded-xl bg-slate-800 dark:bg-slate-700 text-white py-3 text-sm font-medium">📄 Exportar PDF</button>
          <button id="btn-whatsapp" class="rounded-xl bg-green-600 text-white py-3 text-sm font-medium">💬 Resumen al tutor</button>
        </div>
        <div class="grid grid-cols-2 gap-3 mt-3">
          <button id="btn-cloud-sync" class="rounded-xl border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 py-3 text-sm font-medium">${Apk.disponible() ? '☁️ Guardar en Google Drive' : '☁️ Respaldar en la nube'}</button>
          <button id="btn-finalizar" class="rounded-xl border-2 border-emerald-500 text-emerald-700 dark:text-emerald-400 py-3 text-sm font-medium">${f.status === 'finalizada' ? '✅ Finalizada' : 'Marcar finalizada'}</button>
        </div>
      </div>`;
  }

  return {
    patientListScreen, patientListItems, patientDetailScreen, consultaScreen,
    field, textarea, select, radioGroup, checkbox, accordion, rxCalcHtml,
  };
})();
