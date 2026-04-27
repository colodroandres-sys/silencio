# Manual de uso diario — Stillova

> Este es el ÚNICO documento que abres cuando lances la app.
> Te dice exactamente qué hacer, qué links abrir, qué números mirar, y cuándo escribirme.
> Los otros 3 docs (`playbook-escala.md`, `manual-operativo-ceo.md`, `automation-claude-max.md`) son referencia — los abres SOLO cuando este documento te diga.

---

## Lo que tienes hoy y para qué sirve cada cosa

| Herramienta | Para qué sirve | Cuándo lo usas |
|---|---|---|
| **Tu panel admin** (stillova.com/admin.html) | Ver tracción de la app: ingresos, usuarios, conversión | DIARIO — 2 min |
| **Lemon Squeezy dashboard** (app.lemonsqueezy.com) | Ver pagos, suscripciones, refunds | DIARIO — 2 min |
| **ElevenLabs** (elevenlabs.io) | Ver cuántos créditos de voz te quedan | SEMANAL — 1 min |
| **Buzón de feedback** (Supabase) | Leer mensajes que te dejan los usuarios desde la app | SEMANAL — 5-15 min |
| **Yo (Claude)** — esta misma ventana de chat | Hacer todo lo técnico, responderte dudas, arreglar bugs | Cuando algo no cuadra |
| `playbook-escala.md` | Tabla de "si pasa X, haz Y" | Lo abro YO. Tú no lo abres. |
| `manual-operativo-ceo.md` | Templates de respuesta + escenarios | Cuando alguien te escribe quejándose / pidiendo refund |
| `automation-claude-max.md` | Plan de automatizaciones futuras | Cuando me pidas "automatiza X" |

---

## RUTINA DIARIA — 5 minutos en la mañana

### Paso 1 (2 min) — Abre tu panel admin

**Link:** https://stillova.com/admin.html

Te pide contraseña. Es la `ADMIN_PASSWORD` de Vercel. Si no la tienes a mano, escríbeme: **"dame el admin password"** y te lo paso (yo lo leo de Vercel).

**Lo que vas a ver y qué significa cada número:**

| Número en pantalla | Qué significa | Qué es bueno |
|---|---|---|
| **MRR** | Ingreso mensual recurrente. Suma de lo que pagan TODAS tus suscripciones activas | Sube o se mantiene vs ayer |
| **Usuarios pagando** | Cuántos pagan ahora mismo | Sube |
| **Total / Nuevos 7d** | Total de cuentas creadas / nuevas en última semana | Sube |
| **Conversión** | De cada 100 que se registran, cuántos pagan | > 2% es OK al principio |
| **Activación** | De cada 100 que se registran, cuántos completan 1 meditación | > 60% bien |
| **Activos 7d / 30d** | Cuántos usaron la app en últimos 7 / 30 días | Sube |
| **Meditaciones hoy** | Cuántas se generaron hoy | Consistente con MAU. Si MAU=100 y medds=0, ALGO PASA |
| **Distribución de planes** | Cuántos de cada plan | Mira balance |
| **Últimos 30 usuarios** | Lista con email, plan, fecha | Mira si los emails parecen reales |
| **Cuándo escalar** | Avisos automáticos sobre tiers | Si hay aviso → me escribes |

**Qué hacer al final de los 2 minutos:**

- Si todos los números están iguales o mejores que ayer → **CIERRAS Y SIGUES**.
- Si ves algo raro (un número que cae, "Cuándo escalar" con aviso, o cualquier cosa que no entiendes) → **screenshot + me escribes**: "veo X en admin, ¿qué pasa?".

### Paso 2 (2 min) — Abre Lemon Squeezy

**Link:** https://app.lemonsqueezy.com

Login con tu Google.

**Lo que miras:**

1. **Sidebar izquierdo → "Sales"** (o "Orders" según versión): ¿hay ventas nuevas desde ayer?
2. **Sidebar → "Subscriptions"**: cuántas activas, cuántas canceladas hoy.
3. **Sidebar → "Customers"**: total de clientes.

**Qué hacer al final de los 2 minutos:**

