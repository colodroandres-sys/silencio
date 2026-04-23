let libAllMeditations = [];
let libActiveEmotion = '';
let libActiveDuration = '';
let libActiveId = null;
let libProgressInterval = null;

function loadLibrary() {
  if (libActiveId) {
    const a = document.getElementById('lib-audio');
    if (a) a.pause();
    libActiveId = null;
    clearInterval(libProgressInterval);
  }
  libAllMeditations = [];
  libActiveEmotion  = '';
  libActiveDuration = '';

  document.getElementById('lib-loading').style.display = 'block';
  document.getElementById('lib-error').style.display   = 'none';
  document.getElementById('lib-content').style.display = 'none';

  document.querySelectorAll('#lib-filter-emotion .filter-pill, #lib-filter-duration .filter-pill')
    .forEach(p => p.classList.remove('active'));
  document.querySelector('#lib-filter-emotion .filter-pill[data-val=""]')?.classList.add('active');
  document.querySelector('#lib-filter-duration .filter-pill[data-val=""]')?.classList.add('active');

  fetchLibraryData();
}

async function fetchLibraryData() {
  try {
    const token = await clerk.session?.getToken({ skipCache: true });
    if (!token) {
      clerk?.openSignIn();
      return;
    }
    const email = clerk.user?.primaryEmailAddress?.emailAddress || '';
    const res = await fetch('/api/dashboard', {
      headers: { 'Authorization': `Bearer ${token}`, 'x-user-email': email }
    });
    if (res.status === 401) {
      // Token válido en Clerk pero rechazado por el servidor — la sesión caducó del todo
      document.getElementById('lib-loading').style.display = 'none';
      clerk?.openSignIn();
      return;
    }
    if (!res.ok) { showLibError('Error al cargar la biblioteca. Inténtalo de nuevo.'); return; }
    renderLibraryData(await res.json());
  } catch (e) {
    console.error('[library]', e);
    showLibError('Error de conexión. Comprueba tu internet.');
  }
}

function showLibError(msg) {
  document.getElementById('lib-loading').style.display = 'none';
  const el = document.getElementById('lib-error');
  if (msg) el.querySelector('p').textContent = msg;
  el.style.display = 'block';
}

function renderLibraryData(data) {
  const { plan, usage, limit, totalMinutes, streak, totalSessions, meditations } = data;

  const badge = document.getElementById('lib-plan-badge');
  const planNames = { free: 'Gratis', essential: 'Essential', premium: 'Premium', studio: 'Studio' };
  badge.textContent = planNames[plan] || plan;
  badge.className   = `plan-badge plan-${plan}`;

  const creditsEl = document.getElementById('lib-credits');
  creditsEl.textContent = (plan !== 'free')
    ? `${limit - usage} crédito${(limit - usage) !== 1 ? 's' : ''} este mes`
    : '';

  document.getElementById('lib-stat-streak').textContent   = streak || 0;
  document.getElementById('lib-stat-minutes').textContent  = totalMinutes || 0;
  document.getElementById('lib-stat-sessions').textContent = totalSessions || 0;

  libAllMeditations = meditations || [];
  renderLibraryList(libAllMeditations);
  initLibFilters();

  document.getElementById('lib-loading').style.display = 'none';
  document.getElementById('lib-content').style.display = 'block';
}

function initLibFilters() {
  const emotionEl  = document.getElementById('lib-filter-emotion');
  const durationEl = document.getElementById('lib-filter-duration');
  const newEmo = emotionEl.cloneNode(true);
  const newDur = durationEl.cloneNode(true);
  emotionEl.parentNode.replaceChild(newEmo, emotionEl);
  durationEl.parentNode.replaceChild(newDur, durationEl);

  newEmo.addEventListener('click', e => {
    const pill = e.target.closest('.filter-pill');
    if (!pill) return;
    newEmo.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    libActiveEmotion = pill.dataset.val;
    applyLibFilters();
  });
  newDur.addEventListener('click', e => {
    const pill = e.target.closest('.filter-pill');
    if (!pill) return;
    newDur.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    libActiveDuration = pill.dataset.val;
    applyLibFilters();
  });
}

function applyLibFilters() {
  let filtered = libAllMeditations;
  if (libActiveEmotion)  filtered = filtered.filter(m => m.emotion_tag === libActiveEmotion);
  if (libActiveDuration) filtered = filtered.filter(m => String(m.duration) === libActiveDuration);
  renderLibraryList(filtered);
}

function renderLibraryList(meditations) {
  const countEl = document.getElementById('lib-count');
  if (countEl) {
    const n = libAllMeditations.length;
    countEl.textContent = n + ' guardada' + (n !== 1 ? 's' : '');
  }
  const el = document.getElementById('lib-list');
  if (!meditations || meditations.length === 0) {
    el.innerHTML = libAllMeditations.length === 0
      ? `<div class="dash-empty">
           <strong>Aún no hay nada guardado.</strong>
           Cuando termines una meditación, pulsa "Guardar en mi biblioteca" para volver a escucharla.
           <br>
           <button class="dash-create-btn" onclick="showCreate()">Crear una meditación</button>
         </div>`
      : `<div class="dash-empty-filter">Ninguna meditación coincide con los filtros seleccionados.</div>`;
  } else {
    el.innerHTML = meditations.map(renderLibMedCard).join('');
  }
}

