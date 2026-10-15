// utils.js — helpers compartidos: acceso a rutas anidadas, ids, fechas, debounce.
'use strict';

const Utils = (() => {

  /** Lee un valor anidado por ruta tipo "eog.temperatura" o "planSanitario.vacunas.0.fecha" */
  function getPath(obj, path) {
    const parts = path.split('.');
    let cur = obj;
    for (const p of parts) {
      if (cur == null) return undefined;
      cur = cur[p];
    }
    return cur;
  }

  /** Escribe un valor anidado, creando objetos/arrays intermedios según haga falta. */
  function setPath(obj, path, value) {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      const nextKey = parts[i + 1];
      const wantsArray = /^\d+$/.test(nextKey);
      if (cur[key] == null || typeof cur[key] !== 'object') {
        cur[key] = wantsArray ? [] : {};
      }
      cur = cur[key];
    }
    cur[parts[parts.length - 1]] = value;
    return obj;
  }

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /** Genera un N° de Historia Clínica legible: HC-YYMMDD-XXXX */
  function generarHCId() {
    const d = new Date();
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `HC-${yy}${mm}${dd}-${rand}`;
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function todayISO() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  function formatFechaLarga(iso) {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  function formatFechaCorta(iso) {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('es-AR');
  }

  /** Calcula edad cronológica en años y meses a partir de fecha de nacimiento (ISO). */
  function calcEdad(fechaNacIso) {
    if (!fechaNacIso) return null;
    const nac = new Date(fechaNacIso + 'T00:00:00');
    if (isNaN(nac)) return null;
    const hoy = new Date();
    let años = hoy.getFullYear() - nac.getFullYear();
    let meses = hoy.getMonth() - nac.getMonth();
    if (hoy.getDate() < nac.getDate()) meses--;
    if (meses < 0) { años--; meses += 12; }
    if (años < 0) return null;
    return { años, meses };
  }

  function formatEdad(edad) {
    if (!edad) return '—';
    const partes = [];
    if (edad.años > 0) partes.push(`${edad.años} año${edad.años !== 1 ? 's' : ''}`);
    partes.push(`${edad.meses} mes${edad.meses !== 1 ? 'es' : ''}`);
    return partes.join(' y ');
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** Inyecta un <script> externo una sola vez (usado por los conectores OAuth de Google/Microsoft). */
  function cargarScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`No se pudo cargar ${src}. Verificá tu conexión.`));
      document.head.appendChild(s);
    });
  }

  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Calculadora de dosis: dosisMgKg (mg/kg), pesoKg, concentracionMgMl (mg/ml del producto comercial).
   * Devuelve el volumen a administrar en ml, redondeado a 2 decimales.
   */
  function calcularVolumenDosis(dosisMgKg, pesoKg, concentracionMgMl) {
    const dosis = parseFloat(dosisMgKg);
    const peso = parseFloat(pesoKg);
    const conc = parseFloat(concentracionMgMl);
    if (!dosis || !peso || !conc) return null;
    const mgTotales = dosis * peso;
    const ml = mgTotales / conc;
    return { mgTotales: Math.round(mgTotales * 100) / 100, ml: Math.round(ml * 100) / 100 };
  }

  return {
    getPath, setPath, uuid, generarHCId, debounce, todayISO,
    formatFechaLarga, formatFechaCorta, calcEdad, formatEdad,
    escapeHtml, fileToDataURL, calcularVolumenDosis, cargarScript
  };
})();
