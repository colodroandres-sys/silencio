function showScreen(id) {
  if (id !== 'screen-library' && typeof libActiveId !== 'undefined' && libActiveId) {
    const la = document.getElementById('lib-audio');
    if (la) la.pause();
    if (typeof libSetPlayingState === 'function') libSetPlayingState(libActiveId, false);
    libActiveId = null;
    clearInterval(libProgressInterval);
  }

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

  // Actualizar tab activo
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  if (id === 'screen-home')    document.getElementById('nav-home')?.classList.add('active');
  if (id === 'screen-library') document.getElementById('nav-library')?.classList.add('active');
  if (id === 'screen-profile') document.getElementById('nav-profile')?.classList.add('active');
}

function showHome() {
  resetCreateScreen();
  showScreen('screen-home');
  // Actualizar home al entrar
  if (typeof updateHomeDisplay === 'function') updateHomeDisplay();
}

function openLibrary() {
  if (!clerk?.user) {
    clerk?.openSignIn();
    return;
  }
  loadLibrary();
  showScreen('screen-library');
}

function openProfile() {
  updateProfileScreen();
  showScreen('screen-profile');
}

function showCreate(skipToConfig = false) {
  if (obPrefs.voice !== 'auto' && state.userPlan !== 'free') {
    state.voice = obPrefs.voice;
    document.querySelectorAll('#grp-voice .s-chip').forEach(p => p.classList.remove('active'));
    document.querySelector(`#grp-voice .s-chip[data-value="${obPrefs.voice}"]`)?.classList.add('active');
  }
  if (obPrefs.gender !== 'neutro') {
    state.gender = obPrefs.gender;
    document.querySelectorAll('#grp-gender .s-chip').forEach(p => p.classList.remove('active'));
    document.querySelector(`#grp-gender .s-chip[data-value="${obPrefs.gender}"]`)?.classList.add('active');
  }
  if (obPrefs.duration && obPrefs.duration !== '5') {
    const allowed = state.userPlan === 'premium' || (state.userPlan === 'essential' && obPrefs.duration !== '20');
    if (allowed) {
      state.duration = obPrefs.duration;
      document.querySelectorAll('#grp-duration .s-chip').forEach(p => p.classList.remove('active'));
      document.querySelector(`#grp-duration .s-chip[data-value="${obPrefs.duration}"]`)?.classList.add('active');
    }
  }

  if (skipToConfig) {
    // No pre-llenamos el textarea — el usuario escribe su propia situación
    // Revelamos el config directamente sin validar input
    const section = document.getElementById('cs-config');
    if (section && !section.classList.contains('convo-revealed')) {
      section.classList.add('convo-revealed');
    }
    document.getElementById('cstep-2')?.classList.add('active');
    const bottomRow = document.querySelector('.create-bottom-row');
    if (bottomRow) bottomRow.style.display = 'none';
    const btnGen = document.getElementById('btn-generate');
    if (btnGen) { btnGen.style.opacity = '1'; btnGen.style.pointerEvents = 'auto'; }
  }

  const banner = document.getElementById('no-credits-banner');
  if (banner) banner.style.display = (clerk?.user && !state.userCanGenerate) ? 'flex' : 'none';

  const guestHint = document.getElementById('create-guest-hint');
  if (guestHint) guestHint.style.display = !clerk?.user ? 'block' : 'none';

  applyAllLocks();
  updateCreditsCostDisplay();
  showScreen('screen-create');
  if (!skipToConfig) {
    setTimeout(() => document.getElementById('input-free')?.focus(), 300);
  }
}

// Actualizar pantalla de perfil
function updateProfileScreen() {
  const user = clerk?.user;
  const guestEl = document.getElementById('profile-guest');
  const userEl  = document.getElementById('profile-user');
  if (!user) {
    if (guestEl) guestEl.style.display = '';
    if (userEl)  userEl.style.display  = 'none';
    return;
  }
  if (guestEl) guestEl.style.display = 'none';
  if (userEl)  userEl.style.display  = '';

  // Nombre e inicial
  const name = user.firstName || user.username || 'Tú';
  const el = document.getElementById('profile-name');
  if (el) el.textContent = name;
  const avatarEl = document.getElementById('profile-avatar');
  if (avatarEl) avatarEl.textContent = name[0].toUpperCase();
  const planInfo = document.getElementById('profile-plan-info');
  if (planInfo) planInfo.textContent = (state.userPlan === 'premium' ? 'Premium' : state.userPlan === 'essential' ? 'Essential' : 'Gratis') + ' · Stillova';

  // Estadísticas de gamificación
  const streak = typeof gamData !== 'undefined' ? (gamData.streak || 0) : 0;
  const totalMin = typeof gamData !== 'undefined' ? (gamData.totalMinutes || 0) : 0;
  const sessions = typeof gamData !== 'undefined' ? (gamData.sessions || 0) : 0;
  const avg = sessions > 0 ? Math.round(totalMin / sessions) : 0;

  const setEl = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  setEl('profile-stat-streak', streak);
  setEl('profile-stat-total', totalMin);
  setEl('profile-stat-sessions', sessions);
  setEl('profile-stat-avg', avg);

  // Nivel
  const levelData = typeof getLevelData === 'function' ? getLevelData() : null;
  if (levelData) {
    setEl('profile-level-eyebrow', 'nivel ' + levelData.level);
    setEl('profile-level-name', '<em>' + levelData.name + '</em>');
    const nameEl = document.getElementById('profile-level-name');
    if (nameEl) nameEl.innerHTML = '<em>' + levelData.name + '</em>';
    const bar = document.getElementById('profile-level-bar');
    if (bar) bar.style.width = levelData.pct + '%';
    setEl('profile-level-meta', levelData.points + ' / 100 → nivel ' + (levelData.level + 1));
  }
}

