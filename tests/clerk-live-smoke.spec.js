// Smoke test del incidente Clerk test/live (28-abril 2026).
//
// Cierra el gap descrito en feedback_qa_gap_autenticado.md desde el ángulo
// que SÍ se puede automatizar sin handshake browser:
//
//   1. La publishable key servida en index.html PROD es pk_live (no pk_test).
//   2. El sk_live + pk_live están sincronizados (los JWTs emitidos por uno
//      validan contra el otro).
//   3. /api/user con JWT live devuelve 200 y datos consistentes.
//   4. /api/meditation ya está cubierto por generation.spec.js test 1.
//
// El gap residual (sesión browser persistida + handshake cookies) requiere
// setup-auth.js manual y NO se cubre aquí. Si esos 3 tests pasan, el incidente
// original está sellado.

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

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

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const CLERK_SESSION_ID = process.env.CLERK_TEST_SESSION_ID;
const TEST_BYPASS_SECRET = process.env.TEST_BYPASS_SECRET || '';

async function getFreshJwt() {
  const res = await fetch(`https://api.clerk.com/v1/sessions/${CLERK_SESSION_ID}/tokens`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${CLERK_SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  if (!res.ok) throw new Error(`Clerk JWT error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).jwt;
}

test('1. Frontend PROD sirve pk_live (no pk_test)', async ({ request }) => {
  const res = await request.get('https://www.stillova.com/');
  expect(res.status()).toBe(200);
  const html = await res.text();

  const liveMatch = html.match(/pk_live_[A-Za-z0-9]+/);
  const testMatch = html.match(/pk_test_[A-Za-z0-9]+/);

  expect(liveMatch, 'Falta pk_live_* en index.html — frontend NO está usando Clerk live').toBeTruthy();
  expect(testMatch, `Hay pk_test_* en index.html (${testMatch?.[0]?.slice(0, 20)}…) — el incidente test/live está abierto otra vez`).toBeNull();
});

test('2. JWT emitido por sk_live valida en /api/user → 200', async ({ request }) => {
  test.skip(!CLERK_SECRET_KEY || !CLERK_SESSION_ID, 'Faltan CLERK_SECRET_KEY o CLERK_TEST_SESSION_ID en .env.local');
  test.setTimeout(30_000);

  const jwt = await getFreshJwt();
  expect(jwt).toBeTruthy();

  const bypass = TEST_BYPASS_SECRET ? { 'x-test-bypass': TEST_BYPASS_SECRET } : {};
  const res = await request.get('https://www.stillova.com/api/user', {
    headers: { 'Authorization': `Bearer ${jwt}`, ...bypass }
  });

  expect(
    res.status(),
    `[${res.status()}] Si es 401 → sk_live + pk_live no están sincronizados (ver _auth.js publishableKey)`
  ).toBe(200);
});

test('3. /api/user devuelve datos consistentes con sesión live', async ({ request }) => {
  test.skip(!CLERK_SECRET_KEY || !CLERK_SESSION_ID, 'Faltan CLERK_SECRET_KEY o CLERK_TEST_SESSION_ID');
  test.setTimeout(30_000);

  const jwt = await getFreshJwt();
  const bypass = TEST_BYPASS_SECRET ? { 'x-test-bypass': TEST_BYPASS_SECRET } : {};
  const res = await request.get('https://www.stillova.com/api/user', {
    headers: { 'Authorization': `Bearer ${jwt}`, ...bypass }
  });
  expect(res.status()).toBe(200);
  const data = await res.json();

  expect(data, 'Body ausente').toBeTruthy();
  // El backend siempre debe devolver al menos plan (free|essential|premium|studio) o equivalente.
  // No imponemos un valor concreto — solo que el contrato existe y no está vacío.
  const hasIdentity = !!(data.plan || data.userPlan || data.email || data.id || data.userId);
  expect(hasIdentity, `Respuesta vacía de /api/user: ${JSON.stringify(data).slice(0, 200)}`).toBe(true);
});
