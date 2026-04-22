const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const OUT = '/tmp/stillova-audit';
fs.mkdirSync(OUT, { recursive: true });

const URL = 'https://stillova.com';

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
  console.log(`✓ ${name}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const vp = { width: 390, height: 844 };

  // ── 1. HOME GUEST (paleta Clay) ──
  {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.setItem('stillova_ob_done', '1'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await shot(page, '01-home-guest');

    // ── 2. PAYWALL (abrir desde CTA) ──
    await page.evaluate(() => showPaywall && showPaywall());
    await page.waitForTimeout(700);
    await shot(page, '02-paywall-mensual');

    // Toggle anual
    await page.evaluate(() => pwSetBilling && pwSetBilling('annual'));
    await page.waitForTimeout(400);
    await shot(page, '03-paywall-anual');

    await ctx.close();
  }

  // ── 3. PANTALLA CREAR ──
  {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.setItem('stillova_ob_done', '1'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.evaluate(() => showCreate && showCreate());
    await page.waitForTimeout(700);
    await shot(page, '04-create-vacio');

    // Escribir texto
    await page.fill('#input-free', 'Tengo mucha ansiedad hoy, no puedo parar de pensar en trabajo y no consigo relajarme');
    await page.waitForTimeout(400);
    await shot(page, '05-create-con-texto');

    // Continuar a config
    await page.evaluate(() => {
      const btn = document.getElementById('btn-continue-input');
      if (btn) btn.click();
    });
    await page.waitForTimeout(800);
    await shot(page, '06-create-config');

    await ctx.close();
  }

  // ── 4. PERFIL GUEST ──
  {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.setItem('stillova_ob_done', '1'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.evaluate(() => openProfile && openProfile());
    await page.waitForTimeout(600);
    await shot(page, '07-perfil-guest');
    await ctx.close();
  }

  // ── 5. PERFIL USUARIO SIMULADO (plan essential) ──
  {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem('stillova_ob_done', '1');
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    // Simular usuario logueado + plan essential
    await page.evaluate(() => {
      state.userPlan = 'essential';
      state.creditsRemaining = 7;
      state.creditsUsed = 3;
      gamData = { streak: 4, totalMinutes: 45, sessions: 9, weekMinutes: 25, level: 2, levelName: 'Practicante', weekHistory: [1,1,0,1,1,0,0] };
      // Simular clerk.user
      window.clerk = { user: { firstName: 'Andrés', username: 'acolodro', createdAt: new Date('2025-01-15').getTime() } };
      openProfile();
    });
    await page.waitForTimeout(800);
    await shot(page, '08-perfil-essential');

    await ctx.close();
  }

  // ── 6. BUZÓN ──
  {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.setItem('stillova_ob_done', '1'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.evaluate(() => openBuzon && openBuzon());
    await page.waitForTimeout(600);
    await shot(page, '09-buzon-vacio');

    // Seleccionar categoría y escribir
    await page.evaluate(() => buzonSelectCat && buzonSelectCat('mejora'));
    await page.waitForTimeout(300);
    await page.fill('#buzon-textarea', 'Me encantaría poder elegir el tipo de fondo musical durante la sesión, algo más personalizable');
    await page.waitForTimeout(400);
    await shot(page, '10-buzon-completo');

    await ctx.close();
  }

  // ── 7. PLAYER (mock) ──
  {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    await page.route('/api/meditation', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ title: 'Tu momento de calma', text: 'Cierra los ojos.', targetWords: 750, silenceTotal: 30, resolvedVoice: 'feminine' })
    }));
    await page.route('/api/audio', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ audioBase64: 'SUQzBA', meditationId: 'test', silenceMap: [], totalDuration: 300 })
    }));
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.setItem('stillova_ob_done', '1'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      state.totalSec = 300; state.duration = '5'; state.currentSec = 90;
      const titleEl = document.getElementById('session-title');
      const fill = document.getElementById('progress-fill');
      const ring = document.getElementById('player-ring-fill');
      if (titleEl) titleEl.textContent = 'Tu momento de calma';
      if (fill) fill.style.width = '30%';
      if (ring) ring.style.strokeDashoffset = String(753.98 * 0.70);
      showScreen('screen-player');
    });
    await page.waitForTimeout(600);
    await shot(page, '11-player');
    await ctx.close();
  }

  // ── 8. PERFIL PREMIUM (plan card con créditos) ──
  {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.setItem('stillova_ob_done', '1'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      state.userPlan = 'premium';
      state.creditsRemaining = 18;
      gamData = { streak: 12, totalMinutes: 180, sessions: 36, weekMinutes: 60, level: 4, levelName: 'Avanzado', weekHistory: [1,1,1,1,1,0,1] };
      window.clerk = { user: { firstName: 'Andrés', username: 'acolodro', createdAt: new Date('2024-09-10').getTime() } };
      openProfile();
    });
    await page.waitForTimeout(800);
    await shot(page, '12-perfil-premium');
    await ctx.close();
  }

  await browser.close();
  console.log(`\n✅ Auditoría completa → ${OUT}`);
})();
