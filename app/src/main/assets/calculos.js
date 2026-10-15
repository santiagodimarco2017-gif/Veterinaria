'use strict';

// Cálculos clínicos: fluidoterapia, transfusión y nutrición.

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function num(s) {
  const t = String(s ?? '').trim().replace(/\s/g, '').replace(',', '.');
  return t === '' ? NaN : Number(t);
}
function fmt(n, d) {
  if (!isFinite(n)) return '—';
  const a = Math.abs(n);
  const dec = d !== undefined ? d : a >= 100 ? 0 : a >= 10 ? 1 : 2;
  return n.toLocaleString('es-AR', { maximumFractionDigits: dec });
}
const store = {
  get(k, def) { try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } },
};
const kv = (label, value, cls = '') => `<div class="kv ${cls}"><span>${label}</span><b>${value}</b></div>`;
const box = (warn, rows, head) => `<div class="result">${head ? `<div class="rhead">${head}</div>` : ''}
  ${warn.map((t) => `<div class="alert warn">⚠ ${esc(t)}</div>`).join('')}${rows.join('')}</div>`;
const muted = (t) => `<div class="result muted">${t}</div>`;
const drip = (mlh, factor) => {
  const gpm = mlh * factor / 60;
  return [kv(`Goteo (${factor} gotas/ml)`, `${fmt(gpm, 1)} gotas/min`, 'big hl'), kv('1 gota cada', `${fmt(60 / gpm, 1)} s`, 'sub')];
};

// ───────────── Estado ─────────────
const state = Object.assign({
  tool: 'fluidos',
  fModo: 'int', fHipo: 'no', fBolo: '', fDh: '', fH: '24', fMant: 'aaha', fPed: 'no', fLoss: '',
  fK: '', fBag: '', fKcl: '', fAnDh: '', fSc: '', fScF: '1',
  tProd: 'se', tHr: '', tHd: '', tHdon: '', tBv: '', tTmax: '4', tRisk: 'no', tSet: 'bomba',
  nW: '', nStage: '', nF: '', nProt: '', nFat: '', nFib: '', nHum: '', nAsh: '', nMeals: '2', nKcalKg: '',
}, store.get('uv.calc', {}));
state.sp = store.get('uv.sp', 'p');
state.weight = store.get('uv.weight', '');
const save = () => { const { sp, weight, ...rest } = state; store.set('uv.calc', rest); };
const W = () => num(state.weight);

// ───────────── Fluidoterapia (2024 AAHA Fluid Therapy Guidelines) ─────────────
// Tabla 3: deshidratación intersticial estimada por examen físico.
const DESHIDRATACION = [
  { v: 0, t: '< 5%', d: 'No detectable.' },
  { v: 5, t: '5–6%', d: 'Algún cambio en la turgencia de la piel.' },
  { v: 7, t: '6–8%', d: 'Leve disminución de la turgencia; mucosas secas (la xerostomía puede estar presente en IRA/ERC sin deshidratación).' },
  { v: 9, t: '8–10%', d: 'Disminución evidente de la turgencia; globos oculares retraídos en las órbitas.' },
  { v: 11, t: '10–12%', d: 'Pliegue persistente por pérdida total de la elasticidad; córneas opacas; evidencia de hipovolemia.' },
  { v: 13, t: '> 12%', d: 'Shock hipovolémico; muerte.' },
];

// Tabla 9: mantenimiento. Perro: 60 ml/kg/día, 132 × peso^0,75 o 30 × peso + 70;
// gato: 40 ml/kg/día, 80 × peso^0,75 o 30 × peso + 70. Pediátrico: perro ×3, gato ×2,5.
function mantenimientoDia(kg, sp, formula, pediatrico) {
  let ml;
  if (formula === 'kg') ml = (sp === 'g' ? 40 : 60) * kg;
  else if (formula === 'lin') ml = 30 * kg + 70;
  else ml = (sp === 'g' ? 80 : 132) * Math.pow(kg, 0.75);
  return pediatrico ? ml * (sp === 'g' ? 2.5 : 3) : ml;
}
const MANT_TXT = {
  kg: { p: 'Perro: 60 ml/kg/día.', g: 'Gato: 40 ml/kg/día.' },
  aaha: { p: 'Perro: 132 × peso^0,75 ml/día.', g: 'Gato: 80 × peso^0,75 ml/día.' },
  lin: { p: '30 × peso + 70 ml/día.', g: '30 × peso + 70 ml/día.' },
};

