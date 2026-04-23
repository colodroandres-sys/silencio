// tests/smoke.spec.js — Stillova Smoke Tests
// Viewport: iPhone 14 (390x844) | Base URL: https://www.stillova.com
// Ejecutar: npx playwright test

const { test, expect } = require('@playwright/test');

// ─── helpers ────────────────────────────────────────────────────────────────

// Espera a que cualquier pantalla esté activa (Clerk inicializado)
async function waitForAppReady(page) {
  await page.waitForSelector('.screen.active', { timeout: 15000 });
}

// Navega con onboarding completado (guest sin cuenta)
async function skipOnboarding(page) {
  await page.goto('/');
  await waitForAppReady(page);
  await page.evaluate(() => localStorage.setItem('stillova_ob_done', '1'));
  await page.reload();
  await page.waitForSelector('#screen-home.active', { timeout: 15000 });
}

// Navega con onboarding limpio (primera vez)
async function freshOnboarding(page) {
  await page.goto('/');
  await waitForAppReady(page);
  await page.evaluate(() => localStorage.removeItem('stillova_ob_done'));
  await page.reload();
  await page.waitForSelector('#screen-onboarding.active', { timeout: 15000 });
}

// Verifica si el paywall está activo (usa classList, no visibility — el paywall usa opacity)
async function isPaywallActive(page) {
  return page.evaluate(
    () => document.getElementById('paywall-modal')?.classList.contains('active') ?? false
  );
}

// ─── Test 1 — Onboarding completo ───────────────────────────────────────────

test('1. Onboarding completo: ob-1 → ob-2 → ob-3 → ob-4 → Create', async ({ page }) => {
  await freshOnboarding(page);

  // ob-1: pantalla bienvenida visible
  await expect(page.locator('#ob-1')).toHaveClass(/active/);
  await page.locator('#ob-1 .s-btn-primary').click(); // "Empezar"

  // ob-2: ¿Qué te trae aquí?
  await page.waitForSelector('#ob-2.active');
  await page.locator('#ob-topics .ob-option-card').first().click(); // seleccionar una opción
  await page.locator('#ob-2 .s-btn-primary').click(); // "Continuar"

  // ob-3: Cómo funciona
  await page.waitForSelector('#ob-3.active');
  await page.locator('#ob-3 .s-btn-primary').click(); // "Continuar"

  // ob-4: Tu primera sesión
  await page.waitForSelector('#ob-4.active');
  await page.locator('#ob-4 .s-btn-primary').click(); // "Empezar mi primera sesión"

  // Debe llegar a la pantalla Create (obSkipToFree → showCreate)
  await page.waitForSelector('#screen-create.active', { timeout: 8000 });
  await expect(page.locator('#screen-create')).toHaveClass(/active/);
});

// ─── Test 2 — ob-2 sin selección ────────────────────────────────────────────

test('2. ob-2 sin selección: avanza, muestra microcopy, no bloquea', async ({ page }) => {
  await freshOnboarding(page);

  await page.locator('#ob-1 .s-btn-primary').click(); // Empezar
  await page.waitForSelector('#ob-2.active');

  // Continuar SIN seleccionar nada
  await page.locator('#ob-2 .s-btn-primary').click();

  // Debe aparecer el hint "Si no eliges, lo descubriremos contigo."
  await expect(page.locator('#ob-2-hint')).toBeVisible({ timeout: 3000 });

  // Tras ~700ms de delay, debe avanzar a ob-3 sin bloquear
  await page.waitForSelector('#ob-3.active', { timeout: 3000 });
  await expect(page.locator('#ob-3')).toHaveClass(/active/);
});

// ─── Test 3 — Create: textarea vacía con placeholder ────────────────────────

test('3. Create: textarea llega vacía con placeholder correcto', async ({ page }) => {
  await skipOnboarding(page);

  // Navegar a Create como guest
  await page.evaluate(() => {
    if (window.state) window.state.userInput = '';
    showCreate();
  });
  await page.waitForSelector('#screen-create.active');

  const textarea = page.locator('#input-free');
  await expect(textarea).toHaveValue('');
  await expect(textarea).toHaveAttribute('placeholder', 'Hoy me siento…');
});

// ─── Test 4 — Create: pills visibles tras scroll ─────────────────────────────

