const Stripe = require('stripe');
const { verifyAuth } = require('./_auth');
const { getOrCreateUser } = require('./_limits');
const { getSupabase } = require('./_supabase');

const PRICE_IDS = {
  premium: process.env.STRIPE_PREMIUM_PRICE_ID,
  platinum: process.env.STRIPE_PLATINUM_PRICE_ID
};

const APP_URL = 'https://silencio-xi.vercel.app';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const clerkId = await verifyAuth(req, res);
  if (!clerkId) return;

  const { plan, email } = req.body || {};

  if (!plan || !PRICE_IDS[plan]) {
    return res.status(400).json({ error: 'Plan inválido. Debe ser premium o platinum.' });
  }

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const user = await getOrCreateUser(clerkId, email);

    // Crear o recuperar customer de Stripe
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: email || undefined,
        metadata: { clerk_id: clerkId }
      });
      customerId = customer.id;
      await getSupabase()
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('clerk_id', clerkId);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
      success_url: `${APP_URL}?upgraded=${plan}`,
      cancel_url: `${APP_URL}?canceled=true`,
      client_reference_id: clerkId,
      subscription_data: {
        metadata: { clerk_id: clerkId }
      }
    });

    res.json({ url: session.url });
  } catch (e) {
    console.error('[checkout] Error:', e.message);
    res.status(500).json({ error: 'Error al crear la sesión de pago.' });
  }
};
