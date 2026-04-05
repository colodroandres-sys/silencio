// Rate limiting compartido para todas las API functions
// Usa Upstash Redis para mantener estado entre instancias serverless
//
// Límites configurados para pre-launch:
//   /api/meditation — 5 requests por IP por hora  (Claude API cuesta dinero)
//   /api/audio      — 5 requests por IP por hora  (ElevenLabs cuesta dinero)
//
// IMPORTANTE: si Upstash no está configurado o falla por cualquier razón,
// el rate limiting se desactiva silenciosamente — nunca bloquea la función principal.

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
      res.status(429).json({
        error: `Límite alcanzado. Puedes volver a intentarlo en ${Math.ceil(retryAfterSec / 60)} minutos.`
      });
      return false;
    }

    return true;
  } catch (e) {
    // Error inesperado de Redis — dejamos pasar, no bloqueamos al usuario
    console.error('Rate limit error (non-blocking):', e.message);
    return true;
  }
};
