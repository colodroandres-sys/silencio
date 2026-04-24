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
    const hideNav = id === 'screen-loading' || id === 'screen-player' || id === 'screen-onboarding' || id === 'screen-end-account';
    nav.classList.toggle('hidden', hideNav);
  }

  const footer = document.querySelector('.site-footer');
  if (footer) footer.style.display = (id === 'screen-home') ? '' : 'none';

  // Actualizar tab activo
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  if (id === 'screen-home')    document.getElementById('nav-home')?.classList.add('active');
  if (id === 'screen-create')  document.getElementById('nav-home')?.classList.add('active');
  if (id === 'screen-library') document.getElementById('nav-library')?.classList.add('active');
  if (id === 'screen-profile') document.getElementById('nav-profile')?.classList.add('active');
}

function showHome() {
  resetCreateScreen();
  showScreen('screen-home');
  // Actualizar home al entrar
  if (typeof updateHomeDisplay === 'function') updateHomeDisplay();
}

function showEndAccount(opts = {}) {
  const { duration = 0, title = '', technique = '', slotsLeft = 0, streak = 0, showSave = true } = opts;

  const mins = duration ? Math.round(duration / 60) : 0;
  const eyebrow = document.getElementById('end-account-eyebrow');
  if (eyebrow) eyebrow.textContent = `${mins > 0 ? mins + ':00' : '—'} · completado${streak > 0 ? ' · racha +1' : ''}`;

  const display = document.getElementById('end-account-display');
  if (display) display.innerHTML = 'Buen trabajo, <em>tú</em>.';

  const sessionTitle = document.getElementById('end-account-session-title');
  if (sessionTitle) sessionTitle.textContent = title || '—';
  const sessionMeta = document.getElementById('end-account-session-meta');
  if (sessionMeta) sessionMeta.textContent = technique || '—';

  const slots = document.getElementById('end-account-slots');
  if (slots) slots.textContent = slotsLeft;

  const saveCard = document.getElementById('end-account-save-card');
  if (saveCard) saveCard.style.display = showSave ? '' : 'none';
  const savedMsg = document.getElementById('end-account-saved-msg');
  if (savedMsg) savedMsg.style.display = 'none';

  document.querySelectorAll('.end-account-feel-chips .s-chip').forEach(c => c.classList.remove('active'));

  showScreen('screen-end-account');
}

function endAccountSave() {
  if (typeof saveMeditation === 'function') saveMeditation();
  const saveCard = document.getElementById('end-account-save-card');
  if (saveCard) saveCard.style.display = 'none';
  const savedMsg = document.getElementById('end-account-saved-msg');
  if (savedMsg) savedMsg.style.display = 'flex';
}

function endAccountDiscard() {
  const saveCard = document.getElementById('end-account-save-card');
  if (saveCard) saveCard.style.display = 'none';
}

