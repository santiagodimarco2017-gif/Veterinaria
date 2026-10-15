/*
 * Base de datos de fármacos.
 *
 * Cada fármaco tiene una lista de "presets" (indicaciones). Campos de un preset:
 *   l    etiqueta / indicación
 *   sp   especie: 'p' perro, 'g' gato, 'pg' ambos
 *   d    [mín, máx] de la dosis (iguales si es dosis única)
 *   u    unidad de dosis: '<cantidad>/<por>[/<tiempo>]'
 *          cantidad: ng, µg, mg, g, UI, ml
 *          por:      kg, animal, m2, 100UI (por cada 100 UI de heparina)
 *          tiempo:   min, h, día (solo para infusiones o dosis diarias)
 *   f    frecuencia            v    vía
 *   n    nota                  src  'PDF' si proviene del vademécum de la Unidad
 *   cri  true si es infusión continua
 *   tomas  número de tomas en que se divide una dosis diaria
 *   max  dosis total máxima (en la unidad de cantidad), por toma o por día si hay tomas
 *   tiers  dosis fija según peso: [{hasta: kg, dosis}]
 *   conc   concentración sugerida para precargar: {a, au, ml} o {pct}
 *
 * Campos del fármaco: info {tipo, clase (riesgo en gestación, Papich), prec[], pres}
 * y contra {p|g: texto} para contraindicaciones por especie.
 */
const GROUPS = [
  { id: 'atb', name: 'Antimicrobianos y antiparasitarios' },
  { id: 'ana', name: 'Analgesia, sedación, anestesia y anticonvulsivantes' },
  { id: 'gi', name: 'Gastrointestinales y hepatoprotectores' },
  { id: 'car', name: 'Cardiorrespiratorio, renal y coagulación' },
  { id: 'end', name: 'Corticoides, inmunosupresores y endocrinología' },
  { id: 'tox', name: 'Toxicología y emergencias' },
];

