# Estado actual de la app — Stillova

> Última actualización: 2026-04-28 (sesión audit + limpieza)

## Archivo principal
**Un solo HTML:** `index.html` — toda la app vive aquí. No hay router, no hay páginas separadas. Las pantallas se muestran/ocultan con JS.

Páginas independientes en raíz:
- `admin.html` — cockpit del CEO (gate por password). Acceso vía `stillova.com/admin.html` o `stillova.com/admin`
- `privacy.html`, `terms.html` — legales

(`dashboard.html` fue borrada el 28-abril-2026 por obsoleta — su funcionalidad de biblioteca vive ahora en `screen-library` dentro de `index.html`.)

---

## Pantallas (IDs en index.html)

| ID | Nombre | Cuándo se muestra |
|----|--------|-------------------|
| `screen-onboarding` | Onboarding | Primera vez que entra un usuario nuevo |
| `screen-home` | Home | Pantalla principal tras onboarding |
| `screen-create` | Crear meditación | Al pulsar "Crear meditación para mí" |
| `screen-loading` | Cargando | Mientras se genera el audio |
| `screen-player` | Reproductor | Cuando el audio está listo |
| `screen-library` | Biblioteca | Tab inferior — meditaciones guardadas |
| `screen-profile` | Perfil | Tab inferior — plan, ajustes, cerrar sesión |
| `screen-end-account` | End-state autenticado | Tras escuchar (con cuenta y créditos) |
| `screen-post-checkout` | Post-checkout | Después de pago exitoso |
| `paywall-modal` | Paywall | Overlay sobre cualquier pantalla |
| `precheckout-modal` | Pre-checkout | Confirmación antes de redirigir a LS |

### Flujo principal
```
Onboarding (ob-1 → ob-2 → ob-3 → ob-4 → obSkipToFree → Create)
  ↓
Home → Create → Loading → Player → End states
                                     ├── end-account (autenticado, opcionalmente save)
                                     ├── end-upsell (free que completó su 1 sesión)
                                     └── end-guest (sin cuenta)
```

### Pasos del onboarding
- `ob-1` → Pantalla intro con CTA "Empezar" → `obNext(2)`
- `ob-2` → ¿Qué te trae? (cards multiselect: ansiedad, sueño, enfoque, reconectar, otro) → `obNext(3)`
- `ob-3` → Cómo funciona (3 pasos explicativos) → `obNext(4)`
- `ob-4` → Primera sesión, CTA "Empezar mi primera sesión" → `obSkipToFree()` → `showCreate()`
- Paywall NO es parte del onboarding — solo aparece cuando free agota crédito o user pide "Ver planes"

### Home guest — feature "¿cómo refiriros a ti?"
- Input opcional sobre el textarea principal en home guest
- Persiste en `localStorage.stillova_referred_as`
- En visitas siguientes muestra "Hola, [Nombre]." con botón "cambiar"
- Se pasa al prompt de meditación como `userName`

---

## Archivos JS — `js/` (canónicos)

| Archivo | Responsabilidad |
|---------|----------------|
| `state.js` | Estado global de la app (usuario, créditos, config activa) |
| `utils.js` | Helpers: formatear tiempo, mostrar/ocultar elementos |
| `analytics.js` | Track de eventos con PostHog |
| `audio.js` | Control de audio principal + audio ambiente (Web Audio API) |
| `pricing.js` | **Single source of truth de precios.** Lee `/pricing.json` con fallback embebido. Helpers: `getPlanLabel`, `getDisplayMonthly`, `getTotalToday`, `getProfilePrice`, `getEssentialFirstMonthPromo` |
| `navigation.js` | `showHome()`, `showCreate()`, `openLibrary()`, `openProfile()` — navegación entre pantallas |
| `onboarding.js` | `obNext()`, `obBack()`, `obChipToggle()`, `obSelectGoal()`, `obSkipToFree()` |
| `create.js` | `convoRevealConfig()`, `selectPill()`, `goToGenerate()`, `onInputChange()` |
| `generation.js` | Llama a `/api/meditation` (Claude) y `/api/audio` (ElevenLabs). Envía `userHour` + `userTimezone` para personalización por hora. Tras éxito guarda meditación pendiente en LS via `pending-meditation.js` |
| `pending-meditation.js` | Recuperación de meditación generada pero no escuchada (24h en localStorage). Banner home guest+user con CTA "Escuchar". Limpia LS tras 30s escuchados |
| `pwa-install.js` | Banner "Añadir Stillova al inicio" mobile-only. Captura `beforeinstallprompt` (Android), modal con pasos visuales (iOS). Aparece tras 2+ visitas a home si no instalada |
| `player.js` | `togglePlay()`, `seekTo()`, `handleEnd()`, `newMeditation()`, timer countdown |
| `gamification.js` | Racha, minutos semanales, nivel del usuario |
| `auth.js` | Clerk: `openAuth()`, `signOut()`, detección de sesión activa |
| `save.js` | `saveMeditation()`, `skipSave()` — guarda en Supabase |
| `post-session.js` | Render end-guest / end-upsell con CTAs hidratados desde `pricing.js` |
| `post-checkout.js` | Pantalla post-pago tras webhook Lemon Squeezy |
| `library.js` | Carga y renderiza meditaciones guardadas, filtros por emoción y duración. Llama a `/api/dashboard` |
| `init.js` | Inicialización: carga estado, muestra pantalla correcta, registra service worker |

