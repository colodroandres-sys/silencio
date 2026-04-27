# Sacarle 100% al plan Max ($200/mes) — Plan de automatización

> Pagas $200/mes por Claude Code. Hoy lo usas como "asistente de programación cuando me siento". Puedes hacer que trabaje SOLO mientras tú no estás. Esto es el plan.

---

## Qué tienes hoy (capacidades que probablemente no usas)

### 1. Routines / agentes scheduled (Claude trabaja en cron)
Yo puedo crear tareas programadas que se ejecutan en cloud sin tu intervención. Ejemplos: "todos los días a las 8am, lee Supabase, calcula MAU/MRR, mándame email con resumen".

### 2. Hooks (eventos automáticos en tu Claude Code local)
Cuando ocurre X, ejecuta Y. Ej: "cada vez que termino una sesión de Claude, hago un commit con un resumen".

### 3. Slash commands custom
Tú escribes `/reporte-diario` en Claude → ejecuta una rutina compleja con un click.

### 4. Subagentes en paralelo
Mientras hablamos de una cosa, yo puedo lanzar otro Claude en background haciendo otra (auditando, buscando bugs, generando copy).

### 5. MCP servers (Claude conectado a sistemas externos)
- Vercel MCP → ya conectado
- Gmail MCP → ya conectado (puedo leer y redactar emails)
- Calendar MCP → ya conectado
- Drive MCP → ya conectado
- GitHub → ya conectado vía gh CLI
- Supabase MCP → instalable

### 6. Vercel Sandbox + Workflow
Para tareas largas (procesar feedback, generar reportes pesados) que no caben en una sesión normal.

### 7. Vercel AI Gateway
Si quieres añadir AI a la app sin acoplarte a un solo proveedor.

---

## Plan de implementación — orden recomendado

### Fase 0 (HOY · ya hecho)
- ✅ Runbook de escala documentado
- ✅ Manual operativo CEO documentado
- ✅ Smoke tests con Clerk live + pricing

### Fase 1 (próxima sesión, ~1h) — la victoria fácil
**`/reporte-diario`** ejecutándose cada día a las 8 AM Santiago, mandándote email con:
- MAU delta vs ayer
- MRR delta vs ayer
- Errores 5xx última 24h
- ElevenLabs créditos %
- Anthropic gasto del día anterior
- Vercel function count
- Top 3 feedback nuevos del buzón con sentiment
- **Alertas activas** del runbook (cualquier 🟡 o 🔴)
- **1 acción recomendada del día**

**Por qué primero**: alto valor + bajo riesgo + valida que la pipeline de routines funciona.

**Costo**: 0$ extra (incluido en tu $200/mes Claude Max + cron Vercel ya gratis).

### Fase 2 (~2h) — alertas en tiempo real
**Cron Vercel cada 15 min** que llama a `/api/admin/health-check`. Compara contra umbrales del runbook. Si cualquier 🟡 o 🔴 se cruza:
- Manda push notification (Telegram bot o email urgente)
- Marca alerta como "activa" en `/admin.html`

**Por qué segundo**: te libera de tener que mirar el dashboard. Te interrumpe solo cuando importa.

### Fase 3 (~3h) — dashboard de alertas en `/admin.html`
**Nueva sección en admin** que muestra:
- Estado actual de cada termómetro (verde/amarillo/rojo)
- Acción recomendada por cada uno en estado no-verde
- Histórico de alertas últimos 7 días
- "Próximos cambios proyectados" (ej: "a este ritmo, ElevenLabs se acaba en 4 días")

**Por qué tercero**: replica info del email pero in-context cuando entras al admin.

### Fase 4 (~2h cada uno) — slash commands de operación

#### `/reporte-semanal` (lunes 9am)
- Cohort retention D1/D7/D30 últimas 4 semanas
- Top errors sin resolver
- Top feedback con sentiment + sugerencia de respuesta
- Recomendación de focus de la semana

#### `/buzon`
Cuando lo invocas: yo reviso buzón nuevo, te muestro:
- Top 5 sentimientos / temas
- Sugerencia de respuesta para cada uno (templates)
- Tú apruebas → yo respondo via Gmail MCP

#### `/idea-contenido`
- Lee top feedback + top searches en TikTok sobre meditación
- Te da 3 hooks (15 segundos cada uno) para grabar hoy
- Con CTA implícito alineado con tu tesis de positioning

#### `/qa-rapido`
- Corre los smoke tests E2E (pricing + Clerk + meditación) contra prod
- Reporte en 5 min

#### `/check-runbook`
- Manual: chequea cada termómetro AHORA, no espera al cron
- Útil cuando intuís que algo raro

#### `/facturacion`
- Resume entradas LS últimos 7d / 30d
- Costos del periodo (Anthropic, ElevenLabs, Vercel, etc.)
- Profit
- Forecast de fin de mes

### Fase 5 (~4h) — automatización de soporte cliente

