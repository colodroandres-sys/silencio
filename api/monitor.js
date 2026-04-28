// Vercel serverless function
// Monitor automático de calidad/salud. Disparado por cron externo (GitHub Actions)
// cada hora con header `x-monitor-secret`. Ejecuta 4 checks en paralelo y manda
// alertas a Telegram si alguno cruza thresholds.
//
// Checks:
//  1) Errores 5xx — query a tabla error_log Supabase. Threshold:
//       a) >3 errores en 1h (absoluto)
//       b) >8% de generaciones con error en 30min, mín 3 generaciones (porcentaje)
//  2) Calidad LLM-judge — toma N samples de Redis, evalúa con Claude Sonnet,
//     detecta patrones (>10% misma categoría de problema). Marca como evaluadas.
//  3) ElevenLabs créditos restantes — alerta si <30% (semanal), <15% (urgente),
//     <5% (cada hora). Estado se persiste en Redis para no spamear.
//  4) Refunds/chargebacks LS — placeholder hasta LS aprobado en live.

const { sendTelegramAlert } = require('./_telegram');
const { getSupabase } = require('./_supabase');

const { Redis } = (() => { try { return require('@upstash/redis'); } catch(e) { return {}; } })();
let _redis;
function getRedis() {
  if (!_redis && Redis && process.env.UPSTASH_REDIS_REST_URL) {
    _redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
  }
  return _redis;
}

// ─── Thresholds ─────────────────────────────────────────────────────────────
const TH = {
  errors5xx: {
    absolute1h: 3,                  // >3 errores en 1h
    percent30min: 0.08,             // >8% de generaciones con error
    minGenerations30min: 3,         // mínimo de generaciones para considerar %
  },
  judge: {
    minSamplesToAlert: 5,           // no alertar con <5 samples (ruido)
    patternPercent: 0.10,           // >10% de samples con mismo tag → alerta
    maxBatchSize: 30,               // procesar hasta 30 samples por corrida
  },
  elevenlabs: {
    warnAt: 0.30,                   // <30% restante → aviso semanal
    urgentAt: 0.15,                 // <15% → aviso diario
    criticalAt: 0.05,               // <5% → cada hora
  }
};

// ─── Check 1: Errores 5xx ───────────────────────────────────────────────────
async function checkErrors5xx() {
  try {
    const db = getSupabase();
    const oneHourAgo  = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const halfHourAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const [{ data: errors1h }, { data: errors30m }] = await Promise.all([
      db.from('error_log').select('id, endpoint, status, message, created_at').gte('created_at', oneHourAgo).gte('status', 500).order('created_at', { ascending: false }),
      db.from('error_log').select('id, endpoint, status, message, created_at').gte('created_at', halfHourAgo).gte('status', 500),
    ]);

    const count1h  = (errors1h  || []).length;
    const count30m = (errors30m || []).length;

    // Generaciones en últimos 30min para calcular % (Redis logs incluye guests)
    let generations30m = 0;
    try {
      const r = getRedis();
      if (r) {
        const raw = await r.lrange('silencio:logs', 0, 199);
        const cutoff = Date.now() - 30 * 60 * 1000;
        for (const entry of raw) {
          const e = typeof entry === 'string' ? JSON.parse(entry) : entry;
          if (e.ts && new Date(e.ts).getTime() >= cutoff) generations30m++;
        }
      }
    } catch (_) {}

    const alerts = [];
    if (count1h > TH.errors5xx.absolute1h) {
      const top = (errors1h || []).slice(0, 3).map(e => `• \`${e.endpoint}\` ${e.status} — ${(e.message || '').slice(0, 80)}`).join('\n');
      alerts.push(`🔴 *Pico errores 5xx — ${count1h} en 1h* (umbral: ${TH.errors5xx.absolute1h})\n${top}`);
    }
    if (generations30m >= TH.errors5xx.minGenerations30min && count30m > 0) {
      const pct = count30m / Math.max(generations30m, 1);
      if (pct > TH.errors5xx.percent30min) {
        alerts.push(`🟠 *Tasa errores alta — ${count30m}/${generations30m} (${(pct*100).toFixed(0)}%) en 30min* (umbral: ${(TH.errors5xx.percent30min*100).toFixed(0)}%)`);
      }
    }
    return { alerts, meta: { count1h, count30m, generations30m } };
  } catch (e) {
    return { alerts: [], error: e?.message || String(e) };
  }
}

