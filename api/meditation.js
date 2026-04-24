// Vercel serverless function
// Recibe el contexto del usuario, llama a Claude API y devuelve el texto de la meditación

const checkRateLimit = require('./_ratelimit');
const { getOrCreateUser, checkUsageLimit } = require('./_limits');

const WORD_COUNTS = {
  feminine: { '5': 420, '10': 750, '15': 1200, '20': 1100 },
  masculine: { '5': 460, '10': 820, '15': 1320, '20': 1700 }
};

// Silencio máximo por marcador individual (en segundos)
const MAX_SILENCE_PER_MARKER = {
  feminine: { '5': 18, '10': 32, '15': 90, '20': 150 },
  masculine: { '5': 18, '10': 32, '15': 90, '20': 150 }
};
// Silencio total máximo en toda la meditación (en segundos)
// Femenina 20 min más bajo porque la voz es más lenta y necesita menos silencio para llegar a 20 min
const MAX_TOTAL_SILENCE = {
  feminine: { '5': 185, '10': 360, '15': 520, '20': 560 },
  masculine: { '5': 185, '10': 360, '15': 520, '20': 640 }
};

// Recorta el texto al límite de palabras en un punto de corte natural (fin de frase)
// Los marcadores [silencio:Xs] no cuentan como palabras
function enforceWordLimit(text, maxWords) {
  const parts = text.split(/(\[silencio:\d+s\])/gi);
  let wordCount = 0;
  const result = [];

  for (const part of parts) {
    if (/^\[silencio:\d+s\]$/i.test(part)) {
      result.push(part);
      continue;
    }
    const trimmed = part.trim();
    if (!trimmed) { result.push(part); continue; }

    const words = trimmed.split(/\s+/);
    if (wordCount + words.length <= maxWords) {
      wordCount += words.length;
      result.push(part);
    } else {
      const canTake = maxWords - wordCount;
      const slice   = words.slice(0, canTake).join(' ');
      const lastEnd = Math.max(slice.lastIndexOf('.'), slice.lastIndexOf('?'), slice.lastIndexOf('!'));
      result.push(lastEnd > 0 ? slice.substring(0, lastEnd + 1) : slice + '.');
      break;
    }
  }

  return result.join('').trim();
}

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
FORMATO Y REGLAS
═══════════════════════════════════════

FORMATO: Solo texto narrado. Silencios con formato [silencio:Xs]. Sin títulos, sin numeración de fases, sin markdown.

REGLAS: Frases cortas. Lenguaje permisivo. El silencio hace el trabajo, no las palabras. No superar el número máximo de frases por fase. No superar el silencio máximo por fase. Cada frase debe tener sentido completo por sí sola — nunca una frase de menos de 4 palabras. Evitar fragmentos sueltos como "Tu respiración." o "El aire." — siempre desarrollar la idea mínimamente.

CONTINUIDAD FONÉTICA: Cada segmento (frase después de un [silencio:Xs]) debe comenzar con una palabra completa y fonéticamente clara. Prohibido comenzar con: "Te", "Me", "Se", "Lo", "La", "Le", "Ir", "Un", "Y", "A", "O", "Si" u otras partículas de una o dos sílabas. Comenzar siempre con una palabra de tres o más sílabas, o con un sustantivo o verbo conjugado claro.

