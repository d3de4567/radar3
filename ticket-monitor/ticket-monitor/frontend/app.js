// app.js — lógica do aplicativo (sem frameworks, JavaScript puro)

const API = '/api';
const POLL_INTERVAL_MS = 5000;

const state = {
  token: localStorage.getItem('token') || null,
  events: [],
  filter: 'all',
  previousAlertState: {}, // eventId -> alertActive (para detectar mudança)
  editingEventId: null,
  historyEventId: null,
};

// ---------- Helpers de API ----------

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  const res = await fetch(API + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'Algo deu errado. Tente novamente.');
  }
  return data;
}

// ---------- Elementos ----------

const el = (id) => document.getElementById(id);

const authScreen = el('authScreen');
const appScreen = el('appScreen');
const loginForm = el('loginForm');
const registerForm = el('registerForm');
const toggleAuthMode = el('toggleAuthMode');

// ---------- Autenticação ----------

toggleAuthMode.addEventListener('click', () => {
  const showingLogin = !loginForm.hidden;
  loginForm.hidden = showingLogin;
  registerForm.hidden = !showingLogin;
  toggleAuthMode.textContent = showingLogin
    ? 'Já tenho conta — entrar'
    : 'Ainda não tenho conta — criar agora';
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorBox = el('authError');
  errorBox.hidden = true;
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: el('loginEmail').value.trim(),
        password: el('loginPassword').value,
      }),
    });
    onLoggedIn(data.token);
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.hidden = false;
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorBox = el('registerError');
  errorBox.hidden = true;
  try {
    const data = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: el('registerEmail').value.trim(),
        password: el('registerPassword').value,
      }),
    });
    onLoggedIn(data.token);
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.hidden = false;
  }
});

function onLoggedIn(token) {
  state.token = token;
  localStorage.setItem('token', token);
  authScreen.hidden = true;
  appScreen.hidden = false;
  bootstrapApp();
}

el('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('token');
  state.token = null;
  clearInterval(pollTimer);
  appScreen.hidden = true;
  authScreen.hidden = false;
});

// ---------- Abas ----------

el('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
  btn.classList.add('active');
  state.filter = btn.dataset.filter;
  renderEvents();
});

// ---------- Carregar e renderizar eventos ----------

let pollTimer = null;

async function bootstrapApp() {
  await loadEvents();
  await refreshMeInfo();
  pollTimer = setInterval(loadEvents, POLL_INTERVAL_MS);
  setupNotifications();
}

async function loadEvents() {
  try {
    const events = await api('/events');
    detectNewAlerts(events);
    state.events = events;
    renderEvents();
  } catch (err) {
    // se o token expirou, volta para o login
    if (String(err.message).toLowerCase().includes('sess') || String(err.message).toLowerCase().includes('autentic')) {
      el('logoutBtn').click();
    }
  }
}

