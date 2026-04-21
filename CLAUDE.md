# Proyecto: Silencio

## Qué es
App de meditación personalizada con IA. El usuario describe su situación y objetivos, y la app genera una meditación de audio única, personalizada al 100% para ese momento exacto. No hay meditaciones genéricas — cada sesión es diferente.

## El diferenciador clave
La personalización real. Calm y Headspace tienen contenido grabado y fijo. Silencio genera cada meditación en tiempo real según el contexto del usuario: cómo se siente, qué quiere lograr, qué sonidos prefiere, cuánto tiempo tiene.

## Usuario ideal
Persona de 25-45 años que alguna vez meditó con Calm o Headspace pero lo dejó porque se sentía genérico. Quiere volver a meditar pero busca algo que realmente se adapte a su momento. Dispuesto a pagar si confía en el producto y siente que funciona.

## Experiencia del usuario
1. Usuario describe cómo se siente (texto libre) O responde preguntas guiadas
2. Elige duración: 5, 10 o 15 minutos
3. Elige voz (femenina o masculina) y sonido de fondo (lluvia, mar, pájaros, etc.)
4. La app genera la meditación personalizada en audio via ElevenLabs
5. Pantalla minimalista mientras escucha — lo principal es el audio

## Estructura de la meditación generada
Siempre debe seguir un arco: relajación física → respiración → trabajo específico según objetivo del usuario (dormir, calmarse, decidir, meditar, etc.) → cierre. La IA debe conocer técnicas reales de meditación y aplicarlas según el contexto.

## Diseño visual
- Estilo: suave y premium, que invite al silencio y genere confianza
- Referentes directos: Calm, Insight Timer, Headspace — estudiar sus decisiones de UX/UI
- Mientras suena el audio: solo una animación muy suave, nada que distraiga
- El diseño actual es el punto de partida; está en evolución continua basada en research de competidores

## Stack tecnológico
- Frontend: HTML, CSS, JavaScript puro
- IA para generar el texto de la meditación: Claude API (claude-sonnet-4-5)
- IA para el audio: ElevenLabs API
- Idioma: español primero, inglés después

## Modelo de negocio (por validar con Perplexity)
- 1 meditación gratis para probar
- Planes por volumen de meditaciones (niveles y precios por definir)
- Pendiente: analizar si suscripción mensual flat convierte mejor que por volumen

## Estándar de calidad
Si la meditación generada no es notablemente mejor que algo genérico de Calm, no está lista. El objetivo es que el usuario sienta que fue creada específicamente para él.

## Mantenimiento de código
Al final de cualquier sesión donde se haya eliminado o refactorizado UI (pantallas, secciones, componentes), revisar si quedaron clases CSS huérfanas en style.css o funciones JS sin llamadas en app.js. Solo borrar si está 100% confirmado que no se usan en ningún archivo HTML, JS ni se generan dinámicamente.

## Instrucción de rol (LEER SIEMPRE)
Al inicio de cada sesión preguntar: "¿En qué modo trabajamos hoy?" con la lista de roles disponibles en MEMORY.md. Cargar el archivo del rol antes de responder. Andrés puede activar varios roles a la vez.
