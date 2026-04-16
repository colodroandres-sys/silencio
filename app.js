// =============================================
//  ESTADO
// =============================================
const state = {
  userInput:   '',
  userName:    '',
  duration:    '5',
  voice:       'auto',
  music:       'auto',
  gender:      'neutro',
  intent:      null,   // 'soltar' | 'entender' | 'calmar'
  emotionTag:  null,   // 'ansiedad' | 'sueno' | 'claridad' | 'liberacion' | 'enfoque'
  userPlan:    'free',
  userCanGenerate: true,
  isPlaying:   false,
  currentSec:  0,
  totalSec:    0,
  audioBlobUrl:         null,
  currentMeditationId: null,
  silenceMap:          [],
  silenceOffset:       0,
  silenceTimer:        null,
  silenceTimeoutId:    null,
  introTimeoutId:      null,
  ambientFadeInterval: null,
  inSilence:           false,
  profileCompleted:    false,
  // gamificación
  streak:          0,
  minutesThisWeek: 0,
  totalSessions:   0,
  level:           'Inquieto'
};

// onboarding preferences (cargadas de localStorage)
const obPrefs = {
  voice:    localStorage.getItem('ob_voice')    || 'auto',
  gender:   localStorage.getItem('ob_gender')   || 'neutro',
  duration: localStorage.getItem('ob_duration') || '5',
  goal:     localStorage.getItem('ob_goal')     || null,
  topics:   JSON.parse(localStorage.getItem('ob_topics') || '[]')
};

let abortController = null;
let slowTimer       = null;
let shakeInterval   = null;
let obPreviewPlaying = false;

// =============================================
//  SONIDO DE FONDO
// =============================================
const AMBIENT_TRACKS = [
  '/sounds/ribhavagrawal-258hz-frequency-ambient-music-meditationcalmingzenspiritual-music-319111.mp3',
  '/sounds/ribhavagrawal-417hz-frequency-ambient-music-meditationcalmingzenspiritual-music-327887.mp3',
  '/sounds/ribhavagrawal-528hz-frequency-ambient-music-meditationcalmingzenspiritual-music-292845.mp3',
  '/sounds/viacheslavstarostin-meditation-spiritual-music-471929.mp3'
];

const MUSIC_MAP = {
  calma:         0,
  transformacion: 1,
  amor:          2,
  espiritual:    3
};

