// alta.js — indicaciones al alta para el tutor: medicación para la casa
// (cantidad, cada cuánto, cuántos días), cuidados, próximo control y pautas
// de alarma. Se arma a partir de lo ya calculado (dosis guardadas,
// prescripciones de la consulta y tratamientos de internación) y se entrega
// en PDF y/o por WhatsApp. Queda guardado en la consulta.
'use strict';

const Alta = (() => {
  const esc = Utils.escapeHtml;
  const INPUT = 'w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-base text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500';
  const LBL = 'block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 mt-2';
  const CARD = 'rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-4 mb-4';
  const PAUTAS = 'Consultar de inmediato si presenta: decaimiento marcado, vómitos o diarrea persistentes, sangrado, dificultad para respirar, falta de apetito por más de 24 h, convulsiones o cualquier signo que le preocupe.';

  const item = (o = {}) => ({ id: Utils.uuid(), medicamento: '', cantidad: '', via: 'Oral', frecuencia: '', dias: '', notas: '', ...o });
  const intervaloTxt = (h) => (Number(h) > 0 ? `cada ${h} horas` : '');

  // Lenguaje para el tutor: "c/12 h" -> "cada 12 horas", "PO" -> "Oral".
  function frecuenciaTutor(f) {
    return String(f || '').replace(/c\/\s*(\d+(?:-\d+)?)\s*h(?:s|oras)?\b/gi, 'cada $1 horas').replace(/\bdías?\b/g, (m) => m);
  }
  function viaTutor(v) {
    const t = String(v || '').split(/[,(/]/)[0].trim().toLowerCase().replace(/\.$/, '');
    const mapa = { 'v.o': 'Oral', 'vo': 'Oral', 'po': 'Oral', 'oral': 'Oral', 's.c': 'Subcutánea', 'sc': 'Subcutánea', 'i.m': 'Intramuscular', 'im': 'Intramuscular',
      'i.v': 'Endovenosa', 'iv': 'Endovenosa', 'ev': 'Endovenosa', 'tópica': 'Tópica', 'tópica (spot-on)': 'Tópica', 'transdérmica': 'Parche en la piel', 'transmucosa oral': 'En la boca (encía)' };
    return mapa[t] || (v ? String(v).split('(')[0].trim() : '');
  }

  // Sugerencias tomadas de lo que ya se calculó o indicó.
  async function sugerencias(f) {
    const out = [];
    (f.registros || []).filter((r) => r.tipo === 'Dosis').forEach((r) => {
      const d = r.datos || {};
      out.push({ origen: 'Dosis calculada', it: item({
        medicamento: d.farmaco || (r.titulo || '').split('—')[0].trim(),
        cantidad: d.cantidad || '', via: viaTutor(d.via), frecuencia: frecuenciaTutor(d.frecuencia),
        notas: d.presentacion ? d.presentacion.replace(/^Comprimido de/, 'Comprimidos de') : '',
      }) });
    });
    (f.tratamiento.prescripciones || []).filter((r) => r.principioActivo).forEach((r) => {
      const c = Utils.calcularVolumenDosis(r.dosisMgKg, f.peso, r.concentracionMgMl);
      out.push({ origen: 'Prescripción de la consulta', it: item({
        medicamento: r.principioActivo, cantidad: c ? `${c.ml} ml (${c.mgTotales} mg)` : '',
        frecuencia: intervaloTxt(r.intervalo), dias: r.duracionDias || '',
      }) });
    });
    const ints = (await DB.internaciones.getByPatient(f.patientId)).sort((a, b) => b.ingreso - a.ingreso);
    if (ints[0]) {
      ints[0].tratamientos.filter((t) => !t.suspendido).forEach((t) => out.push({ origen: 'Tratamiento de internación', it: item({
        medicamento: t.nombre, cantidad: t.dosis || '', via: viaTutor(t.via), frecuencia: intervaloTxt(t.intervaloH), notas: t.notas || '',
      }) }));
    }
    return out;
  }

  // ───────── texto para WhatsApp ─────────
  function texto(p, f, a) {
    const nombre = p.paciente.nombre || 'tu mascota';
    const L = [`Hola${p.tutor.nombre ? ' ' + p.tutor.nombre.split(' ')[0] : ''}! 👋 Estas son las indicaciones para *${nombre}*:`];
    if (a.items.length) {
      L.push('\n💊 *Medicación*');
      a.items.forEach((x) => L.push(`• *${x.medicamento}*: ${[x.cantidad, x.via && x.via.toLowerCase(), x.frecuencia, x.dias && `durante ${x.dias} días`].filter(Boolean).join(', ')}${x.notas ? ` (${x.notas})` : ''}`));
    }
    if (a.cuidados) L.push(`\n📝 *Cuidados*\n${a.cuidados}`);
    if (a.proximoControl) L.push(`\n📅 *Próximo control:* ${Utils.formatFechaLarga(a.proximoControl)}`);
    if (a.pautas) L.push(`\n⚠️ ${a.pautas}`);
    L.push('\nAnte cualquier duda, escribinos. 🐾');
    return L.join('\n');
  }

  // ───────── PDF para el tutor ─────────
  function pdf(p, f, a) {
    const { jsPDF } = window.jspdf;
    const T = PdfExport.pdfTxt;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    doc.setFillColor(6, 129, 54); doc.rect(0, 0, 210, 22, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    doc.text('Indicaciones para el tutor', 10, 11);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(T(`${p.paciente.nombre || 'Paciente'} · ${p.paciente.especie === 'felino' ? 'Felino' : 'Canino'} · ${f.peso ? f.peso + ' kg · ' : ''}Fecha: ${Utils.formatFechaCorta(Utils.todayISO())} · N° HC ${p.id}`), 10, 18);
    doc.setTextColor(0, 0, 0);
    let y = 30;
    if (p.tutor.nombre) { doc.setFontSize(10); doc.text(T(`Tutor: ${p.tutor.nombre}`), 10, y); y += 6; }
    doc.autoTable({
      startY: y,
      head: [['Medicamento', 'Cuánto dar', 'Vía', 'Cada cuánto', 'Cuántos días']],
      body: a.items.length ? a.items.map((x) => [T(x.medicamento) + (x.notas ? '\n' + T(x.notas) : ''), T(x.cantidad), T(x.via), T(x.frecuencia), T(x.dias ? `${x.dias} días` : '')]) : [['Sin medicación para la casa', '', '', '', '']],
      theme: 'grid', styles: { fontSize: 10, cellPadding: 2.5, valign: 'middle' }, headStyles: { fillColor: [6, 129, 54], fontSize: 10 },
      columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold' } }, margin: { left: 10, right: 10 },
    });
    y = doc.lastAutoTable.finalY + 8;
    const bloque = (titulo, cuerpo) => {
      if (!cuerpo) return;
      const wr = doc.splitTextToSize(T(cuerpo), 188);
      if (y + 10 + wr.length * 5 > 285) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(T(titulo), 10, y); y += 6;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(wr, 10, y); y += wr.length * 5 + 5;
    };
    bloque('Cuidados', a.cuidados);
    bloque('Próximo control', a.proximoControl ? Utils.formatFechaLarga(a.proximoControl) : '');
    bloque('Pautas de alarma', a.pautas);
    doc.setFontSize(8); doc.setTextColor(120, 120, 120);
    doc.text('Respete las dosis y horarios indicados. No suspenda la medicación sin consultar.', 10, 288);
    return { doc, nombre: `Indicaciones_${(p.paciente.nombre || 'paciente').replace(/[^\w-]+/g, '_')}_${Utils.todayISO()}.pdf` };
  }

  // ───────── pantalla ─────────
  async function screen(fichaId, h) {
    const f = await DB.fichas.get(fichaId);
    if (!f) { location.hash = '#/pacientes'; return; }
    const p = await DB.patients.get(f.patientId);
    const sug = await sugerencias(f);
    const a = f.alta || { items: [], cuidados: '', proximoControl: '', pautas: PAUTAS };
    if (!f.alta && !a.items.length) sug.forEach((s) => a.items.push({ ...s.it })); // primera vez: precargar todo

    const guardar = async () => { f.alta = a; f.updatedAt = new Date().toISOString(); await DB.fichas.put(f); };

    function render() {
      h.renderInto(`<div class="p-4 pb-28">
        <a href="#/consulta/${f.id}" class="text-sm text-emerald-700 dark:text-emerald-400 mb-3 inline-block">← Consulta de ${esc(p.paciente.nombre || '')}</a>
        <h2 class="text-lg font-bold mb-1">📝 Indicaciones al alta</h2>
        <p class="text-xs text-slate-500 mb-3">Se precarga con las dosis calculadas, las prescripciones y los tratamientos de internación. Revisá y completá cuánto dar y cuántos días.</p>
        ${a.items.map((x, k) => `<div class="${CARD}" data-item="${k}">
          <div class="flex justify-between items-center"><span class="text-xs font-mono text-slate-400">Medicamento ${k + 1}</span>
            <button data-quitar="${k}" class="text-xs text-red-600">Quitar</button></div>
          <label class="${LBL}">Medicamento</label><input data-k="medicamento" class="${INPUT}" value="${esc(x.medicamento)}">
          <div class="grid grid-cols-2 gap-x-3">
            <div><label class="${LBL}">Cuánto dar</label><input data-k="cantidad" class="${INPUT}" value="${esc(x.cantidad)}" placeholder="Ej: 2 ml · ½ comprimido"></div>
            <div><label class="${LBL}">Vía</label><input data-k="via" class="${INPUT}" value="${esc(x.via)}" placeholder="Oral"></div>
            <div><label class="${LBL}">Cada cuánto</label><input data-k="frecuencia" class="${INPUT}" value="${esc(x.frecuencia)}" placeholder="Ej: cada 12 horas"></div>
            <div><label class="${LBL}">Cuántos días</label><input data-k="dias" type="number" min="0" class="${INPUT}" value="${esc(x.dias)}"></div>
          </div>
          <label class="${LBL}">Aclaraciones</label><input data-k="notas" class="${INPUT}" value="${esc(x.notas)}" placeholder="Ej: con comida, agitar antes de usar">
        </div>`).join('') || '<p class="text-sm text-slate-400 mb-3">Sin medicación cargada.</p>'}
        <div class="grid grid-cols-2 gap-3 mb-4">
          <button data-accion="agregar" class="rounded-xl border-2 border-dashed border-emerald-400 text-emerald-700 dark:text-emerald-400 py-2.5 text-sm font-medium">+ Medicamento</button>
          <button data-accion="sugerencias" class="rounded-xl border-2 border-slate-300 dark:border-slate-600 py-2.5 text-sm font-medium" ${sug.length ? '' : 'disabled'}>↻ Desde lo calculado (${sug.length})</button>
        </div>
        <div class="${CARD}">
          <label class="${LBL}">Cuidados en casa</label>
          <textarea data-g="cuidados" rows="3" class="${INPUT}" placeholder="Ej: reposo, collar isabelino, dieta blanda 3 días, limpiar la herida c/12 h">${esc(a.cuidados)}</textarea>
          <label class="${LBL}">Próximo control</label>
          <input data-g="proximoControl" type="date" class="${INPUT}" value="${esc(a.proximoControl)}">
          <label class="${LBL}">Pautas de alarma</label>
          <textarea data-g="pautas" rows="3" class="${INPUT}">${esc(a.pautas)}</textarea>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <button data-accion="pdf" class="rounded-xl bg-slate-800 dark:bg-slate-700 text-white py-3 text-sm font-medium">📄 PDF</button>
          <button data-accion="whatsapp" class="rounded-xl bg-green-600 text-white py-3 text-sm font-medium">💬 WhatsApp (texto)</button>
          <button data-accion="compartir" class="rounded-xl border-2 border-green-600 text-green-700 dark:text-green-400 py-3 text-sm font-medium">📎 Enviar PDF</button>
          <button data-accion="registrar" class="rounded-xl border-2 border-emerald-500 text-emerald-700 dark:text-emerald-400 py-3 text-sm font-medium">📋 Guardar en historia</button>
        </div>
      </div>`);
    }

    // Guarda también el PDF como registro de la consulta (reemplaza el anterior).
    async function registrar() {
      const r = pdf(p, f, a);
      f.registros = (f.registros || []).filter((x) => x.tipo !== 'Indicaciones al alta');
      f.registros.push({
        id: Utils.uuid(), fecha: new Date().toISOString(), tipo: 'Indicaciones al alta',
        titulo: `Indicaciones al alta — ${p.paciente.nombre || ''}`,
        lineas: a.items.map((x) => `${x.medicamento}: ${[x.cantidad, x.via, x.frecuencia, x.dias && x.dias + ' días'].filter(Boolean).join(' · ')}${x.notas ? ' (' + x.notas + ')' : ''}`)
          .concat(a.cuidados ? ['Cuidados: ' + a.cuidados] : [], a.proximoControl ? ['Próximo control: ' + Utils.formatFechaCorta(a.proximoControl)] : []),
        pdf: { nombre: r.nombre, dataUrl: r.doc.output('datauristring') },
      });
      await guardar();
      return r;
    }

    h.root.addEventListener('input', (e) => {
      const el = e.target;
      const card = el.closest('[data-item]');
      if (card && el.dataset.k) a.items[Number(card.dataset.item)][el.dataset.k] = el.value;
      if (el.dataset.g) a[el.dataset.g] = el.value;
    });
    h.root.addEventListener('change', () => guardar());
    h.root.addEventListener('click', async (e) => {
      const q = e.target.closest('[data-quitar]');
      if (q) { a.items.splice(Number(q.dataset.quitar), 1); await guardar(); render(); return; }
      const b = e.target.closest('[data-accion]');
      if (!b) return;
      await guardar();
      switch (b.dataset.accion) {
        case 'agregar': a.items.push(item()); await guardar(); render(); break;
        case 'sugerencias': {
          const ya = new Set(a.items.map((x) => x.medicamento.toLowerCase()));
          const nuevas = sug.filter((s) => !ya.has(s.it.medicamento.toLowerCase()));
          nuevas.forEach((s) => a.items.push({ ...s.it, id: Utils.uuid() }));
          await guardar(); render();
          h.showToast(nuevas.length ? `Se agregaron ${nuevas.length} medicamento(s)` : 'Ya están todos cargados', 'ok');
          break;
        }
        case 'pdf': { const r = await registrar(); h.showToast(Apk.guardarPdf(r.doc, r.nombre), 'ok'); break; }
        case 'compartir': {
          const r = await registrar();
          h.showToast(Apk.compartir([{ nombre: r.nombre, mime: 'application/pdf', base64: Apk.pdfABase64(r.doc) }], `Indicaciones para ${p.paciente.nombre || 'el tutor'}`, false), 'ok');
          break;
        }
        case 'whatsapp':
          await registrar();
          if (!p.tutor.telefono) h.showToast('Cargá el teléfono del tutor en la ficha para enviarlo directo.', 'error');
          Apk.abrirExterno(WhatsApp.enlaceWhatsApp(p.tutor.telefono, texto(p, f, a)));
          break;
        case 'registrar': await registrar(); h.showToast('Indicaciones guardadas en la historia ✅', 'ok'); break;
        default:
      }
    });

    render();
  }

  return { screen, texto, pdf };
})();
