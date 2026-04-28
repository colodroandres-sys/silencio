// Recuperación de meditación pendiente:
// si el usuario generó la meditación (Claude + ElevenLabs ya pagados) pero no
// la escuchó, guardamos el audio en localStorage hasta 24h. Banner en home le
// permite reanudarla sin volver a gastar el crédito.
//
// Caso real que motivó el feature: un user (papá del founder) configuró su
// primera meditación gratis pero quiso esperar a un momento más tranquilo.
// La app le bloqueó el segundo intento porque ya había consumido el free.
// Solución: el audio queda 24h en LS y se ofrece reanudación.

const PENDING_KEY    = 'stillova_pending_audio_v1';
const PENDING_META   = 'stillova_pending_meta_v1';
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const LISTEN_THRESHOLD_SEC = 30;

function savePendingMeditation(audioBase64, meta) {
  try {
    const payload = {
      ...meta,
      generatedAt: Date.now()
    };
    localStorage.setItem(PENDING_KEY, audioBase64);
    localStorage.setItem(PENDING_META, JSON.stringify(payload));
    try { track('pending_meditation_saved', { duration: meta?.duration }); } catch (_) {}
  } catch (e) {
    // Quota exceeded (audios largos no caben). Limpiamos por si quedó parcial.
    try {
      localStorage.removeItem(PENDING_KEY);
      localStorage.removeItem(PENDING_META);
    } catch (_) {}
  }
}

function getPendingMeditation() {
  try {
    const audioBase64 = localStorage.getItem(PENDING_KEY);
    const metaRaw     = localStorage.getItem(PENDING_META);
    if (!audioBase64 || !metaRaw) return null;
    const meta = JSON.parse(metaRaw);
    if (!meta?.generatedAt) return null;
    if (Date.now() - meta.generatedAt > PENDING_TTL_MS) {
      clearPendingMeditation();
      return null;
    }
    return { audioBase64, meta };
  } catch (_) {
    return null;
  }
}

function clearPendingMeditation() {
  try {
    localStorage.removeItem(PENDING_KEY);
    localStorage.removeItem(PENDING_META);
  } catch (_) {}
}

function _formatPendingAge(generatedAt) {
  const min = Math.floor((Date.now() - generatedAt) / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr === 1) return 'hace 1 hora';
  return `hace ${hr} horas`;
}

function renderPendingBanner() {
  const pending = getPendingMeditation();
  const guestBanner = document.getElementById('pending-meditation-banner');
  const userBanner  = document.getElementById('pending-meditation-banner-user');

  if (!pending) {
    if (guestBanner) guestBanner.style.display = 'none';
    if (userBanner)  userBanner.style.display  = 'none';
    return;
  }

  const age = _formatPendingAge(pending.meta.generatedAt);
  const subText = `La generaste ${age}. Está lista cuando lo estés.`;

  const isGuest = !window.clerk?.user;
  if (isGuest && guestBanner) {
    guestBanner.style.display = 'flex';
    const sub = document.getElementById('pending-banner-sub');
    if (sub) sub.textContent = subText;
    if (userBanner) userBanner.style.display = 'none';
  } else if (!isGuest && userBanner) {
    userBanner.style.display = 'flex';
    const sub = document.getElementById('pending-banner-sub-user');
    if (sub) sub.textContent = subText;
    if (guestBanner) guestBanner.style.display = 'none';
  }
}

function resumePendingMeditation() {
  const pending = getPendingMeditation();
  if (!pending) {
    renderPendingBanner();
    return;
  }
  try { track('pending_meditation_resumed', { duration: pending.meta?.duration }); } catch (_) {}

  try {
    const binary = atob(pending.audioBase64);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });

    if (state.audioBlobUrl) URL.revokeObjectURL(state.audioBlobUrl);
    state.audioBlobUrl = URL.createObjectURL(audioBlob);

    state.duration   = pending.meta.duration || state.duration;
    state.voice      = pending.meta.voice || state.voice;
    state.intent     = pending.meta.intent || state.intent;
    state.emotionTag = pending.meta.emotionTag || state.emotionTag;
    state.userInput  = pending.meta.userInput || state.userInput;
    state.userName   = pending.meta.userName || state.userName;
    state.silenceMap = (pending.meta.silenceMap || []).map(s => ({ ...s, _done: false }));
    state.totalSec   = pending.meta.totalSec || (parseInt(state.duration) * 60);
    state.silenceOffset = 0;
    state.currentSec    = 0;

    const titleEl = document.getElementById('session-title');
    if (titleEl) titleEl.textContent = pending.meta.title || '';

    const timeEnd = document.getElementById('time-end');
    if (timeEnd) timeEnd.textContent = formatTime(state.totalSec);
    const timeNow = document.getElementById('time-now');
    if (timeNow) timeNow.textContent = '0:00';
    const cd = document.getElementById('time-countdown');
    if (cd) cd.textContent = formatTime(state.totalSec);

    connectAudio(state.audioBlobUrl);
    showScreen('screen-player');
  } catch (e) {
    console.error('Error reanudando meditación pendiente:', e);
    clearPendingMeditation();
    renderPendingBanner();
  }
}

// Llamado desde audio.ontimeupdate cuando el user ha escuchado lo suficiente
// para considerar la meditación "consumida". Limpia el LS para liberar espacio
// y para que el banner desaparezca al volver a home.
let _pendingListenedMarked = false;
function markPendingAsListenedIfApplicable(currentSec) {
  if (_pendingListenedMarked) return;
  if (currentSec < LISTEN_THRESHOLD_SEC) return;
  _pendingListenedMarked = true;
  clearPendingMeditation();
  try { track('pending_meditation_consumed', {}); } catch (_) {}
}

function _resetPendingListenedFlag() { _pendingListenedMarked = false; }
