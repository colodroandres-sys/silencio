let obCurrentStep = 1;
const OB_TOTAL_STEPS = 2;

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
  const screen = document.getElementById('screen-onboarding');
  if (screen) screen.scrollTop = 0;
}

function obNext(nextStep) {
  if (obCurrentStep === 1) {
    const selected = [...document.querySelectorAll('#ob-topics .ob-chip.active')].map(c => c.dataset.value);
    obPrefs.topics = selected;
    localStorage.setItem('ob_topics', JSON.stringify(selected));
  }
  obGoToStep(nextStep);
}

function obBack() {
  if (obCurrentStep > 1) {
    // Desde paywall (6) volver al objetivo (3), desde objetivo (3) volver a temas (1)
    const prev = obCurrentStep === 6 ? 3 : 1;
    obGoToStep(prev);
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
  const hint = document.getElementById('ob-3-hint');
  if (hint) hint.classList.add('hidden');
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

  const topics = obPrefs.topics || [];
  if (topics.length > 0) {
    const topicPhrases = {
      ansiedad:   'ansiedad',
      trabajo:    'estrés en el trabajo',
      relaciones: 'mis relaciones',
      familia:    'mi familia',
      sueno:      'dificultades para dormir',
      enfoque:    'falta de enfoque',
      decisiones: 'una decisión que no puedo resolver',
      soltar:     'algo que necesito soltar'
    };
    const parts = topics.slice(0, 2).map(t => topicPhrases[t] || t).join(' y ');
    state.userInput = `Últimamente he tenido en mente ${parts}.`;
    showCreate(true);
  } else {
    showCreate();
  }

  if (clerk?.user) {
    updateUserStatus();
    loadHomeData();
  }
}

function applyObPrefsToState() {
  // Voice y gender se configuran en la pantalla create, no en onboarding
  // Duration queda en default '5' hasta que el usuario elija en create
}
