// Helper para enviar alertas a Andrés via bot de Telegram (@stillova_alerts_bot).
// Token + chat_id en Vercel env vars.
//
// Uso desde otros endpoints:
//   const { sendTelegramAlert } = require('./_telegram');
//   await sendTelegramAlert('🔴 Pico de errores 5xx: 8 en última hora');

const TELEGRAM_API = 'https://api.telegram.org';

async function sendTelegramAlert(text, opts = {}) {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN/CHAT_ID no configurados — alerta NO enviada:', text);
    return { ok: false, reason: 'not_configured' };
  }

  // Telegram trunca a ~4096 caracteres, dejamos margen.
  const safeText = String(text).slice(0, 3900);

  try {
    const body = {
      chat_id: chatId,
      text: safeText,
      disable_web_page_preview: true
    };
    // parseMode === '' explícitamente desactiva formato; undefined cae en Markdown.
    if (opts.parseMode !== '') {
      body.parse_mode = opts.parseMode || 'Markdown';
    }
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.error('[telegram] sendMessage failed:', res.status, err);
      return { ok: false, status: res.status, error: err };
    }
    return { ok: true };
  } catch (e) {
    console.error('[telegram] network error:', e?.message || e);
    return { ok: false, error: e?.message || String(e) };
  }
}

module.exports = { sendTelegramAlert };
