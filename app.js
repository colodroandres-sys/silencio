// =============================================
//  ESTADO
// =============================================
const state = {
  mode: 'free',
  userInput: '',
  userName: '',
  duration: '5',
  voice: 'feminine',
  gender: 'femenino',
  isPlaying: false,
  currentSec: 0,
  totalSec: 0,
  audioBlobUrl: null,
  silenceMap: [],        // [{time, duration}] — silencios a insertar durante la reproducción
  silenceOffset: 0,     // segundos acumulados de silencio ya ejecutados
  silenceTimer: null,   // setInterval activo durante un silencio
  silenceTimeoutId: null, // setTimeout para disparar el próximo silencio con precisión
  introTimeoutId: null,  // setTimeout del intro de 3s de música antes de arrancar la voz
  ambientFadeInterval: null,
  inSilence: false      // true solo mientras dura un silencio programado
};

let abortController = null;
let slowTimer = null;
let shakeInterval = null;

// =============================================
//  SONIDO DE FONDO
// =============================================
const AMBIENT_TRACKS = [
  '/sounds/ribhavagrawal-258hz-frequency-ambient-music-meditationcalmingzenspiritual-music-319111.mp3',
  '/sounds/ribhavagrawal-417hz-frequency-ambient-music-meditationcalmingzenspiritual-music-327887.mp3',
  '/sounds/ribhavagrawal-528hz-frequency-ambient-music-meditationcalmingzenspiritual-music-292845.mp3',
  '/sounds/viacheslavstarostin-meditation-spiritual-music-471929.mp3'
];

function loadRandomAmbient() {
  const ambient = document.getElementById('audio-ambient');
  const track   = AMBIENT_TRACKS[Math.floor(Math.random() * AMBIENT_TRACKS.length)];
  ambient.src   = track;
  ambient.load();
}

function ambientPlay() {
  const ambient = document.getElementById('audio-ambient');
  if (!ambient.src || ambient.src === window.location.href) return;
  ambient.volume = 0.25;
  ambient.play().catch(() => {});
}

function ambientPause() {
  document.getElementById('audio-ambient').pause();
}

function ambientFadeOut() {
  const ambient = document.getElementById('audio-ambient');
  if (ambient.paused || !ambient.src || ambient.src === window.location.href) return;

  const startVol = ambient.volume;
  const steps    = 40; // 4 segundos, un tick cada 100ms
  let step       = 0;

  if (state.ambientFadeInterval) { clearInterval(state.ambientFadeInterval); }
  state.ambientFadeInterval = setInterval(() => {
    step++;
    ambient.volume = Math.max(0, startVol * (1 - step / steps));
    if (step >= steps) {
      clearInterval(state.ambientFadeInterval);
      state.ambientFadeInterval = null;
      ambient.pause();
      ambient.volume = 0.25; // restaurar para la próxima sesión
    }
  }, 100);
}

function ambientStop() {
  const ambient = document.getElementById('audio-ambient');
  if (state.ambientFadeInterval) { clearInterval(state.ambientFadeInterval); state.ambientFadeInterval = null; }
  ambient.pause();
  ambient.volume = 0.25;
}

// =============================================
//  NAVEGACIÓN
// =============================================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const next = document.getElementById(id);
  next.classList.add('active');
  next.scrollTop = 0;
}

// =============================================
//  PANTALLA 1 — Input
// =============================================
function setMode(mode) {
  state.mode = mode;
  document.getElementById('mode-free').classList.toggle('hidden', mode !== 'free');
  document.getElementById('mode-guided').classList.toggle('hidden', mode !== 'guided');
  document.getElementById('btn-free').classList.toggle('active', mode === 'free');
  document.getElementById('btn-guided').classList.toggle('active', mode === 'guided');
}

