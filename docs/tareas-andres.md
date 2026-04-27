# Tareas para Andrés — Stillova

Aquí están las cosas que **solo tú puedes hacer** porque yo no tengo acceso (paneles externos, decisiones financieras, rotación de claves, etc.). Centralizadas para que no me andes preguntando lo mismo cada sesión.

**Cómo usar este archivo:**
- Al hacer una tarea, marca la casilla. Cuando todas estén ✅ avísame y la limpio.
- Si una tarea no la entiendes, dímelo y la reescribo.
- Las tareas urgentes están arriba. Las opcionales/preventivas, más abajo.

---

## 🔴 Pre-lanzamiento (los 3 míos del plan pre-marketing)

### ✅ C. Verificar Stripe payouts → CERRADO (con pivote a Lemon Squeezy)

**Sesión 2026-04-26.** Al revisar la cuenta Stripe (registrada como "Silencio" en España con cuenta Santander España) descubrimos:
- La cuenta estaba mal abierta: registrada como "Empresario Individual / Autónomo España" cuando Andrés NO es autónomo (solo estudiante con visado español temporal).
- Residencia fiscal real: Chile.
- Stripe pedía NIF español que no podíamos llenar legalmente.
- Stripe Chile no está disponible para abrir cuenta directa (solo beta por invitación).

**Decisión:** abandonar Stripe directo, migrar a **Lemon Squeezy** (Merchant of Record).
- Lemon Squeezy es la entidad legal vendedora; Andrés solo declara ingresos como persona natural en Chile.
- Comisión: 5% + $0.50 por venta (vs 3.6% Stripe). Pagamos 1.4% más por no tener que armar empresa.
- Cuenta nueva creada: store "Stillova" en lemonsqueezy.com
  - 2FA activado ✅ (backup codes guardados)
  - Identity verification enviada (en review, 1-3 días) ✅
  - Banco chileno conectado ✅
  - Pendiente: aprobación Stripe Connect (espera) + crear primer producto (lo hago yo en código)
- Stripe España ("Silencio"): se deja morir. Saldo €0, sin pérdida.

**Lo que falta hacer (yo, en código, ~2-3h):**
- Migrar integración Stripe → Lemon Squeezy en backend.
- Cambiar variables de entorno en Vercel.
- Cambiar webhooks.
- Re-test E2E con tarjeta real (eso reemplaza al PASO A del plan original).

---

### A1. PASO 7 QA — Pago E2E con tarjeta TEST (vía Lemon Squeezy, test mode)

- **Por qué:** Validar que el flujo técnico funciona end-to-end (Stillova → LS checkout → webhook → plan en Supabase) ANTES de tener acceso a cobrar de verdad.
- **Cuándo:** apenas yo termine deploy y te avise.
- **Tiempo:** 10 min.

**Pasos:**

1. [ ] Abre stillova.com en ventana **incógnito**.
2. [ ] Flujo guest: textarea → genera meditación → escucha 1 min.
3. [ ] End-guest CTA "Desbloquear Stillova por $6.99".
4. [ ] Crear cuenta con email nuevo.
5. [ ] Modal pre-checkout "Confirmas tu plan".
6. [ ] Pagar → vas a checkout de Lemon Squeezy.
7. [ ] **Tarjeta TEST de Stripe**: `4242 4242 4242 4242` · cualquier fecha futura · CVC `123` · CP `12345`.
8. [ ] Confirmar pantalla de éxito.
9. [ ] Verificar en LS dashboard → Orders que aparece la orden test.
10. [ ] Verificar pantalla post-checkout en la app.
11. [ ] Verificar plan Essential en stillova.com/admin.html.
12. [ ] Cancelar suscripción desde tu perfil en la app.
13. [ ] Confirmar `subscription_status = cancelled` en admin.

**Si falla:** páralo y avísame con screenshot.

---

### A2. PASO 7 QA — Pago E2E con tarjeta REAL (cuando LS apruebe live mode)

- **Por qué:** Confirmar que tu cuenta LS aprobada cobra de verdad. Sin esto lanzar marketing es ruleta rusa.
- **Bloqueado hasta:** que LS apruebe tu identity verification (1-3 días desde 2026-04-26). Recibes email de LS.
- **Tiempo:** 5 min después de A1.

**Pasos cuando llegue el email de aprobación de LS:**

1. [ ] Entra a lemonsqueezy.com → bottom-left toggle "Test mode" → **apágalo**.
2. [ ] Ventana incógnito → repite el flujo de A1 con tu tarjeta REAL.
3. [ ] Confirma cobro real en tu app del banco.
4. [ ] Después: cancela y verifica refund en LS dashboard si quieres recuperar el dinero del test (mensual = $6.99 promo).

