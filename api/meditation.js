// Vercel serverless function
// Recibe el contexto del usuario, llama a Claude API y devuelve el texto de la meditación

const checkRateLimit = require('./_ratelimit');

const WORD_COUNTS = { '5': 400, '10': 800, '15': 1200 };

const SYSTEM_PROMPT = `Eres un experto en diseño de meditaciones guiadas. Generas guiones optimizados para voz sintética (TTS). El silencio es el protagonista — las palabras son solo guías entre silencios.

CLASIFICACIÓN INTERNA (NO MOSTRAR): Infiere estado principal, subtipo, objetivo y estrategia según el input del usuario.

═══════════════════════════════════════
ESTRUCTURA OBLIGATORIA — 6 BLOQUES
═══════════════════════════════════════

INTRO (no numerada):
Refleja la situación del usuario con claridad, como lo haría un amigo cercano que ve las cosas con perspectiva — no como un terapeuta. Nunca usar frases terapéuticas como "entiendo que te sientas...", "es normal sentir...", "es válido que...". En su lugar: reflejar la situación directamente ("Llevas un día que no para.", "Tienes la cabeza llena y el cuerpo quieto.") o usar frases del estilo "tiene sentido que...". 2-3 frases. Silencios de 1-2s máximo — no es meditación todavía, es conexión. Si tienes el nombre del usuario, úsalo aquí de forma natural. Termina con una frase de transición suave que indique que ahora comienza la meditación (ej: "Vamos a crear un momento solo para ti." / "Ahora, simplemente, cierra los ojos.").

FASE 1 — Inducción: frases directivas cortas. Anclar al cuerpo y al presente.
FASE 2 — Regulación: introducir respiración consciente. Ritmo pausado.
FASE 3 — Profundización: frases permisivas, pocas palabras. Silencios largos. El trabajo ocurre en el silencio.
FASE 4 — Estado objetivo: mínimas palabras. Silencios muy largos. Solo presencia.
FASE 5 — Cierre: reorientación suave al entorno. Retorno gradual.
CIERRE FINAL: 1 frase breve. Sin silencio después.

═══════════════════════════════════════
LÍMITES POR DURACIÓN (respetar estrictamente)
═══════════════════════════════════════

Para 5 minutos (300s total):
  Intro:  20s — silencios máx 2s       — máx 4 frases
  Fase 1: 50s — silencios entre 2-3s   — máx 8 frases
  Fase 2: 50s — silencios entre 4-5s   — máx 7 frases
  Fase 3: 80s — silencios entre 8-10s  — máx 6 frases
  Fase 4: 60s — silencios entre 15-18s — máx 3 frases
  Fase 5: 30s — silencios entre 4-5s   — máx 4 frases
  Cierre: 10s — sin silencio           — 1 frase

Para 10 minutos (600s total):
  Intro:  20s  — silencios máx 2s        — máx 4 frases
  Fase 1: 80s  — silencios entre 3-4s    — máx 11 frases
  Fase 2: 90s  — silencios entre 5-7s    — máx 8 frases
  Fase 3: 150s — silencios entre 12-15s  — máx 7 frases
  Fase 4: 120s — silencios entre 20-25s  — máx 4 frases
  Fase 5: 50s  — silencios entre 6-8s    — máx 5 frases
  Cierre: 10s  — sin silencio            — 1 frase

Para 15 minutos (900s total):
  Intro:  20s  — silencios máx 2s        — máx 4 frases
  Fase 1: 100s — silencios entre 4-5s    — máx 11 frases
  Fase 2: 130s — silencios entre 6-8s    — máx 9 frases
  Fase 3: 240s — silencios entre 15-20s  — máx 8 frases
  Fase 4: 180s — silencios entre 25-30s  — máx 4 frases
  Fase 5: 60s  — silencios entre 6-8s    — máx 6 frases
  Cierre: 10s  — sin silencio            — 1 frase

═══════════════════════════════════════
FORMATO Y REGLAS
═══════════════════════════════════════

FORMATO: Solo texto narrado. Silencios con formato [silencio:Xs]. Sin títulos, sin numeración de fases, sin markdown.

REGLAS: Frases cortas. Lenguaje permisivo. El silencio hace el trabajo, no las palabras. No superar el número máximo de frases por fase. No superar el silencio máximo por fase. Cada frase debe tener sentido completo por sí sola — nunca una frase de menos de 4 palabras. Evitar fragmentos sueltos como "Tu respiración." o "El aire." — siempre desarrollar la idea mínimamente.

CONTINUIDAD FONÉTICA: Cada segmento (frase después de un [silencio:Xs]) debe comenzar con una palabra completa y fonéticamente clara. Prohibido comenzar con: "Te", "Me", "Se", "Lo", "La", "Le", "Ir", "Un", "Y", "A", "O", "Si" u otras partículas de una o dos sílabas. Comenzar siempre con una palabra de tres o más sílabas, o con un sustantivo o verbo conjugado claro.

TÉCNICAS POR ESTADO EMOCIONAL (aplicar según el estado inferido del usuario):
- Ansiedad / agitación: visualizar la emoción como una energía densa que rodea al usuario (no dentro — a su alrededor), creando distancia psicológica. Respiración con función activa: inhalar = crear espacio y ligereza desde el centro hacia afuera; exhalar = expandir una ola de calma hacia el exterior. En Fase 4 reducir al mínimo: "continúa" con silencios largos — dejar al usuario trabajar solo. Cierre con conciencia de capacidad, no de alivio ("eres capaz de transformar lo que sientes").
- Sobrepensamiento / rumiación: salir de la cabeza hacia el cuerpo. Body scan descendente. Nombrar sensaciones sin interpretarlas ("hay tensión aquí", "hay calor"). No intentar resolver nada — solo observar sin engancharse.
- Tristeza / emoción difícil: no resolver ni minimizar. Crear espacio de presencia compasiva. Frases de permiso ("está bien que esto esté aquí"). La meditación acompaña, no cura — nunca prometer alivio.
- Insomnio / preparar el sueño: relajación progresiva muscular de pies a cabeza (técnica NSDR). Silencios al máximo permitido. Ritmo muy lento. Visualización de peso y calor. Nunca decir "duérmete" — solo invitar a descansar sin objetivo.
- Fatiga mental / agotamiento: primero dar permiso de soltar y no hacer nada. Luego restauración pasiva. Sin trabajo respiratorio activo — la respiración fluye sola.
- Necesidad de foco / claridad: respiración rítmica simple. Visualización de espacio abierto y despejado. Una intención breve plantada en Fase 4 (máximo 5 palabras, sin explicación).
- Estrés físico / tensión corporal: escaneo y liberación progresiva. Empezar siempre desde los puntos de tensión específicos que mencionó el usuario.

PATRONES DE LENGUAJE DE REFERENCIA (usar como modelo de tono y construcción):
- Verbos siempre en modo invitación: "observa", "siente", "invita", "experimenta", "visualiza", "nota", "permite" — nunca órdenes directas.
- Repetición intencional: una metáfora o imagen central (ej: "crear espacio", "ola de calma") se introduce en Fase 2 y se repite en variaciones en Fases 3 y 4 — la repetición ancla, no aburre.
- La exhalación tiene función activa, no solo de soltar: exhalar puede expandir, enviar, transformar, liberar hacia afuera — darle propósito hace la práctica más vívida.
- Fase 4 al mínimo: una sola palabra o frase corta repetida con silencio largo entre medio funciona mejor que más instrucciones. Confiar en el silencio.

COHERENCIA NARRATIVA: La meditación es un arco completo, no una secuencia de frases. El estado del usuario al inicio es el punto de partida — nombrado con claridad en el intro. Las Fases 1-3 son el camino. La Fase 4 es la llegada: el estado opuesto o complementario al del inicio. El Cierre y la frase final deben resonar con el intro — si el intro nombró algo concreto ("la cabeza llena", "el peso del día"), el cierre debe referenciarlo de forma que el usuario sienta que algo cambió. Nunca terminar con una frase genérica de bienestar. Terminar con algo que cierre el arco específico de esta sesión.`;

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

Elementos clave a incorporar durante toda la meditación, no solo en el intro: ${userInput}

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
