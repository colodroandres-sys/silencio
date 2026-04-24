// tests/setup-auth-auto.js — Autenticación programática para tests de generación
//
// Usa la API de Clerk para crear un sign-in token y autenticar headless.
// No requiere interacción manual. Gastar < 1 segundo.
//
// Requiere: CLERK_SECRET_KEY en .env.local o VERCEL_ENV_FILE=/tmp/stillova.env
//
// Ejecutar:
//   node tests/setup-auth-auto.js
//   node tests/setup-auth-auto.js --email=tu@email.com  (especificar cuenta)

const { chromium } = require('@playwright/test');
const { createClerkClient } = require('@clerk/backend');
const fs   = require('fs');
const path = require('path');

const SAVE_PATH = path.join(__dirname, '.auth', 'test-user.json');
const APP_URL   = 'https://www.stillova.com';

// Cargar variables de entorno desde distintas fuentes
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
    console.log(`[env] Cargado desde: ${src}`);
    break;
  }
}

async function main() {
  loadEnv();

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    console.error('✗ CLERK_SECRET_KEY no encontrado. Ejecuta: vercel env pull /tmp/stillova.env');
    process.exit(1);
  }

  // Parsear argumento opcional --email
  const emailArg = process.argv.find(a => a.startsWith('--email='));
  const targetEmail = emailArg ? emailArg.split('=')[1] : null;

  const clerk = createClerkClient({ secretKey });

  // ─── 1. Encontrar el usuario ───────────────────────────────────────────────

  console.log('\n[1/4] Buscando usuario en Clerk...');

  let userId = null;

  if (targetEmail) {
    const result = await clerk.users.getUserList({ emailAddress: [targetEmail] });
    if (result.data.length === 0) {
      console.error(`✗ No se encontró ningún usuario con email: ${targetEmail}`);
      process.exit(1);
    }
    userId = result.data[0].id;
    console.log(`    → Usuario: ${targetEmail} (${userId})`);
  } else {
    // Sin email especificado: usar el primer usuario con sesión activa reciente
    // Preferir cuentas que no sean free (tienen créditos para los tests)
    const result = await clerk.users.getUserList({ limit: 20, orderBy: '-last_active_at' });
    if (result.data.length === 0) {
      console.error('✗ No se encontraron usuarios en Clerk');
      process.exit(1);
    }
    // Tomar el primero (más recientemente activo)
    userId = result.data[0].id;
    const email = result.data[0].emailAddresses?.[0]?.emailAddress || 'desconocido';
    console.log(`    → Usuario más reciente: ${email} (${userId})`);
    console.log('    ℹ  Para usar otra cuenta: node tests/setup-auth-auto.js --email=otro@email.com');
  }

  // ─── 2. Crear sign-in token ────────────────────────────────────────────────

  console.log('\n[2/4] Creando sign-in token...');
  const tokenData = await clerk.signInTokens.createSignInToken({
    userId,
    expiresInSeconds: 300  // válido 5 minutos
  });
  console.log(`    → Token creado (expira en 5 min)`);

  // ─── 3. Visitar URL de sign-in con Playwright headless ────────────────────

  console.log('\n[3/4] Autenticando con Playwright (headless)...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: 'es-ES'
  });
  const page = await context.newPage();

  // Añadir redirect_url para que tras el sign-in vaya a la app
  const signInUrl = new URL(tokenData.url);
  signInUrl.searchParams.set('redirect_url', APP_URL);

  // Capturar todas las redirecciones para debug
  page.on('response', res => {
    if (res.status() >= 300 && res.status() < 400) {
      console.log(`    [redirect ${res.status()}] ${res.url().slice(0, 80)}`);
    }
  });

  await page.goto(signInUrl.toString(), { waitUntil: 'commit', timeout: 30_000 });

  // Esperar a que Clerk redirija a la app (pueden ser varios redirects del handshake)
  try {
    await page.waitForURL(`${APP_URL}**`, { timeout: 30_000 });
    console.log(`    → En la app: ${page.url()}`);
  } catch {
    console.warn(`    ⚠  Sin redirect automático. URL: ${page.url()}`);
    console.log('    → Navegando a la app con Clerk handshake activo...');
    // Navegar a la app — Clerk detectará el __client_uat y hará el handshake
    await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 45_000 });
    console.log(`    → URL tras networkidle: ${page.url()}`);
  }

  // Esperar a que Clerk complete el handshake y establezca la sesión
  // El handshake implica redirects internos que Clerk maneja via JS
  console.log('    → Esperando a que Clerk establezca sesión...');
  let sessionOk = false;
  try {
    await page.waitForFunction(
      () => window.Clerk != null && window.Clerk.session != null,
      { timeout: 45_000, polling: 500 }
    );
    sessionOk = true;
    const email = await page.evaluate(() =>
      window.Clerk?.user?.primaryEmailAddress?.emailAddress || 'desconocido'
    );
    console.log(`    → ✅ Sesión Clerk activa: ${email}`);
  } catch {
    // Log Clerk state for debugging
    const clerkState = await page.evaluate(() => ({
      hasClerk: window.Clerk != null,
      hasSession: window.Clerk?.session != null,
      hasUser: window.Clerk?.user != null,
      clientStatus: window.Clerk?.client?.activeSessions?.length
    })).catch(() => ({ error: true }));
    console.warn(`    ⚠  Clerk session no establecida en 45s. Estado: ${JSON.stringify(clerkState)}`);
  }

  // Asegurarse de que stillova_ob_done está puesto para que los tests vean home
  await page.evaluate(() => localStorage.setItem('stillova_ob_done', '1'));

  // Si no hay sesión, intentar recargar y esperar
  if (!sessionOk) {
    console.log('    → Recargando página para forzar handshake Clerk...');
    await page.reload({ waitUntil: 'networkidle', timeout: 45_000 });
    try {
      await page.waitForFunction(
        () => window.Clerk != null && window.Clerk.session != null,
        { timeout: 30_000, polling: 500 }
      );
      sessionOk = true;
      console.log('    → ✅ Sesión establecida tras recarga');
    } catch {
      console.warn('    ⚠  Sesión no establecida. Los tests podrán fallar con "no token".');
      console.warn('       En ese caso, usa: node tests/setup-auth.js (requiere login manual)');
    }
  }

  await page.waitForTimeout(2000);

  // ─── 4. Guardar storageState ───────────────────────────────────────────────

  console.log('\n[4/4] Guardando sesión...');
  const authDir = path.dirname(SAVE_PATH);
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  await context.storageState({ path: SAVE_PATH });
  await browser.close();

  const stats = fs.statSync(SAVE_PATH);
  console.log(`    → Guardado: ${SAVE_PATH} (${Math.round(stats.size / 1024)}KB)`);
  console.log('\n✅ Setup completado. Ejecuta los tests:');
  console.log('   npx playwright test tests/generation.spec.js\n');
}

main().catch(e => {
  console.error('\n✗ Error:', e.message);
  if (e.message.includes('signInTokens')) {
    console.error('   Verifica que sign-in tokens estén habilitados en el Clerk Dashboard');
    console.error('   Dashboard → Settings → Sign-in tokens');
  }
  process.exit(1);
});