---

### A3. ROTAR el API key de Lemon Squeezy

- **Por qué:** El API key se pegó en chat conmigo. Aunque solo accede a tu cuenta LS, es higiene.
- **Cuándo:** Después de A2 (cuando todo esté funcionando en live).
- **Tiempo:** 3 min.

**Pasos:**

1. [ ] lemonsqueezy.com → Settings → API → tu API key actual `stillova-prod` → **Revoke**.
2. [ ] Create new API key, nombre `stillova-prod-2`.
3. [ ] Copia el token (empieza con `eyJ...`).
4. [ ] Pásamelo en chat.
5. [ ] Yo lo cambio en Vercel + redeploy. Te confirmo cuando esté.

---

### D. Validar visualmente la app en producción + nueva feature de nombre

- **Por qué:** Los últimos cambios (Ronda 1+2 + USD + feature "¿cómo refiriros a ti?") están en producción pero nadie los ha visto en un browser real. Si hay un bug visual, lo amplificas con marketing.
- **Tiempo:** 15 min.
- **Cuándo:** antes de lanzar la campaña.

**Pasos:**

1. [ ] **Ventana incógnito** → stillova.com.
2. [ ] Pasa onboarding: debe ser **2 pasos** (welcome + primera sesión).
3. [ ] En home guest: aparece input nuevo *"¿Cómo quieres que nos refiramos a ti?"* sobre el textarea.
4. [ ] Escribe tu nombre + algo en el textarea (ej: "ansioso por entrevista mañana") + genera.
5. [ ] **Escucha la meditación**: la voz debe decir tu nombre en intro o transición media (nunca al cierre). Si no lo dice o suena forzado → screenshot/avísame.
6. [ ] Ventana incógnito nueva → stillova.com → en home guest debe aparecer **"Hola, [Tu nombre]." + botón "cambiar"** en lugar del input. (Si abriste otra ventana incógnito separada, el localStorage es nuevo — usa la misma para el test 2).
7. [ ] Continúa hasta el paywall (NO intentes pagar — el checkout falla técnicamente hasta que LS apruebe). Verifica que veas:
   - 3 cards verticales (Essential / Premium / Studio)
   - Anual seleccionado por defecto
   - Microcopy "Hoy se cobran $X · 12 meses · cancela cuando quieras"
   - Precios en **dólares** (`$9.99`, `$19.99`, `$39.99` mensuales)
8. [ ] Click en un plan → **modal pre-checkout** debe aparecer con monto explícito.

Si todo OK → escríbeme "validación visual ok". Si encuentras algo raro → screenshot.

---

### B. ✅ 2FA en cuentas críticas — CERRADO

Andrés se loguea con Google a todas las cuentas (Anthropic, Vercel, Supabase, ElevenLabs, Clerk, Lemon Squeezy). Google tiene 2FA activo → toda la cadena protegida.

**Upgrade pendiente** cuando haya tracción ($MRR consistente): **Google Advanced Protection Program**. Reemplaza códigos del móvil por **llaves físicas USB** (YubiKey o Google Titan, ~€50 cada una × 2). Lo que usan founders/periodistas. Bloquea phishing avanzado y SIM-swap. Activarlo cuando valga la pena defender la cuenta — mucho antes de $10k MRR.

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

---

## 📘 Documentos de operación (referencia para CEO)

Tres documentos vivos que te explican cómo operar Stillova solo (con Claude). No son "tareas" — son tus manuales:

- [`docs/playbook-escala.md`](playbook-escala.md) — termómetros + acción exacta para cada threshold (ElevenLabs, Vercel, Anthropic, Supabase, Clerk, churn, chargebacks, etc). 18 termómetros con 3 niveles cada uno.
- [`docs/manual-operativo-ceo.md`](manual-operativo-ceo.md) — tu día/semana/mes, decisiones que solo tú tomas vs. que Claude toma, templates de soporte cliente, escenarios "qué pasa si" (10 escenarios), milestones de hiring por MRR.
- [`docs/automation-claude-max.md`](automation-claude-max.md) — plan en 7 fases para sacar 100% al $200/mes de Claude (cron jobs, alertas push, dashboard, slash commands, soporte auto, guardián de seguridad, agente de growth).

**Cuándo leerlos**: el playbook lo abres cuando algo se siente raro. El manual operativo lo lees una vez completo, luego solo consultas escenarios cuando aplique. Automation lo revisamos cuando arranquemos esa sesión específica.

---

## ✅ Cerradas

(vacío por ahora)
