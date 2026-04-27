# Playbook de escala — Stillova

> Termómetros de la app. Cada uno tiene 3 niveles (🟢 OK · 🟡 vigila · 🔴 actúa ya) con acción exacta, costo y quién lo ejecuta.
>
> Si no encuentras tu situación aquí, dímelo y la añadimos.

## Cómo se usa
- **Tú** abres este documento cuando algo se siente raro (errores, lentitud, factura alta).
- **Claude (yo)** consulta este documento cuando reviso métricas o cuando una alerta automática se dispara.
- Cualquier acción que diga "yo ejecuto" la hago sin pedir permiso. Cualquier acción que diga "tú ejecutas" la pongo en `tareas-andres.md` con paso a paso.

---

## Capacity (CTO) — la app aguanta

### 1. ElevenLabs créditos
**Métrica:** % de créditos del mes restantes.
**Cómo lo veo:** elevenlabs.io → tu panel → "Subscription".

| Nivel | Umbral | Acción | Quién | Costo |
|-------|--------|--------|-------|-------|
| 🟢 | > 50% | No hacer nada | — | — |
| 🟡 | 20-50% | Estimar consumo de la próxima semana. Si proyecta romper antes del reset → upgrade preventivo | Tú | $77 (Creator → Pro) |
| 🔴 | < 20% | Upgrade Pro $99 YA. Pasos en `tareas-andres.md` item "Subir plan ElevenLabs" | Tú | $77 |

Si baja a **< 5%**, el `fail-soft` muestra "estamos a tope, vuelve en una hora" en vez de error 502 (ya implementado en `api/audio.js`).

### 2. Vercel functions (Hobby plan)
**Métrica:** # de archivos en `/api/` que no empiezan con `_`.
**Cómo lo veo:** `ls api/ | grep -v "^_" | wc -l` (yo lo hago).

| Nivel | Conteo | Acción | Quién | Costo |
|-------|--------|--------|-------|-------|
| 🟢 | < 11 | OK | — | — |
| 🟡 | 11 (donde estamos hoy) | Cualquier endpoint nuevo fuerza salto. Antes de añadir → considerar archivo estático o consolidar dos en uno | Yo decido | — |
| 🔴 | 12 | Upgrade Vercel Pro $20/mes inevitable. Se hace en 1 click | Tú | $20/mes |

### 3. Supabase (DB + storage)
**Métrica:** % del free tier (500 MB DB · 1 GB storage).
**Cómo lo veo:** dashboard Supabase → Database → Usage.

| Nivel | Umbral | Acción | Quién | Costo |
|-------|--------|--------|-------|-------|
| 🟢 | < 50% | OK | — | — |
| 🟡 | 50-80% | Activar Connection Pooler (paso en `tareas-andres.md`) + planear Pro | Tú + yo | — (pooler gratis) |
| 🔴 | > 80% | Pro $25/mes ya. Sin esto, la DB tira errores con tráfico | Tú | $25/mes |

### 4. Clerk MAU
**Métrica:** usuarios activos del mes.
**Cómo lo veo:** clerk.com dashboard.

| Nivel | MAU | Acción | Quién | Costo |
|-------|-----|--------|-------|-------|
| 🟢 | < 5K | OK | — | — |
| 🟡 | 5-9K | Preparar paso a Pro | — | — |
| 🔴 | ≥ 10K | Pro $25/mes obligatorio (si no, signups bloqueados) | Tú | $25/mes |

### 5. Anthropic API gasto
**Métrica:** USD gastados en el día (mirar dashboard Anthropic console).

| Nivel | Gasto/día | Acción | Quién |
|-------|-----------|--------|-------|
| 🟢 | < $5 | OK | — |
| 🟡 | $5-20 | Verificar que prompt caching está activo (lo está) | Yo audito |
| 🔴 | > $20 sin justificar | Investigar abuso. Throttle por user si necesario | Yo |

---

## Quality (Producto) — la experiencia no se rompe

### 6. Latencia generación E2E
**Métrica:** p95 desde click "Generar" hasta player ready.
**Cómo lo veo:** PostHog → eventos `meditation_started` → `meditation_generated`, calcular delta.

| Nivel | p95 | Acción | Quién |
|-------|-----|--------|-------|
| 🟢 | < 60s | OK | — |
| 🟡 | 60-90s | Identificar cuello (Claude o ElevenLabs) | Yo investigo |
| 🔴 | > 90s sostenido (>1h) | Plan B: bajar a Sonnet 4.6 temporal (cambia 1 línea en `api/meditation.js`); subir tier ElevenLabs si es ahí | Yo |

### 7. Errores 5xx
**Métrica:** errors/hora vs baseline (~< 1/h en estado normal).

| Nivel | Errors/h | Acción |
|-------|----------|--------|
| 🟢 | < 5 | OK |
| 🟡 | 5-20 | Yo reviso logs (`vercel logs --prod`) |
| 🔴 | > 20 | **Rollback inmediato** del último deploy: `vercel rollback`. Yo lo ejecuto. |

### 8. Tasa de generación fallida
**Métrica:** generaciones que terminan en error (vs completadas) en últimas 24h.

| Nivel | % | Acción |
|-------|---|--------|
| 🟢 | < 2% | OK |
| 🟡 | 2-5% | Yo reviso patrones (¿hora del día? ¿plan? ¿duración?) |
| 🔴 | > 5% | Stop al marketing hasta entender. Postmortem |

---

## Money (CTO + Producto) — unit economics no se rompen

