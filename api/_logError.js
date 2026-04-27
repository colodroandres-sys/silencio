// Helper centralizado para registrar errores 5xx en la tabla error_log de Supabase.
// Diseñado para NUNCA throw — si el log falla, el endpoint que llamó sigue funcionando.

const { getSupabase } = require('./_supabase');

async function logError(endpoint, status, message, meta = {}) {
  try {
    if (status < 500) return; // solo nos interesan errores del servidor
    const userEmail = meta.userEmail || null;
    const cleanMeta = { ...meta };
    delete cleanMeta.userEmail;
    await getSupabase().from('error_log').insert({
      endpoint:   String(endpoint).slice(0, 200),
      status,
      message:    String(message || 'unknown').slice(0, 1000),
      user_email: userEmail,
      meta:       cleanMeta
    });
  } catch (_) {
    // never throw from logger
  }
}

module.exports = { logError };
