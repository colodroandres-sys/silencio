// Toma screenshots del flujo completo de stillova.com
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
  try {
    await page.waitForSelector(selector, { state: 'visible', timeout });
    return true;
  } catch { return false; }
}

async function clickIfVisible(page, selector, timeout = 3000) {
  try {
    await page.waitForSelector(selector, { state: 'visible', timeout });
    await page.click(selector, { force: true });
    return true;
  } catch { return false; }
}

// Mocks de API para simular generación sin costos reales
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

  // MP3 silencioso mínimo (1 segundo, 8kHz)
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

// Simula el estado del player directamente (sin llamar APIs reales)
async function injectPlayerState(page, title = 'Un momento solo para ti') {
  await page.evaluate((t) => {
    if (typeof state !== 'undefined') {
      state.totalSec = 300;
      state.duration = '5';
      state.currentSec = 0;
    }
    const titleEl = document.getElementById('session-title');
    const timeEnd  = document.getElementById('time-end');
    const timeNow  = document.getElementById('time-now');
    const countdown = document.getElementById('time-countdown');
    if (titleEl) titleEl.textContent = t;
    if (timeEnd) timeEnd.textContent = '5:00';
    if (timeNow) timeNow.textContent = '0:00';
    if (countdown) countdown.textContent = '5:00';
    if (typeof showScreen === 'function') showScreen('screen-player');
  }, title);
}

// Simula el estado de fin de sesión (upsell guest)
async function injectEndState(page, endId) {
  await page.evaluate((id) => {
    ['end-save','end-profile','end-upsell','end-guest'].forEach(el => {
      const node = document.getElementById(el);
      if (node) node.style.display = 'none';
    });
    const target = document.getElementById(id);
    if (target) target.style.display = 'block';
    const endMsg = document.getElementById('end-message');
    const btnNew  = document.getElementById('btn-new-meditation');
    if (endMsg) endMsg.style.display = 'block';
    if (btnNew) btnNew.style.display = 'block';
  }, endId);
}

(async () => {
  const browser = await chromium.launch();
  console.log(`\nStillova screenshots → ${OUT_DIR}\nURL: ${BASE_URL}\n`);

  const viewports = [
    { name: 'mobile',  width: 390,  height: 844 },
    { name: 'desktop', width: 1280, height: 800 },
  ];

  for (const vp of viewports) {
    console.log(`[${vp.name}]`);

    // ── 1. Onboarding (estado limpio) ────────────────────────────
    {
      const ctx  = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);
      await shot(page, `${vp.name}-01-onboarding-step1`);

      await clickIfVisible(page, '.ob-btn-primary', 3000);
      await page.waitForTimeout(600);
      await shot(page, `${vp.name}-02-onboarding-step2-voz`);

      await clickIfVisible(page, '.ob-btn-primary', 3000);
      await page.waitForTimeout(600);
      await shot(page, `${vp.name}-03-onboarding-step3-objetivo`);

      await clickIfVisible(page, '.ob-goal-card', 2000);
      await page.waitForTimeout(300);
      await clickIfVisible(page, '#ob-3-next', 2000);
      await page.waitForTimeout(600);
      await shot(page, `${vp.name}-04-onboarding-step4-duracion`);

      await clickIfVisible(page, '.ob-btn-primary', 3000);
      await page.waitForTimeout(700);
      await shot(page, `${vp.name}-05-onboarding-paywall`);

      await ctx.close();
    }

    // ── 2. Home guest (sin onboarding) ───────────────────────────
    {
      const ctx  = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => localStorage.setItem('stillova_ob_done', '1'));
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      await shot(page, `${vp.name}-06-home-guest`);

      // ── 3. Pantalla crear — paso 1 ──────────────────────────
      await clickIfVisible(page, '.nav-create-btn', 3000);
      await page.waitForTimeout(800);
      await shot(page, `${vp.name}-07-create-input`);

      // Escribir texto con typing realista
      await page.focus('#input-free');
      await page.type('#input-free', 'Tengo mucha ansiedad hoy, me cuesta respirar y no puedo parar de pensar en todo lo que tengo pendiente', { delay: 18 });
      await page.waitForTimeout(400);
      await shot(page, `${vp.name}-08-create-texto-escrito`);

      await clickIfVisible(page, '#btn-continue-input', 2000);
      await page.waitForTimeout(600);
      await shot(page, `${vp.name}-09-create-intent`);

      // Seleccionar intent "Calmarme"
      const intentCards = await page.$$('.intent-card');
      if (intentCards.length >= 3) await intentCards[2].click();
      await page.waitForTimeout(600);
      await shot(page, `${vp.name}-10-create-config`);

      // ── 4. Paywall modal ─────────────────────────────────────
      const lockedPill = await page.$('#grp-duration .pill-locked');
      if (lockedPill) {
        await lockedPill.click();
        await page.waitForTimeout(600);
        const paywallVisible = await page.$('#paywall-modal.active');
        if (paywallVisible) {
          await shot(page, `${vp.name}-11-paywall-modal`);
          await clickIfVisible(page, '.paywall-close', 2000);
          await page.waitForTimeout(400);
        }
      }

      await ctx.close();
    }

    // ── 5. Flujo generación simulada → player → end states ───────
    {
      const ctx  = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      await setupApiMocks(page);

      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        localStorage.setItem('stillova_ob_done', '1');
        // Simular usuario sin créditos gastados (puede generar)
        localStorage.removeItem('stillova_guest_used');
      });
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);

      // Ir a crear
      await clickIfVisible(page, '.nav-create-btn', 3000);
      await page.waitForTimeout(600);
      await page.type('#input-free', 'Necesito calmarme antes de una reunión importante', { delay: 15 });
      await page.waitForTimeout(300);
      await clickIfVisible(page, '#btn-continue-input', 2000);
      await page.waitForTimeout(500);
      await clickIfVisible(page, '.intent-card', 2000);
      await page.waitForTimeout(500);

      // Click en generar → loading screen
      const generateBtn = await page.$('#btn-generate');
      if (generateBtn) {
        await generateBtn.click({ force: true });
        const loadingVisible = await waitFor(page, '#screen-loading.active', 4000);
        if (loadingVisible) {
          await page.waitForTimeout(800);
          await shot(page, `${vp.name}-12-loading`);
        }
        // Esperar player (API mockeada responde rápido)
        const playerVisible = await waitFor(page, '#screen-player.active', 8000);
        if (playerVisible) {
          await page.waitForTimeout(600);
          await shot(page, `${vp.name}-13-player-inicio`);
        } else {
          // Fallback: inyectar player directamente
          await injectPlayerState(page);
          await page.waitForTimeout(600);
          await shot(page, `${vp.name}-13-player-inicio`);
        }
      } else {
        await injectPlayerState(page);
        await page.waitForTimeout(600);
        await shot(page, `${vp.name}-13-player-inicio`);
      }

      // End state — guest (sin cuenta)
      await injectEndState(page, 'end-guest');
      await page.waitForTimeout(500);
      await shot(page, `${vp.name}-14-end-guest`);

      // End state — upsell (usuario con cuenta, sin plan)
      await injectEndState(page, 'end-upsell');
      await page.waitForTimeout(500);
      await shot(page, `${vp.name}-15-end-upsell`);

      await ctx.close();
    }
  }

  await browser.close();
  console.log(`\nDone → ${OUT_DIR}`);
})();
