// routes/events.js
// Cadastro, listagem, controle de monitoramento e histórico dos eventos.

const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { startMonitoring, stopMonitoring, MIN_INTERVAL_SECONDS } = require('../monitor/scheduler');

const router = express.Router();
router.use(requireAuth);

const ALLOWED_INTERVALS = [10, 15, 20, 30, 60];

function isValidUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function serializeEvent(e) {
  return {
    id: e.id,
    name: e.name,
    eventDate: e.event_date,
    eventTime: e.event_time,
    url: e.url,
    intervalSeconds: e.interval_seconds,
    status: e.status,
    lastCheckAt: e.last_check_at,
    availability: e.availability,
    monitoringActive: !!e.monitoring_active,
    alertActive: !!e.alert_active,
    autoStart: !!e.auto_start,
    autoOpen: !!e.auto_open,
    soundAlert: !!e.sound_alert,
    showNotification: !!e.show_notification,
    lastError: e.last_error,
    createdAt: e.created_at,
  };
}

router.get('/', (req, res) => {
  const events = db
    .prepare('SELECT * FROM events WHERE user_id = ? ORDER BY event_date ASC, event_time ASC')
    .all(req.userId);
  res.json(events.map(serializeEvent));
});

router.post('/', (req, res) => {
  const {
    name,
    eventDate,
    eventTime,
    url,
    intervalSeconds,
    autoStart,
    autoOpen,
    soundAlert,
    showNotification,
    soldOutText,
    availableText,
  } = req.body || {};

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Informe o nome do evento.' });
  }
  if (!eventDate) {
    return res.status(400).json({ error: 'Informe a data do evento.' });
  }
  if (!isValidUrl(url)) {
    return res.status(400).json({ error: 'Informe uma URL válida (começando com http:// ou https://).' });
  }
  const interval = Number(intervalSeconds);
  if (!ALLOWED_INTERVALS.includes(interval)) {
    return res.status(400).json({
      error: `Intervalo inválido. Use um destes valores: ${ALLOWED_INTERVALS.join(', ')} segundos. Intervalos muito curtos podem sobrecarregar o site e fazer com que ele bloqueie o acesso.`,
    });
  }

  const info = db
    .prepare(
      `INSERT INTO events
        (user_id, name, event_date, event_time, url, interval_seconds,
         auto_start, auto_open, sound_alert, show_notification, sold_out_text, available_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.userId,
      name.trim(),
      eventDate,
      eventTime || null,
      url.trim(),
      interval,
      autoStart ? 1 : 0,
      autoOpen ? 1 : 0,
      soundAlert === false ? 0 : 1,
      showNotification === false ? 0 : 1,
      soldOutText || null,
      availableText || null
    );

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(serializeEvent(event));
});

router.put('/:id', (req, res) => {
  const event = db
    .prepare('SELECT * FROM events WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!event) return res.status(404).json({ error: 'Evento não encontrado.' });

  const {
    name,
    eventDate,
    eventTime,
    url,
    intervalSeconds,
    autoStart,
    autoOpen,
    soundAlert,
    showNotification,
    soldOutText,
    availableText,
  } = req.body || {};

  if (url && !isValidUrl(url)) {
    return res.status(400).json({ error: 'URL inválida.' });
  }
  if (intervalSeconds && !ALLOWED_INTERVALS.includes(Number(intervalSeconds))) {
    return res.status(400).json({ error: 'Intervalo inválido.' });
  }

  db.prepare(
    `UPDATE events SET
      name = COALESCE(?, name),
      event_date = COALESCE(?, event_date),
      event_time = ?,
      url = COALESCE(?, url),
      interval_seconds = COALESCE(?, interval_seconds),
      auto_start = ?,
      auto_open = ?,
      sound_alert = ?,
      show_notification = ?,
      sold_out_text = ?,
      available_text = ?
     WHERE id = ?`
  ).run(
    name ? name.trim() : null,
    eventDate || null,
    eventTime !== undefined ? eventTime : event.event_time,
    url ? url.trim() : null,
    intervalSeconds ? Number(intervalSeconds) : null,
    autoStart !== undefined ? (autoStart ? 1 : 0) : event.auto_start,
    autoOpen !== undefined ? (autoOpen ? 1 : 0) : event.auto_open,
    soundAlert !== undefined ? (soundAlert ? 1 : 0) : event.sound_alert,
    showNotification !== undefined ? (showNotification ? 1 : 0) : event.show_notification,
    soldOutText !== undefined ? soldOutText : event.sold_out_text,
    availableText !== undefined ? availableText : event.available_text,
    event.id
  );

  const updated = db.prepare('SELECT * FROM events WHERE id = ?').get(event.id);
  res.json(serializeEvent(updated));
});

router.delete('/:id', (req, res) => {
  const event = db
    .prepare('SELECT * FROM events WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!event) return res.status(404).json({ error: 'Evento não encontrado.' });

  stopMonitoring(event.id);
  db.prepare('DELETE FROM event_history WHERE event_id = ?').run(event.id);
  db.prepare('DELETE FROM events WHERE id = ?').run(event.id);
  res.json({ ok: true });
});

router.post('/:id/start', (req, res) => {
  const event = db
    .prepare('SELECT * FROM events WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!event) return res.status(404).json({ error: 'Evento não encontrado.' });

  startMonitoring(event.id);
  const updated = db.prepare('SELECT * FROM events WHERE id = ?').get(event.id);
  res.json(serializeEvent(updated));
});

router.post('/:id/stop', (req, res) => {
  const event = db
    .prepare('SELECT * FROM events WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!event) return res.status(404).json({ error: 'Evento não encontrado.' });

  stopMonitoring(event.id);
  const updated = db.prepare('SELECT * FROM events WHERE id = ?').get(event.id);
  res.json(serializeEvent(updated));
});

router.get('/:id/history', (req, res) => {
  const event = db
    .prepare('SELECT * FROM events WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!event) return res.status(404).json({ error: 'Evento não encontrado.' });

  const history = db
    .prepare('SELECT status, checked_at, note FROM event_history WHERE event_id = ? ORDER BY id DESC LIMIT 50')
    .all(event.id);
  res.json(history);
});

// Modo de teste: simula "ingresso disponível" sem depender do site real,
// para você confirmar que som/notificação/Telegram estão funcionando.
router.post('/:id/test-alert', async (req, res) => {
  const event = db
    .prepare('SELECT * FROM events WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!event) return res.status(404).json({ error: 'Evento não encontrado.' });

  const { sendTicketAlert } = require('../notifications/telegram');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);

  db.prepare("UPDATE events SET status = 'available', availability = 'available', alert_active = 1 WHERE id = ?").run(event.id);
  db.prepare("INSERT INTO event_history (event_id, status, note) VALUES (?, 'available', 'Teste manual')").run(event.id);

  if (user.telegram_chat_id) {
    await sendTicketAlert(user.telegram_chat_id, event);
  }

  res.json({ ok: true, message: 'Alerta de teste disparado.' });
});

router.get('/config/limits', (req, res) => {
  res.json({ allowedIntervals: ALLOWED_INTERVALS, minIntervalSeconds: MIN_INTERVAL_SECONDS });
});

module.exports = router;