function renderLibMedCard(m) {
  const hasAudio   = !!m.audioUrl;
  const id         = m.id;
  const voiceLabel = m.voice === 'masculine' ? 'Voz masculina' : 'Voz femenina';

  const playBtn = hasAudio ? `
    <button class="med-card-play med-play-btn" id="lib-play-btn-${id}" onclick="libTogglePlay('${id}','${libEscapeAttr(m.audioUrl)}',${m.duration})">
      <svg id="lib-icon-play-${id}" width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 2.5l8 4.5-8 4.5V2.5z" fill="currentColor"/></svg>
      <svg id="lib-icon-pause-${id}" width="14" height="14" viewBox="0 0 14 14" fill="none" style="display:none">
        <rect x="2.5" y="2" width="3" height="10" rx="1" fill="currentColor"/>
        <rect x="8.5" y="2" width="3" height="10" rx="1" fill="currentColor"/>
      </svg>
    </button>` : `<div style="width:36px"></div>`;

  const player = hasAudio ? `
    <div class="med-player" id="lib-player-${id}">
      <div class="med-progress-row">
        <span class="med-time" id="lib-time-${id}">0:00</span>
        <div class="med-progress-track" onclick="libSeekMed('${id}',event)">
          <div class="med-progress-fill" id="lib-fill-${id}"></div>
        </div>
        <span class="med-time med-time-end" id="lib-dur-${id}">-</span>
      </div>
    </div>` : '';

  const emotionLabels = { ansiedad:'Ansiedad', sueno:'Sueño', claridad:'Claridad', liberacion:'Liberación', enfoque:'Enfoque' };
  const intentLabels  = { soltar:'Soltar', entender:'Entender', calmar:'Calmar' };
  const tagsHtml = (m.emotion_tag || m.intent) ? `
    <div class="med-tags">
      ${m.emotion_tag ? `<span class="med-tag">${emotionLabels[m.emotion_tag] || m.emotion_tag}</span>` : ''}
      ${m.intent      ? `<span class="med-tag intent">${intentLabels[m.intent]  || m.intent}</span>`   : ''}
    </div>` : '';

  return `
    <div class="med-card">
      <div class="med-card-header">
        <div>
          <div class="med-card-title">${libEscapeHtml(m.title)}</div>
          <div class="med-card-meta">
            <span>${libFormatDate(m.created_at)}</span>
            <span>${m.duration} min</span>
            <span>${voiceLabel}</span>
          </div>
          ${tagsHtml}
          ${player}
        </div>
        ${playBtn}
      </div>
    </div>`;
}

function libTogglePlay(id, audioUrl, durationMin) {
  const libAudio = document.getElementById('lib-audio');
  if (libActiveId === id) {
    if (libAudio.paused) { libAudio.play(); libSetPlayingState(id, true); }
    else                 { libAudio.pause(); libSetPlayingState(id, false); }
    return;
  }
  if (libActiveId) {
    libAudio.pause();
    libSetPlayingState(libActiveId, false);
    document.getElementById(`lib-player-${libActiveId}`)?.classList.remove('visible');
  }
  clearInterval(libProgressInterval);
  libActiveId    = id;
  libAudio.src   = audioUrl;
  document.getElementById(`lib-player-${id}`)?.classList.add('visible');
  document.getElementById(`lib-dur-${id}`).textContent = `${durationMin}:00`;
  libAudio.play().catch(() => {
    libActiveId = null;
    document.getElementById(`lib-player-${id}`)?.classList.remove('visible');
  });
  libSetPlayingState(id, true);
  libProgressInterval = setInterval(() => {
    if (!libAudio.duration) return;
    const fill   = document.getElementById(`lib-fill-${id}`);
    const timeEl = document.getElementById(`lib-time-${id}`);
    if (fill)   fill.style.width = `${(libAudio.currentTime / libAudio.duration) * 100}%`;
    if (timeEl) timeEl.textContent = libFormatTime(Math.floor(libAudio.currentTime));
  }, 400);
  libAudio.onended = () => {
    libSetPlayingState(id, false);
    clearInterval(libProgressInterval);
    const fill   = document.getElementById(`lib-fill-${id}`);
    const timeEl = document.getElementById(`lib-time-${id}`);
    if (fill)   fill.style.width = '0%';
    if (timeEl) timeEl.textContent = '0:00';
    libActiveId = null;
  };
}

function libSeekMed(id, event) {
  const libAudio = document.getElementById('lib-audio');
  if (libActiveId !== id || !libAudio.duration) return;
  const rect  = event.currentTarget.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  libAudio.currentTime = ratio * libAudio.duration;
}

function libSetPlayingState(id, playing) {
  const btn    = document.getElementById(`lib-play-btn-${id}`);
  const iPlay  = document.getElementById(`lib-icon-play-${id}`);
  const iPause = document.getElementById(`lib-icon-pause-${id}`);
  if (!btn) return;
  btn.classList.toggle('playing', playing);
  if (iPlay)  iPlay.style.display  = playing ? 'none'  : 'block';
  if (iPause) iPause.style.display = playing ? 'block' : 'none';
}

function libFormatTime(s) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

function libFormatDate(iso) {
  const d   = new Date(iso);
  const now = new Date();
  const s   = dt => dt.toISOString().slice(0, 10);
  if (s(d) === s(now)) return 'Hoy';
  if (s(d) === s(new Date(Date.now() - 86400000))) return 'Ayer';
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const label  = `${d.getDate()} ${months[d.getMonth()]}`;
  return d.getFullYear() !== now.getFullYear() ? `${label} ${d.getFullYear()}` : label;
}

function libEscapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function libEscapeAttr(s) {
  return String(s || '').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