function detectNewAlerts(newEvents) {
  for (const ev of newEvents) {
    const wasAlerting = state.previousAlertState[ev.id];
    if (ev.alertActive && !wasAlerting) {
      fireLocalAlert(ev);
    }
    state.previousAlertState[ev.id] = ev.alertActive;
  }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function matchesFilter(ev) {
  if (state.filter === 'all') return true;
  if (state.filter === 'active') return ev.monitoringActive;
  if (state.filter === 'upcoming') return ev.eventDate >= todayISO() && !ev.monitoringActive;
  if (state.filter === 'done') return ev.eventDate < todayISO();
  return true;
}

const STATUS_LABELS = {
  not_started: '⚪ Não iniciado',
  monitoring: '🟢 Monitorando',
  checking: '🟡 Verificando',
  sold_out: '🔴 Esgotado',
  available: '🎟️ INGRESSO DISPONÍVEL',
  error: '⚠️ Erro',
  stopped: '⏹ Parado',
};

function renderEvents() {
  const list = el('eventList');
  const empty = el('emptyState');
  const filtered = state.events.filter(matchesFilter);

  if (state.events.length === 0) {
    empty.hidden = false;
    list.innerHTML = '';
    return;
  }
  empty.hidden = true;

  list.innerHTML = filtered.map(renderCard).join('');

  filtered.forEach((ev) => {
    el(`start-${ev.id}`)?.addEventListener('click', () => toggleMonitoring(ev));
    el(`open-${ev.id}`)?.addEventListener('click', () => window.open(ev.url, '_blank'));
    el(`hist-${ev.id}`)?.addEventListener('click', () => openHistory(ev));
    el(`edit-${ev.id}`)?.addEventListener('click', () => openEventModal(ev));
    el(`del-${ev.id}`)?.addEventListener('click', () => deleteEvent(ev));
    el(`test-${ev.id}`)?.addEventListener('click', () => testAlert(ev));
  });
}

function renderCard(ev) {
  const statusClass = `status-${ev.status}`;
  const pulsing = ev.status === 'monitoring' || ev.status === 'checking' ? 'pulsing' : '';
  const lastCheck = ev.lastCheckAt ? formatDateTime(ev.lastCheckAt) : '—';

  return `
  <article class="event-card ${ev.status === 'available' ? 'is-available' : ''}">
    <div class="event-card-top">
      <div>
        <span class="event-date-chip">${formatDate(ev.eventDate)}${ev.eventTime ? ' · ' + ev.eventTime : ''}</span>
        <h3 class="event-name">${escapeHtml(ev.name)}</h3>
      </div>
      <button class="icon-btn" id="edit-${ev.id}" title="Editar">✎</button>
    </div>

    <span class="status-badge ${statusClass}">
      <span class="status-dot ${pulsing}"></span>
      ${STATUS_LABELS[ev.status] || ev.status}
    </span>

    ${ev.status === 'error' && ev.lastError ? `<p class="field-hint">${escapeHtml(ev.lastError)}</p>` : ''}

    <div class="event-meta">
      <b>Última verificação:</b> ${lastCheck}<br/>
      <b>Intervalo:</b> ${ev.intervalSeconds} segundos
    </div>

    <div class="event-card-actions">
      <button class="btn ${ev.monitoringActive ? 'btn-ghost' : 'btn-primary'}" id="start-${ev.id}">
        ${ev.monitoringActive ? 'Parar' : 'Monitorar'}
      </button>
      <button class="btn btn-ghost" id="open-${ev.id}">Abrir evento</button>
      <button class="icon-btn" id="hist-${ev.id}" title="Histórico">🕘</button>
      <button class="icon-btn" id="test-${ev.id}" title="Testar alerta">🔔</button>
      <button class="icon-btn" id="del-${ev.id}" title="Excluir">🗑</button>
    </div>
  </article>`;
}

async function toggleMonitoring(ev) {
  try {
    await api(`/events/${ev.id}/${ev.monitoringActive ? 'stop' : 'start'}`, { method: 'POST' });
    await loadEvents();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteEvent(ev) {
  if (!confirm(`Excluir o evento "${ev.name}"? Isso também apaga o histórico dele.`)) return;
  try {
    await api(`/events/${ev.id}`, { method: 'DELETE' });
    await loadEvents();
  } catch (err) {
    alert(err.message);
  }
}

async function testAlert(ev) {
  try {
    await api(`/events/${ev.id}/test-alert`, { method: 'POST' });
    await loadEvents();
  } catch (err) {
    alert(err.message);
  }
}

async function openHistory(ev) {
  state.historyEventId = ev.id;
  el('historyModalTitle').textContent = `Histórico — ${ev.name}`;
  el('historyList').innerHTML = '<li>Carregando…</li>';
  el('historyModal').hidden = false;
  try {
    const history = await api(`/events/${ev.id}/history`);
    if (history.length === 0) {
      el('historyList').innerHTML = '<li>Ainda não há verificações registradas.</li>';
      return;
    }
    el('historyList').innerHTML = history
      .map((h) => `<li><span>${STATUS_LABELS[h.status] || h.status}</span><span>${formatDateTime(h.checked_at)}</span></li>`)
      .join('');
  } catch (err) {
    el('historyList').innerHTML = `<li>${escapeHtml(err.message)}</li>`;
  }
}

el('closeHistoryModal').addEventListener('click', () => (el('historyModal').hidden = true));

// ---------- Modal: novo / editar evento ----------

const eventModal = el('eventModal');
const eventForm = el('eventForm');

el('newEventFab').addEventListener('click', () => openEventModal(null));
el('closeEventModal').addEventListener('click', closeEventModal);
el('cancelEventForm').addEventListener('click', closeEventModal);

function openEventModal(ev) {
  state.editingEventId = ev ? ev.id : null;
  el('eventModalTitle').textContent = ev ? 'Editar evento' : 'Novo evento';
  el('eventFormError').hidden = true;

  el('eventName').value = ev ? ev.name : '';
  el('eventDate').value = ev ? ev.eventDate : '';
  el('eventTime').value = ev && ev.eventTime ? ev.eventTime : '';
  el('eventUrl').value = ev ? ev.url : '';
  el('eventInterval').value = ev ? String(ev.intervalSeconds) : '20';
  el('eventAutoStart').checked = ev ? ev.autoStart : true;
  el('eventAutoOpen').checked = ev ? ev.autoOpen : false;
  el('eventSoundAlert').checked = ev ? ev.soundAlert : true;
  el('eventShowNotification').checked = ev ? ev.showNotification : true;
  el('eventSoldOutText').value = '';
  el('eventAvailableText').value = '';

  eventModal.hidden = false;
}

function closeEventModal() {
  eventModal.hidden = true;
  eventForm.reset();
}

eventForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorBox = el('eventFormError');
  errorBox.hidden = true;

  const payload = {
    name: el('eventName').value,
    eventDate: el('eventDate').value,
    eventTime: el('eventTime').value || null,
    url: el('eventUrl').value,
    intervalSeconds: Number(el('eventInterval').value),
    autoStart: el('eventAutoStart').checked,
    autoOpen: el('eventAutoOpen').checked,
    soundAlert: el('eventSoundAlert').checked,
    showNotification: el('eventShowNotification').checked,
    soldOutText: el('eventSoldOutText').value || null,
    availableText: el('eventAvailableText').value || null,
  };

  try {
    let saved;
    if (state.editingEventId) {
      saved = await api(`/events/${state.editingEventId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      saved = await api('/events', { method: 'POST', body: JSON.stringify(payload) });
    }

    if (payload.autoStart && !saved.monitoringActive) {
      await api(`/events/${saved.id}/start`, { method: 'POST' });
    }

    closeEventModal();
    await loadEvents();
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.hidden = false;
  }
});

// ---------- Alertas locais (som, notificação, banner) ----------

let audioCtx = null;

function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    [0, 0.18, 0.36].forEach((offset) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.35, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.16);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.2);
    });
  } catch (err) {
    // navegador pode bloquear áudio até haver interação do usuário; sem problema.
  }
}

function fireLocalAlert(ev) {
  if (ev.soundAlert) beep();

  if (ev.showNotification && 'Notification' in window && Notification.permission === 'granted') {
    const n = new Notification('🎟️ INGRESSO DISPONÍVEL!', {
      body: `${ev.name} — ${formatDate(ev.eventDate)}`,
      tag: `evento-${ev.id}`,
      requireInteraction: true,
    });
    n.onclick = () => {
      window.focus();
      window.open(ev.url, '_blank');
    };
  }

  el('alertBannerEvent').textContent = `${ev.name} — ${formatDate(ev.eventDate)}`;
  el('alertOpenBtn').onclick = () => window.open(ev.url, '_blank');
  el('alertBanner').hidden = false;

  if (ev.autoOpen) {
    window.open(ev.url, '_blank');
  }
}

el('alertDismissBtn').addEventListener('click', () => (el('alertBanner').hidden = true));

// ---------- Configurações ----------

el('settingsBtn').addEventListener('click', () => (el('settingsModal').hidden = false));
el('closeSettingsModal').addEventListener('click', () => (el('settingsModal').hidden = true));

async function refreshMeInfo() {
  try {
    const me = await api('/auth/me');
    el('telegramStatus').textContent = me.telegramLinked
      ? '✅ Telegram já está conectado a esta conta.'
      : 'Telegram ainda não conectado.';
  } catch (err) {
    // silencioso
  }
}

el('saveTelegramBtn').addEventListener('click', async () => {
  const chatId = el('telegramChatId').value.trim();
  if (!chatId) return;
  try {
    await api('/auth/telegram', { method: 'POST', body: JSON.stringify({ chatId }) });
    el('telegramStatus').textContent = '✅ Telegram conectado! Envie /start para o seu bot para confirmar.';
  } catch (err) {
    el('telegramStatus').textContent = err.message;
  }
});

function setupNotifications() {
  updateNotifStatusText();
}

function updateNotifStatusText() {
  const status = ('Notification' in window) ? Notification.permission : 'unsupported';
  const map = {
    granted: '✅ Notificações ativadas neste navegador.',
    denied: '🚫 Notificações bloqueadas. Ative nas configurações do navegador.',
    default: 'Notificações ainda não ativadas.',
    unsupported: 'Este navegador não suporta notificações.',
  };
  el('notifStatus').textContent = map[status];
}

el('requestNotifBtn').addEventListener('click', async () => {
  if (!('Notification' in window)) return;
  await Notification.requestPermission();
  updateNotifStatusText();
});

// ---------- Utilitários de formatação ----------

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatDateTime(sqliteUtc) {
  // SQLite datetime('now') retorna UTC no formato "YYYY-MM-DD HH:MM:SS"
  const iso = sqliteUtc.replace(' ', 'T') + 'Z';
  const date = new Date(iso);
  return date.toLocaleString('pt-BR');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Inicialização ----------

if (state.token) {
  authScreen.hidden = true;
  appScreen.hidden = false;
  bootstrapApp();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  });
}
