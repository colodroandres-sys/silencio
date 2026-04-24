// tests/setup-auth.js — Captura de sesión para tests de generación
// Ejecutar UNA VEZ antes de correr generation.spec.js:
//
//   node tests/setup-auth.js
//
// Abre un navegador, inicia sesión en stillova.com,
// y guarda la sesión en tests/.auth/test-user.json.
// La sesión dura varios días — repetir solo si los tests dan 401.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const SAVE_PATH = path.join(__dirname, '.auth', 'test-user.json');
const APP_URL   = 'https://www.stillova.com';

async function main() {
  const authDir = path.dirname(SAVE_PATH);
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  console.log('\n═══════════════════════════════════════');
  console.log('  Setup: Captura de sesión Stillova');
  console.log('═══════════════════════════════════════\n');
  console.log('Se abrirá un navegador. Inicia sesión en la app.');
  console.log('El script detecta automáticamente la pantalla Home.\n');
  console.log('IMPORTANTE: usa la cuenta de test con plan Studio en Supabase.');
  console.log('Ver instrucciones en docs/test-user-setup.md\n');

  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: 'es-ES'
  });
  const page = await context.newPage();

  await page.goto(APP_URL);

  console.log('⏳ Esperando login y pantalla Home (máx 2 minutos)...\n');

  try {
    // Espera a que home screen sea visible (se activa tras login gracias a clerk.addListener)
    await page.waitForSelector('#screen-home.active', { timeout: 120_000 });

    // Espera a que Clerk tenga sesión activa antes de guardar
    await page.waitForFunction(
      () => window.Clerk != null && window.Clerk.session != null,
      { timeout: 15_000 }
    );

    // Pequeña espera para que Clerk estabilice el token
    await page.waitForTimeout(2000);

    console.log('✅ Sesión detectada — guardando...');
  } catch (e) {
    console.warn('⚠️  Timeout alcanzado — guardando estado actual de todas formas');
  }

  await context.storageState({ path: SAVE_PATH });
  await browser.close();

  const stats = fs.statSync(SAVE_PATH);
  console.log(`\n✅ Sesión guardada: ${SAVE_PATH} (${Math.round(stats.size / 1024)}KB)`);
  console.log('\nAhora puedes ejecutar los tests de generación:');
  console.log('  npx playwright test tests/generation.spec.js\n');
}

main().catch(e => {
  console.error('\n✗ Error:', e.message);
  process.exit(1);
});
