// Capturas Ronda 2 — paquete para Claude Design
// Output: /Users/andrescolodro/Desktop/paquete-claude-design-ronda-2/capturas/

const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://www.stillova.com';
const OUT_DIR = '/Users/andrescolodro/Desktop/paquete-claude-design-ronda-2/capturas';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const VP = { width: 390, height: 844 };

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: false });
  console.log(`  ✓ ${name}.png`);
}

async function shotFull(page, name) {
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: true });
  console.log(`  ✓ ${name}.png (full)`);
}

async function newGuestPage(browser) {
  const ctx = await browser.newContext({
    viewport: VP,
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  });
  const page = await ctx.newPage();
  return { ctx, page };
}

async function setupAudioMocks(page) {
  await page.route('**/api/meditation', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        title: 'Soltar el peso del día',
        text: 'Cierra los ojos. Respira hondo. Este momento es solo tuyo.',
        targetWords: 750,
        silenceTotal: 30,
        resolvedVoice: 'feminine'
      })
    });
  });

  // mp3 mínimo válido
  const silentMp3 = 'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  await page.route('**/api/audio', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        audioBase64: silentMp3,
        meditationId: 'demo',
        silenceMap: [],
        totalDuration: 300
      })
    });
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  console.log(`\n→ ${OUT_DIR}\n`);

  // ── 1-2. Onboarding ──
  {
    console.log('[Onboarding]');
    const { ctx, page } = await newGuestPage(browser);
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await shot(page, '01-onboarding-paso1-welcome');

    await page.click('button:has-text("Empezar")');
    await page.waitForTimeout(700);
    await shotFull(page, '02-onboarding-paso2-primera-sesion');

    await ctx.close();
  }

  // ── 3-4. Home guest ──
  {
    console.log('[Home guest]');
    const { ctx, page } = await newGuestPage(browser);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem('stillova_ob_done', '1');
      localStorage.removeItem('stillova_guest_used');
    });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await shot(page, '03-home-guest-vacio');

    // Escribir texto en el textarea
    await page.fill('#home-guest-textarea', 'no puedo dormir, llevo días con tensión en el cuello y la mente acelerada');
    await page.waitForTimeout(500);
    await shot(page, '04-home-guest-con-texto');

    await ctx.close();
  }

  // ── 5. Loading con frase ──
  {
    console.log('[Loading]');
    const { ctx, page } = await newGuestPage(browser);
    await page.route('**/api/meditation', async route => {
      // No responder → queda en loading mostrando la frase
      await new Promise(r => setTimeout(r, 30000));
      await route.abort();
    });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem('stillova_ob_done', '1');
      localStorage.removeItem('stillova_guest_used');
    });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.fill('#home-guest-textarea', 'no puedo dormir, llevo días con tensión en el cuello');
    await page.waitForTimeout(300);
    await page.click('#home-guest-gen-btn');
    await page.waitForTimeout(2200);
    await shot(page, '05-loading-con-frase-citada');
    await ctx.close();
  }

  // ── 6-7. Player + modal frase original ──
  {
    console.log('[Player + modal frase]');
    const { ctx, page } = await newGuestPage(browser);
    await setupAudioMocks(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem('stillova_ob_done', '1');
      localStorage.removeItem('stillova_guest_used');
    });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.fill('#home-guest-textarea', 'no puedo dormir, llevo días con tensión en el cuello y la mente acelerada');
    await page.waitForTimeout(300);
    await page.click('#home-guest-gen-btn');

    // Esperar a que aparezca el player
    await page.waitForSelector('#screen-player.active', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);

    // Inyectar progreso del player
    await page.evaluate(() => {
      const fill = document.getElementById('progress-fill');
      const ring = document.getElementById('player-ring-fill');
      const tn   = document.getElementById('time-now');
      const te   = document.getElementById('time-end');
      if (fill) fill.style.width = '32%';
      if (ring) ring.style.strokeDashoffset = String(289.03 * 0.68);
      if (tn) tn.textContent = '1:35';
      if (te) te.textContent = '−3:25';
    });
    await page.waitForTimeout(400);
    await shot(page, '06-player-titulo-clicable');

    // Abrir modal frase original
    await page.click('#session-title-btn');
    await page.waitForTimeout(500);
    await shot(page, '07-modal-frase-original');

    // Cerrar modal y forzar end-guest
    await page.evaluate(() => {
      if (typeof closeOriginalQuote === 'function') closeOriginalQuote();
      if (typeof renderPostSession === 'function') renderPostSession('guest');
      const guest = document.getElementById('end-guest');
      if (guest) guest.style.display = 'flex';
      document.getElementById('screen-player')?.classList.add('end-active');
      const endMsg = document.getElementById('end-message');
      if (endMsg) endMsg.style.display = 'none';
    });
    await page.waitForTimeout(700);
    await shotFull(page, '08-end-guest-cta-6-99');

    await ctx.close();
  }

  // ── 9-11. Paywall (anual default, mensual, con breadcrumb promo) ──
  {
    console.log('[Paywall — anual default]');
    const { ctx, page } = await newGuestPage(browser);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.setItem('stillova_ob_done', '1'));
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.evaluate(() => { if (typeof showPaywall === 'function') showPaywall(); });
    await page.waitForTimeout(700);
    await shotFull(page, '09-paywall-anual-default');

    // Mensual
    await page.click('#pw-btn-monthly');
    await page.waitForTimeout(500);
    await shotFull(page, '10-paywall-mensual');

    await ctx.close();
  }

  {
    console.log('[Paywall — con breadcrumb promo €6,99]');
    const { ctx, page } = await newGuestPage(browser);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem('stillova_ob_done', '1');
      sessionStorage.setItem('stillova_promo_essential', '1');
    });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      sessionStorage.setItem('stillova_promo_essential', '1');
      if (typeof showPaywall === 'function') showPaywall();
    });
    await page.waitForTimeout(700);
    await shotFull(page, '11-paywall-con-breadcrumb-promo');
    await ctx.close();
  }

  // ── 12-13. Modal pre-Stripe ──
  {
    console.log('[Modal pre-Stripe — Premium anual]');
    const { ctx, page } = await newGuestPage(browser);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.setItem('stillova_ob_done', '1'));
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      if (typeof showPaywall === 'function') showPaywall();
    });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      // Cerrar paywall y disparar modal sin pasar por upgradePlan (que iría a Stripe)
      if (typeof closePaywall === 'function') closePaywall();
      if (typeof preCheckoutConfirm === 'function') preCheckoutConfirm('premium-annual');
    });
    await page.waitForTimeout(600);
    await shot(page, '12-modal-pre-stripe-premium-anual');
    await ctx.close();
  }

  {
    console.log('[Modal pre-Stripe — Essential promo €6,99]');
    const { ctx, page } = await newGuestPage(browser);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem('stillova_ob_done', '1');
      sessionStorage.setItem('stillova_promo_essential', '1');
    });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      sessionStorage.setItem('stillova_promo_essential', '1');
      if (typeof preCheckoutConfirm === 'function') preCheckoutConfirm('essential');
    });
    await page.waitForTimeout(600);
    await shot(page, '13-modal-pre-stripe-promo-6-99');
    await ctx.close();
  }

  // ── 14. Post-checkout ──
  {
    console.log('[Post-checkout]');
    const { ctx, page } = await newGuestPage(browser);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem('stillova_ob_done', '1');
      localStorage.removeItem('stillova_post_checkout_done');
    });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      // Forzar mostrar pantalla
      if (typeof showPostCheckout === 'function') showPostCheckout();
    });
    await page.waitForTimeout(800);
    await shotFull(page, '14-post-checkout-vacio');

    // Rellenar para mostrar estado activo
    await page.fill('#post-checkout-name', 'Andrés');
    await page.click('button[data-value="ansiedad"]');
    await page.click('button[data-value="enfoque"]');
    await page.fill('#post-checkout-other', 'manejar mejor la presión del trabajo');
    await page.waitForTimeout(400);
    await shotFull(page, '15-post-checkout-relleno');

    await ctx.close();
  }

  await browser.close();
  console.log('\n✅ Capturas listas');
})();
