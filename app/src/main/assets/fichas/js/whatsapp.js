// whatsapp.js — genera un resumen en lenguaje llano para el tutor y arma el
// enlace de envío directo por WhatsApp.
'use strict';

const WhatsApp = (() => {

  const MUCOSAS_TRADUCCION = {
    'Rosadas (normales)': 'de color normal',
    'Pálidas': 'pálidas',
    'Ictéricas': 'con tono amarillento',
    'Cianóticas': 'con tono azulado',
    'Congestivas': 'muy rojizas',
  };

  function construirResumen(paciente, ficha) {
    const nombre = paciente.paciente.nombre || 'tu mascota';
    const tutorNombre = (paciente.tutor.nombre || '').split(' ')[0] || '';
    const fecha = Utils.formatFechaLarga(ficha.fechaAtencion);
    const lineas = [];

    lineas.push(`Hola${tutorNombre ? ' ' + tutorNombre : ''}! 👋 Te paso el resumen de la consulta de *${nombre}* del ${fecha}.`);

    if (ficha.peso) lineas.push(`\n⚖️ Peso registrado: ${ficha.peso} kg.`);

    if (ficha.diagnostico && ficha.diagnostico.presuntivo) {
      lineas.push(`\n🩺 Lo que encontramos: ${ficha.diagnostico.presuntivo}`);
    }
    if (ficha.diagnostico && ficha.diagnostico.definitivo) {
      lineas.push(`\n✅ Diagnóstico: ${ficha.diagnostico.definitivo}`);
    }

    const rx = (ficha.tratamiento && ficha.tratamiento.prescripciones || []).filter(r => r.principioActivo);
    if (rx.length) {
      lineas.push('\n💊 Medicación indicada para casa:');
      rx.forEach(r => {
        const calc = Utils.calcularVolumenDosis(r.dosisMgKg, ficha.peso, r.concentracionMgMl);
        const cantidad = calc ? `${calc.ml} ml` : 'según indicación';
        const intervalo = r.intervalo ? `cada ${r.intervalo} hs` : '';
        const duracion = r.duracionDias ? `durante ${r.duracionDias} días` : '';
        lineas.push(`• ${r.principioActivo}: ${cantidad} ${intervalo} ${duracion}`.replace(/\s+/g, ' ').trim());
      });
    }

    if (ficha.tratamiento && ficha.tratamiento.indicacionesInmediatas) {
      lineas.push(`\n📝 Otras indicaciones: ${ficha.tratamiento.indicacionesInmediatas}`);
    }

    const mucosa = ficha.eog && MUCOSAS_TRADUCCION[ficha.eog.mucosas];
    if (mucosa) lineas.push(`\nℹ️ Las mucosas se observaron ${mucosa}.`);

    lineas.push('\n⚠️ Pautas de alarma: si notás decaimiento marcado, vómitos o diarrea persistentes, falta de apetito por más de 24 hs, o cualquier signo que te preocupe, contactanos o acercate a la guardia más cercana.');

    lineas.push('\nAnte cualquier duda, escribime por acá. ¡Gracias por confiar en nosotros! 🐾');

    return lineas.join('\n');
  }

  function limpiarTelefono(tel) {
    return (tel || '').replace(/[^\d+]/g, '');
  }

  function enlaceWhatsApp(telefono, texto) {
    const tel = limpiarTelefono(telefono).replace(/^\+/, '');
    const base = tel ? `https://api.whatsapp.com/send?phone=${encodeURIComponent(tel)}` : 'https://api.whatsapp.com/send';
    const sep = tel ? '&' : '?';
    return `${base}${sep}text=${encodeURIComponent(texto)}`;
  }

  function abrirResumen(paciente, ficha) {
    const texto = construirResumen(paciente, ficha);
    const url = enlaceWhatsApp(paciente.tutor.telefono, texto);
    Apk.abrirExterno(url);
    return texto;
  }

  return { construirResumen, enlaceWhatsApp, abrirResumen };
})();
