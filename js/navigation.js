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
  const createBtn = document.querySelector('.nav-create-btn');
  if (createBtn) createBtn.classList.remove('active');
  if (id === 'screen-home') {
    document.getElementById('nav-home')?.classList.add('active');
  } else if (id === 'screen-create') {
    if (createBtn) createBtn.classList.add('active');
  }
}

function showHome() {
  resetCreateScreen();
  showScreen('screen-home');
}

function openLibrary() {
  if (!clerk?.user) {
    clerk?.openSignIn({ afterSignInUrl: '/dashboard.html', afterSignUpUrl: '/dashboard.html' });
    return;
  }
  window.location.href = '/dashboard.html';
}

function showCreate(skipToConfig = false) {
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
    document.getElementById('input-free').value = state.userInput;
    const btnContinue = document.getElementById('btn-continue-input');
    if (btnContinue) btnContinue.disabled = false;
    convoRevealIntent();
  }

  applyAllLocks();
  showScreen('screen-create');
}