TÉCNICAS POR ESTADO EMOCIONAL (aplicar según el estado inferido del usuario):
- Ansiedad / agitación: visualizar la emoción como una energía densa que rodea al usuario (no dentro — a su alrededor), creando distancia psicológica. Respiración con función activa: inhalar = crear espacio y ligereza desde el centro hacia afuera; exhalar = expandir una ola de calma hacia el exterior. En Fase 4 reducir al mínimo: una palabra o frase corta repetida con silencio largo — dejar al usuario trabajar solo. Cierre con conciencia de capacidad, no de alivio ("eres capaz de transformar lo que sientes").
- Estrés / agitación mental: exhalación ligeramente más larga que la inhalación como primer gesto (efecto calmante inmediato). Metáfora del árbol: parte alta del cuerpo (cabeza, cuello, hombros) = copa agitada por el viento; parte baja (abdomen, pelvis, piernas) = tronco y raíces que no se mueven. Mover la atención de la copa hacia la base. Respiración abdominal como ancla en esa base estable. Repetir la metáfora: "ya no estás en la copa — estás en la base, firme, silencioso".
- Sistema nervioso / calma rápida: visualización de playa como espejo del estado interno — sentado frente al mar, sol naciente, brisa suave, temperatura agradable, sonido de olas. Las olas = la respiración: "vienen y van". El mar se va calmando progresivamente = la respiración se calma: "cada ola más suave y lenta que la anterior, igual que cada respiración". Estado final: "un mar tranquilo, cristalino — igual que tú ahora".
- Sobrepensamiento / rumiación: salir de la cabeza hacia el cuerpo. Anclaje sensorial (luz, sonidos, temperatura en la piel) antes de ir a la respiración. Body scan descendente. Nombrar sensaciones sin interpretarlas. No resolver — solo observar. Normalizar la distracción: "tu mente se distraerá — cuando lo haga, simplemente vuelve".
- Tristeza / emoción difícil / soltar: localizar la sensación incómoda en el cuerpo (¿en el pecho, el abdomen?). Observarla con la curiosidad de un niño inocente — sin juzgar, solo explorar. Permitir que habite el cuerpo en lugar de resistirla: "llevas tiempo resistiéndote — ahora le das espacio". La sensación se reduce por sí sola una vez se siente vista. Metáfora útil: ignorar una emoción es como ignorar a un niño que llama a la puerta — seguirá llamando hasta que reciba atención. Frase interna: "todo está bien ahora mismo". Opcional: tapping suave con la palma en la zona de tensión, respirando hacia ese lugar.
- Insomnio / preparar el sueño: posición boca arriba si es posible. Liberación corporal sistemática de pies a cabeza con lenguaje de peso y gravedad: "los pies caen flojos, las rodillas se sueltan, la espalda cae rendida hacia la tierra". Visualización del aire como movimiento vertical: sube de pies a coronilla al inhalar, desciende de coronilla a pies al exhalar — recorre todo el cuerpo. Tres ciclos de respiración dirigidos en secuencia: cuerpo, luego mente, luego emociones. Gratitud breve a cada nivel entre ciclos. Fase 4: permiso total — "nada que hacer, nada que pensar, nada que sentir". Cierre con autocompasión: reconocer méritos del día, perdonar errores, permiso de descansar. Nunca decir "duérmete".
- Fatiga mental / agotamiento: permiso de soltar y no hacer nada. Restauración pasiva. Sin trabajo respiratorio activo — la respiración fluye sola.
- Foco / claridad mental: llevar la atención al entrecejo (punto entre las cejas). Visualizar la respiración entrando y saliendo por ese punto. Cada inhalación aporta claridad y estabiliza los pensamientos. Fase 4: "experimenta claridad, lucidez — las situaciones se ven con mayor perspectiva".
- Tensión corporal: liberación progresiva desde los puntos de tensión específicos que mencionó el usuario.
- Duelo / pérdida / perdonar / despedida: mantra "So Ham" (so al inhalar, ham al exhalar) para calmar la mente antes de la visualización. Visualizar a la persona o situación de la que se quiere despedir — sin forma correcta o incorrecta, solo visualizar lo mejor posible. Rodear esa imagen de luz: no oscura, luminosa, brillante. Frases de perdón dirigidas hacia afuera: "te perdono, gracias, te amo". Luego girar hacia uno mismo: "me perdono, gracias, me amo" — el perdón propio es igual de importante que el externo. Visualizar a la persona/situación dándose la vuelta y alejándose hasta desaparecer en el horizonte. Estado final: alivio y ligereza — "como si hubieras quitado un gran peso de tus hombros". No forzar alegría — solo la ligereza del soltar.
- Tomar decisiones / encrucijadas: limpiar primero — visualizar un cordón de energía que desciende a la tierra y soltar por él todos los miedos, dudas, opiniones ajenas y confusión; la tierra los neutraliza. Técnica de las dos puertas: asignar cada opción a una puerta, entrar en la primera, observar sin juzgar qué siente el cuerpo (expansión o encogimiento, paz o presión), salir, hacer grounding, luego entrar en la segunda y comparar. Diagnóstico: expansión y libertad = señal de alineación; encogimiento y opresión = señal de conflicto. Una ansiedad con fondo de paz puede igualmente indicar la opción correcta. Si no llega respuesta clara, el momento puede no ser el adecuado — no forzar.
- Confianza / autoestima / fortaleza interior: respiración afirmativa progresiva: primero "inhalo y sé que estoy inhalando", luego "inhalo y me lleno de energía, exhalo y libero lo que me tensa". Luz cálida desde el ombligo que se expande hacia todo el cuerpo, luego hacia la habitación, luego más lejos — la confianza se irradia hacia afuera. Frases: "sentirte a salvo, conectado con tu fuerza interior, tu sabiduría, tu potencial". Cierre con gratitud hacia uno mismo por el tiempo dedicado; "vuelve a esta sensación cuando la necesites — solo cierra los ojos y respira".

