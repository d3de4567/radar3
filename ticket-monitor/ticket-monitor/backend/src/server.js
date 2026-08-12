// server.js
// Ponto de entrada do backend. Junta tudo: banco de dados, rotas e o
// servidor de arquivos do frontend.

require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');

require('./db'); // garante que o banco/tabelas existam antes de tudo

const authRoutes = require('./routes/auth');
const eventsRoutes = require('./routes/events');
const { resumeActiveMonitors } = require('./monitor/scheduler');

if (!process.env.JWT_SECRET) {
  console.error(
    'ERRO: a variável de ambiente JWT_SECRET não está definida. Configure-a no arquivo .env antes de iniciar o servidor.'
  );
  process.exit(1);
}

const app = express();

app.use(cors());
app.use(express.json({ limit: '200kb' }));

app.use('/api/auth', authRoutes);
app.use('/api/events', eventsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Serve o frontend (arquivos estáticos: HTML, CSS, JS, manifest, service worker)
const frontendPath = path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(frontendPath));

// Qualquer outra rota que não seja /api devolve o app (necessário para PWA)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(frontendPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  resumeActiveMonitors();
});
