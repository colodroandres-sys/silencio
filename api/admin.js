const { getSupabase } = require('./_supabase');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const PRICES = { essential: 9.99, premium: 19.99, studio: 39.99 };

// Emails internos del founder — se excluyen de MRR, conversión y listas
const TEST_EMAILS = new Set([
  'colodro.andres@gmail.com',
  'andresinmadrid.creator@gmail.com',
]);
const isTestEmail = (email) => {
  if (!email) return false;
  const lower = email.toLowerCase();
  if (TEST_EMAILS.has(lower)) return true;
  if (lower.startsWith('colodro.andres+')) return true;
  return false;
};

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
    const [usersResult, medsResult, usageResult, buzonResult, errorsResult] = await Promise.all([
      db.from('users').select('clerk_id, email, plan, free_used, lemonsqueezy_subscription_id, created_at'),
      db.from('meditations').select('clerk_id, duration, created_at'),
      db.from('monthly_usage').select('clerk_id, count').eq('month', month),
      db.from('buzon_messages').select('id, email, category, message, created_at, clerk_id').gte('created_at', thirtyDaysAgo).order('created_at', { ascending: false }).limit(50).then(r => r).catch(() => ({ data: [] })),
      db.from('error_log').select('id, endpoint, status, message, created_at, resolved').gte('created_at', new Date(Date.now() - 86400000).toISOString()).order('created_at', { ascending: false }).limit(20).then(r => r).catch(() => ({ data: [] })),
    ]);

    const allUsers = usersResult.data || [];
    const testClerkIds = new Set(
      allUsers.filter(u => isTestEmail(u.email)).map(u => u.clerk_id)
    );
    const users = allUsers.filter(u => !testClerkIds.has(u.clerk_id));
    const meds  = (medsResult.data  || []).filter(m => !testClerkIds.has(m.clerk_id));
    const usage = (usageResult.data || []).filter(u => !testClerkIds.has(u.clerk_id));

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
        has_sub:        !!u.lemonsqueezy_subscription_id,
        created_at:     u.created_at,
      }));

    // ── Buzón: estadísticas + últimos mensajes ──────────────
    const buzonAll = (buzonResult.data || []).filter(b => !testClerkIds.has(b.clerk_id));
    const buzonStats = {
      total30d:    buzonAll.length,
      total7d:     buzonAll.filter(b => b.created_at >= sevenDaysAgo).length,
      totalToday:  buzonAll.filter(b => b.created_at >= todayStart).length,
      recent:      buzonAll.slice(0, 10).map(b => ({
        id:         b.id,
        email:      b.email || (b.clerk_id ? '(con cuenta)' : '(guest)'),
        category:   b.category || 'otro',
        message:    (b.message || '').slice(0, 280),
        created_at: b.created_at,
      })),
    };

    // ── Errores 5xx últimas 24h ─────────────────────────────
    const errors24h = errorsResult.data || [];
    const errorStats = {
      total24h:    errors24h.length,
      unresolved:  errors24h.filter(e => !e.resolved).length,
      recent:      errors24h.slice(0, 10).map(e => ({
        id:         e.id,
        endpoint:   e.endpoint,
        status:     e.status,
        message:    (e.message || '').slice(0, 200),
        created_at: e.created_at,
      })),
    };

    // ── Lemon Squeezy: ventas, suscripciones, refunds ───────
    let lemonSqueezy = null;
    let lsError = null;
    if (process.env.LEMONSQUEEZY_API_KEY && process.env.LEMONSQUEEZY_STORE_ID) {
      try {
        const lsHeaders = {
          'Authorization': `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
          'Accept': 'application/vnd.api+json',
        };
        const storeId = process.env.LEMONSQUEEZY_STORE_ID;
        const since30Ms = Date.now() - 30 * 86400000;

        const [subsRes, ordersRes] = await Promise.all([
          fetch(`https://api.lemonsqueezy.com/v1/subscriptions?filter[store_id]=${storeId}&page[size]=100`, {
            headers: lsHeaders, signal: AbortSignal.timeout(7000),
          }),
          fetch(`https://api.lemonsqueezy.com/v1/orders?filter[store_id]=${storeId}&page[size]=100`, {
            headers: lsHeaders, signal: AbortSignal.timeout(7000),
          }),
        ]);

        if (!subsRes.ok || !ordersRes.ok) {
          lsError = `subs:${subsRes.status} orders:${ordersRes.status}`;
        } else {
          const subsData = await subsRes.json();
          const ordersData = await ordersRes.json();

          const subs = subsData.data || [];
          const subsByStatus = { active: 0, cancelled: 0, on_trial: 0, paused: 0, expired: 0, past_due: 0 };
          for (const s of subs) {
            const st = s.attributes?.status || 'unknown';
            subsByStatus[st] = (subsByStatus[st] || 0) + 1;
          }

          // Filtrar orders de últimos 30d en el cliente (LS API no soporta rango)
          const allOrders = ordersData.data || [];
          const orders = allOrders.filter(o => {
            const created = new Date(o.attributes?.created_at || 0).getTime();
            return created >= since30Ms;
          });
          let revenue30d = 0;
          let refundCount30d = 0;
          let testOrdersCount = 0;
          for (const o of orders) {
            const a = o.attributes || {};
            if (a.test_mode) testOrdersCount++;
            if (a.refunded) refundCount30d++;
            // total in cents
            revenue30d += (a.total || 0) / 100;
          }

          const totalOrders30d = orders.length;
          const refundRate = totalOrders30d > 0 ? (refundCount30d / totalOrders30d) * 100 : 0;

          lemonSqueezy = {
            testMode:       (subs[0]?.attributes?.test_mode ?? null) || (orders[0]?.attributes?.test_mode ?? false),
            subsActive:     subsByStatus.active,
            subsCancelled:  subsByStatus.cancelled,
            subsOnTrial:    subsByStatus.on_trial,
            subsPastDue:    subsByStatus.past_due,
            totalOrders30d,
            revenue30d:     Math.round(revenue30d * 100) / 100,
            refundCount30d,
            refundRate:     Math.round(refundRate * 10) / 10,
            testOrdersCount,
          };
        }
      } catch (e) { lsError = 'network: ' + (e.message || 'unknown').slice(0, 80); }
    } else {
      lsError = 'no_key_or_store';
    }

    // ── ElevenLabs: créditos en vivo ────────────────────────
    // Preferimos ELEVENLABS_ADMIN_KEY (read-only con user_read).
    // Fallback a ELEVENLABS_API_KEY si la admin no existe.
    let elevenlabs = null;
    let elevenlabsError = null;
    const elKey = process.env.ELEVENLABS_ADMIN_KEY || process.env.ELEVENLABS_API_KEY;
    if (elKey) {
      try {
        const elRes = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
          headers: { 'xi-api-key': elKey },
          signal: AbortSignal.timeout(5000),
        });
        if (elRes.ok) {
          const el = await elRes.json();
          const used    = el.character_count || 0;
          const limit   = el.character_limit || 1;
          const percent = Math.round((used / limit) * 100);
          const resetMs = el.next_character_count_reset_unix ? el.next_character_count_reset_unix * 1000 - Date.now() : null;
          elevenlabs = {
            used,
            limit,
            percentUsed:        percent,
            percentRemaining:   100 - percent,
            tier:               el.tier || '?',
            daysUntilReset:     resetMs != null ? Math.max(0, Math.ceil(resetMs / 86400000)) : null,
          };
        } else if (elRes.status === 401) {
          const body = await elRes.text();
          elevenlabsError = body.includes('missing_permissions')
            ? 'permission_missing'
            : 'unauthorized';
        } else {
          elevenlabsError = 'http_' + elRes.status;
        }
      } catch (_) { elevenlabsError = 'network'; }
    } else {
      elevenlabsError = 'no_key';
    }

    // ── Estado de salud (semáforos para el cockpit) ─────────
    const healthChecks = [
      {
        key:      'errors',
        label:    'Errores 5xx (24h)',
        value:    errorStats.total24h,
        level:    errorStats.total24h > 20 ? 'red' : errorStats.total24h > 5 ? 'yellow' : 'green',
        action:   errorStats.total24h > 20 ? 'Avísale a Claude YA: "veo 20+ errores en admin"'
                : errorStats.total24h > 5  ? 'Mira el detalle abajo y captura uno para Claude'
                : 'Todo bien',
      },
      {
        key:      'elevenlabs',
        label:    'Créditos ElevenLabs',
        value:    elevenlabs ? `${elevenlabs.percentRemaining}% restante` : (
                    elevenlabsError === 'permission_missing' ? 'API key sin permiso user_read'
                  : elevenlabsError === 'unauthorized'       ? 'API key inválida'
                  : elevenlabsError === 'no_key'              ? 'sin API key'
                  : 'sin conexión'
                ),
        level:    !elevenlabs            ? 'gray'
                : elevenlabs.percentRemaining < 5  ? 'red'
                : elevenlabs.percentRemaining < 20 ? 'yellow'
                : elevenlabs.percentRemaining < 50 ? 'yellow'
                : 'green',
        action:   !elevenlabs ? (
                    elevenlabsError === 'permission_missing' ? 'Crea una API key NUEVA en elevenlabs.io con permiso user_read activado. Luego escríbeme: "te paso la nueva key de ElevenLabs". Yo la pongo en Vercel.'
                  : elevenlabsError === 'unauthorized'       ? 'API key inválida o caducada. Regenérala en elevenlabs.io y pásamela.'
                  : elevenlabsError === 'no_key'              ? 'Falta ELEVENLABS_API_KEY en Vercel. Avísame.'
                  : 'Conexión con ElevenLabs falló. Avísame.'
                  )
                : elevenlabs.percentRemaining < 5  ? 'CRÍTICO. Upgrade Pro $99 YA. Pasos en docs/tareas-andres.md item 2'
                : elevenlabs.percentRemaining < 20 ? 'Bajo. Planea upgrade en próximos días.'
                : elevenlabs.percentRemaining < 50 ? `Vigila: ${elevenlabs.daysUntilReset || '?'} días hasta reset.`
                : 'Todo bien',
      },
      {
        key:      'mau',
        label:    'Usuarios activos / 30d',
        value:    activeThisMonth,
        level:    activeThisMonth >= 9500 ? 'red'
                : activeThisMonth >= 5000 ? 'yellow'
                : 'green',
        action:   activeThisMonth >= 9500 ? 'CRÍTICO. Clerk Pro $25/mes obligatorio (límite 10k)'
                : activeThisMonth >= 5000 ? 'Prepara upgrade Clerk Pro $25/mes'
                : 'Todo bien',
      },
      {
        key:      'ls_subs',
        label:    'Suscripciones activas (LS)',
        value:    !lemonSqueezy ? (lsError === 'no_key_or_store' ? 'no configurado' : 'sin conexión')
                : `${lemonSqueezy.subsActive} activas${lemonSqueezy.testMode ? ' (test mode)' : ''}`,
        level:    !lemonSqueezy ? 'gray'
                : lemonSqueezy.subsPastDue > 0 ? 'yellow'
                : 'green',
        action:   !lemonSqueezy ? (lsError === 'no_key_or_store' ? 'Falta LEMONSQUEEZY_API_KEY o STORE_ID en Vercel.' : `Falló: ${lsError}. Avísame.`)
                : lemonSqueezy.testMode ? 'Cuenta LS sigue en TEST MODE. Cuando aprueben live, esto pasa a real.'
                : lemonSqueezy.subsPastDue > 0 ? `${lemonSqueezy.subsPastDue} con pago pendiente. Revisa en LS.`
                : `${lemonSqueezy.subsCancelled} canceladas históricas · ${lemonSqueezy.totalOrders30d} órdenes 30d · $${lemonSqueezy.revenue30d}`,
      },
      {
        key:      'refunds',
        label:    'Refunds / chargebacks 30d',
        value:    !lemonSqueezy ? (lsError === 'no_key_or_store' ? 'no configurado' : 'sin conexión')
                : lemonSqueezy.totalOrders30d === 0 ? '0 órdenes 30d'
                : `${lemonSqueezy.refundCount30d} (${lemonSqueezy.refundRate}%)`,
        level:    !lemonSqueezy ? 'gray'
                : lemonSqueezy.totalOrders30d === 0 ? 'gray'
                : lemonSqueezy.refundRate > 2 ? 'red'
                : lemonSqueezy.refundRate > 0.5 ? 'yellow'
                : 'green',
        action:   !lemonSqueezy ? (lsError === 'no_key_or_store' ? 'Conecta API LS para ver esto.' : `Falló: ${lsError}. Avísame.`)
                : lemonSqueezy.totalOrders30d === 0 ? 'Aún no hay ventas. Cuando empiecen, este semáforo se activa.'
                : lemonSqueezy.refundRate > 2 ? 'CRÍTICO. >2% pone en riesgo tu cuenta LS. Pausa nuevos signups y avísame.'
                : lemonSqueezy.refundRate > 0.5 ? 'Subiendo. Revisa motivos en LS y mejora copy del checkout.'
                : 'Todo bien',
      },
      {
        key:      'buzon',
        label:    'Mensajes nuevos en buzón',
        value:    buzonStats.totalToday,
        level:    buzonStats.totalToday > 10 ? 'yellow' : 'green',
        action:   buzonStats.totalToday === 0 ? 'Sin nuevos hoy'
                : buzonStats.totalToday > 10  ? 'Mucho volumen. Atiende abajo.'
                : 'Léelos abajo y responde con templates de manual-operativo-ceo.md',
      },
    ];

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
      medsThisMonth:   usage.reduce((s, r) => s + (r.count || 0), 0),
      medsThisWeek,
      medsToday,
      users:           userList,
      buzonStats,
      errorStats,
      elevenlabs,
      lemonSqueezy,
      healthChecks,
    });
  } catch (e) {
    console.error('[admin] Error:', e.message);
    res.status(500).json({ error: 'Error obteniendo métricas.' });
  }
};
