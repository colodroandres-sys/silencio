const { getSupabase } = require('./_supabase');

// Créditos incluidos por plan al mes (free = one-time, no mensual)
const PLAN_LIMITS = {
  free: 1,         // 1 crédito one-time (solo 5 min)
  essential: 10,   // 10 créditos por mes
  premium: 25      // 25 créditos por mes
};

// Créditos que cuesta cada duración
const DURATION_CREDITS = {
  '5': 1,
  '10': 2,
  '15': 3,
  '20': 4
};

function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Obtiene o crea el usuario en Supabase.
 */
async function getOrCreateUser(clerkId, email) {
  const db = getSupabase();

  const { data: user } = await db
    .from('users')
    .select('*')
    .eq('clerk_id', clerkId)
    .single();

  if (user) return user;

  const { data: newUser, error } = await db
    .from('users')
    .insert({ clerk_id: clerkId, email: email || null })
    .select()
    .single();

  if (error) {
    // Race condition: otra request ya creó el usuario — lo recuperamos
    const { data: existingUser } = await db
      .from('users')
      .select('*')
      .eq('clerk_id', clerkId)
      .single();
    return existingUser;
  }

  return newUser;
}

/**
 * Verifica si el usuario puede generar una meditación.
 * Retorna { allowed, reason, usage, limit, plan }
 */
async function checkUsageLimit(clerkId) {
  const db = getSupabase();

  const { data: user } = await db
    .from('users')
    .select('plan, free_used')
    .eq('clerk_id', clerkId)
    .single();

  if (!user) return { allowed: false, reason: 'not_found' };

  const plan = user.plan || 'free';

  if (plan === 'free') {
    if (user.free_used) {
      return { allowed: false, reason: 'free_limit', usage: 1, limit: 1, plan };
    }
    return { allowed: true, plan, usage: 0, limit: 1 };
  }

  const month = getCurrentMonth();
  const { data: usage } = await db
    .from('monthly_usage')
    .select('count')
    .eq('clerk_id', clerkId)
    .eq('month', month)
    .single();

  const count = usage?.count || 0;
  const limit = PLAN_LIMITS[plan] || PLAN_LIMITS.essential;

  if (count >= limit) {
    return { allowed: false, reason: 'monthly_limit', usage: count, limit, plan };
  }

  return { allowed: true, plan, usage: count, limit };
}

/**
 * Incrementa los créditos usados tras una generación exitosa.
 * @param {string} clerkId
 * @param {string} duration - '5', '10', '15' o '20'
 */
async function incrementUsage(clerkId, duration) {
  const db = getSupabase();

  const { data: user } = await db
    .from('users')
    .select('plan')
    .eq('clerk_id', clerkId)
    .single();

  if (!user) return;

  const plan = user.plan || 'free';

  if (plan === 'free') {
    await db
      .from('users')
      .update({ free_used: true })
      .eq('clerk_id', clerkId);
    return;
  }

  const credits = DURATION_CREDITS[duration] || 1;
  const month = getCurrentMonth();

  // Upsert: si ya existe la fila la actualiza sumando créditos, si no la crea
  const { data: existing } = await db
    .from('monthly_usage')
    .select('count')
    .eq('clerk_id', clerkId)
    .eq('month', month)
    .single();

  const current = existing?.count || 0;
  await db
    .from('monthly_usage')
    .upsert({ clerk_id: clerkId, month, count: current + credits }, { onConflict: 'clerk_id,month' });
}

module.exports = { getOrCreateUser, checkUsageLimit, incrementUsage, PLAN_LIMITS, DURATION_CREDITS };