function goToPreferences() {
  let input = '';

  if (state.mode === 'free') {
    const el = document.getElementById('input-free');
    input = el.value.trim();
    if (!input) { shake(el); return; }
    if (input.length > 500) { showCharError(el, `Máximo 500 caracteres (tienes ${input.length})`); return; }
  } else {
    const g1 = document.getElementById('guided-1').value.trim();
    const g2 = document.getElementById('guided-2').value.trim();
    if (!g1) { shake(document.getElementById('guided-1')); return; }
    if (!g2) { shake(document.getElementById('guided-2')); return; }
    const g3 = document.getElementById('guided-3').value.trim();
    input = [g1, g2, g3].filter(Boolean).join('\n');
    if (input.length > 500) { showCharError(document.getElementById('guided-1'), `Máximo 500 caracteres en total (tienes ${input.length})`); return; }
  }

  state.userInput = input;
  state.userName  = document.getElementById('input-name').value.trim().slice(0, 50);
  showScreen('screen-preferences');
}

function showCharError(el, msg) {
  const id = el.id + '-char-error';
  let err = document.getElementById(id);
  if (!err) {
    err = document.createElement('p');
    err.id = id;
    err.style.cssText = 'color:#f87171;font-size:0.78rem;margin-top:6px;';
    el.parentNode.insertBefore(err, el.nextSibling);
  }
  err.textContent = msg;
  shake(el);
  setTimeout(() => { if (err.parentNode) err.parentNode.removeChild(err); }, 4000);
}

function shake(el) {
  if (shakeInterval) { clearInterval(shakeInterval); shakeInterval = null; }
  el.style.transform   = 'translateX(0)';
  el.style.borderColor = 'rgba(157, 98, 248, 0.6)';
  let n = 0;
  shakeInterval = setInterval(() => {
    el.style.transform = n % 2 === 0 ? 'translateX(-5px)' : 'translateX(5px)';
    n++;
    if (n >= 6) {
      clearInterval(shakeInterval);
      shakeInterval = null;
      el.style.transform = 'translateX(0)';
      setTimeout(() => { el.style.borderColor = ''; }, 800);
    }
  }, 55);
  el.focus();
}

// =============================================
//  PANTALLA 2 — Preferencias
// =============================================
function selectPill(el, groupId, key) {
  document.querySelectorAll(`#${groupId} .pill`).forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  state[key] = el.dataset.value;
}

// =============================================
//  GENERACIÓN — llamadas a la API
// =============================================
function enableGenerateBtn() {
  const btn = document.getElementById('btn-generate');
  if (btn) btn.disabled = false;
}

function cancelGeneration() {
  if (abortController) { abortController.abort(); abortController = null; }
  if (slowTimer) { clearTimeout(slowTimer); slowTimer = null; }
  enableGenerateBtn();
  showScreen('screen-preferences');
}

async function generateMeditation() {
  // Requiere login antes de proceder
  if (!clerk || !clerk.user) {
    pendingGeneration = true;
    clerk.openSignIn();
    return;
  }
  pendingGeneration = false;

  const btn = document.getElementById('btn-generate');
  btn.disabled = true;

  state.currentSec = 0;

  track('meditation_started', { duration: state.duration, voice: state.voice, mode: state.mode });

  setLoadingState('normal', 'Entendiéndote', 'Leyendo tu momento y creando algo solo para ti...');
  showScreen('screen-loading');

  // Aviso de tiempo si tarda más de 10 segundos
  slowTimer = setTimeout(() => {
    document.getElementById('loading-sub').textContent = 'Tu meditación está tomando forma. Solo un momento más...';
    slowTimer = null;
  }, 10000);

  abortController = new AbortController();
  const { signal } = abortController;

  try {
    await attemptGeneration(signal);
  } catch (err) {
    if (slowTimer) { clearTimeout(slowTimer); slowTimer = null; }

    if (err.name === 'AbortError') { abortController = null; enableGenerateBtn(); return; }

    // Paywall (402): mostrar modal de upgrade
    if (err.status === 402) {
      abortController = null;
      enableGenerateBtn();
      showScreen('screen-preferences');
      showPaywall();
      track('paywall_shown', { duration: state.duration, voice: state.voice });
      return;
    }

    // Errores de cliente (4xx): mostrar inmediatamente, sin reintentar
    if (err.status && err.status < 500) {
      abortController = null;
      enableGenerateBtn();
      if (err.status === 429) {
        setLoadingState('error', 'Límite alcanzado', 'Has alcanzado el límite de meditaciones por hora. Vuelve en un momento.');
      } else {
        setLoadingState('error', 'Algo salió mal', err.message || 'Revisa los datos e inténtalo de nuevo.');
      }
      return;
    }

    // Errores de servidor (5xx / red): reintento automático una sola vez
    console.warn('Primer intento fallido, reintentando...', err);
    setLoadingState('normal', 'Casi lista', 'Dando los últimos toques a tu meditación...');

    abortController = new AbortController();
    try {
      await attemptGeneration(abortController.signal);
    } catch (retryErr) {
      if (slowTimer) { clearTimeout(slowTimer); slowTimer = null; }
      abortController = null;

      if (retryErr.name === 'AbortError') { enableGenerateBtn(); return; }
      console.error('Error generando meditación (reintento):', retryErr);
      enableGenerateBtn();
      setLoadingState('error', 'Algo salió mal', retryErr.message || 'Revisa tu conexión e inténtalo de nuevo.');
    }
  }
}

