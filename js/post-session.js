// Render + handlers de la pantalla post-meditación de conversión.
// Variants: 'guest' (sin cuenta) y 'free' (cuenta sin créditos).

const POST_SESSION_PILLS = {
  duration: [
    { value: '5',  label: '5 min' },
    { value: '10', label: '10 min' },
    { value: '15', label: '15 min' },
    { value: '20', label: '20 min' }
  ],
  voice: [
    { value: 'feminine',  label: 'Femenina' },
    { value: 'masculine', label: 'Masculina' }
  ]
};

const POST_SESSION_CHECK_SVG =
  '<svg class="post-session-pill-check" viewBox="0 0 11 11" fill="none" aria-hidden="true">' +
  '<path d="M2 5.5l2.2 2.2L9 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
  '</svg>';

function _postSessionUsedConfig() {
  return {
    duration: String(state.duration || ''),
    // state.voice puede venir como 'auto' antes de generar; tras generar el backend
    // resuelve a 'feminine'/'masculine' y se asigna a state.voice.
    voice: (state.voice && state.voice !== 'auto') ? state.voice : null
  };
}

function renderPostSession(variant) {
  const cardId = variant === 'guest' ? 'end-guest' : 'end-upsell';
  const card = document.getElementById(cardId);
  if (!card) return;

  const used = _postSessionUsedConfig();

  card.querySelectorAll('.post-session-pills').forEach(group => {
    const groupKey = group.dataset.group;
    const opts = POST_SESSION_PILLS[groupKey] || [];
    const usedValue = used[groupKey];
    group.innerHTML = opts.map(opt => {
      const isUsed = usedValue && usedValue === opt.value;
      return '<span class="post-session-pill' + (isUsed ? ' post-session-pill--used' : '') + '">'
           + (isUsed ? POST_SESSION_CHECK_SVG : '')
           + opt.label
           + '</span>';
    }).join('');
  });

  try { track('post_session_screen_shown', { variant }); } catch (_) {}
}

function _hidePostSessionCards() {
  const guest = document.getElementById('end-guest');
  const free  = document.getElementById('end-upsell');
  if (guest) guest.style.display = 'none';
  if (free)  free.style.display  = 'none';
  document.getElementById('screen-player')?.classList.remove('end-active');
}

async function postSessionPrimary(variant) {
  try { track('post_session_cta_primary_clicked', { variant }); } catch (_) {}

  if (variant === 'guest') {
    // Tras signup, auth.js completa el checkout automáticamente.
    sessionStorage.setItem('pendingCheckout', 'essential');
    if (!clerk) {
      let waited = 0;
      while (!clerk && waited < 30) { await new Promise(r => setTimeout(r, 100)); waited++; }
    }
    if (clerk) {
      clerk.openSignUp({ afterSignInUrl: window.location.href, afterSignUpUrl: window.location.href });
    } else {
      // Fallback: abrir auth genérico
      openAuth();
    }
    return;
  }

  // variant === 'free' — usuario autenticado, ir directo a checkout
  if (typeof upgradePlan === 'function') {
    upgradePlan('essential');
  } else {
    showPaywall();
  }
}

function postSessionSecondary(variant) {
  try { track('post_session_cta_secondary_clicked', { variant }); } catch (_) {}
  showPaywall();
}

function postSessionDismiss(variant) {
  try { track('post_session_dismissed', { variant }); } catch (_) {}
  _hidePostSessionCards();
  newMeditation();
}