---

## Archivos CSS — `css/` (canónicos)

| Archivo | Qué cubre |
|---------|-----------|
| `base.css` | Variables CSS, reset, tipografía (Fraunces + Inter), colores |
| `layout.css` | Screens, home, create, loading, elementos generales |
| `player.css` | Player, anillo SVG circular, animación breathing |
| `paywall.css` | Modal paywall, cards de planes, toggle mensual/anual |
| `dashboard.css` | Biblioteca (`screen-library`), stats, filtros, lista de meditaciones |
| `responsive.css` | Media queries para móvil/desktop |
| `onboarding.css` | Pasos del onboarding, chips, goal cards, plan cards |

---

## API routes — `api/` (serverless en Vercel)

**12/12 functions activas (límite Hobby = 12 — agotado).** Próxima function nueva fuerza salto a Vercel Pro $20/mes.

| Archivo | Función |
|---------|---------|
| `meditation.js` | Genera el texto de la meditación con Claude (Opus 4.7). Acepta `userHour` + `userTimezone` para contexto situacional débil. Sample 20% de generaciones a Redis para LLM-judge |
| `audio.js` | Genera audio con ElevenLabs |
| `checkout.js` | Crea sesión de checkout en Lemon Squeezy |
| `webhook.js` | Recibe eventos de Lemon Squeezy (pago completado, cancelación, refund) con verificación HMAC |
| `user.js` | Info del usuario: plan, créditos, estado |
| `save-meditation.js` | Guarda meditación en Supabase |
| `dashboard.js` | Datos para la biblioteca personal del usuario (no admin) |
| `admin.js` | **Cockpit del CEO.** KPIs + 6 health checks (errores, ElevenLabs, MAU, suscripciones LS, refunds, buzón) + buzón embebido + lista usuarios. Gate por `x-admin-password` |
| `health.js` | Health check público |
| `logs.js` | Logs de meditaciones generadas en Upstash Redis (gate admin) |
| `buzon.js` | Recibe feedback del usuario. Auth opcional, rate limit 5/IP/hora |
| `monitor.js` | **Monitor automático.** 4 checks (5xx, calidad LLM-judge, ElevenLabs, refunds LS) ejecutados cada hora por GitHub Actions cron. Alertas → Telegram bot. Gate por `x-monitor-secret` |

### Helpers internos (no son functions)

| Archivo | Función |
|---------|---------|
| `_auth.js` | Verificar token Clerk (con publishableKey + secretKey) |
| `_lemonsqueezy.js` | Helpers Lemon Squeezy (verificar webhook HMAC, etc.) |
| `_limits.js` | Verificar límites de créditos por plan |
| `_logError.js` | **Registrar errores 5xx en tabla `error_log`.** Nunca throw |
| `_namesWhitelist.js` | Validación de userName en 2 capas: whitelist ~730 nombres ES + heurísticas anti-basura |
| `_ratelimit.js` | Rate limiting con Upstash Redis |
| `_supabase.js` | Cliente Supabase con service_role |
| `_telegram.js` | Helper `sendTelegramAlert(text)` para enviar alertas a @stillova_alerts_bot |

---

## Sonidos de fondo — `sounds/`

4 archivos MP3 con frecuencias binaurales: `258hz` (calma), `417hz` (transformación), `528hz` (amor), `viacheslavstarostin` (espiritual). Selección automática según objetivo del usuario (la elección manual está deshabilitada por decisión de Andrés).

---

## Integraciones activas

| Servicio | Uso | Plan actual |
|----------|-----|-------------|
| **Clerk** | Auth (Google login + email) — keys live `sk_live_l2EU...` y `pk_live_*` | Free (hasta 10k MAU) |
| **Supabase** | DB Postgres — tablas: `users`, `meditations`, `monthly_usage`, `buzon_messages`, `error_log`, `guest_usage` | Free |
| **Lemon Squeezy** | Pagos (Merchant of Record) — sigue en TEST MODE hasta aprobación live | $0 fijo + 5%+$0.50/venta |
| **ElevenLabs** | Síntesis audio. Dos keys: `ELEVENLABS_API_KEY` (TTS) y `ELEVENLABS_ADMIN_KEY` (read-only para cockpit) | Creator $22 |
| **Anthropic Claude** | Generación texto meditaciones — modelo Opus 4.7 (siempre, todas las duraciones) | Pay-as-you-go |
| **PostHog** | Analytics y tracking de eventos | Free (1M eventos/mes) |
| **Upstash Redis** | Rate limiting + logs de meditaciones | Free |
| **Vercel** | Hosting + serverless | Hobby ($0) — 11/12 functions |
| **Namecheap** | Dominio stillova.com | $1/mes (anual) |

