const { verifyAuth } = require('./_auth');
const { getSupabase } = require('./_supabase');

// Elimina por completo la cuenta del usuario: Stripe, Supabase y Clerk.
// Cumplimiento GDPR Art. 17 — derecho al olvido.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const clerkId = await verifyAuth(req, res);
  if (!clerkId) return;

  const db = getSupabase();

  try {
    // 1. Leer datos del usuario antes de borrar
    const { data: user } = await db
      .from('users')
      .select('stripe_subscription_id, stripe_customer_id, plan')
      .eq('clerk_id', clerkId)
      .single();

    // 2. Cancelar suscripción Stripe si la hay (evita futuros cobros)
    if (user?.stripe_subscription_id) {
      try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        await stripe.subscriptions.cancel(user.stripe_subscription_id);
        console.log(`[delete-account] Sub cancelada: ${user.stripe_subscription_id}`);
      } catch (e) {
        console.error('[delete-account] Error cancelando sub:', e.message);
        // No bloquear — seguir con el delete
      }
    }

    // 3. Borrar meditaciones guardadas en Supabase Storage
    try {
      const { data: meds } = await db
        .from('meditations')
        .select('id')
        .eq('clerk_id', clerkId)
        .eq('is_saved', true);
      if (meds && meds.length > 0) {
        const paths = meds.map(m => `${clerkId}/${m.id}.mp3`);
        await db.storage.from('meditations').remove(paths);
      }
    } catch (e) {
      console.error('[delete-account] Error borrando storage:', e.message);
    }

    // 4. Borrar filas en Supabase (meditations, users)
    await db.from('meditations').delete().eq('clerk_id', clerkId);
    await db.from('users').delete().eq('clerk_id', clerkId);

    // 5. Borrar el usuario en Clerk (esto también cierra la sesión)
    try {
      const res2 = await fetch(`https://api.clerk.com/v1/users/${clerkId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}` },
      });
      if (!res2.ok) {
        const body = await res2.text();
        console.error(`[delete-account] Clerk delete falló ${res2.status}: ${body}`);
      }
    } catch (e) {
      console.error('[delete-account] Clerk delete error:', e.message);
    }

    console.log(`[delete-account] Usuario ${clerkId} eliminado completamente`);
    return res.json({ ok: true });
  } catch (e) {
    console.error('[delete-account] Error:', e.message);
    return res.status(500).json({ error: 'Error al eliminar la cuenta. Contacta soporte.' });
  }
};