function endAccountFeel(btn) {
  document.querySelectorAll('.end-account-feel-chips .s-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
}

function openLibrary() {
  if (!clerk?.user) {
    // Mostrar biblioteca con estado guest en vez de abrir sign-in directo
    const loading = document.getElementById('lib-loading');
    const libContent = document.getElementById('lib-content');
    const libError = document.getElementById('lib-error');
    if (loading) loading.style.display = 'none';
    if (libContent) libContent.style.display = 'none';
    if (libError) {
      libError.style.display = '';
      document.getElementById('lib-error-msg').textContent = 'Crea una cuenta para guardar tus meditaciones y reescucharlas cuando quieras.';
      const libBtn = libError.querySelector('button');
      if (libBtn) libBtn.textContent = 'Crear cuenta gratis';
    }
    showScreen('screen-library');
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
  if (!skipToConfig) {
    state.userInput = '';
    const ta = document.getElementById('input-free');
    if (ta) ta.value = '';
  }

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
    const allowed = state.userPlan === 'premium' || state.userPlan === 'studio' || (state.userPlan === 'essential' && obPrefs.duration !== '20');
    if (allowed) {
      state.duration = obPrefs.duration;
      document.querySelectorAll('#grp-duration .s-chip').forEach(p => p.classList.remove('active'));
      document.querySelector(`#grp-duration .s-chip[data-value="${obPrefs.duration}"]`)?.classList.add('active');
    }
  }

  if (skipToConfig) {
    // Si hay texto en state.userInput (del onboarding), pre-llenarlo en el textarea
    if (state.userInput) {
      const ta = document.getElementById('input-free');
      if (ta) {
        ta.value = state.userInput;
        const counter = document.getElementById('char-count');
        if (counter) counter.textContent = state.userInput.length + '/500';
      }
    }
    const section = document.getElementById('cs-config');
    if (section && !section.classList.contains('convo-revealed')) {
      section.classList.remove('convo-hidden');
      section.classList.add('convo-revealed');
    }
    document.getElementById('cstep-2')?.classList.add('active');
    const btnGen = document.getElementById('btn-generate');
    if (btnGen) { btnGen.style.opacity = '1'; btnGen.style.pointerEvents = 'auto'; }
  }

  const isUser = !!clerk?.user;

  // Header eyebrow según flujo
  const eyebrow = document.getElementById('create-header-eyebrow');
  if (eyebrow) eyebrow.textContent = isUser ? 'nueva sesión' : 'primera sesión · gratis';

  // Heading/subtitle: solo para invitados
  const createHeadline = document.querySelector('#cs-input .create-headline');
  const createBody = document.querySelector('#cs-input .create-body-muted');
  if (createHeadline) createHeadline.style.display = isUser ? 'none' : '';
  if (createBody) createBody.style.display = isUser ? 'none' : '';

  // Quick prompts: ocultar para usuarios con cuenta
  const quickPrompts = document.querySelector('.create-quick-prompts');
  if (quickPrompts) quickPrompts.style.display = isUser ? 'none' : '';

  // Mostrar config inmediatamente (un solo flujo sin paso intermedio)
  const section = document.getElementById('cs-config');
  if (section && !section.classList.contains('convo-revealed')) {
    section.classList.remove('convo-hidden');
    section.classList.add('convo-revealed');
  }

  // btn-generate empieza deshabilitado; onInputChange lo activa al escribir
  const btnGen = document.getElementById('btn-generate');
  if (btnGen && !skipToConfig) {
    const currentInput = (document.getElementById('input-free')?.value || '').trim();
    const ready = currentInput.length >= 3;
    btnGen.style.opacity = ready ? '1' : '0.45';
    btnGen.style.pointerEvents = ready ? 'auto' : 'none';
  }

  const banner = document.getElementById('no-credits-banner');
  if (banner) banner.style.display = (clerk?.user && !state.userCanGenerate) ? 'flex' : 'none';

  const guestHint = document.getElementById('create-guest-hint');
  if (guestHint) guestHint.style.display = !clerk?.user ? 'block' : 'none';

  const lockedCard = document.getElementById('create-locked-card');
  if (lockedCard) lockedCard.style.display = !clerk?.user ? '' : 'none';

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

  const setEl = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };

  // Nombre, inicial y email
  const email = user.primaryEmailAddress?.emailAddress || '';
  const emailPrefix = email.split('@')[0];
  const name = user.firstName || user.username || emailPrefix || 'Tú';
  setEl('profile-name', name);
  setEl('profile-email', email);
  const avatarEl = document.getElementById('profile-avatar');
  if (avatarEl) {
    // Si el user tiene imageUrl de Clerk, usarla. Si no, inicial.
    if (user.imageUrl) {
      avatarEl.innerHTML = `<img src="${user.imageUrl}" alt="${name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    } else {
      avatarEl.textContent = name[0].toUpperCase();
    }
  }

  // "Plan · desde mes año"
  const planInfo = document.getElementById('profile-plan-info');
  if (planInfo) {
    const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const created = user.createdAt ? new Date(user.createdAt) : null;
    const sinceStr = created ? 'desde ' + months[created.getMonth()] + ' ' + created.getFullYear() : '';
    planInfo.textContent = sinceStr || '—';
  }

  // Estadísticas de gamificación
  const streak   = state.streak          || 0;
  const totalMin = state.minutesThisWeek || 0;
  const sessions = state.totalSessions   || 0;
  const avg      = sessions > 0 ? Math.round(totalMin / sessions) : 0;
  setEl('profile-stat-streak',   streak);
  setEl('profile-stat-total',    totalMin);
  setEl('profile-stat-sessions', sessions);
  setEl('profile-stat-avg',      avg);

  // Level card
  const levelCard = document.getElementById('profile-level-card');
  if (levelCard) {
    const sessions = state.totalSessions || 0;
    const ld = _getLevelData(sessions);
    const eyebrowEl = document.getElementById('profile-level-eyebrow');
    const nameEl    = document.getElementById('profile-level-name-text');
    const barEl     = document.getElementById('profile-level-bar');
    const metaEl    = document.getElementById('profile-level-meta');
    if (eyebrowEl) eyebrowEl.textContent = 'nivel ' + ld.num;
    if (nameEl)    nameEl.textContent    = ld.name;
    if (barEl)     barEl.style.width     = ld.progress + '%';
    if (metaEl)    metaEl.textContent    = ld.meta;
    levelCard.style.display = '';
  }

  // Plan card
  const planNames  = { free: 'Gratis', essential: 'Essential', premium: 'Premium', studio: 'Studio' };
  const planPrices = { free: '—', essential: '€9,99/mes', premium: '€19,99/mes', studio: '€39,99/mes' };
  const plan = state.userPlan || 'free';
  setEl('profile-plan-name-display',  planNames[plan]  || plan);
  setEl('profile-plan-price-display', planPrices[plan] || '—');

  // Texto del botón cambia según plan: free dice "ver planes", pagos dicen "gestionar plan"
  const manageBtn = document.getElementById('profile-manage-plan-btn');
  if (manageBtn) manageBtn.textContent = plan === 'free' ? 'ver planes →' : 'gestionar plan →';

  // Barra de créditos
  const creditBar = document.getElementById('profile-plan-credit-bar');
  const creditInfo = document.getElementById('profile-plan-credit-info');
  const totalCr = { essential: 10, premium: 25, studio: 60 };
  const total = totalCr[plan] || 0;
  const used  = state.creditsUsed || (total - (state.creditsRemaining || 0));
  if (creditBar && total > 0) creditBar.style.width = Math.min(100, (used / total) * 100) + '%';
  if (creditInfo && total > 0) creditInfo.textContent = used + ' de ' + total + ' créditos usados este mes';
  if (creditInfo && plan === 'free') creditInfo.textContent = 'Plan gratuito';

  // Ajustes — mostrar valores actuales
  _updateProfileSettings();
}

function _getLevelData(sessions) {
  if (sessions >= 30) return { num: 5, name: 'Calma',      progress: 100, meta: 'nivel máximo alcanzado' };
  if (sessions >= 15) return { num: 4, name: 'Presente',   progress: Math.round((sessions - 15) / 15 * 100), meta: sessions + ' / 30 → Calma' };
  if (sessions >= 5)  return { num: 3, name: 'Consciente', progress: Math.round((sessions - 5)  / 10 * 100), meta: sessions + ' / 15 → Presente' };
  if (sessions >= 1)  return { num: 2, name: 'Explorador', progress: Math.round(sessions / 5 * 100),         meta: sessions + ' / 5 → Consciente' };
  return { num: 1, name: 'Inquieto', progress: 0, meta: '0 / 1 → Explorador' };
}

function _updateProfileSettings() {
  const isFree = !clerk?.user || state.userPlan === 'free';
  const isPremiumOrStudio = state.userPlan === 'premium' || state.userPlan === 'studio';

  const voiceLabels    = { auto: 'Automática', feminine: 'Femenina', masculine: 'Masculina' };
  const genderLabels   = { neutro: 'Neutro', femenino: 'Mujer', masculino: 'Hombre' };
  const durationLabels = { '5': '5 min', '10': '10 min', '15': '15 min', '20': '20 min' };

  const voiceEl = document.getElementById('profile-setting-voice');
  if (voiceEl) voiceEl.textContent = voiceLabels[obPrefs.voice || 'auto'] || 'Automática';

  const genderEl = document.getElementById('profile-setting-gender');
  if (genderEl) genderEl.textContent = genderLabels[obPrefs.gender || 'neutro'] || 'Neutro';

  const durEl = document.getElementById('profile-setting-duration');
  if (durEl) durEl.textContent = durationLabels[obPrefs.duration || '5'] || '5 min';

  // Bloquear si es free
  const voiceRow = document.getElementById('profile-setting-row-voice');
  if (voiceRow) voiceRow.classList.toggle('profile-setting-locked', isFree);
  const genderRow = document.getElementById('profile-setting-row-gender');
  if (genderRow) genderRow.classList.toggle('profile-setting-locked', isFree);
  const durRow = document.getElementById('profile-setting-row-duration');
  if (durRow) durRow.classList.toggle('profile-setting-locked', false); // duración siempre visible
}

function profileToggleSetting(key) {
  const isFree = !clerk?.user || state.userPlan === 'free';
  const isPremiumOrStudio = state.userPlan === 'premium' || state.userPlan === 'studio';

  if (key === 'voice') {
    if (isFree) { showPaywall(); return; }
    const opts = ['auto', 'feminine', 'masculine'];
    const cur  = opts.indexOf(obPrefs.voice || 'auto');
    obPrefs.voice = opts[(cur + 1) % opts.length];
    state.voice = obPrefs.voice;
  } else if (key === 'gender') {
    if (isFree) { showPaywall(); return; }
    const opts = ['neutro', 'femenino', 'masculino'];
    const cur  = opts.indexOf(obPrefs.gender || 'neutro');
    obPrefs.gender = opts[(cur + 1) % opts.length];
    state.gender = obPrefs.gender;
  } else if (key === 'duration') {
    const maxOpts = isPremiumOrStudio ? ['5','10','15','20'] : state.userPlan === 'essential' ? ['5','10','15'] : ['5'];
    if (maxOpts.length === 1) { showPaywall(); return; }
    const cur = maxOpts.indexOf(obPrefs.duration || '5');
    obPrefs.duration = maxOpts[(cur + 1) % maxOpts.length];
    state.duration = obPrefs.duration;
  }

  try { localStorage.setItem('obPrefs', JSON.stringify(obPrefs)); } catch(e) {}
  _updateProfileSettings();
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
  const dateStr = dayStr + ' · ' + now.getDate() + ' ' + months[now.getMonth()];

  const timeEyebrow = document.getElementById('home-time-eyebrow');
  if (timeEyebrow) timeEyebrow.textContent = dateStr;

  const dateEyebrow = document.getElementById('home-date-eyebrow');
  if (dateEyebrow) dateEyebrow.textContent = dateStr;

  const greetingSerifEl = document.getElementById('home-greeting-serif');
  if (greetingSerifEl) {
    const user = clerk?.user;
    const name = user ? (user.firstName || '') : '';
    const nameStr = name ? ', ' + name + '.' : '.';
    greetingSerifEl.innerHTML = 'Hola' + nameStr + ' <em>¿Cómo estás?</em> <span class="faded">De verdad.</span>';
  }
}

function _updateUserHomeContent() {
  const user = clerk?.user;
  if (!user) return;

  const setEl = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };

  // Avatar inicial
  const name = user.firstName || user.username || 'T';
  const avatarBtn = document.getElementById('home-avatar-initial');
  if (avatarBtn) avatarBtn.textContent = name[0].toUpperCase();

  // Plan label en CTA
  const planLabels = { essential: 'Essential', premium: 'Premium', studio: 'Studio', free: '' };
  const ctaPlan = document.getElementById('home-cta-plan');
  if (ctaPlan) ctaPlan.textContent = planLabels[state.userPlan] || '';

  // Streak — copy compasivo cuando es 0 (no castigar al usuario nuevo)
  const streak = state.streak || 0;
  const streakStrip = document.getElementById('home-streak-strip');
  if (streakStrip) {
    streakStrip.style.display = '';
    const numEl = document.getElementById('home-streak-num');
    const unitEl = streakStrip.querySelector('.streak-unit');
    const subEl  = streakStrip.querySelector('.streak-sublabel');
    if (streak === 0) {
      if (numEl)  numEl.textContent = '';
      if (unitEl) unitEl.textContent = 'Empieza tu racha';
      if (subEl)  subEl.textContent = 'una sesión hoy y arranca';
    } else {
      if (numEl)  numEl.textContent = streak;
      if (unitEl) unitEl.textContent = streak === 1 ? 'día' : 'días';
      if (subEl)  subEl.textContent = 'racha actual';
    }

    // Círculos por día
    const barsEl = document.getElementById('home-streak-bars');
    if (barsEl) {
      const history = state.weekHistory || [0,0,0,0,0,0,0];
      const dayLabels = ['L','M','X','J','V','S','D'];
      barsEl.innerHTML = history.map((on, i) => `
        <div class="streak-day-col">
          <div class="streak-day-circle ${on ? 'on' : 'off'}">
            ${on ? '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6l2.5 2.5L9.5 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
          </div>
          <span class="streak-day-label">${dayLabels[i]}</span>
        </div>
      `).join('');
    }
  }

  // Stats
  const statsGrid = document.getElementById('home-stats-grid');
  if (statsGrid) statsGrid.style.display = '';
  const weekMin  = state.minutesThisWeek || 0;
  const levelNum  = 1;
  const levelName = state.level || 'Principiante';
  setEl('home-stat-minutes',    weekMin);
  setEl('home-stat-level',      levelNum);
  setEl('home-stat-level-name', levelName);

  // Mostrar recents de inmediato con estado vacío (se reemplaza si llegan datos)
  const recentsContainer = document.getElementById('home-recents');
  const recentsList      = document.getElementById('home-recents-list');
  if (recentsContainer && recentsList && recentsContainer.style.display === 'none') {
    recentsList.innerHTML = '<p class="home-recents-empty">Tu primera sesión aparecerá aquí.</p>';
    recentsContainer.style.display = 'block';
  }
}
