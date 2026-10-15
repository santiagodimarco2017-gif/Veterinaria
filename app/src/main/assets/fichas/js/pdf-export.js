// pdf-export.js — genera el PDF clínico membretado, replicando el esquema de
// 3 páginas de la Ficha Técnica de la Cátedra de Clínica de Animales de
// Compañía (FCV - UNR). Usa jsPDF + jspdf-autotable (cargados por CDN).
'use strict';

const PdfExport = (() => {

  const VERDE = [6, 129, 54];
  const GRIS = [90, 90, 90];

  function membrete(doc, config) {
    doc.setFillColor(...VERDE);
    doc.rect(0, 0, 210, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(config.institucion || 'Facultad de Ciencias Veterinarias — UNR', 10, 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(config.catedra || 'Cátedra de Clínica Médica y Quirúrgica de Animales de Compañía', 10, 16);
    doc.setFontSize(8);
    doc.text(config.profesional || 'Historia clínica veterinaria', 10, 21);
    doc.setTextColor(0, 0, 0);
  }

  function pieDePagina(doc) {
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setTextColor(...GRIS);
      doc.text(`Página ${i} de ${pageCount} · Generado el ${new Date().toLocaleString('es-AR')}`, 10, 290);
      doc.setTextColor(0, 0, 0);
    }
  }

  function seccionTitulo(doc, texto, y) {
    doc.setFillColor(234, 247, 238);
    doc.rect(10, y, 190, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...VERDE);
    doc.text(texto, 12, y + 5);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    return y + 11;
  }

  function tabla(doc, startY, body, opts = {}) {
    doc.autoTable({
      startY,
      body,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 1.2 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55, textColor: GRIS }, 1: { cellWidth: 'auto' } },
      margin: { left: 10, right: 10 },
      ...opts,
    });
    return doc.lastAutoTable.finalY + 3;
  }

  function generarPdfFicha(paciente, ficha, config = {}) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const edad = Utils.formatEdad(Utils.calcEdad(paciente.paciente.fechaNacimiento));

    // ---------- PÁGINA 1: identificación, entorno, plan sanitario ----------
    membrete(doc, config);
    let y = 30;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Ficha Clínica', 10, y);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`N° HC: ${paciente.id}`, 150, y);
    y += 6;

    y = seccionTitulo(doc, 'Paciente y tutor', y);
    y = tabla(doc, y, [
      ['Nombre del paciente', paciente.paciente.nombre || '—'],
      ['Especie / Raza', `${paciente.paciente.especie === 'felino' ? 'Felina' : 'Canina'} — ${paciente.paciente.raza || '—'}`],
      ['Fecha de nacimiento / Edad', `${Utils.formatFechaCorta(paciente.paciente.fechaNacimiento)} (${edad})`],
      ['Sexo / Estado reproductivo', `${paciente.paciente.sexo === 'M' ? 'Macho' : 'Hembra'} — ${paciente.paciente.estadoReproductivo}`],
      ['Pelaje', `${paciente.paciente.pelajeTipo || '—'} · ${paciente.paciente.pelajeColor || '—'}`],
      ['Fecha de atención', Utils.formatFechaLarga(ficha.fechaAtencion)],
      ['Peso actual', ficha.peso ? `${ficha.peso} kg` : '—'],
      ['Tutor', paciente.tutor.nombre || '—'],
      ['Teléfono', paciente.tutor.telefono || '—'],
      ['DNI', paciente.tutor.dni || '—'],
      ['Domicilio', `${paciente.tutor.domicilio || '—'}, ${paciente.tutor.localidad || ''}`],
    ]);

    y = seccionTitulo(doc, 'Entorno, convivencia y manejo', y);
    const e = paciente.entorno;
    y = tabla(doc, y, [
      ['Convive con otros animales', e.conviveOtros ? `Sí — Caninos: ${e.nCaninos || 0}, Felinos: ${e.nFelinos || 0} ${e.otrosDesc ? '· ' + e.otrosDesc : ''}` : 'No'],
      ['Alimentación', `${e.alimentacionTipo} — ${e.alimentacionFrecuencia || '—'}`],
      ['Hábitat', e.habitat],
      ['Acceso a vía pública', e.vagabundea ? `Sí (${e.vagabundeaFrecuencia || '—'})` : 'No'],
    ]);

    y = seccionTitulo(doc, 'Plan sanitario de base', y);
    const ps = paciente.planSanitario;
    y = tabla(doc, y, [
      ['Última desparasitación', ps.desparasitacionUltimaFecha || '—'],
      ['Producto / dosis', ps.desparasitacionProducto || '—'],
      ['Vacunación certificada', ps.certificadoVeterinario ? 'Sí' : 'No — plan sanitario no respaldado legalmente'],
    ]);
    const vacunasAplicadas = ps.vacunas.filter(v => v.aplicada);
    doc.autoTable({
      startY: y,
      head: [['Vacuna', 'Fecha', 'Marca / lote']],
      body: vacunasAplicadas.length ? vacunasAplicadas.map(v => [v.nombre, Utils.formatFechaCorta(v.fecha), v.lote || '—']) : [['Sin vacunas registradas', '', '']],
      theme: 'striped', styles: { fontSize: 8.5 }, headStyles: { fillColor: VERDE },
      margin: { left: 10, right: 10 },
    });

    // ---------- PÁGINA 2: anamnesis, EOG, EOP ----------
    doc.addPage();
    membrete(doc, config);
    y = 30;
    y = seccionTitulo(doc, 'Anamnesis', y);
    y = tabla(doc, y, [
      ['Motivo de consulta', ficha.anamnesis.motivoConsulta || '—'],
      ['Otros datos de interés', ficha.anamnesis.otrosDatos || '—'],
    ]);

    y = seccionTitulo(doc, 'Examen objetivo general (EOG)', y);
    const eog = ficha.eog;
    y = tabla(doc, y, [
      ['Estado general', eog.estadoGeneral || '—'],
      ['Sensorio', eog.sensorio || '—'],
      ['Hidratación', eog.hidratacionPorcentaje || '—'],
      ['Temperatura', eog.temperatura ? `${eog.temperatura} °C` : '—'],
      ['Frecuencia cardíaca', eog.fc ? `${eog.fc} lpm` : '—'],
      ['Frecuencia respiratoria', eog.fr ? `${eog.fr} rpm` : '—'],
      ['Mucosas / TLLC', `${eog.mucosas || '—'} · TLLC ${eog.tllc || '—'}"`],
    ]);
    const gangliosAlterados = FCV.GANGLIOS.filter(g => eog.ganglios[g] && eog.ganglios[g].alterado);
    y = tabla(doc, y, [
      ['Ganglios alterados', gangliosAlterados.length ? gangliosAlterados.map(g => `${FCV.GANGLIOS_LABEL[g]}: ${eog.ganglios[g].desc || 's/d'}`).join(' | ') : 'Sin alteraciones'],
    ]);

    y = seccionTitulo(doc, 'Exploración clínica particular (EOP)', y);
    doc.autoTable({
      startY: y,
      head: [['Sistema', 'Estado', 'Hallazgo']],
      body: FCV.SISTEMAS_EOP.map(s => {
        const d = ficha.eop[s.key];
        return [s.label, d.estado === 'patologico' ? 'Patológico' : 'Normal', d.estado === 'patologico' ? (d.desc || '—') : '—'];
      }),
      theme: 'striped', styles: { fontSize: 8.5 }, headStyles: { fillColor: VERDE },
      margin: { left: 10, right: 10 },
    });

    // ---------- PÁGINA 3: diagnóstico, métodos complementarios, tratamiento ----------
    doc.addPage();
    membrete(doc, config);
    y = 30;
    y = seccionTitulo(doc, 'Juicio diagnóstico y pronóstico', y);
    const d = ficha.diagnostico;
    y = tabla(doc, y, [
      ['Diagnóstico presuntivo', d.presuntivo || '—'],
      ['Diagnósticos diferenciales', d.diferenciales || '—'],
      ['Diagnóstico definitivo', d.definitivo || '—'],
      ['Clasificación', d.clasificacionDefinitivo || '—'],
      ['Pronóstico', d.pronostico || '—'],
    ]);

    const metodosSolicitados = d.metodosComplementarios.filter(m => m.solicitado);
    doc.autoTable({
      startY: y,
      head: [['Método complementario', 'Fecha', 'Resultado']],
      body: metodosSolicitados.length ? metodosSolicitados.map(m => [m.tipo, Utils.formatFechaCorta(m.fecha), m.resultado || '—']) : [['Sin métodos solicitados', '', '']],
      theme: 'striped', styles: { fontSize: 8 }, headStyles: { fillColor: VERDE },
      margin: { left: 10, right: 10 },
    });
    y = doc.lastAutoTable.finalY + 6;

    y = seccionTitulo(doc, 'Tratamiento', y);
    const t = ficha.tratamiento;
    y = tabla(doc, y, [['Indicaciones inmediatas', t.indicacionesInmediatas || '—']]);
    const rx = (t.prescripciones || []).filter(r => r.principioActivo);
    doc.autoTable({
      startY: y,
      head: [['Fármaco', 'Dosis mg/kg', 'Volumen a administrar', 'Intervalo', 'Duración']],
      body: rx.length ? rx.map(r => {
        const calc = Utils.calcularVolumenDosis(r.dosisMgKg, ficha.peso, r.concentracionMgMl);
        return [r.principioActivo, r.dosisMgKg || '—', calc ? `${calc.ml} ml` : '—', r.intervalo ? `c/${r.intervalo} hs` : '—', r.duracionDias ? `${r.duracionDias} días` : '—'];
      }) : [['Sin prescripciones cargadas', '', '', '', '']],
      theme: 'striped', styles: { fontSize: 8 }, headStyles: { fillColor: VERDE },
      margin: { left: 10, right: 10 },
    });

    // Anexo de resultados adjuntos (fotos y/o PDFs) de métodos complementarios.
    const conArchivos = metodosSolicitados.filter(m => m.archivos && m.archivos.length);
    if (conArchivos.length) {
      doc.addPage();
      membrete(doc, config);
      y = 30;
      y = seccionTitulo(doc, 'Anexo — resultados adjuntos de métodos complementarios', y);
      conArchivos.forEach(m => {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(m.tipo, 10, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        let x = 10;
        m.archivos.forEach(archivo => {
          const esImagen = (archivo.tipo || (typeof archivo === 'string' ? 'image/*' : '')).startsWith('image/');
          const src = typeof archivo === 'string' ? archivo : archivo.dataUrl;
          if (esImagen) {
            try {
              doc.addImage(src, 'JPEG', x, y, 45, 45);
            } catch (err) { /* formato no soportado por jsPDF, se omite */ }
            x += 50;
            if (x > 160) { x = 10; y += 50; }
          } else {
            // No se puede incrustar el archivo (ej. PDF); se referencia por nombre.
            doc.text(`📎 ${archivo.nombre || 'archivo adjunto'} (ver en la app / respaldo JSON)`, 10, y);
            y += 5;
          }
        });
        y += 52;
        if (y > 250) { doc.addPage(); membrete(doc, config); y = 30; }
      });
    }

    pieDePagina(doc);
    return doc;
  }

  function nombreArchivo(paciente, ficha) {
    const especie = paciente.paciente.especie === 'felino' ? 'Felino' : 'Canino';
    const nombre = (paciente.paciente.nombre || 'paciente').replace(/[^\w-]+/g, '_');
    return `Ficha_${especie}_${nombre}_${ficha.fechaAtencion}.pdf`;
  }

  return { generarPdfFicha, nombreArchivo };
})();