// ─── Check 2: LLM-judge calidad ─────────────────────────────────────────────
const JUDGE_SYSTEM_PROMPT = `Eres un evaluador de calidad de meditaciones guiadas generadas por AI.

Recibes una meditación generada y debes detectar problemas. Devuelves JSON estricto.

Tags posibles (usa SOLO estos):
- name_mispronounced: el nombre suena raro o es claramente basura ("anacanvacom", "x123", letras random)
- name_used_when_empty: se usa un nombre cuando userName está vacío
- name_missing_when_provided: el userName tiene valor pero el texto no lo usa
- incoherent_with_input: el texto no refleja el estado emocional descrito en userInput
- therapeutic_phrase: contiene frases prohibidas tipo "entiendo que te sientas...", "es válido que...", "es normal sentir..."
- starts_with_particle: un segmento empieza con palabra de 1-2 sílabas (Te, Me, Se, Lo, La, Y, A...)
- frase_corta_suelta: alguna frase es de menos de 4 palabras y suelta
- texto_demasiado_corto: el texto es notoriamente corto para la duración
- texto_demasiado_largo: pasa el límite de palabras
- silencio_excesivo: marcadores de silencio claramente excesivos
- prompt_filtration: hay palabras de instrucciones del sistema filtradas en el output
- otra: otro problema notable (descríbelo en evidence)

Severity:
- high: bug visible al user, riesgo de queja/refund
- medium: imperfección notable
- low: detalle menor

Formato de respuesta (JSON estricto, sin markdown, sin explicación extra):
{"issues":[{"tag":"...","severity":"high|medium|low","evidence":"<frase concreta o motivo, máx 120 chars>"}],"overall":"ok|minor_issues|major_issues"}

Si no hay issues: {"issues":[],"overall":"ok"}`;

async function evaluateOneSample(sample) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) return null;

    const userMsg = [
      `userInput: """${sample.userInput || ''}"""`,
      `userName: "${sample.userName || ''}"`,
      `duration: ${sample.duration} min`,
      `voice: ${sample.voice}`,
      `intent: ${sample.intent || 'n/a'}`,
      `emotionTag: ${sample.emotionTag || 'n/a'}`,
      `targetWords: ${sample.targetWords}`,
      `silenceTotal: ${sample.silenceTotal}s`,
      ``,
      `=== TEXTO GENERADO ===`,
      sample.text || ''
    ].join('\n');

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: AbortSignal.timeout(30000),
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        system: [{ type: 'text', text: JUDGE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userMsg }]
      })
    });

    if (!resp.ok) {
      console.error('[monitor:judge] anthropic error:', resp.status);
      return null;
    }
    const data = await resp.json();
    const txt = (data?.content?.[0]?.text || '').trim();
    const jsonMatch = txt.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('[monitor:judge] eval failed:', e?.message || e);
    return null;
  }
}

async function checkJudgeQuality() {
  try {
    const r = getRedis();
    if (!r) return { alerts: [], reason: 'no_redis' };

    const keys = await r.keys('judge:pending:*');
    if (!keys || keys.length === 0) return { alerts: [], meta: { samples: 0 } };

    const batch = keys.slice(0, TH.judge.maxBatchSize);
    const samples = [];
    for (const key of batch) {
      try {
        const raw = await r.get(key);
        if (!raw) continue;
        const sample = typeof raw === 'string' ? JSON.parse(raw) : raw;
        samples.push({ key, sample });
      } catch (_) {}
    }

    if (samples.length === 0) return { alerts: [], meta: { samples: 0 } };

    // Evalúa en paralelo limitado (max 5 a la vez para no saturar)
    const results = [];
    for (let i = 0; i < samples.length; i += 5) {
      const slice = samples.slice(i, i + 5);
      const evals = await Promise.all(slice.map(s => evaluateOneSample(s.sample)));
      slice.forEach((s, idx) => results.push({ ...s, eval: evals[idx] }));
    }

    // Agregación de tags
    const tagCounts = {};
    const tagExamples = {};
    let highSeverityCount = 0;
    for (const r of results) {
      const issues = r.eval?.issues || [];
      for (const issue of issues) {
        if (!issue.tag) continue;
        tagCounts[issue.tag] = (tagCounts[issue.tag] || 0) + 1;
        if (!tagExamples[issue.tag]) tagExamples[issue.tag] = [];
        if (tagExamples[issue.tag].length < 2) {
          tagExamples[issue.tag].push(`• "${(issue.evidence || '').slice(0, 100)}" (input: ${(r.sample.userInput || '').slice(0, 50)})`);
        }
        if (issue.severity === 'high') highSeverityCount++;
      }
    }

    const alerts = [];
    if (results.length >= TH.judge.minSamplesToAlert) {
      for (const [tag, count] of Object.entries(tagCounts)) {
        const pct = count / results.length;
        if (pct > TH.judge.patternPercent) {
          const examples = (tagExamples[tag] || []).join('\n');
          alerts.push(`⚠️ *Patrón de calidad: ${tag}* — ${count}/${results.length} (${(pct*100).toFixed(0)}%) muestras\n${examples}`);
        }
      }
    }

    // Marca samples como evaluados (mueve a evaluated:* con TTL 30 días para historial)
    const cleanupTtl = 30 * 24 * 60 * 60;
    for (const r of results) {
      try {
        if (r.eval) {
          await getRedis().set(`judge:evaluated:${r.sample.id}`, JSON.stringify({ sample: r.sample, eval: r.eval, evaluatedAt: new Date().toISOString() }), { ex: cleanupTtl });
        }
        await getRedis().del(r.key);
      } catch (_) {}
    }

    return { alerts, meta: { samples: results.length, tags: tagCounts, highSeverity: highSeverityCount } };
  } catch (e) {
    return { alerts: [], error: e?.message || String(e) };
  }
}

