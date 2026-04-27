# Tu día desde el lanzamiento — guion paso a paso

> Esto NO es un documento técnico. Es lo que vas a hacer **de verdad** desde que lancemos la campaña.
>
> Léelo entero al menos una vez. Cuando llegue el día, vuelves a este documento, y haces exactamente lo que dice. Sin improvisar. Sin pánico.

---

## Antes de lanzar — la mentalidad

Tres verdades que no son opcionales:

1. **Los primeros 7 días son ruido.** Muy poca data. No tomes ninguna decisión grande (cambiar pricing, pausar campaña, pivotar) basada en menos de 7 días de datos.
2. **No todo lo que pase mal es tu culpa.** Si la campaña no funciona, puede ser timing, canal, mensaje — diagnóstico antes que pánico.
3. **Tu trabajo es solo 3 cosas: NO romper nada · escuchar usuarios · publicar contenido.** Lo demás lo automatizo yo.

---

## Día 0 — el día del lanzamiento

### 7:30 AM — Te levantas
- **NO mires el móvil**. Vas a estar nervioso, excitado, ansioso. Eso no ayuda.
- Desayuna como cualquier día. Café o té. Como si nada importara.
- (Sí, parece tontería. Pero el founder que mira el móvil al despertar empieza el día perdiendo).

### 8:00 AM — Computador
1. Abre `https://stillova.com` en **ventana incógnito**
2. Mira que carga sin error
3. Pasa el flujo guest: textarea → genera meditación → escucha 30 segundos del audio
4. Si algo se ve raro o roto → **avísame en chat de Claude inmediato. NO publiques la campaña.**
5. Si todo OK → adelante.

### 8:30 AM — Verificación final con Claude
- Abre Claude.
- Escribe exactamente: **"Hoy es día 0 del lanzamiento. Corre los smoke tests E2E reales contra producción y dame luz verde o roja."**
- Yo corro `npx playwright test tests/pricing-prod.spec.js tests/clerk-live-smoke.spec.js tests/time-context.spec.js` (todos los smoke tests que ya tenemos).
- Si todo verde → te digo "luz verde, publica".
- Si algo falla → para todo, lo arreglamos antes.

### 9:00 AM — Publicas
- Publicas el contenido del lanzamiento que preparaste antes (rol Brand/Content).
- **A la vez en todos los canales** (TikTok + Reels + Twitter/X + LinkedIn + lo que tengas). No espacies.
- En cada post, link directo a `stillova.com` — sin landing intermedia.
- Después de publicar: **cierras todas las apps de redes sociales en el computador.** Si las dejas abiertas, vas a refrescarlas cada 2 minutos y eso te quema.

### 9:30 AM — La parte difícil: esperar
- Pon un temporizador de 30 minutos.
- **No mires métricas. No mires comentarios. Nada.**
- Haz cualquier otra cosa: leer, caminar, ducha, ordenar el escritorio.
- Esto es lo más importante de la mañana. Si te quedas mirando el dashboard, vas a tomar decisiones impulsivas.

### 10:00 AM — Primera mirada
Abre `stillova.com/admin.html` con la contraseña.

Lo que probablemente verás (frío, sin tracción previa):
- **5-50 visitantes únicos**
- **0-3 signups** (1-3% de los visitantes es lo normal)
- **0 ventas todavía** — el ciclo de decisión de pago es de horas/días, no minutos
- **0 errores 5xx** (esto es lo único que me importa que sea cero)

**Cómo interpretarlo:**
- Si ves muchos visitantes pero 0 signups → el copy del home no convence. Anota.
- Si ves 0 visitantes → el contenido no está resonando. Es lo más probable en hora 1.
- Si ves errores 5xx → **avísame YA en chat**. Yo investigo. Tú no toques nada.

### 10:00 - 13:00 — Comentarios y comunidad
- Abre los posts uno por uno.
- **Responde a cada comentario público** los primeros 100 comentarios. Cada uno. Tono humano, no corporativo. Ejemplos:
  - "Gracias por probarla 🙏"
  - "Si tienes feedback me ayuda mucho"
  - "Cuéntame si te funcionó"
- **No promociones nada en los comentarios.** No respondas con "compra el plan X". Solo conversación humana.
- Si alguien pregunta algo concreto sobre la app y no sabes la respuesta → me preguntas a mí en otra ventana, te respondo, y tú contestas allá.

### 13:00 - 14:00 — Almuerzo (NO negociable)
- **Lejos del computador.** Físicamente lejos.
- Sin móvil con redes sociales.
- Tu cabeza necesita 60 minutos de no-Stillova. Si no, llegas a la tarde quemado.

