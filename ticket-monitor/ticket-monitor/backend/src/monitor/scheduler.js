// monitor/scheduler.js
//
// Mantém, em memória, um "relógio" (setInterval) para cada evento que está
// sendo monitorado. É este arquivo que faz o monitoramento continuar
// rodando no servidor mesmo que o tablet/celular esteja com a tela apagada
// ou o navegador fechado.

const db = require('../db');
const { checkEvent } = require('./checker');
const { sendTicketAlert } = require('../notifications/telegram');

const MIN_INTERVAL_SECONDS = Number(process.env.MIN_INTERVAL_SECONDS || 10);

// eventId -> objeto do setInterval
const activeTimers = new Map();

function recordHistory(eventId, status, note) {
  db.prepare(
    'INSERT INTO event_history (event_id, status, note) VALUES (?, ?, ?)'
  ).run(eventId, status, note || null);
}

async function runCheck(eventId) {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
  if (!event || !event.monitoring_active) {
    stopMonitoring(eventId);
    return;
  }

  db.prepare(
    "UPDATE events SET status = 'checking', last_check_at = datetime('now') WHERE id = ?"
  ).run(eventId);

  const result = await checkEvent(event);

  const previousAvailability = event.availability;
  let newStatus;
  let newAvailability = result.status;

  if (result.status === 'error') {
    newStatus = 'error';
    newAvailability = previousAvailability; // mantém o último status conhecido
    db.prepare(
      "UPDATE events SET status = 'error', last_error = ?, last_check_at = datetime('now') WHERE id = ?"
    ).run(result.error || 'Erro desconhecido', eventId);
    recordHistory(eventId, 'error', result.error);
    return;
  }

  if (result.status === 'available') {
    newStatus = 'available';
  } else if (result.status === 'sold_out') {
    newStatus = 'sold_out';
  } else {
    newStatus = 'monitoring'; // unknown: continuamos monitorando normalmente
  }

  db.prepare(
    `UPDATE events
     SET status = ?, availability = ?, last_check_at = datetime('now'), last_error = NULL
     WHERE id = ?`
  ).run(newStatus, newAvailability, eventId);

  recordHistory(eventId, newStatus);

  // Evita alertas repetidos: só dispara alerta quando a disponibilidade
  // MUDA de "não disponível" para "disponível".
  const becameAvailable =
    result.status === 'available' && previousAvailability !== 'available';

  if (becameAvailable) {
    db.prepare('UPDATE events SET alert_active = 1 WHERE id = ?').run(eventId);
    await triggerAlert(event);
  }

  if (result.status === 'sold_out' && previousAvailability === 'available') {
    // voltou a esgotar: "rearma" o alerta para a próxima vez que abrir
    db.prepare('UPDATE events SET alert_active = 0 WHERE id = ?').run(eventId);
  }
}

async function triggerAlert(event) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(event.user_id);
  if (user && user.telegram_chat_id) {
    await sendTicketAlert(user.telegram_chat_id, event);
  }
  // O alerta visual/sonoro dentro do app é feito pelo frontend, que consulta
  // periodicamente o status dos eventos (GET /api/events) e detecta a
  // mudança para "available".
}

function startMonitoring(eventId) {
  stopMonitoring(eventId); // evita duplicar o timer se já existir um

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
  if (!event) return;

  const seconds = Math.max(event.interval_seconds, MIN_INTERVAL_SECONDS);

  db.prepare(
    "UPDATE events SET monitoring_active = 1, status = 'monitoring' WHERE id = ?"
  ).run(eventId);

  // Roda uma verificação imediatamente, e depois a cada X segundos.
  runCheck(eventId);
  const timer = setInterval(() => runCheck(eventId), seconds * 1000);
  activeTimers.set(eventId, timer);
}

function stopMonitoring(eventId) {
  const timer = activeTimers.get(eventId);
  if (timer) {
    clearInterval(timer);
    activeTimers.delete(eventId);
  }
  db.prepare(
    "UPDATE events SET monitoring_active = 0, status = 'stopped' WHERE id = ?"
  ).run(eventId);
}

// Ao iniciar o servidor, retoma o monitoramento de todos os eventos que
// estavam ativos antes do servidor reiniciar (ex: depois de um deploy).
function resumeActiveMonitors() {
  const events = db.prepare('SELECT id FROM events WHERE monitoring_active = 1').all();
  for (const e of events) {
    startMonitoring(e.id);
  }
  if (events.length > 0) {
    console.log(`Retomando monitoramento de ${events.length} evento(s).`);
  }
}

module.exports = {
  startMonitoring,
  stopMonitoring,
  resumeActiveMonitors,
  MIN_INTERVAL_SECONDS,
};
