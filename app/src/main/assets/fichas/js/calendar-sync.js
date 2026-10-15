// calendar-sync.js — agenda recordatorios (vacunación, desparasitación,
// visitas de control) en Google Calendar.
//
// Reutiliza el mismo Client ID de Google Cloud que Google Drive (Ajustes →
// Google), pero pide un token de acceso separado, con el scope mínimo
// `calendar.events` (solo puede crear/editar/borrar eventos que esta app
// haya creado, no puede leer el resto del calendario).
'use strict';

const CalendarSync = (() => {

  const GIS_SDK = 'https://accounts.google.com/gsi/client';
  const SCOPE = 'https://www.googleapis.com/auth/calendar.events';

  let gisTokenClient = null;
  let accessToken = null;

  async function ensureGis(clientId) {
    await Utils.cargarScript(GIS_SDK);
    if (!gisTokenClient) {
      gisTokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: () => {}, // se sobreescribe por invocación, ver obtenerToken()
      });
    }
    return gisTokenClient;
  }

  function obtenerToken(clientId) {
    return new Promise(async (resolve, reject) => {
      const client = await ensureGis(clientId);
      client.callback = (resp) => {
        if (resp.error) return reject(new Error('Google Calendar: ' + resp.error));
        accessToken = resp.access_token;
        resolve(resp.access_token);
      };
      client.requestAccessToken({ prompt: accessToken ? '' : 'consent' });
    });
  }

  /** Suma un día a una fecha ISO (yyyy-mm-dd); Google Calendar usa fecha de fin exclusiva en eventos de día completo. */
  function sumarUnDia(fechaIso) {
    const d = new Date(fechaIso + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  function construirEvento(paciente, recordatorio) {
    const nombrePaciente = paciente.paciente.nombre || 'paciente';
    const especieIcono = paciente.paciente.especie === 'felino' ? '🐱' : '🐶';
    const summary = `${especieIcono} ${recordatorio.tipo} · ${nombrePaciente}`;
    const descripcionPartes = [
      `Paciente: ${nombrePaciente} (${paciente.id})`,
      `Tutor: ${paciente.tutor.nombre || '—'}${paciente.tutor.telefono ? ' · ' + paciente.tutor.telefono : ''}`,
    ];
    if (recordatorio.notas) descripcionPartes.push(`Notas: ${recordatorio.notas}`);
    descripcionPartes.push('Generado desde Ficha Clínica FCV-UNR.');

    const evento = {
      summary,
      description: descripcionPartes.join('\n'),
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 24 * 60 }] },
    };

    if (recordatorio.hora) {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const inicio = new Date(`${recordatorio.fecha}T${recordatorio.hora}:00`);
      const fin = new Date(inicio.getTime() + 30 * 60000);
      evento.start = { dateTime: inicio.toISOString(), timeZone };
      evento.end = { dateTime: fin.toISOString(), timeZone };
    } else {
      evento.start = { date: recordatorio.fecha };
      evento.end = { date: sumarUnDia(recordatorio.fecha) };
    }
    return evento;
  }

  async function agendarEvento(paciente, recordatorio, clientId) {
    if (!clientId) throw new Error('Falta configurar el Client ID de Google en Ajustes.');
    if (!recordatorio.fecha) throw new Error('Cargá una fecha antes de agendar.');
    const token = await obtenerToken(clientId);
    const evento = construirEvento(paciente, recordatorio);
    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(evento),
    });
    if (!res.ok) throw new Error(`Google Calendar: error ${res.status} al crear el evento`);
    const creado = await res.json();
    return { googleEventId: creado.id, googleEventLink: creado.htmlLink };
  }

  async function cancelarEvento(googleEventId, clientId) {
    if (!googleEventId) return;
    const token = await obtenerToken(clientId);
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok && res.status !== 410 && res.status !== 404) {
      throw new Error(`Google Calendar: error ${res.status} al cancelar el evento`);
    }
  }

  return { agendarEvento, cancelarEvento };
})();