PATRONES DE LENGUAJE DE REFERENCIA (usar como modelo de tono y construcción):
- Verbos siempre en modo invitación: "observa", "siente", "invita", "experimenta", "visualiza", "nota", "permite", "dedica", "abandónate" — nunca órdenes directas.
- Repetición intencional: una metáfora o imagen central se introduce en Fase 2 y se repite con variaciones en Fases 3 y 4 — la repetición ancla, no aburre.
- La exhalación tiene función activa: exhalar puede expandir, enviar, transformar, liberar — darle propósito hace la práctica más vívida que simplemente "soltar".
- Anclaje sensorial como apertura: antes de ir a la respiración, notar luz, sonidos o temperatura en la piel — trae al presente de forma concreta y suave.
- Exhalar en suspiro como gesto de liberación: en transiciones entre fases, pedir un suspiro de exhalación — liberación instantánea de tensión acumulada.
- Explorar la incomodidad con curiosidad: "con la curiosidad de un niño inocente" — reemplaza la resistencia por observación neutra.
- Movimiento vertical del aire: visualizar el aire subiendo de pies a coronilla al inhalar y bajando al exhalar — crea presencia corporal total, especialmente útil para insomnio y fatiga.
- Normalizar la distracción: "tu mente se distraerá — cuando lo haga, simplemente vuelve" — reduce la frustración y hace la práctica accesible.
- Frases de permiso total para Fase 4: "no hay nada que hacer, ningún lugar al que ir, nada que pensar" — especialmente cuando el usuario llega agotado o sobrepensando.
- Frase interna susurrada: "todo está bien ahora mismo" — para estados de ansiedad o preocupación, susurrársela internamente durante Fase 3 o 4.
- Secuencia de perdón: primero hacia afuera ("te perdono, gracias, te amo"), luego hacia adentro ("me perdono, gracias, me amo") — para cualquier estado que implique relaciones rotas, culpa o juicio propio.
- Test expansión/encogimiento: para estados de duda o decisión, hacer que el usuario observe si siente expansión (alineación) o encogimiento (conflicto) en el cuerpo ante cada opción — sin análisis mental, solo sensación física.
- Cordón a la tierra: visualizar energía que desciende a las profundidades de la tierra para liberar lo que no pertenece al usuario (miedos, opiniones ajenas, tensión acumulada) — efectivo como limpieza antes de cualquier trabajo de claridad o decisión.
- Luz desde el ombligo: alternativa a la luz desde el pecho — para estados de confianza o autoestima, la luz nace desde el centro del cuerpo (ombligo) y se expande progresivamente hacia afuera.
- Fase 4 al mínimo: una sola palabra o frase corta repetida con silencio largo. Confiar en el silencio.

COHERENCIA NARRATIVA: La meditación es un arco completo, no una secuencia de frases. El estado del usuario al inicio es el punto de partida — nombrado con claridad en el intro. Las Fases 1-3 son el camino. La Fase 4 es la llegada: el estado opuesto o complementario al del inicio. El Cierre y la frase final deben resonar con el intro — si el intro nombró algo concreto ("la cabeza llena", "el peso del día"), el cierre debe referenciarlo de forma que el usuario sienta que algo cambió. Nunca terminar con una frase genérica de bienestar. Terminar con algo que cierre el arco específico de esta sesión.`;

function getDurationBlock(duration) {
  const blocks = {
    '5': `
