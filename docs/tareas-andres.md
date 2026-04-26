# Tareas para Andrés — Stillova

Aquí están las cosas que **solo tú puedes hacer** porque yo no tengo acceso (paneles externos, decisiones financieras, rotación de claves, etc.). Centralizadas para que no me andes preguntando lo mismo cada sesión.

**Cómo usar este archivo:**
- Al hacer una tarea, marca la casilla. Cuando todas estén ✅ avísame y la limpio.
- Si una tarea no la entiendes, dímelo y la reescribo.
- Las tareas urgentes están arriba. Las opcionales/preventivas, más abajo.

---

## 🔴 Pre-lanzamiento (los 3 míos del plan pre-marketing)

### A. PASO 7 QA — Stripe E2E con tarjeta REAL

- **Por qué:** Stripe está configurado en LIVE pero NUNCA se ha probado el flujo completo con una tarjeta real. Sin esto, lanzar marketing es ruleta rusa con tu dinero.
- **Tiempo:** 10 min.

**Pasos:**

1. [ ] Abre stillova.com en una ventana **incógnito** (importante).
2. [ ] Sigue el flujo guest: escribe algo en el textarea → genera meditación → escucha al menos 1 min.
3. [ ] Cuando termine, te aparece end-guest con CTA "Desbloquear Stillova por €6,99".
4. [ ] Pulsa el CTA → te pide crear cuenta → créala con email nuevo.
5. [ ] Tras signup llegas al modal pre-Stripe "Confirmas tu plan: Essential mensual · €6,99 hoy".
6. [ ] Pulsa "Pagar €6,99" → vas a Stripe checkout.
7. [ ] Mete tu tarjeta REAL.
8. [ ] Confirma cobro.
9. [ ] Verifica en tu email + en [Stripe dashboard](https://dashboard.stripe.com) que el cargo apareció.
10. [ ] Verifica que llegas a la pantalla post-checkout (nombre + qué quieres trabajar).
11. [ ] Verifica en Supabase / dashboard de admin que tu plan figura como Essential.
12. [ ] Cancela la suscripción inmediatamente desde Stripe dashboard (o desde tu perfil en la app).
13. [ ] Confirma que la cancelación funciona y que mantienes acceso hasta fin de periodo.

**Si falla en cualquier paso:** páralo todo y avísame con screenshot.

---

### B. Activar 2FA en TODAS las cuentas críticas

- **Por qué:** Si te hijackean cualquiera de estas cuentas, te quitan el negocio en una tarde. Esto es el seguro de vida del proyecto.
- **Tiempo:** 30 min.

**Cuentas a proteger (en este orden):**

1. [ ] **Stripe** — [dashboard.stripe.com](https://dashboard.stripe.com) → Settings → Team & Security → Two-factor authentication. Usa Google Authenticator o Authy.
2. [ ] **Vercel** — [vercel.com/account](https://vercel.com/account) → Security → Two-Factor Authentication.
3. [ ] **Clerk** — [dashboard.clerk.com](https://dashboard.clerk.com) → tu avatar → Account Settings → Two-Factor Authentication.
4. [ ] **Supabase** — [supabase.com/dashboard/account/security](https://supabase.com/dashboard/account/security) → enable 2FA.
5. [ ] **ElevenLabs** — [elevenlabs.io](https://elevenlabs.io) → Settings → Security → 2FA.
6. [ ] **Anthropic** — [console.anthropic.com](https://console.anthropic.com) → Settings → Account → Two-Factor Authentication.
7. [ ] **Google** (la cuenta del proyecto) — [myaccount.google.com/security](https://myaccount.google.com/security) → 2-Step Verification. Si no está activo, **es la prioridad #1**: protege todos los logins via Google.

**Importante:**
- Guarda los **códigos de respaldo** que cada servicio te da (en cada activación). Son 10 códigos de un solo uso por si pierdes el móvil. Imprímelos o guárdalos en un password manager (1Password, Bitwarden).
- Si usas un mismo Authenticator app, asegúrate que está respaldado en iCloud / Google.

---

### C. Verificar Stripe payouts a Chile

- **Por qué:** Tu cuenta Stripe puede tener limitaciones por nacionalidad chilena para hacer payouts a tu banco. Si no puedes cobrar, todo lo demás da igual.
- **Tiempo:** 10 min.

**Pasos:**

1. [ ] Abre [Stripe Dashboard → Settings → Payouts](https://dashboard.stripe.com/settings/payouts).
2. [ ] Verifica que aparece tu cuenta bancaria chilena conectada.
3. [ ] Mira si dice "additional information required" o "verification pending" — si sí, completa lo que pidan ahora (puede ser DNI, dirección, formulario W-8BEN si te aplican como no-US).
4. [ ] Verifica el "payout schedule" — debería ser automático cada X días.
5. [ ] Si todo está OK, haz un **test payment a tu propia tarjeta** desde el flujo del PASO A: si el cobro entra, los payouts también deberían funcionar.
6. [ ] Si Stripe pide cualquier cosa adicional, avísame antes de continuar.

---

## 🔴 Pendientes — pueden esperar pero conviene hacer

### 1. Rotar el token de Supabase Management

- **Por qué:** Pegaste este token en el chat conmigo en sesión 14 (24-abril-2026). Eso queda en el historial de Anthropic. Aunque solo sirve para acceder a TU Supabase y soy yo quien lo usa, es higiene rotarlo.
- **Tiempo:** 2 minutos.
- **Riesgo si no lo haces:** Bajo. Pero si en el futuro alguien tuviera acceso al historial podría manipular tu DB.

**Pasos:**

1. [ ] Abre [Supabase Personal Access Tokens](https://supabase.com/dashboard/account/tokens).
2. [ ] Busca un token llamado `claude-stillova-2026` (o similar al que generaste). Click en los **3 puntos** a su derecha → **Revoke**.
3. [ ] Click en **"Generate new token"**, ponle de nombre `claude-stillova-may2026`, click **Generate**.
4. [ ] Copia el valor (empieza con `sbp_`) — solo se muestra UNA vez.
5. [ ] Pégalo en el chat conmigo. Yo lo guardo en `.env.local` y en Vercel.
6. [ ] Listo. Yo verifico haciendo una query y te confirmo.

---

## 🟡 Pre-marketing relámpago — recordar antes de la fase E

### 2. Subir plan ElevenLabs a Pro $99/mes

- **Por qué:** Hoy estás en Creator $22 con 86k créditos restantes. Eso te alcanza para unas 50-60 meditaciones más este mes. Si el marketing relámpago genera 200-500 generaciones en una semana, te quedas sin créditos a mitad de campaña → app rota → mala primera impresión a los users que justo entraron por el marketing.
- **Cuándo:** 2-3 días **antes** de lanzar la campaña (no antes — son $77 extra).
- **Decisión a tomar:** Pro $99 (500K créditos, ~330 medds/mes) o Scale $330 (2M créditos, ~1.300 medds/mes). Lo decidimos cuando tengamos estimación real del volumen de campaña.

**Pasos (para cuando llegue el momento):**

1. [ ] Abre https://elevenlabs.io → arriba derecha tu avatar → **Suscripción**.
2. [ ] Click en **"Mejorar"** o **"Upgrade"** al lado del plan deseado.
3. [ ] Confirma con tu tarjeta. El cambio es inmediato.
4. [ ] Avísame y verificamos en el panel que el cambio quedó aplicado.

### 3. (Lo hago yo, te aviso) — Implementar fail-soft de ElevenLabs

- **Por qué:** Si ElevenLabs se queda sin créditos en plena campaña, la app debe decirle al usuario "estamos a tope, vuelve en una hora" en lugar de mostrar error genérico. Mejor experiencia, no perdemos al user para siempre.
- **Quién lo hace:** Yo. Te aviso cuando esté hecho. ~20 minutos de mi parte.
- **Tu rol:** Esperar a que te lo confirme. No requiere acción tuya.

### 4. Activar Supabase Connection Pooler (Transaction mode)

- **Por qué:** Hoy cada función serverless abre su propia conexión directa a la DB de Supabase. Con 1.000 usuarios concurrentes esto puede saturar la DB y empezar a tirar errores. El "pooler" es como un asistente que reusa conexiones existentes en lugar de abrir nuevas. Es **gratis**, ya viene incluido en tu plan.
- **Cuándo:** 1 día antes del marketing relámpago.
- **Tiempo:** 5 minutos.
- **Riesgo de hacerlo:** Bajo. Yo te ayudo a copiar la nueva URL de conexión a Vercel.

**Pasos:**

1. [ ] Abre [Supabase Database Settings](https://supabase.com/dashboard/project/drkfsqppgnbzkumresjr/settings/database).
2. [ ] Busca la sección **"Connection pooling"** (o "Connection string"). Va a aparecer un toggle o un campo **"Pooler"**.
3. [ ] Asegúrate de que esté en modo **"Transaction"** (es el más eficiente para serverless).
4. [ ] Copia el **"Pooler connection string"** (debería empezar con `postgresql://` y contener `pooler.supabase.com:6543`).
5. [ ] Pásamelo en el chat. Yo lo configuro en Vercel como `SUPABASE_POOLER_URL` y actualizo el código para usarlo en producción.
6. [ ] Confirmo desde mi lado que la app sigue funcionando con el pooler activo.

---

## 🟢 Opcional preventivo — solo si en algún momento quieres hacer "limpieza grande de seguridad"

### 4. Rotar las otras claves API (preventivo)

- **Por qué:** Las claves de Anthropic / Stripe / Clerk / ElevenLabs / Supabase están en `.env.local` (en disco, no commiteado nunca al git — verificado). No hay evidencia de filtración. Pero rotarlas cada 6-12 meses es buena higiene en cualquier proyecto.
- **Cuándo:** No urgente. Hazlo si en algún momento dudas de la integridad de tu disco/laptop, o como rutina anual.
- **Tiempo:** ~25 minutos en total (5 minutos por servicio).
- **Riesgo de hacerlo:** Bajo. Yo te guio para que la app no se rompa entre rotación y actualización en Vercel.

**Pasos (orden recomendado):**

1. [ ] Antes de empezar, avísame en el chat: "voy a rotar claves". Yo me preparo para guardarte cada nueva en Vercel/local.
2. [ ] **Anthropic** → https://console.anthropic.com/settings/keys → genera nueva → **NO revoques la vieja todavía** → pásamela → cambio en Vercel → te confirmo → ahora sí revocas la vieja.
3. [ ] **Clerk** → [Dashboard Stillova](https://dashboard.clerk.com) → Settings → API Keys → "Rotate" en Secret Key → pásamela → mismo flujo.
4. [ ] **Stripe** → https://dashboard.stripe.com/apikeys → "Roll" en Secret Key (live) → pásamela → mismo flujo. **Atención**: el webhook secret es DIFERENTE; si rotas el webhook secret, también hay que actualizarlo en Vercel.
5. [ ] **ElevenLabs** → https://elevenlabs.io → Profile → API Key → Regenerate → pásamela → mismo flujo.
6. [ ] **Supabase Service Role Key** → https://supabase.com/dashboard/project/drkfsqppgnbzkumresjr/settings/api → "Reveal" → no se rota fácil sin contactar a Supabase. **Saltala** salvo que haya razón concreta.

**Notas:**
- En cada paso, **no revoques la clave vieja antes de confirmar que la nueva ya está deployada** en Vercel. Si revocas antes, la app deja de funcionar entre 1-3 minutos hasta que el nuevo deploy se propague.
- Yo controlo el deploy y te confirmo "ya quedó". Solo entonces revocas la vieja.

---

## ✅ Cerradas

(vacío por ahora)
