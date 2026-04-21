// Audit completo del flujo de Stillova
// Cubre: onboarding, home guest, home user, create, loading, player, end states, paywall
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.argv[2] || 'http://localhost:3456';
const OUT_DIR = '/tmp/audit-stillova';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function shot(page, name, fullPage = false) {
  const p = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage });
  console.log(`  ✓ ${name}`);
}

async function click(page, sel, timeout = 3000) {
  try { await page.waitForSelector(sel, { state: 'visible', timeout }); await page.click(sel, { force: true }); return true; }
  catch { return false; }
}

async function setupMocks(page) {
  await page.route('/api/meditation', async r => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ title: 'Para este momento exacto', text: 'Cierra los ojos...', targetWords: 420, silenceTotal: 20, resolvedVoice: 'feminine' }) }));
  await page.route('/api/audio', async r => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ audioBase64: 'SUQzBAAAAAAA', meditationId: 'audit-test', silenceMap: [], totalDuration: 300 }) }));
}

async function injectPlayer(page, pct = 30) {
  await page.evaluate((p) => {
    if (typeof state !== 'undefined') { state.totalSec = 300; state.currentSec = Math.round(300 * p / 100); }
    const el = n => document.getElementById(n);
    if (el('session-title')) el('session-title').textContent = 'Para este momento exacto';
    if (el('time-end'))      el('time-end').textContent = '5:00';
    if (el('time-now'))      el('time-now').textContent = '1:30';
    if (el('time-countdown')) el('time-countdown').textContent = '3:30';
    if (el('progress-fill')) el('progress-fill').style.width = p + '%';
    const ring = el('player-ring-fill');
    if (ring) ring.style.strokeDashoffset = String(753.98 * (1 - p / 100));
    if (typeof showScreen === 'function') showScreen('screen-player');
    el('breathing-player')?.classList.remove('paused');
    el('icon-play').style.display  = 'none';
    el('icon-pause').style.display = 'block';
  }, pct);
}

async function showEnd(page, id) {
  await page.evaluate((id) => {
    ['end-save','end-profile','end-upsell','end-guest'].forEach(x => {
      const n = document.getElementById(x); if (n) n.style.display = 'none';
    });
    const t = document.getElementById(id);
    if (t) t.style.display = 'flex';
    const em = document.getElementById('end-message'); if (em) em.style.display = 'none';
    document.getElementById('screen-player')?.classList.add('end-active');
  }, id);
}