function loadRandomAmbient() {
  const ambient = document.getElementById('audio-ambient');
  let track;
  if (state.music === 'auto' || !(state.music in MUSIC_MAP)) {
    track = AMBIENT_TRACKS[Math.floor(Math.random() * AMBIENT_TRACKS.length)];
  } else {
    track = AMBIENT_TRACKS[MUSIC_MAP[state.music]];
  }
  ambient.src = track;
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
  const steps    = 40;
  let   step     = 0;
  if (state.ambientFadeInterval) clearInterval(state.ambientFadeInterval);
  state.ambientFadeInterval = setInterval(() => {
    step++;
    ambient.volume = Math.max(0, startVol * (1 - step / steps));
    if (step >= steps) {
      clearInterval(state.ambientFadeInterval);
      state.ambientFadeInterval = null;
      ambient.pause();
      ambient.volume = 0.25;
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
  if (next) { next.classList.add('active'); next.scrollTop = 0; }

  const nav = document.getElementById('bottom-nav');
  if (nav) {
    const hideNav = id === 'screen-loading' || id === 'screen-player' || id === 'screen-onboarding';
    nav.classList.toggle('hidden', hideNav);
  }

  const footer = document.querySelector('.site-footer');
  if (footer) footer.style.display = (id === 'screen-home') ? '' : 'none';

  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  if (id === 'screen-home') {
    document.getElementById('nav-home')?.classList.add('active');
  }
}

function showHome() {
  showScreen('screen-home');
}

function showCreate(skipToConfig = false) {
  // Aplicar preferencias de onboarding la primera vez
  if (obPrefs.voice !== 'auto' && state.userPlan !== 'free') {
    state.voice = obPrefs.voice;
    document.querySelectorAll('#grp-voice .pill').forEach(p => p.classList.remove('active'));
    document.querySelector(`#grp-voice .pill[data-value="${obPrefs.voice}"]`)?.classList.add('active');
  }
  if (obPrefs.gender !== 'neutro') {
    state.gender = obPrefs.gender;
    document.querySelectorAll('#grp-gender .pill').forEach(p => p.classList.remove('active'));
    document.querySelector(`#grp-gender .pill[data-value="${obPrefs.gender}"]`)?.classList.add('active');
  }
  if (obPrefs.duration && obPrefs.duration !== '5') {
    const allowed = state.userPlan === 'premium' || (state.userPlan === 'essential' && obPrefs.duration !== '20');
    if (allowed) {
      state.duration = obPrefs.duration;
      document.querySelectorAll('#grp-duration .pill').forEach(p => p.classList.remove('active'));
      document.querySelector(`#grp-duration .pill[data-value="${obPrefs.duration}"]`)?.classList.add('active');
    }
  }

  if (skipToConfig) {
    // Quick access: ya tenemos texto, revelar intent + config directamente
    document.getElementById('input-free').value = state.userInput;
    const btnContinue = document.getElementById('btn-continue-input');
    if (btnContinue) btnContinue.disabled = false;
    convoRevealIntent();
  }

  applyAllLocks();
  showScreen('screen-create');
}

// =============================================
//  ONBOARDING
// =============================================
let obCurrentStep = 1;
const OB_TOTAL_STEPS = 5; // sin contar el paso de plan

function checkOnboarding() {
  if (!localStorage.getItem('stillova_ob_done')) {
    showOnboarding();
  }
}

function showOnboarding() {
  showScreen('screen-onboarding');
  obGoToStep(1);
}

function obGoToStep(n) {
  obCurrentStep = n;

  // Activar el step correcto
  document.querySelectorAll('.ob-step').forEach(s => s.classList.remove('active'));
  const step = document.getElementById(`ob-${n}`);
  if (step) step.classList.add('active');

  // Barra de progreso (no contar el paso 6 de planes)
  const pct = n <= OB_TOTAL_STEPS ? (n / OB_TOTAL_STEPS) * 100 : 100;
  const fill = document.getElementById('ob-progress-fill');
  if (fill) fill.style.width = `${pct}%`;

  // Botón atrás: visible desde paso 2
  const back = document.getElementById('ob-back');
  if (back) back.style.display = n > 1 ? 'flex' : 'none';
}

function obNext(nextStep) {
  // Guardar preferencias según el paso actual
  if (obCurrentStep === 1) {
    const selected = [...document.querySelectorAll('#ob-topics .ob-chip.active')].map(c => c.dataset.value);
    obPrefs.topics = selected;
    localStorage.setItem('ob_topics', JSON.stringify(selected));
  }
  obGoToStep(nextStep);
  // Parar preview si se navega desde paso 5
  if (obCurrentStep !== 5) obStopPreview();
}

function obBack() {
  if (obCurrentStep > 1) {
    obGoToStep(obCurrentStep - 1);
    obStopPreview();
  }
}

function obChipToggle(el) {
  el.classList.toggle('active');
}

function obSelect(el, group) {
  document.querySelectorAll(`[data-group="${group}"]`).forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  const val = el.dataset.value;
  if (group === 'voice')  { obPrefs.voice  = val; localStorage.setItem('ob_voice', val); }
  if (group === 'gender') { obPrefs.gender = val; localStorage.setItem('ob_gender', val); }
}

function obSelectGoal(el) {
  document.querySelectorAll('.ob-goal-card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  obPrefs.goal = el.dataset.value;
  localStorage.setItem('ob_goal', el.dataset.value);
  const btn = document.getElementById('ob-3-next');
  if (btn) btn.disabled = false;
}

function obSelectDur(el) {
  document.querySelectorAll('.ob-dur-card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  obPrefs.duration = el.dataset.value;
  localStorage.setItem('ob_duration', el.dataset.value);
}

// Preview audio en onboarding (paso 5)
function obTogglePreview() {
  const audio = document.getElementById('audio-preview');
  if (!audio) return;

  if (obPreviewPlaying) {
    audio.pause();
    obPreviewPlaying = false;
    document.getElementById('ob-icon-play').style.display  = 'block';
    document.getElementById('ob-icon-pause').style.display = 'none';
    document.getElementById('ob-preview-hint').textContent = 'Toca para escuchar una muestra';
  } else {
    // Usar primer track ambient como fallback hasta que exista /sounds/preview.mp3
    const src = '/sounds/preview.mp3';
    if (audio.src !== window.location.origin + src) {
      audio.src = src;
      audio.load();
    }
    audio.play().then(() => {
      obPreviewPlaying = true;
      document.getElementById('ob-icon-play').style.display  = 'none';
      document.getElementById('ob-icon-pause').style.display = 'block';
      document.getElementById('ob-preview-hint').textContent = 'Reproduciendo muestra...';
    }).catch(() => {
      // Fallback: usar ambient track
      audio.src = AMBIENT_TRACKS[0];
      audio.load();
      audio.play().catch(() => {});
      obPreviewPlaying = true;
      document.getElementById('ob-icon-play').style.display  = 'none';
      document.getElementById('ob-icon-pause').style.display = 'block';
      document.getElementById('ob-preview-hint').textContent = 'Reproduciendo muestra...';
    });
    audio.onended = () => {
      obPreviewPlaying = false;
      document.getElementById('ob-icon-play').style.display  = 'block';
      document.getElementById('ob-icon-pause').style.display = 'none';
      document.getElementById('ob-preview-hint').textContent = 'Toca para escuchar de nuevo';
    };
  }
}

function obStopPreview() {
  const audio = document.getElementById('audio-preview');
  if (!audio) return;
  audio.pause();
  obPreviewPlaying = false;
  const iconPlay  = document.getElementById('ob-icon-play');
  const iconPause = document.getElementById('ob-icon-pause');
  if (iconPlay)  iconPlay.style.display  = 'block';
  if (iconPause) iconPause.style.display = 'none';
}

function obStartPlan(plan) {
  obStopPreview();
  // Guardar onboarding como completado
  localStorage.setItem('stillova_ob_done', '1');
  // Aplicar preferencias al estado
  applyObPrefsToState();

  if (!clerk || !clerk.user) {
    // Guardar plan pendiente y abrir sign-up
    sessionStorage.setItem('ob_pending_plan', plan);
    clerk?.openSignIn({ afterSignInUrl: window.location.href, afterSignUpUrl: window.location.href });
    return;
  }
  upgradePlan(plan);
}

function obSkipToFree() {
  obStopPreview();
  localStorage.setItem('stillova_ob_done', '1');
  applyObPrefsToState();

  if (!clerk || !clerk.user) {
    sessionStorage.setItem('ob_pending_plan', 'free');
    clerk?.openSignIn({ afterSignInUrl: window.location.href, afterSignUpUrl: window.location.href });
    return;
  }
  showHome();
  updateUserStatus();
}

function applyObPrefsToState() {
  state.voice    = obPrefs.voice;
  state.gender   = obPrefs.gender;
  state.duration = obPrefs.duration;
}

// =============================================
//  ACCESOS RÁPIDOS (home)
// =============================================
function quickAccess(emotionTag, prefillText) {
  state.emotionTag = emotionTag;
  state.userInput  = prefillText;
  showCreate(true);
}

// =============================================
//  CREACIÓN CONVERSACIONAL
// =============================================
function onInputChange() {
  const val = document.getElementById('input-free')?.value.trim() || '';
  const btn = document.getElementById('btn-continue-input');
  if (btn) btn.disabled = val.length < 3;
}

function convoRevealIntent() {
  const el = document.getElementById('input-free');
  const input = el?.value.trim() || '';
  if (input.length < 3) { if (el) shake(el); return; }
  if (input.length > 500) { showCharError(el, `Máximo 500 caracteres (tienes ${input.length})`); return; }
  state.userInput = input;

  const section = document.getElementById('cs-intent');
  if (section && section.classList.contains('convo-hidden') && !section.classList.contains('convo-revealed')) {
    section.classList.add('convo-revealed');
    setTimeout(() => section.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
  }
}

function selectIntent(el) {
  // Marcar card activa
  document.querySelectorAll('.intent-card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  state.intent = el.dataset.value;

  // Revelar config
  const section = document.getElementById('cs-config');
  if (section && section.classList.contains('convo-hidden') && !section.classList.contains('convo-revealed')) {
    section.classList.add('convo-revealed');
    setTimeout(() => section.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
  }
}

function goToGenerate() {
  const input = document.getElementById('input-free')?.value.trim() || '';
  if (!input) { shake(document.getElementById('input-free')); return; }
  if (input.length > 500) { showCharError(document.getElementById('input-free'), `Máximo 500 caracteres`); return; }
  state.userInput = input;
  state.userName = (clerk?.user?.firstName || '').trim().slice(0, 50);
  generateMeditation();
}

function resetCreateScreen() {
  // Limpiar input
  const inputEl = document.getElementById('input-free');
  if (inputEl) inputEl.value = '';

  // Ocultar intent y config
  const csIntent  = document.getElementById('cs-intent');
  const csConfig  = document.getElementById('cs-config');
  if (csIntent) { csIntent.classList.remove('convo-revealed'); csIntent.classList.add('convo-hidden'); }
  if (csConfig) { csConfig.classList.remove('convo-revealed'); csConfig.classList.add('convo-hidden'); }

  // Desactivar intent cards
  document.querySelectorAll('.intent-card').forEach(c => c.classList.remove('active'));

  // Resetear continue button
  const btnContinue = document.getElementById('btn-continue-input');
  if (btnContinue) btnContinue.disabled = true;

  state.intent    = null;
  state.emotionTag = null;
  state.userInput  = '';
}

// =============================================
//  PILLS Y LOCKS
// =============================================
function setPillLock(pill, locked) {
  pill.classList.toggle('pill-locked', locked);
  pill.querySelector('.pill-lock')?.remove();
  if (locked) {
    const icon = document.createElement('span');
    icon.className = 'pill-lock';
    icon.textContent = ' 🔒';
    pill.appendChild(icon);
  }
}

function applyAllLocks() {
  const isFree      = !clerk?.user || state.userPlan === 'free';
  const isPremium   = state.userPlan === 'premium';

  document.querySelectorAll('#grp-duration .pill').forEach(pill => {
    const val = pill.dataset.value;
    if (val === '20') {
      setPillLock(pill, !isPremium);
    } else {
      setPillLock(pill, isFree && val !== '5');
    }
  });

  if (!isPremium && state.duration === '20') {
    document.querySelectorAll('#grp-duration .pill').forEach(p => p.classList.remove('active'));
    document.querySelector('#grp-duration .pill[data-value="15"]')?.classList.add('active');
    state.duration = '15';
  }

  document.querySelectorAll('#grp-voice .pill').forEach(pill => {
    setPillLock(pill, isFree && pill.dataset.value !== 'auto');
  });
  document.querySelectorAll('#grp-gender .pill').forEach(pill => {
    setPillLock(pill, isFree && pill.dataset.value !== 'neutro');
  });
  document.querySelectorAll('#grp-music .pill').forEach(pill => {
    setPillLock(pill, isFree && pill.dataset.value !== 'auto');
  });

  if (isFree) {
    if (state.voice !== 'auto') {
      document.querySelectorAll('#grp-voice .pill').forEach(p => p.classList.remove('active'));
      document.querySelector('#grp-voice .pill[data-value="auto"]')?.classList.add('active');
      state.voice = 'auto';
    }
    if (state.gender !== 'neutro') {
      document.querySelectorAll('#grp-gender .pill').forEach(p => p.classList.remove('active'));
      document.querySelector('#grp-gender .pill[data-value="neutro"]')?.classList.add('active');
      state.gender = 'neutro';
    }
    if (state.music !== 'auto') {
      document.querySelectorAll('#grp-music .pill').forEach(p => p.classList.remove('active'));
      document.querySelector('#grp-music .pill[data-value="auto"]')?.classList.add('active');
      state.music = 'auto';
    }
  }
}

function applyDurationLocks() { applyAllLocks(); }

function selectPill(el, groupId, key) {
  if (el.classList.contains('pill-locked')) {
    showPaywall();
    track('paywall_shown', { trigger: 'pill_lock', value: el.dataset.value });
    return;
  }
  document.querySelectorAll(`#${groupId} .pill`).forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  state[key] = el.dataset.value;
}

// =============================================
//  GENERACIÓN
// =============================================
function enableGenerateBtn() {
  const btn = document.getElementById('btn-generate');
  if (btn) btn.disabled = false;
}

function cancelGeneration() {
  if (abortController) { abortController.abort(); abortController = null; }
  if (slowTimer) { clearTimeout(slowTimer); slowTimer = null; }
  enableGenerateBtn();
  showScreen('screen-create');
}

async function generateMeditation() {
  if (!clerk || !clerk.user) {
    const guestName = document.getElementById('pref-name')?.value.trim().slice(0, 50);
    if (guestName) state.userName = guestName;
    pendingGeneration = true;
    sessionStorage.setItem('pending_generation', '1');
    clerk.openSignIn({ afterSignInUrl: window.location.href, afterSignUpUrl: window.location.href });
    return;
  }
  pendingGeneration = false;
  if (!state.userName) state.userName = (clerk.user.firstName || '').trim().slice(0, 50);

  const btn = document.getElementById('btn-generate');
  if (btn) btn.disabled = true;

  state.currentSec = 0;
  track('meditation_started', { duration: state.duration, voice: state.voice, intent: state.intent, emotionTag: state.emotionTag });

  setLoadingState('normal', 'Escuchándote...', 'Leyendo lo que sientes y creando algo que solo existe para este momento.');
  showScreen('screen-loading');

  slowTimer = setTimeout(() => {
    document.getElementById('loading-sub').textContent = 'Cada palabra está siendo elegida para ti. Un momento más...';
    slowTimer = null;
  }, 10000);

  abortController = new AbortController();
  try {
    await attemptGeneration(abortController.signal);
  } catch (err) {
    if (slowTimer) { clearTimeout(slowTimer); slowTimer = null; }
    if (err.name === 'AbortError') { abortController = null; enableGenerateBtn(); return; }

    if (err.status === 402) {
      abortController = null;
      enableGenerateBtn();
      showScreen('screen-create');
      showToast(err.message || 'Sin créditos disponibles. Elige un plan para continuar.');
      setTimeout(() => showPaywall(), 900);
      track('paywall_shown', { duration: state.duration });
      return;
    }
    if (err.status && err.status < 500) {
      abortController = null;
      enableGenerateBtn();
      if (err.status === 401) {
        showScreen('screen-create');
        showToast('Sesión expirada. Inicia sesión de nuevo.');
        setTimeout(() => openAuth(), 800);
      } else if (err.status === 429) {
        setLoadingState('error', 'Límite alcanzado', 'Has alcanzado el límite de meditaciones por hora. Vuelve en un momento.');
      } else {
        setLoadingState('error', 'Algo salió mal', err.message || 'Revisa los datos e inténtalo de nuevo.');
      }
      return;
    }

    console.warn('Primer intento fallido, reintentando...', err);
    setLoadingState('normal', 'Casi lista...', 'Refinando los últimos detalles de tu sesión.');
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
  const token = await getAuthToken();
  const email = await getUserEmail();
  const authHeaders = token
    ? { 'Authorization': `Bearer ${token}`, 'x-user-email': email }
    : {};

  const meditationRes = await fetch('/api/meditation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    signal,
    body: JSON.stringify({
      userInput: state.userInput,
      userName:  state.userName,
      duration:  state.duration,
      voice:     state.voice,
      gender:    state.gender,
      intent:    state.intent
    })
  });

  if (!meditationRes.ok) {
    const err = await meditationRes.json().catch(() => ({}));
    const error = new Error(err.error || `Error ${meditationRes.status}`);
    error.status = meditationRes.status;
    throw error;
  }

  const { title, text, targetWords, silenceTotal, resolvedVoice } = await meditationRes.json();
  if (resolvedVoice) state.voice = resolvedVoice;
  document.getElementById('session-title').textContent = title;

  setLoadingState('normal', 'Preparando tu voz...', 'Tu guía está tomando vida. Ya casi.');

  const audioRes = await fetch('/api/audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    signal,
    body: JSON.stringify({
      text,
      voice:      state.voice,
      duration:   state.duration,
      targetWords,
      silenceTotal,
      title,
      intent:     state.intent,
      emotionTag: state.emotionTag
    })
  });

  if (!audioRes.ok) {
    const err = await audioRes.json().catch(() => ({}));
    const error = new Error(err.error || `Error ${audioRes.status}`);
    error.status = audioRes.status;
    throw error;
  }

  const audioData = await audioRes.json();

  if (slowTimer) { clearTimeout(slowTimer); slowTimer = null; }
  abortController = null;

  const binary = atob(audioData.audioBase64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });

  if (state.audioBlobUrl) URL.revokeObjectURL(state.audioBlobUrl);
  state.audioBlobUrl        = URL.createObjectURL(audioBlob);
  state.currentMeditationId = audioData.meditationId || null;
  state.silenceMap          = audioData.silenceMap || [];
  state.totalSec            = Math.round(audioData.totalDuration || parseInt(state.duration) * 60);
  state.silenceOffset       = 0;

  document.getElementById('time-end').textContent = formatTime(state.totalSec);

  track('meditation_generated', { duration: state.duration, voice: state.voice, intent: state.intent });

  connectAudio(state.audioBlobUrl);
  showScreen('screen-player');
}

function setLoadingState(type, title, sub) {
  document.getElementById('loading-title').textContent = title;
  document.getElementById('loading-sub').textContent   = sub;
  const isError = type === 'error';
  document.getElementById('btn-retry').style.display      = isError ? 'block' : 'none';
  document.getElementById('btn-back-input').style.display = isError ? 'block' : 'none';
  document.getElementById('btn-cancel').style.display     = isError ? 'none'  : 'block';
}

function retryFromError()  { enableGenerateBtn(); showScreen('screen-create'); }
function backToInput()     { enableGenerateBtn(); showScreen('screen-create'); }

// =============================================
//  REPRODUCTOR
// =============================================
function togglePlay() {
  const audio = document.getElementById('audio');
  const wrap  = document.getElementById('breathing-player');

  if (state.isPlaying) {
    if (state.silenceTimer)     { clearInterval(state.silenceTimer); state.silenceTimer = null; }
    if (state.silenceTimeoutId) { clearTimeout(state.silenceTimeoutId); state.silenceTimeoutId = null; }
    if (state.introTimeoutId)   { clearTimeout(state.introTimeoutId); state.introTimeoutId = null; }
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
  document.getElementById('progress-fill').style.width    = `${pct}%`;
  document.getElementById('time-now').textContent         = formatTime(Math.min(state.currentSec, state.totalSec));
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
    if (state.silenceTimer)     { clearInterval(state.silenceTimer); state.silenceTimer = null; }
    state.inSilence = false;
    audio.currentTime = ratio * audio.duration;
    state.silenceOffset = 0;
    for (const s of state.silenceMap) {
      if (s.time < audio.currentTime) { s._done = true; state.silenceOffset += s.duration; }
      else s._done = false;
    }
    state.currentSec = Math.round(audio.currentTime + state.silenceOffset);
    updateProgress();
    if (state.isPlaying) {
      audio.play().then(() => { scheduleNextSilence(audio); }).catch(console.error);
    }
  }
}

function handleEnd() {
  track('meditation_completed', { duration: state.duration, voice: state.voice, intent: state.intent });
  state.isPlaying  = false;
  state.inSilence  = false;
  state.currentSec = state.totalSec;
  updateProgress();
  document.getElementById('icon-play').style.display  = 'block';
  document.getElementById('icon-pause').style.display = 'none';
  document.getElementById('breathing-player').classList.add('paused');
  ambientFadeOut();

  document.getElementById('end-message').style.display        = 'block';
  document.getElementById('btn-new-meditation').style.display = 'none';
  document.getElementById('end-upsell').style.display         = 'none';
  document.getElementById('end-profile').style.display        = 'none';

  const statusPromise = fetchUserStatus();
  const delayPromise  = new Promise(resolve => setTimeout(resolve, 5000));

  Promise.all([statusPromise, delayPromise]).then(() => {
    document.getElementById('end-message').style.display = 'none';
    if (state.userPlan === 'free' && !state.userCanGenerate) {
      if (!state.profileCompleted) {
        document.getElementById('end-profile').style.display = 'flex';
        document.getElementById('screen-player').classList.add('end-active');
      } else {
        document.getElementById('end-upsell').style.display = 'flex';
        document.getElementById('screen-player').classList.add('end-active');
      }
    } else if (state.userPlan !== 'free' && state.currentMeditationId) {
      document.getElementById('end-save').style.display = 'flex';
    } else {
      document.getElementById('btn-new-meditation').style.display = 'block';
    }
  });
}

function newMeditation() {
  state.isPlaying           = false;
  state.inSilence           = false;
  state.currentSec          = 0;
  state.currentMeditationId = null;

  const audio = document.getElementById('audio');
  audio.pause();
  audio.removeAttribute('src');
  audio.load();

  if (state.silenceTimer)     { clearInterval(state.silenceTimer); state.silenceTimer = null; }
  if (state.silenceTimeoutId) { clearTimeout(state.silenceTimeoutId); state.silenceTimeoutId = null; }
  state.silenceMap    = [];
  state.silenceOffset = 0;

  if (state.audioBlobUrl) { URL.revokeObjectURL(state.audioBlobUrl); state.audioBlobUrl = null; }

  ambientStop();
  const ambientEl = document.getElementById('audio-ambient');
  ambientEl.removeAttribute('src');
  ambientEl.load();

  document.getElementById('progress-fill').style.width    = '0%';
  document.getElementById('time-now').textContent         = '0:00';
  document.getElementById('icon-play').style.display      = 'block';
  document.getElementById('icon-pause').style.display     = 'none';
  document.getElementById('breathing-player').classList.add('paused');

  document.getElementById('end-message').style.display        = 'none';
  document.getElementById('btn-new-meditation').style.display = 'none';
  document.getElementById('end-upsell').style.display         = 'none';
  document.getElementById('end-profile').style.display        = 'none';
  document.getElementById('end-save').style.display           = 'none';
  document.getElementById('screen-player').classList.remove('end-active');

  resetCreateScreen();
  showScreen('screen-home');
}

// =============================================
//  CONECTAR AUDIO Y SILENCIOS
// =============================================
function connectAudio(url) {
  const audio = document.getElementById('audio');
  audio.src = url;
  loadRandomAmbient();
  audio.ontimeupdate = () => {
    if (!state.isPlaying || state.inSilence) return;
    state.currentSec = Math.round(audio.currentTime + state.silenceOffset);
    updateProgress();
  };
}

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
            if (!audio.ended) scheduleNextSilence(audio);
          }).catch(console.error);
        }
      }
    }, tick);
  }, delayMs);
}

