const { getSupabase } = require('./_supabase');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const PRICES = { essential: 9.99, premium: 19.99, studio: 39.99 };

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).end();

  const auth = req.headers['x-admin-password'] || '';
  if (!ADMIN_PASSWORD || auth !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  const db = getSupabase();

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const sevenDaysAgo  = new Date(Date.now() - 7  * 86400000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const todayStart    = new Date(now.toISOString().slice(0, 10)).toISOString();

  try {
    const [usersResult, medsResult, usageResult] = await Promise.all([
      db.from('users').select('clerk_id, email, plan, free_used, stripe_subscription_id, created_at'),
      db.from('meditations').select('clerk_id, duration, created_at'),
      db.from('monthly_usage').select('clerk_id, count').eq('month', month),
    ]);

    const users = usersResult.data || [];
    const meds  = medsResult.data  || [];
    const usage = usageResult.data || [];

    // ── Índices ──────────────────────────────────────────────
    const medsByUser = {};
    const lastActivityByUser = {};
    let medsToday = 0;
    let medsThisWeek = 0;

    for (const m of meds) {
      medsByUser[m.clerk_id] = (medsByUser[m.clerk_id] || 0) + 1;
      if (!lastActivityByUser[m.clerk_id] || m.created_at > lastActivityByUser[m.clerk_id]) {
        lastActivityByUser[m.clerk_id] = m.created_at;
      }
      if (m.created_at >= todayStart)    medsToday++;
      if (m.created_at >= sevenDaysAgo)  medsThisWeek++;
    }

    const usageByUser = {};
    for (const u of usage) usageByUser[u.clerk_id] = u.count || 0;

    // ── Métricas globales ─────────────────────────────────────
    const totalUsers   = users.length;
    const byPlan       = { free: 0, essential: 0, premium: 0, studio: 0 };
    let newThisWeek    = 0;
    let newThisMonth   = 0;
    let usedFreeCredit = 0;
    let activeThisWeek = 0;
    let activeThisMonth = 0;

    for (const u of users) {
      const plan = u.plan || 'free';
      byPlan[plan] = (byPlan[plan] || 0) + 1;
      if (u.created_at >= sevenDaysAgo)  newThisWeek++;
      if (u.created_at >= thirtyDaysAgo) newThisMonth++;
      if (u.free_used) usedFreeCredit++;
      const last = lastActivityByUser[u.clerk_id];
      if (last >= sevenDaysAgo)  activeThisWeek++;
      if (last >= thirtyDaysAgo) activeThisMonth++;
    }

    const paying        = byPlan.essential + byPlan.premium + byPlan.studio;
    const mrr           = +(
      (byPlan.essential * PRICES.essential) +
      (byPlan.premium   * PRICES.premium) +
      (byPlan.studio    * PRICES.studio)
    ).toFixed(2);
    const conversionRate = totalUsers > 0 ? +((paying / totalUsers) * 100).toFixed(1) : 0;
    const activationRate = totalUsers > 0 ? +((usedFreeCredit / totalUsers) * 100).toFixed(1) : 0;

    // ── Lista de usuarios enriquecida ─────────────────────────
    const userList = users
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 300)
      .map(u => ({
        clerk_id:       u.clerk_id,
        email:          u.email || '—',
        plan:           u.plan  || 'free',
        total_meds:     medsByUser[u.clerk_id] || 0,
        credits_used:   u.plan === 'free' ? (u.free_used ? 1 : 0) : (usageByUser[u.clerk_id] || 0),
        last_activity:  lastActivityByUser[u.clerk_id] || null,
        has_sub:        !!u.stripe_subscription_id,
        created_at:     u.created_at,
      }));

    res.json({
      month,
      mrr,
      totalUsers,
      byPlan,
      paying,
      newThisWeek,
      newThisMonth,
      conversionRate,
      activationRate,
      usedFreeCredit,
      activeThisWeek,
      activeThisMonth,
      medsTotal:       meds.length,
      medsThisMonth:   (usageResult.data || []).reduce((s, r) => s + (r.count || 0), 0),
      medsThisWeek,
      medsToday,
      users:           userList,
    });
  } catch (e) {
    console.error('[admin] Error:', e.message);
    res.status(500).json({ error: 'Error obteniendo métricas.' });
  }
};
