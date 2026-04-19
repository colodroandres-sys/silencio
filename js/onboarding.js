let obCurrentStep = 1;
const OB_TOTAL_STEPS = 5;

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
  document.querySelectorAll('.ob-step').forEach(s => s.classList.remove('active'));
  const step = document.getElementById(`ob-${n}`);
  if (step) step.classList.add('active');
  const pct = n <= OB_TOTAL_STEPS ? (n / OB_TOTAL_STEPS) * 100 : 100;
  const fill = document.getElementById('ob-progress-fill');
  if (fill) fill.style.width = `${pct}%`;
  const back = document.getElementById('ob-back');
  if (back) back.style.display = n > 1 ? 'flex' : 'none';
}

function obNext(nextStep) {
  if (obCurrentStep === 1) {
    const selected = [...document.querySelectorAll('#ob-topics .ob-chip.active')].map(c => c.dataset.value);
    obPrefs.topics = selected;
    localStorage.setItem('ob_topics', JSON.stringify(selected));
  }
  obGoToStep(nextStep);
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
  if (el.classList.contains('ob-dur-locked')) {
    const badge = el.querySelector('.ob-dur-plan-badge');
    const plan = badge ? badge.textContent : 'Essential';
    showToast(`Disponible con el plan ${plan}`);
    return;
  }
  document.querySelectorAll('.ob-dur-card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  obPrefs.duration = el.dataset.value;
  localStorage.setItem('ob_duration', el.dataset.value);
}

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
  localStorage.setItem('stillova_ob_done', '1');
  applyObPrefsToState();

  if (!clerk || !clerk.user) {
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
    showScreen('screen-home');
    return;
  }
  showHome();
  updateUserStatus();
  loadHomeData();
}

function applyObPrefsToState() {
  state.voice    = obPrefs.voice;
  state.gender   = obPrefs.gender;
  state.duration = obPrefs.duration;
}
