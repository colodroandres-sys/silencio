// Rate limiting compartido para todas las API functions
// Usa Upstash Redis para mantener estado entre instancias serverless
//
// Límites configurados para pre-launch:
//   /api/meditation — 10 requests por IP por hora  (Claude API cuesta dinero)
//   /api/audio      — 10 requests por IP por hora  (ElevenLabs cuesta dinero)
//
// IMPORTANTE: si Upstash falla en runtime, la request es bloqueada (fail-closed).
// Si las variables de entorno no están configuradas, se permite el paso (modo dev sin Redis).

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
  // Sin paquete, sin variables, o cualquier error — dejamos pasar sin romper nada
  if (!Ratelimit || !Redis) return true;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return true;

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
