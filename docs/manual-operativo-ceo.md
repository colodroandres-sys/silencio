# Manual operativo del CEO — Stillova

> Cómo operas la empresa solo (tú + Claude) hasta que tengas tracción para contratar.
>
> Este documento son tus rituales, tus templates, tus decisiones y tus escenarios de "qué pasa si".

---

## Tu rutina diaria (15-20 min)

### Mañana (al despertar)

1. **Abre `stillova.com/admin.html`** (o /admin.html en local).
2. **Mira los 4 números clave:**
   - MAU (usuarios activos) — delta vs ayer
   - MRR (ingresos recurrentes) — delta vs ayer
   - Errores 5xx última 24h
   - ElevenLabs créditos restantes
3. **Sección "Alertas activas"** (cuando exista): si hay cualquier 🟡 o 🔴, ejecuta lo que diga. Si no entiendes, pásame screenshot.
4. **Buzón de feedback** (`/admin.html` o tabla `buzon` en Supabase): si hay nuevos, responde con template (más abajo). Tarda 5 min.
5. **Si todo OK**: pasa a contenido / marketing del día.

### Noche (~20 min antes de dormir)

1. Revisa el contenido publicado del día (TikToks, Reels, lo que sea). Anota qué hook funcionó.
2. Decisiones pendientes que solo tú puedes tomar (lista en sección abajo) — hazlas ahora.
3. Cierra Claude con un resumen de "qué se hizo hoy + qué queda" (yo lo guardo en memoria para mañana).

---

## Tu rutina semanal (1h, lunes mañana)

1. Abre Claude → ejecuta `/reporte-semanal` (custom slash command que crearé).
2. Recibirás:
   - **Cohort retention** D1/D7/D30 últimas 4 semanas
   - **Top 3 errores** sin resolver
   - **Top 5 feedback** del buzón con sentiment + sugerencia
   - **Recomendación de focus** para la semana
3. Decide: ¿qué cambia el plan? ¿qué priorizamos?
4. Si MRR cruza umbral de hiring (ver más abajo), arranca proceso.

---

## Tu rutina mensual (3-4h, último viernes del mes)

1. **Cerrar el mes financiero**:
   - Ingresos: dashboard Lemon Squeezy → "Sales" mes actual
   - Costos:
     - Anthropic console → spend
     - ElevenLabs → suscripción
     - Vercel → suscripción + add-ons
     - Supabase → suscripción
     - Clerk → suscripción
     - Lemon Squeezy → 5% + $0.50 por venta (deducido automáticamente)
     - Otros tools (Midjourney, HeyGen, etc.)
   - **Profit = Ingresos - Costos**. Anótalo en una hoja Google Sheets simple.
2. **Backups**:
   - Yo ejecuto: `supabase db dump > backups/stillova-$(date).sql` y lo subimos a tu Drive personal.
   - Tú confirmas que lo ves en Drive.
3. **Renovaciones / impuestos**:
   - Chile: tu contador procesa el SII. Tú le mandas el dump de ingresos.
   - Verificar tarjetas de las suscripciones (que no caduquen sin avisar).
4. **Legal review**:
   - ¿Hay novedad regulatoria que afecta? (GDPR, IA Act EU, etc.)
   - ¿Términos / privacidad necesitan update?
5. **Calibración del playbook**: revisar `docs/playbook-escala.md` y ajustar umbrales basado en datos reales del mes.

---

## Decisiones que solo tú tomas (NO delego en Claude)

- **Pricing**: subir/bajar precios, descuentos especiales, planes nuevos
- **Pagos a externos**: contratistas, abogados, ads, herramientas pagas
- **Comunicación pública**: tweets, prensa, LinkedIn, respuestas oficiales
- **Cambios de identidad**: nombre, logo, posicionamiento de marca
- **Cambios fundamentales de producto**: pivot, eliminar features grandes, cambiar nicho
- **Hiring / firing**
- **Decisiones legales**: responder demandas, firmar contratos, NDAs
- **Compartir métricas confidenciales** (a inversores, prensa, partners)

## Decisiones que Claude (yo) toma — te aviso después

