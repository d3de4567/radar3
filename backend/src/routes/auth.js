// routes/auth.js
// Cadastro e login de usuários.

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post('/register', async (req, res) => {
  const { email, password } = req.body || {};

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Informe um e-mail válido.' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'Já existe uma conta com este e-mail.' });
  }

  const hash = await bcrypt.hash(password, 10);
  const info = db
    .prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
    .run(email.toLowerCase(), hash);

  const token = jwt.sign({ userId: info.lastInsertRowid }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });

  res.json({ token, email: email.toLowerCase() });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!isValidEmail(email) || !password) {
    return res.status(400).json({ error: 'Informe e-mail e senha.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, email: user.email, telegramLinked: !!user.telegram_chat_id });
});

// Liga a conta a um chat do Telegram, para receber alertas por lá.
router.post('/telegram', requireAuth, (req, res) => {
  const { chatId } = req.body || {};
  if (!chatId || typeof chatId !== 'string') {
    return res.status(400).json({ error: 'Informe o código de chat do Telegram.' });
  }
  db.prepare('UPDATE users SET telegram_chat_id = ? WHERE id = ?').run(chatId.trim(), req.userId);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db
    .prepare('SELECT id, email, telegram_chat_id FROM users WHERE id = ?')
    .get(req.userId);
  res.json({ email: user.email, telegramLinked: !!user.telegram_chat_id });
});

module.exports = router;