// Tabla 11: potasio a suplementar según el potasio sérico (mEq/kg/h).
function dosisPotasio(k) {
  if (k < 2) return [0.5, 0.5];
  if (k < 2.6) return [0.3, 0.4];
  if (k <= 3) return [0.2, 0.25];
  if (k <= 3.5) return [0.1, 0.15];
  return [0.05, 0.05];
}

const head = (w) => `${state.sp === 'g' ? '🐱 Gato' : '🐶 Perro'} · ${fmt(w, 2)} kg`;
const rango = (a, b, d, u) => (Math.abs(a - b) < 1e-9 ? fmt(a, d) : `${fmt(a, d)}–${fmt(b, d)}`) + (u ? ' ' + u : '');

function renderFluidosForm() {
  ['int', 'anes', 'sc'].forEach((m) => { $('#fm-' + m).hidden = state.fModo !== m; });
  $('#dh-chips').innerHTML = DESHIDRATACION.map((x) =>
    `<button class="chip ${num(state.fDh) === x.v ? 'on' : ''}" data-dh="${x.v}">${x.t}</button>`).join('');
  const dh = num(state.fDh);
  const sel = DESHIDRATACION.slice().reverse().find((x) => dh >= x.v);
  $('#dh-desc').textContent = sel && isFinite(dh) ? sel.d : 'La correlación entre signos y % de deshidratación varía mucho: es solo una estimación.';
  $('#h-chips').innerHTML = [12, 18, 24].map((h) => `<button class="chip ${num(state.fH) === h ? 'on' : ''}" data-h="${h}">${h} h</button>`).join('');
  $('#f-bolo-wrap').hidden = state.fHipo !== 'si';
  $('#f-bolo').placeholder = state.sp === 'g' ? '5' : '15';
  $('#f-bolo-hint').textContent = state.sp === 'g'
    ? 'Gato: 5–10 ml/kg en 15 min. Reevaluar perfusión al terminar cada bolo; repetir si hace falta.'
    : 'Perro: 15–20 ml/kg en 15 min. Reevaluar perfusión al terminar cada bolo; repetir si hace falta.';
  $('#f-mant-hint').textContent = MANT_TXT[state.fMant][state.sp] +
    (state.fPed === 'si' ? (state.sp === 'g' ? ' Pediátrico: × 2,5.' : ' Pediátrico: × 3.') : '') +
    ' Ninguna fórmula demostró ser superior: ajustar según el monitoreo.';
}

