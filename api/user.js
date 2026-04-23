const { verifyAuth } = require('./_auth');
const { getOrCreateUser, checkUsageLimit } = require('./_limits');
const { getSupabase } = require('./_supabase');

const LEVELS = [
  { name: 'Inquieto',    min: 0  },
  { name: 'Explorador',  min: 1  },
  { name: 'Consciente',  min: 5  },
  { name: 'Presente',    min: 15 },
  { name: 'Calma',       min: 30 }
];

function calculateLevel(totalSessions) {
  let level = LEVELS[0].name;
  for (const l of LEVELS) {
    if (totalSessions >= l.min) level = l.name;
  }
  return level;
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).end();

  const clerkId = await verifyAuth(req, res);
  if (!clerkId) return;

  const email = req.headers['x-user-email'] || '';
  const db = getSupabase();

  const [user, limitData, allMeds, savedResult] = await Promise.all([
    getOrCreateUser(clerkId, email),
    checkUsageLimit(clerkId),
    db
      .from('meditations')
      .select('duration, created_at')
      .eq('clerk_id', clerkId)
      .order('created_at', { ascending: false }),
    db
      .from('meditations')
      .select('id', { count: 'exact', head: true })
      .eq('clerk_id', clerkId)
      .eq('is_saved', true)
  ]);

  const meds = allMeds.data || [];
  const totalSessions = meds.length;
  const savedCount = savedResult.count || 0;

  const SAVE_LIMITS = { free: 0, essential: 5, premium: 20, studio: null };
  const plan = (user?.plan || 'free');
  const saveLimit = SAVE_LIMITS[plan] ?? null;

  // Minutos esta semana
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const minutesThisWeek = meds
    .filter(m => new Date(m.created_at) >= weekAgo)
    .reduce((sum, m) => sum + (parseInt(m.duration) || 0), 0);

  // Racha de días consecutivos
  const uniqueDates = [...new Set(meds.map(m => m.created_at.slice(0, 10)))].sort().reverse();
  let streak = 0;
  if (uniqueDates.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
      streak = 1;
      let prev = uniqueDates[0];
      for (let i = 1; i < uniqueDates.length; i++) {
        const diff = Math.round((new Date(prev) - new Date(uniqueDates[i])) / 86400000);
        if (diff === 1) { streak++; prev = uniqueDates[i]; }
        else break;
      }
    }
  }

  const totalMinutes = meds.reduce((s, m) => s + (parseInt(m.duration) || 0), 0);
  const level = calculateLevel(totalSessions);

  // Logros desbloqueados
  const achievements = [];
  if (totalSessions >= 1) achievements.push('primera_meditacion');
  if (streak >= 7)        achievements.push('7_dias_seguidos');
  if (totalMinutes >= 100) achievements.push('100_minutos');

  res.json({
    plan: user.plan || 'free',
    usage: limitData.usage ?? 0,
    limit: limitData.limit ?? 1,
    canGenerate: limitData.allowed,
    profileCompleted: !!user.profile_completed,
    streak,
    minutesThisWeek,
    totalMinutes,
    totalSessions,
    level,
    achievements,
    savedCount,
    saveLimit
  });
};
