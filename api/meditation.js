// Vercel serverless function
// Recibe el contexto del usuario, llama a Claude API y devuelve el texto de la meditación

const checkRateLimit = require('./_ratelimit');

const WORD_COUNTS = { '5': 250 };

const SOUND_CONTEXTS = {
  rain:    'lluvia suave de fondo',
  ocean:   'olas del mar de fondo',
  forest:  'sonidos del bosque de fondo',
  birds:   'canto de pájaros de fondo',
  silence: 'silencio absoluto'
};

const SYSTEM_PROMPT = `Eres un guía de meditación con voz serena y presencia tranquila.

Generas meditaciones guiadas en español, en segunda persona (tú).
El texto será leído por una IA de síntesis de voz. Sigue estas reglas sin excepción:

FORMATO:
- Frases muy cortas. Máximo 10 palabras por frase.
- Después de cada frase o instrucción, escribe "..." para marcar silencio.
- Cada párrafo contiene una sola idea o instrucción. Luego silencio.
- Sin asteriscos, guiones, numeraciones ni markdown de ningún tipo.

RITMO:
- Das una instrucción. Luego silencio con "..." para que el usuario la experimente.
- No expliques lo que va a pasar. Solo guía el momento presente.
- Nunca encadenes dos instrucciones seguidas sin silencio entre ellas.

LONGITUD:
- Una meditación de 5 minutos tiene entre 200 y 280 palabras habladas. Nada más.
- El silencio hace el trabajo. Las palabras solo abren la puerta.

ESTRUCTURA (sin mencionarla):
1. Llegada — 2 o 3 frases para anclar al usuario en el momento
2. Cuerpo — relajación física breve, de arriba hacia abajo o al revés
3. Respiración — 2 o 3 ciclos guiados explícitamente
4. Centro — trabajo específico según el estado del usuario (1 imagen o sensación, no más)
5. Cierre — 2 o 3 frases para integrar y soltar

Elige la técnica según el contexto: respiración 4-7-8 para ansiedad, body scan para tensión, una imagen simple para claridad, dejar ir pensamientos para el cierre. Aplícala sin nombrarla.`;

module.exports = async (req, res) => {
  // Solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting: 5 meditaciones por IP por hora
  const allowed = await checkRateLimit(req, res, 'meditation', 5, '1 h');
  if (!allowed) return;

  const { userInput, duration, voice, sound, gender } = req.body || {};

  if (!userInput || !duration) {
    return res.status(400).json({ error: 'Faltan campos requeridos: userInput, duration' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada' });
  }

  const targetWords = WORD_COUNTS[duration] || 1100;
  const soundContext = SOUND_CONTEXTS[sound] || 'silencio';
  const voiceContext = voice === 'masculine'
    ? 'La voz que leerá esto es masculina. Usa un tono firme, sereno y con autoridad tranquila.'
    : 'La voz que leerá esto es femenina. Usa un tono cálido, suave y envolvente.';
  const genderContext = gender === 'masculino'
    ? 'Dirígete al usuario en masculino: adjetivos y artículos en masculino (ej: "estás tranquilo", "eres capaz", "te sientes libre").'
    : 'Dirígete al usuario en femenino: adjetivos y artículos en femenino (ej: "estás tranquila", "eres capaz", "te sientes libre").';

  const userPrompt = `El usuario comparte lo siguiente sobre su momento actual:

"${userInput}"

Contexto de la sesión:
- Duración: ${duration} minutos
- Longitud objetivo: aproximadamente ${targetWords} palabras
- Sonido de fondo: ${soundContext}
- Voz: ${voiceContext}
- Género gramatical: ${genderContext}

Devuelve únicamente un objeto JSON válido con este formato exacto (sin texto adicional antes ni después):
{"title": "título de 3-5 palabras en español", "text": "texto completo de la meditación aquí"}

El campo "title" debe capturar en pocas palabras la esencia de esta sesión (ej: "Para soltar el día", "Antes de dormir", "Calmar la tormenta interior").
El campo "text" debe contener solo el texto de la meditación, sin títulos ni explicaciones.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('Claude API error:', err);
      return res.status(502).json({ error: 'Error en Claude API', details: err.error?.message });
    }

    const data = await response.json();
    let raw = data.content?.[0]?.text?.trim() || '';

    if (!raw) {
      return res.status(502).json({ error: 'Respuesta vacía de Claude API' });
    }

    let title, text;
    try {
      // Extraer el primer bloque JSON del texto, ignorando texto antes/después o fences
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      const parsed = JSON.parse(jsonMatch[0]);
      title = parsed.title || 'Tu meditación';
      text  = parsed.text;
    } catch {
      // Fallback si la respuesta no es JSON válido
      title = 'Tu meditación';
      text  = raw;
    }

    if (!text) {
      return res.status(502).json({ error: 'Respuesta vacía de Claude API' });
    }

    return res.status(200).json({ title, text });

  } catch (err) {
    console.error('Error interno en /api/meditation:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
