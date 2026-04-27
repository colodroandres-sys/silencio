const { verifyAuth } = require('./_auth');
const { getOrCreateUser } = require('./_limits');
const { lsFetch, getStoreId } = require('./_lemonsqueezy');

const VARIANT_IDS = {
  essential:           process.env.LEMONSQUEEZY_VARIANT_ESSENTIAL,
  'essential-annual':  process.env.LEMONSQUEEZY_VARIANT_ESSENTIAL_ANNUAL,
  premium:             process.env.LEMONSQUEEZY_VARIANT_PREMIUM,
  'premium-annual':    process.env.LEMONSQUEEZY_VARIANT_PREMIUM_ANNUAL,
  studio:              process.env.LEMONSQUEEZY_VARIANT_STUDIO,
  'studio-annual':     process.env.LEMONSQUEEZY_VARIANT_STUDIO_ANNUAL,
};

const WELCOME_DISCOUNT_CODES = {
  essential: process.env.LEMONSQUEEZY_DISCOUNT_WELCOME_ESSENTIAL,
  premium:   process.env.LEMONSQUEEZY_DISCOUNT_WELCOME_PREMIUM,
  studio:    process.env.LEMONSQUEEZY_DISCOUNT_WELCOME_STUDIO,
};

const APP_URL = 'https://stillova.com';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const clerkId = await verifyAuth(req, res);
  if (!clerkId) return;

  const { plan, email } = req.body || {};

  if (!plan || !VARIANT_IDS[plan]) {
    return res.status(400).json({ error: 'Plan inválido.' });
  }

  try {
    const isAnnual = plan.includes('annual');
    const basePlan = plan.replace('-annual', '');

    await getOrCreateUser(clerkId, email);

    const checkoutData = {
      custom: {
        clerk_id: clerkId,
        plan: basePlan,
        billing: isAnnual ? 'annual' : 'monthly'
      }
    };
    if (email) checkoutData.email = email;

    const discountCode = !isAnnual ? WELCOME_DISCOUNT_CODES[basePlan] : null;
    if (discountCode) checkoutData.discount_code = discountCode;

    const body = {
      data: {
        type: 'checkouts',
        attributes: {
          checkout_data: checkoutData,
          product_options: {
            redirect_url: `${APP_URL}?upgraded=${basePlan}`,
            receipt_button_text: 'Volver a Stillova',
            receipt_thank_you_note: 'Bienvenido a Stillova.'
          },
          checkout_options: {
            embed: false,
            media: false,
            logo: true
          }
        },
        relationships: {
          store:   { data: { type: 'stores',   id: getStoreId() } },
          variant: { data: { type: 'variants', id: String(VARIANT_IDS[plan]) } }
        }
      }
    };

    const json = await lsFetch('/checkouts', { method: 'POST', body });
    const url = json?.data?.attributes?.url;

    if (!url) {
      console.error('[checkout] LS sin URL en respuesta:', json);
      return res.status(500).json({ error: 'Error al crear la sesión de pago.' });
    }

    res.json({ url });
  } catch (e) {
    console.error('[checkout] Error:', e.message, e.body || '');
    res.status(500).json({ error: 'Error al crear la sesión de pago.' });
  }
};
