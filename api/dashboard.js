const { verifyAuth } = require('./_auth');
const { getOrCreateUser, checkUsageLimit } = require('./_limits');
const { getSupabase } = require('./_supabase');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).end();

  const clerkId = await verifyAuth(req, res);
  if (!clerkId) return;

  const email = req.headers['x-user-email'] || '';
  const db = getSupabase();

  // Obtener datos en paralelo
  const [user, limitData, savedResult, allResult] = await Promise.all([
    getOrCreateUser(clerkId, email),
    checkUsageLimit(clerkId),
    db
      .from('meditations')
      .select('id, title, duration, voice, audio_path, silence_map, created_at')
      .eq('clerk_id', clerkId)
      .eq('is_saved', true)
      .order('created_at', { ascending: false })
      .limit(50),
    db
      .from('meditations')
      .select('duration, created_at')
      .eq('clerk_id', clerkId)
      .order('created_at', { ascending: false })
  ]);

  const savedMeds = savedResult.data || [];
  const allMeds = allResult.data || [];

  // Total de minutos meditados (todas las sesiones, no solo guardadas)
  const totalMinutes = allMeds.reduce((s, m) => s + (m.duration || 0), 0);

  // Racha de días consecutivos
  const uniqueDates = [...new Set(
    allMeds.map(m => m.created_at.slice(0, 10))
  )].sort().reverse();

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

  // Signed URLs para reproducción (expiran en 1h)
  const meditations = await Promise.all(
    savedMeds.map(async m => {
      let audioUrl = null;
      if (m.audio_path) {
        const { data } = await db.storage
          .from('meditations')
          .createSignedUrl(m.audio_path, 3600);
        audioUrl = data?.signedUrl || null;
      }
      return { ...m, audioUrl };
    })
  );

  res.json({
    plan: user?.plan || 'free',
    usage: limitData.usage ?? 0,
    limit: limitData.limit ?? 1,
    canGenerate: limitData.allowed,
    totalMinutes,
    streak,
    totalSessions: allMeds.length,
    savedCount: savedMeds.length,
    meditations
  });
};
