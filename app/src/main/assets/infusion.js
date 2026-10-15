'use strict';

// Calculadora de infusión continua (CRI): uno o varios fármacos, mezclados en
// una bolsa/jeringa o cada uno por separado, con bomba o a goteo.

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function num(s) {
  const t = String(s ?? '').trim().replace(/\s/g, '').replace(',', '.');
  return t === '' ? NaN : Number(t);
}
function fmt(n) {
  if (!isFinite(n)) return '—';
  const a = Math.abs(n);
  const d = a >= 100 ? 1 : a >= 1 ? 2 : a >= 0.1 ? 3 : 4;
  return n.toLocaleString('es-AR', { maximumFractionDigits: d });
}
const store = {
  get(k, def) { try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } },
};

// ───────────── Unidades ─────────────
const MASS = { 'µg': 1e-3, mg: 1, g: 1000 }; // en mg
const PER_HOUR = { min: 60, h: 1, 'día': 1 / 24 };
const DOSE_UNITS = ['µg/kg/min', 'mg/kg/min', 'µg/kg/h', 'mg/kg/h', 'UI/kg/h', 'UI/kg/día'];
const parseUnit = (u) => { const [q, , time] = u.split('/'); return { q, time }; };
const dimOf = (q) => (q in MASS ? 'mass' : 'ui');
const toBase = (v, q) => (q in MASS ? v * MASS[q] : v);

function showAmount(base, dim) {
  if (!isFinite(base)) return '—';
  if (dim === 'ui') return fmt(base) + ' UI';
  const a = Math.abs(base);
  if (a >= 1000) return fmt(base / 1000) + ' g';
  if (a >= 1) return fmt(base) + ' mg';
  return fmt(base * 1000) + ' µg';
}

// Mantenimiento de fluidos (AAHA 2013): perro 132 × kg^0,75 ml/día; gato 80 × kg^0,75 ml/día.
const mantenimientoMlH = (kg, sp) => ((sp === 'g' ? 80 : 132) * Math.pow(kg, 0.75)) / 24;

// ───────────── Fármacos de infusión disponibles (del vademécum) ─────────────
// clave "drugId:índice del preset"
function criOptions(sp) {
  const out = [];
  DRUGS.forEach((d) => d.p.forEach((p, i) => {
    if (p.cri && p.sp.includes(sp)) out.push({ key: d.id + ':' + i, drug: d, preset: p });
  }));
  return out;
}
const findOption = (key) => {
  const [id, i] = String(key).split(':');
  const d = DRUGS.find((x) => x.id === id);
  return d && d.p[+i] ? { key, drug: d, preset: d.p[+i] } : null;
};

// ───────────── Estado ─────────────
const state = Object.assign({
  mode: 'mix', vol: '', rate: '', set: 'bomba', drugs: [],
}, store.get('uv.cri', {}));
state.sp = store.get('uv.sp', 'p');
state.weight = store.get('uv.weight', '');

const save = () => {
  const { sp, weight, ...rest } = state;
  store.set('uv.cri', rest);
};
const W = () => num(state.weight);

function newDrug(key) {
  const o = key && findOption(key);
  const saved = o ? store.get('uv.pres.' + o.drug.id, null) : null;
  return {
    key: o ? key : 'custom',
    name: '',
    unit: o ? o.preset.u : 'mg/kg/h',
    dose: o ? String(o.preset.d[0]).replace('.', ',') : '',
    // Reutiliza la última concentración cargada en la calculadora para ese fármaco.
    a: saved && saved.mode === 'liq' && saved.liqType !== 'pct' ? saved.a : '',
    au: saved && saved.au ? saved.au : (o && dimOf(parseUnit(o.preset.u).q) === 'ui' ? 'UI' : 'mg'),
    ml: saved && saved.ml ? saved.ml : '1',
  };
}

