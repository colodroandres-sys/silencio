// Vercel serverless function
// Recibe el texto de la meditación, llama a ElevenLabs y devuelve el audio en mp3

const { randomUUID } = require('crypto');
const checkRateLimit = require('./_ratelimit');
const { verifyAuth } = require('./_auth');
const { checkUsageLimit, incrementUsage } = require('./_limits');
const { getSupabase } = require('./_supabase');

const { Redis } = (() => { try { return require('@upstash/redis'); } catch(e) { return {}; } })();

let redis;
function getRedis() {
  if (!redis && Redis && process.env.UPSTASH_REDIS_REST_URL) {
    redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
  }
  return redis;
}

async function saveLog(entry) {
  try {
    const r = getRedis();
    if (!r) return;
    await r.lpush('silencio:logs', JSON.stringify(entry));
    await r.ltrim('silencio:logs', 0, 199); // guardar solo los últimos 200
  } catch (e) { /* log falla silenciosamente */ }
}

// Voces de ElevenLabs optimizadas para meditación en español
const VOICE_IDS = {
  feminine: 'D9MdulIxfrCUUJcGNQon',
  masculine: 'RTFg9niKcgGLDwa3RFlz'
};

// Speed por voz — masculina más lenta para compensar ritmo natural más rápido
const VOICE_SPEED = {
  feminine: 0.97,
  masculine: 0.92
};

