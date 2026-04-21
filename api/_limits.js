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

function normalizeEmail(email) {
  if (!email) return null;
  const at = email.toLowerCase().lastIndexOf('@');
  if (at === -1) return email.toLowerCase();
  const local = email.slice(0, at).replace(/\+.*$/, '');
  const domain = email.slice(at + 1).toLowerCase();
  return `${local}@${domain}`;
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

  const normalizedEmail = normalizeEmail(email);

  // Anti-alias: si el email normalizado ya existe, no dar crédito gratis
  let alreadyUsedFree = false;
  if (normalizedEmail) {
    const { data: existing } = await db
      .from('users')
      .select('clerk_id')
      .eq('email', normalizedEmail)
      .neq('clerk_id', clerkId)
      .limit(1)
      .maybeSingle();
    if (existing) alreadyUsedFree = true;
  }

  const { data: newUser, error } = await db
    .from('users')
    .insert({ clerk_id: clerkId, email: normalizedEmail || null, free_used: alreadyUsedFree })
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
    .select('plan, free_used, subscription_status')
    .eq('clerk_id', clerkId)
    .single();

  if (!user) return { allowed: false, reason: 'not_found' };

  const plan = user.plan || 'free';

  if (plan !== 'free' && user.subscription_status === 'past_due') {
    return { allowed: false, reason: 'past_due', plan };
  }

  if (plan === 'free') {
    if (!user.free_used) {
      return { allowed: true, plan, usage: 0, limit: 1, profileCompleted: !!user.profile_completed };
    }
    // Primer crédito ya usado — ver si tiene crédito bonus por completar perfil
    if (user.profile_completed && !user.bonus_credit_used) {
      return { allowed: true, plan, usage: 1, limit: 2, profileCompleted: true, isBonusCredit: true };
    }
    return { allowed: false, reason: 'free_limit', usage: 1, limit: 1, plan, profileCompleted: !!user.profile_completed };
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
    // Verificar cuál crédito está usando
    const { data: freeUser } = await db
      .from('users')
      .select('free_used, profile_completed, bonus_credit_used')
      .eq('clerk_id', clerkId)
      .single();

    if (!freeUser?.free_used) {
      await db.from('users').update({ free_used: true }).eq('clerk_id', clerkId);
    } else if (freeUser?.profile_completed && !freeUser?.bonus_credit_used) {
      await db.from('users').update({ bonus_credit_used: true }).eq('clerk_id', clerkId);
    }
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
