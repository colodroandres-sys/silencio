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
  const btn = document.getElementById('btn-generate');
  btn.disabled = true;

  state.currentSec = 0;

  setLoadingState('normal', 'Escribiendo tu meditación', 'Analizando tu momento y diseñando algo único para ti...');
  showScreen('screen-loading');

  // Aviso de tiempo si tarda más de 10 segundos
  slowTimer = setTimeout(() => {
    document.getElementById('loading-sub').textContent = 'Esto puede tardar hasta 2 minutos. Gracias por tu paciencia.';
    slowTimer = null;
  }, 10000);

  abortController = new AbortController();
  const { signal } = abortController;

  try {
    await attemptGeneration(signal);
  } catch (err) {
    if (slowTimer) { clearTimeout(slowTimer); slowTimer = null; }

    if (err.name === 'AbortError') { abortController = null; return; }

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
    setLoadingState('normal', 'Un momento más...', 'Estamos terminando de preparar tu meditación...');

    abortController = new AbortController();
    try {
      await attemptGeneration(abortController.signal);
    } catch (retryErr) {
      if (slowTimer) { clearTimeout(slowTimer); slowTimer = null; }
      abortController = null;

      if (retryErr.name === 'AbortError') return;
      console.error('Error generando meditación (reintento):', retryErr);
      enableGenerateBtn();
      setLoadingState('error', 'Algo salió mal', retryErr.message || 'Revisa tu conexión e inténtalo de nuevo.');
    }
  }
}

async function attemptGeneration(signal) {
  // ── Paso 1: Generar texto con Claude ──────────────────────────
  const meditationRes = await fetch('/api/meditation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

  const { title, text } = await meditationRes.json();
  document.getElementById('session-title').textContent = title;

  // ── Paso 2: Convertir a audio con ElevenLabs ──────────────────
  setLoadingState('normal', 'Creando el audio', 'Convirtiendo el texto a voz personalizada...');

  const audioRes = await fetch('/api/audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({ text, voice: state.voice })
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
    state.inSilence = false;
    audio.pause();
    ambientPause();
    state.isPlaying = false;
    wrap.classList.add('paused');
    document.getElementById('icon-play').style.display  = 'block';
    document.getElementById('icon-pause').style.display = 'none';
  } else {
    if (audio.src && audio.src !== window.location.href) {
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
//  UTILIDADES
// =============================================
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
