// Vercel serverless function
// Recibe el contexto del usuario, llama a Claude API y devuelve el texto de la meditación

const checkRateLimit = require('./_ratelimit');

const WORD_COUNTS = { '5': 550 };

const SOUND_CONTEXTS = {
  rain:    'lluvia suave de fondo',
  ocean:   'olas del mar de fondo',
  forest:  'sonidos del bosque de fondo',
  birds:   'canto de pájaros de fondo',
  silence: 'silencio absoluto'
};

const SYSTEM_PROMPT = `Eres un guía de meditación experto con profundo conocimiento en mindfulness, body scan, respiración consciente, visualización guiada, meditación de compasión y técnicas de relajación como NSDR y coherencia cardíaca.

Generas meditaciones guiadas en español, en segunda persona (tú), con una voz cálida, pausada y presencial. El texto será leído en voz alta por una IA de síntesis de voz, por lo tanto:

- NO uses asteriscos, guiones, numeraciones, títulos ni ningún formato markdown
- Usa únicamente puntuación natural para crear ritmo y pausas: comas, puntos, párrafos
- Escribe exactamente como se habla, con frases cortas y naturales
- Las instrucciones de respiración deben ser explícitas, guiadas paso a paso y con ritmo claro
- Incluye momentos de silencio implícito mediante puntos y párrafos cortos

La meditación siempre sigue este arco:
1. Bienvenida breve y llegada al momento presente
2. Relajación física progresiva del cuerpo
3. Anclaje en la respiración
4. Trabajo central personalizado según el estado y objetivo del usuario
5. Cierre suave e integración

Elige las técnicas específicas según el objetivo: NSDR o yoga nidra para dormir, respiración 4-7-8 para ansiedad, coherencia cardíaca para estrés, observación de pensamientos sin apego para claridad mental. Aplica lo que corresponde al contexto del usuario, sin mencionarlo explícitamente.`;

module.exports = async (req, res) => {
  // Solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting: 5 meditaciones por IP por hora
  const allowed = await checkRateLimit(req, res, 'meditation', 5, '1 h');
  if (!allowed) return;

  const { userInput, duration, voice, sound } = req.body || {};

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

  const userPrompt = `El usuario comparte lo siguiente sobre su momento actual:

"${userInput}"

Contexto de la sesión:
- Duración: ${duration} minutos
- Longitud objetivo: aproximadamente ${targetWords} palabras
- Sonido de fondo: ${soundContext}
- Voz: ${voiceContext}

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
        max_tokens: 6000,
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
