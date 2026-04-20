const LOADING_MESSAGES = [
  { title: 'Escuchándote',         sub: 'Leyendo lo que sientes en este momento exacto.' },
  { title: 'Encontrando palabras', sub: 'Cada frase elegida solo para este instante tuyo.' },
  { title: 'Construyendo el ritmo',sub: 'Los silencios y la respiración tomando forma.' },
  { title: 'Casi lista',           sub: 'Unos segundos más y comenzamos.' }
];
let loadingMsgIndex = 0;
let loadingInterval = null;

function startLoadingMessages() {
  loadingMsgIndex = 0;
  if (loadingInterval) clearInterval(loadingInterval);
  const m = LOADING_MESSAGES[0];
  document.getElementById('loading-title').textContent = m.title;
  document.getElementById('loading-sub').textContent   = m.sub;
  loadingInterval = setInterval(() => {
    loadingMsgIndex = (loadingMsgIndex + 1) % LOADING_MESSAGES.length;
    const msg = LOADING_MESSAGES[loadingMsgIndex];
    document.getElementById('loading-title').textContent = msg.title;
    document.getElementById('loading-sub').textContent   = msg.sub;
  }, 4500);
}

function stopLoadingMessages() {
  if (loadingInterval) { clearInterval(loadingInterval); loadingInterval = null; }
}

function enableGenerateBtn() {
  const btn = document.getElementById('btn-generate');
  if (btn) btn.disabled = false;
}

function cancelGeneration() {
  if (abortController) { abortController.abort(); abortController = null; }
  if (slowTimer) { clearTimeout(slowTimer); slowTimer = null; }
  stopLoadingMessages();
  enableGenerateBtn();
  showScreen('screen-create');
}

async function generateMeditation() {
  if (!clerk || !clerk.user) {
    const guestName = document.getElementById('pref-name')?.value.trim().slice(0, 50);
    if (guestName) state.userName = guestName;

    if (localStorage.getItem('stillova_guest_used')) {
      pendingGeneration = true;
      sessionStorage.setItem('pending_generation', '1');
      clerk?.openSignIn({ afterSignInUrl: window.location.href, afterSignUpUrl: window.location.href });
      return;
    }
  } else {
    pendingGeneration = false;
    if (!state.userName) state.userName = (clerk.user.firstName || '').trim().slice(0, 50);

    // Verificar sesión activa antes de continuar
    if (!clerk.session) {
      showToast('Tu sesión ha expirado. Inicia sesión de nuevo.');
      setTimeout(() => openAuth(), 600);
      return;
    }

    // Verificar créditos localmente antes de llamar a la API.
    // Evita que un token expirado devuelva 401 cuando el problema real es falta de créditos.
    if (!state.userCanGenerate) {
      showToast('Sin créditos disponibles. Elige un plan para continuar.');
      setTimeout(() => showPaywall(), 600);
      track('paywall_shown', { trigger: 'no_credits_preflight', plan: state.userPlan });
      return;
    }
  }

  const btn = document.getElementById('btn-generate');
  if (btn) btn.disabled = true;

  state.currentSec = 0;
  track('meditation_started', { duration: state.duration, voice: state.voice, intent: state.intent, emotionTag: state.emotionTag });

  showScreen('screen-loading');
  startLoadingMessages();

  abortController = new AbortController();
  try {
    await attemptGeneration(abortController.signal);
  } catch (err) {
    if (slowTimer) { clearTimeout(slowTimer); slowTimer = null; }
    stopLoadingMessages();
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
    setLoadingState('normal', 'Refinando tu sesión', 'Un segundo más, ya casi está lista.');
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

  stopLoadingMessages();
  setLoadingState('normal', 'Dando voz a tu meditación', 'Tu guía está tomando vida. Ya casi.');

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
  document.getElementById('time-now').textContent = '0:00';
  const cd = document.getElementById('time-countdown');
  if (cd) cd.textContent = formatTime(state.totalSec);

  track('meditation_generated', { duration: state.duration, voice: state.voice, intent: state.intent });

  if (!clerk?.user) {
    const guestAttempt = localStorage.getItem('stillova_guest_used') ? 2 : 1;
    localStorage.setItem('stillova_guest_used', '1');
    track('free_guest_generation', { guest: true, attempt: guestAttempt, duration: state.duration });
  }

  connectAudio(state.audioBlobUrl);
  showScreen('screen-player');
}

function setLoadingState(type, title, sub) {
  if (type === 'error') stopLoadingMessages();
  document.getElementById('loading-title').textContent = title;
  document.getElementById('loading-sub').textContent   = sub;
  const isError = type === 'error';
  document.getElementById('btn-retry').style.display      = isError ? 'block' : 'none';
  document.getElementById('btn-back-input').style.display = isError ? 'block' : 'none';
  document.getElementById('btn-cancel').style.display     = isError ? 'none'  : 'block';
}

function retryFromError()  { enableGenerateBtn(); showScreen('screen-create'); }
function backToInput()     { enableGenerateBtn(); showScreen('screen-create'); }