function calcFluidos() {
  renderFluidosForm();
  const w = W();
  if (!(w > 0)) return muted('Ingresá el peso del paciente arriba.');
  if (state.fModo === 'anes') return calcFluidosAnestesia(w);
  if (state.fModo === 'sc') return calcFluidosSc(w);

  const warn = [];
  const rows = [];
  const dh = num(state.fDh) || 0;
  const H = num(state.fH) || 24;
  const loss = num(state.fLoss) || 0;
  const mantDia = mantenimientoDia(w, state.sp, state.fMant, state.fPed === 'si');
  const deficit = w * dh / 100 * 1000;

  if (state.fHipo === 'si') {
    const b = num(state.fBolo) > 0 ? num(state.fBolo) : (state.sp === 'g' ? 5 : 15);
    const [bMin, bMax] = state.sp === 'g' ? [5, 10] : [15, 20];
    if (b < bMin || b > bMax) warn.push(`El bolo recomendado es ${bMin}–${bMax} ml/kg en ${state.sp === 'g' ? 'gatos' : 'perros'}.`);
    rows.push('<div class="sep">1. Resucitación</div>');
    rows.push(kv(`Bolo (${fmt(b, 1)} ml/kg)`, `${fmt(w * b)} ml en 15 min`, 'big hl'));
    rows.push(kv('Velocidad del bolo', `${fmt(w * b * 4)} ml/h`, 'sub'));
    rows.push('<div class="hint">Objetivos: mejoría de FC, TLLC, presión arterial y estado mental. Si se normalizan, pasar a la rehidratación; si mejoran sin normalizarse, repetir el mismo bolo o uno menor y reevaluar (Tabla 7).</div>');
  } else if (dh >= 10) {
    warn.push('Con deshidratación ≥ 10% suele haber hipovolemia: si hay signos de shock, marcá "Hipovolémico" y resucitá primero.');
  }
  if (dh > 12) warn.push('Más de 12%: shock hipovolémico. Resucitar con bolos antes de calcular la rehidratación.');
  if (H < 12 || H > 24) warn.push('La guía recomienda corregir el déficit en 12–24 h.');

  const rehidH = (deficit + loss * H / 24) / H;
  const mantH = mantDia / 24;
  const total = rehidH + mantH;
  rows.push(`<div class="sep">${state.fHipo === 'si' ? '2. ' : ''}Rehidratación + mantenimiento</div>`);
  rows.push(kv('Déficit (peso × % deshidratación)', `${fmt(deficit)} ml`));
  if (loss) rows.push(kv('Pérdidas en el período', `${fmt(loss * H / 24)} ml`));
  rows.push(kv(`Rehidratación en ${fmt(H)} h`, `${fmt(rehidH, 1)} ml/h`));
  rows.push(kv('Mantenimiento', `${fmt(mantDia)} ml/día = ${fmt(mantH, 1)} ml/h`));
  rows.push(kv(`Velocidad total durante ${fmt(H)} h`, `${fmt(total, 1)} ml/h`, 'big hl'));
  rows.push(kv('Equivale a', `${fmt(total / w, 1)} ml/kg/h · ${fmt(total * H)} ml en ${fmt(H)} h`, 'sub'));
  rows.push(...drip(total, 20).map((x, i) => (i === 0 ? x.replace('big hl', '') : x)));
  rows.push(...drip(total, 60).map((x, i) => (i === 0 ? x.replace('big hl', '') : x)));
  if (deficit > 0) rows.push(kv(`Después de ${fmt(H)} h (si se corrigió)`, `${fmt(mantH + loss / 24, 1)} ml/h`, 'sub'));
  rows.push('<div class="hint">Resucitación y rehidratación: cristaloide isotónico tamponado (Ringer lactato, Plasma-Lyte, Normosol-R). Para mantenimiento prolongado preferir soluciones de mantenimiento (hipotónicas) o suplementar K/dextrosa: usar solo isotónicos a largo plazo predispone a alteraciones del sodio e hipopotasemia. Recalcular si la deshidratación no se resolvió.</div>');
  if (state.sp === 'g' && total / w > 10) warn.push('Gatos: más susceptibles a la sobrecarga de volumen. Monitorear peso, FR, auscultación y edemas (Tabla 5).');

  // Potasio (Tabla 11).
  const k = num(state.fK);
  if (k > 0) {
    const [d1, d2] = dosisPotasio(k);
    const meqL = (d) => d * w / total * 1000;
    const bag = num(state.fBag) || 500;
    const kcl = num(state.fKcl) || 2;
    rows.push('<div class="sep">Potasio</div>');
    rows.push(kv('Dosis sugerida', rango(d1, d2, 2, 'mEq/kg/h')));
    rows.push(kv(`Concentración a ${fmt(total, 1)} ml/h`, rango(meqL(d1), meqL(d2), 0, 'mEq/L'), 'big'));
    rows.push(kv(`Agregar a ${fmt(bag)} ml`, `${rango(meqL(d1) * bag / 1000, meqL(d2) * bag / 1000, 1, 'mEq')} = ${rango(meqL(d1) * bag / 1000 / kcl, meqL(d2) * bag / 1000 / kcl, 1, 'ml de KCl')}`, 'big hl'));
    rows.push('<div class="hint">Calculado sobre la velocidad total de arriba: si cambiás la velocidad, recalculá. Nunca superar 0,5 mEq/kg/h ni dar bolos de una solución con potasio agregado. Mezclar bien la bolsa.</div>');
  }
  return box(warn, rows, head(w) + ` · mantenimiento ${fmt(mantH, 1)} ml/h`);
}

