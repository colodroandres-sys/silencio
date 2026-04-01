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
- Colores: oscuro con azul noche y púrpura suave
- Estilo: minimalista, premium, que invite al silencio
- Referente: Calm pero más personal y menos corporativo
- Mientras suena el audio: solo una animación muy suave, nada que distraiga

## Stack tecnológico
- Frontend: HTML, CSS, JavaScript puro
- IA para generar el texto de la meditación: Claude API (claude-sonnet-4-20250514)
- IA para el audio: ElevenLabs API
- Idioma: español primero, inglés después

## Modelo de negocio (por validar con Perplexity)
- 1 meditación gratis para probar
- Planes por volumen de meditaciones (niveles y precios por definir)
- Pendiente: analizar si suscripción mensual flat convierte mejor que por volumen

## Estándar de calidad
Si la meditación generada no es notablemente mejor que algo genérico de Calm, no está lista. El objetivo es que el usuario sienta que fue creada específicamente para él.
