// Toma screenshots del flujo completo de Stillova + competidores
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

async function waitFor(page, selector, timeout = 5000) {
  try { await page.waitForSelector(selector, { state: 'visible', timeout }); return true; }
  catch { return false; }
}

async function clickIfVisible(page, selector, timeout = 3000) {
  try {
    await page.waitForSelector(selector, { state: 'visible', timeout });
    await page.click(selector, { force: true });
    return true;
  } catch { return false; }
}

async function setupApiMocks(page) {
  await page.route('/api/meditation', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        title: 'Un momento solo para ti',
        text: 'Cierra los ojos. Respira profundamente. Este momento es tuyo.',
        targetWords: 750,
        silenceTotal: 30,
        resolvedVoice: 'feminine'
      })
    });
  });

  const silentMp3 = 'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

  await page.route('/api/audio', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        audioBase64: silentMp3,
        meditationId: 'test-meditation-screenshot',
        silenceMap: [],
        totalDuration: 10
      })
    });
  });
}

async function injectPlayerState(page, title = 'Un momento solo para ti') {
  await page.evaluate((t) => {
    if (typeof state !== 'undefined') {
      state.totalSec = 300;
      state.duration = '5';
      state.currentSec = 90;
    }
    const titleEl   = document.getElementById('session-title');
    const timeEnd   = document.getElementById('time-end');
    const timeNow   = document.getElementById('time-now');
    const countdown = document.getElementById('time-countdown');
    const fill      = document.getElementById('progress-fill');
    const ring      = document.getElementById('player-ring-fill');
    if (titleEl)   titleEl.textContent = t;
    if (timeEnd)   timeEnd.textContent = '5:00';
    if (timeNow)   timeNow.textContent = '1:30';
    if (countdown) countdown.textContent = '3:30';
    if (fill)      fill.style.width = '30%';
    if (ring)      ring.style.strokeDashoffset = String(753.98 * 0.70);
    if (typeof showScreen === 'function') showScreen('screen-player');
  }, title);
}

async function injectEndState(page, endId) {
  await page.evaluate((id) => {
    ['end-save','end-profile','end-upsell','end-guest'].forEach(el => {
      const node = document.getElementById(el);
      if (node) node.style.display = 'none';
    });
    const target = document.getElementById(id);
    if (target) { target.style.display = 'flex'; }
    const endMsg = document.getElementById('end-message');
    const btnNew = document.getElementById('btn-new-meditation');
    if (endMsg) endMsg.style.display = 'none';
    if (btnNew) btnNew.style.display = 'none';
    document.getElementById('screen-player')?.classList.add('end-active');
  }, endId);
}

