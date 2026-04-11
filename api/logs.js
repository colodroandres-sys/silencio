const { Redis } = (() => { try { return require('@upstash/redis'); } catch(e) { return {}; } })();

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!Redis || !process.env.UPSTASH_REDIS_REST_URL) {
    return res.status(503).json({ error: 'Redis no disponible' });
  }

  try {
    const redis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN
    });

    const raw = await redis.lrange('silencio:logs', 0, 49); // últimas 50
    const logs = raw.map(entry => {
      const e = typeof entry === 'string' ? JSON.parse(entry) : entry;
      const total = e.totalDuration || 0;
      const mm = Math.floor(total / 60);
      const ss = String(total % 60).padStart(2, '0');
      return `${e.ts?.slice(0,16).replace('T',' ')} | ${(e.voice||'?').padEnd(9)} | ${String(e.duration||'?').padStart(2)}min | words: ${String(e.targetWords||'?').padStart(4)} | silence: ${String(e.silenceTotal||'?').padStart(3)}s | total: ${mm}:${ss}`;
    });

    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(logs.join('\n') || 'Sin logs todavía.');
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