test('4. Create: scroll hasta abajo — pills de duración visibles (no tapadas por sticky)', async ({ page }) => {
  await skipOnboarding(page);

  await page.evaluate(() => showCreate());
  await page.waitForSelector('#screen-create.active');

  // Hacer scroll hasta el fondo del contenedor scrollable
  await page.evaluate(() => {
    const sc = document.getElementById('screen-create');
    if (sc) sc.scrollTop = sc.scrollHeight;
  });

  await page.waitForTimeout(350); // esperar reflow tras scroll

  // Verificar que el locked card no queda tapado por el botón sticky
  const result = await page.evaluate(() => {
    const card = document.getElementById('create-locked-card');
    const btn  = document.querySelector('.btn-generate-wrap');
    if (!card || !btn) return { ok: false, reason: 'elementos no encontrados' };

    const cardRect = card.getBoundingClientRect();
    const btnRect  = btn.getBoundingClientRect();

    // El fondo del locked card debe estar por encima del inicio del botón fijo
    const cardBottomAboveBtn = cardRect.bottom <= btnRect.top + 4; // ±4px tolerancia

    return {
      ok: cardBottomAboveBtn,
      cardBottom: Math.round(cardRect.bottom),
      btnTop: Math.round(btnRect.top),
    };
  });

  expect(
    result.ok,
    `Card bottom (${result.cardBottom}px) debe ser ≤ btn top (${result.btnTop}px)`
  ).toBe(true);
});

// ─── Test 5 — Paywall: abre y cierra por 3 vías ─────────────────────────────

test('5. Paywall: abre, cierra con Escape, con backdrop y con botón X', async ({ page }) => {
  await skipOnboarding(page);

  // — Abre —
  await page.evaluate(() => showPaywall());
  expect(await isPaywallActive(page)).toBe(true);

  // — Cierra con Escape —
  await page.keyboard.press('Escape');
  expect(await isPaywallActive(page)).toBe(false);

  // — Abre de nuevo → cierra con click en backdrop (fuera de la card) —
  await page.evaluate(() => showPaywall());
  expect(await isPaywallActive(page)).toBe(true);
  // Click en la esquina superior-izquierda del overlay (fuera de la card centrada)
  await page.locator('#paywall-modal').click({ position: { x: 8, y: 8 }, force: true });
  expect(await isPaywallActive(page)).toBe(false);

  // — Abre de nuevo → cierra con botón X —
  await page.evaluate(() => showPaywall());
  expect(await isPaywallActive(page)).toBe(true);
  await page.locator('.paywall-close-btn').click();
  expect(await isPaywallActive(page)).toBe(false);
});

// ─── Test 6 — Biblioteca guest: botón correcto ──────────────────────────────

test('6. Biblioteca guest: botón dice "Crear cuenta gratis" (no "Reintentar")', async ({ page }) => {
  await skipOnboarding(page);

  // Abrir biblioteca sin sesión (guest)
  await page.evaluate(() => openLibrary());
  await page.waitForSelector('#screen-library.active');

  // El estado de error/guest debe ser visible
  const libError = page.locator('#lib-error');
  await expect(libError).toBeVisible();

  // El botón debe decir exactamente "Crear cuenta gratis"
  const btn = libError.locator('button');
  await expect(btn).toHaveText('Crear cuenta gratis');
});

// ─── Test 7 — Toast no tapa el botón X del paywall ──────────────────────────

test('7. Toast no se superpone al paywall cuando los dos están activos', async ({ page }) => {
  await skipOnboarding(page);

  // Abrir paywall y luego mostrar un toast simultáneamente
  await page.evaluate(() => {
    showPaywall();
    // Saltar el auto-hide del toast para tenerlo visible
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = 'Prueba solapamiento';
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('visible'), 10);
  });

  await page.waitForTimeout(200); // esperar que el toast sea visible

  // El botón X del paywall NO debe solaparse con el toast
  const result = await page.evaluate(() => {
    const closeBtn = document.querySelector('.paywall-close-btn');
    const toast    = document.querySelector('.toast.visible');

    if (!closeBtn) return { ok: false, reason: 'sin close button' };
    if (!toast)    return { ok: true,  reason: 'sin toast visible — sin solapamiento posible' };

    const b = closeBtn.getBoundingClientRect();
    const t = toast.getBoundingClientRect();

    const overlap =
      b.bottom > t.top    &&
      b.top    < t.bottom &&
      b.right  > t.left   &&
      b.left   < t.right;

    return {
      ok: !overlap,
      closeBtnPos:  { top: Math.round(b.top),  bottom: Math.round(b.bottom) },
      toastPos:     { top: Math.round(t.top),  bottom: Math.round(t.bottom) },
    };
  });

  expect(result.ok, JSON.stringify(result)).toBe(true);
});

// ─── BUG-05 — Bottom nav duplicado en biblioteca ────────────────────────────

test('BUG-05: bottom nav NO aparece duplicado en biblioteca guest', async ({ page }) => {
  await skipOnboarding(page);

  await page.evaluate(() => openLibrary());
  await page.waitForSelector('#screen-library.active');

  // Contar cuántos #bottom-nav existen en el DOM
  const count = await page.evaluate(
    () => document.querySelectorAll('#bottom-nav').length
  );

  expect(count, 'Solo debe haber 1 elemento #bottom-nav en el DOM').toBe(1);
});