### 14:00 - 14:15 — Segunda mirada al admin
Compara con las 10 AM:
- ¿Visitantes siguen creciendo o se estancó?
- ¿Hay alguna venta?
- ¿Errores?

Anota la diferencia en una hoja física o en Notes. **Una hoja física es mejor** — te obliga a no estar en el computador todo el día.

### 14:15 - 16:00 — Buzón de feedback + decisiones del día
1. Abre tabla `buzon` en Supabase (yo te doy el link directo) o `/admin.html` si tiene la sección.
2. Lee TODO mensaje nuevo.
3. Para cada uno → consulta `docs/manual-operativo-ceo.md` sección "Templates de soporte cliente". Copia el template, ajusta el nombre, responde.
4. Si hay un bug que no entiendes → screenshot + me lo pasas. Yo investigo y arreglo.
5. Si hay queja sobre el producto/contenido (no técnica) → guárdala. Hoy no decides nada al respecto. **Hoy no decides nada al respecto.**

### 16:00 - 18:00 — Contenido para mañana
- Mira qué post de hoy funcionó mejor (más views, más reacciones).
- Mañana publicas un post **del mismo estilo pero distinto**. No idéntico, no opuesto.
- Si no funcionó nada hoy: cambia hook completamente, prueba otro ángulo. **Nuevo hook, no nuevo producto.**
- Tener 2-3 piezas listas para publicar mañana. Esto es no-negociable: si despiertas mañana sin nada listo, pierdes el día.

### 18:00 - 19:00 — Sesión Claude (opcional pero recomendada)
- Abre Claude.
- Cuéntame el día: "Hoy publiqué X, recibí Y visitantes, Z signups, 0 ventas, 2 comentarios negativos sobre [...]. Mañana quiero hacer A. ¿Tiene sentido?"
- Yo te digo si tiene sentido o si veo algo que se te escapa.
- Si te recomiendo cambiar algo del producto/UX, te lo hago en la noche (commit + deploy + smoke). Mañana ya está listo.

### 19:00 - 21:00 — VIDA
- Cena.
- Familia, pareja, amigos, lo que sea.
- **Cero stillova.com**. Cero admin. Cero comentarios.
- Esto NO es debilidad. Es supervivencia. Founders queman a los 6 meses si saltan este paso.

### 21:00 - 21:15 — Cierre del día
- Última mirada al admin.
- Anota en la hoja física:
  ```
  Día 0 — fecha
  Visitantes: ___
  Signups: ___
  Ventas: ___
  Errores 5xx: ___
  Top comentario positivo: "..."
  Top comentario negativo: "..."
  Sensación general (1-10): __
  ```
- Mándame por chat de Claude el resumen exacto de la hoja → **yo lo guardo en memoria para mañana** y para fin de mes (vamos a comparar).

### 22:00 — Desconectas
- Cero móvil después de las 22:00.
- Mañana es otro día.

---

## Días 1-3 — primera semana, incertidumbre máxima

### La rutina ya es la del día 0, pero más corta

Cada día:

| Hora | Acción | Tiempo |
|------|--------|--------|
| 8:00 | Café, computador, abre admin.html | 5 min |
| 8:05 | Mira números vs ayer (en tu hoja física) | 10 min |
| 8:15 | Buzón: responde nuevos mensajes | 15-30 min |
| 8:45 | Publica contenido preparado anoche | 5 min |
| 9:00 | Responde 30 min de comentarios | 30 min |
| 9:30 | DESCONECTAS hasta las 14:00 | — |
| 14:00 | Segunda mirada admin + buzón | 30 min |
| 14:30 | Sesión Claude si hace falta (cambios producto, ideas) | 30-60 min |
| 15:30 | Crear contenido de mañana | 1-2h |
| 17:30 | DESCONECTAS hasta las 21:00 | — |
| 21:00 | Cierre del día + chat resumen Claude | 15 min |

**Total trabajo activo**: 3-4h/día. **Si trabajas más, estás haciendo algo mal** — probablemente respondiendo 100% de comentarios o iterando sin pausa.

### Lo que SÍ haces

- Responder feedback / soporte (con templates)
- Publicar contenido cada día sin excepción (incluso fines de semana las primeras 2 semanas)
- Mirar métricas 2 veces/día (mañana, tarde)
- Reportarme el día por la noche

### Lo que NO haces (errores típicos del founder estresado)