- Si hay ventas y no hay refunds → **CIERRAS Y SIGUES**.
- Si ves un símbolo "refund" o "chargeback" → **me escribes URGENTE**: "veo un chargeback en LS, ¿qué hago?". Esto puede ser crítico (chargebacks > 2% pueden hacer que LS te suspenda la cuenta).
- Si ves muchas cancelaciones de golpe (ej: 5+ en un día) → **me escribes**: "veo X cancelaciones, ¿es normal?".

### Paso 3 (1 min) — ¿Hay algo más?

- ¿Recibiste email de algún usuario? → Lo respondes con templates de `manual-operativo-ceo.md` (te explico cómo abajo).
- ¿Viste un comentario público raro en tus redes? → Anota, no respondas en caliente. Lo trabajamos en sesión Claude.
- ¿Sientes que algo va mal pero no sabes qué? → **me escribes**: "siento que algo va mal, dame chequeo de salud". Yo corro mis tests automáticos y te confirmo.

**Total rutina diaria: 5 minutos.**

---

## RUTINA SEMANAL — 15 minutos los lunes

### Paso 1 — Verifica créditos ElevenLabs (1 min)

**Link:** https://elevenlabs.io → arriba derecha tu avatar → "Subscription" o "Suscripción"

**Qué miras:**
- "Characters used" / "Characters remaining"
- Fecha en que se renueva tu plan

**Qué significa cada situación:**

| Lo que ves | Qué es | Qué haces |
|---|---|---|
| < 50% usados, faltan > 7 días para renovación | Estás bien | Nada |
| 50-80% usados, faltan > 7 días | Vigila | Me avisas: "ElevenLabs al 70%, ¿upgrade?" |
| > 80% usados, faltan > 7 días | Vas a quedarte sin créditos | Upgrade Pro $99. Pasos en `tareas-andres.md` |
| < 5% restantes | Crítico. La app empezará a fallar | Upgrade YA |

### Paso 2 — Lee el buzón de feedback (5-15 min)

**Link:** https://supabase.com/dashboard/project/drkfsqppgnbzkumresjr/editor

Pinchas en la tabla **`buzon`** (en la lista lateral).

**Qué ves:** una lista de filas. Cada fila es un mensaje que un usuario te dejó desde la app.

Columnas relevantes:
- `created_at` = fecha del mensaje
- `nombre` o `email` = quién lo escribió (si escribió)
- `mensaje` = el texto
- `clerk_id` = si está logueado, su ID en Clerk (si no, vacío = guest)

**Qué hacer:**

1. Lee los mensajes nuevos (ordenados por fecha más reciente).
2. Para cada mensaje, decide:
   - **Bug técnico** ("no me funciona X") → me escribes: "tengo este reporte de bug, qué hago" + copy del mensaje. Yo investigo. Tú respondes al usuario con el template T2 (bug report) de `manual-operativo-ceo.md`.
   - **Pide refund / cancelar** → respondes con template T1 (refund) de `manual-operativo-ceo.md`. Y procesas el refund en LS.
   - **Pregunta cómo funciona algo** (FAQ) → respondes con template T5/T6 de `manual-operativo-ceo.md`.
   - **Queja sobre el contenido / experiencia** → respondes con template T7 (quejón). Espera 2h antes de responder si te molesta el tono.
   - **Halago** → respondes algo simple como "muchas gracias, me alegra mucho 🙏". 1 frase.

**Importante:** los templates están en `manual-operativo-ceo.md` sección "Templates de soporte cliente". Los abres, copias el que aplique, ajustas nombre, mandas el email.

¿No tienes el email del usuario? Ve a Supabase → tabla `users` → busca por `clerk_id` → ahí está el email.

### Paso 3 — Sesión Claude semanal (10 min)

Abres esta misma chat conmigo y escribes:

> **"Reporte semanal Stillova. Dame números de la semana, top 3 cosas a mirar, y 1 cosa para iterar la próxima semana."**

Yo te doy:
- Cómo van MAU/MRR vs semana anterior
- Top errores
- Top feedback (extracto del buzón con sentiment)
- 1 recomendación concreta (ej: "este botón está convirtiendo 5x menos que el otro, prueba esto")

Tú eliges si seguir la recomendación o no.

---

## CUANDO ALGO NO CUADRA — qué hacer paso a paso

