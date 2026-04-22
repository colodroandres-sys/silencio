const { getSupabase } = require('./_supabase');
const { verifyClerkToken } = require('./_auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { category, message, user_id, email } = req.body || {};
  if (!message || message.trim().length < 5) {
    return res.status(400).json({ error: 'Mensaje demasiado corto' });
  }

  const supabase = getSupabase();
  const { error } = await supabase.from('buzon_messages').insert({
    category:   category || 'otro',
    message:    message.trim().slice(0, 2000),
    user_id:    user_id || null,
    email:      email   || null,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error('[buzon] Supabase error:', error.message);
    return res.status(200).json({ ok: true }); // best-effort, no fallar al usuario
  }

  return res.status(200).json({ ok: true });
};
