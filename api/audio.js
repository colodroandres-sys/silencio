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

  // Rate limiting: 10 audios por IP por hora
  const allowed = await checkRateLimit(req, res, 'audio', 10, '1 h');
  if (!allowed) return;

  const { text: rawText, voice } = req.body || {};

  if (!rawText || !voice) {
    return res.status(400).json({ error: 'Faltan campos requeridos: text, voice' });
  }

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
      silences.push(parseInt(parts[i]));
    }
  }

  if (segments.length === 0) {
    return res.status(400).json({ error: 'El texto no contiene frases habladas.' });
  }

  if (!process.env.ELEVENLABS_API_KEY) {
    return res.status(500).json({ error: 'ELEVENLABS_API_KEY no configurada' });
  }

  const voiceId = VOICE_IDS[voice] || VOICE_IDS.feminine;

  // Texto limpio para ElevenLabs: segmentos unidos, sin marcadores de silencio
  const cleanText = segments.join(' ');

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
          model_id: 'eleven_multilingual_v2', // Mejor calidad para español
          output_format: 'mp3_44100_128',
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

    const elData = await response.json();
    const audioBase64  = elData.audio_base64;
    const charEndTimes = elData.alignment?.character_end_times_seconds || [];

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

    // Convertir el audio base64 de ElevenLabs a Buffer binario
    const voiceBuffer = Buffer.from(audioBase64, 'base64');

    // Generar silencio MP3 puro sin librerías externas
    // Formato: MPEG1, Layer3, 128kbps, 44100Hz, joint stereo, sin padding
    function generateSilentMp3(seconds) {
      const HEADER        = Buffer.from([0xFF, 0xFB, 0x90, 0x44]);
      const FRAME_SIZE    = 417;              // bytes por frame a 128kbps 44100Hz
      const FRAMES_PER_SEC = 44100 / 1152;   // ~38.28 frames por segundo
      const frameCount    = Math.ceil(seconds * FRAMES_PER_SEC);
      const buf           = Buffer.alloc(frameCount * FRAME_SIZE, 0);
      for (let i = 0; i < frameCount; i++) {
        HEADER.copy(buf, i * FRAME_SIZE);
      }
      return buf;
    }

    // Encontrar el inicio del siguiente frame MP3 válido desde una posición dada
    // Evita cortar en medio de un frame, lo que congela el decoder del navegador
    function findFrameBoundary(buf, startByte) {
      for (let i = startByte; i < buf.length - 1; i++) {
        if (buf[i] === 0xFF && (buf[i + 1] & 0xE0) === 0xE0) return i;
      }
      return startByte;
    }

    // Cortar el audio de voz en segmentos usando cutTimes
    // Aproximamos la posición en bytes (CBR 128kbps = 16000 bytes/s)
    // y luego alineamos al frame boundary más cercano
    const BYTES_PER_SEC  = 16000;
    const audioDataStart = findFrameBoundary(voiceBuffer, 0); // salta ID3 u otros headers
    const voiceSegments  = [];
    let prevByte = audioDataStart;
    for (let i = 0; i < cutTimes.length; i++) {
      const approxByte = audioDataStart + Math.round(cutTimes[i] * BYTES_PER_SEC);
      const cutByte    = findFrameBoundary(voiceBuffer, approxByte);
      voiceSegments.push(voiceBuffer.slice(prevByte, cutByte));
      prevByte = cutByte;
    }
    voiceSegments.push(voiceBuffer.slice(prevByte)); // último segmento hasta el final

    // Construir el audio final intercalando voz y silencios:
    // seg0 + silencio0 + seg1 + silencio1 + seg2 ...
    const audioParts = [];
    for (let i = 0; i < voiceSegments.length; i++) {
      audioParts.push(voiceSegments[i]);
      if (i < silences.length) {
        audioParts.push(generateSilentMp3(silences[i]));
      }
    }
    const finalAudio = Buffer.concat(audioParts);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', finalAudio.byteLength);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).end(finalAudio);

  } catch (err) {
    console.error('Error interno en /api/audio:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