// ───────────── Render de tarjetas de fármacos ─────────────
function renderDrugs() {
  const opts = criOptions(state.sp);
  $('#drugs').innerHTML = state.drugs.map((dr, i) => {
    const o = dr.key !== 'custom' ? findOption(dr.key) : null;
    const U = parseUnit(dr.unit);
    const units = dimOf(U.q) === 'ui' ? ['UI'] : ['mg', 'µg', 'g'];
    const select = `<select data-i="${i}" data-f="key" class="full">
        ${opts.map((x) => `<option value="${x.key}" ${x.key === dr.key ? 'selected' : ''}>${esc(x.drug.name)}${x.drug.p.filter((p) => p.cri && p.sp.includes(state.sp)).length > 1 ? ' · ' + esc(x.preset.l) : ''}</option>`).join('')}
        <option value="custom" ${dr.key === 'custom' ? 'selected' : ''}>Otro fármaco…</option>
      </select>`;
    const range = o ? `${fmt(o.preset.d[0])}${o.preset.d[1] > o.preset.d[0] ? '–' + fmt(o.preset.d[1]) : ''} ${esc(o.preset.u)}` : '';
    return `<div class="card drugcard">
      <div class="dhead"><b>Fármaco ${i + 1}</b><button class="rm" data-rm="${i}">Quitar</button></div>
      ${select}
      ${dr.key === 'custom' ? `<input class="full" data-i="${i}" data-f="name" value="${esc(dr.name)}" placeholder="Nombre del fármaco">` : ''}
      ${o && o.preset.n ? `<div class="hint warn">${esc(o.preset.n)}</div>` : ''}
      <label class="lbl">Dosis ${range ? `<span class="muted">(indicada: ${range})</span>` : ''}</label>
      <div class="inrow"><input data-i="${i}" data-f="dose" inputmode="decimal" value="${esc(dr.dose)}" placeholder="Dosis">
        ${dr.key === 'custom'
          ? `<select data-i="${i}" data-f="unit">${DOSE_UNITS.map((u) => `<option ${u === dr.unit ? 'selected' : ''}>${u}</option>`).join('')}</select>`
          : `<span class="unit">${esc(dr.unit)}</span>`}</div>
      <label class="lbl">Concentración del frasco</label>
      <div class="inrow conc"><input data-i="${i}" data-f="a" inputmode="decimal" value="${esc(dr.a)}" placeholder="Ej: 50">
        <select data-i="${i}" data-f="au">${units.map((u) => `<option ${u === dr.au ? 'selected' : ''}>${u}</option>`).join('')}</select>
        <span class="unit">en</span><input data-i="${i}" data-f="ml" inputmode="decimal" value="${esc(dr.ml)}" placeholder="1"><span class="unit">ml</span></div>
    </div>`;
  }).join('') || '<div class="result muted">Agregá uno o más fármacos para calcular la infusión.</div>';
}

function renderStatic() {
  document.querySelectorAll('#species button').forEach((b) => b.classList.toggle('on', b.dataset.sp === state.sp));
  document.querySelectorAll('#mode button').forEach((b) => b.classList.toggle('on', b.dataset.m === state.mode));
  document.querySelectorAll('#set button').forEach((b) => b.classList.toggle('on', b.dataset.s === state.set));
  $('#mode-hint').textContent = state.mode === 'mix'
    ? 'Todos los fármacos se cargan en el mismo fluido y pasan a la misma velocidad.'
    : 'Cada fármaco va en su propia jeringa o bolsa, del volumen y velocidad de abajo.';
  $('#weight').value = state.weight;
  $('#vol').value = state.vol;
  $('#rate').value = state.rate;
  renderRateChips();
}

function renderRateChips() {
  const w = W();
  if (!(w > 0)) { $('#rate-chips').innerHTML = ''; return; }
  const m = mantenimientoMlH(w, state.sp);
  $('#rate-chips').innerHTML = [1, 1.5, 2].map((k) =>
    `<button class="chip" data-rate="${(m * k).toFixed(1)}">${k === 1 ? 'Mantenimiento' : k + '× mant.'} · ${fmt(m * k)} ml/h</button>`).join('');
}