async function attemptGeneration(signal) {
  // Obtener token de Clerk para las llamadas autenticadas
  const token = await getAuthToken();
  const email = await getUserEmail();
  const authHeaders = token
    ? { 'Authorization': `Bearer ${token}`, 'x-user-email': email }
    : {};

  // ── Paso 1: Generar texto con Claude ──────────────────────────
  const meditationRes = await fetch('/api/meditation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    signal,
    body: JSON.stringify({
      userInput: state.userInput,
      userName:  state.userName,
      duration: state.duration,
      voice: state.voice,
      gender: state.gender
    })
  });

  if (!meditationRes.ok) {
    const err = await meditationRes.json().catch(() => ({}));
    const error = new Error(err.error || `Error ${meditationRes.status} en /api/meditation`);
    error.status = meditationRes.status;
    throw error;
  }

  const { title, text, targetWords, silenceTotal } = await meditationRes.json();
  document.getElementById('session-title').textContent = title;

  // ── Paso 2: Convertir a audio con ElevenLabs ──────────────────
  setLoadingState('normal', 'Dando voz a tu meditación', 'Ya queda poco...');

  const audioRes = await fetch('/api/audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    signal,
    body: JSON.stringify({ text, voice: state.voice, duration: state.duration, targetWords, silenceTotal })
  });

  if (!audioRes.ok) {
    const err = await audioRes.json().catch(() => ({}));
    const error = new Error(err.error || `Error ${audioRes.status} en /api/audio`);
    error.status = audioRes.status;
    throw error;
  }

  const audioData = await audioRes.json();

  if (slowTimer) { clearTimeout(slowTimer); slowTimer = null; }
  abortController = null;

  // Convertir base64 a Blob
  const binary = atob(audioData.audioBase64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });

  if (state.audioBlobUrl) URL.revokeObjectURL(state.audioBlobUrl);
  state.audioBlobUrl   = URL.createObjectURL(audioBlob);
  state.silenceMap     = audioData.silenceMap || [];
  state.totalSec       = Math.round(audioData.totalDuration || parseInt(state.duration) * 60);
  state.silenceOffset  = 0;

  document.getElementById('time-end').textContent = formatTime(state.totalSec);

  track('meditation_generated', { duration: state.duration, voice: state.voice });

  connectAudio(state.audioBlobUrl);
  showScreen('screen-player');
}

function setLoadingState(type, title, sub) {
  document.getElementById('loading-title').textContent = title;
  document.getElementById('loading-sub').textContent = sub;
  const isError = type === 'error';
  document.getElementById('btn-retry').style.display      = isError ? 'block' : 'none';
  document.getElementById('btn-back-input').style.display = isError ? 'block' : 'none';
  document.getElementById('btn-cancel').style.display     = isError ? 'none'  : 'block';
}

function retryFromError() {
  enableGenerateBtn();
  showScreen('screen-preferences');
}

function backToInput() {
  enableGenerateBtn();
  showScreen('screen-input');
}

