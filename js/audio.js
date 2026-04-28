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

function connectAudio(url) {
  const audio = document.getElementById('audio');
  audio.src = url;
  loadRandomAmbient();
  audio.ontimeupdate = () => {
    if (!state.isPlaying || state.inSilence) return;
    state.currentSec = Math.round(audio.currentTime + state.silenceOffset);
    updateProgress();
    // Tras 30s escuchados, marcamos la meditación pendiente como consumida
    // (libera localStorage y oculta el banner al volver a home).
    if (typeof markPendingAsListenedIfApplicable === 'function') {
      markPendingAsListenedIfApplicable(state.currentSec);
    }
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