// ───────────── Cálculo ─────────────
function compute() {
  const w = W();
  const V = num(state.vol);
  const R = num(state.rate);
  const out = [];
  const warn = [];

  if (!(w > 0)) { $('#result').innerHTML = '<div class="result muted">Ingresá el peso del paciente arriba.</div>'; return; }
  if (!state.drugs.length) { $('#result').innerHTML = ''; return; }

  const rows = state.drugs.map((dr, i) => {
    const o = dr.key !== 'custom' ? findOption(dr.key) : null;
    const U = parseUnit(dr.unit);
    const dim = dimOf(U.q);
    const dose = num(dr.dose);
    const name = o ? o.drug.name : (dr.name || 'Fármaco ' + (i + 1));
    const perH = toBase(dose * w * PER_HOUR[U.time], U.q); // mg/h o UI/h
    const a = num(dr.a); const ml = num(dr.ml);
    const conc = a > 0 && ml > 0 ? toBase(a, dr.au) / ml : NaN; // mg/ml o UI/ml
    if (o && isFinite(dose) && (dose < o.preset.d[0] - 1e-9 || dose > o.preset.d[1] + 1e-9)) {
      warn.push(`${name}: la dosis está fuera del rango indicado (${fmt(o.preset.d[0])}–${fmt(o.preset.d[1])} ${o.preset.u}).`);
    }
    if (o && o.drug.id === 'lidocaina' && state.sp === 'g') warn.push('Lidocaína en gatos: mayor sensibilidad a la toxicidad, usar con precaución.');
    return { name, dim, dose, unit: dr.unit, perH, conc, U };
  });

  const valid = rows.filter((r) => isFinite(r.perH) && r.perH > 0);
  if (!valid.length) { $('#result').innerHTML = '<div class="result muted">Ingresá la dosis de cada fármaco.</div>'; return; }

  const goteo = state.set !== 'bomba' ? Number(state.set) : 0;
  const dripText = (mlh) => {
    if (!goteo || !(mlh > 0)) return '';
    const gpm = mlh * goteo / 60;
    return `${fmt(gpm)} gotas/min</b></div><div class="kv sub"><span>1 gota cada</span><b>${fmt(60 / gpm)} s`;
  };

  // Detalle por fármaco: cuánto recibe por hora.
  valid.forEach((r) => {
    out.push(`<div class="kv"><span><b>${esc(r.name)}</b> · ${esc(fmt(r.dose) + ' ' + r.unit)}</span><b>${showAmount(r.perH, r.dim)}/h</b></div>`);
  });

  if (state.mode === 'mix') {
    if (!(V > 0 && R > 0)) {
      out.push('<div class="kv sub muted"><span>Completá volumen final y velocidad para saber cuánto cargar.</span></div>');
    } else {
      const hours = V / R;
      let drugMl = 0; let missing = false;
      out.push(`<div class="kv"><span>Duración de la bolsa/jeringa</span><b>${fmt(hours)} h</b></div>`);
      valid.forEach((r) => {
        const total = r.perH * hours;
        if (isFinite(r.conc)) {
          const ml = total / r.conc;
          drugMl += ml;
          out.push(`<div class="kv big hl"><span>Cargar de ${esc(r.name)}</span><b>${fmt(ml)} ml</b></div>`);
          out.push(`<div class="kv sub"><span>Total ${showAmount(total, r.dim)} · queda ${showAmount(total / V, r.dim)}/ml</span></div>`);
          if (ml < 0.1) warn.push(`${r.name}: volumen muy pequeño (< 0,1 ml); considerá diluir el frasco antes.`);
        } else {
          missing = true;
          out.push(`<div class="kv sub"><span>${esc(r.name)}: total ${showAmount(total, r.dim)} (cargá la concentración para ver los ml)</span></div>`);
        }
      });
      if (!missing) {
        if (drugMl >= V) warn.push('El volumen de fármacos supera el volumen final: aumentá el volumen o la velocidad, o usá presentaciones más concentradas.');
        else out.push(`<div class="kv big"><span>+ Diluyente / fluido</span><b>${fmt(V - drugMl)} ml</b></div>`);
      }
      out.push(`<div class="kv"><span>Fluido que recibe el paciente</span><b>${fmt(R / w)} ml/kg/h</b></div>`);
      if (goteo) out.push(`<div class="kv big hl"><span>Goteo</span><b>${dripText(R)}</b></div>`);
      warn.push('Si cambiás la velocidad, cambian todas las dosis a la vez: recalculá antes de modificarla.');
    }
  } else {
    valid.forEach((r) => {
      out.push(`<div class="sep">${esc(r.name)}</div>`);
      if (isFinite(r.conc)) {
        const undiluted = r.perH / r.conc;
        out.push(`<div class="kv"><span>Sin diluir</span><b>${fmt(undiluted)} ml/h</b></div>`);
        if (undiluted < 0.5) out.push('<div class="kv sub"><span>Velocidad muy baja sin diluir: conviene preparar una dilución.</span></div>');
      }
      if (V > 0 && R > 0) {
        const total = r.perH * (V / R);
        if (isFinite(r.conc)) {
          const ml = total / r.conc;
          if (ml > V) warn.push(`${r.name}: el fármaco no entra en ${fmt(V)} ml a ${fmt(R)} ml/h.`);
          else out.push(`<div class="kv big hl"><span>Diluido: ${fmt(ml)} ml + ${fmt(V - ml)} ml de diluyente</span><b>a ${fmt(R)} ml/h</b></div>`);
        } else {
          out.push(`<div class="kv sub"><span>Total para ${fmt(V / R)} h: ${showAmount(total, r.dim)}</span></div>`);
        }
        if (goteo) out.push(`<div class="kv sub"><span>Goteo</span><b>${dripText(R)}</b></div>`);
      }
    });
    if (V > 0 && R > 0) {
      out.push(`<div class="kv"><span>Fluido total (${valid.length} × ${fmt(R)} ml/h)</span><b>${fmt(R * valid.length / w)} ml/kg/h</b></div>`);
      out.push(`<div class="kv sub"><span>Cada preparación dura ${fmt(V / R)} h</span></div>`);
    }
  }

  const m = mantenimientoMlH(w, state.sp);
  const totalFluid = state.mode === 'mix' ? R : R * valid.length;
  if (totalFluid > 0 && totalFluid > m * 3) {
    warn.push(`La velocidad total (${fmt(totalFluid)} ml/h) supera 3 veces el mantenimiento (${fmt(m)} ml/h): vigilar sobrecarga de volumen.`);
  }

  $('#result').innerHTML = `<div class="result">
    <div class="rhead">${state.sp === 'g' ? '🐱 Gato' : '🐶 Perro'} · ${fmt(w)} kg · mantenimiento ${fmt(m)} ml/h</div>
    ${[...new Set(warn)].map((t) => `<div class="alert warn">⚠ ${esc(t)}</div>`).join('')}
    ${out.join('')}
  </div>`;
}