// =============================================
//  PANTALLA 4 — Reproductor
// =============================================
function togglePlay() {
  const audio = document.getElementById('audio');
  const wrap  = document.getElementById('breathing-player');

  if (state.isPlaying) {
    // Cancelar cualquier silencio activo o próximo
    if (state.silenceTimer) { clearInterval(state.silenceTimer); state.silenceTimer = null; }
    if (state.silenceTimeoutId) { clearTimeout(state.silenceTimeoutId); state.silenceTimeoutId = null; }
    if (state.introTimeoutId) { clearTimeout(state.introTimeoutId); state.introTimeoutId = null; }
    state.inSilence = false;
    audio.pause();
    ambientPause();
    state.isPlaying = false;
    wrap.classList.add('paused');
    document.getElementById('icon-play').style.display  = 'block';
    document.getElementById('icon-pause').style.display = 'none';
  } else {
    if (audio.src && audio.src !== window.location.href) {
      const isFirstPlay = audio.currentTime === 0;

      if (isFirstPlay) {
        // Intro de 3s: música sola antes de arrancar la voz
        ambientPlay();
        state.isPlaying = true;
        state.inSilence = false;
        wrap.classList.remove('paused');
        document.getElementById('icon-play').style.display  = 'none';
        document.getElementById('icon-pause').style.display = 'block';
        state.introTimeoutId = setTimeout(() => {
          state.introTimeoutId = null;
          if (!state.isPlaying) return;
          audio.play().then(() => { scheduleNextSilence(audio); }).catch(console.error);
        }, 3000);
      } else {
        audio.play().then(() => {
          state.isPlaying = true;
          state.inSilence = false;
          wrap.classList.remove('paused');
          document.getElementById('icon-play').style.display  = 'none';
          document.getElementById('icon-pause').style.display = 'block';
          ambientPlay();
          scheduleNextSilence(audio);
        }).catch(console.error);
      }
    }
  }
}

function updateProgress() {
  const pct = state.totalSec > 0 ? Math.min(100, (state.currentSec / state.totalSec) * 100) : 0;
  document.getElementById('progress-fill').style.width = `${pct}%`;
  document.getElementById('time-now').textContent = formatTime(Math.min(state.currentSec, state.totalSec));
}

function seekTo(event) {
  const track   = event.currentTarget;
  const rect    = track.getBoundingClientRect();
  const clientX = event.clientX !== undefined
    ? event.clientX
    : (event.touches?.[0] || event.changedTouches?.[0])?.clientX ?? 0;
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));

  const audio = document.getElementById('audio');
  if (audio.duration) {
    if (state.silenceTimeoutId) { clearTimeout(state.silenceTimeoutId); state.silenceTimeoutId = null; }
    if (state.silenceTimer) { clearInterval(state.silenceTimer); state.silenceTimer = null; }
    audio.currentTime = ratio * audio.duration;

    // Recalcular silenceOffset y flags _done según la nueva posición
    state.silenceOffset = 0;
    for (const s of state.silenceMap) {
      if (s.time < audio.currentTime) {
        s._done = true;
        state.silenceOffset += s.duration;
      } else {
        s._done = false;
      }
    }

    // Cancelar cualquier silencio activo
    if (state.silenceTimeoutId) { clearTimeout(state.silenceTimeoutId); state.silenceTimeoutId = null; }
    if (state.silenceTimer) { clearInterval(state.silenceTimer); state.silenceTimer = null; }
    state.inSilence = false;

    state.currentSec = Math.round(audio.currentTime + state.silenceOffset);
    updateProgress();

    if (state.isPlaying) {
      audio.play().then(() => { scheduleNextSilence(audio); }).catch(console.error);
    }
  }
}

function handleEnd() {
  track('meditation_completed', { duration: state.duration, voice: state.voice });
  state.isPlaying  = false;
  state.inSilence  = false;
  state.currentSec = state.totalSec;
  updateProgress();
  document.getElementById('icon-play').style.display  = 'block';
  document.getElementById('icon-pause').style.display = 'none';
  document.getElementById('breathing-player').classList.add('paused');
  ambientFadeOut();

  // Pantalla de cierre: 5 segundos antes de mostrar "Nueva meditación"
  document.getElementById('end-message').style.display        = 'block';
  document.getElementById('btn-new-meditation').style.display = 'none';

  setTimeout(() => {
    document.getElementById('end-message').style.display        = 'none';
    document.getElementById('btn-new-meditation').style.display = 'block';
  }, 5000);
}

