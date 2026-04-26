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
  'pausa de 5 min':       { tag: null,       text: 'Necesito una pausa de 5 minutos para despejarme.' },
  'primera meditación':   { tag: null,       text: 'Es mi primera meditación guiada. No sé muy bien qué esperar, pero quiero estar presente y tranquilo/a.' }
};
function quickPrompt(label) {
  const m = _QUICK_PROMPT_MAP[label] || { tag: null, text: label };
  state.emotionTag = m.tag;
  state.userInput  = m.text;
  const ta = document.getElementById('input-free');
  if (ta) {
    ta.value = m.text;
    ta.focus();
    onInputChange();
  }
}

function homeGuestChip(label) {
  const m = _QUICK_PROMPT_MAP[label] || { tag: null, text: label };
  state.emotionTag = m.tag;
  const ta = document.getElementById('home-guest-textarea');
  if (ta) {
    ta.value = m.text;
    ta.focus();
    homeGuestInputChange();
  }
}

function homeGuestInputChange() {
  const val = document.getElementById('home-guest-textarea')?.value || '';
  const btn = document.getElementById('home-guest-gen-btn');
  if (btn) btn.style.opacity = val.trim().length >= 3 ? '1' : '0.45';
  const counter = document.getElementById('home-guest-char-count');
  if (counter) counter.textContent = val.length + '/500';
}

function homeGuestGenerate() {
  const val = document.getElementById('home-guest-textarea')?.value.trim() || '';
  if (val.length < 3) return;
  state.userInput = val;
  generateMeditation();
}

function selectFeedback(el) {
  document.querySelectorAll('.end-feedback-row .s-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

function onInputChange() {
  const raw = document.getElementById('input-free')?.value || '';
  const val = raw.trim();
  const counter = document.getElementById('char-count');
  if (counter) counter.textContent = raw.length + '/500';

  // Activar/desactivar sticky btn-generate según haya texto
  const btnGen = document.getElementById('btn-generate');
  if (btnGen) {
    const ready = val.length >= 3;
    btnGen.style.opacity = ready ? '1' : '0.45';
    btnGen.style.pointerEvents = ready ? 'auto' : 'none';
  }
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

  document.getElementById('cstep-2')?.classList.remove('active');

  const btnGen = document.getElementById('btn-generate');
  if (btnGen) { btnGen.style.opacity = '0.45'; btnGen.style.pointerEvents = 'none'; }

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
  const isStudio    = state.userPlan === 'studio';
  const canUse20    = isPremium || isStudio;

  document.querySelectorAll('#grp-duration .s-chip').forEach(pill => {
    const val = pill.dataset.value;
    if (val === '20') {
      setPillLock(pill, !canUse20);
    } else {
      setPillLock(pill, isFree && val !== '5');
    }
  });

  if (!canUse20 && state.duration === '20') {
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
    setPillLock(pill, isFree);
  });
  document.querySelectorAll('#grp-gender .s-chip').forEach(pill => {
    setPillLock(pill, isFree && pill.dataset.value !== 'neutro');
  });

  if (isFree) {
    if (state.voice !== 'auto') {
      state.voice = 'auto';
    }
    if (state.gender !== 'neutro') {
      document.querySelectorAll('#grp-gender .s-chip').forEach(p => p.classList.remove('active'));
      document.querySelector('#grp-gender .s-chip[data-value="neutro"]')?.classList.add('active');
      state.gender = 'neutro';
    }
  }
  if (state.music !== 'auto') state.music = 'auto';
}

function applyDurationLocks() { applyAllLocks(); }

function updateCreditsCostDisplay() {
  const remText = document.getElementById('credits-remaining-text');
  if (!remText || state.userPlan === 'free') return;
  const cost = state.durationCredits[state.duration] || 1;
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
