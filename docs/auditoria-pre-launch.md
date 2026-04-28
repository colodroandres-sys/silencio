# Auditoría pre-launch — Stillova

> Sesión 28-abril 2026. Análisis completo del funnel con mirada de Growth/CRO/Producto.
> Hecho por Claude antes de campaña marketing relámpago. **No hay datos reales todavía** — análisis basado en heurísticas y mejores prácticas de SaaS B2C wellness (Calm, Headspace, Insight Timer).

---

## Resumen ejecutivo

**Estado**: la app está técnicamente sólida y visualmente premium. El funnel completo funciona. Hay **6 issues P0 (bloqueantes pre-campaña)** que afectan conversión visible. El más urgente ya está arreglado en producción (banner PWA fuera de pantallas inmersivas).

**Recomendación CEO**: arreglar los 5 P0 restantes antes de lanzar el primer $1 de ads. Inversión total ~3-5h de mi tiempo. Cada uno mueve la aguja en conversión free→paid del 2% al posiblemente 6-10%.

**Lo que NO toco**: estética visual general (premium, cumple estándar Calm/Headspace), arquitectura técnica (sólida), tracking básico (33 eventos PostHog, cubre funnel principal).

---

## Issues P0 — bloqueantes pre-campaña

### P0-1 ✅ ARREGLADO — Banner PWA aparece en todas las pantallas
**Antes**: el banner "Añade Stillova a tu inicio" se quedaba visible en loading + player, robando atención durante la experiencia inmersiva.
**Fix aplicado** (commit `a52d1ce`): `showScreen()` oculta el banner cuando el id no es `screen-home`.

### P0-2 — Paywall headline débil, no vende
**Estado**: la headline actual es *"Elige el tuyo."* — no comunica valor, no diferencia, no urgencia.
**Impacto**: usuarios paganos abandonan paywall sin entender por qué pagar.
**Fix concreto**: cambiar a algo que conecte con el momento del user:
- *"La meditación que hoy escuchaste, cada día."* (refuerza experiencia recién vivida)
- *"Sigue creando meditaciones para tu momento exacto."* (explica el modelo)
- *"Acceso ilimitado a tus meditaciones únicas."* (claridad)
**Esfuerzo**: 5 min de copy + 5 min implementar. **A/B testeable post-launch.**

### P0-3 — Paywall lista features fea, parece código
**Estado**: las features dicen *"voz H/M · neutro o género"* — esto es jerga interna que confunde y baja conversión.
**Impacto**: el user ve un beneficio escrito como spec técnica → no convierte.
**Fix concreto** — redactar features con lenguaje emocional:
- ❌ *"voz H/M · neutro o género"* → ✅ *"Voz femenina o masculina, a tu gusto"*
- ❌ *"hasta 15 minutos"* → ✅ *"Sesiones de hasta 15 minutos cuando lo necesites"*
- ❌ *"10 sesiones al mes"* → ✅ *"10 meditaciones al mes — una nueva cada día laboral"*
**Esfuerzo**: 30 min de copy + implementar.

### P0-4 — Falta value prop comparativa vs Calm/Headspace
**Estado**: el paywall no menciona el diferenciador clave (*personalización en tiempo real*) que justifica el precio.
**Impacto**: el user mentalmente compara con Calm ($69.99/año) y ve Premium $191.88 → siente que es caro.
**Fix concreto**: añadir un bloque arriba del paywall (o eyebrow del paywall) tipo:
> *"En Calm escuchas lo mismo que millones. En Stillova, cada meditación se genera para ti, en este momento."*

O un comparativo simple:
| | Stillova | Calm/Headspace |
|---|---|---|
| Personalización | Cada sesión única | Catálogo fijo |
| Voz | Adaptada a ti | Pregrabada |
| Tu momento | Ahora mismo | Genérica |

**Esfuerzo**: 1h (copy + diseño + implementar).

### P0-5 — Falta micro-copy de tranquilidad en paywall
**Estado**: no hay garantías visibles. El user duda al ver $191.88.
**Impacto**: abandono en momento de pago por miedo a compromiso.
**Fix concreto**: añadir línea bajo CTA del paywall con micro-copy:
- *"Cancela cuando quieras desde tu perfil — sin preguntas."*
- *"Sin tarjeta para la primera meditación gratis."* (recordar)
- *"Procesado por Lemon Squeezy — pago 100% seguro."*
**Esfuerzo**: 15 min.

