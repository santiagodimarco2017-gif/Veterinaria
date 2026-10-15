// ficha-fcv.js — estructura clínica troncal basada en la Ficha Técnica de la
// Cátedra de Clínica Médica y Quirúrgica de Animales de Compañía (FCV - UNR).
'use strict';

const FCV = (() => {

  // ---------------------------------------------------------------------
  // Razas con predisposiciones más frecuentes (lista curada, no exhaustiva).
  // ---------------------------------------------------------------------
  const RAZAS_CANINAS = [
    { nombre: 'Mestizo / Sin raza definida', predisposicion: '' },
    { nombre: 'Labrador Retriever', predisposicion: 'Displasia de cadera/codo, obesidad, otitis' },
    { nombre: 'Golden Retriever', predisposicion: 'Neoplasias, displasia de cadera, atopía' },
    { nombre: 'Caniche (Poodle)', predisposicion: 'Luxación de rótula, enfermedad periodontal, Cushing' },
    { nombre: 'Bulldog Francés', predisposicion: 'Síndrome braquicefálico, hemivértebras' },
    { nombre: 'Bulldog Inglés', predisposicion: 'Síndrome braquicefálico, dermatitis de pliegues' },
    { nombre: 'Pug', predisposicion: 'Síndrome braquicefálico, úlceras corneales' },
    { nombre: 'Beagle', predisposicion: 'Epilepsia, obesidad, hipotiroidismo' },
    { nombre: 'Dachshund (Salchicha)', predisposicion: 'Enfermedad de disco intervertebral (Hansen tipo I)' },
    { nombre: 'Boxer', predisposicion: 'Cardiomiopatía, neoplasias, estenosis subaórtica' },
    { nombre: 'Rottweiler', predisposicion: 'Displasia de cadera/codo, osteosarcoma' },
    { nombre: 'Pastor Alemán', predisposicion: 'Displasia de cadera, mielopatía degenerativa, IPE' },
    { nombre: 'Chihuahua', predisposicion: 'Colapso traqueal, luxación de rótula, hidrocefalia' },
    { nombre: 'Yorkshire Terrier', predisposicion: 'Colapso traqueal, luxación de rótula, hipoglucemia' },
    { nombre: 'Schnauzer Miniatura', predisposicion: 'Pancreatitis, urolitiasis, hiperlipidemia' },
    { nombre: 'Cocker Spaniel', predisposicion: 'Otitis, enfermedades oculares, seborrea' },
    { nombre: 'Gran Danés', predisposicion: 'Dilatación-vólvulo gástrico, cardiomiopatía dilatada' },
    { nombre: 'Shih Tzu', predisposicion: 'Síndrome braquicefálico, problemas oculares' },
    { nombre: 'Border Collie', predisposicion: 'Anomalía del ojo del Collie, epilepsia' },
    { nombre: 'Doberman', predisposicion: 'Cardiomiopatía dilatada, enfermedad de von Willebrand' },
    { nombre: 'Otra (especificar)', predisposicion: '' },
  ];

  const RAZAS_FELINAS = [
    { nombre: 'Mestizo / Común europeo', predisposicion: '' },
    { nombre: 'Persa', predisposicion: 'Poliquistosis renal, braquicefalia, problemas oculares' },
    { nombre: 'Siamés', predisposicion: 'Amiloidosis, asma felino, estrabismo' },
    { nombre: 'Maine Coon', predisposicion: 'Cardiomiopatía hipertrófica, displasia de cadera' },
    { nombre: 'Ragdoll', predisposicion: 'Cardiomiopatía hipertrófica' },
    { nombre: 'Sphynx', predisposicion: 'Cardiomiopatía hipertrófica, problemas dermatológicos' },
    { nombre: 'British Shorthair', predisposicion: 'Cardiomiopatía hipertrófica, obesidad' },
    { nombre: 'Bengalí', predisposicion: 'Deficiencia de piruvato quinasa, PSMA' },
    { nombre: 'Otra (especificar)', predisposicion: '' },
  ];

  // ---------------------------------------------------------------------
  // Rangos de referencia de constantes vitales (semáforo clínico).
  // ---------------------------------------------------------------------
  const RANGOS_VITALES = {
    canino: {
      temperatura: { min: 38.0, max: 39.2, unidad: '°C' },
      fc: { min: 80, max: 120, unidad: 'lpm' },
      fr: { min: 10, max: 40, unidad: 'rpm' },
    },
    felino: {
      temperatura: { min: 38.0, max: 39.2, unidad: '°C' },
      fc: { min: 120, max: 140, unidad: 'lpm' },
      fr: { min: 20, max: 40, unidad: 'rpm' },
    },
  };

  /** Devuelve 'normal' | 'alerta' | 'vacio' según el valor y el rango de referencia. */
  function evaluarConstante(valor, rango) {
    if (valor === '' || valor == null || isNaN(valor)) return 'vacio';
    const v = parseFloat(valor);
    if (v < rango.min || v > rango.max) return 'alerta';
    return 'normal';
  }

  // ---------------------------------------------------------------------
  // Plan sanitario: vacunas de cátedra.
  // ---------------------------------------------------------------------
  const VACUNAS_BASE = [
    'Parvovirus',
    'Parvo corona',
    'Triple felina',
    'Antirrábica',
    'Leptospirosis',
    'Quíntuple',
    'Séxtuple',
    'Otras (tos de las perreras, leucemia felina, etc.)',
  ];

  function nuevaVacunaEntry(nombre) {
    return { nombre, aplicada: false, fecha: '', lote: '' };
  }

  const OPCIONES_ULTIMA_DESPARASITACION = [
    'Dentro de los últimos 30 días',
    'Dentro de los últimos 3 meses',
    'Dentro del último año',
    'Más de un año o nunca',
  ];

  // ---------------------------------------------------------------------
  // Anamnesis: asistente semiológico rápido (pares de desambiguación).
  // ---------------------------------------------------------------------
  const PARES_SEMIOLOGICOS = [
    { a: 'Tos', b: 'Estornudo inverso' },
    { a: 'Vómito', b: 'Regurgitación' },
    { a: 'Síncope', b: 'Convulsión' },
    { a: 'Prurito', b: 'No prurito' },
    { a: 'Tenesmo rectal', b: 'Obstrucción uretral' },
  ];

  // ---------------------------------------------------------------------
  // Exploración clínica particular (EOP) — 8 sistemas de cátedra.
  // ---------------------------------------------------------------------
  const SISTEMAS_EOP = [
    { key: 'piel', label: 'Piel y mucosas', hint: 'Lesiones elementales, alopecia simétrica, ectoparásitos, olor' },
    { key: 'nervioso', label: 'Sistema Nervioso', hint: 'Actitud, pares craneanos, reflejos medulares, marcha/ataxia' },
    { key: 'locomotor', label: 'Aparato Locomotor', hint: 'Palpación de columna, claudicaciones (grado 1-4), cajón/Ortolani' },
    { key: 'digestivo', label: 'Aparato Digestivo', hint: 'Cavidad oral/sarro, palpación abdominal, borborigmos' },
    { key: 'cardiorespiratorio', label: 'Aparato Cardiorrespiratorio', hint: 'Patrón toraco-abdominal, auscultación, soplos, rales/sibilancias, tos' },
    { key: 'endocrino', label: 'Sistema Endocrino', hint: 'Condición corporal (1-9 WSAVA), PU-PD, manto' },
    { key: 'urogenital', label: 'Aparato Urogenital', hint: 'Vejiga, riñones, secreciones, testículos/próstata/mamas' },
    { key: 'sangre', label: 'Sangre', hint: 'Diátesis hemorrágica: petequias, equimosis, hematomas' },
  ];

  const GANGLIOS = [
    'submandibulares', 'preescapulares', 'axilares', 'inguinales_supramamarios', 'poplíteos',
  ];
  const GANGLIOS_LABEL = {
    submandibulares: 'Submandibulares', preescapulares: 'Preescapulares', axilares: 'Axilares',
    inguinales_supramamarios: 'Inguinales / supramamarios', poplíteos: 'Poplíteos',
  };

  // ---------------------------------------------------------------------
  // Métodos complementarios de diagnóstico.
  // ---------------------------------------------------------------------
  const METODOS_COMPLEMENTARIOS = [
    'Análisis hematológicos (hemograma, serie roja, serie blanca, plaquetas, frotis)',
    'Análisis de orina (físico, químico y sedimento urinario)',
    'Análisis coproparasitológicos (flotación/sedimentación, FFD)',
    'Raspaje de piel (superficial/profundo, búsqueda de ácaros)',
    'Citología (PAAF, frotis, improntas, PAF ganglionar)',
    'Radiografía (tórax, abdomen, óseo)',
    'Ecografía (A-FAST, T-FAST, abdominal completa, ecocardiograma)',
    'Tomografía (TAC / resonancia magnética)',
    'Cultivos (antibiograma, micológico, bacteriológico)',
    'Otros (bioquímica clínica, tests rápidos VIF/VILeF/Parvo, hormonales)',
  ];

  function nuevoMetodoEntry(tipo) {
    return { tipo, solicitado: false, fecha: '', resultado: '', archivos: [] };
  }

  const CLASIFICACION_DIAGNOSTICO_DEFINITIVO = [
    'Sintomático', 'Anatómico', 'De síndrome', 'Nosológico', 'Etiológico',
  ];

  // ---------------------------------------------------------------------
  // Recordatorios / próximas citas (se pueden agendar en Google Calendar).
  // ---------------------------------------------------------------------
  const TIPOS_RECORDATORIO = ['Vacunación', 'Desparasitación', 'Visita de control', 'Otro'];

  function nuevoRecordatorio() {
    return {
      id: Utils.uuid(), tipo: 'Vacunación', fecha: '', hora: '', notas: '',
      googleEventId: '', googleEventLink: '',
    };
  }

  // ---------------------------------------------------------------------
  // Factories de objetos por defecto.
  // ---------------------------------------------------------------------
  function nuevoPaciente() {
    const now = new Date().toISOString();
    return {
      id: Utils.generarHCId(),
      createdAt: now,
      updatedAt: now,
      tutor: { nombre: '', telefono: '', dni: '', domicilio: '', localidad: '' },
      paciente: {
        nombre: '', especie: 'canino', raza: '', razaOtra: '', fechaNacimiento: '',
        sexo: 'M', estadoReproductivo: 'entero', edadEsterilizacion: '',
        pelajeTipo: '', pelajeColor: '',
      },
      entorno: {
        conviveOtros: false, nCaninos: 0, nFelinos: 0, otrosDesc: '',
        alimentacionTipo: 'Balanceado', alimentacionFrecuencia: '',
        habitat: 'Dentro de la casa', vagabundea: false, vagabundeaFrecuencia: '',
      },
      planSanitario: {
        desparasitacionUltimaFecha: '', desparasitacionProducto: '',
        vacunas: VACUNAS_BASE.map(nuevaVacunaEntry),
        certificadoVeterinario: false,
      },
    };
  }

  function nuevaFicha(patientId) {
    const now = new Date().toISOString();
    return {
      id: Utils.uuid(),
      patientId,
      status: 'borrador',
      createdAt: now,
      updatedAt: now,
      fechaAtencion: Utils.todayISO(),
      peso: '',
      anamnesis: { motivoConsulta: '', otrosDatos: '' },
      eog: {
        estadoGeneral: '', sensorio: '', hidratacionPorcentaje: '',
        temperatura: '', fc: '', fr: '',
        mucosas: '', tllc: '',
        ganglios: Object.fromEntries(GANGLIOS.map(g => [g, { alterado: false, desc: '' }])),
      },
      eop: Object.fromEntries(SISTEMAS_EOP.map(s => [s.key, { estado: 'normal', desc: '' }])),
      diagnostico: {
        presuntivo: '', diferenciales: '',
        metodosComplementarios: METODOS_COMPLEMENTARIOS.map(nuevoMetodoEntry),
        definitivo: '', clasificacionDefinitivo: '', pronostico: '',
      },
      tratamiento: {
        indicacionesInmediatas: '',
        prescripciones: [],
      },
      recordatorios: [],
    };
  }

  function nuevaPrescripcion() {
    return { principioActivo: '', dosisMgKg: '', concentracionMgMl: '', volumenMl: '', intervalo: '', duracionDias: '' };
  }

  return {
    RAZAS_CANINAS, RAZAS_FELINAS, RANGOS_VITALES, evaluarConstante,
    VACUNAS_BASE, nuevaVacunaEntry, OPCIONES_ULTIMA_DESPARASITACION,
    PARES_SEMIOLOGICOS, SISTEMAS_EOP, GANGLIOS, GANGLIOS_LABEL,
    METODOS_COMPLEMENTARIOS, nuevoMetodoEntry, CLASIFICACION_DIAGNOSTICO_DEFINITIVO,
    TIPOS_RECORDATORIO, nuevoRecordatorio,
    nuevoPaciente, nuevaFicha, nuevaPrescripcion,
  };
})();