// =============================================
//  GAMIFICACIÓN
// =============================================
function calculateLevel(totalSessions) {
  if (totalSessions >= 30) return 'Calma';
  if (totalSessions >= 15) return 'Presente';
  if (totalSessions >= 5)  return 'Consciente';
  if (totalSessions >= 1)  return 'Explorador';
  return 'Inquieto';
}

function updateHomeGamification(data) {
  const { streak, minutesThisWeek, totalSessions, level } = data;
  state.streak          = streak   || 0;
  state.minutesThisWeek = minutesThisWeek || 0;
  state.totalSessions   = totalSessions   || 0;
  state.level           = level || calculateLevel(totalSessions);

  const gamEl = document.getElementById('home-gam');
  if (!gamEl) return;

  document.getElementById('gam-streak').textContent  = state.streak;
  document.getElementById('gam-minutes').textContent = state.minutesThisWeek;
  document.getElementById('gam-level').textContent   = state.level;
  gamEl.style.display = 'flex';
}

function renderHomeRecents(meditations) {
  if (!meditations || meditations.length === 0) return;
  const container = document.getElementById('home-recents');
  const list      = document.getElementById('home-recents-list');
  if (!container || !list) return;

  const EMOTION_LABELS = {
    ansiedad:   'Ansiedad',
    sueno:      'Dormir',
    claridad:   'Claridad',
    liberacion: 'Liberación',
    enfoque:    'Enfoque'
  };

  list.innerHTML = meditations.slice(0, 3).map(m => {
    const dateStr = formatRelativeDate(m.created_at);
    const tagHtml = m.emotion_tag
      ? `<span class="home-recent-tag">${EMOTION_LABELS[m.emotion_tag] || m.emotion_tag}</span>`
      : '';
    return `
      <div class="home-recent-card" onclick="showCreate()">
        <div>
          <div class="home-recent-title">${escapeHtml(m.title)}</div>
          <div class="home-recent-meta">
            <span>${dateStr}</span>
            <span>${m.duration} min</span>
            ${tagHtml}
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink:0;color:var(--text-45)">
          <path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>`;
  }).join('');

  container.style.display = 'block';
}

