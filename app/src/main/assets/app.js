'use strict';

// ───────────────────────── Utilidades ─────────────────────────
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function num(s) {
  if (s === null || s === undefined) return NaN;
  const t = String(s).trim().replace(/\s/g, '').replace(',', '.');
  if (t === '') return NaN;
  return Number(t);
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

// ───────────────────────── Unidades ─────────────────────────
const MASS = { ng: 1e-6, 'µg': 1e-3, mg: 1, g: 1000 }; // en mg
const dimOf = (q) => (q in MASS ? 'mass' : q === 'UI' ? 'ui' : q === 'ml' ? 'vol' : '?');
const toBase = (v, q) => (q in MASS ? v * MASS[q] : v); // masa → mg, UI → UI, ml → ml
const PER_HOUR = { min: 60, h: 1, 'día': 1 / 24 };

function parseUnit(u) {
  const [q, per, time] = u.split('/');
  return { q, per, time: time || null };
}

const perLabel = { kg: 'kg', animal: 'animal', m2: 'm²', '100UI': '100 UI de heparina' };
function unitLabel(u) {
  const U = parseUnit(u);
  let s = U.q + '/' + (U.per === 'animal' ? (state.sp === 'g' ? 'gato' : 'perro') : perLabel[U.per]);
  if (U.time) s += '/' + U.time;
  return s;
}

// Muestra una cantidad base (mg, UI o ml) en la unidad más legible.
function showAmount(base, dim) {
  if (!isFinite(base)) return '—';
  if (dim === 'ui') return fmt(base) + ' UI';
  if (dim === 'vol') return fmt(base) + ' ml';
  const a = Math.abs(base);
  if (a >= 1000) return fmt(base / 1000) + ' g';
  if (a >= 1) return fmt(base) + ' mg';
  if (a >= 0.001) return fmt(base * 1000) + ' µg';
  return fmt(base * 1e6) + ' ng';
}

// Superficie corporal (m²) = K · peso^(2/3) / 100
const bsa = (kg, sp) => ((sp === 'g' ? 10.0 : 10.1) * Math.pow(kg, 2 / 3)) / 100;

// ───────────────────────── Datos extra ─────────────────────────
const FREE = {
  id: 'libre', name: 'Cálculo libre (cualquier fármaco)', g: 'libre', free: true,
  p: [{ l: 'Dosis personalizada', sp: 'pg', d: [NaN, NaN], u: 'mg/kg', f: '', v: '' }],
};
const FREE_UNITS = ['mg/kg', 'µg/kg', 'UI/kg', 'ml/kg', 'g/kg', 'mg/animal', 'UI/animal', 'ml/animal', 'mg/m2', 'mg/kg/h', 'µg/kg/min', 'µg/kg/h', 'mg/kg/día'];
const ALL = [FREE, ...DRUGS];
const byId = Object.fromEntries(ALL.map((d) => [d.id, d]));

// ───────────────────────── Estado ─────────────────────────
const state = {
  sp: store.get('uv.sp', 'p'),
  weight: store.get('uv.weight', ''),
  group: 'all',
  q: '',
  drug: null,
  pi: 0,
  dose: NaN,
  pres: null,   // presentación del fármaco actual
  hepUI: '',
  cri: { vol: '', rate: '' },
};

const presetsFor = (drug) => drug.p.filter((p) => p.sp.includes(state.sp));
const W = () => num(state.weight);

function rangeText(p) {
  if (p.tiers) return p.tiers.map((t, i) => (i === 0 ? '≤' + t.hasta : t.hasta === Infinity ? '>' + p.tiers[i - 1].hasta : '≤' + t.hasta) + ' kg: ' + fmt(t.dosis)).join(' · ') + ' mg';
  if (!isFinite(p.d[0])) return 'a definir';
  const r = p.d[0] === p.d[1] ? fmt(p.d[0]) : fmt(p.d[0]) + '–' + fmt(p.d[1]);
  return r + ' ' + unitLabel(p.u);
}

// ───────────────────────── Lista ─────────────────────────
function renderChips() {
  const chips = [{ id: 'all', name: 'Todos' }, ...GROUPS];
  $('#chips').innerHTML = chips.map((c) =>
    `<button class="chip ${state.group === c.id ? 'on' : ''}" data-g="${c.id}">${esc(c.name.split(',')[0])}</button>`).join('');
}

function renderList() {
  const q = norm(state.q.trim());
  const groups = state.group === 'all' ? GROUPS : GROUPS.filter((g) => g.id === state.group);
  let html = '';
  if (!q && state.group === 'all') html += drugRow(FREE);
  for (const g of groups) {
    const items = DRUGS.filter((d) => d.g === g.id)
      .filter((d) => presetsFor(d).length || (d.contra && d.contra[state.sp]))
      .filter((d) => !q || norm(d.name).includes(q));
    if (!items.length) continue;
    html += `<h3 class="group">${esc(g.name)}</h3>` + items.map(drugRow).join('');
  }
  if (q && norm(FREE.name).includes(q)) html = drugRow(FREE) + html;
  $('#drug-list').innerHTML = html || '<p class="empty">Sin resultados para esta especie.</p>';
}

function drugRow(d) {
  const ps = presetsFor(d);
  const contra = d.contra && d.contra[state.sp];
  const sub = contra ? '<span class="bad">Contraindicado</span>' : d.free ? 'Ingresá dosis y concentración a mano' : esc(rangeText(ps[0])) + (ps.length > 1 ? ` · +${ps.length - 1}` : '');
  return `<button class="drug" data-id="${d.id}"><span class="dn">${esc(d.name)}</span><span class="ds">${sub}</span></button>`;
}

// ───────────────────────── Detalle ─────────────────────────
function openDrug(id, push = true) {
  const drug = byId[id];
  if (!drug) return;
  state.drug = drug;
  state.pi = 0;
  const saved = store.get('uv.pres.' + id, null);
  state.pres = saved || {
    mode: 'liq', liqType: drug.conc && drug.conc.pct ? 'pct' : 'amt',
    a: drug.conc && drug.conc.a ? String(drug.conc.a) : '', au: (drug.conc && drug.conc.au) || 'mg',
    ml: drug.conc && drug.conc.ml ? String(drug.conc.ml) : '1',
    pct: drug.conc && drug.conc.pct ? String(drug.conc.pct) : '',
    ta: '', tau: 'mg',
  };
  state.freeUnit = store.get('uv.freeUnit', 'mg/kg');
  clearCRI();
  $('#list-view').hidden = true;
  $('#detail-view').hidden = false;
  if (push) history.pushState({ drug: id }, '', '#' + id);
  window.scrollTo(0, 0);
  renderDetail();
}

function closeDrug() {
  state.drug = null;
  $('#detail-view').hidden = true;
  $('#list-view').hidden = false;
  renderList();
}

function currentPreset() {
  const ps = presetsFor(state.drug);
  const p = ps[Math.min(state.pi, ps.length - 1)];
  if (p && state.drug.free) {
    const t = parseUnit(state.freeUnit).time;
    return { ...p, u: state.freeUnit, cri: t === 'min' || t === 'h' };
  }
  return p;
}

function renderDetail() {
  const d = state.drug;
  $('#d-name').textContent = d.name;
  const contra = d.contra && d.contra[state.sp];
  $('#d-contra').innerHTML = contra ? `<div class="alert bad">⛔ ${esc(contra)}</div>` : '';
  const ps = presetsFor(d);
  const body = $('#d-body');
  if (!ps.length) { body.hidden = true; return; }
  body.hidden = false;
  if (state.pi >= ps.length) state.pi = 0;

  $('#d-presets').innerHTML = d.free ? '' : ps.map((p, i) => `
    <button class="preset ${i === state.pi ? 'on' : ''}" data-i="${i}">
      <span class="pl">${esc(p.l)}${p.src === 'PDF' ? ' <span class="tag">PDF</span>' : ''}${p.cri ? ' <span class="tag cri">IC</span>' : ''}</span>
      <span class="pr">${esc(rangeText(p))}${p.f ? ' · ' + esc(p.f) : ''}</span>
    </button>`).join('');
  $('#d-presets-wrap').hidden = d.free || ps.length < 2;

  const p = currentPreset();
  state.dose = p.tiers ? NaN : p.d[0];
  renderPresetInfo(p);
  renderDoseInput(p);
  renderPresentation(p);
  compute();
}

function renderPresetInfo(p) {
  const bits = [];
  if (!state.drug.free) bits.push(`<div><b>Dosis:</b> ${esc(rangeText(p))}</div>`);
  if (p.f) bits.push(`<div><b>Frecuencia:</b> ${esc(p.f)}</div>`);
  if (p.v) bits.push(`<div><b>Vía:</b> ${esc(p.v)}</div>`);
  if (p.n) bits.push(`<div class="note">${esc(p.n)}</div>`);
  if (p.src === 'PDF') bits.push('<div class="src">Fuente: vademécum de la Unidad (PDF)</div>');
  $('#d-info').innerHTML = bits.join('');
  $('#d-info').hidden = !bits.length;
}

function renderDoseInput(p) {
  const U = parseUnit(p.u);
  let html = '';
  if (state.drug.free) {
    html += `<label class="lbl">Unidad de dosis</label>
      <select id="free-unit">${FREE_UNITS.map((u) => `<option ${u === p.u ? 'selected' : ''} value="${u}">${esc(u.replace('m2', 'm²'))}</option>`).join('')}</select>`;
  }
  if (p.tiers) {
    html += `<label class="lbl">Dosis</label><div class="tierinfo" id="tier-dose">Según peso</div>`;
  } else {
    const ranged = isFinite(p.d[0]) && p.d[1] > p.d[0];
    html += `<label class="lbl">Dosis elegida</label>
      <div class="inrow"><input id="dose" inputmode="decimal" autocomplete="off" value="${isFinite(state.dose) ? String(state.dose).replace('.', ',') : ''}" placeholder="Dosis"><span class="unit">${esc(unitLabel(p.u))}</span></div>`;
    if (ranged) {
      const step = (p.d[1] - p.d[0]) / 100;
      html += `<input id="dose-range" type="range" min="${p.d[0]}" max="${p.d[1]}" step="${step}" value="${p.d[0]}">
        <div class="rangeends"><span>${fmt(p.d[0])}</span><span>${fmt(p.d[1])}</span></div>`;
    }
  }
  if (U.per === '100UI') {
    html += `<label class="lbl">UI de la última dosis de heparina</label>
      <div class="inrow"><input id="hep-ui" inputmode="decimal" value="${esc(state.hepUI)}" placeholder="Ej: 1000"><span class="unit">UI</span></div>`;
  }
  $('#d-dose').innerHTML = html;
}

function renderPresentation(p) {
  const U = parseUnit(p.u);
  const dim = dimOf(U.q);
  const box = $('#d-pres');
  if (dim === 'vol') {
    box.innerHTML = '<div class="hint">La dosis ya está expresada en ml: no hace falta concentración.</div>';
    return;
  }
  const P = state.pres;
  const massUnits = ['mg', 'g', 'µg'];
  const units = dim === 'ui' ? ['UI'] : massUnits;
  if (!units.includes(P.au)) P.au = units[0];
  if (!units.includes(P.tau)) P.tau = units[0];
  const unitSel = (id, val) => `<select id="${id}">${units.map((u) => `<option ${u === val ? 'selected' : ''}>${u}</option>`).join('')}</select>`;
  const canTab = !p.cri;
  if (!canTab) P.mode = 'liq';
  box.innerHTML = `
    <div class="seg small" id="pres-mode">
      <button data-m="liq" class="${P.mode === 'liq' ? 'on' : ''}">💧 Líquido / inyectable</button>
      ${canTab ? `<button data-m="tab" class="${P.mode === 'tab' ? 'on' : ''}">💊 Comprimido / cápsula</button>` : ''}
    </div>
    <div id="pres-liq" ${P.mode === 'liq' ? '' : 'hidden'}>
      ${dim === 'mass' ? `<div class="seg small" id="liq-type">
        <button data-t="amt" class="${P.liqType === 'amt' ? 'on' : ''}">Cantidad en ml</button>
        <button data-t="pct" class="${P.liqType === 'pct' ? 'on' : ''}">Porcentaje (%)</button>
      </div>` : ''}
      <div id="liq-amt" ${P.liqType === 'amt' || dim !== 'mass' ? '' : 'hidden'}>
        <label class="lbl">Concentración</label>
        <div class="inrow conc">
          <input id="c-a" inputmode="decimal" value="${esc(P.a)}" placeholder="Ej: 50">${unitSel('c-au', P.au)}
          <span class="unit">en</span>
          <input id="c-ml" inputmode="decimal" value="${esc(P.ml)}" placeholder="1"><span class="unit">ml</span>
        </div>
        <div class="hint">Ej.: 50 mg en 1 ml · 250 mg en 5 ml · 1 g en 10 ml</div>
      </div>
      ${dim === 'mass' ? `<div id="liq-pct" ${P.liqType === 'pct' ? '' : 'hidden'}>
        <label class="lbl">Concentración</label>
        <div class="inrow"><input id="c-pct" inputmode="decimal" value="${esc(P.pct)}" placeholder="Ej: 10"><span class="unit">% (g/100 ml)</span></div>
        <div class="hint" id="pct-eq"></div>
      </div>` : ''}
    </div>
    ${canTab ? `<div id="pres-tab" ${P.mode === 'tab' ? '' : 'hidden'}>
      <label class="lbl">Contenido por comprimido</label>
      <div class="inrow"><input id="t-a" inputmode="decimal" value="${esc(P.ta)}" placeholder="Ej: 250">${unitSel('t-au', P.tau)}<span class="unit">c/u</span></div>
    </div>` : ''}`;
}

// ───────────────────────── Cálculo ─────────────────────────
function concentration(dim) {
  const P = state.pres;
  if (P.mode === 'tab') {
    const v = num(P.ta);
    return v > 0 ? { kind: 'tab', base: toBase(v, P.tau) } : null;
  }
  if (dim === 'mass' && P.liqType === 'pct') {
    const v = num(P.pct);
    return v > 0 ? { kind: 'liq', base: v * 10 } : null; // 1% = 10 mg/ml
  }
  const a = num(P.a); const ml = num(P.ml);
  return a > 0 && ml > 0 ? { kind: 'liq', base: toBase(a, P.au) / ml } : null;
}

// Devuelve la cantidad (en unidad base) para una dosis dada.
function amountFor(p, dose) {
  const U = parseUnit(p.u);
  const w = W();
  let factor;
  if (U.per === 'kg') factor = w;
  else if (U.per === 'm2') factor = w > 0 ? bsa(w, state.sp) : NaN;
  else if (U.per === '100UI') factor = num(state.hepUI) / 100;
  else factor = 1;
  return toBase(dose * factor, U.q);
}

function compute() {
  const p = currentPreset();
  if (!p) return;
  const U = parseUnit(p.u);
  const dim = dimOf(U.q);
  const w = W();
  const out = [];
  const warn = [];

  const needsW = U.per === 'kg' || U.per === 'm2' || p.tiers;
  if (needsW && !(w > 0)) {
    $('#d-result').innerHTML = '<div class="result muted">Ingresá el peso del paciente arriba para calcular.</div>';
    clearCRI();
    return;
  }
  if (w > 150) warn.push('Revisá el peso: ' + fmt(w) + ' kg parece excesivo.');

  let dose = state.dose;
  if (p.tiers) {
    const t = p.tiers.find((t) => w <= t.hasta);
    dose = t.dosis;
    const el = $('#tier-dose');
    if (el) el.textContent = fmt(dose) + ' mg por animal (' + fmt(w) + ' kg)';
  }
  if (!isFinite(dose) || dose <= 0) {
    $('#d-result').innerHTML = '<div class="result muted">Ingresá la dosis.</div>';
    clearCRI();
    return;
  }
  if (U.per === '100UI' && !(num(state.hepUI) > 0)) {
    $('#d-result').innerHTML = '<div class="result muted">Ingresá las UI de heparina administradas.</div>';
    clearCRI();
    return;
  }

  if (!p.tiers && isFinite(p.d[0]) && (dose < p.d[0] - 1e-9 || dose > p.d[1] + 1e-9)) {
    warn.push(`La dosis elegida está FUERA del rango indicado (${rangeText(p)}).`);
  }

  if (U.per === 'm2') out.push(`<div class="kv"><span>Superficie corporal</span><b>${fmt(bsa(w, state.sp))} m²</b></div>`);

  let amount = amountFor(p, dose); // por toma, por día o por unidad de tiempo
  const range = !p.tiers && p.d[1] > p.d[0] ? [amountFor(p, p.d[0]), amountFor(p, p.d[1])] : null;

  // Dosis diaria dividida en tomas
  let admin = amount;
  if (!p.cri && U.time === 'día') {
    if (p.max && amount > toBase(p.max, U.q)) {
      warn.push(`Supera el máximo diario de ${showAmount(toBase(p.max, U.q), dim)}: se limita a ese valor.`);
      amount = toBase(p.max, U.q);
    }
    out.push(`<div class="kv"><span>Total por día</span><b>${showAmount(amount, dim)}</b></div>`);
    if (p.tomas > 1) {
      admin = amount / p.tomas;
      out.push(`<div class="kv"><span>Por toma (${p.tomas} tomas/día)</span><b>${showAmount(admin, dim)}</b></div>`);
    } else admin = amount;
  } else if (p.max && !p.cri && amount > toBase(p.max, U.q)) {
    warn.push(`Supera la dosis total máxima de ${showAmount(toBase(p.max, U.q), dim)}: se limita a ese valor.`);
    admin = amount = toBase(p.max, U.q);
  }

  const conc = dim === 'vol' ? null : concentration(dim);

  if (p.cri) {
    const perH = amount * PER_HOUR[U.time];
    if (U.time !== 'h') out.push(`<div class="kv"><span>Equivale a</span><b>${showAmount(toBase(dose * PER_HOUR[U.time], U.q), dim)}/${U.per === 'kg' ? 'kg/' : ''}h</b></div>`);
    out.push(`<div class="kv big"><span>Fármaco por hora</span><b>${showAmount(perH, dim)}/h</b></div>`);
    out.push(`<div class="kv"><span>Por 24 h</span><b>${showAmount(perH * 24, dim)}</b></div>`);
    if (conc) {
      out.push(`<div class="kv big hl"><span>Velocidad (fármaco sin diluir)</span><b>${fmt(perH / conc.base)} ml/h</b></div>`);
    }
    renderCRI(perH, conc, dim);
  } else {
    clearCRI();
    const isDaily = U.time === 'día' && p.tomas > 1;
    const capped = p.max && amount >= toBase(p.max, U.q);
    const showRange = range && !isDaily && !capped;
    if (!isDaily && U.time !== 'día' && dim !== 'vol') out.push(`<div class="kv big"><span>Dosis total</span><b>${showAmount(admin, dim)}</b></div>`);
    if (showRange && dim !== 'vol') {
      out.push(`<div class="kv sub"><span>Rango</span><b>${showAmount(range[0], dim)} – ${showAmount(range[1], dim)}</b></div>`);
    }
    if (dim === 'vol') {
      out.push(`<div class="kv big hl"><span>Volumen a administrar</span><b>${fmt(admin)} ml</b></div>`);
      if (showRange) out.push(`<div class="kv sub"><span>Rango en volumen</span><b>${fmt(range[0])} – ${fmt(range[1])} ml</b></div>`);
    } else if (conc && conc.kind === 'liq') {
      const ml = admin / conc.base;
      out.push(`<div class="kv big hl"><span>Volumen a administrar</span><b>${fmt(ml)} ml</b></div>`);
      if (showRange) out.push(`<div class="kv sub"><span>Rango en volumen</span><b>${fmt(range[0] / conc.base)} – ${fmt(range[1] / conc.base)} ml</b></div>`);
      if (ml < 1) out.push(`<div class="kv sub"><span>En jeringa de insulina U-100</span><b>${fmt(ml * 100)} UI (marcas)</b></div>`);
      if (ml < 0.1) warn.push('Volumen muy pequeño (< 0,1 ml): considerá diluir el fármaco para medir con precisión.');
    } else if (conc && conc.kind === 'tab') {
      const n = admin / conc.base;
      const q4 = Math.round(n * 4) / 4;
      out.push(`<div class="kv big hl"><span>Comprimidos (exacto)</span><b>${fmt(n)}</b></div>`);
      if (q4 > 0) {
        const real = q4 * conc.base;
        const realDose = real / (amountFor(p, 1) || 1) * (isDaily ? p.tomas : 1);
        out.push(`<div class="kv"><span>Redondeado a ¼</span><b>${fracText(q4)} comprimido${q4 > 1 ? 's' : ''}</b></div>`);
        out.push(`<div class="kv sub"><span>Dosis real con ese redondeo</span><b>${showAmount(real, dim)}${U.per === 'kg' || U.per === 'm2' ? ' = ' + fmt(realDose) + ' ' + esc(unitLabel(p.u)) : ''}</b></div>`);
        if (!p.tiers && isFinite(p.d[0]) && U.per !== '100UI' && (realDose < p.d[0] * 0.999 || realDose > p.d[1] * 1.001)) {
          warn.push('Con el redondeo a ¼ de comprimido la dosis queda fuera del rango: considerá otra presentación o una preparación magistral.');
        }
      } else {
        warn.push('Corresponde menos de ¼ de comprimido: usar otra presentación o preparación magistral.');
      }
    } else {
      out.push('<div class="kv sub muted"><span>Cargá la concentración para obtener ml o comprimidos.</span></div>');
    }
    if (U.per === '100UI') {
      out.push(`<div class="kv sub"><span>Si pasó ~1 h de la heparina (50%)</span><b>${showAmount(admin * 0.5, dim)}${conc && conc.kind === 'liq' ? ' = ' + fmt(admin * 0.5 / conc.base) + ' ml' : ''}</b></div>`);
      out.push(`<div class="kv sub"><span>Si pasaron ~2 h (25%)</span><b>${showAmount(admin * 0.25, dim)}${conc && conc.kind === 'liq' ? ' = ' + fmt(admin * 0.25 / conc.base) + ' ml' : ''}</b></div>`);
    }
  }

  if (conc && state.pres.mode === 'liq' && state.pres.liqType === 'pct' && dim === 'mass') {
    const el = $('#pct-eq');
    if (el) el.textContent = `${fmt(num(state.pres.pct))}% = ${fmt(conc.base)} mg/ml`;
  }

  $('#d-result').innerHTML = `<div class="result">
    <div class="rhead">${state.sp === 'g' ? '🐱 Gato' : '🐶 Perro'}${w > 0 ? ' · ' + fmt(w) + ' kg' : ''} · ${esc(p.tiers ? fmt(dose) + ' mg/animal' : fmt(dose) + ' ' + unitLabel(p.u))}</div>
    ${warn.map((t) => `<div class="alert warn">⚠ ${esc(t)}</div>`).join('')}
    ${out.join('')}
  </div>`;
}

function fracText(q) {
  const whole = Math.floor(q);
  const f = q - whole;
  const fr = f === 0.25 ? '¼' : f === 0.5 ? '½' : f === 0.75 ? '¾' : '';
  return (whole ? whole + (fr ? ' ' : '') : '') + fr || '0';
}

function clearCRI() { const b = $('#d-cri'); b.innerHTML = ''; b.dataset.ready = ''; }

// Preparación de infusión continua en jeringa o bolsa.
function renderCRI(perH, conc, dim) {
  const box = $('#d-cri');
  if (!box.dataset.ready) {
    box.innerHTML = `<div class="card">
      <h4>Preparar dilución (jeringa / bolsa)</h4>
      <label class="lbl">Volumen final de la jeringa o bolsa</label>
      <div class="inrow"><input id="cri-vol" inputmode="decimal" value="${esc(state.cri.vol)}" placeholder="Ej: 50"><span class="unit">ml</span></div>
      <label class="lbl">Velocidad de la bomba</label>
      <div class="inrow"><input id="cri-rate" inputmode="decimal" value="${esc(state.cri.rate)}" placeholder="Ej: 5"><span class="unit">ml/h</span></div>
      <div id="cri-out"></div></div>`;
    box.dataset.ready = '1';
  }
  const V = num(state.cri.vol); const R = num(state.cri.rate);
  const o = $('#cri-out');
  if (!(V > 0 && R > 0)) { o.innerHTML = '<div class="hint">Completá volumen y velocidad para saber cuánto fármaco agregar.</div>'; return; }
  const hours = V / R;
  const total = perH * hours;
  let html = `<div class="kv"><span>Duración de la preparación</span><b>${fmt(hours)} h</b></div>
    <div class="kv"><span>Fármaco total a agregar</span><b>${showAmount(total, dim)}</b></div>
    <div class="kv sub"><span>Concentración final</span><b>${showAmount(total / V, dim)}/ml</b></div>`;
  if (conc) {
    const ml = total / conc.base;
    if (ml > V) {
      html += '<div class="alert warn">⚠ El volumen de fármaco supera el volumen final: aumentá la velocidad o el volumen, o usá una presentación más concentrada.</div>';
    } else {
      html += `<div class="kv big hl"><span>ml de fármaco a cargar</span><b>${fmt(ml)} ml</b></div>
        <div class="kv"><span>+ diluyente</span><b>${fmt(V - ml)} ml</b></div>`;
    }
  } else {
    html += '<div class="hint">Cargá la concentración del fármaco para obtener los ml a cargar.</div>';
  }
  o.innerHTML = html;
}

// ───────────────────────── Eventos ─────────────────────────
function savePres() { if (state.drug) store.set('uv.pres.' + state.drug.id, state.pres); }

function bind() {
  document.querySelectorAll('#species button').forEach((b) => b.addEventListener('click', () => {
    state.sp = b.dataset.sp;
    store.set('uv.sp', state.sp);
    syncSpecies();
    if (state.drug) { clearCRI(); renderDetail(); } else renderList();
  }));
  $('#weight').value = state.weight;
  $('#weight').addEventListener('input', (e) => {
    state.weight = e.target.value;
    store.set('uv.weight', state.weight);
    if (state.drug) compute();
  });
  $('#search').addEventListener('input', (e) => { state.q = e.target.value; renderList(); });
  $('#chips').addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    state.group = b.dataset.g; renderChips(); renderList();
  });
  $('#drug-list').addEventListener('click', (e) => {
    const b = e.target.closest('.drug'); if (b) openDrug(b.dataset.id);
  });
  $('#back').addEventListener('click', () => history.back());
  window.addEventListener('popstate', () => {
    const id = location.hash.slice(1);
    if (id && byId[id]) openDrug(id, false); else closeDrug();
  });

  $('#d-presets').addEventListener('click', (e) => {
    const b = e.target.closest('.preset'); if (!b) return;
    state.pi = Number(b.dataset.i);
    clearCRI();
    renderDetail();
  });

  const detail = $('#detail-view');
  detail.addEventListener('input', (e) => {
    const t = e.target; const P = state.pres;
    switch (t.id) {
      case 'dose': state.dose = num(t.value); { const r = $('#dose-range'); if (r && isFinite(state.dose)) r.value = state.dose; } break;
      case 'dose-range': state.dose = Math.round(Number(t.value) * 1e4) / 1e4; $('#dose').value = String(state.dose).replace('.', ','); break;
      case 'hep-ui': state.hepUI = t.value; break;
      case 'c-a': P.a = t.value; savePres(); break;
      case 'c-ml': P.ml = t.value; savePres(); break;
      case 'c-pct': P.pct = t.value; savePres(); break;
      case 't-a': P.ta = t.value; savePres(); break;
      case 'cri-vol': state.cri.vol = t.value; break;
      case 'cri-rate': state.cri.rate = t.value; break;
      default: return;
    }
    compute();
  });
  detail.addEventListener('change', (e) => {
    const t = e.target; const P = state.pres;
    if (t.id === 'c-au') { P.au = t.value; savePres(); compute(); }
    if (t.id === 't-au') { P.tau = t.value; savePres(); compute(); }
    if (t.id === 'free-unit') {
      state.freeUnit = t.value; store.set('uv.freeUnit', t.value);
      clearCRI();
      const p = currentPreset();
      renderDoseInput(p); renderPresentation(p); compute();
    }
  });
  detail.addEventListener('click', (e) => {
    const m = e.target.closest('#pres-mode button');
    const lt = e.target.closest('#liq-type button');
    if (!m && !lt) return;
    if (m) state.pres.mode = m.dataset.m;
    if (lt) state.pres.liqType = lt.dataset.t;
    savePres();
    renderPresentation(currentPreset());
    compute();
  });
}

function syncSpecies() {
  document.querySelectorAll('#species button').forEach((b) => b.classList.toggle('on', b.dataset.sp === state.sp));
}

// Llamado desde Android al presionar "atrás": devuelve true si lo manejó la app.
window.appBack = function () {
  if (state.drug) { history.back(); return true; }
  return false;
};

function init() {
  syncSpecies();
  renderChips();
  renderList();
  bind();
  history.replaceState(null, '', location.pathname);
}

init();
