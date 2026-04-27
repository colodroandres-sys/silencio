// Screenshot del paywall con precios hidratados desde /pricing.json (post-refactor 28-abril 2026).
const { chromium, devices } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    ...devices['iPhone 14'],
    locale: 'es-ES'
  });
  const page = await ctx.newPage();
  page.on('pageerror', () => {});

  await page.goto('https://www.stillova.com/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.PRICING && window.PRICING.version === '2026-04-28', { timeout: 8000 });
  await page.evaluate(() => {
    pwSetBilling('annual');
    pwSelectPlan('premium');
    showPaywall();
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'test-results/pricing-paywall-annual.png', fullPage: true });

  await page.evaluate(() => pwSetBilling('monthly'));
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/pricing-paywall-monthly.png', fullPage: true });

  await page.evaluate(() => {
    closePaywall();
    renderPostSession('guest');
    document.getElementById('end-guest').style.display = '';
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/pricing-post-session-guest.png', fullPage: true });

  await browser.close();
  console.log('OK — 3 screenshots en test-results/');
})();