(async () => {
  const browser = await chromium.launch();
  const VP = { width: 390, height: 844 };

  // ══════════════════════════════════════════════
  // BLOQUE A — ONBOARDING COMPLETO
  // ══════════════════════════════════════════════
  console.log('\n[A] ONBOARDING');
  {
    const ctx  = await browser.newContext({ viewport: VP });
    const page = await ctx.newPage();
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // A1 — Step 1 vacío
    await shot(page, 'A1-ob-step1-vacio');

    // A2 — Step 1 con chips seleccionados
    await page.evaluate(() => {
      document.querySelectorAll('#ob-topics .ob-chip')[0]?.click(); // ansiedad
      document.querySelectorAll('#ob-topics .ob-chip')[4]?.click(); // sueño
    });
    await page.waitForTimeout(200);
    await shot(page, 'A2-ob-step1-seleccionado');

    // A3 — Step 3 (objetivo) — fullPage para ver botón
    await click(page, '.ob-step.active .ob-btn-primary');
    await page.waitForTimeout(500);
    await shot(page, 'A3-ob-step3-objetivo');
    await shot(page, 'A3-ob-step3-objetivo-full', true);

    // A4 — Step 3 con objetivo seleccionado
    await click(page, '.ob-goal-card');
    await page.waitForTimeout(200);
    await shot(page, 'A4-ob-step3-seleccionado');

    // A5 — Paywall onboarding fullPage
    await click(page, '#ob-3-next');
    await page.waitForTimeout(600);
    await shot(page, 'A5-ob-paywall', true);

    // A6 — Scroll dentro del paywall
    await page.evaluate(() => document.getElementById('screen-onboarding').scrollTop = 400);
    await page.waitForTimeout(200);
    await shot(page, 'A6-ob-paywall-scroll');

    await ctx.close();
  }

  // ══════════════════════════════════════════════
  // BLOQUE B — HOME GUEST
  // ══════════════════════════════════════════════
  console.log('\n[B] HOME GUEST');
  {
    const ctx  = await browser.newContext({ viewport: VP });
    const page = await ctx.newPage();
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.setItem('stillova_ob_done', '1'));
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    await shot(page, 'B1-home-guest-arriba');
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'instant' }));
    await page.waitForTimeout(200);
    await shot(page, 'B2-home-guest-abajo');
    await shot(page, 'B3-home-guest-full', true);

    await ctx.close();
  }

  // ══════════════════════════════════════════════
  // BLOQUE C — CREATE FLOW COMPLETO
  // ══════════════════════════════════════════════
  console.log('\n[C] CREATE FLOW');
  {
    const ctx  = await browser.newContext({ viewport: VP });
    const page = await ctx.newPage();
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.setItem('stillova_ob_done', '1'));
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    // C1 — Create vacío
    await click(page, '.nav-create-btn');
    await page.waitForTimeout(700);
    await shot(page, 'C1-create-vacio');

    // C2 — Textarea con foco activo
    await page.focus('#input-free');
    await page.waitForTimeout(200);
    await shot(page, 'C2-create-textarea-focus');

    // C3 — Texto escrito, botón activo
    await page.type('#input-free', 'Llevo días sin dormir bien. Tengo la mente acelerada y no puedo parar de pensar en el trabajo.', { delay: 10 });
    await page.waitForTimeout(300);
    await shot(page, 'C3-create-texto-escrito');

    // C4 — Config revealed
    await click(page, '#btn-continue-input');
    await page.waitForTimeout(600);
    await shot(page, 'C4-create-config-arriba');

    // C5 — Config scroll completo
    await page.evaluate(() => document.getElementById('screen-create').scrollTop = 300);
    await page.waitForTimeout(200);
    await shot(page, 'C5-create-config-abajo');

    // C6 — Config full page
    await shot(page, 'C6-create-config-full', true);

    // C7 — Paywall modal (clicar pill locked)
    await page.evaluate(() => {
      const pill = document.querySelector('#grp-duration .pill-locked');
      if (pill) pill.click();
    });
    await page.waitForTimeout(600);
    await shot(page, 'C7-paywall-modal');

    // Cerrar paywall
    await page.evaluate(() => {
      const btn = document.querySelector('.paywall-close, [onclick*="closePaywall"]');
      if (btn) btn.click();
      else { const pw = document.getElementById('paywall-modal'); if (pw) pw.classList.remove('active'); }
    });
    await page.waitForTimeout(300);

    await ctx.close();
  }

  // ══════════════════════════════════════════════
  // BLOQUE D — LOADING + PLAYER + END STATES
  // ══════════════════════════════════════════════
  console.log('\n[D] LOADING + PLAYER');
  {
    const ctx  = await browser.newContext({ viewport: VP });
    const page = await ctx.newPage();
    await setupMocks(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { localStorage.setItem('stillova_ob_done','1'); localStorage.removeItem('stillova_guest_used'); });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // D1 — Loading screen
    await page.evaluate(() => {
      if (typeof showScreen === 'function') showScreen('screen-loading');
    });
    await page.waitForTimeout(400);
    await shot(page, 'D1-loading');

    // D2 — Player inicio (paused)
    await page.evaluate(() => {
      if (typeof showScreen === 'function') showScreen('screen-player');
      if (typeof state !== 'undefined') { state.totalSec = 300; state.currentSec = 0; }
      const el = n => document.getElementById(n);
      if (el('session-title')) el('session-title').textContent = 'Para este momento exacto';
      if (el('time-end'))      el('time-end').textContent = '5:00';
      if (el('time-now'))      el('time-now').textContent = '0:00';
      if (el('time-countdown')) el('time-countdown').textContent = '5:00';
      if (el('progress-fill')) el('progress-fill').style.width = '0%';
      const ring = el('player-ring-fill');
      if (ring) ring.style.strokeDashoffset = '753.98';
    });
    await page.waitForTimeout(500);
    await shot(page, 'D2-player-paused');

    // D3 — Player reproduciéndose (30%)
    await injectPlayer(page, 30);
    await page.waitForTimeout(500);
    await shot(page, 'D3-player-playing-30pct');

    // D4 — Player al 70%
    await injectPlayer(page, 70);
    await page.waitForTimeout(500);
    await shot(page, 'D4-player-playing-70pct');

    // D5 — End guest
    await showEnd(page, 'end-guest');
    await page.waitForTimeout(400);
    await shot(page, 'D5-end-guest');

    // D6 — End upsell (usuario free sin créditos)
    await showEnd(page, 'end-upsell');
    await page.waitForTimeout(400);
    await shot(page, 'D6-end-upsell');

    // D7 — End save (usuario de pago)
    await showEnd(page, 'end-save');
    await page.waitForTimeout(400);
    await shot(page, 'D7-end-save');

    // D8 — End profile (usuario free, perfil incompleto)
    await showEnd(page, 'end-profile');
    await page.waitForTimeout(400);
    await shot(page, 'D8-end-profile');
    await shot(page, 'D8-end-profile-full', true);

    await ctx.close();
  }

  await browser.close();
  console.log(`\n✅ Audit completo → ${OUT_DIR}`);
})();