function formatRelativeDate(iso) {
  const d   = new Date(iso);
  const now = new Date();
  const s   = dt => dt.toISOString().slice(0, 10);
  if (s(d) === s(now)) return 'Hoy';
  if (s(d) === s(new Date(Date.now() - 86400000))) return 'Ayer';
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// =============================================
//  ANALYTICS
// =============================================
function track(event, props) {
  try {
    if (window.posthog && typeof posthog.capture === 'function') {
      posthog.capture(event, props || {});
    }
  } catch (e) { /* silencioso */ }
}

// =============================================
//  UTILIDADES
// =============================================
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
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
  if (!el) return;
  if (shakeInterval) { clearInterval(shakeInterval); shakeInterval = null; }
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
//  AUTH — CLERK
// =============================================
let clerk = null;
let pendingGeneration = false;

async function openAuth() {
  if (clerk) {
    clerk.openSignIn({ afterSignInUrl: window.location.href, afterSignUpUrl: window.location.href });
    return;
  }
  let waited = 0;
  while (!clerk && waited < 30) { await new Promise(r => setTimeout(r, 100)); waited++; }
  if (clerk) clerk.openSignIn({ afterSignInUrl: window.location.href, afterSignUpUrl: window.location.href });
}

async function initClerk() {
  try {
    let attempts = 0;
    while (!window.Clerk && attempts < 50) {
      await new Promise(r => setTimeout(r, 100));
      attempts++;
    }
    if (!window.Clerk) throw new Error('Clerk no cargó');

    clerk = window.Clerk;
    await clerk.load({
      appearance: {
        variables: {
          colorPrimary:         '#c9a96e',
          colorBackground:      '#0c1109',
          colorText:            '#f2ede4',
          colorTextSecondary:   'rgba(242,237,228,0.65)',
          colorInputBackground: 'rgba(242,237,228,0.07)',
          colorInputText:       '#f2ede4',
          borderRadius:         '14px',
          fontFamily:           'Inter, sans-serif'
        }
      }
    });

    if (sessionStorage.getItem('pending_generation') === '1') {
      pendingGeneration = true;
      sessionStorage.removeItem('pending_generation');
    }

    clerk.addListener(({ user }) => {
      updateUserStatus();

      // Post-onboarding: plan pendiente
      const pendingPlan = sessionStorage.getItem('ob_pending_plan');
      if (user && pendingPlan) {
        sessionStorage.removeItem('ob_pending_plan');
        if (pendingPlan !== 'free') {
          upgradePlan(pendingPlan);
        } else {
          showHome();
          fetchUserStatus();
        }
        return;
      }

      if (user && pendingGeneration) {
        pendingGeneration = false;
        generateMeditation();
      }
    });

    updateUserStatus();
    checkUrlParams();

    // Mostrar onboarding o home
    if (!localStorage.getItem('stillova_ob_done')) {
      showOnboarding();
    } else {
      // Cargar recientes si hay usuario logueado
      if (clerk.user) loadHomeData();
    }
  } catch (e) {
    console.error('[clerk] Error de inicialización:', e);
  }
}

async function loadHomeData() {
  try {
    const token = await getAuthToken();
    const email = await getUserEmail();
    const res = await fetch('/api/dashboard', {
      headers: { 'Authorization': `Bearer ${token}`, 'x-user-email': email }
    });
    if (!res.ok) return;
    const data = await res.json();
    updateHomeGamification(data);
    renderHomeRecents(data.recentMeditations);
  } catch (e) {
    console.error('[homeData]', e);
  }
}

async function updateUserStatus() {
  const el    = document.getElementById('user-status');
  const guest = document.getElementById('guest-actions');
  if (!el) return;

  if (!clerk || !clerk.user) {
    el.style.display    = 'none';
    if (guest) guest.style.display = 'flex';
    const guestBlock = document.getElementById('guest-name-block');
    if (guestBlock) guestBlock.style.display = 'block';
    applyDurationLocks();
    return;
  }

  el.style.display    = 'flex';
  if (guest) guest.style.display = 'none';

  const cachedPlan = localStorage.getItem('stillova_plan');
  if (cachedPlan && cachedPlan !== 'free') {
    state.userPlan = cachedPlan;
    applyDurationLocks();
  }

  fetchUserStatus();
}

async function fetchUserStatus() {
  if (!clerk || !clerk.user || !clerk.session) return;
  try {
    const token = await clerk.session.getToken();
    const email = clerk.user.primaryEmailAddress?.emailAddress || '';

    const res = await fetch('/api/user', {
      headers: { 'Authorization': `Bearer ${token}`, 'x-user-email': email }
    });
    if (!res.ok) return;

    const { plan, usage, limit, canGenerate, profileCompleted,
            streak, minutesThisWeek, totalSessions, level } = await res.json();

    const planEl  = document.getElementById('plan-badge');
    const usageEl = document.getElementById('usage-info');

    state.userPlan       = plan;
    state.userCanGenerate = canGenerate;
    state.profileCompleted = !!profileCompleted;
    localStorage.setItem('stillova_plan', plan);

    if (planEl) {
      const planNames = { free: 'Gratis', essential: 'Essential', premium: 'Premium' };
      planEl.textContent = planNames[plan] || plan;
      planEl.className   = `plan-badge plan-${plan}`;
    }
    if (usageEl) {
      if (plan === 'free') {
        usageEl.textContent = canGenerate ? 'Meditación gratis disponible' : 'Sin créditos disponibles';
      } else {
        const rem = limit - usage;
        usageEl.textContent = `${rem} meditación${rem !== 1 ? 'es' : ''} disponible${rem !== 1 ? 's' : ''}`;
      }
    }

    const guestBlock = document.getElementById('guest-name-block');
    if (guestBlock) guestBlock.style.display = 'none';
    applyDurationLocks();

    // Gamificación en home
    updateHomeGamification({ streak, minutesThisWeek, totalSessions, level });

    // Saludo personalizado
    const greetEl = document.getElementById('home-greeting');
    const displayName = clerk?.user?.firstName || clerk?.user?.fullName?.split(' ')[0] || '';
    if (greetEl) {
      const h = new Date().getHours();
      const greet = h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
      greetEl.textContent = displayName
        ? `${greet}, ${displayName}.`
        : '¿Cómo te sientes hoy... de verdad?';
    }

    // Créditos en pantalla de crear
    const creditsInfoEl = document.getElementById('credits-info');
    if (creditsInfoEl) {
      if (plan !== 'free') {
        const remaining = Math.max(0, limit - usage);
        const remText = document.getElementById('credits-remaining-text');
        if (remText) remText.textContent = `${remaining} crédito${remaining !== 1 ? 's' : ''} disponible${remaining !== 1 ? 's' : ''} este mes`;
        creditsInfoEl.style.display = 'flex';
      } else {
        creditsInfoEl.style.display = 'none';
      }
    }
  } catch (e) {
    console.error('[user status] Error:', e);
  }
}

async function getAuthToken() {
  if (!clerk || !clerk.session) return null;
  try { return await clerk.session.getToken(); } catch { return null; }
}

async function getUserEmail() {
  if (!clerk || !clerk.user) return '';
  return clerk.user.primaryEmailAddress?.emailAddress || '';
}

function checkUrlParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('upgraded')) {
    const plan = params.get('upgraded');
    const planNames = { essential: 'Essential', premium: 'Premium' };
    showToast(`¡Bienvenido a ${planNames[plan] || plan}! Ya puedes generar más meditaciones.`);
    window.history.replaceState({}, '', window.location.pathname);
    fetchUserStatus();
  }
  if (params.get('canceled')) {
    window.history.replaceState({}, '', window.location.pathname);
  }
}

