const { getSupabase } = require('./_supabase');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).end();

  const checks = {
    timestamp: new Date().toISOString(),
    supabase: false,
    elevenlabs_key: false,
    clerk_key: false,
    lemonsqueezy_key: false,
    upstash_key: false
  };

  // Verificar Supabase con una query real
  try {
    const db = getSupabase();
    const { error } = await db.from('users').select('count').limit(1);
    // PGRST116 = no hay filas, pero la conexión funciona
    checks.supabase = !error || error.code === 'PGRST116';
  } catch (e) {
    checks.supabase = false;
  }

  // Verificar que las claves de API están configuradas (no exponemos los valores)
  checks.elevenlabs_key = !!process.env.ELEVENLABS_API_KEY;
  checks.clerk_key = !!process.env.CLERK_SECRET_KEY;
  checks.lemonsqueezy_key = !!process.env.LEMONSQUEEZY_API_KEY;
  checks.upstash_key = !!process.env.UPSTASH_REDIS_REST_URL;

  const allOk = checks.supabase &&
    checks.elevenlabs_key &&
    checks.clerk_key &&
    checks.lemonsqueezy_key;

  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    ...checks
  });
};