module.exports = async (req, res) => {
  // Solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting: 10 audios por IP por hora
  const allowed = await checkRateLimit(req, res, 'audio', 10, '1 h');
  if (!allowed) return;

  // Auth: requiere usuario autenticado
  const clerkId = await verifyAuth(req, res);
  if (!clerkId) return;

  // Verificar límite de uso — previene llamadas directas a /api/audio que saltean /api/meditation
  const limitCheck = await checkUsageLimit(clerkId);
  if (!limitCheck.allowed) {
    return res.status(402).json({
      error: 'Límite de meditaciones alcanzado.',
      reason: limitCheck.reason,
      plan: limitCheck.plan
    });
  }

  const { text: rawText, voice: rawVoice, duration, targetWords, silenceTotal, title } = req.body || {};

  if (!rawText || !rawVoice) {
    return res.status(400).json({ error: 'Faltan campos requeridos: text, voice' });
  }

  // Resolver voz automática (fallback por si llega 'auto' directamente)
  const voice = rawVoice === 'auto'
    ? (Math.random() < 0.5 ? 'feminine' : 'masculine')
    : rawVoice;

  // Dividir el texto en segmentos hablados y silencios
  // Entrada:  "Frase uno. [silencio:10s] Frase dos. [silencio:15s] Frase tres."
  // Salida:   segments = ["Frase uno.", "Frase dos.", "Frase tres."]
  //           silences  = [10, 15]  (duración en segundos después de cada segmento, excepto el último)
  const parts = rawText.split(/\[silencio:(\d+)s\]/gi);
  const segments = [];
  const silences = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      const seg = parts[i].replace(/\s+/g, ' ').trim();
      if (seg) segments.push(seg);
    } else {
      const val = parseInt(parts[i], 10);
      if (!isNaN(val) && val > 0) silences.push(val);
    }
  }

  if (segments.length === 0) {
    return res.status(400).json({ error: 'El texto no contiene frases habladas.' });
  }

  if (!process.env.ELEVENLABS_API_KEY) {
    return res.status(500).json({ error: 'ELEVENLABS_API_KEY no configurada' });
  }

  // Generar ID para guardar la meditación (solo planes de pago)
  const plan = limitCheck.plan || 'free';
  const meditationId = plan !== 'free' ? randomUUID() : null;

  // Helper para insertar el registro en Supabase (no bloquea la respuesta)
  async function saveMeditationRecord(silenceMap) {
    if (!meditationId) return;
    try {
      const db = getSupabase();
      await db.from('meditations').insert({
        id: meditationId,
        clerk_id: clerkId,
        title: title || 'Meditación',
        duration: parseInt(duration) || 5,
        voice: voice || 'feminine',
        silence_map: silenceMap || [],
        is_saved: false
      });
    } catch (e) {
      console.error('[audio] DB insert error:', e);
    }
  }

  const voiceId = VOICE_IDS[voice] || VOICE_IDS.feminine;

  // Texto limpio para ElevenLabs: segmentos unidos, sin marcadores de silencio
  const cleanText = segments.join(' ');

  console.log('[audio] segments:', segments.length, '| silences:', JSON.stringify(silences));
  console.log('[audio] cleanText length:', cleanText.length);

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: 'eleven_turbo_v2_5',     // Soporta parámetro speed nativo
          output_format: 'mp3_44100_128',
          voice_settings: {
            stability: 0.80,
            similarity_boost: 0.75,
            style: 0.05,
            speed: VOICE_SPEED[voice] || VOICE_SPEED.feminine,
            use_speaker_boost: true
          }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('ElevenLabs API error:', response.status, errText);
      return res.status(502).json({
        error: 'Error en ElevenLabs API',
        status: response.status,
        details: errText.slice(0, 200)
      });
    }

    const elData = await response.json();
    const audioBase64  = elData.audio_base64;
    const charEndTimes = elData.alignment?.character_end_times_seconds || [];

    const characters = elData.alignment?.characters || [];
    console.log('[audio] charEndTimes length:', charEndTimes.length);
    console.log('[audio] characters length:', characters.length);
    console.log('[audio] cleanText.length vs characters.length — match:', cleanText.length === characters.length ? 'SÍ' : `NO (diff: ${cleanText.length - characters.length})`);
    console.log('[audio] characters muestra inicio:', characters.slice(0,8).join(''));
    console.log('[audio] charEndTimes primeros:', charEndTimes.slice(0,3), '| últimos:', charEndTimes.slice(-3));

    // Si ElevenLabs no devolvió timestamps válidos, reproducir audio sin silencios (graceful degradation)
    if (charEndTimes.length === 0 || !charEndTimes.some(t => t > 0)) {
      console.warn('[audio] charEndTimes vacío o inválido — reproduciendo sin silencios');
      await saveMeditationRecord([]);
      return res.status(200).json({ audioBase64, silenceMap: [], totalDuration: 0, meditationId });
    }

    // Calcular en qué segundo exacto termina cada segmento dentro del audio de ElevenLabs
    // cleanText = seg0 + " " + seg1 + " " + seg2 ...
    // charEndTimes[i] corresponde al carácter i de cleanText (espacios incluidos)
    const cutTimes = []; // cutTimes[i] = segundo donde termina segments[i] (solo para i < last)
    let charPos = 0;
    for (let i = 0; i < segments.length - 1; i++) {
      charPos += segments[i].length;
      cutTimes.push(charEndTimes[charPos - 1] || 0);
      charPos += 1; // el espacio que separa segmentos en cleanText
    }

    const badCutTimes = cutTimes.filter(t => t === 0).length;
    console.log('[audio] cutTimes:', JSON.stringify(cutTimes));
    if (badCutTimes > 0) console.warn('[audio] ALERTA: hay', badCutTimes, 'cutTime(s) en 0 — silencios dispararán al inicio');

    // Si todos los cutTimes son 0 los silencios se dispararían en el segundo 0 — mejor sin silencios
    if (badCutTimes === cutTimes.length && cutTimes.length > 0) {
      console.warn('[audio] Todos los cutTimes son 0 — reproduciendo sin silencios como fallback');
      const voiceDur = charEndTimes[charEndTimes.length - 1] || 0;
      await saveMeditationRecord([]);
      return res.status(200).json({ audioBase64, silenceMap: [], totalDuration: voiceDur, meditationId });
    }

    // Construir el mapa de silencios: cuándo parar y cuánto esperar
    const silenceMap = cutTimes.map((time, i) => ({ time, duration: silences[i] }));

    // Duración total = duración de la voz + suma de todos los silencios
    const voiceDuration = charEndTimes[charEndTimes.length - 1] || 0;
    const totalDuration = voiceDuration + silences.reduce((sum, s) => sum + s, 0);

    console.log('[audio] voiceDuration:', voiceDuration);
    console.log('[audio] totalDuration:', totalDuration);
    console.log('[audio] silenceMap:', JSON.stringify(silenceMap));
    if (silences.length > cutTimes.length) {
      console.warn('[audio] ALERTA: hay', silences.length - cutTimes.length, 'silencio(s) trailing — no están en silenceMap pero sí en totalDuration');
    }

    await saveLog({
      ts: new Date().toISOString(),
      voice,
      duration,
      targetWords,
      silenceTotal: silenceTotal ?? Math.round(silences.reduce((s, v) => s + v, 0)),
      voiceDuration: Math.round(voiceDuration),
      totalDuration: Math.round(totalDuration)
    });

    // Incrementar créditos usados según duración de la meditación generada
    await incrementUsage(clerkId, duration);

    // Guardar registro de meditación en Supabase (para historial y guardado posterior)
    await saveMeditationRecord(silenceMap);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ audioBase64, silenceMap, totalDuration, meditationId });

  } catch (err) {
    console.error('Error interno en /api/audio:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