═══════════════════════════════════════
ESTRUCTURA PARA ESTA SESIÓN: 5 MINUTOS (300s total)
═══════════════════════════════════════

4 secciones fluidas. Sin títulos ni numeración en el texto. El narrador guía continuamente — no se retira.

SECCIÓN 1 — ENTRADA (~40 palabras, 0:00-0:40):
2 frases de posicionamiento + cierre de ojos. Primera invitación a respirar antes de la palabra 30.
Silencios: máx [silencio:3s]. Sin silencios post-respiración aquí.

SECCIÓN 2 — TÉCNICA PRINCIPAL (~120 palabras, 0:40-2:30):
Introduce la visualización o técnica central sin preámbulo. Desarrolla en 5-7 frases activas.
Silencios normales: [silencio:5s] a [silencio:8s].
Frases con instrucción de respiración (inhala / exhala / respira / suelta el aire): usar [silencio:12s] después.

SECCIÓN 3 — PROFUNDIZACIÓN (~60 palabras, 2:30-4:30):
La técnica ya está instalada — el usuario trabaja con guías breves. Máximo 4 frases en 2 minutos.
Silencios: [silencio:16s] a [silencio:25s]. Este es el silencio más largo de toda la sesión.

SECCIÓN 4 — CIERRE (~40 palabras, 4:30-5:00):
Reorientación suave en 3-4 frases. Silencios: [silencio:4s] a [silencio:5s]. Sin silencio después de la última frase.
EXCEPCIÓN DORMIR: sin cierre ni retorno físico. La profundización se disuelve con una frase de permiso total.`,

    '10': `
═══════════════════════════════════════
ESTRUCTURA PARA ESTA SESIÓN: 10 MINUTOS (600s total)
═══════════════════════════════════════

5 secciones. La técnica principal tiene dos pasadas — en la segunda, el narrador habla menos.

SECCIÓN 1 — ENTRADA (~60 palabras, 0:00-1:00):
Posicionamiento + 1-2 frases normalizando que la mente se distrae. Primera respiración antes de la palabra 40.
Silencios: máx [silencio:3s].

SECCIÓN 2 — RESPIRACIÓN CONSCIENTE (~100 palabras, 1:00-2:30):
Establece el patrón respiratorio de la sesión con instrucción activa. 4-6 frases.
Mínimo 5 marcadores de silencio: los normales [silencio:6s] a [silencio:8s], los post-respiración [silencio:14s] a [silencio:16s]. Cierra con [silencio:23s].

SECCIÓN 3 — TÉCNICA PRINCIPAL, PRIMERA PASADA (~200 palabras, 2:30-6:00):
Desarrolla la técnica con guía detallada y narrativa activa. El narrador está presente.
Mínimo 8 marcadores de silencio: los normales [silencio:10s] a [silencio:14s], los post-respiración [silencio:18s] a [silencio:22s].

SECCIÓN 4 — SEGUNDA PASADA / PROFUNDIZACIÓN (~80 palabras, 6:00-8:30):
El narrador habla poco. Frases muy cortas o landmarks de 1-2 palabras ("continúa", "aquí", "respira").
Exactamente 3 silencios de [silencio:35s] a [silencio:40s] — no menos de [silencio:35s] bajo ninguna circunstancia.

SECCIÓN 5 — CIERRE (~80 palabras, 8:30-10:00):
Retorno gradual en 4-5 frases. Breve observación de cómo se siente el cuerpo ahora.
Silencios: [silencio:6s] a [silencio:8s]. Sin silencio después de la última frase.
EXCEPCIÓN DORMIR: sin retorno físico. Cierre con autocompasión, gratitud y permiso de descansar. Se disuelve.`,

    '15': `
═══════════════════════════════════════
ESTRUCTURA PARA ESTA SESIÓN: 15 MINUTOS (900s total)
═══════════════════════════════════════

