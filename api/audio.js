// Vercel serverless function
// Recibe el texto de la meditación, llama a ElevenLabs y devuelve el audio en mp3

const checkRateLimit = require('./_ratelimit');

// Voces de ElevenLabs optimizadas para meditación en español
// Puedes reemplazarlas por IDs de tu cuenta en: https://elevenlabs.io/voice-library
const VOICE_IDS = {
  feminine: 'D9MdulIxfrCUUJcGNQon',
  masculine: 'RTFg9niKcgGLDwa3RFlz'
};

module.exports = async (req, res) => {
  // Solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting: 5 audios por IP por hora
  const allowed = await checkRateLimit(req, res, 'audio', 10, '1 h');
  if (!allowed) return;

  const { text: rawText, voice } = req.body || {};

  if (!rawText || !voice) {
    return res.status(400).json({ error: 'Faltan campos requeridos: text, voice' });
  }

  // Convertir marcadores de silencio a SSML y envolver en <speak>
  // ElevenLabs ignora breaks > 3s, así que los partimos en chunks de 3s
  const text = '<speak>' + rawText
    .replace(/\[silencio:(\d+)s\]/gi, (_, secs) => {
      const total = parseInt(secs);
      const chunks = Math.floor(total / 3);
      const remainder = total % 3;
      return '<break time="3s"/>'.repeat(chunks) + (remainder > 0 ? `<break time="${remainder}s"/>` : '');
    })
    .replace(/\s+/g, ' ')
    .trim() + '</speak>';

  if (text.length > 15000) {
    return res.status(400).json({ error: `El texto es demasiado largo (${text.length} caracteres). Máximo 15000.` });
  }

  if (!process.env.ELEVENLABS_API_KEY) {
    return res.status(500).json({ error: 'ELEVENLABS_API_KEY no configurada' });
  }

  const voiceId = VOICE_IDS[voice] || VOICE_IDS.feminine;

  console.log('TEXTO SSML:', text);

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'content-type': 'application/json',
          'accept': 'audio/mpeg'
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2', // Mejor calidad para español
          speed: 0.75,                        // 25% más lento que el default — ritmo de meditación
          output_format: 'mp3_44100_192',     // Alta calidad de audio
          voice_settings: {
            stability: 0.80,        // Alta estabilidad = voz consistente y uniforme
            similarity_boost: 0.75, // Fidelidad a la voz original
            style: 0.05,            // Casi sin expresividad — tono plano y sereno
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

    // Devolver el audio binario directamente al navegador
    const audioBuffer = await response.arrayBuffer();

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.byteLength);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).end(Buffer.from(audioBuffer));

  } catch (err) {
    console.error('Error interno en /api/audio:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
