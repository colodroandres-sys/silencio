// Rate limiting compartido para todas las API functions
// Usa Upstash Redis para mantener estado entre instancias serverless
//
// Límites configurados para pre-launch:
//   /api/meditation — 5 requests por IP por hora  (Claude API cuesta dinero)
//   /api/audio      — 5 requests por IP por hora  (ElevenLabs cuesta dinero)

const { Ratelimit } = require('@upstash/ratelimit');
const { Redis }     = require('@upstash/redis');

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
 *
 * @param {object} req       - Request de Vercel
 * @param {object} res       - Response de Vercel
 * @param {string} endpoint  - Nombre del endpoint (p.ej. 'meditation')
 * @param {number} requests  - Número de requests permitidos en el periodo
 * @param {string} window    - Periodo (p.ej. '1 h', '10 m')
 */
module.exports = async function checkRateLimit(req, res, endpoint, requests, window) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    // Sin variables configuradas (entorno local / dev), dejamos pasar
    return true;
  }

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
};
