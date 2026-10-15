// registro.js — guarda resultados de las calculadoras (dosis, infusión,
// fluidos, transfusión, nutrición) y la ficha anestésica en la historia
// clínica de un paciente (store "fichas" de IndexedDB, campo `registros`).
// Requiere: fichas/js/utils.js, fichas/js/db.js y fichas/js/ficha-fcv.js.
'use strict';

const Registro = (() => {
  const CTX_KEY = 'uv.ctx';
  const CTX_HORAS = 24;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ───────── contexto: la consulta desde la que se vino ─────────
  function contexto() {
    try {
      const c = JSON.parse(localStorage.getItem(CTX_KEY) || 'null');
      if (c && c.fichaId && Date.now() - c.ts < CTX_HORAS * 3600000) return c;
    } catch (e) { /* sin almacenamiento */ }
    return null;
  }
  function fijarContexto(patientId, fichaId, nombre) {
    try { localStorage.setItem(CTX_KEY, JSON.stringify({ patientId, fichaId, nombre, ts: Date.now() })); } catch (e) { /* */ }
  }

  // Extrae las filas "etiqueta: valor" de un bloque de resultado (.kv).
  function lineasDe(el) {
    if (!el) return [];
    const out = [];
    el.querySelectorAll('.alert').forEach((a) => out.push(a.textContent.replace(/\s+/g, ' ').trim()));
    el.querySelectorAll('.kv, .sep').forEach((row) => {
      if (row.classList.contains('sep')) { out.push('— ' + row.textContent.trim() + ' —'); return; }
      const k = row.querySelector(':scope > span'); const v = row.querySelector(':scope > b');
      const t = (k ? k.textContent : '').replace(/\s+/g, ' ').trim();
      const val = (v ? v.textContent : '').replace(/\s+/g, ' ').trim();
      if (t || val) out.push(val ? `${t}: ${val}` : t);
    });
    return out;
  }

  // ───────── estilos del selector (independientes de cada página) ─────────
  function estilos() {
    if (document.getElementById('reg-css')) return;
    const st = document.createElement('style');
    st.id = 'reg-css';
    st.textContent = `
      .reg-ov{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.5);display:flex;align-items:flex-end;justify-content:center;font-family:system-ui,-apple-system,Roboto,sans-serif}
      .reg-box{background:#fff;color:#17201d;width:100%;max-width:560px;max-height:85vh;overflow:auto;border-radius:18px 18px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom))}
      .reg-box h3{margin:0 0 4px;font-size:17px}
      .reg-box p{margin:0 0 10px;font-size:13px;color:#5f6b67}
      .reg-box input{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #dde3e1;border-radius:10px;font-size:16px;margin:6px 0 10px}
      .reg-btn{display:block;width:100%;text-align:left;border:1px solid #dde3e1;background:#fff;border-radius:12px;padding:10px 12px;margin-bottom:6px;font-size:15px;color:#17201d}
      .reg-btn small{display:block;color:#5f6b67;font-size:12px}
      .reg-btn.ctx{border:2px solid #0f6e5c;background:#e1f2ee}
      .reg-cancel{display:block;width:100%;border:0;background:transparent;color:#a51d1d;font-weight:600;padding:10px;font-size:15px}
      .reg-save{display:block;width:100%;border:2px solid #0f6e5c;background:transparent;color:#0f6e5c;border-radius:12px;padding:11px;font-weight:700;font-size:15px;margin:10px 0}
      .reg-toast{position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:210;background:#0f6e5c;color:#fff;padding:10px 16px;border-radius:12px;font-size:14px;max-width:90vw;text-align:center;font-family:system-ui,sans-serif}
      @media (prefers-color-scheme: dark){.reg-box{background:#19211f;color:#e7eeec}.reg-btn{background:#19211f;color:#e7eeec;border-color:#2b3633}.reg-btn.ctx{background:#1d3a33}.reg-box input{background:#101514;color:#e7eeec;border-color:#2b3633}}`;
    document.head.appendChild(st);
  }

  function toast(msg) {
    estilos();
    const t = document.createElement('div');
    t.className = 'reg-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }

  // Consulta del día para el paciente (o una nueva).
  async function consultaDeHoy(patientId) {
    const fichas = await DB.fichas.getByPatient(patientId);
    const hoy = Utils.todayISO();
    const deHoy = fichas.filter((f) => f.fechaAtencion === hoy).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    if (deHoy.length) return deHoy[0];
    const f = FCV.nuevaFicha(patientId);
    try {
      const w = JSON.parse(localStorage.getItem('uv.weight') || 'null');
      const n = parseFloat(String(w || '').replace(',', '.'));
      if (n > 0) f.peso = String(n);
    } catch (e) { /* */ }
    f.anamnesis.motivoConsulta = 'Registro desde las calculadoras';
    await DB.fichas.put(f);
    return f;
  }

  async function agregar(fichaId, registro) {
    const f = await DB.fichas.get(fichaId);
    if (!f) throw new Error('La consulta ya no existe.');
    f.registros = f.registros || [];
    f.registros.push({ id: Utils.uuid(), fecha: new Date().toISOString(), ...registro });
    f.updatedAt = new Date().toISOString();
    await DB.fichas.put(f);
    return f;
  }

  // Abre el selector de paciente y guarda el registro.
  async function guardar(registro) {
    estilos();
    const [patients, ctx] = [await DB.patients.getAll(), contexto()];
    const fCtx = ctx ? await DB.fichas.get(ctx.fichaId) : null;
    const pCtx = fCtx ? patients.find((p) => p.id === fCtx.patientId) : null;
    const ordenados = patients.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

    return new Promise((resolve) => {
      const ov = document.createElement('div');
      ov.className = 'reg-ov';
      const item = (p) => `<button class="reg-btn" data-p="${esc(p.id)}">${p.paciente.especie === 'felino' ? '🐱' : '🐶'} ${esc(p.paciente.nombre || 'Sin nombre')}
        <small>${esc(p.tutor.nombre || 'Sin tutor')} · ${esc(p.id)} · se guarda en la consulta de hoy</small></button>`;
      ov.innerHTML = `<div class="reg-box">
        <h3>Guardar en historia clínica</h3>
        <p>${esc(registro.titulo)}</p>
        ${pCtx ? `<button class="reg-btn ctx" data-f="${esc(fCtx.id)}">📋 ${esc(pCtx.paciente.nombre || 'Paciente')} — consulta del ${esc(Utils.formatFechaCorta(fCtx.fechaAtencion))}<small>Consulta desde la que entraste</small></button>` : ''}
        ${patients.length ? '<input type="search" placeholder="Buscar paciente, tutor o N° HC…">' : '<p>Todavía no hay pacientes. Crealos en la pestaña Fichas.</p>'}
        <div class="reg-list">${ordenados.map(item).join('')}</div>
        <button class="reg-cancel">Cancelar</button></div>`;
      document.body.appendChild(ov);
      const cerrar = (msg) => { ov.remove(); if (msg) toast(msg); resolve(msg || null); };
      const buscador = ov.querySelector('input');
      if (buscador) {
        buscador.addEventListener('input', () => {
          const q = buscador.value.trim().toLowerCase();
          ov.querySelector('.reg-list').innerHTML = ordenados.filter((p) => !q ||
            (p.paciente.nombre || '').toLowerCase().includes(q) || (p.tutor.nombre || '').toLowerCase().includes(q) ||
            p.id.toLowerCase().includes(q)).map(item).join('');
        });
      }
      ov.addEventListener('click', async (e) => {
        if (e.target === ov || e.target.closest('.reg-cancel')) { cerrar(); return; }
        const b = e.target.closest('.reg-btn');
        if (!b) return;
        try {
          let f;
          if (b.dataset.f) f = await agregar(b.dataset.f, registro);
          else f = await agregar((await consultaDeHoy(b.dataset.p)).id, registro);
          const p = patients.find((x) => x.id === f.patientId);
          fijarContexto(f.patientId, f.id, p && p.paciente.nombre);
          cerrar(`✅ Guardado en la historia de ${(p && p.paciente.nombre) || 'paciente'} (${Utils.formatFechaCorta(f.fechaAtencion)})`);
        } catch (err) {
          cerrar('No se pudo guardar: ' + err.message);
        }
      });
    });
  }

  // Agrega un botón "Guardar en historia clínica" debajo de `contenedor`.
  function boton(contenedor, construir, texto) {
    estilos();
    let b = contenedor.nextElementSibling;
    if (!b || !b.classList.contains('reg-save')) {
      b = document.createElement('button');
      b.className = 'reg-save';
      b.type = 'button';
      contenedor.after(b);
      b.addEventListener('click', () => {
        const r = construir();
        if (!r || !r.lineas || !r.lineas.length) { toast('No hay un resultado para guardar todavía.'); return; }
        guardar(r);
      });
    }
    b.textContent = texto || '📋 Guardar en historia clínica';
    return b;
  }

  return { guardar, boton, lineasDe, contexto, fijarContexto, toast };
})();
