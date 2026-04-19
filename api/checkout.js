const Stripe = require('stripe');
const { verifyAuth } = require('./_auth');
const { getOrCreateUser } = require('./_limits');
const { getSupabase } = require('./_supabase');

const PRICE_IDS = {
  essential:         process.env.STRIPE_ESSENTIAL_PRICE_ID,
  'essential-annual': process.env.STRIPE_ESSENTIAL_ANNUAL_PRICE_ID,
  premium:           process.env.STRIPE_PREMIUM_PRICE_ID,
  'premium-annual':  process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID,
};

// Coupons de descuento primer mes (creados en Stripe dashboard, duration: once)
// Essential: €3.00 off → primer mes €6.99 en vez de €9.99
// Premium:   €6.00 off → primer mes €13.99 en vez de €19.99
const WELCOME_COUPONS = {
  essential: process.env.STRIPE_COUPON_WELCOME_ESSENTIAL,
  premium:   process.env.STRIPE_COUPON_WELCOME_PREMIUM,
};

const APP_URL = 'https://stillova.com';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const clerkId = await verifyAuth(req, res);
  if (!clerkId) return;

  const { plan, email } = req.body || {};

  if (!plan || !PRICE_IDS[plan]) {
    return res.status(400).json({ error: 'Plan inválido.' });
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

    const isAnnual   = plan.includes('annual');
    const basePlan   = plan.replace('-annual', '');
    const successPlan = basePlan; // 'essential' o 'premium' siempre

    const sessionParams = {
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
      success_url: `${APP_URL}?upgraded=${successPlan}`,
      cancel_url: `${APP_URL}?canceled=true`,
      client_reference_id: clerkId,
      subscription_data: { metadata: { clerk_id: clerkId } }
    };

    // Descuento bienvenida solo en planes mensuales
    if (!isAnnual && WELCOME_COUPONS[basePlan]) {
      sessionParams.discounts = [{ coupon: WELCOME_COUPONS[basePlan] }];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    res.json({ url: session.url });
  } catch (e) {
    console.error('[checkout] Error:', e.message);
    res.status(500).json({ error: 'Error al crear la sesión de pago.' });
  }
};