// ───────────── Eventos ─────────────
function refresh() { save(); compute(); }

document.querySelectorAll('#species button').forEach((b) => b.addEventListener('click', () => {
  state.sp = b.dataset.sp; store.set('uv.sp', state.sp);
  const valid = new Set(criOptions(state.sp).map((o) => o.key));
  state.drugs = state.drugs.filter((d) => d.key === 'custom' || valid.has(d.key));
  renderStatic(); renderDrugs(); refresh();
}));
$('#weight').addEventListener('input', (e) => { state.weight = e.target.value; store.set('uv.weight', state.weight); renderRateChips(); compute(); });
$('#vol').addEventListener('input', (e) => { state.vol = e.target.value; refresh(); });
$('#rate').addEventListener('input', (e) => { state.rate = e.target.value; refresh(); });
$('#rate-chips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-rate]'); if (!b) return;
  state.rate = b.dataset.rate.replace('.', ','); $('#rate').value = state.rate; refresh();
});
$('#mode').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  state.mode = b.dataset.m; renderStatic(); refresh();
});
$('#set').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  state.set = b.dataset.s; renderStatic(); refresh();
});
$('#add-drug').addEventListener('click', () => {
  const opts = criOptions(state.sp);
  state.drugs.push(newDrug(opts.length ? opts[0].key : null));
  renderDrugs(); refresh();
});
$('#add-flk').addEventListener('click', () => {
  // Fentanilo + Lidocaína + Ketamina, con las dosis de infusión del vademécum.
  ['fentanilo', 'lidocaina', 'ketamina'].forEach((id) => {
    const o = criOptions(state.sp).find((x) => x.drug.id === id);
    if (o && !state.drugs.some((d) => d.key === o.key)) state.drugs.push(newDrug(o.key));
  });
  renderDrugs(); refresh();
});
$('#drugs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-rm]'); if (!b) return;
  state.drugs.splice(+b.dataset.rm, 1); renderDrugs(); refresh();
});
$('#drugs').addEventListener('input', (e) => {
  const t = e.target; if (!t.dataset.f || t.tagName === 'SELECT') return;
  state.drugs[+t.dataset.i][t.dataset.f] = t.value; refresh();
});
$('#drugs').addEventListener('change', (e) => {
  const t = e.target; if (t.tagName !== 'SELECT') return;
  const i = +t.dataset.i;
  if (t.dataset.f === 'key') {
    state.drugs[i] = t.value === 'custom' ? Object.assign(newDrug(null), { key: 'custom' }) : newDrug(t.value);
  } else {
    state.drugs[i][t.dataset.f] = t.value;
    if (t.dataset.f === 'unit') state.drugs[i].au = dimOf(parseUnit(t.value).q) === 'ui' ? 'UI' : 'mg';
  }
  renderDrugs(); refresh();
});

// Botón "atrás" de Android: vuelve a la calculadora de dosis.
window.appBack = () => { location.href = 'index.html'; return true; };

renderStatic();
renderDrugs();
compute();