- ❌ **Cambiar precios en día 2.** No tienes data para eso. Mínimo 7 días.
- ❌ **Cambiar el copy del paywall cada hora.** Da tiempo a que se establezca un baseline antes de iterar.
- ❌ **Responder a CADA comentario personalmente.** Pareto: responde los que tienen alta visibilidad (>100 vistas). Lo otros, like y sigue.
- ❌ **Pivotar producto.** Aún no validaste suficiente. Mínimo $5K MRR antes de pensar en pivot grande.
- ❌ **Comparar con competidores cada hora.** Si alguien comenta "esto es mejor que Calm" → bien. Si alguien comenta "Calm lo hace mejor" → ignora hoy, anota para review semanal.
- ❌ **Anunciar features que no existen.** Si la app no tiene memoria entre sesiones, no digas que sí en redes.

### Métricas a vigilar (escribir en hoja física, día a día)

| Métrica | Día 1 | Día 2 | Día 3 | ... |
|---------|-------|-------|-------|-----|
| Visitantes únicos | | | | |
| Signups | | | | |
| Ventas | | | | |
| MRR | | | | |
| Errores 5xx | | | | |
| Comentarios públicos (+ / -) | | | | |
| % vistas → signups | | | | |
| % signups → pago | | | | |

Anota a mano. **De verdad a mano.** Te obliga a leerlas, no a pasarlas por encima.

---

## Día 4-7 — ya hay datos reales, calibrando

### Domingo de la semana 1 (día 7)
- 1 hora de revisión semanal con Claude.
- Yo te muestro:
  - Cohort retention día 1 / día 7
  - Conversion paywall por canal
  - Top errores
  - Top feedback
- **Decisión a tomar (con cabeza fría)**: ¿la campaña funciona o no?

#### Funciona si:
- MAU > 200 acumulado
- Conversion guest → signup > 10%
- Conversion signup → pago > 1%
- D1 retention > 25%
- D7 retention > 10%
- Sentiment público predominantemente positivo

→ **Acción**: mantén el ritmo, sigue publicando, no cambies nada grande.

#### NO funciona si:
- Visitantes < 100 acumulado en la semana
- 0 ventas
- Sentiment negativo dominante

→ **Acción**: 1 hipótesis, 1 cambio. Por ejemplo: "los hooks de TikTok no resonan, voy a probar otro ángulo durante 7 días". UN cambio. NO cinco.

#### Está en zona gris (lo más probable):
- Visitantes 100-500
- 1-5 ventas
- Mezcla de feedback positivo y negativo

→ **Acción**: identifica el mayor cuello con Claude. Iterar UN cuello. Sigue 7 días más.

---

## Mes 2-3 — viendo si la tracción es real

A esta altura ya tienes:
- 100-1000 usuarios pagados (esperemos)
- $1K-5K MRR
- Empieza a llegar:
  - Refunds (es normal, 5-15% del primer mes)
  - Bugs raros (de uso real, no del happy path)
  - Comparaciones con Calm/Headspace en redes
  - Posibles trolls (uno o dos)
  - Ofertas de partners / influencers
  - Posibles intentos de fraude

### Tu rutina cambia un poco

| Actividad | Tiempo/día |
|-----------|-----------|
| Soporte cliente (no 5 min como en día 0, sino real) | 30 min |
| Contenido (no parar de publicar) | 1h |
| Sesión Claude (decisiones de producto, iteraciones) | 30 min |
| Business / financial / legal | 30 min |
| Tiempo libre / vida | resto |

**Total activo**: ~3h/día. Sostenible.

Si llegas constantemente a 4-5h/día activas → momento de empezar **outreach pasivo a candidatos VA** (manual-operativo-ceo.md sección hiring).

### Decisiones grandes que vienen este periodo

1. **Subir precios** (cuando MRR > $3K y conversion > 2%): probablemente sí, pequeño ajuste. Test A/B.
2. **Plan ElevenLabs Scale** (cuando ratio créditos/medds te haga ahorrar): posiblemente.
3. **Vercel Pro** (cuando llegues al límite de functions): inevitable.
4. **Empresa formal en Chile** (cuando MRR > $5K y sostenido 3 meses): para deducir gastos como empresa, no como persona natural. Habla con tu contador.
5. **Primera contratación** (VA / community manager part-time, cuando MRR > $5K): comienza outreach a $3K MRR para tener candidatos.

Estas decisiones **NO LAS TOMAS SOLO**. Cada una es sesión Claude específica con datos en mano.

---

## Lo que voy a estar haciendo YO durante todo esto

Para que entiendas mi rol:

### Cosas que hago automáticamente (cuando construyamos las fases del plan automation)

- 8 AM cada día: te llega un email con resumen ejecutivo
- Cada 15 min: chequeo el runbook, alert si algo se rompe
- Tras cada cambio de código en prod: corro smoke tests + screenshot
- Detección de abuso / bots: yo bloqueo automático

### Cosas que hago cuando me pides

