# Runbook operativo — Stillova

**Para:** Andrés (founder no técnico)
**Cuándo se usa:** todos los días post-launch + cualquier crisis
**Cuándo se actualiza:** después de cada incidente o milestone alcanzado

---

## 0 · Cómo usar este documento

Este es tu manual. No tienes que leerlo entero ahora. Cuando llegue el momento, abres por sección:

- **Día normal** → § 1 (5 cosas que mirar cada día)
- **Te alarmas** por algo → § 2 (plan de crisis)
- **Llegan más usuarios** → § 3 (milestones por volumen)
- **Necesitas contratar** → § 4
- **Un usuario te escribe** → § 5 (plantillas)
- **Quieres entender la app** → § 6 (mapa rápido)

---

## 1 · Las 5 cosas que miras cada día (5-10 min)

### 1.1 PostHog — funnel y conversión
**Dónde:** [eu.i.posthog.com](https://eu.i.posthog.com) → Insights → Funnels
**Qué ver:**
- Funnel: `home_guest_viewed` → `home_guest_cta_clicked` → `meditation_completed` → `paywall_cta_clicked` → `precheckout_confirmed`
- Cuántos usuarios entraron las últimas 24h
- Tasa de conversión paso a paso

**Cuándo te alarmas:**
- Caída brusca día/día (>30%) en cualquier paso
- Si nadie llega al paso "meditation_completed" → algo está roto en generación

### 1.2 Stripe — MRR + cancelaciones
**Dónde:** [dashboard.stripe.com](https://dashboard.stripe.com) → Home
**Qué ver:**
- MRR (Monthly Recurring Revenue)
- Suscripciones nuevas hoy
- Cancelaciones hoy
- ¿Algún chargeback abierto? (sección Disputes)

**Cuándo te alarmas:**
- Disputes > 0 (responde en 24h máximo)
- Cancelaciones > 5% del total en una semana → ver § 2.5

### 1.3 ElevenLabs — créditos restantes
**Dónde:** [elevenlabs.io](https://elevenlabs.io) → Subscription
**Qué ver:**
- Créditos usados / créditos totales del mes
- Días restantes hasta reset

**Cuándo te alarmas:**
- < 20% restante → programa upgrade (ver § 3 milestones)
- < 5% restante → upgrade YA o vas a tener fail-soft activo

### 1.4 Vercel — errores 5xx últimas 24h
**Dónde:** [vercel.com](https://vercel.com) → proyecto `silencio` → Logs
**Filtra por:** Status 5xx, last 24h
**Qué ver:**
- Cantidad de errores
- Patrones repetidos (mismo endpoint cayendo)

**Cuándo te alarmas:**
- > 5 errores/hora repetidos → ping me en Claude Code
- Caída total (todos los endpoints) → § 2.1

### 1.5 Buzón Stillova
**Dónde:** dentro de la app → tu perfil → Buzón. Te llegan a tu email.
**Qué hacer:**
- Lee TODOS los mensajes
- Responde personal (los founders que responden personal convierten más)
- Categoriza: bug / sugerencia / queja → guarda en una hoja de cálculo

---

## 2 · Plan de crisis (qué hacer si X se rompe)

### 2.1 La app entera no carga / errores masivos 500

**Síntomas:** usuarios reportan "no funciona", muchos 5xx en Vercel logs.

**Pasos:**
1. Abre [vercel.com → silencio → Logs](https://vercel.com)
2. Filtra última hora, status 500-599
3. Busca el error repetido más común. Screenshot.
4. Ping me en Claude Code con el screenshot
5. Mientras tanto, comunica a usuarios:
   - Tweet/IG story rápido: "Stillova está saturado, vuelvo en 30 min"
   - O activa modo mantenimiento (te explico cómo cuando llegue el momento)

**No hagas:** redeploy random. Empeora si no sabes qué cambias.

### 2.2 ElevenLabs sin créditos

**Síntomas:** usuarios reciben "Estamos a tope ahora mismo, vuelve en una hora" (mensaje del fail-soft que ya tenemos).

**Pasos:**
1. Abre [elevenlabs.io → Subscription](https://elevenlabs.io)
2. Topup inmediato (compra créditos extra) **o** sube tier (Pro $99 → Scale $330)
3. Funciona en 5 min sin redeploy
4. Avísame para que ajustemos el tier permanente

**No hagas:** rotar la API key sin avisarme. Romperías producción.

### 2.3 Usuario pide reembolso

**Tu política:** **NO reembolsamos. SÍ cancelamos suscripción inmediatamente.**

**Plantilla de respuesta:** ver § 5.1

**Si insiste y amenaza con disputa al banco:**
1. Mándale screenshot del modal pre-Stripe ("Pagar €X" botón)
2. Recuérdale los T&C que aceptó
3. Si abre chargeback en Stripe, tienes 24h para responder con: screenshot del consentimiento + términos + uso real (logs PostHog del usuario)

### 2.4 Stripe te suspende la cuenta

**Síntomas:** email de Stripe diciendo "tu cuenta ha sido suspendida pendiente de revisión".

**Pasos:**
1. **No entres en pánico.** Suele ser verificación de identidad o documentación.
2. Lee el email completo, identifica qué piden.
3. Responde en stripe-support con los docs solicitados.
4. **Pausa marketing inmediatamente** — sin Stripe no puedes cobrar.
5. Avísame si pasan 48h sin respuesta.

**Causas comunes:**
- Volume de pagos sube de golpe sin historial previo (típico tras viral)
- Chargeback rate > 1%
- Mismatch entre lo que vendes y la descripción Stripe

### 2.5 Cancelaciones masivas (churn alto)

**Síntomas:** > 5% de tus paid users cancelan en una semana.

**Pasos:**
1. Lee las razones en Stripe (si activaste cancellation reasons) o en buzón
2. Identifica el patrón:
   - "No funciona" → bug en producto
   - "Demasiado caro" → pricing review
   - "No la uso" → onboarding/retention
3. Avísame con el patrón. No hagas cambios random.

### 2.6 Vercel te pide upgrade a Pro

**Síntomas:** email de Vercel "you're approaching the Hobby limit" o build failed por function count.

**Pasos:**
1. Si es por functions (>12), avísame: o consolidamos endpoints o subimos a Pro $20.
2. Si es por bandwidth (>100GB/mes), sube a Pro $20 directo.
3. No tarde: si pasas el límite, Vercel deja de servir tu app.

### 2.7 Te demandan / amenazan con demanda por consejo de salud mental

**Síntomas:** email/carta amenazando con acciones legales.

**Pasos:**
1. **No respondas tú directo.**
2. Tienes 3 capas de protección activas:
   - Disclaimer "no sustituye terapia" en footer + welcome + paywall
   - T&C explícitos: "Stillova es herramienta de bienestar, no producto médico"
   - Política privacy aceptada al pagar
3. Contacta abogado especializado en tech/wellness (en España: NicoLuengo, GyR Abogados; en Chile: Carey, Cariola).
4. Mándame el caso para que recopile evidencia (logs, T&C aceptados).

### 2.8 Cuenta Stripe chilena con problemas de payouts

**Si ocurre:** payouts pendientes que no llegan a tu banco.

**Pasos:**
1. Stripe Dashboard → Settings → Payouts → revisar estado
2. Si dice "additional information required", completa lo que pidan
3. Para Chile: posible necesites W-8BEN form o equivalente
4. Si bloqueado >7 días, abre ticket con stripe-support

---

## 3 · Milestones por volumen (qué hacer a cada nivel)

| Usuarios | Mediciones/mes aprox. | Acción crítica | Coste mensual app |
|---|---|---|---|
| **0-50** | 0-100 | Nada cambia. ElevenLabs Creator $22 OK. | ~$25 |
| **50-200** | 100-400 | **SUBIR** ElevenLabs a Pro $99 (~330 medds/mes). | ~$110 |
| **200-500** | 400-1000 | **SUBIR** Vercel a Pro $20 si pasas 12 functions o bandwidth Hobby. Empieza a probar VA part-time. | ~$140 |
| **500-1000** | 1000-2000 | **SUBIR** ElevenLabs a Scale $330 (1300 medds/mes). **CONTRATA** VA fijo (ver §4). | ~$700-900 |
| **1000-3000** | 2000-6000 | **SUBIR** Supabase Pro $25 + Clerk Pro $25 + Sentry $26. **CONTRATA** dev freelance part-time. | ~$2500-3500 |
| **3000+** | 6000+ | Equipo formal. Consulta conmigo para evaluar. | — |

### Reglas de oro

- **No esperes a que duela.** Si vas en 180 usuarios y subiendo rápido, sube ElevenLabs antes de llegar a 200.
- **No subas antes de tiempo** (no quemar dinero). Si llevas semanas en 30 usuarios, no subas a Pro $99.
- **Trigger reactivo:** si fail-soft de ElevenLabs se activó alguna vez en últimas 24h → SUBE ya.

### Indicadores anticipados que algo se viene

- Pico de tráfico desde una fuente nueva (viral) → revisa créditos ElevenLabs
- MRR > $1000 → empieza a planear contratación
- Churn estable < 5%/mes → puedes invertir en escalar

---

## 4 · Cuándo y cómo contratar

### 4.1 Primera contratación: Virtual Assistant (VA) part-time

**Cuándo:** a partir de 200+ usuarios activos / mes
**Para qué:**
- Responder buzón (con plantillas tuyas)
- Triage de bugs (categorizar para ti)
- Escribir copy de respuestas
- Soporte básico social media si lo abres

**Coste:** $400-800/mes (5-10h/semana)

**Dónde encontrarlos:**
- [OnlineJobs.ph](https://onlinejobs.ph) — filipinos, inglés perfecto, $4-8/h
- [Upwork](https://upwork.com) — global, $6-15/h
- [Workana](https://workana.com) — latam, español nativo, $5-10/h

**Cómo entrevistar (procedimiento corto):**
1. Job post claro: "Customer support for AI meditation app. Spanish + English. 10h/week."
2. Pide 3-5 candidatos: que escriban 1 párrafo respondiendo a "user pidió reembolso, qué le digo" basado en tu política
3. Los que respondan con empatía + claridad pasan a entrevista de 15 min
4. Pruébalos 1 semana con 5h pagadas, ves cómo responden a buzón real

**Onboarding del VA:**
- Le das acceso a buzón (forward email), Notion compartida con plantillas
- NO le das acceso a Stripe, Vercel ni código
- 1 reunión semana de 15 min

### 4.2 Segunda contratación: Developer freelance part-time

**Cuándo:** 1000+ usuarios o ingresos > $2k/mes
**Para qué:**
- Mantenimiento día a día (bugs, features pequeños)
- Estar disponible para crisis técnicas que tú no puedas resolver
- Reducir tu dependencia 100% de mí

**Coste:** $1500-2500/mes (10-15h/semana)

**Stack que debe conocer:**
- JavaScript vanilla (no React)
- Vercel serverless functions (Node.js)
- Stripe webhooks
- Supabase (Postgres)
- Clerk (auth)

**Dónde encontrarlos:**
- [Toptal](https://toptal.com) — caro pero curado, $50-80/h
- [Upwork](https://upwork.com) — variable, $20-50/h
- [LinkedIn](https://linkedin.com) — busca "freelance fullstack JavaScript Spain/LatAm"

**Onboarding del dev:**
- Le das acceso a GitHub (read inicial, write tras prueba), Vercel (developer role), Supabase (read-only inicial)
- NO le das acceso a Stripe production keys (yo o tú las gestionáis)
- 1 reunión semana 30 min + Slack/Discord

### 4.3 Tercera contratación: Growth marketer

**Cuándo:** funnel validado + CAC predecible + LTV/CAC > 3
**Para qué:** escalar campañas que ya funcionan
**Coste:** comisión + base, $1000-3000 base + 10-20% sobre revenue generado
**No antes** — quemas dinero si el funnel no convierte solo.

### 4.4 Lo que NUNCA contrates antes de tiempo

- **Designer fijo:** uses Claude Design o freelance puntual cuando haya data
- **Community manager:** redes sociales puede llevarlas el VA al principio
- **CFO/contable fijo:** servicio mensual de gestoría es suficiente hasta $50k MRR

---

## 5 · Plantillas de respuesta a usuarios

### 5.1 "Quiero un reembolso"

```
Hola [nombre],

Lamento mucho que Stillova no te haya funcionado.
Te he cancelado la suscripción ahora mismo — no se renovará.

Como dice nuestra política, los pagos ya realizados no se
reembolsan, pero mantienes acceso completo hasta el final
del periodo que ya pagaste ([fecha]).

Si te apetece contarme qué no funcionó, me ayudaría
muchísimo. Stillova somos pocos y todo el feedback me
llega directo.

Un abrazo,
Andrés
```

### 5.2 "La generación falló / no funciona"

```
Hola [nombre],

Sentimos mucho el problema. Stillova depende de varios
servicios externos y a veces uno se satura.

¿Podrías intentarlo de nuevo en una hora? Si sigue fallando,
escríbeme aquí mismo con qué pone exactamente la pantalla
(o un screenshot) y lo investigo personalmente.

Como compensación por el inconveniente, te dejo una sesión
extra esta semana — la activo desde mi lado.

Un abrazo,
Andrés
```

### 5.3 "¿Por qué cuesta €X?"

```
Hola [nombre],

Buena pregunta. Stillova genera cada meditación en tiempo
real desde tu frase — eso significa que cada sesión paga
costes reales de IA + síntesis de voz por minuto generado.

A diferencia de Calm o Headspace que reproducen contenido
pre-grabado infinitas veces, cada Stillova es única, y eso
tiene un coste que tenemos que cubrir.

Si €9,99/mes es demasiado, prueba la primera sesión gratis
sin tarjeta — así puedes valorar tú mismo si el valor que
te aporta justifica el precio.

Un abrazo,
Andrés
```

### 5.4 "La voz no me convence / suena rara"

```
Hola [nombre],

Gracias por decírmelo. Trabajamos con ElevenLabs, una de
las mejores síntesis del mercado, pero hay matices que aún
no captan perfecto.

Si me dices qué voz te tocó (femenina/masculina) y qué te
chocó (entonación, ritmo, palabras concretas), lo paso al
equipo técnico y veo si podemos afinarlo en próximas
versiones.

Un abrazo,
Andrés
```

### 5.5 "Me arrepiento, cancela todo"

```
Hola [nombre],

Cancelado. No se renovará nada.

Mantienes acceso completo hasta [fecha] por si quieres
darle una última oportunidad sin compromiso.

Si en algún momento quieres volver, aquí estaremos.

Un abrazo,
Andrés
```

### 5.6 "¿Es seguro este pago / mis datos?"

```
Hola [nombre],

Sí, todo el procesamiento de pagos pasa por Stripe, que
es la misma infraestructura que usan Apple, Amazon o Lyft.
Stillova nunca toca tu tarjeta directamente.

Tus datos personales: solo guardamos email + lo que
escribes para generar tu meditación. Nada se vende ni
se comparte. Lo dice la política de privacidad y la
respeto a rajatabla.

Cualquier duda, aquí estoy.

Un abrazo,
Andrés
```

### Reglas para responder

- **Personal, no corporativo.** Firma "Andrés" no "Stillova Team".
- **Honesto.** Si algo está roto, dilo.
- **Rápido.** < 24h. Mejor < 4h.
- **Empático.** Lee el mensaje 2 veces antes de responder.
- **No prometas lo que no entregas.** Si dices "lo arreglo en una semana", arréglalo en una semana.

---

## 6 · Mapa rápido del sistema (para que entiendas qué hace cada cosa)

```
USUARIO
   ↓
[stillova.com] ← Vercel (hosting)
   ↓
[index.html + js/* + css/*] ← código de la app (frontend)
   ↓
   ├─→ Clerk: cuando se registra/loggea
   ├─→ /api/meditation → Anthropic (Claude): genera el TEXTO
   ├─→ /api/audio → ElevenLabs: convierte texto en VOZ
   ├─→ /api/checkout → Stripe: procesa el pago
   ├─→ /api/webhook ← Stripe: confirma el pago y activa el plan
   ├─→ /api/save-meditation → Supabase: guarda en biblioteca
   ├─→ /api/buzon → Supabase: feedback del usuario
   └─→ PostHog: tracking de eventos (analítica)
```

**Servicios externos que pagas (o pagarás):**
| Servicio | Para qué | Costa actual | Donde es |
|---|---|---|---|
| Vercel | Aloja la app | $0 (Hobby) | vercel.com |
| Anthropic (Claude API) | Genera texto meditación | $1-3/mes ahora | console.anthropic.com |
| ElevenLabs | Genera audio | $22/mes (Creator) | elevenlabs.io |
| Stripe | Procesa pagos | sin pagos aún | dashboard.stripe.com |
| Clerk | Autenticación | $0 (Free hasta 10k) | dashboard.clerk.com |
| Supabase | Base de datos | $0 (Free) | supabase.com/dashboard |
| Upstash | Rate limiting | $0 (Free) | console.upstash.com |
| PostHog | Analítica | $0 (Free hasta 1M) | eu.i.posthog.com |
| Namecheap | Dominio | $1/mes (anual) | namecheap.com |

**Total actual: ~$25/mes**

---

## 7 · Cosas que SOLO yo (Claude Code) puedo hacer

Para que sepas cuándo necesitas pedirme ayuda específicamente:

- Cambiar código (cualquier cosa en `js/`, `css/`, `api/`, `index.html`)
- Cambiar el prompt de generación de meditaciones (`api/meditation.js`)
- Crear nuevos endpoints API
- Cambios de schema en Supabase
- Configurar nuevas integraciones
- Auditorías de seguridad / código

**Tú puedes hacer (sin mí):**
- Subir/bajar tier en cualquier servicio
- Responder a usuarios en buzón
- Ver dashboards y logs
- Cancelar/reactivar suscripciones de usuarios en Stripe (botón directo)
- Aprobar/rechazar disputas en Stripe
- Cambiar precios en Stripe (cuidado: cambia el price_id, hay que avisarme)

---

## 8 · Cómo actualizar este runbook

Cada vez que pase algo nuevo (incidente, milestone, contratación), abre este archivo y añade lo aprendido. Si necesitas mi ayuda para actualizarlo, pídemela.

**Última actualización:** 2026-04-26 (creación inicial pre-marketing).