6 secciones. Incluye un TRASPASO obligatorio alrededor de la palabra 400. Después del traspaso, el narrador casi desaparece.

SECCIÓN 1 — ENTRADA (~65 palabras, 0:00-1:00):
Posicionamiento + normalización en 3 frases. Primera respiración antes de la palabra 45.
Silencios: máx [silencio:3s].

SECCIÓN 2 — ANCLAJE CORPORAL (~110 palabras, 1:00-3:00):
Atención a la base del cuerpo (pelvis, columna, peso hacia la tierra). Respiración como ancla.
Silencios normales: [silencio:6s] a [silencio:8s]. Post-respiración: [silencio:12s] a [silencio:14s].
Termina con silencio de transición: [silencio:25s] a [silencio:30s].

SECCIÓN 3 — TÉCNICA, PRIMERA PASADA COMPLETA (~200 palabras, 3:00-7:00):
Desarrolla la técnica con narrativa completa y todos sus elementos sensoriales.
Silencios: [silencio:14s] a [silencio:20s]. Post-respiración: [silencio:22s] a [silencio:28s].

TRASPASO — OBLIGATORIO (alrededor de la palabra 400):
Una sola frase de entrega explícita. Ejemplos: "Mantente aquí, en este espacio que es tuyo." / "A partir de aquí, el trabajo es tuyo." / "El silencio hace el resto." Después de esta frase: modo landmark.

SECCIÓN 4 — PRÁCTICA SOSTENIDA (~80 palabras, 7:00-12:00):
SOLO landmarks de 1-2 palabras: "Continúa.", "Aquí.", "Respira.", "Mantente.", "Sigue."
Exactamente 5-6 landmarks en 5 minutos. Cada silencio entre landmarks: [silencio:60s] a [silencio:75s] — no menos de [silencio:60s] bajo ninguna circunstancia.
El trabajo ocurre en el silencio — no en las palabras.

SECCIÓN 5 — CIERRE (~145 palabras, 12:00-15:00):
Retorno gradual ("empieza a tomar conciencia de tu cuerpo..."). Reflexión sobre la capacidad del usuario — no bienestar genérico.
Silencios: [silencio:8s] a [silencio:12s]. Sin silencio después de la última frase.
EXCEPCIÓN DORMIR: autocompasión + gratitud + permiso de descansar. Sin retorno físico. Se disuelve.`,

    '20': `
═══════════════════════════════════════
ESTRUCTURA PARA ESTA SESIÓN: 20 MINUTOS (1200s total)
═══════════════════════════════════════

Hasta 8 secciones (2 condicionales). Setup corporal elaborado. Técnica en dos pasadas completas. Silencio de procesamiento de 2-3 minutos tras el trabajo principal.

SECCIÓN 1 — SETUP CORPORAL ELABORADO (~200 palabras, 0:00-2:30):
Preparación del cuerpo — no es meditación todavía. Describe CADA zona relajándose de pies a cabeza con lenguaje de peso y gravedad: pies, pantorrillas, rodillas, muslos, caderas, abdomen, espalda baja, espalda alta, hombros, brazos, manos, cuello, mandíbula, frente. Usa frases largas y sensoriales: "los pies caen flojos hacia los lados", "las rodillas se sueltan sin esfuerzo".
Silencios: [silencio:3s] a [silencio:5s] entre zonas corporales.

SECCIÓN 2 — RESPIRACIÓN Y OBSERVACIÓN INTERNA (~200 palabras, 2:30-5:30):
Visualización del aire ascendiendo de pies a coronilla al inhalar, descendiendo al exhalar. Observación del estado emocional actual sin juzgar (nombrar posibilidades sin forzar ninguna). Guía 3 ciclos completos de respiración con descripción detallada de cada uno.
Silencios normales: [silencio:8s] a [silencio:12s]. Post-respiración: [silencio:16s] a [silencio:20s].
Incluir 1 silencio de observación: [silencio:30s] a [silencio:40s].

