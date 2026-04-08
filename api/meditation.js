// Vercel serverless function
// Recibe el contexto del usuario, llama a Claude API y devuelve el texto de la meditación

const checkRateLimit = require('./_ratelimit');

const WORD_COUNTS = { '5': 300, '10': 600, '15': 900 };

const SOUND_CONTEXTS = {
  rain:    'lluvia suave de fondo',
  ocean:   'olas del mar de fondo',
  forest:  'sonidos del bosque de fondo',
  birds:   'canto de pájaros de fondo',
  silence: 'silencio absoluto'
};

const SYSTEM_PROMPT = `Eres un experto en diseño de meditaciones guiadas con foco en inducción de estados mentales. Tu objetivo es generar un guion de meditación optimizado para ser leído por voz sintética (TTS), donde el factor más importante es la progresión del estado mental a través del ritmo, los silencios y el tipo de lenguaje.

CLASIFICACIÓN INTERNA (NO MOSTRAR): Antes de generar el guion, infiere el tipo de estado principal, subtipo, objetivo y estrategia según el input del usuario.

ESTRUCTURA OBLIGATORIA — 5 FASES:
FASE 1 — Inducción (primeros 60 segundos): frases directivas cortas, silencios de 1-3s, alta frecuencia de voz.
FASE 2 — Regulación fisiológica (siguiente 20% del tiempo): frases directivas y permisivas, introducir respiración, silencios de 3-6s.
FASE 3 — Profundización (siguiente 30% del tiempo): frases permisivas, menos instrucciones, silencios de 6-12s.
FASE 4 — Estado objetivo (siguiente 30% del tiempo): frases abiertas no directivas, silencios de 10-20s, muy pocas intervenciones, lenguaje adaptado al problema del usuario.
FASE 5 — Cierre (últimos 10% del tiempo): frases suaves de reorientación, silencios de 3-5s.

FORMATO DE SALIDA CRÍTICO: Solo texto narrado. Silencios explícitos con formato [silencio:Xs]. Cada frase en línea separada. Sin títulos ni explicaciones. Sin markdown.

REGLAS DE LENGUAJE: Frases cortas. Evitar afirmaciones irreales. Lenguaje permisivo en fases profundas. Dejar que el silencio haga el trabajo.

ADAPTACIÓN: ansiedad → respiración y presente. Sobrepensamiento → llevar a sensaciones. Tristeza → validar sin intensificar. Foco → activar ligeramente. Sueño → ritmo muy lento y silencios largos.

DURACIÓN: La meditación debe durar exactamente lo que el usuario eligió. Los silencios representan al menos el 60% del tiempo total.`;

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

  if (!['5', '10', '15'].includes(duration)) {
    return res.status(400).json({ error: 'Duración no válida. Debe ser 5, 10 o 15 minutos.' });
  }

  if (userInput.length > 500) {
    return res.status(400).json({ error: 'El texto no puede superar los 500 caracteres.' });
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
        max_tokens: 4000,
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

    console.log('TEXTO GENERADO:', JSON.stringify({title, text}));
    return res.status(200).json({ title, text });

  } catch (err) {
    console.error('Error interno en /api/meditation:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