function calcFluidosAnestesia(w) {
  const gato = state.sp === 'g';
  const [r1, r2] = gato ? [3, 5] : [5, 5];
  const rows = [
    kv('Velocidad inicial', rango(r1 * w, r2 * w, 1, 'ml/h'), 'big hl'),
    kv('Equivale a', `${rango(r1, r2, 0, 'ml/kg/h')} (${gato ? 'gato' : 'perro'} con función cardíaca y renal normal)`, 'sub'),
    ...drip(r2 * w, 20).map((x, i) => (i === 0 ? x.replace('big hl', '') : x)),
    ...drip(r2 * w, 60).map((x, i) => (i === 0 ? x.replace('big hl', '') : x)),
    '<div class="sep">Si hay hipotensión (PAM &lt; 60 mmHg)</div>',
    '<div class="hint">Primero: revisar profundidad anestésica (bajar el vaporizador), temperatura y FC; sumar analgesia/sedación o bloqueos locales.</div>',
    kv('Bolo de cristaloide: 5 ml/kg en 10 min', `${fmt(5 * w)} ml (${fmt(5 * w * 6)} ml/h)`, 'big'),
    kv('Si es refractaria: coloide 2–5 ml/kg en 10 min', `${rango(2 * w, 5 * w, 0, 'ml')}`),
    '<div class="hint">Simpaticomiméticos si hace falta: efedrina 0,05–0,2 mg/kg IV; noradrenalina 0,05–1 µg/kg/min; dobutamina 1–10 µg/kg/min; adrenalina 0,05–1 µg/kg/min (ver Infusión). Si la hipotensión es por hemorragia, transfundir.</div>',
    '<div class="sep">Límite de control</div>',
    kv('20 ml/kg en el procedimiento', `${fmt(20 * w)} ml`, 'big'),
    `<div class="hint">Si el total supera ese volumen, reevaluar velocidad y volemia. A ${fmt(r2 * w, 1)} ml/h se alcanza en ${fmt(20 / r2, 1)} h. Signos de sobrecarga: galope o soplo nuevo (sobre todo en gatos), edemas, quemosis, secreción nasal serosa, crepitantes, SpO₂ baja, efusión pleural o ascitis. Suspender fluidos y considerar furosemida 1–2 mg/kg IV.</div>`,
  ];
  const dh = num(state.fAnDh) || 0;
  if (dh > 0) {
    const d80 = w * dh / 100 * 1000 * 0.8;
    const mant = mantenimientoDia(w, state.sp, 'aaha', false) / 24;
    rows.unshift(
      '<div class="sep">Antes de la anestesia</div>',
      kv(`80% del déficit (${fmt(dh, 1)}%)`, `${fmt(d80)} ml en 24 h`),
      kv('Velocidad previa (80% déficit + mantenimiento)', `${fmt(d80 / 24 + mant, 1)} ml/h`, 'big'),
      '<div class="sep">Durante la anestesia</div>',
    );
  }
  return box([], rows, head(w));
}

function calcFluidosSc(w) {
  const d = num(state.fSc) > 0 ? num(state.fSc) : 20;
  const veces = state.fScF === '2' ? 2 : 1;
  const warn = [];
  if (d < 20 || d > 30) warn.push('La recomendación empírica es 20–30 ml/kg por aplicación.');
  const vol = d * w;
  const sMin = Math.max(1, Math.ceil(d / 20));
  const sMax = Math.max(1, Math.ceil(d / 10));
  const rows = [
    kv(`Por aplicación (${fmt(d, 1)} ml/kg)`, `${fmt(vol)} ml`, 'big hl'),
    kv('Por día', `${fmt(vol * veces)} ml (${veces} ${veces > 1 ? 'aplicaciones' : 'aplicación'})`),
    kv('Sitios de aplicación', `${sMin === sMax ? sMin : sMin + '–' + sMax} (máx. 10–20 ml/kg por sitio = ${rango(10 * w, 20 * w, 0, 'ml')})`, 'sub'),
    '<div class="hint">Usar Ringer lactato, Plasma-Lyte o Normosol-R. Evitar NaCl 0,9% SC (pH bajo, puede doler). Indicado para tratamiento ambulatorio de deshidratación leve. No dar SC a pacientes euhidratados; puede ser perjudicial en cardiópatas o con hipoproteinemia. Usar equipo y bolsa nuevos para cada paciente.</div>',
  ];
  return box(warn, rows, head(w));
}