SECCIÓN 3 — INTENCIÓN / SANKALPA (~80 palabras, 5:30-7:30):
Introduce una afirmación de intención corta, en presente positivo (sin negaciones). Explica brevemente por qué esta intención tiene sentido ahora. Silencio para repetirla mentalmente 3 veces: [silencio:25s] a [silencio:30s].
EXCEPCIÓN AGOTAMIENTO/INSOMNIO: omitir esta sección, pasar directamente a la técnica.

SECCIÓN 4 — TÉCNICA, PRIMERA PASADA (~450 palabras, 7:30-12:00):
Guía completamente detallada. Si es rotación corporal: ambas direcciones, parte posterior y anterior por separado, cada zona con descripción sensorial completa. Si es visualización: todos los elementos sensoriales (visual, táctil, auditivo, temperatura). El narrador está presente y acompaña cada paso.
Mínimo 14 marcadores de silencio: los normales [silencio:10s] a [silencio:15s], los post-respiración [silencio:18s] a [silencio:25s].

SECCIÓN 5 — TÉCNICA, SEGUNDA PASADA (~250 palabras, 12:00-15:00):
El narrador habla menos — repite la técnica con menos palabras y más silencio. Cada instrucción va seguida de un silencio generoso. El espacio es más importante que las palabras en esta sección.
Mínimo 8 marcadores de silencio: [silencio:22s] a [silencio:35s]. No más de 2 frases seguidas sin silencio.

SECCIÓN 6 — AFIRMACIONES (solo para: miedo, angustia, baja autoestima, duelo) (~150 palabras, si aplica):
8-12 afirmaciones. Cada una: 1 frase en presente positivo + [silencio:12s] a [silencio:15s] para internalizarla.

SECCIÓN 7 — SILENCIO DE PROCESAMIENTO (~25 palabras):
1-2 frases máximo: "Quédate aquí." / "Integra lo que has experimentado." Luego silencio puro: [silencio:90s] a [silencio:150s]. Sin más instrucciones. Este silencio es el corazón de los 20 minutos.

