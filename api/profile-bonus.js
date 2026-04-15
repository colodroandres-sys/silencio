const { verifyAuth } = require('./_auth');
const { getSupabase } = require('./_supabase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const clerkId = await verifyAuth(req, res);
  if (!clerkId) return;

  const db = getSupabase();

  // Verificar estado actual del usuario
  const { data: user } = await db
    .from('users')
    .select('plan, free_used, profile_completed')
    .eq('clerk_id', clerkId)
    .single();

  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  // Solo aplica a usuarios free
  if (user.plan !== 'free') {
    return res.json({ skipped: true, reason: 'not_free' });
  }

  // Solo dar el bonus si completó el primer crédito y aún no completó el perfil
  if (user.profile_completed) {
    return res.json({ already_completed: true });
  }

  // Las 3 respuestas del perfil (guardadas para personalización futura)
  const { goal, frequency, timing } = req.body || {};
  if (!goal || !frequency || !timing) {
    return res.status(400).json({ error: 'Faltan campos del perfil' });
  }

  // Marcar perfil como completado — esto activa el bonus credit en checkUsageLimit
  const { error } = await db
    .from('users')
    .update({ profile_completed: true })
    .eq('clerk_id', clerkId);

  if (error) {
    console.error('[profile-bonus] Error actualizando perfil:', error);
    return res.status(500).json({ error: 'Error guardando perfil' });
  }

  return res.json({ success: true, bonus_credited: true });
};
