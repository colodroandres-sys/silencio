// ── Ring SVG animation ──────────────────────────────────────
const RING_CIRCUMFERENCE = 289.03; // 2π × r=46
let _ringDotRaf = null;
let _ringDotStart = null;

function startRingDotAnimation() {
  if (_ringDotRaf) return;
  function animate(ts) {
    if (!_ringDotStart) _ringDotStart = ts;
    const t = (ts - _ringDotStart) / 1000;
    const phase = (Math.sin(t * 2 * Math.PI / 5.5) + 1) / 2;
    const r = 2 + phase * 1.2;
    const dot = document.getElementById('player-dot');
    if (dot) dot.setAttribute('r', r.toFixed(2));
    _ringDotRaf = requestAnimationFrame(animate);
  }
  _ringDotRaf = requestAnimationFrame(animate);
}

function stopRingDotAnimation() {
  if (_ringDotRaf) { cancelAnimationFrame(_ringDotRaf); _ringDotRaf = null; _ringDotStart = null; }
}

function seekOffset(seconds) {
  const audio = document.getElementById('audio');
  if (!audio || !audio.duration) return;
  if (state.silenceTimeoutId) { clearTimeout(state.silenceTimeoutId); state.silenceTimeoutId = null; }
  if (state.silenceTimer)     { clearInterval(state.silenceTimer); state.silenceTimer = null; }
  state.inSilence = false;
  audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds));
  state.currentSec = Math.round(audio.currentTime + state.silenceOffset);
  updateProgress();
  if (state.isPlaying) {
    audio.play().then(() => { scheduleNextSilence(audio); }).catch(console.error);
  }
}

function togglePlay() {
  const audio = document.getElementById('audio');

  if (state.isPlaying) {
    if (state.silenceTimer)     { clearInterval(state.silenceTimer); state.silenceTimer = null; }
    if (state.silenceTimeoutId) { clearTimeout(state.silenceTimeoutId); state.silenceTimeoutId = null; }
    if (state.introTimeoutId)   { clearTimeout(state.introTimeoutId); state.introTimeoutId = null; }
    state.inSilence = false;
    audio.pause();
    ambientPause();
    state.isPlaying = false;
    stopRingDotAnimation();
    document.getElementById('icon-play').style.display  = 'block';
    document.getElementById('icon-pause').style.display = 'none';
  } else {
    if (audio.src && audio.src !== window.location.href) {
      const isFirstPlay = audio.currentTime === 0;
      if (isFirstPlay) {
        ambientPlay();
        state.isPlaying = true;
        state.inSilence = false;
        startRingDotAnimation();
        document.getElementById('icon-play').style.display  = 'none';
        document.getElementById('icon-pause').style.display = 'block';
        // iOS Safari requiere que audio.play() se llame sincrónicamente dentro del
        // handler del gesto del usuario.
        const unlockPromise = audio.play();
        if (unlockPromise) unlockPromise.then(() => { audio.pause(); audio.currentTime = 0; }).catch(() => {});
        state.introTimeoutId = setTimeout(() => {
          state.introTimeoutId = null;
          if (!state.isPlaying) return;
          audio.currentTime = 0;
          audio.play().then(() => { scheduleNextSilence(audio); }).catch(console.error);
        }, 3000);
      } else {
        audio.play().then(() => {
          state.isPlaying = true;
          state.inSilence = false;
          startRingDotAnimation();
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
  const remaining = Math.max(0, state.totalSec - state.currentSec);
  document.getElementById('time-now').textContent = formatTime(state.currentSec);
  const timeEnd = document.getElementById('time-end');
  if (timeEnd) timeEnd.textContent = '−' + formatTime(remaining);
  const countdown = document.getElementById('time-countdown');
  if (countdown) countdown.textContent = formatTime(remaining);
  const ring = document.getElementById('player-ring-fill');
  if (ring) ring.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - pct / 100);
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
  const wrapEl = document.getElementById('breathing-player'); if (wrapEl) wrapEl.classList.add('paused');
  stopRingDotAnimation();
  ambientFadeOut();

  document.getElementById('end-message').style.display        = 'block';
  document.getElementById('btn-new-meditation').style.display = 'none';
  document.getElementById('end-save').style.display           = 'none';
  document.getElementById('end-upsell').style.display         = 'none';
  document.getElementById('end-profile').style.display        = 'none';
  document.getElementById('end-guest').style.display          = 'none';
  document.getElementById('screen-player').classList.remove('end-active');

  const statusPromise = fetchUserStatus();
  const delayPromise  = new Promise(resolve => setTimeout(resolve, 5000));

  Promise.all([statusPromise, delayPromise]).then(() => {
    document.getElementById('end-message').style.display = 'none';

    if (!clerk?.user) {
      document.getElementById('end-guest').style.display = 'flex';
      document.getElementById('screen-player').classList.add('end-active');
      return;
    }

    if (state.userPlan === 'free' && !state.userCanGenerate) {
      if (!state.profileCompleted) {
        document.getElementById('end-profile').style.display = 'flex';
        document.getElementById('screen-player').classList.add('end-active');
      } else {
        document.getElementById('end-upsell').style.display = 'flex';
        document.getElementById('screen-player').classList.add('end-active');
      }
    } else if (state.userPlan !== 'free' && state.currentMeditationId) {
      const atLimit = state.saveLimit !== null && state.savedCount >= state.saveLimit;
      const slotsLeft = state.saveLimit !== null ? state.saveLimit - state.savedCount : '∞';
      const title = document.getElementById('session-title')?.textContent || '';
      const technique = document.getElementById('player-technique-label')?.textContent || '';
      showEndAccount({
        duration: state.totalSec,
        title,
        technique,
        slotsLeft: atLimit ? 0 : slotsLeft,
        streak: state.streak,
        showSave: !atLimit
      });
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
  const wrapEl = document.getElementById('breathing-player'); if (wrapEl) wrapEl.classList.add('paused');

  document.getElementById('end-message').style.display        = 'none';
  document.getElementById('btn-new-meditation').style.display = 'none';
  document.getElementById('end-upsell').style.display         = 'none';
  document.getElementById('end-profile').style.display        = 'none';
  document.getElementById('end-save').style.display           = 'none';
  document.getElementById('end-guest').style.display          = 'none';
  document.getElementById('screen-player').classList.remove('end-active');

  resetCreateScreen();
  showScreen('screen-home');
  if (clerk?.user) loadHomeData();
}
