const { getSupabase } = require('./_supabase');
const { verifyWebhookSignature, getPlanByVariantId } = require('./_lemonsqueezy');

module.exports.config = { api: { bodyParser: false } };

async function trackEvent(event, props = {}) {
  const key = process.env.POSTHOG_SERVER_KEY || process.env.POSTHOG_KEY;
  if (!key) return;
  try {
    await fetch('https://eu.i.posthog.com/capture/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        event,
        distinct_id: props.clerkId || 'webhook',
        properties: { ...props, source: 'webhook' }
      })
    });
  } catch (_) { /* no bloquear webhook por analytics */ }
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

  if (!process.env.LEMONSQUEEZY_WEBHOOK_SECRET) {
    console.error('[webhook] LEMONSQUEEZY_WEBHOOK_SECRET no configurado — rechazando evento');
    return res.status(503).json({ error: 'Webhook no configurado' });
  }

  const rawBody = await getRawBody(req);
  const sig = req.headers['x-signature'];

  let valid;
  try {
    valid = verifyWebhookSignature(rawBody, sig);
  } catch (e) {
    console.error('[webhook] Error verificando firma:', e.message);
    return res.status(500).json({ error: 'Error interno' });
  }
  if (!valid) {
    console.error('[webhook] Firma inválida');
    return res.status(401).json({ error: 'Firma inválida' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch (e) {
    console.error('[webhook] JSON inválido:', e.message);
    return res.status(400).json({ error: 'JSON inválido' });
  }

  const eventName = payload?.meta?.event_name;
  const custom    = payload?.meta?.custom_data || {};
  const data      = payload?.data || {};
  const attrs     = data?.attributes || {};
  const subId     = data?.type === 'subscriptions' ? data.id : null;
  const clerkId   = custom.clerk_id;

  const db = getSupabase();

  try {
    if (eventName === 'subscription_created' || eventName === 'subscription_updated') {
      const variantId = attrs.variant_id;
      const plan = getPlanByVariantId(variantId);
      const status = attrs.status;
      const customerId = attrs.customer_id;

      if (!clerkId) {
        console.warn(`[webhook] ${eventName} sin clerk_id en custom_data — sub ${subId}`);
        return res.json({ received: true });
      }

      const update = {};
      if (plan) update.plan = plan;
      if (subId) update.lemonsqueezy_subscription_id = String(subId);
      if (customerId) update.lemonsqueezy_customer_id = String(customerId);

      if (status === 'active' || status === 'on_trial') {
        update.subscription_status = 'active';
      } else if (status === 'past_due' || status === 'unpaid') {
        update.subscription_status = status;
      } else if (status === 'paused') {
        update.subscription_status = 'paused';
      } else if (status === 'cancelled') {
        update.subscription_status = 'cancelled';
      } else if (status === 'expired') {
        update.plan = 'free';
        update.subscription_status = 'expired';
        update.lemonsqueezy_subscription_id = null;
      }

      await db.from('users').update(update).eq('clerk_id', clerkId);
      console.log(`[webhook] ${eventName} → ${clerkId} plan=${update.plan} status=${update.subscription_status}`);

      if (eventName === 'subscription_created') {
        await trackEvent('plan_upgraded', { clerkId, plan, status });
      }
    }

    else if (eventName === 'subscription_cancelled') {
      if (!clerkId) return res.json({ received: true });
      await db.from('users')
        .update({ subscription_status: 'cancelled' })
        .eq('clerk_id', clerkId);
      console.log(`[webhook] subscription_cancelled → ${clerkId} (acceso hasta ends_at)`);
      await trackEvent('plan_cancelled', { clerkId, status: 'cancelled' });
    }

    else if (eventName === 'subscription_expired') {
      if (!clerkId) return res.json({ received: true });
      await db.from('users').update({
        plan: 'free',
        subscription_status: 'expired',
        lemonsqueezy_subscription_id: null
      }).eq('clerk_id', clerkId);
      console.log(`[webhook] subscription_expired → ${clerkId} a free`);
      await trackEvent('plan_expired', { clerkId });
    }

    else if (eventName === 'subscription_payment_failed') {
      if (!clerkId) return res.json({ received: true });
      await db.from('users')
        .update({ subscription_status: 'past_due' })
        .eq('clerk_id', clerkId);
      console.log(`[webhook] payment_failed → ${clerkId} past_due`);
    }

    else if (eventName === 'subscription_payment_success') {
      if (!clerkId) return res.json({ received: true });
      await db.from('users')
        .update({ subscription_status: 'active' })
        .eq('clerk_id', clerkId);
      console.log(`[webhook] payment_success → ${clerkId} active`);
    }

    res.json({ received: true });
  } catch (e) {
    console.error('[webhook] Error procesando:', e.message);
    res.status(500).json({ error: 'Error procesando webhook' });
  }
};
