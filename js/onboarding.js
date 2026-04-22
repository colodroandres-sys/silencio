let obCurrentStep = 1;
const OB_TOTAL_STEPS = 4;

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

  // Ocultar todos los steps
  document.querySelectorAll('.ob-step').forEach(s => s.classList.remove('active'));
  const step = document.getElementById(`ob-${n}`);
  if (step) step.classList.add('active');

  // Actualizar dots
  document.querySelectorAll('.ob-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === n - 1);
  });

  // Back button
  const back = document.getElementById('ob-back');
  if (back) back.style.display = n > 1 ? 'flex' : 'none';

  // Scroll to top
  const screen = document.getElementById('screen-onboarding');
  if (screen) requestAnimationFrame(() => { screen.scrollTop = 0; });
}

function obNext(nextStep) {
  // Guardar selección del paso actual
  if (obCurrentStep === 2) {
    const selected = [...document.querySelectorAll('#ob-topics .ob-option-card.active')]
      .map(c => c.dataset.value);
    obPrefs.topics = selected;
    localStorage.setItem('ob_topics', JSON.stringify(selected));
  }
  obGoToStep(nextStep);
}

function obBack() {
  if (obCurrentStep > 1) {
    obGoToStep(obCurrentStep - 1);
  }
}

// Toggle card multiselect (paso 2)
function obCardToggle(el) {
  el.classList.toggle('active');
}

// Legacy compat: chip toggle
function obChipToggle(el) {
  el.classList.toggle('active');
}

// Legacy compat
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

function obStopPreview() {
  const audio = document.getElementById('audio-preview');
  if (!audio) return;
  audio.pause();
}

// Completar onboarding y ir a crear (paso gratis)
function obSkipToFree() {
  localStorage.setItem('stillova_ob_done', '1');
  applyObPrefsToState();

  const topics = obPrefs.topics || [];
  if (topics.length > 0) {
    const topicPhrases = {
      ansiedad:   'ansiedad',
      sueno:      'dificultades para dormir',
      enfoque:    'falta de enfoque',
      reconectar: 'necesidad de reconectarme',
      otro:       'algo que quiero explorar'
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

// Legacy compat (ob-6 ya no existe pero se puede llamar desde otros JS)
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

function applyObPrefsToState() {
  // Voice y gender se configuran en la pantalla create
}