- **Bug fixes**: identifico, corrijo, deployeo, te aviso
- **Refactors técnicos**: si no cambian comportamiento de cara al user
- **Updates de dependencias**: si los tests pasan
- **Optimizaciones de performance**: caching, índices, etc.
- **Mejoras de copy menores**: errata, micro-ajuste de tono dentro del estilo aprobado
- **A/B tests dentro de un experimento aprobado**: si tú dijiste "haz A/B de X copy", elijo variantes
- **Respuestas estándar a feedback** (si me lo apruebas en este documento): bug reports, FAQs, agradecimientos

## Decisiones grises — yo te propongo, tú decides

- Cambios de UX/UI mediano impacto (mover botones, cambiar flujo de 1 paso)
- Subidas de tier técnico ($20-100/mes)
- Cambios que afectan retention/conversion sin métricas claras
- Comunicación 1:1 a usuarios específicos (no masiva)

---

## Templates de soporte cliente

### T1 — Refund request
> Hola [nombre],
>
> Lamento que Stillova no haya cumplido con lo que esperabas. Procesé tu reembolso ahora mismo, lo verás en tu cuenta en 3-7 días hábiles.
>
> Si tienes 30 segundos, me ayudaría mucho saber qué falló — ¿la voz no convencía, las meditaciones no encajaban con tu momento, fue un cobro inesperado? Cualquier feedback me sirve para mejorar.
>
> Un abrazo,
> Andrés
> Fundador de Stillova

### T2 — Bug report
> Hola [nombre],
>
> Gracias por avisar — lo más útil ahora es saber:
> 1. Móvil o ordenador, qué navegador
> 2. Qué hiciste justo antes (escribiste el textarea, generaste, etc.)
> 3. Si puedes, screenshot
>
> Lo revisamos hoy mismo y te confirmo cuando esté arreglado.
>
> Andrés

### T3 — Solicitud GDPR (acceso a datos)
> Hola [nombre],
>
> Recibí tu solicitud. Procesamos solicitudes GDPR en máximo 72h. Te enviaré:
> - JSON con tus datos guardados (perfil, meditaciones)
> - Audio files de tus meditaciones guardadas (si las hay)
>
> Si lo que pides es **borrado total**, ten en cuenta que perderás acceso a tus meditaciones guardadas y a tu suscripción activa. ¿Confirmas que quieres borrado o solo acceso?
>
> Andrés

### T4 — Confirmación de cancelación
> Hola [nombre],
>
> Confirmo cancelación de tu suscripción. Mantienes acceso a Stillova hasta [fecha del próximo cobro que ya no se hará].
>
> Si te apetece, dime brevemente qué te llevó a cancelar — me ayuda muchísimo. Y si vuelves en el futuro, tu cuenta te espera.
>
> Andrés

### T5 — FAQ común: "¿La meditación se genera de verdad cada vez?"
> Sí. Cada meditación es generada en el momento por IA basándose en lo que escribiste. No hay biblioteca pre-grabada. Por eso si escribes lo mismo dos días, las meditaciones serán distintas — porque tu momento es distinto.

### T6 — FAQ común: "¿Por qué no hay app móvil?"
> Stillova funciona en navegador móvil exactamente igual que una app — sin instalar. Si quieres icono en home, en Safari/Chrome móvil hay opción "Añadir a pantalla de inicio". Próximamente evaluaremos app nativa cuando tengamos volumen para justificarlo.

### T7 — Quejón / hostil
> Hola [nombre],
>
> Entiendo tu frustración. Antes de responder, quiero asegurarme de entender bien qué pasó. ¿Te importa contarme qué ocurrió en orden? No te prometo solucionar todo, pero sí escuchar.
>
> Andrés

**Regla de oro**: nunca respondas a hostiles dentro de las 2 horas siguientes a recibir el mensaje. Espera. Lee de nuevo. Decide.

---

## Cuándo contratar — milestones por MRR