async function screenshotStillova(browser, vp) {
  console.log(`\n[Stillova — ${vp.name}]`);

  // ── 1. ONBOARDING: flujo nuevo (paso 1 → objetivo → paywall) ──
  {
    const ctx  = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await shot(page, `${vp.name}-01-onboarding-temas`);

    // Seleccionar algunos chips
    await page.evaluate(() => {
      document.querySelector('#ob-topics .ob-chip')?.click();
      document.querySelectorAll('#ob-topics .ob-chip')[2]?.click();
    });
    await page.waitForTimeout(300);
    await shot(page, `${vp.name}-02-onboarding-temas-seleccionados`);

    // Continuar → paso objetivo (antes era paso 2 voz, ahora es directo a paso 3)
    await clickIfVisible(page, '.ob-step.active .ob-btn-primary', 3000);
    await page.waitForTimeout(600);
    await shot(page, `${vp.name}-03-onboarding-objetivo`);

    // Seleccionar objetivo
    await clickIfVisible(page, '.ob-goal-card', 2000);
    await page.waitForTimeout(300);

    // Continuar → paywall
    await clickIfVisible(page, '#ob-3-next', 2000);
    await page.waitForTimeout(600);
    await shot(page, `${vp.name}-04-onboarding-paywall`);

    await ctx.close();
  }

  // ── 2. HOME guest (sin onboarding) ──
  {
    const ctx  = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.setItem('stillova_ob_done', '1'));
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await shot(page, `${vp.name}-05-home-guest`);

    // ── 3. PANTALLA CREAR: nuevo flujo (texto → config, sin intent) ──
    await clickIfVisible(page, '.nav-create-btn', 3000);
    await page.waitForTimeout(800);
    await shot(page, `${vp.name}-06-create-vacio`);

    await page.focus('#input-free');
    await page.type('#input-free', 'Tengo mucha ansiedad hoy, me cuesta respirar y no puedo parar de pensar en todo', { delay: 12 });
    await page.waitForTimeout(400);
    await shot(page, `${vp.name}-07-create-texto-escrito`);

    // Continuar → config (ya no hay paso de intent)
    await clickIfVisible(page, '#btn-continue-input', 2000);
    await page.waitForTimeout(700);
    await shot(page, `${vp.name}-08-create-config`);

    // Scroll para ver toda la config
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'smooth' }));
    await page.waitForTimeout(400);
    await shot(page, `${vp.name}-09-create-config-scroll`);

    await ctx.close();
  }

  // ── 4. PLAYER + END STATES (mocks API) ──
  {
    const ctx  = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await setupApiMocks(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem('stillova_ob_done', '1');
      localStorage.removeItem('stillova_guest_used');
    });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Inyectar player directamente
    await injectPlayerState(page, 'Un momento solo para ti');
    await page.waitForTimeout(800);
    await shot(page, `${vp.name}-10-player-progreso`);

    // End state — guest
    await injectEndState(page, 'end-guest');
    await page.waitForTimeout(500);
    await shot(page, `${vp.name}-11-end-guest`);

    // End state — upsell
    await injectEndState(page, 'end-upsell');
    await page.waitForTimeout(500);
    await shot(page, `${vp.name}-12-end-upsell`);

    await ctx.close();
  }
}

async function screenshotCompetitor(browser, name, url, steps) {
  console.log(`\n[${name}]`);
  const ctx  = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2500);
    await shot(page, `comp-${name}-01-landing`);

    for (const step of steps) {
      await step(page);
    }
  } catch (e) {
    console.log(`  ⚠ ${name}: ${e.message.split('\n')[0]}`);
  }
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  console.log(`\nScreenshots → ${OUT_DIR}\n`);

  // ── Stillova mobile ──
  await screenshotStillova(browser, { name: 'mobile', width: 390, height: 844 });

  // ── Competidores (solo mobile) ──

  await screenshotCompetitor(browser, 'stillmind', 'https://getstillmind.com', [
    async (page) => {
      await page.waitForTimeout(1500);
      await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'smooth' }));
      await page.waitForTimeout(800);
      await page.screenshot({ path: '/tmp/stillova-screenshots/comp-stillmind-02-scroll.png' });
      console.log('  ✓ comp-stillmind-02-scroll.png');
      await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'smooth' }));
      await page.waitForTimeout(800);
      await page.screenshot({ path: '/tmp/stillova-screenshots/comp-stillmind-03-testimonios.png' });
      console.log('  ✓ comp-stillmind-03-testimonios.png');
    }
  ]);

  await screenshotCompetitor(browser, 'downdog', 'https://meditation.downdogapp.com', [
    async (page) => {
      await page.waitForTimeout(2000);
      await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'smooth' }));
      await page.waitForTimeout(800);
      await page.screenshot({ path: '/tmp/stillova-screenshots/comp-downdog-02-scroll.png' });
      console.log('  ✓ comp-downdog-02-scroll.png');
    }
  ]);

  await screenshotCompetitor(browser, 'insighttimer', 'https://insighttimer.com', [
    async (page) => {
      await page.waitForTimeout(2000);
      await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'smooth' }));
      await page.waitForTimeout(800);
      await page.screenshot({ path: '/tmp/stillova-screenshots/comp-insighttimer-02-scroll.png' });
      console.log('  ✓ comp-insighttimer-02-scroll.png');
    }
  ]);

  await browser.close();
  console.log(`\n✅ Done → ${OUT_DIR}`);
})();