// =============================================
//  PAYWALL
// =============================================
function showPaywall() {
  const modal = document.getElementById('paywall-modal');
  if (modal) modal.classList.add('active');
}

function closeEndUpsell() {
  document.getElementById('end-upsell').style.display = 'none';
  document.getElementById('screen-player').classList.remove('end-active');
}

function closePaywall() {
  const modal = document.getElementById('paywall-modal');
  if (modal) modal.classList.remove('active');
  enableGenerateBtn();

  if (state.userPlan === 'free' && !state.userCanGenerate && clerk?.user) {
    const email = clerk.user.primaryEmailAddress?.emailAddress || '';
    if (email && window.posthog) {
      posthog.identify(clerk.user.id, { email, plan: 'free', paywall_dismissed: true });
      track('paywall_dismissed', { email });
    }
    showLeadCapture();
  }
}

function showLeadCapture() {
  if (document.getElementById('lead-capture')) return;
  const el = document.createElement('div');
  el.id = 'lead-capture';
  el.className = 'lead-capture';
  el.innerHTML = `
    <p class="lead-capture-text">¿Te avisamos cuando haya nuevas funciones y ofertas?</p>
    <div class="lead-capture-actions">
      <button class="btn-lead-yes" onclick="confirmLead()">Sí, avísame</button>
      <button class="btn-lead-no"  onclick="dismissLead()">No, gracias</button>
    </div>`;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('visible'), 50);
}

