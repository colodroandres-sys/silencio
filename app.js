// =============================================
//  ESTADO
// =============================================
const state = {
  mode: 'free',
  userInput: '',
  duration: '5',
  voice: 'feminine',
  sound: 'rain',
  isPlaying: false,
  currentSec: 0,
  totalSec: 0,
  timer: null,
  audioBlobUrl: null
};

const SOUND_NAMES = {
  rain: 'Lluvia', ocean: 'Mar',
  forest: 'Bosque', birds: 'Pájaros', silence: 'Silencio'
};

const VOICE_NAMES = {
  feminine: 'Voz femenina',
  masculine: 'Voz masculina'
};

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
  el.style.borderColor = 'rgba(157, 98, 248, 0.6)';
  let n = 0;
  const iv = setInterval(() => {
    el.style.transform = n % 2 === 0 ? 'translateX(-5px)' : 'translateX(5px)';
    n++;
    if (n >= 6) {
      clearInterval(iv);
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

function selectSound(el) {
  document.querySelectorAll('#grp-sound .sound-card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  state.sound = el.dataset.value;
}

// =============================================
//  GENERACIÓN — llamadas a la API
// =============================================
async function generateMeditation() {
  // Actualizar info del reproductor
  document.getElementById('meta-duration').textContent = `${state.duration} min`;
  document.getElementById('meta-voice').textContent = VOICE_NAMES[state.voice];
  document.getElementById('meta-sound').textContent = SOUND_NAMES[state.sound];
  state.totalSec = parseInt(state.duration) * 60;
  state.currentSec = 0;
  document.getElementById('time-end').textContent = formatTime(state.totalSec);

  // Mostrar pantalla de carga
  setLoadingState('normal', 'Escribiendo tu meditación', 'Analizando tu momento y diseñando algo único para ti...');
  showScreen('screen-loading');

  try {
    // ── Paso 1: Generar texto con Claude ──────────────────────────
    const meditationRes = await fetch('/api/meditation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userInput: state.userInput,
        duration: state.duration,
        voice: state.voice,
        sound: state.sound
      })
    });

    if (!meditationRes.ok) {
      const err = await meditationRes.json().catch(() => ({}));
      throw new Error(err.error || `Error ${meditationRes.status} en /api/meditation`);
    }

    const { text } = await meditationRes.json();

    // ── Paso 2: Convertir a audio con ElevenLabs ──────────────────
    setLoadingState('normal', 'Creando el audio', 'Convirtiendo el texto a voz personalizada...');

    const audioRes = await fetch('/api/audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: state.voice })
    });

    if (!audioRes.ok) {
      const err = await audioRes.json().catch(() => ({}));
      throw new Error(err.error || `Error ${audioRes.status} en /api/audio`);
    }

    const audioBlob = await audioRes.blob();

    // Liberar URL anterior si existe
    if (state.audioBlobUrl) URL.revokeObjectURL(state.audioBlobUrl);
    state.audioBlobUrl = URL.createObjectURL(audioBlob);

    connectAudio(state.audioBlobUrl);
    showScreen('screen-player');

  } catch (err) {
    console.error('Error generando meditación:', err);
    setLoadingState('error', 'Algo salió mal', err.message || 'Revisa tu conexión e inténtalo de nuevo.');
  }
}

// Actualiza el texto de la pantalla de carga
function setLoadingState(type, title, sub) {
  document.getElementById('loading-title').textContent = title;
  document.getElementById('loading-sub').textContent = sub;
  document.getElementById('btn-retry').style.display = type === 'error' ? 'block' : 'none';
}

function retryFromError() {
  showScreen('screen-preferences');
}

// =============================================
//  PANTALLA 4 — Reproductor
// =============================================
function togglePlay() {
  const audio = document.getElementById('audio');
  const wrap  = document.getElementById('breathing-player');

  if (state.isPlaying) {
    audio.pause();
    clearInterval(state.timer);
    state.isPlaying = false;
    wrap.classList.add('paused');
    document.getElementById('icon-play').style.display  = 'block';
    document.getElementById('icon-pause').style.display = 'none';
  } else {
    if (audio.src && audio.src !== window.location.href) {
      audio.play().catch(console.error);
    }
    state.isPlaying = true;
    wrap.classList.remove('paused');
    document.getElementById('icon-play').style.display  = 'none';
    document.getElementById('icon-pause').style.display = 'block';
  }
}

function updateProgress() {
  const pct = state.totalSec > 0 ? (state.currentSec / state.totalSec) * 100 : 0;
  document.getElementById('progress-fill').style.width = `${pct}%`;
  document.getElementById('time-now').textContent = formatTime(state.currentSec);
}

function seekTo(event) {
  const track = event.currentTarget;
  const rect  = track.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));

  const audio = document.getElementById('audio');
  if (audio.duration) {
    audio.currentTime = ratio * audio.duration;
    state.currentSec  = Math.floor(audio.currentTime);
    updateProgress();
  }
}

function handleEnd() {
  clearInterval(state.timer);
  state.isPlaying  = false;
  state.currentSec = state.totalSec;
  updateProgress();
  document.getElementById('icon-play').style.display  = 'block';
  document.getElementById('icon-pause').style.display = 'none';
  document.getElementById('breathing-player').classList.add('paused');
}

function newMeditation() {
  clearInterval(state.timer);
  state.isPlaying  = false;
  state.currentSec = 0;

  const audio = document.getElementById('audio');
  audio.pause();
  audio.src = '';

  if (state.audioBlobUrl) {
    URL.revokeObjectURL(state.audioBlobUrl);
    state.audioBlobUrl = null;
  }

  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('time-now').textContent = '0:00';
  document.getElementById('icon-play').style.display  = 'block';
  document.getElementById('icon-pause').style.display = 'none';
  document.getElementById('breathing-player').classList.remove('paused');

  document.getElementById('input-free').value = '';
  document.getElementById('guided-1').value   = '';
  document.getElementById('guided-2').value   = '';
  document.getElementById('guided-3').value   = '';

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
    if (audio.duration) state.totalSec = Math.floor(audio.duration);
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
