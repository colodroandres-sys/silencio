// =============================================
//  ESTADO
// =============================================
const state = {
  mode: 'free',
  userInput: '',
  duration: '5',
  voice: 'feminine',
  gender: 'femenino',
  isPlaying: false,
  currentSec: 0,
  totalSec: 0,
  audioBlobUrl: null
};

let abortController = null;
let slowTimer = null;
let shakeInterval = null;

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
    input = document.getElementById('input-free').value.trim();
    if (!input) { shake(document.getElementById('input-free')); return; }
  } else {
    const g1 = document.getElementById('guided-1').value.trim();
    const g2 = document.getElementById('guided-2').value.trim();
    if (!g1) { shake(document.getElementById('guided-1')); return; }
    if (!g2) { shake(document.getElementById('guided-2')); return; }
    const g3 = document.getElementById('guided-3').value.trim();
    input = [g1, g2, g3].filter(Boolean).join('\n');
  }

  state.userInput = input;
  showScreen('screen-preferences');
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

  state.totalSec   = parseInt(state.duration) * 60;
  state.currentSec = 0;

  setLoadingState('normal', 'Escribiendo tu meditación', 'Analizando tu momento y diseñando algo único para ti...');
  showScreen('screen-loading');

  // Aviso de tiempo si tarda más de 10 segundos
  slowTimer = setTimeout(() => {
    document.getElementById('loading-sub').textContent = 'Esto puede tardar hasta 60 segundos. Gracias por tu paciencia.';
    slowTimer = null;
  }, 10000);

  abortController = new AbortController();
  const { signal } = abortController;

  try {
    // ── Paso 1: Generar texto con Claude ──────────────────────────
    const meditationRes = await fetch('/api/meditation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        userInput: state.userInput,
        duration: state.duration,
        voice: state.voice,
        gender: state.gender
      })
    });

    if (!meditationRes.ok) {
      const err = await meditationRes.json().catch(() => ({}));
      throw new Error(err.error || `Error ${meditationRes.status} en /api/meditation`);
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
      throw new Error(err.error || `Error ${audioRes.status} en /api/audio`);
    }

    const audioBlob = await audioRes.blob();

    if (slowTimer) { clearTimeout(slowTimer); slowTimer = null; }
    abortController = null;

    if (state.audioBlobUrl) URL.revokeObjectURL(state.audioBlobUrl);
    state.audioBlobUrl = URL.createObjectURL(audioBlob);

    connectAudio(state.audioBlobUrl);
    showScreen('screen-player');

  } catch (err) {
    if (slowTimer) { clearTimeout(slowTimer); slowTimer = null; }
    abortController = null;

    if (err.name === 'AbortError') return; // usuario canceló
    console.error('Error generando meditación:', err);
    enableGenerateBtn();
    setLoadingState('error', 'Algo salió mal', err.message || 'Revisa tu conexión e inténtalo de nuevo.');
  }
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
    audio.pause();
    state.isPlaying = false;
    wrap.classList.add('paused');
    document.getElementById('icon-play').style.display  = 'block';
    document.getElementById('icon-pause').style.display = 'none';
  } else {
    if (audio.src && audio.src !== window.location.href) {
      audio.play().then(() => {
        state.isPlaying = true;
        wrap.classList.remove('paused');
        document.getElementById('icon-play').style.display  = 'none';
        document.getElementById('icon-pause').style.display = 'block';
      }).catch(console.error);
    }
  }
}

function updateProgress() {
  const pct = state.totalSec > 0 ? (state.currentSec / state.totalSec) * 100 : 0;
  document.getElementById('progress-fill').style.width = `${pct}%`;
  document.getElementById('time-now').textContent = formatTime(state.currentSec);
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
    audio.currentTime = ratio * audio.duration;
    state.currentSec  = Math.floor(audio.currentTime);
    updateProgress();
  }
}

function handleEnd() {
  state.isPlaying  = false;
  state.currentSec = state.totalSec;
  updateProgress();
  document.getElementById('icon-play').style.display  = 'block';
  document.getElementById('icon-pause').style.display = 'none';
  document.getElementById('breathing-player').classList.add('paused');

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
  state.currentSec = 0;

  const audio = document.getElementById('audio');
  audio.pause();
  audio.removeAttribute('src');
  audio.load();

  if (state.audioBlobUrl) {
    URL.revokeObjectURL(state.audioBlobUrl);
    state.audioBlobUrl = null;
  }

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

  document.getElementById('input-free').value = '';
  document.getElementById('guided-1').value   = '';
  document.getElementById('guided-2').value   = '';
  document.getElementById('guided-3').value   = '';

  setMode('free');
  showScreen('screen-input');
}

// =============================================
//  CONECTAR AUDIO REAL
// =============================================
function connectAudio(url) {
  const audio = document.getElementById('audio');
  audio.src = url;

  audio.ontimeupdate = () => {
    if (!state.isPlaying) return;
    state.currentSec = Math.floor(audio.currentTime);
    updateProgress();
  };

  audio.onloadedmetadata = () => {
    state.totalSec = Math.floor(audio.duration);
    document.getElementById('time-end').textContent = formatTime(state.totalSec);
    updateProgress();
  };

}

// =============================================
//  UTILIDADES
// =============================================
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
