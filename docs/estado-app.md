# Estado actual de la app — Stillova

## Archivo principal
**Un solo HTML:** `index.html` (736 líneas) — toda la app vive aquí. No hay router, no hay páginas separadas. Las pantallas se muestran/ocultan con JS.

Páginas auxiliares independientes: `dashboard.html`, `privacy.html`, `terms.html`.

---

## Pantallas (IDs en index.html)

| ID | Nombre | Cuándo se muestra |
|----|--------|-------------------|
| `screen-onboarding` | Onboarding | Primera vez que entra un usuario nuevo |
| `screen-home` | Home | Pantalla principal tras onboarding |
| `screen-create` | Crear meditación | Al pulsar "Crear meditación para mí" |
| `screen-loading` | Cargando | Mientras se genera el audio |
| `screen-player` | Reproductor | Cuando el audio está listo |
| `screen-library` | Biblioteca | Al pulsar "Biblioteca" en nav inferior |
| `paywall-modal` | Paywall | Overlay encima de cualquier pantalla |

### Flujo principal
```
Onboarding (ob-1 → ob-2 → ob-3 → ob-4 → obSkipToFree → Create)
  ↓
Home → Create → Loading → Player → End states
                                     ├── end-save (usuario con cuenta, studio)
                                     ├── end-profile (bonus meditación)
                                     ├── end-upsell (free que completó su 1 sesión)
                                     └── end-guest (sin cuenta)
```

### Pasos del onboarding (actualizado 2026-04-24)
- `ob-1` → Pantalla intro con CTA "Empezar" → llama `obNext(2)`
- `ob-2` → ¿Qué te trae? (cards multiselect: ansiedad, sueño, enfoque, reconectar, otro) → `obNext(3)`
- `ob-3` → Cómo funciona (3 pasos explicativos) → `obNext(4)`
- `ob-4` → Primera sesión, CTA "Empezar mi primera sesión" → llama `obSkipToFree()` → `showCreate()`
- El botón back del browser navega entre pasos (history.pushState en obGoToStep)
- Paywall ya NO es parte del onboarding — aparece solo cuando user free agota su crédito o pide explícitamente "Ver planes"

---

## Archivos JS — `js/` (canónicos, estos son los que se usan)

| Archivo | Responsabilidad |
|---------|----------------|
| `state.js` | Estado global de la app (usuario, créditos, config activa) |
| `utils.js` | Helpers: formatear tiempo, mostrar/ocultar elementos |
| `analytics.js` | Track de eventos con PostHog |
| `audio.js` | Control de audio principal + audio ambiente (Web Audio API) |
| `navigation.js` | `showHome()`, `showCreate()`, `openLibrary()` — navegación entre pantallas |
| `onboarding.js` | `obNext()`, `obBack()`, `obChipToggle()`, `obSelectGoal()`, `obSkipToFree()`, `obStartPlan()` |
| `create.js` | `convoRevealConfig()`, `selectPill()`, `goToGenerate()`, `onInputChange()` |
| `generation.js` | Llama a `/api/meditation` (Claude) y `/api/audio` (ElevenLabs) |
| `player.js` | `togglePlay()`, `seekTo()`, `handleEnd()`, `newMeditation()`, timer countdown |
| `gamification.js` | Racha, minutos semanales, nivel del usuario |
| `auth.js` | Clerk: `openAuth()`, `signOut()`, detección de sesión activa |
| `save.js` | `saveMeditation()`, `skipSave()` — guarda en Supabase |
| `profile.js` | `submitProfile()`, `skipProfile()` — bonus meditación post-sesión |
| `library.js` | Carga y renderiza meditaciones guardadas, filtros por emoción y duración |
| `init.js` | Inicialización: carga estado del usuario, muestra pantalla correcta al arrancar |

---

## Archivos CSS — `css/` (canónicos, estos son los que se usan)

| Archivo | Qué cubre |
|---------|-----------|
| `base.css` | Variables CSS, reset, tipografía (Fraunces + Inter), colores del sistema |
| `layout.css` | Screens, home, create, loading, elementos generales |
| `player.css` | Player, anillo SVG circular, animación breathing |
| `paywall.css` | Modal paywall, cards de planes, toggle mensual/anual |
| `dashboard.css` | Biblioteca, stats, filtros, lista de meditaciones |
| `responsive.css` | Media queries para móvil/desktop |
| `onboarding.css` | Pasos del onboarding, chips, goal cards, plan cards |

---

## API routes — `api/` (serverless en Vercel)

| Archivo | Función |
|---------|---------|
| `meditation.js` | Genera el texto de la meditación con Claude |
| `audio.js` | Genera el audio con ElevenLabs |
| `checkout.js` | Crea sesión de Stripe para pago |
| `webhook.js` | Recibe eventos de Stripe (pago completado, cancelación) |
| `user.js` | Info del usuario: plan, créditos, estado |
| `save-meditation.js` | Guarda meditación en Supabase |
| `profile-bonus.js` | Añade crédito extra al completar el perfil |
| `dashboard.js` | Datos para el dashboard admin |
| `admin.js` | Endpoints admin (solo uso interno) |
| `health.js` | Health check del servidor |
| `logs.js` | Logs internos |
| `_auth.js` | Helper interno: verificar token Clerk |
| `_limits.js` | Helper interno: verificar límites de créditos |
| `_ratelimit.js` | Helper interno: rate limiting con Upstash Redis |
| `_supabase.js` | Helper interno: cliente de Supabase |

---

## Sonidos de fondo — `sounds/`

4 archivos MP3 con frecuencias binaurales:
- `258hz` → Calma
- `417hz` → Transformación  
- `528hz` → Amor / Espiritual
- `viacheslavstarostin` → Espiritual alternativo

La selección automática ("Auto") en la config elige según el objetivo del usuario.

---

## Archivos MUERTOS — no borrar sin confirmar, pero no editar

| Archivo | Estado |
|---------|--------|
| `style.css` (raíz, 2274 líneas) | **Muerto** — no lo carga ningún HTML. Reemplazado por `css/` |
| `app.js` (raíz, 1525 líneas) | **Muerto** — no lo carga ningún HTML. Reemplazado por `js/` |

---

## Integraciones activas

| Servicio | Uso |
|----------|-----|
| **Clerk** | Auth (Google login, etc.) — clave en `index.html` |
| **Supabase** | Base de datos: usuarios, meditaciones guardadas, uso guest |
| **Stripe** | Pagos — webhooks en `/api/webhook` |
| **ElevenLabs** | Síntesis de audio de las meditaciones |
| **Claude API** | Generación del texto de cada meditación |
| **PostHog** | Analytics y tracking de eventos |
| **Upstash Redis** | Rate limiting para usuarios guest |
| **Vercel** | Hosting + serverless functions |

---

## Planes actuales (producción)

| Plan | Precio mensual | Precio anual | Créditos | Duración máx | Biblioteca |
|------|---------------|-------------|----------|--------------|------------|
| Gratis | €0 | — | 1 (para probar) | 5 min | — |
| Essential | €9,99/mes | €7,99/mes (€95,88/año) | 10/mes | 15 min | 5 guardadas |
| Premium | €19,99/mes | €15,99/mes (€191,88/año) | 25/mes | 20 min | 20 guardadas |
| Studio | €39,99/mes | €31,99/mes (€383,88/año) | 60/mes | 20 min | Ilimitada |

Conversión de créditos: 5 min = 1 cr · 10 min = 2 cr · 15 min = 3 cr · 20 min = 4 cr

Descuento primer mes: Essential €6,99 · Premium €13,99 · Studio €33,99 (solo planes mensuales)