// ─── Check 3: ElevenLabs créditos ──────────────────────────────────────────
async function checkElevenLabsCredits() {
  try {
    const adminKey = process.env.ELEVENLABS_ADMIN_KEY || process.env.ELEVENLABS_API_KEY;
    if (!adminKey) return { alerts: [], reason: 'no_admin_key' };

    const res = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
      headers: { 'xi-api-key': adminKey }
    });
    if (!res.ok) return { alerts: [], error: `EL ${res.status}` };
    const data = await res.json();

    const used  = data.character_count ?? 0;
    const limit = data.character_limit ?? 1;
    const remaining = limit - used;
    const pctRemaining = remaining / limit;

    const alerts = [];
    const r = getRedis();
    const lastAlertKey = 'monitor:el_last_alert_level';
    const lastLevel = r ? await r.get(lastAlertKey) : null;

    let level = null;
    if (pctRemaining < TH.elevenlabs.criticalAt) level = 'critical';
    else if (pctRemaining < TH.elevenlabs.urgentAt) level = 'urgent';
    else if (pctRemaining < TH.elevenlabs.warnAt) level = 'warn';

    // Solo alertar si subió de nivel o si es critical (que se manda cada hora)
    const shouldAlert = level === 'critical' || (level && level !== lastLevel);
    if (shouldAlert) {
      const remain = remaining.toLocaleString();
      const pct = (pctRemaining * 100).toFixed(1);
      const emoji = level === 'critical' ? '🚨' : level === 'urgent' ? '🟠' : '🟡';
      alerts.push(`${emoji} *ElevenLabs ${level.toUpperCase()}* — ${pct}% restante (${remain} chars). Plan: ${data.tier || '?'}. Renueva ${data.next_character_count_reset_unix ? `<t:${data.next_character_count_reset_unix}:R>` : '?'}`);
      if (r) await r.set(lastAlertKey, level, { ex: 7 * 24 * 60 * 60 });
    } else if (!level && lastLevel) {
      // Volvimos a OK tras un upgrade — limpiar
      if (r) await r.del(lastAlertKey);
    }

    return { alerts, meta: { used, limit, pctRemaining, level } };
  } catch (e) {
    return { alerts: [], error: e?.message || String(e) };
  }
}

// ─── Check 4: Refunds/chargebacks LS (placeholder hasta LS aprobado) ───────
async function checkLSRefunds() {
  if (!process.env.LEMONSQUEEZY_API_KEY) return { alerts: [], reason: 'no_ls_key' };
  // TODO cuando LS apruebe live mode: query GET /v1/refunds últimos 7 días
  // y GET /v1/disputes para chargebacks. Threshold:
  // - 1 chargeback → alerta inmediata
  // - >2% de refunds en 7d → alerta
  return { alerts: [], reason: 'ls_in_test_mode' };
}

// ─── Endpoint principal ────────────────────────────────────────────────────
module.exports = async (req, res) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth: header secreto compartido con el cron externo
  const secret = req.headers['x-monitor-secret'];
  if (!secret || secret !== process.env.MONITOR_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const startedAt = Date.now();

  // Ejecuta los 4 checks en paralelo
  const [errors, judge, elevenlabs, ls] = await Promise.all([
    checkErrors5xx(),
    checkJudgeQuality(),
    checkElevenLabsCredits(),
    checkLSRefunds()
  ]);

  const allAlerts = [...errors.alerts, ...judge.alerts, ...elevenlabs.alerts, ...ls.alerts];

  if (allAlerts.length > 0) {
    const header = `🔔 *Stillova Monitor — ${allAlerts.length} alerta${allAlerts.length === 1 ? '' : 's'}*\n_${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}_`;
    const body = allAlerts.join('\n\n');
    await sendTelegramAlert(`${header}\n\n${body}`);
  }

  return res.status(200).json({
    ok: true,
    elapsedMs: Date.now() - startedAt,
    alertsSent: allAlerts.length,
    checks: { errors: errors.meta || errors, judge: judge.meta || judge, elevenlabs: elevenlabs.meta || elevenlabs, ls: ls.meta || ls }
  });
};