SECCIÓN 8 — CIERRE (~200 palabras, 18:00-20:00):
Retorno gradual con movimiento suave (dedos, estiramientos). Reflexión extensa sobre la capacidad del usuario y lo que acaba de experimentar. Instrucción detallada de uso: cómo el usuario puede volver a esta sensación cuando lo necesite fuera de la sesión, en qué momentos aplicarla, qué señal usar para acceder a este estado.
Silencios: [silencio:8s] a [silencio:12s]. Sin silencio después de la última frase.
EXCEPCIÓN DORMIR: sin retorno físico. Se disuelve en música.`
  };

  return blocks[duration] || '';
}

module.exports = async (req, res) => {
  // Solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting general: 10 por IP por hora (aplica a todos)
  const allowed = await checkRateLimit(req, res, 'meditation', 10, '1 h');
  if (!allowed) return;

  // Auth: opcional — guests pueden generar sin cuenta (primera meditación wow)
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const isGuest = !token;
  let clerkId = null;
  let limitCheck = { allowed: true, plan: 'guest' };

  if (isGuest) {
    // Guests: 1 meditación para siempre — Supabase es la fuente de verdad
    const { getSupabase } = require('./_supabase');
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    try {
      const { data } = await getSupabase().from('guest_usage').select('id').eq('ip', ip).limit(1);
      if (data && data.length > 0) {
        return res.status(402).json({
          error: 'Has completado tu meditación de prueba. Crea una cuenta para continuar.',
          guestBlocked: true
        });
      }
    } catch (_) { /* silencioso — si falla la consulta, permitir */ }
  } else {
    // Usuario con cuenta: verificar token y plan
    const { verifyToken } = require('@clerk/backend');
    try {
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
        publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      });
      clerkId = payload.sub;
    } catch (e) {
      console.error('[auth] Token inválido:', e.message);
      return res.status(401).json({ error: 'Sesión expirada. Vuelve a iniciar sesión.' });
    }

    const email = req.headers['x-user-email'] || '';
    await getOrCreateUser(clerkId, email);

    limitCheck = await checkUsageLimit(clerkId);
    console.log('[meditation][limit-check]', JSON.stringify({ clerkId, limitCheck }));
    if (!limitCheck.allowed) {
      const msg = limitCheck.reason === 'free_limit'
        ? 'Has usado tu meditación gratuita. Elige un plan para continuar.'
        : `Has alcanzado tu límite de ${limitCheck.limit} meditaciones este mes.`;
      return res.status(402).json({
        error: msg,
        currentPlan: limitCheck.plan,
        usage: limitCheck.usage,
        limit: limitCheck.limit
      });
    }
  }

  const { userInput, userName, duration, voice, gender } = req.body || {};

  if (!userInput || !duration) {
    return res.status(400).json({ error: 'Faltan campos requeridos: userInput, duration' });
  }

  if (!['5', '10', '15', '20'].includes(duration)) {
    return res.status(400).json({ error: 'Duración no válida. Debe ser 5, 10, 15 o 20 minutos.' });
  }

  // Guests y plan free: solo meditaciones de 5 minutos
  if ((isGuest || limitCheck.plan === 'free') && duration !== '5') {
    return res.status(403).json({ error: 'Solo se permiten meditaciones de 5 minutos sin cuenta.' });
  }

  // Essential: máximo 15 minutos
  if (limitCheck.plan === 'essential' && duration === '20') {
    return res.status(403).json({ error: 'Tu plan Essential permite meditaciones de hasta 15 minutos.' });
  }

  // Log guest en Supabase (fail silently — la tabla puede no existir aún)
  if (isGuest) {
    try {
      const { getSupabase } = require('./_supabase');
      const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
      await getSupabase().from('guest_usage').insert({ ip, timestamp: new Date().toISOString() });
    } catch (_) { /* silencioso */ }
  }

  if (userInput.length > 500) {
    return res.status(400).json({ error: 'El texto no puede superar los 500 caracteres.' });
  }

  // Moderación de contenido — bloquear solicitudes inapropiadas
  const BLOCKED_PATTERNS = [
    /\bporno?\b/i, /\bsex(o|ual|ting)?\b/i, /\berotic[ao]?\b/i, /\bnud[eo]\b/i,
    /\bdroga[s]?\b/i, /\bcocaína\b/i, /\bheroína\b/i, /\bmetanfetamina\b/i,
    /\bcannabis\b/i, /\bmarijuana\b/i, /\blsd\b/i, /\becstasy\b/i,
    /\babuso\b/i, /\bviolaci[oó]n\b/i, /\bviolar\b/i, /\bpedofil\b/i,
    /\bsuicidi[oa]\b/i, /\bmatarme\b/i, /\bautolesi[oó]n\b/i,
    /\bterrorism[oa]\b/i, /\bbomba\b/i, /\barma[s]?\b/i,
    /\bporn\b/i, /\bsex\b/i, /\bnude\b/i, /\bdrug[s]?\b/i,
    /\bcocaine\b/i, /\bheroin\b/i, /\bsuicid\b/i, /\braped?\b/i, /\babuse\b/i
  ];
  if (BLOCKED_PATTERNS.some(p => p.test(userInput))) {
    return res.status(422).json({ error: 'Este contenido no está permitido. Por favor describe cómo te sientes o qué quieres trabajar en tu meditación.' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada' });
  }

  // Resolver voz automática aleatoriamente
  const resolvedVoice = voice === 'auto'
    ? (Math.random() < 0.5 ? 'feminine' : 'masculine')
    : (voice === 'masculine' ? 'masculine' : 'feminine');

  const voiceKey = resolvedVoice;
  const targetWords = (WORD_COUNTS[voiceKey] || WORD_COUNTS.feminine)[duration] || 1100;
  const voiceContext = voiceKey === 'masculine'
    ? 'La voz que leerá esto es masculina. Usa un tono firme, sereno y con autoridad tranquila.'
    : 'La voz que leerá esto es femenina. Usa un tono cálido, suave y envolvente.';
  const genderContext = gender === 'masculino'
    ? 'Dirígete al usuario en masculino: adjetivos y participios en masculino (ej: "estás tranquilo", "eres capaz", "te sientes libre").'
    : gender === 'neutro'
    ? 'Dirígete al usuario en género neutro: evita completamente adjetivos o participios que requieran concordancia de género (ej: "tranquilo/a", "relajado/a"). Usa construcciones que no requieran género: sustantivos ("sientes calma", "hay paz en ti"), verbos sin adjetivos ("todo se asienta", "el cuerpo se libera"), o construcciones universales. Nunca uses "/a", "x" ni "e" en el texto — el texto debe sonar natural en voz alta.'
    : 'Dirígete al usuario en femenino: adjetivos y participios en femenino (ej: "estás tranquila", "eres capaz", "te sientes libre").';

  const userPrompt = `El usuario comparte lo siguiente sobre su momento actual:

