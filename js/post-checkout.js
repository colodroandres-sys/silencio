// Pantalla post-checkout: nombre + ¿qué quieres trabajar?
// Aparece la primera vez que el usuario completa un upgrade exitoso.
// Ambos inputs son opcionales. Skip lleva directo a home.

const POST_CHECKOUT_DONE_KEY = 'stillova_post_checkout_done';
let _postCheckoutSelected = new Set();

function postCheckoutChipToggle(btn) {
  const v = btn.dataset.value;
  if (!v) return;
  if (_postCheckoutSelected.has(v)) {
    _postCheckoutSelected.delete(v);
    btn.classList.remove('active');
  } else {
    _postCheckoutSelected.add(v);
    btn.classList.add('active');
  }
}

function shouldShowPostCheckout() {
  // Solo si: el usuario está logueado, tiene plan de pago, y aún no completó la pantalla
  if (!clerk?.user) return false;
  if (state.userPlan === 'free' || !state.userPlan) return false;
  if (localStorage.getItem(POST_CHECKOUT_DONE_KEY) === '1') return false;

  // Si ya tenemos referred_as Y no hay nada más por preguntar (intent topics), saltar entera
  const hasName = !!(clerk?.user?.firstName || localStorage.getItem('stillova_referred_as'));
  const hasTopics = !!localStorage.getItem('ob_topics');
  if (hasName && hasTopics) return false;

  return true;
}

function showPostCheckout() {
  // Reset state UI
  _postCheckoutSelected = new Set();
  const nameEl = document.getElementById('post-checkout-name');
  const referredAs = localStorage.getItem('stillova_referred_as') || '';
  const existingName = clerk?.user?.firstName || referredAs || '';
  if (nameEl) nameEl.value = existingName;
  const otherEl = document.getElementById('post-checkout-other');
  if (otherEl) otherEl.value = '';
  document.querySelectorAll('#post-checkout-chips .s-chip').forEach(c => c.classList.remove('active'));

  // Si ya tenemos nombre (Clerk firstName o referred_as de home guest), ocultar la sección entera
  const nameSection = document.getElementById('post-checkout-name-section');
  const divider = document.getElementById('post-checkout-divider');
  if (existingName) {
    if (nameSection) nameSection.style.display = 'none';
    if (divider) divider.style.display = 'none';
  } else {
    if (nameSection) nameSection.style.display = '';
    if (divider) divider.style.display = '';
  }

  try { track('post_checkout_screen_shown', { hasNamePrefilled: !!existingName }); } catch (_) {}
  showScreen('screen-post-checkout');
  // Foco al primer campo visible
  setTimeout(() => {
    if (existingName) {
      document.getElementById('post-checkout-other')?.focus();
    } else {
      nameEl?.focus();
    }
  }, 350);
}

async function postCheckoutSubmit() {
  const name = (document.getElementById('post-checkout-name')?.value || '').trim().slice(0, 50);
  const other = (document.getElementById('post-checkout-other')?.value || '').trim().slice(0, 200);
  const topics = Array.from(_postCheckoutSelected);

  // Persistir nombre en Clerk (mejor) si cambió
  if (name && clerk?.user && name !== clerk.user.firstName) {
    try {
      await clerk.user.update({ firstName: name });
      state.userName = name;
    } catch (e) {
      console.warn('[post-checkout] update firstName failed', e);
      // Fallback: localStorage
      localStorage.setItem('stillova_user_name', name);
      state.userName = name;
    }
  } else if (name) {
    state.userName = name;
  }

  // Sincronizar con referred_as (la fuente que usa home guest y el prompt de meditación)
  if (name) {
    try { localStorage.setItem('stillova_referred_as', name); } catch (_) {}
  }

  // Persistir topics en obPrefs + localStorage
  if (topics.length > 0) {
    obPrefs.topics = topics;
    try { localStorage.setItem('ob_topics', JSON.stringify(topics)); } catch (_) {}
  }
  if (other) {
    try { localStorage.setItem('stillova_intent_other', other); } catch (_) {}
  }

  try {
    track('post_checkout_submitted', {
      hasName: !!name,
      topicsCount: topics.length,
      hasOther: !!other,
      topics
    });
  } catch (_) {}

  localStorage.setItem(POST_CHECKOUT_DONE_KEY, '1');

  // Recargar saludo y avatar con el nombre nuevo si toca
  if (typeof updateHomeDisplay === 'function') updateHomeDisplay();
  if (typeof updateProfileScreen === 'function') updateProfileScreen();

  showHome();
  if (typeof loadHomeData === 'function') loadHomeData();
}

function postCheckoutSkip() {
  try { track('post_checkout_skipped', {}); } catch (_) {}
  localStorage.setItem(POST_CHECKOUT_DONE_KEY, '1');
  showHome();
  if (typeof loadHomeData === 'function') loadHomeData();
}
