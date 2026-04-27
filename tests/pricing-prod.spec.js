// Smoke contra producción del refactor de pricing.
// Mismas verificaciones que pricing-smoke.spec.js, pero apunta a stillova.com.

const { test, expect } = require('@playwright/test');

test('PROD: pricing.json carga y window.PRICING se pobla', async ({ page }) => {
  page.on('pageerror', () => {});
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await page.waitForFunction(() => window.PRICING && window.PRICING.plans);
  await page.waitForFunction(() => window.PRICING.version === '2026-04-28', { timeout: 8000 });

  const pricing = await page.evaluate(() => window.PRICING);
  expect(pricing.currency).toBe('USD');
  expect(pricing.plans.essential.monthly).toBe('$9.99');
  expect(pricing.plans.premium.annualTotal).toBe('$191.88');
  expect(pricing.plans.studio.annualEquiv).toBe('$31.99');
  expect(pricing.promos.essentialMonthlyFirstMonth).toBe('$6.99');
});

test('PROD: paywall renderiza precios desde PRICING', async ({ page }) => {
  page.on('pageerror', () => {});
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof pwSetBilling === 'function' && typeof pwSelectPlan === 'function');

  await page.evaluate(() => {
    pwSetBilling('annual');
    pwSelectPlan('premium');
  });

  const annual = await page.evaluate(() => ({
    essential: document.getElementById('pw-price-essential').textContent,
    premium:   document.getElementById('pw-price-premium').textContent,
    studio:    document.getElementById('pw-price-studio').textContent,
    sub:       document.getElementById('pw-cycle-essential').textContent
  }));
  expect(annual.essential).toBe('$7.99');
  expect(annual.premium).toBe('$15.99');
  expect(annual.studio).toBe('$31.99');
  expect(annual.sub).toContain('$95.88 hoy');

  await page.evaluate(() => pwSetBilling('monthly'));
  const monthly = await page.evaluate(() => ({
    essential: document.getElementById('pw-price-essential').textContent,
    premium:   document.getElementById('pw-price-premium').textContent,
    studio:    document.getElementById('pw-price-studio').textContent
  }));
  expect(monthly.essential).toBe('$9.99');
  expect(monthly.premium).toBe('$19.99');
  expect(monthly.studio).toBe('$39.99');
});

test('PROD: precheckout cfg construye totales correctos', async ({ page }) => {
  page.on('pageerror', () => {});
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof _precheckoutCfg === 'function');

  const cfgs = await page.evaluate(() => ({
    annual: _precheckoutCfg('studio-annual'),
    monthly: _precheckoutCfg('essential')
  }));
  expect(cfgs.annual).toEqual({ total: '$383.88', label: 'Studio', equiv: '$31.99/mes' });
  expect(cfgs.monthly).toEqual({ total: '$9.99', label: 'Essential', stepUp: '$9.99' });
});

test('PROD: post-session hidrata CTAs con promo', async ({ page }) => {
  page.on('pageerror', () => {});
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof renderPostSession === 'function');

  await page.evaluate(() => {
    renderPostSession('guest');
    renderPostSession('free');
  });

  const ctas = await page.evaluate(() => ({
    guestCta:  document.getElementById('end-guest-cta').textContent,
    freeMeta:  document.getElementById('end-upsell-meta').textContent
  }));
  expect(ctas.guestCta).toBe('Desbloquear Stillova por $6.99');
  expect(ctas.freeMeta).toBe('primer mes $6.99 · después $9.99 · cancela cuando quieras');
});
