// Smoke E2E real para personalización por hora del día (28-abril 2026).
//
// Cubre:
// 1. Backwards-compat: el endpoint acepta payloads sin userHour (no rompe nada).
// 2. Forward: el endpoint acepta userHour y userTimezone y devuelve 200.
// 3. Defensa: userHour fuera de rango se ignora silenciosamente (no hay 4xx).
//
// La validación cualitativa de "Claude usa bien el contexto de hora" es
// subjetiva y se delega al founder al escuchar varias generaciones.

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const sources = [path.join(__dirname, '..', '.env.local'), '/tmp/stillova.env'];
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
const CLERK_SESSION_ID  = process.env.CLERK_TEST_SESSION_ID;
const TEST_BYPASS_SECRET = process.env.TEST_BYPASS_SECRET || '';

async function getJwt() {
  const res = await fetch(`https://api.clerk.com/v1/sessions/${CLERK_SESSION_ID}/tokens`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${CLERK_SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  if (!res.ok) throw new Error(`JWT error ${res.status}`);
  return (await res.json()).jwt;
}

const HEADERS = (jwt) => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${jwt}`,
  ...(TEST_BYPASS_SECRET ? { 'x-test-bypass': TEST_BYPASS_SECRET } : {})
});

test.describe('Personalización por hora del día', () => {
  test.skip(!CLERK_SECRET_KEY || !CLERK_SESSION_ID, 'Faltan Clerk creds');

  test('1. Backwards-compat: payload SIN userHour → 200 y meditación válida', async ({ request }) => {
    test.setTimeout(60_000);
    const jwt = await getJwt();
    const res = await request.post('https://www.stillova.com/api/meditation', {
      headers: HEADERS(jwt),
      data: {
        userInput: 'Test sin hora: necesito un momento de calma',
        duration: '5',
        voice: 'feminine',
        gender: 'neutro'
        // Sin userHour ni userTimezone
      }
    });
    expect(res.status(), `Body: ${(await res.text()).slice(0, 200)}`).toBe(200);
    const body = await res.json();
    expect(body.title).toBeTruthy();
    expect(body.text.length).toBeGreaterThan(200);
  });

  test('2. Con userHour + userTimezone válidos → 200', async ({ request }) => {
    test.setTimeout(60_000);
    const jwt = await getJwt();
    const res = await request.post('https://www.stillova.com/api/meditation', {
      headers: HEADERS(jwt),
      data: {
        userInput: 'Test con hora: necesito descansar un momento',
        duration: '5',
        voice: 'feminine',
        gender: 'neutro',
        userHour: 3,
        userTimezone: 'America/Santiago'
      }
    });
    expect(res.status(), `Body: ${(await res.text()).slice(0, 200)}`).toBe(200);
    const body = await res.json();
    expect(body.title).toBeTruthy();
    expect(body.text.length).toBeGreaterThan(200);
  });

  test('3. userHour inválido se ignora silenciosamente (no rompe)', async ({ request }) => {
    test.setTimeout(60_000);
    const jwt = await getJwt();
    const res = await request.post('https://www.stillova.com/api/meditation', {
      headers: HEADERS(jwt),
      data: {
        userInput: 'Test con hora rara: respira y suelta',
        duration: '5',
        voice: 'feminine',
        gender: 'neutro',
        userHour: 99,                      // fuera de rango
        userTimezone: 'foo../;DROP TABLE'  // string malicioso
      }
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.text.length).toBeGreaterThan(200);
  });
});
