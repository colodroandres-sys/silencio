// Toma screenshots de las pantallas principales de stillova.com
// Uso: node scripts/screenshot.js [url]

const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.argv[2] || 'https://stillova.com';
const OUT_DIR = '/tmp/stillova-screenshots';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: false });
  console.log(`  ✓ ${name}.png`);
}

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function clickIfVisible(page, selector, timeout = 3000) {
  try {
    await page.waitForSelector(selector, { state: 'visible', timeout });
    await page.click(selector, { force: true });
    return true;
  } catch { return false; }
}

(async () => {
  const browser = await chromium.launch();
  console.log(`\nStillova screenshots → ${OUT_DIR}\nURL: ${BASE_URL}\n`);

  const viewports = [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'desktop', width: 1280, height: 800 },
  ];

  for (const vp of viewports) {
    console.log(`[${vp.name}]`);
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();

    // Onboarding
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await wait(1000);
    await shot(page, `${vp.name}-01-onboarding`);

    // Pasar onboarding
    await clickIfVisible(page, '#btn-start-guest, .ob-btn-primary, .ob-cta', 3000) ||
      await clickIfVisible(page, '.ob-inner button', 3000);
    await wait(800);
    await shot(page, `${vp.name}-02-home-or-create`);

    // Ir a crear
    await clickIfVisible(page, '#nav-create', 2000) ||
      await clickIfVisible(page, '[onclick*="showCreate"]', 2000);
    await wait(800);
    await shot(page, `${vp.name}-03-create`);

    // Abrir paywall si hay botón de paywall visible
    const hasPaywall = await page.$('#paywall-modal.active');
    if (hasPaywall) await shot(page, `${vp.name}-04-paywall`);

    await ctx.close();
  }

  await browser.close();
  console.log(`\nDone → ${OUT_DIR}`);
})();