// Actualizar home display según estado de usuario
function updateHomeDisplay() {
  const user = clerk?.user;
  const guestBar  = document.getElementById('home-guest-bar');
  const userBar   = document.getElementById('home-user-bar');
  const guestBody = document.getElementById('home-guest-content');
  const userBody  = document.getElementById('home-user-content');

  if (!user) {
    if (guestBar)  guestBar.style.display  = '';
    if (userBar)   userBar.style.display   = 'none';
    if (guestBody) guestBody.style.display = '';
    if (userBody)  userBody.style.display  = 'none';
  } else {
    if (guestBar)  guestBar.style.display  = 'none';
    if (userBar)   userBar.style.display   = '';
    if (guestBody) guestBody.style.display = 'none';
    if (userBody)  userBody.style.display  = '';
    _updateUserHomeContent();
  }

  // Fecha/hora en ambas vistas
  _updateTimeGreeting();
}

function _updateTimeGreeting() {
  const now = new Date();
  const h = now.getHours();
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const dayStr = days[now.getDay()];
  const dateStr = dayStr + ', ' + now.getDate() + ' ' + months[now.getMonth()];
  const partStr = h < 12 ? 'Mañana' : h < 20 ? 'Tarde' : 'Noche';

  const timeEyebrow = document.getElementById('home-time-eyebrow');
  if (timeEyebrow) timeEyebrow.textContent = dayStr + ' · ' + partStr;

  const dateEyebrow = document.getElementById('home-date-eyebrow');
  if (dateEyebrow) dateEyebrow.textContent = dateStr;

  const greetingSerifEl = document.getElementById('home-greeting-serif');
  if (greetingSerifEl) {
    const saludo = h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
    const user = clerk?.user;
    const name = user ? (user.firstName || '') : '';
    greetingSerifEl.innerHTML = saludo + (name ? ', <em>' + name + '</em>' : '');
  }
}

function _updateUserHomeContent() {
  const user = clerk?.user;
  if (!user) return;

  // Avatar inicial
  const name = user.firstName || user.username || 'T';
  const avatarBtn = document.getElementById('home-avatar-initial');
  if (avatarBtn) avatarBtn.textContent = name[0].toUpperCase();

  // Streak
  const streak = typeof gamData !== 'undefined' ? (gamData.streak || 0) : 0;
  const streakStrip = document.getElementById('home-streak-strip');
  if (streakStrip) {
    streakStrip.style.display = streak > 0 ? '' : 'none';
    const numEl = document.getElementById('home-streak-num');
    if (numEl) numEl.textContent = streak;
    // Barras últimos 7 días
    const barsEl = document.getElementById('home-streak-bars');
    if (barsEl) {
      const history = (typeof gamData !== 'undefined' && gamData.weekHistory) || [1,1,1,1,1,1,0];
      barsEl.innerHTML = history.map(on => `<div class="streak-bar ${on ? 'on' : 'off'}"></div>`).join('');
    }
  }

  // Stats
  const statsGrid = document.getElementById('home-stats-grid');
  if (statsGrid) statsGrid.style.display = '';
  const weekMin = typeof gamData !== 'undefined' ? (gamData.weekMinutes || 0) : 0;
  const levelNum = typeof gamData !== 'undefined' ? (gamData.level || 1) : 1;
  const levelName = typeof gamData !== 'undefined' ? (gamData.levelName || 'Principiante') : 'Principiante';

  const setEl = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  setEl('home-stat-minutes', weekMin);
  setEl('home-stat-level', levelNum);
  setEl('home-stat-level-name', levelName);
}