const DRUGS = [
  // ───────────── 1. Antimicrobianos y antiparasitarios ─────────────
  // Antibióticos: Doti FJ, "Uso práctico de los antibióticos en la clínica de
  // pequeños animales", Inter-Médica 2009 (prospectos y tablas 4.3, 4.4 y 4.5).
  // src 'Doti' = libro; src 'PDF' = protocolo de la Unidad; sin src = listado inicial.
  { id: 'amikacina', name: 'Amikacina', g: 'atb', info: {
      tipo: 'Aminoglucósido. Bactericida concentración-dependiente: ideal 1 sola aplicación diaria.', clase: 'C',
      prec: ['Extrema cautela en enfermedad renal; asegurar hidratación.', 'Ototoxicidad irreversible (prudencia en perros de trabajo); gatos muy sensibles a efectos vestibulares.', 'Riesgo en neonatos y geriátricos.', 'No mezclar con betalactámicos en la misma jeringa o bolsa.'],
      pres: 'Inyectable 50 mg/ml.' }, conc: { a: 50, au: 'mg', ml: 1 }, p: [
    { l: 'Dosis general', sp: 'p', d: [15, 30], u: 'mg/kg', f: 'c/24 h', v: 'EV, IM, SC', src: 'Doti' },
    { l: 'Sepsis', sp: 'pg', d: [20, 20], u: 'mg/kg', f: 'c/24 h', v: 'EV', src: 'Doti' },
    { l: 'Dosis general', sp: 'g', d: [10, 15], u: 'mg/kg', f: 'c/24 h', v: 'EV, IM, SC', src: 'Doti' },
    { l: 'Inmunodeprimidos', sp: 'pg', d: [15, 15], u: 'mg/kg/día', tomas: 3, f: 'dividido c/8 h', v: 'EV, IM, SC', src: 'Doti' },
    { l: 'Protocolo Unidad', sp: 'pg', d: [20, 20], u: 'mg/kg', f: 'c/24 h', v: 'EV', src: 'PDF' },
  ]},
  { id: 'gentamicina', name: 'Gentamicina', g: 'atb', info: {
      tipo: 'Aminoglucósido. Bactericida concentración-dependiente; gramnegativos aerobios, sin acción sobre anaerobios.', clase: 'C',
      prec: ['Nefrotóxica y ototóxica: contraindicada en insuficiencia renal grave.', 'Efectos vestibulares sobre todo en gatos.', 'No se absorbe por vía oral.', 'Incompatible en la misma solución con ampicilina, clindamicina, metronidazol, penicilina G sódica, anfotericina B.'],
      pres: 'Gentamicina sulfato inyectable.' }, p: [
    { l: 'Dosis diaria única', sp: 'pg', d: [6, 8], u: 'mg/kg', f: 'c/24 h (neutropénicos c/8-12 h)', v: 'IM, SC', src: 'Doti' },
    { l: 'Sepsis', sp: 'pg', d: [6, 6], u: 'mg/kg', f: 'c/24 h', v: 'EV', src: 'Doti' },
    { l: 'Dosis fraccionada', sp: 'pg', d: [2, 4], u: 'mg/kg', f: 'c/8 h', v: 'EV, IM, SC', src: 'Doti' },
  ]},
  { id: 'amoxicilina', name: 'Amoxicilina', g: 'atb', info: {
      tipo: 'Penicilina. Bactericida tiempo-dependiente. Se puede dar con las comidas.', clase: 'A',
      prec: ['No combinar con bacteriostáticos.', 'Hipersensibilidad a penicilinas.'] }, p: [
    { l: 'Dosis general', sp: 'pg', d: [10, 20], u: 'mg/kg', f: 'c/8-12 h', v: 'PO, EV, IM, SC', src: 'Doti' },
    { l: 'Grampositivos', sp: 'pg', d: [10, 10], u: 'mg/kg', f: 'c/12 h', v: 'PO, IM, SC', src: 'Doti' },
    { l: 'Gramnegativos', sp: 'pg', d: [20, 20], u: 'mg/kg', f: 'c/8 h PO; c/12 h IM, SC', v: 'PO, IM, SC', src: 'Doti' },
    { l: 'Infecciones urinarias', sp: 'p', d: [10, 20], u: 'mg/kg', f: 'c/12 h, 5-7 días', v: 'PO', src: 'Doti' },
    { l: 'Infecciones sistémicas', sp: 'p', d: [22, 50], u: 'mg/kg', f: 'c/8 h, 7 días', v: 'PO', src: 'Doti' },
    { l: 'Infecciones ortopédicas', sp: 'p', d: [22, 30], u: 'mg/kg', f: 'c/6-8 h, 7-10 días', v: 'EV, IM, SC, PO', src: 'Doti' },
    { l: 'Enfermedad de Lyme', sp: 'p', d: [22, 22], u: 'mg/kg', f: 'c/12 h, 21-28 días', v: 'PO', src: 'Doti' },
    { l: 'Urinarias y tejidos blandos', sp: 'g', d: [11, 22], u: 'mg/kg', f: 'c/24 h, 5-7 días', v: 'PO', src: 'Doti', n: 'Alternativa: 50 mg por gato c/24 h.' },
    { l: 'Sepsis', sp: 'g', d: [10, 20], u: 'mg/kg', f: 'c/12 h', v: 'PO, EV, IM, SC', src: 'Doti' },
    { l: 'Clostridium perfringens (GI)', sp: 'g', d: [22, 22], u: 'mg/kg', f: 'c/24 h, 5 días', v: 'PO', src: 'Doti' },
    { l: 'Helicobacter (terapia triple)', sp: 'g', d: [20, 20], u: 'mg/kg', f: 'c/12 h, 14 días', v: 'PO', src: 'Doti', n: 'Junto con metronidazol 10-15 mg/kg c/12 h y claritromicina 7,5 mg/kg c/12 h.' },
  ]},
  { id: 'amoxiclav', name: 'Amoxicilina + Ác. clavulánico', g: 'atb', info: {
      tipo: 'Penicilina + inhibidor de betalactamasas. Bactericida tiempo-dependiente.', clase: 'A',
      prec: ['Dosis expresada como combinación: sumar amoxicilina + clavulánico de la presentación (ej. comprimido 250 + 62,5 mg = 312,5 mg; suspensión 250 + 62,5 mg en 5 ml = 312,5 mg en 5 ml).'],
      pres: 'Comprimidos 200/50, 250/50 y 500/100 mg. Suspensiones 125/31,25; 200/28,5; 250/62,5 y 400/57 mg cada 5 ml.' }, p: [
    { l: 'Urinarias y piel / tejidos blandos', sp: 'p', d: [12.5, 13.75], u: 'mg/kg', f: 'c/12 h, 5-7 días (hasta 30)', v: 'PO', src: 'Doti' },
    { l: 'Piodermia profunda', sp: 'p', d: [12.5, 25], u: 'mg/kg', f: 'c/12 h, 3-6 semanas', v: 'PO', src: 'Doti' },
    { l: 'Septicemia', sp: 'p', d: [22, 22], u: 'mg/kg', f: 'c/8-12 h, 7 días', v: 'PO', src: 'Doti' },
    { l: 'Dosis fija por gato (urinarias, piel)', sp: 'g', d: [62.5, 62.5], u: 'mg/animal', f: 'c/12 h, 10-30 días', v: 'PO', src: 'Doti' },
    { l: 'Piel y tejidos blandos', sp: 'g', d: [10, 20], u: 'mg/kg', f: 'c/12 h, 5-7 días', v: 'PO', src: 'Doti' },
    { l: 'Septicemia y neumonía', sp: 'g', d: [10, 20], u: 'mg/kg', f: 'c/8 h, 7-10 días', v: 'PO', src: 'Doti' },
    { l: 'Protocolo Unidad', sp: 'pg', d: [20, 25], u: 'mg/kg', f: 'c/12 h', v: 'oral / s.c.', src: 'PDF' },
  ]},
  { id: 'ampicilina', name: 'Ampicilina / Ampicilina-Sulbactam', g: 'atb', info: {
      tipo: 'Penicilina. Bactericida tiempo-dependiente. Por vía oral se absorbe peor que la amoxicilina y el alimento reduce su absorción.', clase: 'A',
      prec: ['La ampicilina sódica aporta mucho sodio: cuidado en renales e hipertensos.', 'Incompatible en la misma solución con aminoglucósidos y lincomicina.'] }, p: [
    { l: 'Grampositivos (oral)', sp: 'pg', d: [10, 20], u: 'mg/kg', f: 'c/12 h', v: 'PO', src: 'Doti' },
    { l: 'Grampositivos (parenteral)', sp: 'pg', d: [5, 5], u: 'mg/kg', f: 'c/8 h', v: 'IM, SC, EV', src: 'Doti' },
    { l: 'Gramnegativos (oral)', sp: 'pg', d: [20, 30], u: 'mg/kg', f: 'c/8 h', v: 'PO', src: 'Doti' },
    { l: 'Gramnegativos (EV)', sp: 'pg', d: [10, 10], u: 'mg/kg', f: 'c/6 h (IM, SC c/8 h)', v: 'EV, IM, SC', src: 'Doti' },
    { l: 'Bacteriemia / septicemia', sp: 'pg', d: [20, 40], u: 'mg/kg', f: 'c/6-8 h', v: 'EV', src: 'Doti' },
    { l: 'Neumonía', sp: 'p', d: [22, 22], u: 'mg/kg', f: 'c/8 h, 7-14 días', v: 'PO, EV, SC', src: 'Doti' },
    { l: 'Óseas o meningitis', sp: 'p', d: [22, 22], u: 'mg/kg', f: 'c/6-8 h', v: 'EV, IM, SC', src: 'Doti' },
    { l: 'Sepsis neonatal', sp: 'p', d: [50, 50], u: 'mg/kg', f: 'c/4-6 h', v: 'EV', src: 'Doti' },
    { l: 'Infecciones urinarias', sp: 'g', d: [20, 20], u: 'mg/kg', f: 'c/8-12 h, 7-14 días', v: 'PO', src: 'Doti' },
    { l: 'Tejidos blandos', sp: 'g', d: [20, 40], u: 'mg/kg', f: 'c/8-12 h, 14 días', v: 'PO', src: 'Doti' },
    { l: 'Protocolo Unidad', sp: 'pg', d: [20, 25], u: 'mg/kg', f: 'c/12 h', v: 'EV', src: 'PDF' },
  ]},
  { id: 'penicilinag', name: 'Penicilina G (procaínica, sódica, benzatínica)', g: 'atb', info: {
      tipo: 'Betalactámico. Bactericida tiempo-dependiente; grampositivos, anaerobios grampositivos y espiroquetas. Mala absorción oral. Procaínica: acción ~12 h; benzatínica: ~72 h.', clase: 'A',
      prec: ['Hipersensibilidad: más frecuente que con otros antibióticos.', 'Dosis muy elevadas: ataxia en perros.'],
      pres: 'Procaínica 10 o 20 millones UI por frasco; asociada a benzatínica 2,5 a 20 millones UI.' }, p: [
    { l: 'Procaínica', sp: 'pg', d: [20000, 24000], u: 'UI/kg', f: 'c/12-24 h (infecciones graves c/12 h)', v: 'IM, SC', src: 'Doti', n: 'Se puede aumentar hasta 80.000 UI/kg/día.' },
    { l: 'Sódica', sp: 'pg', d: [20000, 40000], u: 'UI/kg', f: 'c/4-6 h', v: 'EV, IM, SC', src: 'Doti' },
    { l: 'Benzatínica', sp: 'pg', d: [40000, 40000], u: 'UI/kg', f: 'c/72-120 h', v: 'IM', src: 'Doti' },
    { l: 'Leptospirosis (antes de doxiciclina)', sp: 'p', d: [25000, 40000], u: 'UI/kg', f: 'c/12 h, 14 días', v: 'IM', src: 'Doti', n: 'Luego doxiciclina 5-10 mg/kg c/12 h, 14 días (estado portador renal).' },
  ]},
  { id: 'cefalexina', name: 'Cefalexina', g: 'atb', info: {
      tipo: 'Cefalosporina de 1ª generación. Bactericida tiempo-dependiente. El alimento casi no influye; con comida reduce las molestias digestivas.', clase: 'B',
      prec: ['Reportada necrólisis epidérmica tóxica en felinos.'] }, p: [
    { l: 'Dosis general', sp: 'pg', d: [20, 30], u: 'mg/kg', f: 'c/8-12 h', v: 'PO', src: 'Doti' },
    { l: 'Piodermia', sp: 'p', d: [22, 35], u: 'mg/kg', f: 'c/12 h', v: 'PO', src: 'Doti' },
    { l: 'Respiratorias', sp: 'p', d: [20, 40], u: 'mg/kg', f: 'c/8 h', v: 'PO', src: 'Doti' },
    { l: 'Tejidos blandos', sp: 'p', d: [30, 50], u: 'mg/kg', f: 'c/12 h', v: 'PO', src: 'Doti' },
    { l: 'Sistémicas', sp: 'p', d: [25, 60], u: 'mg/kg', f: 'c/8 h', v: 'PO', src: 'Doti' },
    { l: 'Óseas', sp: 'p', d: [22, 30], u: 'mg/kg', f: 'c/6-8 h, 28 días', v: 'PO', src: 'Doti' },
    { l: 'Urinarias', sp: 'p', d: [30, 40], u: 'mg/kg', f: 'c/8 h', v: 'PO', src: 'Doti' },
    { l: 'Piómetra / metritis', sp: 'p', d: [10, 30], u: 'mg/kg', f: 'c/8-12 h', v: 'PO', src: 'Doti' },
    { l: 'Dosis con alimento', sp: 'g', d: [22, 22], u: 'mg/kg', f: 'c/8 h', v: 'PO', src: 'Doti' },
    { l: 'Protocolo Unidad', sp: 'pg', d: [20, 25], u: 'mg/kg', f: 'c/12 h', v: 'oral', src: 'PDF' },
  ]},
  { id: 'cefadroxil', name: 'Cefadroxilo', g: 'atb', info: {
      tipo: 'Cefalosporina de 1ª generación. Se absorbe bien aun con alimento (darlo con las comidas).', clase: 'B' }, p: [
    { l: 'Dosis general', sp: 'p', d: [22, 22], u: 'mg/kg', f: 'c/12 h (máx. 30 días)', v: 'PO', src: 'Doti' },
    { l: 'Piodermia', sp: 'pg', d: [22, 35], u: 'mg/kg', f: 'c/12 h, 3-30 días', v: 'PO', src: 'Doti' },
    { l: 'Urinarias', sp: 'p', d: [11, 22], u: 'mg/kg', f: 'c/12 h, 7-30 días', v: 'PO', src: 'Doti' },
    { l: 'Sistémicas y óseas', sp: 'pg', d: [22, 22], u: 'mg/kg', f: 'c/8-12 h, 30 días', v: 'PO', src: 'Doti' },
    { l: 'Dosis general', sp: 'g', d: [22, 22], u: 'mg/kg', f: 'c/24 h', v: 'PO', src: 'Doti' },
    { l: 'Urinarias', sp: 'g', d: [22, 22], u: 'mg/kg', f: 'c/12 h, 21 días', v: 'PO', src: 'Doti' },
  ]},
  { id: 'cefalotina', name: 'Cefalotina', g: 'atb', info: {
      tipo: 'Cefalosporina de 1ª generación, solo parenteral (preferir EV).', clase: 'B',
      prec: ['Nefrotóxica a dosis excesivas; se potencia con aminoglucósidos.'] }, p: [
    { l: 'Grampositivos', sp: 'pg', d: [20, 20], u: 'mg/kg', f: 'c/12 h', v: 'IM, SC', src: 'Doti' },
    { l: 'Gramnegativos', sp: 'pg', d: [40, 40], u: 'mg/kg', f: 'c/8 h', v: 'IM, SC', src: 'Doti' },
    { l: 'Endovenosa', sp: 'pg', d: [10, 30], u: 'mg/kg', f: 'c/4-8 h (gato c/8 h)', v: 'EV', src: 'Doti' },
  ]},
  { id: 'cefazolina', name: 'Cefazolina', g: 'atb', p: [
    { l: 'Protocolo Unidad', sp: 'pg', d: [20, 25], u: 'mg/kg', f: 'c/8 h', v: 'EV', src: 'PDF' },
  ]},
  { id: 'ceftriaxona', name: 'Ceftriaxona', g: 'atb', p: [
    { l: 'Protocolo Unidad', sp: 'pg', d: [20, 25], u: 'mg/kg', f: 'c/12 h', v: 'EV', src: 'PDF' },
  ]},
  { id: 'ceftiofur', name: 'Ceftiofur', g: 'atb', info: { tipo: 'Cefalosporina de 3ª generación.' }, p: [
    { l: 'Infecciones urinarias', sp: 'pg', d: [2.2, 2.2], u: 'mg/kg', f: 'c/24 h, 5-14 días', v: 'SC', src: 'Doti' },
    { l: 'Sistémicas y tejidos blandos', sp: 'pg', d: [2.2, 2.2], u: 'mg/kg', f: 'c/12 h (o 4,4 mg/kg c/24 h), 5-14 días', v: 'SC', src: 'Doti' },
    { l: 'Sepsis / bacteriemia', sp: 'pg', d: [4.4, 4.4], u: 'mg/kg', f: 'c/12 h, 2-5 días', v: 'SC', src: 'Doti' },
    { l: 'Septicemia neonatal', sp: 'p', d: [2.5, 2.5], u: 'mg/kg', f: 'c/12 h, hasta 5 días', v: 'SC', src: 'Doti' },
  ]},
  { id: 'imipenem', name: 'Imipenem-Cilastatina', g: 'atb', info: {
      tipo: 'Carbapenem. El espectro más amplio conocido; reservar para infecciones graves con riesgo de vida (ideal en osteomielitis complicadas).', clase: 'C',
      prec: ['Contraindicado en alérgicos a penicilinas.', 'Ajustar dosis e intervalos en falla renal.', 'EV rápido: tromboflebitis; descritas convulsiones y temblores.'],
      pres: 'Polvo 250 mg/250 mg para EV y SC.' }, p: [
    { l: 'Dosis general', sp: 'pg', d: [5, 10], u: 'mg/kg', f: 'c/8 h', v: 'EV, IM', src: 'Doti' },
    { l: 'Sepsis / bacteriemia', sp: 'pg', d: [2, 7.5], u: 'mg/kg', f: 'c/8 h, 3-5 días', v: 'EV, IM', src: 'Doti' },
    { l: 'Microorganismos resistentes', sp: 'pg', d: [3, 10], u: 'mg/kg', f: 'c/6-8 h, 3-5 días', v: 'EV', src: 'Doti' },
  ]},
  { id: 'doxiciclina', name: 'Doxiciclina', g: 'atb', info: {
      tipo: 'Tetraciclina liposoluble. Bacteriostático tiempo-dependiente; elección en rickettsias y clamidias. Puede darse con alimento (reduce vómitos).', clase: 'D',
      prec: ['Contraindicada en la 2ª mitad de la gestación y en la lactancia.', 'Gatos: estenosis esofágica; dar agua inmediatamente después del comprimido.', 'Antiácidos, calcio, hierro: darla 3 h antes o 2 h después.', 'Evitar en animales jóvenes y con insuficiencia hepática.'] }, p: [
    { l: 'Dosis general', sp: 'pg', d: [5, 10], u: 'mg/kg', f: 'c/12 h, 7-14 días', v: 'PO', src: 'Doti' },
    { l: 'Ehrlichiosis canina', sp: 'p', d: [5, 10], u: 'mg/kg', f: 'c/12 h, 7 días', v: 'PO', src: 'Doti' },
    { l: 'Enfermedad de Lyme', sp: 'p', d: [10, 10], u: 'mg/kg', f: 'c/24 h, 28 días', v: 'PO', src: 'Doti' },
    { l: 'Leptospirosis (portador renal)', sp: 'p', d: [5, 10], u: 'mg/kg', f: 'c/12 h, 14 días', v: 'PO', src: 'Doti', n: 'Después de 14 días de penicilina G 25.000-40.000 UI/kg c/12 h IM.' },
    { l: 'Hemobartonelosis felina', sp: 'g', d: [5, 10], u: 'mg/kg', f: 'c/12 h, 7 días', v: 'PO', src: 'Doti' },
    { l: 'Bartonelosis', sp: 'g', d: [50, 50], u: 'mg/animal', f: 'c/12 h, 28 días', v: 'PO', src: 'Doti' },
    { l: 'Sistémicas / bacteriemia', sp: 'g', d: [5, 10], u: 'mg/kg', f: 'c/12 h', v: 'PO, EV', src: 'Doti' },
    { l: 'Protocolo Unidad', sp: 'pg', d: [5, 10], u: 'mg/kg', f: 'c/12-24 h', v: '', src: 'PDF' },
  ]},
  { id: 'tetraciclina', name: 'Tetraciclina', g: 'atb', info: {
      tipo: 'Tetraciclina. Bacteriostático tiempo-dependiente. Dar lejos de las comidas y de los lácteos.', clase: 'D',
      prec: ['Contraindicada en gestación; decolora los dientes en cachorros.', 'Precaución en falla renal y hepática.'],
      pres: 'Comprimidos 100, 250 y 500 mg; suspensión 25 y 100 mg/ml.' }, p: [
    { l: 'Dosis general', sp: 'pg', d: [20, 20], u: 'mg/kg', f: 'c/8 h', v: 'PO', src: 'Doti' },
    { l: 'Parenteral', sp: 'pg', d: [7, 7], u: 'mg/kg', f: 'c/12 h', v: 'EV, IM', src: 'Doti' },
    { l: 'Ehrlichiosis', sp: 'p', d: [22, 22], u: 'mg/kg', f: 'c/8 h, 10-14 días', v: 'PO', src: 'Doti' },
    { l: 'Brucelosis', sp: 'p', d: [10, 20], u: 'mg/kg', f: 'c/8 h, 28 días', v: 'PO', src: 'Doti' },
    { l: 'Rickettsiales', sp: 'g', d: [16, 16], u: 'mg/kg', f: 'c/8 h, 21 días', v: 'PO', src: 'Doti' },
  ]},
  { id: 'enrofloxacino', name: 'Enrofloxacina', g: 'atb', info: {
      tipo: 'Fluoroquinolona. Bactericida concentración-dependiente; gramnegativos, grampositivos, Mycoplasma, Ehrlichia. Sin acción sobre anaerobios.',
      prec: ['Contraindicada en cachorros de 2 a 8 meses y en razas grandes de crecimiento rápido (cartílago).', 'Precaución en epilépticos (estimulación del SNC).', 'Gatos: fluoroquinolonas y retina; no superar 5 mg/kg/día.', 'Antiácidos y sucralfato reducen la absorción. No usar con teofilina.', 'Gestantes: hasta 15 mg/kg sin trastornos en las crías.'],
      pres: 'Comprimidos; inyectable al 5% (50 mg/ml) y al 10% (100 mg/ml).' }, conc: { a: 50, au: 'mg', ml: 1 }, p: [
    { l: 'Dosis general', sp: 'p', d: [5, 20], u: 'mg/kg', f: 'c/12-24 h (mín. 3, máx. 28 días)', v: 'PO', src: 'Doti' },
    { l: 'Oral o IM', sp: 'p', d: [2.5, 10], u: 'mg/kg', f: 'c/12-24 h', v: 'PO, IM', src: 'Doti' },
    { l: 'Dosis general', sp: 'g', d: [5, 5], u: 'mg/kg', f: 'c/24 h (mín. 3, máx. 28 días)', v: 'PO, IM', src: 'Doti', n: '⚠ No superar 5 mg/kg/día en gatos (riesgo de degeneración retiniana).' },
    { l: 'Protocolo Unidad', sp: 'pg', d: [5, 5], u: 'mg/kg', f: '', v: 'EV / SC', src: 'PDF' },
  ]},
  { id: 'marbofloxacina', name: 'Marbofloxacina', g: 'atb', info: {
      tipo: 'Fluoroquinolona. Bactericida concentración-dependiente. Dar en ayunas (evitar alimento y cationes).',
      prec: ['Contraindicada en crecimiento: razas pequeñas y medianas < 8 meses, grandes < 12 meses, gigantes < 18 meses; gatos < 12 meses.', 'Precaución en trastornos del SNC.', 'Gatos: fluoroquinolonas y retina.'] }, p: [
    { l: 'Dosis general', sp: 'pg', d: [2.75, 5.5], u: 'mg/kg', f: 'c/24 h', v: 'PO', src: 'Doti', n: 'Piel: hasta 3 días después de los signos (máx. 30 días). Urinarias: al menos 10 días.' },
  ]},
  { id: 'orbifloxacina', name: 'Orbifloxacina', g: 'atb', info: {
      tipo: 'Fluoroquinolona. Bactericida concentración-dependiente.',
      prec: ['Cartílago: usar después de los 8 meses (razas pequeñas y medianas) o 18 meses (grandes y gigantes).', 'Precaución en epilépticos.'],
      pres: 'Comprimidos 5,7; 22,7 y 68 mg.' }, p: [
    { l: 'Dosis general', sp: 'pg', d: [2.5, 7.5], u: 'mg/kg', f: 'c/24 h (hasta 3 días tras los signos, máx. 30)', v: 'PO', src: 'Doti' },
  ]},
  { id: 'difloxacina', name: 'Difloxacina', g: 'atb', contra: { g: 'No indicada en gatos (náuseas y vómitos).' }, info: {
      tipo: 'Fluoroquinolona. Excreción principalmente por heces: útil en falla renal.',
      prec: ['Cartílago: después de los 8 meses (pequeñas/medianas) o 18 meses (grandes/gigantes).', 'Precaución en epilépticos.'],
      pres: 'Comprimidos 11,4; 45,4 y 136 mg.' }, p: [
    { l: 'Dosis general', sp: 'p', d: [5, 10], u: 'mg/kg', f: 'c/24 h (hasta 3 días tras los signos, máx. 30)', v: 'PO', src: 'Doti' },
  ]},
  { id: 'clindamicina', name: 'Clindamicina', g: 'atb', info: {
      tipo: 'Lincosamida. Bacteriostático; anaerobios, grampositivos, Toxoplasma, Neospora.', clase: 'A',
      prec: ['Precaución en falla hepática.', 'Puede causar gastroenteritis.'] }, p: [
    { l: 'Heridas, abscesos, dentales', sp: 'pg', d: [5, 11], u: 'mg/kg', f: 'c/12 h, 7-28 días', v: 'PO, IM, SC', src: 'Doti' },
    { l: 'Piodermia estafilocócica', sp: 'p', d: [11, 11], u: 'mg/kg', f: 'c/24 h, 7-28 días', v: 'PO', src: 'Doti' },
    { l: 'Osteomielitis', sp: 'p', d: [11, 11], u: 'mg/kg', f: 'c/12 h, 28 días', v: 'PO', src: 'Doti' },
    { l: 'Sepsis', sp: 'pg', d: [11, 11], u: 'mg/kg', f: 'c/12 h', v: 'EV', src: 'Doti' },
    { l: 'Toxoplasmosis', sp: 'p', d: [12.5, 12.5], u: 'mg/kg', f: 'c/12 h, 28 días', v: 'PO', src: 'Doti' },
    { l: 'Toxoplasmosis sistémica', sp: 'g', d: [12.5, 25], u: 'mg/kg', f: 'c/12 h, 14-28 días', v: 'PO, SC', src: 'Doti' },
    { l: 'Neosporosis', sp: 'p', d: [10, 10], u: 'mg/kg', f: 'c/12 h, 30 días', v: 'PO', src: 'Doti', n: 'Asociada a TMS 15 mg/kg c/12 h, 28 días.' },
    { l: 'Hepatozoon canis', sp: 'p', d: [10, 10], u: 'mg/kg', f: 'c/8 h, 15-30 días', v: 'PO', src: 'Doti' },
    { l: 'Protocolo Unidad', sp: 'pg', d: [5.5, 11], u: 'mg/kg', f: 'c/12 h', v: 'EV / oral', src: 'PDF' },
  ]},
  { id: 'lincomicina', name: 'Lincomicina', g: 'atb', info: {
      tipo: 'Lincosamida. Bacteriostático; piel, dentales, periodontales y osteomielitis. El alimento reduce su absorción.', clase: 'A',
      prec: ['Vómitos, heces blandas y diarrea sanguinolenta en algunos perros.', 'Precaución en falla renal.'],
      pres: 'Comprimidos 100, 200, 500 mg; solución oral 50 mg/ml; inyectable 100 mg/ml.' }, p: [
    { l: 'Dosis oral', sp: 'pg', d: [22, 33], u: 'mg/kg', f: 'c/12 h', v: 'PO', src: 'Doti' },
    { l: 'Piodermia', sp: 'pg', d: [20, 20], u: 'mg/kg', f: 'c/12 h', v: 'PO', src: 'Doti' },
    { l: 'Oral o parenteral', sp: 'pg', d: [10, 20], u: 'mg/kg', f: 'c/8-12 h', v: 'PO, EV, IM', src: 'Doti' },
  ]},
  { id: 'eritromicina', name: 'Eritromicina', g: 'atb', info: {
      tipo: 'Macrólido. Bacteriostático; grampositivos. Alternativa en alérgicos a penicilinas; Staphylococcus intermedius en piel.', clase: 'A',
      prec: ['Incompatible con teofilina, warfarina, metilprednisolona, digoxina, carbamacepina, ciclosporina.', 'Precaución en falla hepática.'] }, p: [
    { l: 'Dosis general', sp: 'pg', d: [10, 20], u: 'mg/kg', f: 'c/8-12 h', v: 'PO', src: 'Doti' },
  ]},
  { id: 'azitromicina', name: 'Azitromicina', g: 'atb', info: {
      tipo: 'Macrólido de vida media muy larga (90 h en perros). Bacteriostático. Dar lejos de las comidas.',
      prec: ['Precaución en hepatopatías.', 'No usar con cisaprida; aumenta niveles de ciclosporina.', 'Antiácidos reducen su absorción.'] }, p: [
    { l: 'Dosis general', sp: 'pg', d: [5, 10], u: 'mg/kg', f: 'c/24 h, 3-5 días', v: 'PO', src: 'Doti' },
    { l: 'Esquema de 5 dosis', sp: 'pg', d: [5, 5], u: 'mg/kg', f: 'c/24 h 2 días, luego c/3-5 días (total 5 dosis)', v: 'PO', src: 'Doti' },
    { l: 'Piodermia', sp: 'p', d: [10, 10], u: 'mg/kg', f: 'c/24 h, 5-10 días', v: 'PO', src: 'Doti' },
    { l: 'Babesiosis (coadyuvante)', sp: 'p', d: [10, 10], u: 'mg/kg', f: 'c/24 h, 10 días', v: 'PO', src: 'Doti' },
    { l: 'Infecciones cutáneas', sp: 'pg', d: [7, 15], u: 'mg/kg', f: 'c/12 h, 5-7 días', v: 'PO', src: 'Doti' },
  ]},
  { id: 'tms', name: 'Trimetoprima-Sulfa (sulfas potenciadas)', g: 'atb', info: {
      tipo: 'Sulfadiacina o sulfametoxazol + trimetoprima. Bactericida tiempo-dependiente; aerobios, Nocardia, Toxoplasma, coccidios.', clase: 'B',
      prec: ['Dosis expresada como combinación: sumar ambos componentes (ej. comprimido 80/400 mg = 480 mg).', 'Perros: queratoconjuntivitis seca (a veces irreversible), hepatitis, anemia hemolítica, poliartritis. Gatos: anorexia, leucopenia, anemia.', 'Evitar o reducir en falla renal, gestantes y reproductores; precaución en falla hepática y neonatos.', 'Interacciones: warfarina, metotrexato, fenilbutazona, tiazidas, salicilatos, fenitoína; antiácidos reducen la absorción.'],
      pres: 'Comprimidos 5/25, 20/100, 80/400, 160/800 mg (TMP/sulfa); inyectable al 48%.' }, p: [
    { l: 'Infecciones en general', sp: 'pg', d: [15, 30], u: 'mg/kg', f: 'c/12-24 h', v: 'PO, IM, EV', src: 'Doti' },
    { l: 'Dosis estándar', sp: 'pg', d: [30, 30], u: 'mg/kg', f: 'c/12 h', v: 'PO, EV', src: 'Doti' },
    { l: 'Toxoplasmosis', sp: 'p', d: [15, 15], u: 'mg/kg', f: 'c/12 h, 28 días', v: 'PO', src: 'Doti' },
    { l: 'Neosporosis', sp: 'p', d: [15, 15], u: 'mg/kg', f: 'c/12 h, 4 semanas', v: 'PO', src: 'Doti' },
    { l: 'Hepatozoonosis', sp: 'p', d: [15, 15], u: 'mg/kg', f: 'c/12 h, 2-4 semanas', v: 'PO', src: 'Doti' },
    { l: 'Coccidiosis', sp: 'p', d: [30, 30], u: 'mg/kg', f: 'c/24 h, 10 días', v: 'PO', src: 'Doti' },
    { l: 'Nocardiosis', sp: 'g', d: [60, 60], u: 'mg/kg', f: 'c/12 h', v: 'PO, EV', src: 'Doti', n: 'Doble de la dosis estándar.' },
  ]},
  { id: 'metronidazol', name: 'Metronidazol', g: 'atb', info: {
      tipo: 'Nitroimidazol. Bactericida sobre anaerobios; Giardia, Trichomonas, Entamoeba. Dar con las comidas.', clase: 'C',
      prec: ['Contraindicado en gestación y lactancia.', 'Perros: trastornos neurológicos, letargia, neutropenia, hepatotoxicidad.', 'Precaución en falla hepática y neonatos.'],
      pres: 'Comprimidos 250 y 500 mg; inyectable 5 mg/ml (frasco de 100 ml); polvo 500 mg.' }, p: [
    { l: 'Giardiasis', sp: 'pg', d: [25, 25], u: 'mg/kg', f: 'c/12 h, 8 días', v: 'PO', src: 'Doti' },
    { l: 'Sepsis por anaerobios', sp: 'pg', d: [15, 15], u: 'mg/kg', f: 'c/12 h', v: 'EV', src: 'Doti' },
    { l: 'Gastroenteritis (inicio)', sp: 'pg', d: [15, 15], u: 'mg/kg', f: 'c/8 h hasta que cesen los vómitos', v: 'EV', src: 'Doti', n: 'Luego 7,5 mg/kg vía oral, 5-7 días.' },
    { l: 'Gastroenteritis (continuación)', sp: 'pg', d: [7.5, 7.5], u: 'mg/kg', f: 'c/8 h, 5-7 días', v: 'PO', src: 'Doti' },
    { l: 'Enfermedad intestinal inflamatoria', sp: 'pg', d: [10, 15], u: 'mg/kg', f: 'c/12 h, luego la mínima eficaz', v: 'PO', src: 'Doti' },
    { l: 'Protocolo Unidad', sp: 'pg', d: [10, 15], u: 'mg/kg', f: 'c/12 h', v: 'EV / oral', src: 'PDF' },
  ]},
  { id: 'cloranfenicol', name: 'Cloranfenicol', g: 'atb', info: {
      tipo: 'Fenicol. Bacteriostático de amplio espectro; buena penetración en LCR, ojo y próstata.', clase: 'C',
      prec: ['Contraindicado en insuficiencia hepática; precaución en anémicos (toxicidad hematopoyética).', 'Mucha prudencia en neonatos y especialmente gatitos; no en hembras lactantes los primeros 15 días.', 'Gatos más susceptibles a efectos adversos.', 'No usar con primidona, fenobarbital, pentobarbital ni ciclofosfamida (prolonga la anestesia).'],
      pres: 'Cápsulas; polvo para solución oral; succinato sódico inyectable.' }, p: [
    { l: 'Dosis general', sp: 'p', d: [40, 50], u: 'mg/kg', f: 'c/8 h', v: 'EV, IM, SC, PO', src: 'Doti' },
    { l: 'Rickettsias / tejidos blandos', sp: 'p', d: [25, 50], u: 'mg/kg', f: 'c/8 h, 7 días', v: 'PO', src: 'Doti' },
    { l: 'Infecciones sistémicas', sp: 'p', d: [50, 50], u: 'mg/kg', f: 'c/6-8 h, 3-5 días', v: 'PO, EV, IM, SC', src: 'Doti' },
    { l: 'Bacteriemia grave / sepsis', sp: 'p', d: [50, 50], u: 'mg/kg', f: 'c/4-6 h, 3 días', v: 'EV, IM, SC', src: 'Doti' },
    { l: 'Urinarias / tejidos blandos', sp: 'g', d: [50, 50], u: 'mg/animal', f: 'c/12 h, 14 días', v: 'PO', src: 'Doti' },
    { l: 'Infecciones sistémicas', sp: 'g', d: [25, 50], u: 'mg/kg', f: 'c/12 h, 14 días', v: 'PO, EV, IM, SC', src: 'Doti' },
    { l: 'Bacteriemia grave / sepsis', sp: 'g', d: [50, 50], u: 'mg/animal', f: 'c/6-8 h, 5 días', v: 'EV, IM, SC', src: 'Doti' },
  ]},
  { id: 'rifampicina', name: 'Rifampicina', g: 'atb', info: {
      tipo: 'Bactericida; grampositivos (muy eficaz contra Staphylococcus intermedius) y Mycobacterium. Dar lejos de las comidas.', clase: 'C',
      prec: ['Suma cautela en insuficiencia hepática.', 'Tiñe lágrimas, saliva y orina de naranja (sin consecuencias).', 'No usar con propranolol, glucocorticoides, warfarina, diazepam ni fenobarbital.'],
      pres: 'Cápsulas 150 y 300 mg; polvo inyectable 600 mg; spray tópico.' }, p: [
    { l: 'Micobacterias / endocarditis estafilocócica', sp: 'p', d: [10, 20], u: 'mg/kg', f: 'c/8-12 h', v: 'PO', src: 'Doti', n: 'En terapia combinada (con amoxicilina-clavulánico en la endocarditis).' },
    { l: 'Micosis del SNC', sp: 'g', d: [10, 20], u: 'mg/kg', f: 'c/8 h', v: 'PO', src: 'Doti', n: 'Combinada con anfotericina B y flucitosina.' },
  ]},
  { id: 'tilosina', name: 'Tilosina', g: 'atb', p: [
    { l: 'Parenteral', sp: 'pg', d: [5, 20], u: 'mg/kg', f: 'c/12 h', v: 'EV, SC', src: 'Doti' },
    { l: 'ERA, colitis clostridial, micoplasmas', sp: 'pg', d: [10, 20], u: 'mg/kg', f: 'c/12-24 h', v: 'v.o.' },
  ]},
  { id: 'ivermectina', name: 'Ivermectina', g: 'atb', p: [
    { l: 'Prevención de dirofilariosis', sp: 'pg', d: [6, 12], u: 'µg/kg', f: 'mensual', v: 'v.o.', n: '⚠ Evitar en razas susceptibles a toxicidad (MDR1: collie, pastor australiano, etc.).' },
  ]},
  { id: 'milbemicina', name: 'Milbemicina oxima', g: 'atb', p: [
    { l: 'Dosis general', sp: 'pg', d: [0.5, 1], u: 'mg/kg', f: 'mensual', v: 'v.o.', n: 'Prevención mensual de filarias y control de anquilostomas.' },
  ]},
  { id: 'selamectina', name: 'Selamectina / Moxidectina', g: 'atb', p: [
    { l: 'Dosis general', sp: 'pg', d: [6, 12], u: 'mg/kg', f: 'mensual', v: 'tópica (spot-on)', n: 'Control mensual de ectoparásitos y prevención de dirofilariosis.' },
  ]},

  // ───────────── 2. Analgesia, sedación, anestesia, anticonvulsivantes ─────────────
  { id: 'acepromacina', name: 'Acepromacina', g: 'ana', p: [
    { l: 'Sedación / ansiedad', sp: 'pg', d: [0.01, 0.2], u: 'mg/kg', f: '', v: 'i.v., i.m., s.c.', max: 3, n: 'Sedación y reducción de ansiedad en dificultad respiratoria. No superar una dosis total de 3 mg.' },
    { l: 'Crisis hipertensiva', sp: 'p', d: [0.05, 0.1], u: 'mg/kg', f: '', v: 'i.v.', max: 3 },
    { l: 'Crisis hipertensiva', sp: 'g', d: [0.01, 0.05], u: 'mg/kg', f: '', v: 'i.v.', max: 3 },
    { l: 'Protocolo Unidad', sp: 'pg', d: [0.05, 0.2], u: 'mg/kg', f: '', v: 'IM / EV', max: 3, src: 'PDF', n: 'Menos de 0,05 mg/kg suele ser suficiente.' },
  ]},
  { id: 'propofol', name: 'Propofol', g: 'ana', p: [
    { l: 'Bolo (convulsiones refractarias)', sp: 'p', d: [3.5, 3.5], u: 'mg/kg', f: 'bolo', v: 'i.v.' },
    { l: 'Bolo (convulsiones refractarias)', sp: 'g', d: [1, 1], u: 'mg/kg', f: 'bolo', v: 'i.v.' },
    { l: 'Infusión continua (estatus epiléptico)', sp: 'pg', d: [0.1, 0.25], u: 'mg/kg/min', cri: true, f: 'IC', v: 'i.v.', n: 'Tras el bolo inicial.' },
    { l: 'Inducción (Protocolo Unidad)', sp: 'p', d: [1, 7], u: 'mg/kg', f: 'a efecto', v: 'i.v.', src: 'PDF' },
    { l: 'Inducción (Protocolo Unidad)', sp: 'g', d: [5, 7], u: 'mg/kg', f: 'a efecto', v: 'i.v.', src: 'PDF' },
  ]},
  { id: 'buprenorfina', name: 'Buprenorfina', g: 'ana', p: [
    { l: 'Dolor moderado / traumatismos', sp: 'pg', d: [0.005, 0.03], u: 'mg/kg', f: 'c/6-12 h', v: 'i.v., i.m., s.c., v.o. (transmucosa en gatos)' },
  ]},
  { id: 'butorfanol', name: 'Butorfanol', g: 'ana', p: [
    { l: 'Dolor y sedación', sp: 'pg', d: [0.1, 0.8], u: 'mg/kg', f: '', v: 'i.v., i.m., s.c.' },
    { l: 'Carga previa a IC', sp: 'pg', d: [0.1, 0.2], u: 'mg/kg', f: 'bolo', v: 'i.v.' },
    { l: 'Infusión continua', sp: 'pg', d: [0.1, 0.2], u: 'mg/kg/h', cri: true, f: 'IC', v: 'i.v.' },
    { l: 'Antitusígeno', sp: 'p', d: [0.5, 0.5], u: 'mg/kg', f: 'c/6-12 h', v: 'v.o.' },
    { l: 'Protocolo Unidad', sp: 'pg', d: [0.1, 0.4], u: 'mg/kg', f: 'c/2-12 h', v: 'EV, IM, oral, SC', src: 'PDF' },
  ]},
  { id: 'morfina', name: 'Morfina', g: 'ana', p: [
    { l: 'Edema pulmonar / obstrucción respiratoria alta', sp: 'p', d: [0.2, 2], u: 'mg/kg', f: '', v: 'i.m., s.c.' },
    { l: 'Analgésico', sp: 'p', d: [0.2, 0.4], u: 'mg/kg', f: 'c/4-6 h', v: 'i.m., i.v., s.c.' },
    { l: 'Analgésico', sp: 'g', d: [0.1, 0.1], u: 'mg/kg', f: 'c/4-6 h', v: 'i.m., i.v., s.c.' },
  ]},
  { id: 'fentanilo', name: 'Fentanilo', g: 'ana', p: [
    { l: 'Bolo (Protocolo Unidad)', sp: 'pg', d: [2, 4], u: 'µg/kg', f: 'bolo', v: 'i.v.', src: 'PDF' },
    { l: 'Infusión continua (Protocolo Unidad)', sp: 'pg', d: [3, 6], u: 'µg/kg/h', cri: true, f: 'IC', v: 'i.v.', src: 'PDF', n: '⚠ En la tabla de CRI del PDF figura "1-6 µg/kg/min"; se tomó 3-6 µg/kg/h de la tabla de opioides. Verificar.' },
  ]},
  { id: 'tramadol', name: 'Tramadol', g: 'ana', p: [
    { l: 'Dolor', sp: 'p', d: [1, 5], u: 'mg/kg', f: 'c/8-12 h', v: 'v.o.' },
    { l: 'Protocolo Unidad', sp: 'pg', d: [2, 4], u: 'mg/kg', f: 'c/8-12 h', v: 'EV, SC, oral', src: 'PDF' },
  ]},
  { id: 'gabapentina', name: 'Gabapentina', g: 'ana', p: [
    { l: 'Dolor crónico / neuropático', sp: 'pg', d: [2.5, 10], u: 'mg/kg', f: 'c/8-24 h', v: 'v.o.' },
    { l: 'Antiepiléptico', sp: 'p', d: [10, 20], u: 'mg/kg', f: 'c/8 h', v: 'v.o.' },
  ]},
  { id: 'dipirona', name: 'Dipirona (metamizol)', g: 'ana', p: [
    { l: 'Bolo (Protocolo Unidad)', sp: 'pg', d: [5, 15], u: 'mg/kg', f: 'c/8-12 h', v: 'EV, SC, oral', src: 'PDF' },
    { l: 'Infusión continua (Protocolo Unidad)', sp: 'pg', d: [5, 10], u: 'mg/kg/h', cri: true, f: 'IC', v: 'EV', src: 'PDF' },
  ]},
  { id: 'paracetamol', name: 'Paracetamol', g: 'ana', contra: { g: 'CONTRAINDICADO EN GATOS (toxicidad grave: metahemoglobinemia, daño hepático).' }, p: [
    { l: 'Protocolo Unidad (solo perro)', sp: 'p', d: [10, 15], u: 'mg/kg', f: 'c/8-12 h', v: 'oral', src: 'PDF' },
  ]},
  { id: 'meloxicam', name: 'Meloxicam', g: 'ana', p: [
    { l: 'Dosis general', sp: 'p', d: [0.1, 0.2], u: 'mg/kg', f: 'c/24 h', v: 'v.o. (PDF: SC u oral)' },
  ]},
  { id: 'carprofeno', name: 'Carprofeno', g: 'ana', p: [
    { l: 'Dosis general', sp: 'p', d: [1, 2], u: 'mg/kg', f: 'c/12 h', v: 'v.o.' },
    { l: 'Protocolo Unidad', sp: 'p', d: [2, 4], u: 'mg/kg', f: 'c/12-24 h', v: '', src: 'PDF' },
  ]},
  { id: 'firocoxib', name: 'Firocoxib', g: 'ana', p: [
    { l: 'Dosis general', sp: 'p', d: [5, 5], u: 'mg/kg', f: 'c/24 h', v: 'v.o.' },
  ]},
  { id: 'deracoxib', name: 'Deracoxib', g: 'ana', p: [
    { l: 'Dosis general', sp: 'p', d: [1, 1], u: 'mg/kg', f: 'c/24 h', v: 'v.o.' },
  ]},
  { id: 'piroxicam', name: 'Piroxicam', g: 'ana', p: [
    { l: 'Dosis general', sp: 'p', d: [0.3, 0.3], u: 'mg/kg', f: 'c/24-48 h', v: 'v.o.' },
  ]},
  { id: 'atropina', name: 'Atropina', g: 'ana', p: [
    { l: 'Preanestesia (Protocolo Unidad)', sp: 'pg', d: [0.01, 0.04], u: 'mg/kg', f: '', v: '', src: 'PDF' },
    { l: 'Intoxicación (Protocolo Unidad)', sp: 'pg', d: [0.2, 0.2], u: 'mg/kg', f: '', v: '', src: 'PDF', n: 'Intoxicación por organofosforados / carbamatos.' },
  ]},
  { id: 'diazepam', name: 'Diazepam', g: 'ana', p: [
    { l: 'Anticonvulsivante oral', sp: 'g', d: [0.5, 2], u: 'mg/kg', f: 'c/8-12 h', v: 'v.o.', n: '⚠ Vigilar hepatotoxicidad idiosincrática aguda; se prefiere fenobarbital para uso crónico.' },
    { l: 'Sedación / anestesia (Protocolo Unidad)', sp: 'pg', d: [0.2, 2], u: 'mg/kg', f: '', v: '', src: 'PDF' },
  ]},
  { id: 'midazolam', name: 'Midazolam', g: 'ana', p: [
    { l: 'Protocolo Unidad', sp: 'pg', d: [0.2, 1], u: 'mg/kg', f: '', v: '', src: 'PDF' },
  ]},
  { id: 'ketamina', name: 'Ketamina', g: 'ana', p: [
    { l: 'Bolo (Protocolo Unidad)', sp: 'pg', d: [2, 10], u: 'mg/kg', f: '', v: 'IV, IM, SC, oral', src: 'PDF' },
    { l: 'Infusión continua (Protocolo Unidad)', sp: 'pg', d: [5, 10], u: 'µg/kg/min', cri: true, f: 'IC', v: 'IV', src: 'PDF', n: 'Equivale a 0,3-0,6 mg/kg/h.' },
  ]},
  { id: 'xilacina', name: 'Xilacina', g: 'ana', p: [
    { l: 'Sedación (Protocolo Unidad)', sp: 'pg', d: [0.5, 3], u: 'mg/kg', f: '', v: 'IV, IM', src: 'PDF' },
    { l: 'Infusión continua (Protocolo Unidad)', sp: 'pg', d: [0.1, 0.5], u: 'mg/kg/h', cri: true, f: 'IC', v: 'IV', src: 'PDF' },
    { l: 'Emético', sp: 'g', d: [0.44, 0.44], u: 'mg/kg', f: 'única', v: 'i.m.', n: 'Inducción del vómito en gatos.' },
  ]},
  { id: 'dexmedetomidina', name: 'Dexmedetomidina', g: 'ana', p: [
    { l: 'Bolo (Protocolo Unidad)', sp: 'pg', d: [2, 10], u: 'µg/kg', f: '', v: 'IV, IM', src: 'PDF' },
    { l: 'Infusión continua (Protocolo Unidad)', sp: 'pg', d: [0.5, 2], u: 'µg/kg/h', cri: true, f: 'IC', v: 'IV', src: 'PDF' },
  ]},
  { id: 'medetomidina', name: 'Medetomidina', g: 'ana', p: [
    { l: 'Protocolo Unidad', sp: 'p', d: [0.01, 0.08], u: 'mg/kg', f: '', v: '', src: 'PDF' },
    { l: 'Protocolo Unidad', sp: 'g', d: [0.05, 0.15], u: 'mg/kg', f: '', v: '', src: 'PDF' },
  ]},
  { id: 'lidocaina', name: 'Lidocaína', g: 'ana', p: [
    { l: 'Bolo (Protocolo Unidad)', sp: 'pg', d: [1, 2], u: 'mg/kg', f: 'bolo', v: 'i.v.', src: 'PDF' },
    { l: 'Infusión continua (Protocolo Unidad)', sp: 'pg', d: [30, 50], u: 'µg/kg/min', cri: true, f: 'IC', v: 'i.v.', src: 'PDF', n: 'Equivale a 1,8-3 mg/kg/h. Precaución en gatos (mayor sensibilidad a la toxicidad).' },
  ]},
  { id: 'fenobarbital', name: 'Fenobarbital', g: 'ana', p: [
    { l: 'Dosis inicial', sp: 'p', d: [2.5, 3], u: 'mg/kg', f: 'c/12 h', v: 'v.o.' },
    { l: 'Dosis inicial', sp: 'g', d: [1, 2], u: 'mg/kg', f: 'c/12 h', v: 'v.o.' },
  ]},
  { id: 'levetiracetam', name: 'Levetiracetam', g: 'ana', p: [
    { l: 'Mantenimiento', sp: 'pg', d: [20, 20], u: 'mg/kg', f: 'c/8 h', v: 'v.o.' },
    { l: 'Emergencia (racimos / estatus)', sp: 'pg', d: [20, 60], u: 'mg/kg', f: 'bolo lento', v: 'i.v.' },
  ]},
  { id: 'bromuro', name: 'Bromuro potásico', g: 'ana', p: [
    { l: 'Monoterapia', sp: 'p', d: [20, 20], u: 'mg/kg', f: 'c/12 h', v: 'v.o.' },
    { l: 'Combinado con fenobarbital', sp: 'p', d: [15, 15], u: 'mg/kg', f: 'c/12 h', v: 'v.o.' },
  ]},
  { id: 'zonisamida', name: 'Zonisamida', g: 'ana', p: [
    { l: 'Dosis general', sp: 'p', d: [5, 10], u: 'mg/kg', f: 'c/12 h', v: 'v.o.', n: 'Usar 10 mg/kg si recibe fenobarbital.' },
    { l: 'Dosis general', sp: 'g', d: [5, 10], u: 'mg/kg', f: 'c/12-24 h', v: 'v.o.' },
  ]},
  { id: 'pregabalina', name: 'Pregabalina', g: 'ana', p: [
    { l: 'Dosis general', sp: 'p', d: [4, 4], u: 'mg/kg', f: 'c/8-12 h', v: 'v.o.' },
    { l: 'Protocolo Unidad', sp: 'pg', d: [1, 4], u: 'mg/kg', f: 'c/12-24 h', v: 'oral', src: 'PDF' },
  ]},

  // ───────────── 3. Gastrointestinales y hepatoprotectores ─────────────
  { id: 'maropitant', name: 'Maropitant (Cerenia)', g: 'gi', p: [
    { l: 'Antiemético s.c.', sp: 'p', d: [1, 1], u: 'mg/kg', f: 'c/24 h', v: 's.c.', n: 'Precaución en cachorros menores de 11-16 semanas.' },
    { l: 'Antiemético oral', sp: 'p', d: [2, 2], u: 'mg/kg', f: 'c/24 h', v: 'v.o.' },
    { l: 'Mareo (cinetosis)', sp: 'p', d: [8, 8], u: 'mg/kg', f: 'c/24 h por 2 días', v: 'v.o.' },
    { l: 'Antiemético', sp: 'g', d: [1, 1], u: 'mg/kg', f: 'c/24 h', v: 's.c. o v.o.' },
    { l: 'Uremia', sp: 'g', d: [4, 4], u: 'mg/animal', f: 'c/24 h', v: 'v.o.' },
  ]},
  { id: 'ondansetron', name: 'Ondansetrón', g: 'gi', p: [
    { l: 'Dosis general', sp: 'pg', d: [0.1, 0.2], u: 'mg/kg', f: 'c/8-24 h', v: 'i.v.', n: 'Puede llegar hasta 0,5 mg/kg. Vómitos intensos o refractarios.' },
    { l: 'Protocolo Unidad', sp: 'pg', d: [0.5, 0.5], u: 'mg/kg', f: 'c/8-24 h', v: 'EV, SC', src: 'PDF' },
  ]},
  { id: 'metoclopramida', name: 'Metoclopramida', g: 'gi', p: [
    { l: 'Bolos', sp: 'pg', d: [0.25, 0.5], u: 'mg/kg', f: 'c/8-24 h', v: 'v.o., i.m., i.v.', n: 'Menos eficaz en gatos.' },
    { l: 'Carga previa a IC', sp: 'pg', d: [0.4, 0.4], u: 'mg/kg', f: 'bolo', v: 'i.v.' },
    { l: 'Infusión continua', sp: 'pg', d: [0.3, 0.3], u: 'mg/kg/h', cri: true, f: 'IC', v: 'i.v.', n: 'Proteger de la luz.' },
  ]},
  { id: 'omeprazol', name: 'Omeprazol', g: 'gi', p: [
    { l: 'Dosis general', sp: 'pg', d: [1, 2], u: 'mg/kg', f: 'c/12 h', v: 'v.o.', n: 'Úlceras, hemorragia gástrica y esofagitis.' },
    { l: 'Protocolo Unidad', sp: 'pg', d: [0.7, 1], u: 'mg/kg', f: 'c/12-24 h', v: 'EV, SC, oral', src: 'PDF' },
  ]},
  { id: 'famotidina', name: 'Famotidina', g: 'gi', p: [
    { l: 'Dosis general', sp: 'pg', d: [0.1, 1], u: 'mg/kg', f: 'c/12-24 h', v: 'v.o., s.c., i.m., i.v.', n: 'Gastritis y gastropatía urémica.' },
  ]},
  { id: 'ranitidina', name: 'Ranitidina', g: 'gi', p: [
    { l: 'Dosis general', sp: 'p', d: [1, 2], u: 'mg/kg', f: 'c/8-12 h', v: 'v.o., i.v.' },
    { l: 'Intravenosa', sp: 'g', d: [2.5, 2.5], u: 'mg/kg', f: 'c/12 h', v: 'i.v.' },
    { l: 'Oral', sp: 'g', d: [3.5, 3.5], u: 'mg/kg', f: 'c/12 h', v: 'v.o.' },
    { l: 'Protocolo Unidad', sp: 'pg', d: [2, 2], u: 'mg/kg', f: 'c/12 h', v: 'SC, oral', src: 'PDF' },
  ]},
  { id: 'sucralfato', name: 'Sucralfato', g: 'gi', p: [
    { l: 'Dosis general', sp: 'p', d: [0.5, 1], u: 'g/animal', f: 'c/6-8 h', v: 'v.o.', n: 'Preferible en suspensión; puede absorber otros fármacos orales.' },
    { l: 'Dosis general', sp: 'g', d: [0.25, 0.25], u: 'g/animal', f: 'c/6-8 h', v: 'v.o.', n: 'Preferible en suspensión; puede absorber otros fármacos orales.' },
  ]},
  { id: 'lactulosa', name: 'Lactulosa', g: 'gi', p: [
    { l: 'Estreñimiento (1 ml / 4,5 kg)', sp: 'p', d: [0.2222, 0.2222], u: 'ml/kg', f: 'c/8-12 h', v: 'v.o.' },
    { l: 'Encefalopatía hepática', sp: 'p', d: [2.5, 15], u: 'ml/animal', f: 'c/8 h', v: 'v.o.' },
    { l: 'Encefalopatía hepática', sp: 'g', d: [2.5, 5], u: 'ml/animal', f: 'c/8 h', v: 'v.o.' },
  ]},
  { id: 'loperamida', name: 'Loperamida', g: 'gi', p: [
    { l: 'Dosis general', sp: 'p', d: [0.12, 0.12], u: 'mg/kg', f: 'c/8-12 h', v: 'v.o.' },
    { l: 'Dosis general', sp: 'g', d: [0.08, 0.16], u: 'mg/kg', f: 'c/12 h', v: 'v.o.' },
  ]},
  { id: 'sulfasalazina', name: 'Sulfasalazina', g: 'gi', p: [
    { l: 'Colitis', sp: 'p', d: [50, 60], u: 'mg/kg/día', tomas: 3, max: 3000, f: 'dividido en 3 tomas', v: 'v.o.', n: 'Máximo 3 g/día. Controlar producción lagrimal.' },
    { l: 'Colitis', sp: 'g', d: [15, 20], u: 'mg/kg/día', tomas: 2, f: 'en 1-2 tomas', v: 'v.o.', n: 'Vigilar toxicidad por salicilatos. Se muestra dividido en 2 tomas (o dar el total en 1 toma).' },
  ]},
  { id: 'same', name: 'SAMe (S-adenosilmetionina)', g: 'gi', p: [
    { l: 'Dosis general', sp: 'pg', d: [20, 20], u: 'mg/kg', f: 'c/24 h', v: 'v.o.', n: 'Administrar con el estómago vacío.' },
    { l: 'Dosis total por gato', sp: 'g', d: [100, 400], u: 'mg/animal', f: 'por día', v: 'v.o.' },
  ]},
  { id: 'b12', name: 'Vitamina B12 (Cianocobalamina)', g: 'gi', p: [
    { l: 'Inyectable', sp: 'pg', d: [0.02, 0.02], u: 'mg/kg', f: 'c/2-4 semanas', v: 'i.m.' },
    { l: 'Oral (según peso)', sp: 'p', d: [0.25, 1], u: 'mg/animal', f: 'diaria', v: 'v.o.' },
    { l: 'Oral', sp: 'g', d: [0.25, 0.25], u: 'mg/animal', f: 'diaria', v: 'v.o.' },
  ]},

  // ───────────── 4. Cardiorrespiratorio, renal y coagulación ─────────────
  { id: 'furosemida', name: 'Furosemida', g: 'car', p: [
    { l: 'Dosis general', sp: 'pg', d: [1, 4], u: 'mg/kg', f: 'c/6-12 h', v: 'i.v., i.m., s.c., v.o.' },
    { l: 'Inicio en gatos (dosis fija)', sp: 'g', d: [6.25, 6.25], u: 'mg/animal', f: 'c/8-12 h', v: 'v.o.', n: 'Reducir gradualmente a la dosis mínima eficaz.' },
    { l: 'Bolo inicial (falla cardíaca severa)', sp: 'pg', d: [2, 2], u: 'mg/kg', f: 'bolo', v: 'i.v.' },
    { l: 'Infusión continua', sp: 'pg', d: [2, 15], u: 'µg/kg/min', cri: true, f: 'IC', v: 'i.v.', n: 'Tras bolo inicial de 2 mg/kg.' },
    { l: 'Diuresis forzada (toxicología)', sp: 'pg', d: [2, 4], u: 'mg/kg', f: '', v: 'i.v.', n: 'Acompañar de fluidoterapia salina.' },
    { l: 'Protocolo Unidad', sp: 'pg', d: [2, 4], u: 'mg/kg', f: 'c/6-12 h', v: 'EV, SC, IM, oral', src: 'PDF' },
  ]},
  { id: 'pimobendan', name: 'Pimobendan', g: 'car', p: [
    { l: 'Protocolo Unidad', sp: 'pg', d: [0.25, 0.5], u: 'mg/kg', f: 'c/12-24 h', v: 'oral', src: 'PDF' },
  ]},
  { id: 'enalapril', name: 'Enalapril', g: 'car', p: [
    { l: 'Dosis general', sp: 'p', d: [0.5, 0.5], u: 'mg/kg', f: 'c/12-24 h', v: 'v.o.', n: 'En glomerulopatías ajustable hasta 2 mg/kg/día dividido c/12 h.' },
    { l: 'Dosis general', sp: 'g', d: [0.5, 0.5], u: 'mg/kg', f: 'c/24 h', v: 'v.o.' },
  ]},
  { id: 'benazepril', name: 'Benazepril', g: 'car', p: [
    { l: 'Dosis general', sp: 'pg', d: [0.25, 0.5], u: 'mg/kg', f: 'c/12-24 h', v: 'v.o.' },
  ]},
  { id: 'telmisartan', name: 'Telmisartán', g: 'car', p: [
    { l: 'Dosis general', sp: 'pg', d: [1, 1], u: 'mg/kg', f: 'c/24 h', v: 'v.o.', n: 'Ajustable hasta 2 mg/kg/día.' },
  ]},
  { id: 'losartan', name: 'Losartán', g: 'car', p: [
    { l: 'No azoémicos', sp: 'p', d: [0.5, 0.5], u: 'mg/kg', f: 'por día', v: 'v.o.' },
    { l: 'Azoémicos', sp: 'p', d: [0.125, 0.125], u: 'mg/kg', f: 'por día', v: 'v.o.' },
  ]},
  { id: 'espironolactona', name: 'Espironolactona', g: 'car', p: [
    { l: 'Dosis general', sp: 'pg', d: [1, 2], u: 'mg/kg', f: 'c/12 h', v: 'v.o.', n: 'Antagonista de la aldosterona.' },
  ]},
  { id: 'amlodipino', name: 'Amlodipino', g: 'car', p: [
    { l: 'Dosis fija por gato', sp: 'g', d: [0.625, 1.25], u: 'mg/animal', f: 'c/24 h', v: 'v.o.', n: 'Primera elección antihipertensiva en gatos.' },
    { l: 'Por peso', sp: 'g', d: [0.1, 0.2], u: 'mg/kg', f: 'c/24 h', v: 'v.o.', n: 'Hasta 0,5 mg/kg.' },
    { l: 'Dosis general', sp: 'p', d: [0.1, 0.5], u: 'mg/kg', f: 'c/12-24 h', v: 'v.o.', n: 'Hasta 0,75 mg/kg/día. Siempre combinado con un IECA.' },
  ]},
  { id: 'atenolol', name: 'Atenolol', g: 'car', p: [
    { l: 'Dosis general', sp: 'p', d: [0.2, 1], u: 'mg/kg', f: 'c/12-24 h', v: 'v.o.' },
    { l: 'Dosis fija por gato', sp: 'g', d: [6.25, 12.5], u: 'mg/animal', f: 'c/12-24 h', v: 'v.o.' },
  ]},
  { id: 'hidralazina', name: 'Hidralazina', g: 'car', p: [
    { l: 'Oral', sp: 'p', d: [0.5, 2], u: 'mg/kg', f: 'c/12 h', v: 'v.o.' },
    { l: 'Oral (dosis fija por gato)', sp: 'g', d: [2.5, 10], u: 'mg/animal', f: 'c/12 h', v: 'v.o.' },
    { l: 'Crisis hipertensiva', sp: 'pg', d: [0.1, 0.2], u: 'mg/kg', f: 'c/2 h según necesidad', v: 'i.v., i.m.' },
  ]},
  { id: 'teofilina', name: 'Teofilina (liberación inmediata)', g: 'car', p: [
    { l: 'Dosis general', sp: 'p', d: [9, 9], u: 'mg/kg', f: 'c/8 h', v: 'v.o.' },
    { l: 'Dosis general', sp: 'g', d: [4, 4], u: 'mg/kg', f: 'c/12 h', v: 'v.o.' },
  ]},
  { id: 'aminofilina', name: 'Aminofilina', g: 'car', p: [
    { l: 'Dosis general', sp: 'p', d: [11, 11], u: 'mg/kg', f: 'c/8 h', v: 'v.o.' },
    { l: 'Dosis general', sp: 'g', d: [5, 5], u: 'mg/kg', f: 'c/12 h', v: 'v.o.' },
  ]},
  { id: 'terbutalina', name: 'Terbutalina', g: 'car', p: [
    { l: 'Dosis fija por perro', sp: 'p', d: [1.25, 5], u: 'mg/animal', f: 'c/8-12 h', v: 'v.o.' },
    { l: 'Inyectable', sp: 'g', d: [0.01, 0.01], u: 'mg/kg', f: 'c/12 h', v: 's.c.', n: 'Vía oral: porción de comprimido de 2,5 mg c/12 h.' },
  ]},
  { id: 'albuterol', name: 'Albuterol (salbutamol) oral', g: 'car', p: [
    { l: 'Dosis general', sp: 'pg', d: [20, 50], u: 'µg/kg', f: 'c/8-12 h', v: 'v.o.' },
  ]},
  { id: 'aspirina', name: 'Aspirina', g: 'car', p: [
    { l: 'Antitrombótico', sp: 'p', d: [0.5, 5], u: 'mg/kg', f: 'c/24 h', v: 'v.o.' },
    { l: 'Antitrombótico (dosis fija)', sp: 'g', d: [5, 81], u: 'mg/animal', f: 'c/72 h', v: 'v.o.' },
    { l: 'Antipirético', sp: 'p', d: [10, 25], u: 'mg/kg', f: 'c/12 h', v: 'v.o.' },
    { l: 'Antipirético', sp: 'g', d: [10, 10], u: 'mg/kg', f: 'c/72 h', v: 'v.o.' },
  ]},
  { id: 'heparina', name: 'Heparina no fraccionada', g: 'car', p: [
    { l: 'TEA: bolo inicial', sp: 'pg', d: [100, 300], u: 'UI/kg', f: 'bolo', v: 'i.v.', n: 'Tromboembolismo arterial o aórtico.' },
    { l: 'TEA: mantenimiento', sp: 'pg', d: [100, 300], u: 'UI/kg', f: 'c/8 h', v: 's.c.' },
    { l: 'TEA: infusión continua', sp: 'pg', d: [600, 800], u: 'UI/kg/día', cri: true, f: 'IC', v: 'i.v.' },
    { l: 'CID / AHIM: minidosis', sp: 'pg', d: [5, 10], u: 'UI/kg', f: 'c/8 h', v: 's.c.' },
    { l: 'CID / AHIM: dosis baja', sp: 'pg', d: [50, 100], u: 'UI/kg', f: 'c/8 h', v: 's.c.' },
    { l: 'CID / AHIM: dosis intermedia', sp: 'pg', d: [300, 500], u: 'UI/kg', f: 'c/8 h', v: 's.c., i.v.' },
    { l: 'CID / AHIM: dosis alta', sp: 'pg', d: [750, 1000], u: 'UI/kg', f: 'c/8 h', v: 's.c., i.v.' },
  ]},
  { id: 'enoxaparina', name: 'Enoxaparina', g: 'car', p: [
    { l: 'Dosis general', sp: 'pg', d: [1.5, 1.5], u: 'mg/kg', f: 'c/12-24 h', v: 's.c.' },
  ]},
  { id: 'dalteparina', name: 'Dalteparina', g: 'car', p: [
    { l: 'Dosis general', sp: 'p', d: [50, 100], u: 'UI/kg', f: 'c/12-24 h', v: 's.c.' },
    { l: 'Dosis general', sp: 'g', d: [100, 100], u: 'UI/kg', f: 'c/12-24 h', v: 's.c.' },
  ]},
  { id: 'rivaroxaban', name: 'Rivaroxabán', g: 'car', p: [
    { l: 'Dosis general', sp: 'p', d: [0.5, 1], u: 'mg/kg', f: 'c/24 h', v: 'v.o.' },
  ]},
  { id: 'tranexamico', name: 'Ácido tranexámico', g: 'car', p: [
    { l: 'Protocolo Unidad', sp: 'pg', d: [10, 20], u: 'mg/kg', f: 'c/8-12 h', v: 'EV, SC, IM, oral', src: 'PDF', n: 'EV lento (15 minutos).' },
  ]},

  // ───────────── 5. Corticoides, inmunosupresores y endocrinología ─────────────
  { id: 'prednisolona', name: 'Prednisona / Prednisolona', g: 'end', p: [
    { l: 'Antiinflamatorio / bronquitis / alergias', sp: 'pg', d: [0.5, 1], u: 'mg/kg', f: 'c/12-24 h', v: 'v.o.', n: 'Reducir gradualmente a días alternos.' },
    { l: 'Inmunosupresor (AHIM, poliartritis, EII)', sp: 'p', d: [2, 4], u: 'mg/kg/día', tomas: 2, f: 'dividido c/12 h', v: 'v.o.' },
    { l: 'Inmunosupresor (AHIM, poliartritis, EII)', sp: 'g', d: [2, 8], u: 'mg/kg/día', tomas: 2, f: 'dividido c/12 h', v: 'v.o.', n: 'Preferir siempre prednisolona en gatos.' },
    { l: 'Hipoadrenocorticismo (Addison)', sp: 'pg', d: [0.25, 0.25], u: 'mg/kg', f: 'c/12 h', v: 'v.o.', n: 'Ajustar al mínimo diario; duplicar ante estrés o cirugía.' },
    { l: 'Prednisolona (Protocolo Unidad)', sp: 'pg', d: [0.5, 2], u: 'mg/kg', f: 'c/12-24 h', v: '', src: 'PDF' },
  ]},
  { id: 'dexametasona', name: 'Dexametasona', g: 'end', p: [
    { l: 'Crisis asmática / insuficiencia adrenal aguda', sp: 'pg', d: [0.5, 1], u: 'mg/kg', f: 'única', v: 'i.v.' },
    { l: 'Addison: mantenimiento en fluidos', sp: 'pg', d: [0.05, 0.1], u: 'mg/kg', f: 'c/12 h', v: 'i.v. (en fluidos)' },
    { l: 'AHIM hiperaguda', sp: 'p', d: [1, 2], u: 'mg/kg', f: 'bolo único', v: 'i.v.' },
    { l: 'Mantenimiento inmunosupresor', sp: 'g', d: [4, 5], u: 'mg/animal', f: '1 vez por semana', v: 'v.o.' },
    { l: 'Protocolo Unidad', sp: 'pg', d: [0.5, 4], u: 'mg/kg', f: 'c/12-24 h', v: 'EV, SC, oral', src: 'PDF' },
  ]},
  { id: 'azatioprina', name: 'Azatioprina', g: 'end', contra: { g: 'ESTRICTAMENTE CONTRAINDICADA EN GATOS por severa toxicidad medular.' }, p: [
    { l: 'Por peso', sp: 'p', d: [2, 2.2], u: 'mg/kg', f: 'c/24 h, luego días alternos', v: 'v.o.' },
    { l: 'Por superficie corporal', sp: 'p', d: [50, 50], u: 'mg/m2', f: 'c/24-48 h', v: 'v.o.' },
  ]},
  { id: 'ciclosporina', name: 'Ciclosporina', g: 'end', p: [
    { l: 'Dosis general', sp: 'p', d: [3, 10], u: 'mg/kg', f: 'c/12-24 h', v: 'v.o.', n: 'Según patología.' },
    { l: 'Dermatitis atópica / EII', sp: 'p', d: [5, 5], u: 'mg/kg', f: 'c/24 h', v: 'v.o.' },
    { l: 'Asociada a ketoconazol', sp: 'p', d: [0.5, 2.5], u: 'mg/kg', f: 'c/12-24 h', v: 'v.o.' },
    { l: 'Dosis general', sp: 'g', d: [3, 5], u: 'mg/kg', f: 'c/12 h', v: 'v.o.' },
  ]},
  { id: 'ketoconazol', name: 'Ketoconazol (con ciclosporina)', g: 'end', p: [
    { l: 'Para reducir dosis de ciclosporina', sp: 'p', d: [3, 15], u: 'mg/kg', f: 'c/12-24 h', v: 'v.o.' },
  ]},
  { id: 'clorambucilo', name: 'Clorambucilo', g: 'end', p: [
    { l: 'Por peso', sp: 'pg', d: [0.1, 0.2], u: 'mg/kg', f: 'c/24 h (luego c/48-72 h)', v: 'v.o.' },
    { l: 'Por superficie corporal', sp: 'p', d: [4, 6], u: 'mg/m2', f: 'diaria', v: 'v.o.' },
    { l: 'Dosis fija por gato', sp: 'g', d: [1, 2], u: 'mg/animal', f: '2 veces/semana o c/48 h', v: 'v.o.' },
    { l: 'AHIM (superficie corporal)', sp: 'g', d: [20, 20], u: 'mg/m2', f: 'c/2 semanas', v: 'v.o.' },
  ]},
  { id: 'micofenolato', name: 'Micofenolato mofetilo', g: 'end', p: [
    { l: 'Dosis general', sp: 'pg', d: [10, 10], u: 'mg/kg', f: 'c/12 h', v: 'v.o.' },
  ]},
  { id: 'leflunomida', name: 'Leflunomida', g: 'end', p: [
    { l: 'Dosis general', sp: 'p', d: [2, 4], u: 'mg/kg', f: 'c/24 h', v: 'v.o.' },
    { l: 'Dosis fija por gato', sp: 'g', d: [10, 10], u: 'mg/animal', f: 'c/24 h', v: 'v.o.' },
  ]},
  { id: 'docp', name: 'Pivalato de desoxicorticosterona (DOCP)', g: 'end', p: [
    { l: 'Inicial', sp: 'pg', d: [2.2, 2.2], u: 'mg/kg', f: 'c/25 días', v: 'i.m., s.c.', n: 'Ajustar según electrolitos.' },
    { l: 'Mantenimiento reducido', sp: 'pg', d: [1.5, 1.5], u: 'mg/kg', f: 'c/21-25 días', v: 'i.m., s.c.' },
  ]},
  { id: 'trilostano', name: 'Trilostano', g: 'end', p: [
    { l: 'Hiperadrenocorticismo (inicio)', sp: 'p', d: [1, 1], u: 'mg/kg', f: 'c/12 h', v: 'v.o.', n: 'Administrar junto con la comida.' },
  ]},
  { id: 'metimazol', name: 'Metimazol', g: 'end', p: [
    { l: 'Hipertiroidismo (inicio)', sp: 'g', d: [2.5, 5], u: 'mg/animal', f: 'c/12 h', v: 'v.o.' },
  ]},
  { id: 'desmopresina', name: 'Desmopresina', g: 'end', p: [
    { l: 'Diabetes insípida central (oral)', sp: 'p', tiers: [{ hasta: 5, dosis: 0.05 }, { hasta: 20, dosis: 0.1 }, { hasta: Infinity, dosis: 0.2 }], u: 'mg/animal', f: 'c/8-12 h', v: 'v.o.', n: '<5 kg: 0,05 mg · 5-20 kg: 0,1 mg · >20 kg: 0,2 mg. Alternativa: 1-4 gotas en saco conjuntival 1-2 veces/día.' },
    { l: 'Diabetes insípida central (oral)', sp: 'g', d: [0.05, 0.05], u: 'mg/animal', f: 'c/8-12 h', v: 'v.o.', n: 'Alternativa: 1-4 gotas en saco conjuntival 1-2 veces/día.' },
  ]},
  { id: 'calcitriol', name: 'Calcitriol', g: 'end', p: [
    { l: 'Hipoparatiroidismo / hipocalcemia', sp: 'pg', d: [20, 30], u: 'ng/kg/día', f: 'diaria', v: 'v.o.' },
  ]},
  { id: 'darbepoetina', name: 'Darbepoetina alfa', g: 'end', p: [
    { l: 'Anemia renal no regenerativa', sp: 'pg', d: [0.5, 0.8], u: 'µg/kg', f: '1 vez por semana', v: 's.c.' },
  ]},
  { id: 'epo', name: 'Eritropoyetina (EPO)', g: 'end', p: [
    { l: 'Anemia renal no regenerativa', sp: 'pg', d: [100, 150], u: 'UI/kg', f: '2 veces por semana', v: 's.c.' },
  ]},
  { id: 'cabergolina', name: 'Cabergolina', g: 'end', p: [
    { l: 'Protocolo Unidad', sp: 'pg', d: [5, 5], u: 'µg/kg', f: 'c/24 h', v: 'oral', src: 'PDF' },
  ]},

  // ───────────── 6. Toxicología y emergencias ─────────────
  { id: 'apomorfina', name: 'Apomorfina', g: 'tox', p: [
    { l: 'Emético', sp: 'p', d: [0.08, 0.08], u: 'mg/kg', f: 'única', v: 's.c. o saco conjuntival', n: 'Conjuntival: triturar tableta o disco de 6 mg y enjuagar el ojo con solución salina tras la emesis.' },
  ]},
  { id: 'h2o2', name: 'Peróxido de hidrógeno 3%', g: 'tox', p: [
    { l: 'Emético (domicilio)', sp: 'p', d: [1, 2], u: 'ml/kg', f: 'única', v: 'v.o.', n: 'Solo al 3%.' },
  ]},
  { id: 'ipecacuana', name: 'Jarabe de ipecacuana', g: 'tox', p: [
    { l: 'Emético (domicilio)', sp: 'p', d: [6.6, 6.6], u: 'ml/kg', f: 'única', v: 'v.o.', n: '⚠ Dosis según la bibliografía de origen; otras fuentes indican 1-2,5 ml/kg. Verificar.' },
  ]},
  { id: 'carbon', name: 'Carbón activado', g: 'tox', conc: { a: 1, au: 'g', ml: 5 }, p: [
    { l: 'Adsorbente', sp: 'pg', d: [1, 3], u: 'g/kg', f: '', v: 'v.o. o sonda gástrica', n: 'Suspensión al 10-20% (1 g en 5 ml de agua) tras vaciamiento gástrico. Vigilar hipernatremia en dosis repetidas.' },
  ]},
  { id: 'catartico', name: 'Sulfato sódico o de magnesio', g: 'tox', p: [
    { l: 'Catártico', sp: 'pg', d: [250, 250], u: 'mg/kg', f: 'única', v: 'v.o.', n: '30 minutos después del carbón activado.' },
  ]},
  { id: 'manitol', name: 'Manitol 20%', g: 'tox', conc: { pct: 20 }, p: [
    { l: 'Diuresis forzada', sp: 'pg', d: [1, 2], u: 'g/kg', f: '', v: 'i.v.', n: 'Acompañar de fluidoterapia salina.' },
  ]},
  { id: 'vitk1', name: 'Vitamina K1 (Fitomenadiona)', g: 'tox', p: [
    { l: 'Rodenticidas: dosis de carga', sp: 'p', d: [5, 5], u: 'mg/kg', f: 'única', v: 's.c. o v.o.', n: 'Con comida grasa para aumentar absorción. Evitar i.v. (anafilaxia) e i.m. (hematomas).' },
    { l: 'Rodenticidas: mantenimiento', sp: 'p', d: [2.5, 2.5], u: 'mg/kg', f: 'c/8-12 h (desde las 8 h)', v: 's.c. o v.o.', n: 'Evitar i.v. (anafilaxia) e i.m. (hematomas).' },
    { l: 'Coagulopatía por hepatopatía', sp: 'g', d: [0.5, 0.5], u: 'mg/kg', f: 'c/12 h por 3 días', v: 's.c. o i.m.' },
  ]},
  { id: 'protamina', name: 'Sulfato de protamina', g: 'tox', p: [
    { l: 'Antídoto de heparina', sp: 'pg', d: [1, 1], u: 'mg/100UI', f: 'única', v: 'i.v. lento', n: 'Vigilar riesgo de anafilaxia.' },
  ]},
];
