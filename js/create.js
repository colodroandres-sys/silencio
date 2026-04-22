function quickAccess(emotionTag, prefillText) {
  state.emotionTag = emotionTag;
  state.userInput  = prefillText;
  showCreate(true);
}

const _QUICK_PROMPT_MAP = {
  'ansioso/a':            { tag: 'ansiedad', text: 'Me siento ansioso/a y necesito calmarme.' },
  'no puedo dormir':      { tag: 'sueno',    text: 'No puedo dormir, mi mente no para.' },
  'antes de una reunión': { tag: 'enfoque',  text: 'Tengo una reunión importante y quiero centrarme.' },
  'necesito enfocarme':   { tag: 'enfoque',  text: 'Necesito enfocarme y no logro concentrarme.' },
  'pausa de 5 min':       { tag: null,       text: 'Necesito una pausa de 5 minutos para despejarme.' }
};
function quickPrompt(label) {
  const m = _QUICK_PROMPT_MAP[label] || { tag: null, text: label };
  quickAccess(m.tag, m.text);
}

function selectFeedback(el) {
  document.querySelectorAll('.end-feedback-row .s-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

function onInputChange() {
  const val = document.getElementById('input-free')?.value.trim() || '';
  const btn = document.getElementById('btn-continue-input');
  if (btn) btn.disabled = val.length < 3;
}

function convoRevealConfig() {
  const el = document.getElementById('input-free');
  const input = el?.value.trim() || '';
  if (input.length < 3) { if (el) shake(el); return; }
  if (input.length > 500) { showCharError(el, `Máximo 500 caracteres (tienes ${input.length})`); return; }
  state.userInput = input;

  const section = document.getElementById('cs-config');
  if (section && section.classList.contains('convo-hidden') && !section.classList.contains('convo-revealed')) {
    section.classList.add('convo-revealed');
    setTimeout(() => {
      const screen = document.getElementById('screen-create');
      const sectionTop = section.offsetTop;
      const btnHeight = 130;
      const screenHeight = screen.clientHeight;
      screen.scrollTo({ top: sectionTop - (screenHeight - btnHeight) / 2, behavior: 'smooth' });
    }, 150);
  }
  document.getElementById('cstep-2')?.classList.add('active');

  // Ocultar botón inline y mostrar solo el sticky
  const bottomRow = document.querySelector('.create-bottom-row');
  if (bottomRow) bottomRow.style.display = 'none';

  const btn = document.getElementById('btn-generate');
  if (btn) { btn.style.opacity = '1'; btn.style.pointerEvents = 'auto'; }
}

function goToGenerate() {
  const input = document.getElementById('input-free')?.value.trim() || '';
  if (!input) { shake(document.getElementById('input-free')); return; }
  if (input.length > 500) { showCharError(document.getElementById('input-free'), `Máximo 500 caracteres`); return; }
  state.userInput = input;
  state.userName = (clerk?.user?.firstName || '').trim().slice(0, 50);
  generateMeditation();
}

function resetCreateScreen() {
  const inputEl = document.getElementById('input-free');
  if (inputEl) inputEl.value = '';

  const csConfig = document.getElementById('cs-config');
  if (csConfig) { csConfig.classList.remove('convo-revealed'); csConfig.classList.add('convo-hidden'); }

  document.getElementById('cstep-2')?.classList.remove('active');

  const btnContinue = document.getElementById('btn-continue-input');
  if (btnContinue) btnContinue.disabled = true;

  const btnGen = document.getElementById('btn-generate');
  if (btnGen) { btnGen.style.opacity = '0'; btnGen.style.pointerEvents = 'none'; }

  const bottomRow = document.querySelector('.create-bottom-row');
  if (bottomRow) bottomRow.style.display = '';

  state.intent     = null;
  state.emotionTag = null;
  state.userInput  = '';
}

function setPillLock(pill, locked) {
  pill.classList.toggle('pill-locked', locked);
  pill.querySelector('.pill-lock')?.remove();
  if (locked) {
    const icon = document.createElement('span');
    icon.className = 'pill-lock';
    icon.textContent = ' 🔒';
    pill.appendChild(icon);
  }
}

function applyAllLocks() {
  const isFree      = !clerk?.user || state.userPlan === 'free';
  const isPremium   = state.userPlan === 'premium';

  document.querySelectorAll('#grp-duration .s-chip').forEach(pill => {
    const val = pill.dataset.value;
    if (val === '20') {
      setPillLock(pill, !isPremium);
    } else {
      setPillLock(pill, isFree && val !== '5');
    }
  });

  if (!isPremium && state.duration === '20') {
    document.querySelectorAll('#grp-duration .s-chip').forEach(p => p.classList.remove('active'));
    document.querySelector('#grp-duration .s-chip[data-value="15"]')?.classList.add('active');
    state.duration = '15';
  }
  if (isFree && state.duration !== '5') {
    document.querySelectorAll('#grp-duration .s-chip').forEach(p => p.classList.remove('active'));
    document.querySelector('#grp-duration .s-chip[data-value="5"]')?.classList.add('active');
    state.duration = '5';
  }

  document.querySelectorAll('#grp-voice .s-chip').forEach(pill => {
    setPillLock(pill, isFree && pill.dataset.value !== 'auto');
  });
  document.querySelectorAll('#grp-gender .s-chip').forEach(pill => {
    setPillLock(pill, isFree && pill.dataset.value !== 'neutro');
  });
  document.querySelectorAll('#grp-music .s-chip').forEach(pill => {
    setPillLock(pill, isFree && pill.dataset.value !== 'auto');
  });

  if (isFree) {
    if (state.voice !== 'auto') {
      document.querySelectorAll('#grp-voice .s-chip').forEach(p => p.classList.remove('active'));
      document.querySelector('#grp-voice .s-chip[data-value="auto"]')?.classList.add('active');
      state.voice = 'auto';
    }
    if (state.gender !== 'neutro') {
      document.querySelectorAll('#grp-gender .s-chip').forEach(p => p.classList.remove('active'));
      document.querySelector('#grp-gender .s-chip[data-value="neutro"]')?.classList.add('active');
      state.gender = 'neutro';
    }
    if (state.music !== 'auto') {
      document.querySelectorAll('#grp-music .s-chip').forEach(p => p.classList.remove('active'));
      document.querySelector('#grp-music .s-chip[data-value="auto"]')?.classList.add('active');
      state.music = 'auto';
    }
  }
}

function applyDurationLocks() { applyAllLocks(); }

const DURATION_CREDITS_UI = { '5': 1, '10': 2, '15': 3, '20': 4 };

function updateCreditsCostDisplay() {
  const remText = document.getElementById('credits-remaining-text');
  if (!remText || state.userPlan === 'free') return;
  const cost = DURATION_CREDITS_UI[state.duration] || 1;
  const rem  = state.creditsRemaining;
  const after = Math.max(0, rem - cost);
  remText.textContent = `Esta sesión usará ${cost} crédito${cost !== 1 ? 's' : ''} · Te quedan ${rem} (${after} tras esta sesión)`;
}

function selectPill(el, groupId, key) {
  if (el.classList.contains('pill-locked')) {
    showPaywall();
    track('paywall_shown', { trigger: 'pill_lock', value: el.dataset.value });
    return;
  }
  document.querySelectorAll(`#${groupId} .s-chip`).forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  state[key] = el.dataset.value;
  if (key === 'duration') updateCreditsCostDisplay();
}