| MRR mensual | Quién contratas | Por qué | Costo (LATAM ~) |
|-------------|------------------|---------|------------------|
| $0-3K | **Nadie**. Tú + Claude. | Cero overhead. Validar producto | $0 |
| $3-5K | Empieza outreach pasivo (LinkedIn, comunidades) — sin contratar todavía | Adelantar candidatos para cuando llegues a $5K | $0 |
| $5-10K | **VA part-time** 10-15h/sem | Soporte cliente nivel 1, contenido programado, organización | $300-500/mes |
| $10-25K | **Community manager / content creator** part-time | Tú no escalas en contenido | $500-1500/mes |
| $25-50K | **Customer success** full-time | Volumen de soporte requiere tiempo real | $2000-3500/mes |
| $50-100K | **Ingeniero contractor** | Yo + Claude no escalamos en horas humanas (revisión de PRs, code review, decisiones técnicas profundas) | $4000-8000/mes |
| $100K+ | **Cofundador técnico / Head of Engineering** | Tú ya no puedes liderar tech sin ayuda. Equity + salario | depende |

### Antes de contratar (cualquier rol), pregúntate:

1. **¿Esta tarea se puede automatizar con Claude?** Si sí, no contrates aún.
2. **¿He documentado el proceso?** Si no, hazlo primero — sin documentación no puedes delegar.
3. **¿La persona se paga sola en 3 meses con valor generado?** Si no, no contrates.
4. **¿Tengo runway de 6 meses pagándole sin que la empresa muera?** Si no, no contrates.

### Señales tempranas de que necesitas alguien (no esperes al MRR)

- Llevas 3 semanas sin dormir bien
- Empiezas a posponer responder a usuarios > 24h
- El backlog de bugs crece más rápido que cierras
- No tuviste tiempo de mirar las métricas en 7 días

---

## Escenarios de "qué pasa si"

### Escenario A · Marketing relámpago **funciona** (1000 nuevos en 48h)
**Acciones secuenciales** (yo te guío):
1. ⚡ ElevenLabs upgrade a Pro $99 o Scale $330 según volumen estimado (paso a paso en `tareas-andres.md`)
2. ⚡ Vercel Hobby → Pro $20 (1 click)
3. ⚡ Activar Supabase Connection Pooler (paso a paso en `tareas-andres.md`)
4. 🔍 Yo monitorizo costos Anthropic (pueden subir a $50/día rápido)
5. 🛡️ Yo activo Vercel BotID si hay signups sospechosos
6. 📞 Tú prepara mentalmente que vas a tener +20 emails de soporte/día — usa los templates

### Escenario B · Marketing **flopea** (< 50 users en 1 semana)
1. 🛑 Pausa cualquier ad spend
2. 🔍 Análisis del embudo: ¿dónde caen? (PostHog → funnels)
3. 🧪 A/B test del onboarding o del hook de marketing
4. 🔄 Iterar 1 cosa por semana, no 5

### Escenario C · Bug crítico en producción (app caída o flujo principal roto)
1. 📣 Avísame inmediato (Telegram/Slack/email)
2. ⏪ Yo ejecuto `vercel rollback` al último deploy ok
3. 📧 Yo redacto email a usuarios afectados (tú apruebas y firmas)
4. 📝 Postmortem en `docs/incidents/YYYY-MM-DD-titulo.md`

### Escenario D · Demanda legal / cease & desist
1. 🚫 **NO respondas inmediatamente. Nunca.**
2. 📷 Captura todo (emails, comunicaciones)
3. ⚖️ Busca abogado en Chile especializado en software/SaaS — pregunta en grupo de founders
4. 🔒 Avísame y entramos en lock-down: cero cambios públicos hasta que abogado dé luz verde

### Escenario E · Violación de datos / breach
1. 🚨 Aislar el sistema afectado (yo, en minutos)
2. 🔑 **Rotar TODAS las API keys** (Anthropic, ElevenLabs, Clerk, Supabase, LS, Vercel) — tú las generas, yo las pongo en Vercel
3. 📧 Notificar usuarios afectados en máximo **72h** (obligación GDPR)
4. 📝 Postmortem público en `stillova.com/incidents/YYYY-MM-DD`
5. ⚖️ Reportar a autoridad de datos si aplica (Chile: Consejo para la Transparencia / España: AEPD si afecta usuarios EU)

### Escenario F · Chargebacks > 2% de ventas
1. 🛑 Pausa nuevos pagos en LS dashboard
2. 🔍 Yo investigo: ¿UX confuso? ¿bot? ¿scam?
3. 📝 Yo ajusto copy + checkout (más claro: precio, recurrencia, cómo cancelar)
4. ⚠️ Si persiste, **Lemon Squeezy puede congelar la cuenta** — riesgo crítico para el negocio