// ───────────── Transfusión ─────────────
function calcTransfusion() {
  const w = W();
  const bvDefault = state.sp === 'g' ? 60 : 90;
  if (!$('#t-bv').value) $('#t-bv').placeholder = String(bvDefault);
  if (!(w > 0)) return muted('Ingresá el peso del paciente arriba.');
  const hr = num(state.tHr); const hd = num(state.tHd); const hdon = num(state.tHdon);
  const bv = num(state.tBv) || bvDefault;
  if (!(hr >= 0 && hd > 0 && hdon > 0)) return muted('Completá los tres hematocritos.');
  const warn = [];
  if (hd <= hr) return muted('El hematocrito deseado tiene que ser mayor que el actual.');
  if (hdon <= hd) return muted('El hematocrito del donante/unidad tiene que ser mayor que el deseado.');
  const V = w * bv * (hd - hr) / hdon;

  // Prueba inicial: 0,5 ml/kg/h durante 30 min (0,25 ml/kg); el resto, en el tiempo que queda.
  const Tmax = num(state.tTmax) || 4;
  const testRate = 0.5 * w;
  const testVol = Math.min(testRate * 0.5, V);
  const restTime = Math.max(Tmax - 0.5, 0.25);
  let rate = (V - testVol) / restTime;
  const maxKgH = state.tRisk === 'si' ? 4 : 10;
  let tiempo = 0.5 + restTime;
  if (rate / w > maxKgH) {
    rate = maxKgH * w;
    tiempo = 0.5 + (V - testVol) / rate;
    warn.push(`A ${maxKgH} ml/kg/h (máximo ${state.tRisk === 'si' ? 'en cardiópatas/riesgo de sobrecarga' : 'habitual'}) se necesitan ${fmt(tiempo, 1)} h.`);
  }
  if (tiempo > 4) warn.push('Una unidad no debería pasar más de 4 h a temperatura ambiente: dividir la unidad (mantener refrigerada la otra parte) o usar glóbulos rojos concentrados.');
  if (state.tProd === 'grc' && hdon < 50) warn.push('Los glóbulos rojos concentrados suelen tener Hto de 60–80%: revisá el valor de la unidad.');

  const rows = [
    kv(`Volumen de ${state.tProd === 'grc' ? 'glóbulos rojos concentrados' : 'sangre entera'}`, `${fmt(V)} ml`, 'big hl'),
    kv('Equivale a', `${fmt(V / w, 1)} ml/kg`, 'sub'),
  ];
  if (state.tProd === 'se') rows.push(kv('Control (regla práctica)', `2 ml/kg suben ~1% el Hto → ${fmt(V / w / 2, 1)}%`, 'sub'));
  rows.push(
    `<div class="sep">Administración</div>`,
    kv('1) Prueba: primeros 30 min', `${fmt(testRate, 1)} ml/h (${fmt(testVol, 1)} ml)`),
    kv('2) Resto, si no hay reacción', `${fmt(rate, 1)} ml/h`, 'big'),
    kv('Equivale a', `${fmt(rate / w, 1)} ml/kg/h`, 'sub'),
    kv('Tiempo total', `${fmt(tiempo, 1)} h`, 'sub'),
  );
  if (state.tSet !== 'bomba') {
    const f = Number(state.tSet);
    rows.push(kv(`Goteo prueba (${f} gt/ml)`, `${fmt(testRate * f / 60, 1)} gotas/min`, 'sub'));
    rows.push(...drip(rate, f));
  }
  rows.push('<div class="hint">Usar siempre equipo con filtro. Controlar T°, FC, FR y signos de reacción cada 15 min la primera hora. Hacer tipificación / prueba cruzada según corresponda (en gatos siempre).</div>');
  return box(warn, rows, `${state.sp === 'g' ? '🐱 Gato' : '🐶 Perro'} · ${fmt(w, 2)} kg · volemia ${fmt(bv)} ml/kg`);
}

// ───────────── Nutrición ─────────────
const ETAPAS = {
  p: [
    ['castrado', 'Adulto castrado', 1.6], ['entero', 'Adulto entero', 1.8], ['inactivo', 'Inactivo / tendencia a obesidad', 1.4],
    ['bajar', 'Pérdida de peso (usar peso ideal)', 1.0], ['subir', 'Ganancia de peso (usar peso ideal)', 1.4],
    ['crit', 'Hospitalizado / crítico', 1.0], ['cach4', 'Cachorro < 4 meses', 3.0], ['cach12', 'Cachorro 4–12 meses', 2.0],
    ['gest', 'Gestación (últimos 21 días)', 3.0], ['lact', 'Lactancia', 4.0],
    ['trab1', 'Trabajo liviano', 2.0], ['trab2', 'Trabajo moderado', 3.0], ['trab3', 'Trabajo intenso', 5.0],
  ],
  g: [
    ['castrado', 'Adulto castrado', 1.2], ['entero', 'Adulto entero', 1.4], ['inactivo', 'Inactivo / tendencia a obesidad', 1.0],
    ['bajar', 'Pérdida de peso (usar peso ideal)', 0.8], ['subir', 'Ganancia de peso (usar peso ideal)', 1.2],
    ['crit', 'Hospitalizado / crítico', 1.0], ['gatito', 'Gatito en crecimiento', 2.5],
    ['gest', 'Gestación', 1.6], ['lact', 'Lactancia', 3.0],
  ],
};

