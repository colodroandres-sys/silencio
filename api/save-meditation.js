const { verifyAuth } = require('./_auth');
const { getSupabase } = require('./_supabase');

// Límite de meditaciones guardadas por plan (null = ilimitado)
const SAVE_LIMITS = {
  free: 0,
  essential: 5,
  premium: 20,
  studio: null
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const clerkId = await verifyAuth(req, res);
  if (!clerkId) return;

  const db = getSupabase();
  const { meditationId, action, path: audioPath } = req.body || {};

  if (!meditationId) return res.status(400).json({ error: 'meditationId requerido' });
  if (!action) return res.status(400).json({ error: 'action requerida' });

  // Verificar que la meditación existe y pertenece al usuario
  const { data: meditation } = await db
    .from('meditations')
    .select('id, clerk_id, is_saved')
    .eq('id', meditationId)
    .single();

  if (!meditation || meditation.clerk_id !== clerkId) {
    return res.status(404).json({ error: 'Meditación no encontrada' });
  }

  // ── Presign: verificar límites y generar URL de subida ──────────────
  if (action === 'presign') {
    if (meditation.is_saved) {
      return res.json({ already_saved: true });
    }

    const { data: user } = await db
      .from('users')
      .select('plan')
      .eq('clerk_id', clerkId)
      .single();

    const plan = user?.plan || 'free';
    const limit = SAVE_LIMITS[plan];

    if (limit === 0) {
      return res.status(403).json({
        error: 'El plan gratuito no permite guardar meditaciones',
        reason: 'free_plan'
      });
    }

    if (limit !== null) {
      const { count } = await db
        .from('meditations')
        .select('id', { count: 'exact', head: true })
        .eq('clerk_id', clerkId)
        .eq('is_saved', true);

      if (count >= limit) {
        return res.status(403).json({
          error: `Límite de ${limit} meditaciones guardadas alcanzado`,
          reason: 'save_limit',
          plan,
          limit
        });
      }
    }

    // Generar URL de subida firmada para Supabase Storage
    const uploadPath = `${clerkId}/${meditationId}.mp3`;
    const { data: uploadData, error: uploadError } = await db.storage
      .from('meditations')
      .createSignedUploadUrl(uploadPath);

    if (uploadError) {
      console.error('[save-meditation] Error generando signed URL:', uploadError);
      return res.status(500).json({ error: 'Error generando URL de subida' });
    }

    return res.json({
      signedUrl: uploadData.signedUrl,
      path: uploadPath
    });
  }

  // ── Confirm: audio subido, marcar como guardada ─────────────────────
  if (action === 'confirm') {
    await db
      .from('meditations')
      .update({
        is_saved: true,
        audio_path: audioPath || null
      })
      .eq('id', meditationId);

    const { count } = await db
      .from('meditations')
      .select('id', { count: 'exact', head: true })
      .eq('clerk_id', clerkId)
      .eq('is_saved', true);

    return res.json({ saved: true, savedCount: count });
  }

  return res.status(400).json({ error: 'Acción no reconocida' });
};
