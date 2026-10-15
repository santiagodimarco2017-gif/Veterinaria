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
  fDh: '', fH: '24', fMant: 'aaha', fMantKg: '50', fLoss: '',
  tProd: 'se', tHr: '', tHd: '', tHdon: '', tBv: '', tTmax: '4', tRisk: 'no', tSet: 'bomba',
  nW: '', nStage: '', nF: '', nProt: '', nFat: '', nFib: '', nHum: '', nAsh: '', nMeals: '2', nKcalKg: '',
}, store.get('uv.calc', {}));
state.sp = store.get('uv.sp', 'p');
state.weight = store.get('uv.weight', '');
const save = () => { const { sp, weight, ...rest } = state; store.set('uv.calc', rest); };
const W = () => num(state.weight);

// ───────────── Fluidoterapia ─────────────
const DESHIDRATACION = [
  { v: 0, t: '< 5%', d: 'No detectable al examen; solo historia de pérdidas.' },
  { v: 5, t: '5–6%', d: 'Leve pérdida de la elasticidad de la piel.' },
  { v: 7, t: '6–8%', d: 'Retardo marcado del pliegue cutáneo, TLLC levemente prolongado, ojos algo hundidos, mucosas secas.' },
  { v: 10, t: '10–12%', d: 'El pliegue no retorna, TLLC prolongado, ojos hundidos, mucosas secas, posibles signos de shock.' },
  { v: 12, t: '12–15%', d: 'Signos claros de shock, muerte inminente: estabilizar primero con bolos.' },
];
// Mantenimiento AAHA 2013: perro 132 × kg^0,75; gato 80 × kg^0,75 (ml/día).
const mantAaha = (kg, sp) => (sp === 'g' ? 80 : 132) * Math.pow(kg, 0.75);

function calcFluidos() {
  const w = W();
  $('#dh-chips').innerHTML = DESHIDRATACION.map((x) =>
    `<button class="chip ${num(state.fDh) === x.v ? 'on' : ''}" data-dh="${x.v}">${x.t}</button>`).join('');
  const sel = DESHIDRATACION.slice().reverse().find((x) => num(state.fDh) >= x.v);
  $('#dh-desc').textContent = sel && isFinite(num(state.fDh)) ? sel.d : '';
  $('#h-chips').innerHTML = [6, 12, 24].map((h) => `<button class="chip ${num(state.fH) === h ? 'on' : ''}" data-h="${h}">${h} h</button>`).join('');
  $('#f-mant-kg-wrap').hidden = state.fMant !== 'kg';
  $('#f-mant-hint').textContent = state.fMant === 'aaha'
    ? (state.sp === 'g' ? 'Gato: 80 × peso^0,75 ml/día (AAHA 2013).' : 'Perro: 132 × peso^0,75 ml/día (AAHA 2013).')
    : 'Valores habituales: 40–60 ml/kg/día.';

  if (!(w > 0)) return muted('Ingresá el peso del paciente arriba.');
  const dh = num(state.fDh) || 0;
  const H = num(state.fH) || 24;
  const mant = state.fMant === 'kg' ? (num(state.fMantKg) || 0) * w : mantAaha(w, state.sp);
  const loss = num(state.fLoss) || 0;
  const deficit = w * dh / 100 * 1000;
  const total = deficit + (mant + loss) * H / 24;
  const rate = total / H;
  const after = (mant + loss) / 24;
  const warn = [];
  if (dh >= 12) warn.push('Deshidratación grave: corregir primero la hipovolemia (bolos) y después calcular el déficit.');
  if (dh > 15) warn.push('Revisá el porcentaje: más de 15% no es compatible con la vida.');
  if (state.sp === 'g' && rate / w > 10) warn.push('Gatos: más sensibles a la sobrecarga de volumen. Monitorear peso, FR y auscultación.');

  const rows = [
    kv('Déficit', `${fmt(deficit)} ml`),
    kv('Mantenimiento', `${fmt(mant)} ml/día (${fmt(mant / 24, 1)} ml/h)`),
    kv('Pérdidas', `${fmt(loss)} ml/día`),
    kv(`Total en ${fmt(H)} h`, `${fmt(total)} ml`, 'big'),
    kv(`Velocidad durante ${fmt(H)} h`, `${fmt(rate, 1)} ml/h`, 'big hl'),
    kv('Equivale a', `${fmt(rate / w, 1)} ml/kg/h`, 'sub'),
    ...drip(rate, 20).map((x, i) => (i === 0 ? x.replace('big hl', '') : x)),
    ...drip(rate, 60).map((x, i) => (i === 0 ? x.replace('big hl', '') : x)),
  ];
  if (deficit > 0) rows.push(kv('Después de reponer el déficit', `${fmt(after, 1)} ml/h (mant. + pérdidas)`, 'sub'));
  return box(warn, rows, `${state.sp === 'g' ? '🐱 Gato' : '🐶 Perro'} · ${fmt(w, 2)} kg`);
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
  const segs = { 'f-mant': 'fMant', 't-prod': 'tProd', 't-risk': 'tRisk', 't-set': 'tSet' };
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
[['f-mant', 'fMant'], ['t-prod', 'tProd'], ['t-risk', 'tRisk'], ['t-set', 'tSet']].forEach(([id, k]) => {
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