function renderStages() {
  const list = ETAPAS[state.sp];
  if (!list.some((x) => x[0] === state.nStage)) { state.nStage = list[0][0]; state.nF = ''; }
  $('#n-stage').innerHTML = list.map(([k, l, f]) => `<option value="${k}" ${k === state.nStage ? 'selected' : ''}>${esc(l)} · ×${fmt(f, 1)}</option>`).join('');
  const f = list.find((x) => x[0] === state.nStage)[2];
  $('#n-f').placeholder = String(f).replace('.', ',');
}

// Energía metabolizable (kcal/100 g tal cual) por Atwater y Atwater modificado.
function energia() {
  const prot = num(state.nProt); const fat = num(state.nFat);
  if (!(prot >= 0 && fat >= 0) || !isFinite(prot) || !isFinite(fat)) return null;
  const fib = num(state.nFib) || 0;
  const hum = num(state.nHum) || 0;
  let ash = num(state.nAsh); let ashEst = false;
  if (!isFinite(ash)) { ash = hum > 50 ? 2.5 : 8; ashEst = true; }
  const eln = 100 - (prot + fat + fib + hum + ash); // extracto libre de nitrógeno (carbohidratos)
  if (eln < 0) return { error: 'Los porcentajes suman más de 100%: revisá los valores.' };
  return {
    eln, ash, ashEst,
    atwater: 4 * prot + 9 * fat + 4 * eln,
    modificado: 3.5 * prot + 8.5 * fat + 3.5 * eln,
  };
}

function calcNutricion() {
  const w = num(state.nW) > 0 ? num(state.nW) : W();
  if (!(w > 0)) return muted('Ingresá el peso del paciente arriba.');
  const list = ETAPAS[state.sp];
  const etapa = list.find((x) => x[0] === state.nStage);
  const factor = num(state.nF) > 0 ? num(state.nF) : etapa[2];
  const rer = 70 * Math.pow(w, 0.75);
  const mer = rer * factor;
  const meals = Math.max(1, Math.round(num(state.nMeals) || 1));
  const warn = [];
  const rows = [
    kv('RER (70 × peso^0,75)', `${fmt(rer)} kcal/día`),
    kv(`MER (RER × ${fmt(factor, 2)})`, `${fmt(mer)} kcal/día`, 'big'),
  ];
  if (state.nStage === 'crit') rows.push('<div class="hint">Paciente crítico: empezar con 1/3 del RER el día 1 y aumentar a lo largo de 3 días hasta el RER.</div>');

  const e = energia();
  const declarada = num(state.nKcalKg) > 0 ? num(state.nKcalKg) / 10 : NaN; // kcal/100 g
  if (e && e.error) warn.push(e.error);
  const racion = (kcal100) => mer / kcal100 * 100;

  if (e && !e.error) {
    rows.push('<div class="sep">Ración diaria según el análisis garantizado</div>');
    rows.push(kv('ELN (carbohidratos) estimado', `${fmt(e.eln, 1)}%`, 'sub'));
    if (e.ashEst) rows.push(kv('Cenizas (estimadas)', `${fmt(e.ash, 1)}%`, 'sub'));
    rows.push(kv('Atwater modificado (3,5 / 8,5 / 3,5)', `${fmt(e.modificado * 10)} kcal/kg`));
    rows.push(kv('Ración (Atwater modificado)', `${fmt(racion(e.modificado))} g/día`, 'big hl'));
    if (meals > 1) rows.push(kv(`En ${meals} comidas`, `${fmt(racion(e.modificado) / meals)} g c/u`, 'sub'));
    rows.push(kv('Atwater (4 / 9 / 4)', `${fmt(e.atwater * 10)} kcal/kg`));
    rows.push(kv('Ración (Atwater)', `${fmt(racion(e.atwater))} g/día`, 'big'));
    rows.push('<div class="hint">Atwater modificado es el recomendado para alimentos comerciales (digestibilidad menor que la de alimentos para humanos); Atwater clásico sobreestima la energía y da raciones más chicas. Para dietas caseras muy digestibles, Atwater se acerca más.</div>');
  }
  if (isFinite(declarada)) {
    rows.push('<div class="sep">Según la energía declarada</div>');
    rows.push(kv('Ración', `${fmt(racion(declarada))} g/día`, 'big hl'));
    if (meals > 1) rows.push(kv(`En ${meals} comidas`, `${fmt(racion(declarada) / meals)} g c/u`, 'sub'));
  }
  if (!e && !isFinite(declarada)) rows.push('<div class="kv sub muted"><span>Cargá el análisis garantizado del alimento para calcular los gramos por día.</span></div>');
  if (state.nStage === 'bajar' || state.nStage === 'subir') {
    rows.push('<div class="hint">Recalcular cada 2–4 semanas según la evolución del peso (objetivo de pérdida: 1–2% del peso por semana).</div>');
  }
  return box(warn, rows, `${state.sp === 'g' ? '🐱 Gato' : '🐶 Perro'} · ${fmt(w, 2)} kg${num(state.nW) > 0 ? ' (peso ideal)' : ''} · ${esc(etapa[1])}`);
}