function newMeditation() {
  state.isPlaying  = false;
  state.inSilence  = false;
  state.currentSec = 0;

  const audio = document.getElementById('audio');
  audio.pause();
  audio.removeAttribute('src');
  audio.load();

  if (state.silenceTimer) { clearInterval(state.silenceTimer); state.silenceTimer = null; }
  if (state.silenceTimeoutId) { clearTimeout(state.silenceTimeoutId); state.silenceTimeoutId = null; }
  state.silenceMap    = [];
  state.silenceOffset = 0;

  if (state.audioBlobUrl) {
    URL.revokeObjectURL(state.audioBlobUrl);
    state.audioBlobUrl = null;
  }

  // Detener sonido de fondo
  ambientStop();
  const ambientEl = document.getElementById('audio-ambient');
  ambientEl.removeAttribute('src');
  ambientEl.load();

  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('time-now').textContent = '0:00';
  document.getElementById('icon-play').style.display  = 'block';
  document.getElementById('icon-pause').style.display = 'none';
  document.getElementById('breathing-player').classList.add('paused');

  // Resetear pantalla de fin
  document.getElementById('end-message').style.display        = 'none';
  document.getElementById('btn-new-meditation').style.display = 'block';

  // Resetear pills a valores por defecto
  document.querySelectorAll('#grp-duration .pill').forEach(p => p.classList.remove('active'));
  document.querySelector('#grp-duration .pill[data-value="5"]').classList.add('active');
  state.duration = '5';

  document.querySelectorAll('#grp-voice .pill').forEach(p => p.classList.remove('active'));
  document.querySelector('#grp-voice .pill[data-value="feminine"]').classList.add('active');
  state.voice = 'feminine';

  document.querySelectorAll('#grp-gender .pill').forEach(p => p.classList.remove('active'));
  document.querySelector('#grp-gender .pill[data-value="femenino"]').classList.add('active');
  state.gender = 'femenino';


  document.getElementById('input-free').value  = '';
  document.getElementById('guided-1').value    = '';
  document.getElementById('guided-2').value    = '';
  document.getElementById('guided-3').value    = '';
  document.getElementById('input-name').value  = '';

  setMode('free');
  showScreen('screen-input');
}

// =============================================
//  CONECTAR AUDIO REAL
// =============================================
function connectAudio(url) {
  const audio = document.getElementById('audio');
  audio.src = url;
  loadRandomAmbient();

  // ontimeupdate solo actualiza la barra de progreso
  audio.ontimeupdate = () => {
    if (!state.isPlaying || state.inSilence) return;
    state.currentSec = Math.round(audio.currentTime + state.silenceOffset);
    updateProgress();
  };
}

// Programa el próximo silencio con setTimeout (precisión ~4ms vs ~250ms de ontimeupdate)
function scheduleNextSilence(audio) {
  if (state.silenceTimeoutId) { clearTimeout(state.silenceTimeoutId); state.silenceTimeoutId = null; }
  const next = state.silenceMap.find(s => !s._done);
  if (!next) return;

  const delayMs = Math.max(0, (next.time - audio.currentTime) * 1000);
  state.silenceTimeoutId = setTimeout(() => {
    state.silenceTimeoutId = null;
    if (!state.isPlaying) return;

    next._done = true;
    audio.pause();
    state.inSilence = true;
    // state.isPlaying se mantiene en true — el usuario no pausó, es un silencio programado

    let elapsed = 0;
    const tick = 250;
    state.silenceTimer = setInterval(() => {
      elapsed += tick / 1000;
      state.currentSec = Math.round(next.time + state.silenceOffset + elapsed);
      updateProgress();
      if (elapsed >= next.duration) {
        clearInterval(state.silenceTimer);
        state.silenceTimer  = null;
        state.silenceOffset += next.duration;
        state.inSilence = false;
        if (audio.ended) {
          handleEnd();
        } else {
          audio.play().then(() => {
            if (!audio.ended) {
              scheduleNextSilence(audio);
            }
          }).catch(console.error);
        }
      }
    }, tick);
  }, delayMs);
}

// =============================================
//  ANALYTICS — POSTHOG
// =============================================
function track(event, props) {
  try {
    if (window.posthog && typeof posthog.capture === 'function') {
      posthog.capture(event, props || {});
    }
  } catch (e) { /* falla silenciosamente */ }
}

