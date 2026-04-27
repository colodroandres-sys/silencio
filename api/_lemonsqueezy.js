const crypto = require('crypto');

const LS_API = 'https://api.lemonsqueezy.com/v1';

function getApiKey() {
  const k = process.env.LEMONSQUEEZY_API_KEY;
  if (!k) throw new Error('LEMONSQUEEZY_API_KEY missing');
  return k;
}

function getStoreId() {
  const id = process.env.LEMONSQUEEZY_STORE_ID;
  if (!id) throw new Error('LEMONSQUEEZY_STORE_ID missing');
  return String(id);
}

async function lsFetch(path, { method = 'GET', body } = {}) {
  const r = await fetch(`${LS_API}${path}`, {
    method,
    headers: {
      'Accept': 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      'Authorization': `Bearer ${getApiKey()}`
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) {}
  if (!r.ok) {
    const err = new Error(`LS ${method} ${path} → ${r.status}`);
    err.status = r.status;
    err.body = json || text;
    throw err;
  }
  return json;
}

function verifyWebhookSignature(rawBody, signatureHeader) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) throw new Error('LEMONSQUEEZY_WEBHOOK_SECRET missing');
  if (!signatureHeader) return false;
  const computed = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(signatureHeader, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const VARIANT_TO_PLAN = () => ({
  [process.env.LEMONSQUEEZY_VARIANT_ESSENTIAL]:         'essential',
  [process.env.LEMONSQUEEZY_VARIANT_ESSENTIAL_ANNUAL]:  'essential',
  [process.env.LEMONSQUEEZY_VARIANT_PREMIUM]:           'premium',
  [process.env.LEMONSQUEEZY_VARIANT_PREMIUM_ANNUAL]:    'premium',
  [process.env.LEMONSQUEEZY_VARIANT_STUDIO]:            'studio',
  [process.env.LEMONSQUEEZY_VARIANT_STUDIO_ANNUAL]:     'studio',
});

function getPlanByVariantId(variantId) {
  if (!variantId) return null;
  const map = VARIANT_TO_PLAN();
  return map[String(variantId)] || null;
}

module.exports = {
  lsFetch,
  verifyWebhookSignature,
  getPlanByVariantId,
  getStoreId,
};
