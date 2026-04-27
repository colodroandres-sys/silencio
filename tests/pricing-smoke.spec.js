// Smoke test del refactor de pricing (28-abril-2026):
// valida que pricing.json carga, los helpers funcionan, y los flujos críticos
// (paywall, precheckout, post-session) inyectan precios reales en el DOM.
//
// Apunta a un servidor estático local (npm run smoke:pricing).

const { test, expect } = require('@playwright/test');

const LOCAL_BASE = 'http://localhost:8765';

test.use({ baseURL: LOCAL_BASE });

test('pricing.json carga y window.PRICING se pobla', async ({ page }) => {
  // Ignora errores de scripts externos (Clerk/Supabase) que no afectan a este test.
  page.on('pageerror', () => {});

  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

  // Esperar a que pricing.js se ejecute (síncrono, debería estar listo).
  await page.waitForFunction(() => window.PRICING && window.PRICING.plans);

  // Esperar a que el fetch de /pricing.json termine y reemplace el fallback.
  await page.waitForFunction(() => window.PRICING.version === '2026-04-28', { timeout: 5000 });

  const pricing = await page.evaluate(() => window.PRICING);
  expect(pricing.currency).toBe('USD');
  expect(pricing.plans.essential.monthly).toBe('$9.99');
  expect(pricing.plans.premium.annualTotal).toBe('$191.88');
  expect(pricing.plans.studio.annualEquiv).toBe('$31.99');
  expect(pricing.promos.essentialMonthlyFirstMonth).toBe('$6.99');
});

test('helpers de pricing devuelven valores correctos', async ({ page }) => {
  page.on('pageerror', () => {});
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.PRICING && window.PRICING.plans);

  const out = await page.evaluate(() => ({
    labelStudio:        getPlanLabel('studio'),
    labelFree:          getPlanLabel('free'),
    monthlyAnnualPrem:  getDisplayMonthly('premium', 'annual'),
    monthlyMonthEss:    getDisplayMonthly('essential', 'monthly'),
    totalAnnualStudio:  getTotalToday('studio', 'annual'),
    totalMonthEssential:getTotalToday('essential', 'monthly'),
    profileEss:         getProfilePrice('essential'),
    profileFree:        getProfilePrice('free'),
    promo:              getEssentialFirstMonthPromo()
  }));

  expect(out.labelStudio).toBe('Studio');
  expect(out.labelFree).toBe('Gratis');
  expect(out.monthlyAnnualPrem).toBe('$15.99');
  expect(out.monthlyMonthEss).toBe('$9.99');
  expect(out.totalAnnualStudio).toBe('$383.88');
  expect(out.totalMonthEssential).toBe('$9.99');
  expect(out.profileEss).toBe('$9.99/mes');
  expect(out.profileFree).toBe('—');
  expect(out.promo).toBe('$6.99');
});

test('_precheckoutCfg construye configs correctas para los 6 planes', async ({ page }) => {
  page.on('pageerror', () => {});
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof _precheckoutCfg === 'function');

  const cfgs = await page.evaluate(() => ({
    essential:        _precheckoutCfg('essential'),
    essentialAnnual:  _precheckoutCfg('essential-annual'),
    premium:          _precheckoutCfg('premium'),
    premiumAnnual:    _precheckoutCfg('premium-annual'),
    studio:           _precheckoutCfg('studio'),
    studioAnnual:     _precheckoutCfg('studio-annual'),
    bogus:            _precheckoutCfg('foo')
  }));

  expect(cfgs.essential).toEqual({ total: '$9.99', label: 'Essential', stepUp: '$9.99' });
  expect(cfgs.essentialAnnual).toEqual({ total: '$95.88', label: 'Essential', equiv: '$7.99/mes' });
  expect(cfgs.premium.stepUp).toBe('$19.99');
  expect(cfgs.premiumAnnual.total).toBe('$191.88');
  expect(cfgs.studio.total).toBe('$39.99');
  expect(cfgs.studioAnnual.equiv).toBe('$31.99/mes');
  expect(cfgs.bogus).toBeNull();
});

test('paywall renderiza precios desde PRICING al cambiar billing y plan', async ({ page }) => {
  page.on('pageerror', () => {});
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof pwSetBilling === 'function' && typeof pwSelectPlan === 'function');

  // Forzar render del paywall sin abrir modal: invocar las funciones directas.
  await page.evaluate(() => {
    pwSetBilling('annual');
    pwSelectPlan('premium');
  });

  const annualValues = await page.evaluate(() => ({
    essential: document.getElementById('pw-price-essential').textContent,
    premium:   document.getElementById('pw-price-premium').textContent,
    studio:    document.getElementById('pw-price-studio').textContent,
    cta:       document.getElementById('pw-cta-btn')?.textContent || '',
    sub:       document.getElementById('pw-cycle-essential')?.textContent || ''
  }));
  expect(annualValues.essential).toBe('$7.99');
  expect(annualValues.premium).toBe('$15.99');
  expect(annualValues.studio).toBe('$31.99');
  expect(annualValues.cta).toContain('Premium');
  expect(annualValues.sub).toContain('$95.88 hoy');

  await page.evaluate(() => pwSetBilling('monthly'));
  const monthlyValues = await page.evaluate(() => ({
    essential: document.getElementById('pw-price-essential').textContent,
    premium:   document.getElementById('pw-price-premium').textContent,
    studio:    document.getElementById('pw-price-studio').textContent
  }));
  expect(monthlyValues.essential).toBe('$9.99');
  expect(monthlyValues.premium).toBe('$19.99');
  expect(monthlyValues.studio).toBe('$39.99');
});

test('post-session hidrata CTAs guest y free con promo', async ({ page }) => {
  page.on('pageerror', () => {});
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof renderPostSession === 'function');

  await page.evaluate(() => {
    renderPostSession('guest');
    renderPostSession('free');
  });

  const ctas = await page.evaluate(() => ({
    guestCta:  document.getElementById('end-guest-cta').textContent,
    guestMeta: document.getElementById('end-guest-meta').textContent,
    freeCta:   document.getElementById('end-upsell-cta').textContent,
    freeMeta:  document.getElementById('end-upsell-meta').textContent
  }));

  expect(ctas.guestCta).toBe('Desbloquear Stillova por $6.99');
  expect(ctas.guestMeta).toBe('primer mes $6.99 · después $9.99 · cancela cuando quieras');
  expect(ctas.freeCta).toBe('Desbloquear Stillova por $6.99');
  expect(ctas.freeMeta).toBe('primer mes $6.99 · después $9.99 · cancela cuando quieras');
});