### Te llega un email enojado de un usuario
1. Lees el email.
2. Vas a `manual-operativo-ceo.md` → sección **"Templates de soporte cliente"**.
3. Eliges el template que más se parece (T1 refund, T2 bug, T7 hostil, etc.).
4. Copias el template, ajustas el nombre del usuario.
5. Si la queja es técnica y no entiendes → **antes de responder**, me escribes: "tengo esta queja, ¿qué pasó realmente?" Te explico, después tú respondes.
6. **Regla de oro**: si la queja te cabreó, NO respondas en las próximas 2 horas. Espera.

### Ves un número raro en admin
1. Screenshot del admin.
2. Me escribes: "veo X en admin, ¿qué significa?"
3. Yo investigo y te explico:
   - "Es normal, ignora" → cierras y sigues.
   - "Es un bug, lo arreglo yo" → te aviso cuando esté.
   - "Necesito que TÚ hagas X" → te lo explico paso a paso.

### La app va lenta o no carga
1. Tú mismo: abre `stillova.com` en otro navegador / móvil. ¿Sigue lenta?
2. Si sí → me escribes: "la app está lenta/caída". 
3. Yo voy a `playbook-escala.md` (mi referencia) y ejecuto el termómetro #6 (latencia) o #7 (errores 5xx) según corresponda.
4. Te aviso lo que encontré + lo que hago.

### Lemon Squeezy te muestra un chargeback / refund
1. **No entres en pánico**. 1-2 chargebacks al mes son normales.
2. Me escribes: "tengo un chargeback en LS, plan X, monto Y".
3. Yo voy a `playbook-escala.md` termómetro #10 y te digo:
   - Si es < 0.5% del total de ventas → ignora.
   - Si es 0.5-1.5% → revisamos copy del checkout.
   - Si es > 2% → URGENTE, paramos signups, investigamos.

### Sientes que algo está mal pero no sabes qué
1. Me escribes: "intuyo que algo va mal con [X], dame chequeo".
2. Yo corro mis tests, miro logs, te confirmo si hay algo o si tu intuición es paranoia normal de founder.

---

## CUANDO QUIERES MEJORAR ALGO

### "Quiero saber qué hace la gente en la app antes de dejarla"
- Me escribes: "abre PostHog y dime el embudo: home → generación → paywall → pago".
- Yo te doy reporte. Tú decides qué iterar.

### "Quiero probar cambiar el copy del paywall"
- Me escribes: "quiero A/B testear el paywall con 2 versiones: A=actual, B=...".
- Yo lo implemento, deploya, y monitorizo durante 7 días.

### "Quiero subir precios"
- Me escribes: "estoy pensando en subir Premium de $19.99 a $24.99, ¿qué dice la data?".
- Yo evalúo: cuánto convierte hoy, cuánta elasticidad probable, riesgo. Te recomiendo o desaconsejo.

### "Quiero automatizar X"
- Me escribes: "quiero automatizar X" donde X = lo que sea (recibir email diario, alertas push, generar reporte, etc.).
- Yo voy a `automation-claude-max.md` y te muestro qué fase cubre eso. Si no está en el plan, lo añado y te digo cuánto tarda construirlo.

---

## LA REGLA PRINCIPAL

**Si una herramienta no te dice qué hacer claramente, escríbeme.**

Yo soy quien:
- Sabe qué significa cada número
- Sabe a qué documento ir
- Ejecuta lo técnico
- Te dice qué te toca a ti

Tú eres quien:
- Aprueba acciones que afectan a usuarios o dinero
- Habla con usuarios humanamente
- Decide la dirección estratégica

---

## RESUMEN MUY VISUAL

**Lo único que tienes que recordar:**

```
MAÑANA (5 min):
  1. Abre stillova.com/admin.html → mira números
  2. Abre app.lemonsqueezy.com → mira ventas
  3. ¿Algo raro? → escríbeme

LUNES (15 min):
  1. Abre elevenlabs.io → mira créditos
  2. Abre Supabase → tabla buzon → responde mensajes
  3. Sesión Claude semanal: "reporte semanal"

CUANDO ALGO PASA:
  → Screenshot + escríbeme aquí mismo

CUANDO QUIERES ALGO NUEVO:
  → Escríbeme: "quiero hacer X"
```

Eso es todo.