**`/responder-buzon-auto`**:
1. Yo leo cada feedback nuevo
2. Clasifico: bug / feature request / refund / FAQ / queja
3. Genero respuesta usando templates de `manual-operativo-ceo.md`
4. **Tú apruebas con un click** → yo respondo via Gmail MCP
5. Si no estás seguro, yo lo dejo en cola "requiere tu input"

**Esto te ahorra ~30 min/día** cuando MRR sube.

### Fase 6 (~3h) — guardián de seguridad

**Subagente en background** que cada hora:
- Lee logs de auth (Clerk + /api/_auth)
- Detecta patrones sospechosos (multiples 401, signups bot, scraping)
- Si detecta → block automático en Vercel firewall + alert a ti

### Fase 7 (~6h, post-tracción) — agente de growth

**`/growth-experimentos`**:
- Cada lunes propone 2 experimentos A/B basados en datos reales
- Tú apruebas uno
- Yo lo implemento (cambia copy, layout, pricing display, etc.)
- Mide automáticamente y reporta al final de la semana

---

## Lo que NO debe hacer Claude (límites duros)

- ❌ Cobrar / cambiar pricing en LS sin tu aprobación EXPLÍCITA cada vez
- ❌ Enviar emails masivos a usuarios sin que tú apruebes el contenido exacto
- ❌ Postear en redes sociales (cuentas de Stillova) sin aprobación
- ❌ Compartir info sensible / privada del negocio fuera del repo
- ❌ Aceptar términos legales (TOS de proveedores nuevos, etc.)
- ❌ Borrar datos de usuarios sin que tú confirmes
- ❌ Aprobar refunds > $50 sin que tú confirmes
- ❌ Rotar API keys "por higiene" sin avisarte

Estos límites están grabados como **regla permanente** en mi memoria — no los voy a saltar aunque me lo pidan en una sesión sin contexto.

---

## Lo que SÍ debe hacer Claude proactivamente (sin pedir permiso)

- ✅ Bug fixes (con tests)
- ✅ Refactors que no cambian comportamiento
- ✅ Updates de dependencias si tests pasan
- ✅ Optimizaciones de performance
- ✅ Caching agresivo de prompts
- ✅ Detectar y reportar anomalías del runbook
- ✅ Mantener `docs/estado-app.md` actualizado tras cambios estructurales
- ✅ Auto-commit + auto-deploy tras cambios validados
- ✅ Smoke tests E2E tras cualquier cambio en código de producción
- ✅ Screenshot post-deploy

---

## Cuánto del $200/mes estás aprovechando hoy

**Estimación honesta:**
- **Hoy: ~25%** — me usas para coding sessions cuando llegas. Las sesiones son intensas (6-12h) pero esporádicas.
- **Tras Fase 1-3: ~60%** — yo trabajo todos los días aunque tú no abras Claude.
- **Tras Fase 4-5: ~85%** — yo automatizo soporte, contenido y reportes.
- **Tras Fase 6-7: ~95%** — yo monitorizo seguridad, propongo experimentos, manejo growth iterations.

**Beyond eso (~5%)**: cosas que solo un humano puede hacer (decisiones estratégicas, comunicación pública, hiring), que es lo que TÚ debes hacer.

---

## Costo / beneficio

| Fase | Tiempo de implementación | Tiempo que te ahorra/mes | ROI |
|------|--------------------------|---------------------------|-----|
| 1 (reporte diario) | 1h | ~5h/mes (no tener que loggear) | 5× primer mes |
| 2 (alertas push) | 2h | ~10h/mes (no monitorear) + evita incidentes | 30×+ |
| 3 (dashboard alertas) | 3h | ~3h/mes | 1× |
| 4 (slash commands) | 8h | ~20h/mes (ops repetitivas) | 2.5× |
| 5 (soporte auto) | 4h | ~15h/mes cuando MRR sube | 4×+ |
| 6 (guardián seguridad) | 3h | evita 1 incidente catastrófico | infinito |
| 7 (growth agente) | 6h | acelera iteración de producto | depende |

**Total**: ~27h de mi parte. ~50h/mes que te libero. Pagado en 1 mes.

---

## Cómo se prioriza

**Si LS NO está aprobado todavía**: Fases 1-3 (no necesitan tráfico para ser útiles).

**Si LS aprueba y vienen primeros usuarios pagos**: Fases 5 + 6 (soporte + seguridad) son las más urgentes.

**Si tracción es alta**: Fase 7 (growth) en paralelo con todo lo demás.

---

## Próximo paso

Cuando arranquemos sesión específica de "construir esto", el orden es:

1. Fase 1 (`/reporte-diario`) — la pongo en marcha en 1h. Te llega el primer reporte mañana.
2. Validamos 1 semana que funciona.
3. Fase 2 (push alerts).
4. Fases 3-7 según tracción.

El runbook (`playbook-escala.md`) y este manual son la **base de datos** de qué automatizar. Ya está escrita. La construcción es solo conectar tubería.
