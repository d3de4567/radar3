// notifications/telegram.js
// Envia mensagens para o Telegram do usuário quando um ingresso aparece.

const fetch = require('node-fetch');

async function sendTelegramMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) {
    return { ok: false, reason: 'Telegram não configurado' };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    });
    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Erro ao enviar mensagem no Telegram:', err.message);
    return { ok: false, reason: err.message };
  }
}

async function sendTicketAlert(chatId, event) {
  const text =
    `🎟️ <b>INGRESSO DISPONÍVEL!</b>\n\n` +
    `<b>${escapeHtml(event.name)}</b>\n` +
    `📅 ${event.event_date}${event.event_time ? ' às ' + event.event_time : ''}\n\n` +
    `${event.url}`;
  return sendTelegramMessage(chatId, text);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = { sendTelegramMessage, sendTicketAlert };