function confirmLead() {
  track('lead_opt_in', { email: clerk?.user?.primaryEmailAddress?.emailAddress || '' });
  dismissLead();
  showToast('¡Perfecto! Te avisaremos cuando haya novedades.');
}

function dismissLead() {
  const el = document.getElementById('lead-capture');
  if (!el) return;
  el.classList.remove('visible');
  setTimeout(() => el.remove(), 400);
}

async function upgradePlan(plan) {
  if (!clerk || !clerk.session) return;
  try {
    const token = await clerk.session.getToken();
    const email = await getUserEmail();
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
    localStorage.removeItem('stillova_plan');
    clerk.signOut().then(() => {
      const el = document.getElementById('user-status');
      if (el) el.style.display = 'none';
    });
  }
}

// =============================================
//  GUARDAR MEDITACIÓN
// =============================================
async function saveMeditation() {
  const btn = document.getElementById('btn-save-meditation');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  try {
    const token   = await getAuthToken();
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

    const presignRes = await fetch('/api/save-meditation', {
      method: 'POST',
      headers,
      body: JSON.stringify({ meditationId: state.currentMeditationId, action: 'presign' })
    });

    if (presignRes.status === 403) {
      const { reason } = await presignRes.json();
      btn.disabled = false;
      btn.textContent = 'Guardar meditación';
      if (reason === 'save_limit') {
        showToast('Has alcanzado el límite de Essential. Pasa a Premium para guardar sin límite.');
        setTimeout(() => showPaywall(), 800);
      }
      return;
    }
    if (!presignRes.ok) throw new Error('Error al preparar el guardado');

    const { signedUrl, path, already_saved } = await presignRes.json();
    if (already_saved) { showToast('Ya estaba guardada en tu biblioteca'); skipSave(); return; }

    const audioBlob = await fetch(state.audioBlobUrl).then(r => r.blob());
    const uploadRes = await fetch(signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'audio/mpeg' },
      body: audioBlob
    });
    if (!uploadRes.ok) throw new Error('Error al subir el audio');

    const confirmRes = await fetch('/api/save-meditation', {
      method: 'POST',
      headers,
      body: JSON.stringify({ meditationId: state.currentMeditationId, action: 'confirm', path })
    });
    if (!confirmRes.ok) throw new Error('Error al confirmar el guardado');

    track('meditation_saved', { duration: state.duration });
    showToast('Guardada en tu biblioteca');
    skipSave();
  } catch (e) {
    console.error('[save] Error:', e);
    btn.disabled = false;
    btn.textContent = 'Guardar meditación';
    showToast('Error al guardar. Inténtalo de nuevo.');
  }
}

