// tests/generation.spec.js — Tests de integración con APIs reales
//
// Validan el flujo completo: Clerk auth → Claude API → ElevenLabs → Player
//
// Estrategia de auth: en lugar de browser login, se inyecta un JWT fresco
// de la API de Clerk en cada petición a /api/* via page.route().
// No requiere storageState ni login manual.
//
// Prerrequisitos:
//   1. CLERK_SECRET_KEY + CLERK_TEST_SESSION_ID en .env.local
//      (CLERK_TEST_SESSION_ID: obtener de tests/get-test-session.js)
//   2. El usuario de test debe tener plan studio en Supabase
//      (ver docs/test-user-setup.md)
//
// Ejecutar:
//   npx playwright test tests/generation.spec.js
//   npx playwright test tests/generation.spec.js --headed

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// ─── Config: cargar env vars ─────────────────────────────────────────────────

function loadEnv() {
  const sources = [
    path.join(__dirname, '..', '.env.local'),
    path.join(__dirname, '..', '.env'),
    '/tmp/stillova.env'
  ];
  for (const src of sources) {
    if (!fs.existsSync(src)) continue;
    const lines = fs.readFileSync(src, 'utf-8').split('\n');
    for (const line of lines) {
      const [key, ...rest] = line.split('=');
      if (key && rest.length && !process.env[key.trim()]) {
        process.env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
    break;
  }
}
loadEnv();

const CLERK_SECRET_KEY  = process.env.CLERK_SECRET_KEY;
const CLERK_SESSION_ID  = process.env.CLERK_TEST_SESSION_ID || 'sess_3Co04BV8k1lhPIRhTX2RC5JSEsP';
const hasConfig         = !!CLERK_SECRET_KEY;

// ─── Helper: obtiene un JWT fresco de Clerk (caduca en ~60s) ─────────────────

async function getFreshJwt() {
  const res = await fetch(
    `https://api.clerk.com/v1/sessions/${CLERK_SESSION_ID}/tokens`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${CLERK_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Clerk JWT error ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.jwt;
}

// ─── Helper: intercepta todas las peticiones /api/* e inyecta JWT fresco ─────
//
// Necesario porque el JWT de Clerk caduca cada 60 segundos, y la generación
// (Claude + ElevenLabs) puede tardar hasta 90s. Así cada petición tiene JWT nuevo.

async function injectAuthInterceptor(page) {
  await page.route('/api/**', async (route) => {
    try {
      const jwt = await getFreshJwt();
      const headers = await route.request().allHeaders();
      await route.continue({ headers: { ...headers, 'Authorization': `Bearer ${jwt}` } });
    } catch (e) {
      console.error('[interceptor] Error al obtener JWT:', e.message);
      await route.continue(); // fallback: dejar pasar sin token
    }
  });
}

// ─── Suite ──────────────────────────────────────────────────────────────────

test.describe('Generación real: Clerk + Claude + ElevenLabs + Player', () => {

  // ── TEST 1: Regresión P0 — token válido + Claude genera texto ──────────────
  //
  // Detecta el bug de sesión 9: verifyToken sin publishableKey → 401.
  // Este test NO gasta créditos (solo genera texto, no audio).
  // Si falla con 401: revisar publishableKey en api/_auth.js y api/meditation.js.

  test('1. [P0 REGRESIÓN] /api/meditation: Clerk token + Claude → 200', async ({ request }) => {
    test.skip(!hasConfig, '⚠️  CLERK_SECRET_KEY no encontrado en .env.local');
    test.setTimeout(60_000);

    // Obtener JWT directamente desde Node.js (sin necesidad de browser)
    const jwt = await getFreshJwt();
    expect(jwt, 'No se pudo obtener JWT de Clerk').toBeTruthy();

    // Llamar al API de meditación con el JWT real
    const res = await request.post('https://www.stillova.com/api/meditation', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`
      },
      data: {
        userInput: 'Test automático: cansado tras un día largo, quiero relajarme',
        duration: '5',
        voice: 'feminine',
        gender: 'neutro'
      }
    });

    expect(
      res.status(),
      `[${res.status()}] Si es 401 → revisar publishableKey en api/_auth.js`
    ).toBe(200);

    const body = await res.json();
    expect(body.title, 'Falta campo title').toBeTruthy();
    expect(body.text, 'Falta campo text').toBeTruthy();
    expect(body.text.length, 'Texto demasiado corto').toBeGreaterThan(200);
    expect(body.resolvedVoice).toMatch(/^(feminine|masculine)$/);

    console.log(`[TEST 1] ✅ "${body.title}" | ${body.text.length} chars | ${body.silenceTotal}s silencio`);
  });

  // ── TEST 2: ElevenLabs genera audio real ────────────────────────────────────
  //
  // Consume 1 crédito del usuario de test. Asegurarse de que tiene plan studio.
  // Verifica que ElevenLabs devuelve audioBase64 con datos reales.

  test('2. /api/audio: ElevenLabs genera audioBase64 real', async ({ request }) => {
    test.skip(!hasConfig, '⚠️  CLERK_SECRET_KEY no encontrado en .env.local');
    test.setTimeout(90_000);

    const jwt = await getFreshJwt();

    const SHORT_TEXT =
      'Cierra los ojos. [silencio:3s] Respira profundo. [silencio:5s] ' +
      'Siente el peso de tu cuerpo relajándose. [silencio:5s] Estás en calma.';

    const res = await request.post('https://www.stillova.com/api/audio', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`
      },
      data: {
        text: SHORT_TEXT,
        voice: 'feminine',
        duration: '5',
        title: 'Test automático'
      }
    });

    expect(res.ok(), `Audio API devolvió ${res.status()}: ${await res.text().then(t => t.slice(0, 200))}`).toBe(true);

    const body = await res.json();
    expect(body.audioBase64, 'audioBase64 ausente').toBeTruthy();
    // Base64 de ~5s de audio MP3 debería ser >= 50KB codificado
    expect(body.audioBase64.length, 'audioBase64 demasiado corto — posible audio vacío').toBeGreaterThan(50_000);

    console.log(`[TEST 2] ✅ audioBase64: ${Math.round(body.audioBase64.length / 1024)}KB | silenceMap: ${(body.silenceMap || []).length} entries`);
  });

  // ── TEST 3: Flujo E2E completo — Create → Loading → Player ─────────────────
  //
  // Abre un navegador real, intercepta las peticiones API para inyectar JWT,
  // y valida que la cadena completa llega al player con audio.
  // Consume 1 crédito del usuario de test.

  test('3. [E2E] Create → Loading → Player con audio real', async ({ page }) => {
    test.skip(!hasConfig, '⚠️  CLERK_SECRET_KEY no encontrado en .env.local');
    test.setTimeout(120_000);

    // Interceptar /api/* e inyectar JWT fresco en cada petición
    await injectAuthInterceptor(page);

    // Cargar la app saltando onboarding
    await page.addInitScript(() => localStorage.setItem('stillova_ob_done', '1'));
    await page.goto('https://www.stillova.com/');

    // Esperar a que la app esté lista
    await page.waitForSelector('.screen.active', { timeout: 15_000 });

    // Navegar a Create (puede que esté en onboarding o home — forzar Create directamente)
    await page.evaluate(() => {
      if (typeof showCreate === 'function') showCreate();
    });
    await page.waitForSelector('#screen-create.active', { timeout: 10_000 });

    // Escribir descripción del estado
    await page.locator('#input-free').fill(
      'Test automático: quiero relajarme y soltar la tensión del día'
    );

    // Esperar que el botón de generar se habilite (onInputChange lo activa)
    await page.waitForFunction(
      () => {
        const btn = document.getElementById('btn-generate');
        return btn != null && !btn.disabled && parseFloat(btn.style.opacity || '1') > 0.5;
      },
      { timeout: 5_000 }
    );

    // Seleccionar 5 minutos si la pill existe y no está activa
    const pill5 = page.locator('[data-duration="5"], .pill-duration[data-val="5"]').first();
    if (await pill5.count() > 0) {
      const isActive = await pill5.evaluate(el =>
        el.classList.contains('active') || el.classList.contains('selected')
      );
      if (!isActive) await pill5.click();
    }

    // Click en Generar
    await page.locator('#btn-generate').click();

    // Loading screen debe aparecer
    await page.waitForSelector('#screen-loading.active', { timeout: 10_000 });
    console.log('[TEST 3] Loading screen visible — generando...');

    // Esperar al player (Claude ~10s + ElevenLabs ~30-60s = máx 90s)
    await page.waitForSelector('#screen-player.active', { timeout: 90_000 });
    console.log('[TEST 3] Player visible — verificando audio...');

    // Verificar que el audio tiene datos
    const audioState = await page.evaluate(() => {
      const audio = document.querySelector('audio');
      if (!audio) return { hasAudio: false, reason: 'sin elemento audio en el DOM' };
      const src = audio.src || audio.currentSrc || '';
      if (!src) return { hasAudio: false, reason: 'audio.src vacío' };
      return {
        hasAudio: true,
        srcType: src.startsWith('blob:') ? 'blob' : src.startsWith('data:') ? 'data' : 'url',
        duration: Math.round(audio.duration || 0)
      };
    });

    expect(audioState.hasAudio, `Sin audio en el player: ${audioState.reason || ''}`).toBe(true);
    console.log(`[TEST 3] ✅ Audio tipo: ${audioState.srcType} | duración: ${audioState.duration}s`);
  });
});