**Total infraestructura: ~$25/mes** sin tráfico real.

---

## Planes (producción, USD)

| Plan | Mensual | Anual (mensual equivalente) | Anual total | Créditos | Duración máx | Biblioteca |
|------|---------|------------------------------|-------------|----------|--------------|------------|
| Gratis | $0 | — | — | 1 (para probar) | 5 min | — |
| Essential | $9.99 | $7.99 | $95.88 | 10/mes | 15 min | 5 guardadas |
| Premium | $19.99 | $15.99 | $191.88 | 25/mes | 20 min | 20 guardadas |
| Studio | $39.99 | $31.99 | $383.88 | 60/mes | 30 min | Ilimitada |

**Conversión de créditos:** 5 min = 1 cr · 10 min = 2 cr · 15 min = 3 cr · 20 min = 4 cr · 30 min = 6 cr (Studio only)

**Promo primer mes mensual:** Essential $6.99 (descuento $3 vía discount code Lemon Squeezy)

Source of truth: `pricing.json` en raíz + fallback en `js/pricing.js`. **NO hardcodear precios en otros archivos.**

---

## Migraciones Supabase aplicadas

(Archivos `*.sql` en raíz, mantenidos como historial)
- `supabase-migration.sql` — schema inicial users + meditations
- `supabase-migration-buzon.sql` — tabla buzon_messages
- `supabase-migration-error-log.sql` — tabla error_log (28-abril-2026)
- `supabase-migration-guest-usage.sql` — tabla guest_usage
- `supabase-migration-indexes.sql` — índices de performance
- `supabase-migration-rls-and-atomic.sql` — Row Level Security + transacciones atómicas
- `supabase-migration-subscription-status.sql` — columna subscription_status

---

## Tests E2E — `tests/`

| Spec | Cobertura | ¿Gasta créditos? |
|------|-----------|-------------------|
| `smoke.spec.js` | Flujo guest sin auth (onboarding, paywall, biblioteca guest) | No |
| `pricing-smoke.spec.js` | Pricing local (server estático) — 5 tests | No |
| `pricing-prod.spec.js` | Pricing en stillova.com — 4 tests | No |
| `clerk-live-smoke.spec.js` | Anti-incidente test/live: pk_live + sk_live + /api/user — 3 tests | No |
| `time-context.spec.js` | Personalización por hora del día — 3 tests | ~$0.04 (3 generaciones Claude) |
| `generation.spec.js` | E2E completo: Claude + ElevenLabs + Player con auth real | ~1 crédito por ejecución |

**Auth scripts:** `setup-auth.js` (manual) y `setup-auth-auto.js` (programático con Clerk sign-in tokens).

---

## Documentación operativa

- [`docs/manual-uso-diario.md`](manual-uso-diario.md) — **el principal.** Qué links abres, qué números miras, qué hacer si algo está raro
- [`docs/playbook-escala.md`](playbook-escala.md) — 18 termómetros con acción exacta para cada threshold
- [`docs/manual-operativo-ceo.md`](manual-operativo-ceo.md) — rutinas, escenarios "qué pasa si", templates, milestones de hiring
- [`docs/automation-claude-max.md`](automation-claude-max.md) — plan 7 fases para sacar 100% al plan Max $200/mes
- [`docs/tareas-andres.md`](tareas-andres.md) — pendientes manuales del founder con paso a paso
- [`docs/checklist-qa-manual.md`](checklist-qa-manual.md) — checklist QA para validación pre-launch
- [`docs/test-user-setup.md`](test-user-setup.md) — cómo configurar usuario de test con plan Studio
- [`docs/research-pendiente.md`](research-pendiente.md) — research que YO debo hacer cuando aplique
- [`docs/protocolo-analisis-ux.md`](protocolo-analisis-ux.md) — protocolo de auditoría UX
- [`docs/plan-rediseno.md`](plan-rediseno.md) — plan rediseño UX (cerrado tras commits 7573e0c + 8187c78)

---

## Service worker

`service-worker.js` v17 — precachea `/`, `index.html`, `pricing.json`, todos los CSS, todos los JS principales (incluido `pending-meditation.js` y `pwa-install.js`), `apple-touch-icon.png`, `favicon.svg`. Bumpear versión cada vez que se cambia algo en assets cacheados.

## Observabilidad automática

- `.github/workflows/monitor-cron.yml` — cron horario que dispara `/api/monitor`. Coste $0 (GitHub Actions tier free).
- Bot Telegram `@stillova_alerts_bot` — alertas para Andrés cuando errores/calidad/ElevenLabs/LS cruzan thresholds.
- Variables sensitive en Vercel: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `MONITOR_SECRET`.
