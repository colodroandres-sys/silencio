// Render + handlers de la pantalla post-meditación de conversión.
// Variants: 'guest' (sin cuenta) y 'free' (cuenta sin créditos).
//
// Tras la Ronda 2: las pills de duración/voz se eliminaron del HTML
// (eran display-only y generaban disonancia con los selectores reales del
// create). El "Ahora no" también se quitó — el dismiss vive ahora en el ×
// del header del player (ver newMeditation en player.js).

function renderPostSession(variant) {
  const cardId = variant === 'guest' ? 'end-guest' : 'end-upsell';
  const card = document.getElementById(cardId);
  if (!card) return;

  // Hidratar precios desde window.PRICING (single source of truth).
  const promo = (typeof getEssentialFirstMonthPromo === 'function') ? getEssentialFirstMonthPromo() : '$6.99';
  const fullEssential = (window.PRICING?.plans?.essential?.monthly) || '$9.99';
  const ctaEl  = document.getElementById(cardId + '-cta');
  const metaEl = document.getElementById(cardId + '-meta');
  if (ctaEl)  ctaEl.textContent  = 'Desbloquear Stillova por ' + promo;
  if (metaEl) metaEl.textContent = 'primer mes ' + promo + ' · después ' + fullEssential + ' · cancela cuando quieras';

  try { track('post_session_screen_shown', { variant }); } catch (_) {}
}

async function postSessionPrimary(variant) {
  try { track('post_session_cta_primary_clicked', { variant }); } catch (_) {}

  // El CTA primario ofrece la promo $6.99 (Essential mensual primer mes).
  // Marcamos el flag para que el paywall — si el usuario lo abre desde signup
  // o más adelante — muestre el breadcrumb correspondiente.
  sessionStorage.setItem('stillova_promo_essential', '1');

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
      openAuth();
    }
    return;
  }

  // variant === 'free' — usuario autenticado, modal de confirmación + checkout
  if (typeof preCheckoutConfirm === 'function') {
    preCheckoutConfirm('essential');
  } else if (typeof upgradePlan === 'function') {
    upgradePlan('essential');
  } else {
    showPaywall();
  }
}

function postSessionSecondary(variant) {
  try { track('post_session_cta_secondary_clicked', { variant }); } catch (_) {}
  // "Ver todos los planes" — el flag promo ya está, el paywall lo recogerá.
  sessionStorage.setItem('stillova_promo_essential', '1');
  showPaywall();
}