### P0-6 — Onboarding ob-step2 (3-stat block) raro
**Estado**: pantalla *"Una, gratis. Sin tarjeta."* con stats *"5 minutos / 1 voz neutra / 0 tarjetas"*. El *"1 voz neutra · no eliges quién te habla"* es decepcionante (le quita poder al user antes de ganar su confianza).
**Impacto**: primera impresión negativa = aumenta drop antes incluso de probar.
**Fix concreto**: reemplazar la stat de "voz" por algo positivo:
- *"5 minutos / Tu momento / 0 tarjetas"*
- Y el subtítulo de "voz neutra": cambiar *"no eliges quién te habla"* → *"se adapta a ti"* o quitar la stat completamente.
**Esfuerzo**: 10 min.

---

## Issues P1 — importantes, no bloqueantes

### P1-1 — Loading screen no comunica que tarda 30-60s
**Estado**: la pantalla de loading muestra "Escuchándote · Leyendo lo que sientes en este momento exacto" — bonito, pero el user no sabe cuánto tarda.
**Impacto**: en mobile con conexiones lentas, el user puede pensar que está roto y cerrar la app.
**Fix concreto**: añadir un indicador sutil tipo *"componiendo tu meditación · ~45 segundos"*. Y un trust signal como *"Cada palabra elegida solo para ti"*.
**Esfuerzo**: 30 min.

### P1-2 — Falta tracking de paywall plan card click
**Estado**: tienes `paywall_shown` y `checkout_started` pero no el click intermedio en cada card.
**Impacto**: no puedes A/B testear qué card convierte mejor (¿anchor effect del Premium recomendado funciona?).
**Fix concreto**: añadir `track('paywall_plan_clicked', { plan, billing })` cuando user pulsa una card del paywall.
**Esfuerzo**: 10 min.

### P1-3 — No hay landing page específica para tráfico pagado
**Estado**: la "home" actual es onboarding general que asume que el user llegó orgánico curioso.
**Impacto**: tráfico pagado de TikTok/Meta llega con expectativas diferentes — esperan ver "lo que prometía el ad" inmediatamente. Onboarding de 4 pasos puede ser fricción excesiva post-click.
**Fix concreto**: una landing alternativa `/start` o `/meditacion` que:
- Hero directo con la promesa del ad
- CTA "Componer mi primera meditación" → directo a create
- Sin paywall hasta después de la primera medd
- Trust signals visibles (sin tarjeta, completar en 5 min, etc.)

**Decisión pendiente**: requiere alineación con la profesora de marketing que va a definir el ad creative.
**Esfuerzo**: 3-4h cuando esté el creative del ad listo.

### P1-4 — Falta `paywall_plan_card_viewed` (qué cards el user llegó a ver)
**Estado**: si el user no scrollea a Studio (la 3ra card), no sabes si la vio.
**Impacto**: imposible diagnosticar "¿la gente ve Studio antes de elegir Premium?".
**Fix concreto**: añadir IntersectionObserver en cada card → `track('paywall_card_viewed', { plan })`.
**Esfuerzo**: 30 min.

### P1-5 — End-guest screen post-meditación
**Estado**: tras completar la primera meditación gratis, el end-guest muestra CTAs hidratados desde `pricing.js` con plan recomendado. No vi este screen claramente en el audit (mi script no lo rendea bien).
**Impacto**: este es el momento DE ORO de conversión — el user acaba de tener una experiencia positiva. Si el copy no clava la conversión, pierdes.
**Verificación necesaria**: revisar el copy actual del `renderPostSession('guest')` y validar que comunica:
1. *Lo que acaba de sentir*
2. *Que esto fue solo una muestra*
3. *Cómo seguir teniéndolo todos los días*
**Esfuerzo**: 1h leer + ajustar copy (post-review).

---

## Issues P2 — nice-to-have

### P2-1 — Trust signals en home guest
Falta "social proof" en home: número de meditaciones generadas, testimonios, prensa, valoraciones. Reduce primera fricción de "¿esto funcionará?".
**Esfuerzo**: 1h cuando haya datos reales (post-piloto).

### P2-2 — iOS install modal con screenshots reales
Los pasos textuales son OK, pero pasos con screenshots reales del iPhone aumentan conversión de instalación 2-3x.
**Esfuerzo**: 1h (capturar screenshots iPhone + integrar).

### P2-3 — Onboarding skip option
Para users que vuelven (return visitors), no debería re-mostrarles onboarding.
**Verificación**: revisar lógica actual de `stillova_onboarding_done`.
**Esfuerzo**: 30 min.

