const { getSupabase } = require('./_supabase');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).end();

  // Autenticación simple por header
  const auth = req.headers['x-admin-password'] || req.query.password || '';
  if (!ADMIN_PASSWORD || auth !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  const db = getSupabase();
  const month = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  try {
    // Usuarios por plan
    const { data: users } = await db
      .from('users')
      .select('plan, created_at');

    const totalUsers = users?.length || 0;
    const byPlan = { free: 0, essential: 0, premium: 0 };
    let recentSignups = 0;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    for (const u of (users || [])) {
      byPlan[u.plan || 'free'] = (byPlan[u.plan || 'free'] || 0) + 1;
      if (u.created_at && u.created_at >= sevenDaysAgo) recentSignups++;
    }

    // Meditaciones generadas este mes
    const { data: usageRows } = await db
      .from('monthly_usage')
      .select('count')
      .eq('month', month);

    const meditationsThisMonth = (usageRows || []).reduce((sum, r) => sum + (r.count || 0), 0);

    // MRR estimado
    const PRICES = { essential: 11.99, premium: 22.99 };
    const mrr = +(
      (byPlan.essential * PRICES.essential) +
      (byPlan.premium * PRICES.premium)
    ).toFixed(2);

    // Conversión free → pago
    const paying = byPlan.essential + byPlan.premium;
    const conversionRate = totalUsers > 0
      ? +((paying / totalUsers) * 100).toFixed(1)
      : 0;

    // Lista de usuarios individuales (máx 200, más recientes primero)
    const { data: userList } = await db
      .from('users')
      .select('clerk_id, email, plan, free_used, stripe_subscription_id, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    res.json({
      month,
      totalUsers,
      byPlan,
      recentSignups,
      meditationsThisMonth,
      mrr,
      paying,
      conversionRate,
      users: userList || []
    });
  } catch (e) {
    console.error('[admin] Error:', e.message);
    res.status(500).json({ error: 'Error obteniendo métricas.' });
  }
};