function skipSave() {
  document.getElementById('end-save').style.display           = 'none';
  document.getElementById('btn-new-meditation').style.display = 'block';
}

// =============================================
//  PERFIL BONUS
// =============================================
function profilePillSelect(groupId, btn) {
  document.querySelectorAll(`#${groupId} .profile-pill`).forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  checkProfileComplete();
}

function checkProfileComplete() {
  const goal      = document.querySelector('#profile-goal .profile-pill.active');
  const frequency = document.querySelector('#profile-frequency .profile-pill.active');
  const timing    = document.querySelector('#profile-timing .profile-pill.active');
  const btn       = document.getElementById('btn-profile-submit');
  if (btn) btn.disabled = !(goal && frequency && timing);
}

async function submitProfile() {
  const goal      = document.querySelector('#profile-goal .profile-pill.active')?.dataset.value;
  const frequency = document.querySelector('#profile-frequency .profile-pill.active')?.dataset.value;
  const timing    = document.querySelector('#profile-timing .profile-pill.active')?.dataset.value;
  if (!goal || !frequency || !timing) return;

  const btn = document.getElementById('btn-profile-submit');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  try {
    const token = await getAuthToken();
    const res = await fetch('/api/profile-bonus', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal, frequency, timing })
    });
    const data = await res.json();
    if (res.ok && (data.success || data.already_completed)) {
      state.profileCompleted = true;
      state.userCanGenerate  = true;
      document.getElementById('end-profile').style.display = 'none';
      document.getElementById('screen-player').classList.remove('end-active');
      showToast('¡Tienes 1 meditación extra gratis! Úsala cuando quieras.');
      document.getElementById('btn-new-meditation').style.display = 'block';
      const usageEl = document.getElementById('usage-info');
      if (usageEl) usageEl.textContent = 'Meditación gratis disponible';
    } else {
      showToast('Error al guardar el perfil. Inténtalo de nuevo.');
      btn.disabled = false;
      btn.textContent = 'Recibir meditación gratis';
    }
  } catch (e) {
    console.error('[profile-bonus] Error:', e);
    showToast('Error de conexión. Inténtalo de nuevo.');
    btn.disabled = false;
    btn.textContent = 'Recibir meditación gratis';
  }
}

function skipProfile() {
  document.getElementById('end-profile').style.display = 'none';
  document.getElementById('end-upsell').style.display  = 'flex';
  document.getElementById('screen-player').classList.add('end-active');
}

// =============================================
//  INIT
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  initClerk();

  // Event delegation para pills del perfil bonus
  document.addEventListener('click', (e) => {
    const pill = e.target.closest('.profile-pill');
    if (!pill) return;
    const group = pill.closest('.profile-pills');
    if (group) profilePillSelect(group.id, pill);
  });
});
