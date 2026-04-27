// Screenshot del admin cockpit nuevo (28-abril 2026).
const { chromium, devices } = require('playwright');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const ADMIN_PASSWORD = (env.match(/^ADMIN_PASSWORD="(.+)"$/m) || [])[1] || 'stillova2026';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1100, height: 1400 },
    locale: 'es-ES'
  });
  const page = await ctx.newPage();
  page.on('pageerror', err => console.error('[pageerror]', err.message));
  page.on('console', msg => { if (msg.type() === 'error') console.error('[console.error]', msg.text()); });

  await page.goto('https://www.stillova.com/admin.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#admin-password', { timeout: 8000 });
  await page.fill('#admin-password', ADMIN_PASSWORD);
  await page.click('button:has-text("Entrar")');

  await page.waitForSelector('#admin-content', { state: 'visible', timeout: 15000 });
  await page.waitForTimeout(2000);

  // Verificar que las nuevas secciones renderearon
  const data = await page.evaluate(() => ({
    healthCount:  document.querySelectorAll('#health-grid .health-card').length,
    buzonCount:   document.querySelectorAll('#buzon-list .buzon-item').length,
    buzonEmpty:   document.querySelector('#buzon-list .buzon-empty')?.textContent || '',
    errorCount:   document.querySelectorAll('#err-list .err-item').length,
    errorEmpty:   document.querySelector('#err-list .err-empty')?.textContent || '',
    quickActionsCount: document.querySelectorAll('.quick-action').length,
    mrr: document.getElementById('kpi-mrr')?.textContent,
    elClaim: Array.from(document.querySelectorAll('.health-card')).find(c => c.textContent.includes('ElevenLabs'))?.textContent.replace(/\s+/g, ' ').slice(0, 200),
  }));
  console.log('VERIFICACIÓN:', JSON.stringify(data, null, 2));

  await page.screenshot({ path: 'test-results/admin-cockpit-full.png', fullPage: true });
  console.log('Screenshot guardado');

  await browser.close();
})();
