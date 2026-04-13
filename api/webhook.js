// Stripe webhook handler
// Nota: verificamos autenticidad re-fetching la sesión desde Stripe en lugar de signature verification,
// ya que Vercel parsea el body automáticamente (no hay acceso al raw body).

const Stripe = require('stripe');
const { getSupabase } = require('./_supabase');

function getPlanByPrice(priceId) {
  if (priceId === process.env.STRIPE_PREMIUM_PRICE_ID) return 'premium';
  if (priceId === process.env.STRIPE_PLATINUM_PRICE_ID) return 'platinum';
  return null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const event = req.body;

  if (!event || !event.type || !event.data) {
    return res.status(400).json({ error: 'Evento inválido' });
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const db = getSupabase();

  try {
    if (event.type === 'checkout.session.completed') {
      const sessionId = event.data.object.id;

      // Verificar con Stripe (previene webhooks falsificados)
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['line_items']
      });

      const clerkId = session.client_reference_id;
      const priceId = session.line_items?.data?.[0]?.price?.id;
      const plan = getPlanByPrice(priceId);

      if (clerkId && plan) {
        await db.from('users').update({
          plan,
          stripe_subscription_id: session.subscription
        }).eq('clerk_id', clerkId);
        console.log(`[webhook] Usuario ${clerkId} → plan ${plan}`);
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subId = event.data.object.id;
      const sub = await stripe.subscriptions.retrieve(subId);
      const clerkId = sub.metadata?.clerk_id;

      // Solo bajar a free si la suscripción está efectivamente cancelada
      // Previene que un evento falso baje el plan de un usuario activo
      if (clerkId && (sub.status === 'canceled' || sub.status === 'unpaid' || sub.status === 'incomplete_expired')) {
        await db.from('users').update({
          plan: 'free',
          stripe_subscription_id: null
        }).eq('clerk_id', clerkId);
        console.log(`[webhook] Suscripción cancelada (status: ${sub.status}) → ${clerkId} vuelve a free`);
      } else if (clerkId) {
        console.warn(`[webhook] subscription.deleted recibido pero status es '${sub.status}' — ignorado para ${clerkId}`);
      }
    }

    if (event.type === 'customer.subscription.updated') {
      const subId = event.data.object.id;
      const sub = await stripe.subscriptions.retrieve(subId);
      const clerkId = sub.metadata?.clerk_id;

      if (clerkId && sub.status === 'active') {
        const priceId = sub.items?.data?.[0]?.price?.id;
        const plan = getPlanByPrice(priceId);
        if (plan) {
          await db.from('users').update({ plan }).eq('clerk_id', clerkId);
          console.log(`[webhook] Plan actualizado → ${clerkId}: ${plan}`);
        }
      }
    }

    res.json({ received: true });
  } catch (e) {
    console.error('[webhook] Error:', e.message);
    res.status(500).json({ error: 'Error procesando webhook' });
  }
};
