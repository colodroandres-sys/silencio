// Vercel serverless function
// Recibe el texto de la meditación, llama a ElevenLabs y devuelve el audio en mp3

const checkRateLimit = require('./_ratelimit');

// Voces de ElevenLabs optimizadas para meditación en español
// Puedes reemplazarlas por IDs de tu cuenta en: https://elevenlabs.io/voice-library
const VOICE_IDS = {
  feminine: 'XB0fDUnXU5powFXDhCwa', // Charlotte — suave, cálida, ideal para meditación
  masculine: 'TX3LPaxmHKxFdv7VOFE1'  // Liam — sereno, claro, profundo
};

module.exports = async (req, res) => {
  // Solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting: 5 audios por IP por hora
  const allowed = await checkRateLimit(req, res, 'audio', 5, '1 h');
  if (!allowed) return;

  const { text, voice } = req.body || {};

  if (!text || !voice) {
    return res.status(400).json({ error: 'Faltan campos requeridos: text, voice' });
  }

  if (text.length > 7000) {
    return res.status(400).json({ error: `El texto es demasiado largo (${text.length} caracteres). Máximo 7000.` });
  }

  if (!process.env.ELEVENLABS_API_KEY) {
    return res.status(500).json({ error: 'ELEVENLABS_API_KEY no configurada' });
  }

  const voiceId = VOICE_IDS[voice] || VOICE_IDS.feminine;

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
          voice_settings: {
            stability: 0.75,        // Alta estabilidad = voz consistente y serena
            similarity_boost: 0.75, // Fidelidad a la voz original
            style: 0.20,            // Mínima expresividad — calma, no dramatismo
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
