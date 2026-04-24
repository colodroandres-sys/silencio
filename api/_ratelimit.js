// Rate limiting compartido para todas las API functions
// Usa Upstash Redis para mantener estado entre instancias serverless
//
// Comportamiento:
//   - Runtime error en Upstash         → fail-closed (503) — no quemamos APIs caras
//   - En producción sin Redis/package  → fail-closed (503) — algo roto, no cobrar
//   - En desarrollo local sin env vars → fail-open         — comodidad dev
//
// "Producción" = VERCEL_ENV === 'production' OR NODE_ENV === 'production'

const IS_PROD = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';

let Ratelimit, Redis;
try {
  Ratelimit = require('@upstash/ratelimit').Ratelimit;
  Redis     = require('@upstash/redis').Redis;
} catch (e) {
  // Paquete no instalado o fallo de import — rate limiting desactivado
}

let redis;
let limiters = {};

function getRedis() {
  if (!redis) {
    redis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

function getLimiter(endpoint, requests, window) {
  if (!limiters[endpoint]) {
    limiters[endpoint] = new Ratelimit({
      redis:   getRedis(),
      limiter: Ratelimit.slidingWindow(requests, window),
      prefix:  `silencio:${endpoint}`,
    });
  }
  return limiters[endpoint];
}

/**
 * Comprueba el rate limit para una request.
 * Devuelve true si se permite el acceso, false si ya respondió con 429.
 * Si Upstash no está disponible, siempre devuelve true (fail-open).
 */
module.exports = async function checkRateLimit(req, res, endpoint, requests, window) {
  // Bypass para tests automáticos con header secreto
  const bypassSecret = process.env.TEST_BYPASS_SECRET;
  if (bypassSecret && req.headers['x-test-bypass'] === bypassSecret) return true;

  // Sin paquete o sin env vars: en prod bloqueamos (algo roto, no gastar dinero).
  // En dev dejamos pasar para comodidad local.
  if (!Ratelimit || !Redis) {
    if (IS_PROD) {
      res.status(503).json({ error: 'Servicio temporalmente no disponible.' });
      return false;
    }
    return true;
  }
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    if (IS_PROD) {
      res.status(503).json({ error: 'Servicio temporalmente no disponible.' });
      return false;
    }
    return true;
  }

  try {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    const limiter = getLimiter(endpoint, requests, window);
    const { success, reset } = await limiter.limit(ip);

    if (!success) {
      const retryAfterSec = Math.ceil((reset - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      const waitMsg = retryAfterSec < 60
        ? `${retryAfterSec} segundos`
        : `${Math.ceil(retryAfterSec / 60)} minutos`;
      res.status(429).json({
        error: `Límite alcanzado. Puedes volver a intentarlo en ${waitMsg}.`
      });
      return false;
    }

    return true;
  } catch (e) {
    // Error inesperado de Redis — bloqueamos para proteger las APIs de costos inesperados
    console.error('Rate limit error (blocking):', e.message);
    res.status(503).json({ error: 'Servicio temporalmente no disponible. Inténtalo de nuevo en unos minutos.' });
    return false;
  }
};
