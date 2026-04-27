const LOADING_MESSAGES = [
  { title: 'Escuchándote',         sub: 'Leyendo lo que sientes en este momento exacto.' },
  { title: 'Encontrando palabras', sub: 'Cada frase elegida solo para este instante tuyo.' },
  { title: 'Construyendo el ritmo',sub: 'Los silencios encuentran su lugar exacto.' },
  { title: 'Casi lista',           sub: 'Unos segundos más y comenzamos.' }
];
let loadingMsgIndex = 0;
let loadingInterval = null;

function _setLoadingText(title, sub) {
  const t = document.getElementById('loading-title');
  const s = document.getElementById('loading-sub');
  if (t) t.textContent = title;
  if (s) s.textContent = sub;
}

function setTrailStep(step) {
  for (let i = 1; i <= 3; i++) {
    const dot = document.querySelector(`#trail-${i} .trail-dot`);
    if (!dot) continue;
    dot.className = 'trail-dot ' + (i < step ? 'trail-done' : i === step ? 'trail-active' : 'trail-pending');
  }
}

function startLoadingMessages() {
  loadingMsgIndex = 0;
  if (loadingInterval) clearInterval(loadingInterval);
  const m = LOADING_MESSAGES[0];
  _setLoadingText(m.title, m.sub);
  setTrailStep(1);
  loadingInterval = setInterval(() => {
    loadingMsgIndex = (loadingMsgIndex + 1) % LOADING_MESSAGES.length;
    const msg = LOADING_MESSAGES[loadingMsgIndex];
    _setLoadingText(msg.title, msg.sub);
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
    // Lee de input de home guest, fallback a localStorage si el input está oculto (saludo personalizado)
    const guestName = (
      document.getElementById('home-guest-referred-as')?.value ||
      localStorage.getItem('stillova_referred_as') ||
      document.getElementById('pref-name')?.value ||
      ''
    ).trim().slice(0, 50);
    if (guestName) {
      state.userName = guestName;
      try { localStorage.setItem('stillova_referred_as', guestName); } catch (_) {}
      try { track('home_guest_name_filled', { length: guestName.length }); } catch (_) {}
    } else {
      try { track('home_guest_name_skipped', {}); } catch (_) {}
    }

    if (localStorage.getItem('stillova_guest_used')) {
      pendingGeneration = true;
      sessionStorage.setItem('pending_generation', '1');
      clerk?.openSignIn({ afterSignInUrl: window.location.href, afterSignUpUrl: window.location.href });
      return;
    }
  } else {
    pendingGeneration = false;
    if (!state.userName) {
      const fromClerk = (clerk.user.firstName || '').trim().slice(0, 50);
      const fromStorage = (localStorage.getItem('stillova_referred_as') || '').trim().slice(0, 50);
      state.userName = fromClerk || fromStorage;
    }

    // Verificar sesión activa antes de continuar
    if (!clerk.session) {
      showToast('Tu sesión ha expirado. Inicia sesión de nuevo.');
      setTimeout(() => openAuth(), 600);
      return;
    }

    // Verificar sesiones disponibles localmente antes de llamar a la API.
    // Evita que un token expirado devuelva 401 cuando el problema real es falta de sesiones.
    if (!state.userCanGenerate) {
      showToast('Sin sesiones disponibles. Elige un plan para continuar.');
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

  const quoteEl = document.getElementById('loading-user-quote');
  if (quoteEl) {
    const raw = (state.userInput || '').trim();
    if (raw) {
      const truncated = raw.length > 180 ? raw.slice(0, 177) + '…' : raw;
      quoteEl.textContent = '“' + truncated + '”';
      quoteEl.style.display = '';
    } else {
      quoteEl.style.display = 'none';
    }
  }

  startLoadingMessages();

  // Hasta 3 intentos con backoff exponencial (1s, 2s) para errores transitorios:
  // 5xx, network, 408 timeout. Errores de cliente (4xx ≠ 408) no se reintentan.
  const MAX_ATTEMPTS = 3;
  let lastErr = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    abortController = new AbortController();
    try {
      await attemptGeneration(abortController.signal);
      return; // éxito
    } catch (err) {
      lastErr = err;
      if (err.name === 'AbortError') { abortController = null; enableGenerateBtn(); return; }

      // 4xx que no son 408 → no reintentar (es responsabilidad del cliente/usuario)
      const isTransient = !err.status || err.status >= 500 || err.status === 408;
      if (!isTransient || attempt === MAX_ATTEMPTS) break;

      console.warn(`Intento ${attempt}/${MAX_ATTEMPTS} falló, reintentando...`, err);
      setLoadingState('normal', 'Refinando tu sesión', 'Un segundo más, ya casi está lista.');
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
  }

  // Aquí si fallaron todos los intentos o fue un 4xx no-reintentable
  if (slowTimer) { clearTimeout(slowTimer); slowTimer = null; }
  stopLoadingMessages();
  abortController = null;
  const err = lastErr;

  if (err.status === 402) {
    enableGenerateBtn();
    showScreen('screen-create');
    showToast(err.message || 'Sin sesiones disponibles. Elige un plan para continuar.');
    setTimeout(() => showPaywall(), 900);
    track('paywall_shown', { duration: state.duration });
    return;
  }

  // Fail-soft ElevenLabs: la cuenta del proveedor está saturada.
  // No es culpa del usuario; mensaje educado para no perderlo.
  if (err.status === 503 && /service_busy/i.test(err.message || '')) {
    enableGenerateBtn();
    setLoadingState(
      'error',
      'Estamos a tope ahora mismo',
      'Demasiadas meditaciones componiéndose a la vez. Vuelve en una hora — tu sesión te estará esperando.'
    );
    try { track('audio_service_busy', { plan: state.userPlan, isGuest: !clerk?.user }); } catch (_) {}
    return;
  }
  if (err.status && err.status < 500 && err.status !== 408) {
    enableGenerateBtn();
    if (err.status === 401) {
      showScreen('screen-create');
      showToast('Sesión expirada. Inicia sesión de nuevo.');
      setTimeout(() => openAuth(), 800);
    } else if (err.status === 429) {
      if (!clerk?.user) {
        showScreen('screen-create');
        showToast('Has completado tu meditación de prueba. Crea una cuenta para seguir.');
        setTimeout(() => showPaywall(), 1000);
        track('paywall_shown', { trigger: 'guest_limit_429' });
      } else {
        setLoadingState('error', 'Límite alcanzado', 'Has alcanzado el límite de meditaciones por hora. Vuelve en un momento.');
      }
    } else {
      setLoadingState('error', 'Algo salió mal', err.message || 'Revisa los datos e inténtalo de nuevo.');
    }
    return;
  }

  console.error('Error generando meditación tras todos los reintentos:', err);
  enableGenerateBtn();
  setLoadingState('error', 'Algo salió mal', err.message || 'Revisa tu conexión e inténtalo de nuevo.');
}

async function attemptGeneration(signal) {
  const token = await getAuthToken();
  const email = await getUserEmail();
  const authHeaders = token
    ? { 'Authorization': `Bearer ${token}`, 'x-user-email': email }
    : {};

  setTrailStep(1);
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
  setTrailStep(2);
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
  setTrailStep(3);

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
  _setLoadingText(title, sub);
  const isError = type === 'error';
  document.getElementById('btn-retry').style.display      = isError ? 'block' : 'none';
  document.getElementById('btn-back-input').style.display = isError ? 'block' : 'none';
  document.getElementById('btn-cancel').style.display     = isError ? 'none'  : 'block';
}

function retryFromError()  { enableGenerateBtn(); showScreen('screen-create'); }
function backToInput()     { enableGenerateBtn(); showScreen('screen-create'); }