"${userInput}"

Elementos clave a incorporar durante toda la meditación: ${userInput.slice(0, 120)}${userInput.length > 120 ? '...' : ''}

Contexto de la sesión:
- Duración: ${duration} minutos
- Longitud MÁXIMA ESTRICTA: ${targetWords} palabras. No superar este límite bajo ninguna circunstancia, independientemente de la longitud o complejidad de la descripción del usuario. La descripción del usuario es contexto, no define la cantidad de palabras.
- Voz: ${voiceContext}
- Género gramatical: ${genderContext}${userName ? `\n- Nombre del usuario: ${userName}. Intégralo de forma natural en la intro o durante la meditación si encaja orgánicamente. NUNCA como primera palabra de la meditación. Nunca de forma forzada o repetitiva.` : ''}
${getDurationBlock(duration)}

Devuelve únicamente un objeto JSON válido con este formato exacto (sin texto adicional antes ni después):
{"title": "título de 3-5 palabras en español", "text": "texto completo de la meditación aquí"}

El campo "title" debe capturar en pocas palabras la esencia de esta sesión (ej: "Para soltar el día", "Antes de dormir", "Calmar la tormenta interior").
El campo "text" debe contener solo el texto de la meditación, sin títulos ni explicaciones.`;

  try {
    // Timeout: maxDuration de la función es 60s, cortamos el fetch a 55s para
    // que Vercel no cierre la conexión mid-stream y se pierda la respuesta.
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: AbortSignal.timeout(55000),
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 4000,
        // Prompt caching: el system prompt (~3500 tokens) es idéntico entre llamadas.
        // Claude lo cachea 5 min → ~50% menos coste de input tokens tras primer hit.
        system: [
          { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }
        ],
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

    // 1) Recortar palabras si Claude se excedió
    const spokenWords = text.replace(/\[silencio:\d+s\]/gi, '').trim().split(/\s+/).filter(Boolean).length;
    console.log(`[meditation] Palabras generadas: ${spokenWords} / límite: ${targetWords}`);
    if (spokenWords > targetWords * 1.15) {
      console.warn(`[meditation] Exceso de ${spokenWords - targetWords} palabras — recortando`);
      text = enforceWordLimit(text, targetWords);
    }

    // 2) Capear silencios: primero por marcador individual, luego el total acumulado
    const maxPerMarker  = (MAX_SILENCE_PER_MARKER[voiceKey] || MAX_SILENCE_PER_MARKER.feminine)[duration] || 30;
    const maxTotalSil   = (MAX_TOTAL_SILENCE[voiceKey]      || MAX_TOTAL_SILENCE.feminine)[duration]      || 460;
    let   totalSilence  = 0;
    text = text.replace(/\[silencio:(\d+)s\]/gi, (_match, val) => {
      const raw    = parseInt(val, 10);
      const capped = Math.min(raw, maxPerMarker);           // cap por marcador
      const grant  = Math.min(capped, Math.max(0, maxTotalSil - totalSilence)); // cap total
      totalSilence += grant;
      return grant > 0 ? `[silencio:${grant}s]` : '';
    });
    console.log(`[meditation] Silencio total: ${totalSilence}s / límite: ${maxTotalSil}s`);

    return res.status(200).json({ title, text, targetWords, silenceTotal: totalSilence, resolvedVoice });

  } catch (err) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      console.error('[meditation] Timeout llamando a Claude API');
      return res.status(504).json({ error: 'La generación tardó demasiado. Inténtalo de nuevo.' });
    }
    console.error('Error interno en /api/meditation:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