### P2-4 — Loading screen audio sutil
Una nota de ambient muy sutil durante la espera reduce ansiedad y pre-suaviza al user para la meditación.
**Esfuerzo**: 1h. Debate: puede ser intrusivo.

### P2-5 — Falta evento `signup_completed`
Útil para separar "creó cuenta" de "pagó" en PostHog funnel.
**Esfuerzo**: 15 min.

---

## Lo que está BIEN (no tocar)

✓ **Estética**: premium, cumple estándar Calm/Headspace. Tipografía (Fraunces + Inter), paleta crema/marrón, espaciados.
✓ **Onboarding pantalla 1**: *"Una meditación hecha para este momento exacto. Nada pregrabado. Nada genérico."* — copy poderoso.
✓ **Home guest copy** (post-fix de hoy): *"Hola. ¿Cómo estás? De verdad."* + micro-copy de especificidad. Conecta emocional.
✓ **Create screen**: claro, accesible, micro-copy emocional, warning preventivo de "X min sin interrupciones".
✓ **Player minimalista**: solo título + ring + tiempo. Cero distracciones.
✓ **Pre-checkout modal**: claro, transparente, disclaimer de no-renovación-automática reduce ansiedad.
✓ **Admin cockpit**: tiene los KPIs críticos (MRR, paying, conversión, activación, active 7d/30d, meds today/week).
✓ **Tracking**: 33 eventos PostHog cubren el funnel principal.
✓ **Recuperación pending 24h**: ya implementado para guests.
✓ **PWA install**: ya implementado con banner contextual.
✓ **Monitor automático**: ya implementado con alertas Telegram.

---

## Plan de acción priorizado

### Antes de lanzar campaña ($5K) — TODOS LOS P0 CERRADOS ✅
1. ~~P0-1: Banner PWA solo en home~~ ✅ HECHO (commit `a52d1ce`)
2. ~~P0-2: Paywall headline~~ ✅ HECHO (commit `71437ee`)
3. ~~P0-3: Paywall lista features con copy emocional~~ ✅ HECHO (commit `71437ee`) + bug oculto Studio "20→30 min" arreglado
4. ~~P0-4: Value prop comparativa SIN nombrar competidores~~ ✅ HECHO (rol legal aplicado)
5. ~~P0-5: Micro-copy tranquilidad en paywall~~ ✅ HECHO
6. ~~P0-6: Onboarding ob-step2 reescrito~~ ✅ HECHO (5/0/0 — minutos/palabras pregrabadas/tarjetas)

**Bonus aplicado en esta tanda** (cambio de producto autorizado por Andrés):
- Voz y género ABIERTOS en plan free para maximizar efecto wow primera meditación.
- Lock duración (5min), créditos (1) y biblioteca siguen activos.

### Cuando esté el creative del ad (con la profesora)
- P1-3: Landing alternativa `/start` (3-4h)
- P1-1: Loading screen tiempo estimado (30 min)
- P1-2: Tracking paywall plan click (10 min)
- P1-4: Tracking paywall card viewed (30 min)
- P1-5: Verificar y ajustar end-guest copy (1h)

**Total bloque P1**: ~5-6h.

### Post-piloto (cuando haya datos reales)
- P2-1: Trust signals con números reales
- P2-2: iOS modal con screenshots
- P2-3: Onboarding skip lógico
- P2-4: Loading audio sutil (debate)
- P2-5: Tracking signup_completed

**Total bloque P2**: 3-4h, no urgente.

---

## Lo que TÚ (founder) tienes que hacer

Independientemente de la auditoría:

1. **Perseguir LS** — verificación de identidad. Sin esto nada de lo de arriba importa.
2. **Regenerar token Telegram** — higiene básica, te di pasos antes.
3. **Contactar a la profesora del master** — definir creative + landing del ad.
4. **Cuando LS apruebe** — autorizar el plan híbrido $1.5K piloto + $3.5K escalado.

---

## Mi recomendación final

**Espera a LS, contacta a la profesora, y cuando vuelvas me das luz verde para arreglar los P0-2 a P0-6**. Son 3h de mi trabajo. Si los hacemos antes del primer $1 de ad, tu campaña tendrá un funnel notablemente mejor calibrado para conversión.

No toques los P1/P2 todavía — su valor real se ve solo con datos del piloto.

---

*Auditoría generada por Claude Opus 4.7 · 28-abril 2026*
*Screenshots base: `/tmp/audit-mobile-*.png`*
