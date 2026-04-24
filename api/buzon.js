const { verifyToken } = require('@clerk/backend');
const { getSupabase } = require('./_supabase');
const checkRateLimit  = require('./_ratelimit');

// Endpoint público con rate limit fuerte. Si llega Authorization, se verifica
// y se usa el clerk_id/email reales; nunca se confía en lo que mande el cliente.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // 5 mensajes por IP por hora — anti-spam
  const allowed = await checkRateLimit(req, res, 'buzon', 5, '1 h');
  if (!allowed) return;

  const { category, message } = req.body || {};
  if (!message || typeof message !== 'string' || message.trim().length < 5) {
    return res.status(400).json({ error: 'Mensaje demasiado corto' });
  }

  // Verificar auth si viene (opcional — el buzón acepta mensajes de guests)
  let clerkId = null;
  let email   = null;
  const auth  = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token) {
    try {
      const payload = await verifyToken(token, {
        secretKey:       process.env.CLERK_SECRET_KEY,
        publishableKey:  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      });
      clerkId = payload.sub || null;
    } catch (e) {
      console.warn('[buzon] Token inválido — se guarda como guest:', e.message);
    }
  }

  if (clerkId) {
    try {
      const { data: user } = await getSupabase()
        .from('users').select('email').eq('clerk_id', clerkId).single();
      email = user?.email || null;
    } catch (_) { /* noop */ }
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null;

  const supabase = getSupabase();
  const { error } = await supabase.from('buzon_messages').insert({
    clerk_id:   clerkId,
    email,
    category:   (category && typeof category === 'string') ? category.slice(0, 32) : 'otro',
    message:    message.trim().slice(0, 2000),
    ip,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error('[buzon] Supabase error:', error.message);
    return res.status(500).json({ error: 'No se pudo guardar el mensaje' });
  }

  return res.status(200).json({ ok: true });
};