- Bug fixes (te aviso cuando deployo)
- Análisis de datos: cohort, retention, funnel
- Generar variantes de copy para A/B
- Revisar feedback con sentiment + sugerir respuesta
- Auditar seguridad de un endpoint
- Ayudarte a redactar respuestas difíciles (refund, cancel, troll)
- Decidir prioridad de la semana

### Cosas que NO hago sola sin tu aprobación

- Cambiar precios o planes
- Enviar emails masivos
- Postear en redes sociales
- Dar refunds > $50
- Aceptar contratos / TOS de proveedores nuevos
- Borrar datos de usuarios
- Compartir info confidencial fuera del repo

### Cosas que tienes que hacer TÚ siempre

- Postear contenido
- Responder a feedback público (en redes, no email)
- Aprobar refunds, comunicaciones masivas, decisiones legales
- Hablar con la prensa, partners, influencers
- Hiring / firing
- Definir estrategia de la próxima semana

---

## Las 3 reglas que pegarás en la pared

1. **Las decisiones importantes no se toman cansado, ni emocionado, ni con < 7 días de datos.**
2. **El contenido es el oxígeno. Sin posts diarios = sin tráfico = sin negocio.**
3. **Dormir 7-8h no es opcional. Es operacional.**

---

## Tu día perfecto (cuando todo va bien)

Visualízalo:

> 7:30 — me levanto. Café tranquilo. Anoche cené con mi pareja sin móvil.
> 8:00 — admin.html. 50 nuevos usuarios desde ayer, 5 ventas, 0 errores. Sonrío y sigo.
> 8:15 — 3 emails de soporte, respondo con templates en 10 min.
> 8:30 — publico el TikTok de hoy. Me cierro las redes para no obsesionarme.
> 9:00 — pasea, toma aire, hace deporte. Lejos del computador.
> 14:00 — segunda mirada al admin. Sigue subiendo. Mensaje a Claude: "todo bien, dame propuesta de mejora UX para esta semana".
> 16:00 — Claude me deja un commit con un cambio que probamos. Apruebo, deploya, screenshot.
> 17:00 — grabo contenido de mañana en 1h.
> 19:00 — cena. Cero móvil. Cero stillova.
> 21:00 — 5 min anotando en la hoja del día. Mensaje a Claude resumiendo. Me voy a dormir.

**3.5h activas. El resto es vida.**

## Tu peor día (cuando algo se rompe)

> 7:00 — despierto y veo notificación de Claude: "alerta crítica, errors 5xx desde las 6 AM"
> 7:05 — abro Claude: "explícame qué pasa"
> 7:10 — yo te digo: "el deploy de anoche tiene un bug en /api/audio. Ya lo identifiqué. Ejecuto rollback?"
> 7:11 — apruebas. Yo ejecuto. App vuelve a funcionar en 2 min.
> 7:15 — emails de quejas: 4. Respondes con template T2 (bug report) personalizado: "ya está arreglado, lamento las molestias, ¿quieres que te dé un mes gratis como compensación?"
> 8:00 — publicas un post transparente: "esta mañana hubo 1h de problemas técnicos. Si te afectó, escríbeme — te compenso. Y gracias por la paciencia."
> 9:00 — el thread va bien. La gente respeta la transparencia.
> Resto del día: rutina normal, vigilando que no vuelva a pasar.

**Lo importante**: tu plan ya está escrito (manual-operativo-ceo.md → escenarios). Ejecutas frío. NO improvisas.

---

## Si te abruma — qué hacer

Si en cualquier momento sientes "esto es demasiado, no puedo":

1. **Cierra el computador 24h.** No respondas nada. El mundo no se cae.
2. **Mensaje a Claude**: "necesito reset, abrúmame menos, simplifícame el día". Yo te quito carga.
3. **Recuerda**: hay founders que tardaron 3 años en llegar a $10K MRR. No es sprint, es maratón.

---

## Cómo usar este documento

- **La noche anterior al lanzamiento**: lee TODO el documento de un tirón. Una vez.
- **El día del lanzamiento**: ten esta página abierta en una pestaña. Mira la hora actual y sigue el guion.
- **Días siguientes**: misma rutina, ajustada con la tabla de horarios "Días 1-3".
- **Cuando algo sale mal**: ve a la sección "Tu peor día" + a `manual-operativo-ceo.md` sección escenarios.
- **Una vez al mes**: relee el documento entero. Las 3 reglas se olvidan rápido.

---

## Última cosa

El éxito o fracaso de la campaña NO depende del dashboard. Depende de:
- Que publiques contenido todos los días (los primeros 30 días sin saltar uno)
- Que respondas con humanidad, no con plantillas frías
- Que no te derrumbes el primer día malo
- Que duermas
- Que confíes en el plan que ya escribimos

Yo me encargo del resto.
