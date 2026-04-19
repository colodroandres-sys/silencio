const Stripe = require('stripe');
const { getSupabase } = require('./_supabase');

// Disable Vercel's automatic body parsing so we can access raw body for Stripe signature verification
module.exports.config = { api: { bodyParser: false } };

function getPlanByPrice(priceId) {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_ESSENTIAL_PRICE_ID) return 'essential';
  if (priceId === process.env.STRIPE_PREMIUM_PRICE_ID) return 'premium';
  if (priceId === process.env.STRIPE_ESSENTIAL_ANNUAL_PRICE_ID) return 'essential';
  if (priceId === process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID) return 'premium';
  console.error(`[webhook] priceId desconocido: ${priceId}`);
  return null;
}

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  if (webhookSecret) {
    const sig = req.headers['stripe-signature'];
    const rawBody = await getRawBody(req);
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (e) {
      console.error('[webhook] Firma inválida:', e.message);
      return res.status(400).json({ error: 'Firma inválida' });
    }
  } else {
    // Fallback si aún no está configurado STRIPE_WEBHOOK_SECRET
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      event = JSON.parse(Buffer.concat(chunks).toString());
    } catch (e) {
      return res.status(400).json({ error: 'Evento inválido' });
    }
    if (!event || !event.type || !event.data) {
      return res.status(400).json({ error: 'Evento inválido' });
    }
  }

  const db = getSupabase();

  try {
    if (event.type === 'checkout.session.completed') {
      const sessionId = event.data.object.id;
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