// ───────────── Render y eventos ─────────────
function render() {
  document.querySelectorAll('#species button').forEach((b) => b.classList.toggle('on', b.dataset.sp === state.sp));
  document.querySelectorAll('#tool button').forEach((b) => b.classList.toggle('on', b.dataset.t === state.tool));
  document.querySelectorAll('.tool').forEach((s) => { s.hidden = s.id !== 't-' + state.tool; });
  const segs = { 'f-modo': 'fModo', 'f-hipo': 'fHipo', 'f-mant': 'fMant', 'f-ped': 'fPed', 'f-scf': 'fScF', 't-prod': 'tProd', 't-risk': 'tRisk', 't-set': 'tSet' };
  Object.entries(segs).forEach(([id, k]) => document.querySelectorAll(`#${id} button`).forEach((b) => b.classList.toggle('on', b.dataset.v === state[k])));
  renderStages();
  compute();
}

function compute() {
  $('#r-fluidos').innerHTML = calcFluidos();
  $('#r-transfusion').innerHTML = calcTransfusion();
  $('#r-nutricion').innerHTML = calcNutricion();
}

document.querySelectorAll('[data-k]').forEach((el) => {
  el.value = state[el.dataset.k] ?? '';
  el.addEventListener('input', () => { state[el.dataset.k] = el.value; save(); compute(); });
});
$('#weight').value = state.weight;
$('#weight').addEventListener('input', (e) => { state.weight = e.target.value; store.set('uv.weight', state.weight); compute(); });
document.querySelectorAll('#species button').forEach((b) => b.addEventListener('click', () => {
  state.sp = b.dataset.sp; store.set('uv.sp', state.sp); save(); render();
}));
$('#tool').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  state.tool = b.dataset.t; save(); render(); window.scrollTo(0, 0);
});
[['f-modo', 'fModo'], ['f-hipo', 'fHipo'], ['f-mant', 'fMant'], ['f-ped', 'fPed'], ['f-scf', 'fScF'], ['t-prod', 'tProd'], ['t-risk', 'tRisk'], ['t-set', 'tSet']].forEach(([id, k]) => {
  $('#' + id).addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    state[k] = b.dataset.v; save(); render();
  });
});
$('#n-stage').addEventListener('change', (e) => {
  state.nStage = e.target.value; state.nF = ''; $('#n-f').value = ''; save(); render();
});
document.body.addEventListener('click', (e) => {
  const dh = e.target.closest('[data-dh]');
  if (dh) { state.fDh = dh.dataset.dh; $('#f-dh').value = state.fDh; save(); compute(); }
  const h = e.target.closest('[data-h]');
  if (h) { state.fH = h.dataset.h; $('#f-h').value = state.fH; save(); compute(); }
});

// Botón "atrás" de Android: vuelve a la calculadora de dosis.
window.appBack = () => { location.href = 'index.html'; return true; };

render();