// =============================================
//  UTILIDADES
// =============================================
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// =============================================
//  AUTH — CLERK
// =============================================
const CLERK_KEY = 'pk_test_cmVsYXhpbmctbGFtcHJleS03OC5jbGVyay5hY2NvdW50cy5kZXYk';
let clerk = null;
let pendingGeneration = false;

async function initClerk() {
  try {
    // Clerk v5 CDN auto-crea la instancia en window.Clerk desde el data-attribute
    // Esperamos a que esté disponible (máx 5s)
    let attempts = 0;
    while (!window.Clerk && attempts < 50) {
      await new Promise(r => setTimeout(r, 100));
      attempts++;
    }
    if (!window.Clerk) throw new Error('Clerk no cargó en 5 segundos');

    clerk = window.Clerk;
    await clerk.load();

    clerk.addListener(({ user }) => {
      updateUserStatus();
      if (user && pendingGeneration) {
        pendingGeneration = false;
        generateMeditation();
      }
    });

    updateUserStatus();
    checkUrlParams();
  } catch (e) {
    console.error('[clerk] Error de inicialización:', e);
  }
}

async function updateUserStatus() {
  const el = document.getElementById('user-status');
  if (!el) return;

  if (!clerk || !clerk.user) {
    el.style.display = 'none';
    return;
  }

  el.style.display = 'flex';
  fetchUserStatus();
}

async function fetchUserStatus() {
  if (!clerk || !clerk.user || !clerk.session) return;

  try {
    const token = await clerk.session.getToken();
    const email = clerk.user.primaryEmailAddress?.emailAddress || '';

    const res = await fetch('/api/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-user-email': email
      }
    });

    if (!res.ok) return;

    const { plan, usage, limit, canGenerate } = await res.json();

    const planEl = document.getElementById('plan-badge');
    const usageEl = document.getElementById('usage-info');

    if (planEl) {
      const planNames = { free: 'Gratis', premium: 'Premium', platinum: 'Platinum' };
      planEl.textContent = planNames[plan] || plan;
      planEl.className = `plan-badge plan-${plan}`;
    }

    if (usageEl) {
      if (plan === 'free') {
        usageEl.textContent = canGenerate ? 'Primera meditación gratis' : 'Límite alcanzado';
      } else {
        usageEl.textContent = `${usage}/${limit} este mes`;
      }
    }
  } catch (e) {
    console.error('[user status] Error:', e);
  }
}

async function getAuthToken() {
  if (!clerk || !clerk.session) return null;
  try {
    return await clerk.session.getToken();
  } catch (e) {
    return null;
  }
}

async function getUserEmail() {
  if (!clerk || !clerk.user) return '';
  return clerk.user.primaryEmailAddress?.emailAddress || '';
}

function checkUrlParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('upgraded')) {
    const plan = params.get('upgraded');
    const planNames = { premium: 'Premium', platinum: 'Platinum' };
    showToast(`¡Bienvenido a ${planNames[plan] || plan}! Ya puedes generar más meditaciones.`);
    window.history.replaceState({}, '', window.location.pathname);
    fetchUserStatus();
  }
  if (params.get('canceled')) {
    window.history.replaceState({}, '', window.location.pathname);
  }
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('visible'), 10);
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

// =============================================
//  PAYWALL
// =============================================
function showPaywall() {
  const modal = document.getElementById('paywall-modal');
  if (modal) modal.classList.add('active');
}

function closePaywall() {
  const modal = document.getElementById('paywall-modal');
  if (modal) modal.classList.remove('active');
  enableGenerateBtn();
}

async function upgradePlan(plan) {
  if (!clerk || !clerk.session) return;

  try {
    const token = await clerk.session.getToken();
    const email = await getUserEmail();

    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ plan, email })
    });

    if (!res.ok) throw new Error('Error al crear sesión de pago');

    const { url } = await res.json();
    track('checkout_started', { plan });
    window.location.href = url;
  } catch (e) {
    console.error('[checkout] Error:', e);
    showToast('Error al procesar el pago. Inténtalo de nuevo.');
  }
}

function signOut() {
  if (clerk) {
    clerk.signOut().then(() => {
      const el = document.getElementById('user-status');
      if (el) el.style.display = 'none';
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initClerk();
});