### Escenario G · Anthropic / ElevenLabs / Clerk te bloquean la cuenta sin previo aviso
**Probabilidad baja pero existe.** Causas típicas: pago fallido, ToS violation percibido, abuso detectado.
1. ✋ La app deja de generar / autenticar instantáneamente
2. 📧 Yo redacto email apelando + tú lo envías
3. ⏱️ **Mientras**: si es Anthropic → fail-soft activado, mensaje a usuarios "estamos a tope". Si es Clerk → loop infinito de error, hay que tirar feature de auth temporal.
4. 🔄 Plan B en cada caso:
   - **Anthropic** caído: bajar a Sonnet via Vercel AI Gateway (failover)
   - **ElevenLabs** caído: rate limit + cola
   - **Clerk** caído: lock signups, mantener sesiones existentes

### Escenario H · Empieza a aparecer competencia clonando Stillova
1. 😌 Es señal de que tu idea valía. No entres en pánico.
2. 🔍 Análisis: ¿qué hicieron mejor que tú? ¿qué hicieron peor?
3. 🚀 Acelera lo que sea diferenciador (probablemente: profundidad emocional + voces premium + memoria entre sesiones)
4. 🚫 No bajes precios reactivamente — eso es carrera al fondo

### Escenario I · Te quedas sin runway (< 3 meses de cash)
1. 📉 Pausa todo gasto no esencial (tools, ads, suscripciones premium)
2. ⏰ Define "kill switch": si en 60 días no pasas X de MRR, pivotas o cierras
3. 💼 Decisión: vender / fundraise / consultoría temporal mientras Stillova crece
4. 🤐 No hagas público que tienes problemas — perderás credibilidad ante usuarios y partners

### Escenario J · Ola masiva de feedback negativo (Twitter / TikTok thread)
1. ⏸️ Espera 1 hora antes de responder. **Siempre**.
2. 📖 Lee TODO el thread. Identifica el núcleo (¿es bug? ¿UX? ¿marketing engañoso? ¿precio?).
3. ✍️ Respuesta:
   - Si fue tu culpa: reconoce, explica qué arreglas, fecha. Sin excusas.
   - Si es malentendido: aclara con datos, sin tono defensivo.
   - Si es troll: **no respondas en absoluto.**
4. 📝 Si fue legítimo, postmortem público en `/incidents`.

---

## Lo que NO debes hacer (errores comunes de founders)

- ❌ Subir precios "porque sí" sin testear A/B
- ❌ Responder a todos los emails de soporte personalmente cuando MRR > $10K (delega a VA)
- ❌ Postear cuando estás cansado o emocional
- ❌ Decirle "sí" a todo partner / influencer / ad agency que te contacta sin filtro
- ❌ Ofrecer descuentos individuales personalizados (escala mal, crea precedente)
- ❌ Hacer features porque 1 user "muy importante" lo pidió — solo si 30 lo piden
- ❌ Pivotar producto antes de los primeros $10K MRR — todavía no validaste suficiente
- ❌ Despedir tools / proveedores sin migración planeada (típico: cambiar Stripe a LS sin testear E2E)
- ❌ Hablar de números públicamente antes de que sean orgullosos sostenidos

---

## Tu lista mínima de tools / cuentas que mantener

| Tool | Para qué | Backup si cae |
|------|----------|---------------|
| Vercel | Hosting + API | — (lo más crítico, paga siempre) |
| Anthropic | Claude API | Vercel AI Gateway con failover a OpenAI |
| ElevenLabs | Voces | OpenAI TTS (peor calidad, último recurso) |
| Clerk | Auth | NextAuth o Auth0 (migración 1-2 días) |
| Supabase | DB | Postgres directo en Render/Railway |
| Lemon Squeezy | Pagos | Paddle / Stripe (cuando seas residente fiscal con empresa) |
| PostHog | Analytics | Mixpanel / Amplitude |
| Upstash | Rate limit | Redis Cloud directo |
| Namecheap | Dominio | Cloudflare Registrar |
| Google Workspace | Email + Drive + Calendar | — (irreemplazable) |
| Github | Código | GitLab / Bitbucket |

**Backup mental**: si cualquier proveedor te bloquea sin previo aviso, ya sabes el plan B.
