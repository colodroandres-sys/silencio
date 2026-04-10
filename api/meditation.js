// Vercel serverless function
// Recibe el contexto del usuario, llama a Claude API y devuelve el texto de la meditación

const checkRateLimit = require('./_ratelimit');

const WORD_COUNTS = { '5': 300, '10': 600, '15': 900 };

const SYSTEM_PROMPT = `Eres un experto en diseño de meditaciones guiadas. Generas guiones optimizados para voz sintética (TTS). El silencio es el protagonista — las palabras son solo guías entre silencios.

CLASIFICACIÓN INTERNA (NO MOSTRAR): Infiere estado principal, subtipo, objetivo y estrategia según el input.

ESTRUCTURA OBLIGATORIA — 5 FASES (para 5 minutos = 300 segundos):
FASE 1 — Inducción (60s): frases directivas cortas. Silencios de 2-3s. Máximo 8 frases.
FASE 2 — Regulación (60s): introducir respiración. Silencios de 4-6s. Máximo 6 frases.
FASE 3 — Profundización (90s): frases permisivas, pocas palabras. Silencios de 8-12s. Máximo 4 frases.
FASE 4 — Estado objetivo (60s): mínimas palabras. Silencios de 15-20s. Máximo 2 frases.
FASE 5 — Cierre (30s): reorientación suave. Silencios de 5s. Máximo 3 frases.

MATEMÁTICA OBLIGATORIA: Antes de terminar, suma todos los segundos de [silencio:Xs] que generaste. Deben sumar mínimo 180 segundos para una meditación de 5 minutos. Si no llegan, agrega más silencios.

FORMATO: Solo texto narrado. Silencios con formato [silencio:Xs]. Sin títulos ni markdown.

REGLAS: Frases cortas. Lenguaje permisivo. El silencio hace el trabajo, no las palabras.

CONTINUIDAD FONÉTICA: Cada segmento de texto (frase después de un [silencio:Xs]) debe comenzar con una palabra completa y fonéticamente clara. Nunca empezar un segmento con sílabas sueltas o palabras cortas que puedan confundirse con el final del segmento anterior: prohibido comenzar con "Te", "Me", "Se", "Lo", "La", "Le", "Ir", "Un", "Y", "A", "O", "Si" u otras partículas de una o dos sílabas. Comenzar siempre con una palabra de tres o más sílabas, o con un sustantivo o verbo conjugado claro.

ADAPTACIÓN: ansiedad → respiración y presente. Sobrepensamiento → sensaciones corporales. Tristeza → validar sin intensificar. Sueño → ritmo lento, silencios muy largos.`;

module.exports = async (req, res) => {
  // Solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting: 5 meditaciones por IP por hora
  const allowed = await checkRateLimit(req, res, 'meditation', 10, '1 h');
  if (!allowed) return;

  const { userInput, userName, duration, voice, gender } = req.body || {};

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
- Voz: ${voiceContext}
- Género gramatical: ${genderContext}${userName ? `\n- Nombre del usuario: ${userName} (úsalo con naturalidad si encaja, no de forma forzada)` : ''}

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
      // Claude devolvió algo que no es JSON válido — no usar el texto crudo como meditación
      console.error('[meditation] Claude devolvió JSON inválido. Primeros 300 chars:', raw.slice(0, 300));
      return res.status(502).json({ error: 'Respuesta inválida de Claude API. Inténtalo de nuevo.' });
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