### 9. Tasa de cancelación (churn mensual)
**Métrica:** suscripciones canceladas / activas inicio del mes.

| Nivel | % | Acción |
|-------|---|--------|
| 🟢 | < 10% | OK |
| 🟡 | 10-25% | Yo recopilo `cancellation_reason` del feedback. Patrones → ajustes |
| 🔴 | > 25% | **Pausa adquisición.** Si seguimos comprando users que se van, quemamos cash |

### 10. Chargebacks / refunds
**Métrica:** chargebacks_total / órdenes_total mensual.

| Nivel | % | Acción |
|-------|---|--------|
| 🟢 | < 0.5% | OK |
| 🟡 | 0.5-1.5% | Revisar copy de checkout (claridad de precio, autorenewal) |
| 🔴 | > 2% | **Riesgo crítico.** Lemon Squeezy puede congelar la cuenta si pasamos su umbral. Pausa nuevos signups, audita fraud |

### 11. CAC vs LTV (cuando empieces a pagar ads)
**Métrica:** costo de adquisición / valor de vida del usuario.

| Nivel | Ratio | Acción |
|-------|-------|--------|
| 🟢 | LTV ≥ 3× CAC | OK, escalable |
| 🟡 | LTV 1-3× CAC | OK pero margen apretado |
| 🔴 | LTV < CAC | **Stop ads.** Estás pagando para adquirir usuarios que pierden plata |

---

## Growth (Growth) — tracción saludable

### 12. Crecimiento (signups por hora)
**Métrica:** signups en última hora vs baseline (promedio 7 días).

| Nivel | Multiplicador | Acción |
|-------|---------------|--------|
| 🟢 | 1× baseline | OK |
| 🟡 | 5× baseline | Heads up — preparar capacity para 24-48h. ElevenLabs créditos arriba, Vercel monitor |
| 🔴 | 20× baseline | **Momento crítico.** ElevenLabs Scale ($330) + Vercel Pro + Supabase pooler + Bot detection. Yo ejecuto lo que puedo, tú haces los upgrades de cuenta |

### 13. Conversion rate del paywall
**Métrica:** clicks "Pagar" / vistas paywall (PostHog).

| Nivel | Cambio vs baseline | Acción |
|-------|---------------------|--------|
| 🟢 | ±20% | OK |
| 🟡 | -30% sostenido 7 días | A/B test el copy / pricing display / order de planes |
| 🔴 | -50% o total stop | **Bug.** Yo investigo el flujo paywall → checkout LS de extremo a extremo |

---

## Security (CTO) — anomalías y abuso

### 14. Abuso por IP
**Métrica:** requests/hora por IP.

| Nivel | Req/h por IP | Acción |
|-------|--------------|--------|
| 🟢 | < 30 | OK |
| 🟡 | 30-100 | Verificar si es scraping legítimo o bot |
| 🔴 | > 100 | Block IP en Vercel firewall. Yo lo hago |

### 15. Login falso / signups bot
**Métrica:** signups con patrón sospechoso (mismo dominio email, sin actividad post-signup).

| Nivel | % de signups sospechosos | Acción |
|-------|--------------------------|--------|
| 🟢 | < 1% | OK |
| 🟡 | 1-5% | Activar Vercel BotID (gratis, GA desde junio 2025) |
| 🔴 | > 5% | Bot ataque activo. Lock signups behind hCaptcha temporal |

### 16. API keys leak / unauth access
**Métrica:** llamadas con auth fallida en /api/* > baseline.

| Nivel | Acción |
|-------|--------|
| 🟢 ≤ baseline | OK |
| 🟡 spike 5× | Yo audito source IPs, patterns |
| 🔴 spike 50× o llamadas con tokens válidos no esperados | **Rotar TODAS las keys** (paso a paso en `tareas-andres.md` item 4) |

---

## Reputational (Brand + Producto) — no nos quemamos

### 17. Sentiment de feedback
**Métrica:** % feedback negativo / total en últimas 100 entradas (`/api/buzon` data en Supabase).

| Nivel | % | Acción |
|-------|---|--------|
| 🟢 | < 10% | OK |
| 🟡 | 10-30% | Yo agrego: ¿qué tema dominante? Si es producto → ticket. Si es marketing → desalinear messaging |
| 🔴 | > 30% | Producto roto. Pausa adquisición hasta entender |

### 18. Reviews públicas (TikTok, Twitter, Reddit)
**Métrica:** menciones públicas con sentiment negativo.

| Nivel | Acción |
|-------|--------|
| 🟢 baseline | OK |
| 🟡 1-2 quejas no respondidas en 24h | Tú respondes con template "Gracias, lo investigamos" |
| 🔴 thread viral negativo | NO contestar emocionalmente. Esperar 1h. Decidir respuesta con cabeza fría |

---

## Cómo se enchufa esto al monitoreo automático

Cada termómetro tiene **fuente de datos clara** (PostHog, Supabase, Vercel, ElevenLabs panel, Clerk panel, Anthropic console). En la sesión donde construyamos el dashboard de alertas + cron de notificaciones:

1. Para cada termómetro automatizable (los que tienen API): `/api/admin/health-check.js` lee y compara contra umbrales.
2. Cron Vercel cada 15 min llama a ese endpoint.
3. Si cualquier termómetro está 🟡 o 🔴, manda email/Telegram con la fila exacta de este documento.
4. La sección "Alertas activas" en `/admin.html` muestra el resumen al cargar.

Termómetros NO automatizables (sentiment, reviews públicas) se quedan como rutina semanal manual del CEO.
