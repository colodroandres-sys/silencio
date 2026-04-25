let clerk = null;
let pendingGeneration = false;

async function openAuth() {
  if (clerk) {
    clerk.openSignIn({ afterSignInUrl: window.location.href, afterSignUpUrl: window.location.href });
    return;
  }
  let waited = 0;
  while (!clerk && waited < 30) { await new Promise(r => setTimeout(r, 100)); waited++; }
  if (clerk) clerk.openSignIn({ afterSignInUrl: window.location.href, afterSignUpUrl: window.location.href });
}

async function initClerk() {
  try {
    let attempts = 0;
    while (!window.Clerk && attempts < 50) {
      await new Promise(r => setTimeout(r, 100));
      attempts++;
    }
    if (!window.Clerk) throw new Error('Clerk no cargó');

    clerk = window.Clerk;
    await clerk.load({
      localization: {
        locale: 'es-ES',
        signIn: {
          start: {
            title: 'Entra en Stillova',
            subtitle: 'Bienvenido/a de nuevo',
            actionText: '¿No tienes cuenta?',
            actionLink: 'Regístrate'
          },
          password: { title: 'Introduce tu contraseña', subtitle: 'Bienvenido/a de nuevo' },
          forgotPasswordAlternativeMethods: { blockButton__resetPassword: 'Restablecer contraseña' },
          emailCode: { title: 'Revisa tu email', subtitle: 'Introduce el código que te hemos enviado' }
        },
        signUp: {
          start: {
            title: 'Crea tu cuenta',
            subtitle: 'Empieza a meditar con Stillova',
            actionText: '¿Ya tienes cuenta?',
            actionLink: 'Inicia sesión'
          },
          emailCode: { title: 'Verifica tu email', subtitle: 'Introduce el código que te hemos enviado' }
        },
        userButton: {
          action__signOut: 'Cerrar sesión',
          action__manageAccount: 'Gestionar cuenta'
        },
        formFieldLabel__emailAddress: 'Email',
        formFieldLabel__password: 'Contraseña',
        formButtonPrimary: 'Continuar',
        dividerText: 'o',
        socialButtonsBlockButton: 'Continuar con {{provider|titleize}}'
      },
      appearance: {
        variables: {
          colorPrimary:         '#c9a96e',
          colorBackground:      '#0c1109',
          colorText:            '#f2ede4',
          colorTextSecondary:   'rgba(242,237,228,0.65)',
          colorInputBackground: 'rgba(242,237,228,0.07)',
          colorInputText:       '#f2ede4',
          borderRadius:         '14px',
          fontFamily:           'Inter, sans-serif'
        }
      }
    });

    if (sessionStorage.getItem('pending_generation') === '1') {
      pendingGeneration = true;
      sessionStorage.removeItem('pending_generation');
    }

    clerk.addListener(({ user }) => {
      updateUserStatus();

      // Si el usuario está logueado pero localStorage fue limpiado → saltar onboarding
      if (user && !localStorage.getItem('stillova_ob_done')) {
        localStorage.setItem('stillova_ob_done', '1');
        showHome();
        loadHomeData();
        return;
      }

      const pendingPlan = sessionStorage.getItem('ob_pending_plan');
      if (user && pendingPlan) {
        sessionStorage.removeItem('ob_pending_plan');
        if (pendingPlan !== 'free') { upgradePlan(pendingPlan); } else { showHome(); fetchUserStatus(); }
        return;
      }

      // Conversión post-meditación: guest tras signup → checkout Essential automático
      const pendingCheckout = sessionStorage.getItem('pendingCheckout');
      if (user && pendingCheckout === 'essential') {
        sessionStorage.removeItem('pendingCheckout');
        upgradePlan('essential');
        return;
      }

      if (user && pendingGeneration) {
        pendingGeneration = false;
        generateMeditation();
      }
    });

    updateUserStatus();
    checkUrlParams();

    // Routing inmediato — siempre muestra algo sin esperar al listener
    if (!localStorage.getItem('stillova_ob_done')) {
      showOnboarding();
    } else {
      showHome();
      if (clerk.user) loadHomeData();
    }
  } catch (e) {
    console.error('[clerk] Error de inicialización:', e);
  }
}

async function loadHomeData() {
  try {
    const token = await getAuthToken();
    const email = await getUserEmail();
    const res = await fetch('/api/dashboard', {
      headers: { 'Authorization': `Bearer ${token}`, 'x-user-email': email }
    });
    if (!res.ok) return;
    const data = await res.json();
    updateHomeGamification(data);
    renderHomeRecents(data.recentMeditations);
  } catch (e) {
    console.error('[homeData]', e);
  }
}

async function updateUserStatus() {
  const el    = document.getElementById('user-status');
  const guest = document.getElementById('guest-actions');
  if (!el) return;

  const guestIntro = document.getElementById('home-guest-intro');

  if (!clerk || !clerk.user) {
    el.style.display    = 'none';
    if (guest) guest.style.display = 'flex';
    if (guestIntro) guestIntro.style.display = 'block';
    const quickLabel = document.getElementById('home-quick-label');
    if (quickLabel) quickLabel.style.display = 'block';
    const guestBlock = document.getElementById('guest-name-block');
    if (guestBlock) guestBlock.style.display = 'block';
    applyDurationLocks();
    return;
  }

  el.style.display    = 'flex';
  if (guest) guest.style.display = 'none';
  if (guestIntro) guestIntro.style.display = 'none';

  const cachedPlan = localStorage.getItem('stillova_plan');
  if (cachedPlan && cachedPlan !== 'free') {
    state.userPlan = cachedPlan;
    applyDurationLocks();
  }

  fetchUserStatus();
}

async function fetchUserStatus() {
  if (!clerk || !clerk.user) return;
  if (!clerk.session) {
    state.userCanGenerate = false;
    applyDurationLocks();
    return;
  }
  try {
    const token = await clerk.session.getToken();
    const email = clerk.user.primaryEmailAddress?.emailAddress || '';

    const res = await fetch('/api/user', {
      headers: { 'Authorization': `Bearer ${token}`, 'x-user-email': email }
    });
    if (!res.ok) {
      if (res.status === 401) {
        state.userCanGenerate = false;
        state.userPlan = localStorage.getItem('stillova_plan') || 'free';
        applyDurationLocks();
      }
      return;
    }

    const { plan, usage, limit, canGenerate,
            streak, minutesThisWeek, totalSessions, level,
            savedCount, saveLimit, durationCredits } = await res.json();

    const planEl  = document.getElementById('plan-badge');
    const usageEl = document.getElementById('usage-info');

    state.userPlan           = plan;
    state.userCanGenerate    = canGenerate;
    state.creditsRemaining   = Math.max(0, limit - usage);
    state.creditsLimit       = limit;
    state.savedCount         = savedCount ?? 0;
    state.saveLimit          = saveLimit ?? null;
    if (durationCredits) state.durationCredits = durationCredits;
    localStorage.setItem('stillova_plan', plan);

    if (planEl) {
      const planNames = { free: 'Gratis', essential: 'Essential', premium: 'Premium', studio: 'Studio' };
      planEl.textContent = planNames[plan] || plan;
      planEl.className   = `plan-badge plan-${plan}`;
    }
    if (usageEl) {
      if (plan === 'free') {
        usageEl.textContent = canGenerate ? 'Meditación gratis disponible' : 'Sin créditos disponibles';
      } else {
        const rem = limit - usage;
        usageEl.textContent = `${rem} meditación${rem !== 1 ? 'es' : ''} disponible${rem !== 1 ? 's' : ''}`;
      }
    }

    const guestBlock = document.getElementById('guest-name-block');
    if (guestBlock) guestBlock.style.display = 'none';
    applyDurationLocks();

    updateHomeGamification({ streak, minutesThisWeek, totalSessions, level });

    const greetEl = document.getElementById('home-greeting');
    const displayName = clerk?.user?.firstName || clerk?.user?.fullName?.split(' ')[0] || '';
    if (greetEl) {
      const h = new Date().getHours();
      const greet = h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
      greetEl.textContent = displayName
        ? `${greet}, ${displayName}.`
        : '¿Cómo te sientes hoy... de verdad?';
    }

    const creditsInfoEl = document.getElementById('credits-info');
    if (creditsInfoEl) {
      if (plan !== 'free') {
        creditsInfoEl.style.display = 'flex';
        updateCreditsCostDisplay();
      } else {
        creditsInfoEl.style.display = 'none';
      }
    }
  } catch (e) {
    console.error('[user status] Error:', e);
  }
}

async function getAuthToken() {
  if (!clerk || !clerk.session) return null;
  try { return await clerk.session.getToken(); } catch { return null; }
}

async function getUserEmail() {
  if (!clerk || !clerk.user) return '';
  return clerk.user.primaryEmailAddress?.emailAddress || '';
}

function checkUrlParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('upgraded')) {
    const plan = params.get('upgraded');
    const planNames = { essential: 'Essential', premium: 'Premium' };
    showToast(`¡Bienvenido a ${planNames[plan] || plan}! Ya puedes generar más meditaciones.`);
    window.history.replaceState({}, '', window.location.pathname);
    fetchUserStatus();
  }
  if (params.get('canceled')) {
    window.history.replaceState({}, '', window.location.pathname);
  }
}

function showPaywall() {
  pwSetBilling('monthly');
  if (typeof pwSelectPlan === 'function') pwSelectPlan('premium');
  const modal = document.getElementById('paywall-modal');
  if (modal) modal.classList.add('active');
  const toast = document.querySelector('.toast');
  if (toast) toast.classList.remove('visible');
}

function closeEndUpsell() {
  document.getElementById('end-upsell').style.display = 'none';
  document.getElementById('screen-player').classList.remove('end-active');
}

function closeEndGuest() {
  document.getElementById('end-guest').style.display = 'none';
  document.getElementById('screen-player').classList.remove('end-active');
  newMeditation();
}

function closePaywall() {
  const modal = document.getElementById('paywall-modal');
  if (modal) modal.classList.remove('active');
  enableGenerateBtn();

  // Si el player está en estado final, volver a inicio en vez de dejar dead end
  const playerScreen = document.getElementById('screen-player');
  if (playerScreen?.classList.contains('active') &&
      playerScreen?.classList.contains('end-active')) {
    newMeditation();
    return;
  }

  if (state.userPlan === 'free' && !state.userCanGenerate && clerk?.user) {
    const email = clerk.user.primaryEmailAddress?.emailAddress || '';
    if (email && window.posthog) {
      posthog.identify(clerk.user.id, { email, plan: 'free', paywall_dismissed: true });
      track('paywall_dismissed', { email });
    }
    showLeadCapture();
  }
}

function showLeadCapture() {
  if (document.getElementById('lead-capture')) return;
  const el = document.createElement('div');
  el.id = 'lead-capture';
  el.className = 'lead-capture';
  el.innerHTML = `
    <p class="lead-capture-text">¿Te avisamos cuando haya nuevas funciones y ofertas?</p>
    <div class="lead-capture-actions">
      <button class="btn-lead-yes" onclick="confirmLead()">Sí, avísame</button>
      <button class="btn-lead-no"  onclick="dismissLead()">No, gracias</button>
    </div>`;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('visible'), 50);
}

function confirmLead() {
  track('lead_opt_in', { email: clerk?.user?.primaryEmailAddress?.emailAddress || '' });
  dismissLead();
  showToast('¡Perfecto! Te avisaremos cuando haya novedades.');
}

function dismissLead() {
  const el = document.getElementById('lead-capture');
  if (!el) return;
  el.classList.remove('visible');
  setTimeout(() => el.remove(), 400);
}

async function upgradePlan(plan) {
  if (!clerk || !clerk.session) { openAuth(); return; }

  const allBtns = document.querySelectorAll('.pw-cta-btn, .ob-plan-cta-btn, .ob-plan-card');
  const ctaBtns = document.querySelectorAll('.pw-cta-btn, .ob-plan-cta-btn');
  allBtns.forEach(b => { b.disabled = true; b.style.opacity = '0.6'; b.style.pointerEvents = 'none'; });
  ctaBtns.forEach(b => { b._origText = b.textContent; b.textContent = 'Procesando…'; });

  try {
    const token = await clerk.session.getToken();
    const email = await getUserEmail();
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ plan, email })
    });
    if (!res.ok) throw new Error('Error al crear sesión de pago');
    const { url } = await res.json();
    track('checkout_started', { plan });
    window.location.href = url;
  } catch (e) {
    console.error('[checkout] Error:', e);
    allBtns.forEach(b => { b.disabled = false; b.style.opacity = ''; b.style.pointerEvents = ''; });
    ctaBtns.forEach(b => { if (b._origText) b.textContent = b._origText; });
    showToast('Error al procesar el pago. Inténtalo de nuevo.');
  }
}

function signOut() {
  if (clerk) {
    localStorage.removeItem('stillova_plan');
    state.userPlan         = 'free';
    state.userCanGenerate  = true;
    clerk.signOut().then(() => {
      window.location.href = '/';
    });
  }
}

// Abre el modal prebuilt de Clerk: nombre, email, foto, contraseña, sesiones activas
function openClerkUserProfile() {
  if (!clerk?.user) {
    showToast('Inicia sesión para gestionar tu cuenta');
    return;
  }
  try {
    clerk.openUserProfile();
    track('account_profile_opened');
  } catch (e) {
    console.error('[openUserProfile]', e);
    showToast('No se pudo abrir la gestión de cuenta');
  }
}

// Eliminar cuenta — GDPR derecho al olvido
async function confirmDeleteAccount() {
  if (!clerk?.user) return;
  const email = clerk.user.primaryEmailAddress?.emailAddress || 'tu cuenta';
  const confirm1 = window.confirm(
    `¿Seguro que quieres eliminar tu cuenta?\n\n` +
    `Esto borrará PARA SIEMPRE:\n` +
    `• Tu perfil (${email})\n` +
    `• Todas tus meditaciones guardadas\n` +
    `• Tu historial y estadísticas\n\n` +
    `Esta acción NO se puede deshacer.`
  );
  if (!confirm1) return;

  const confirm2 = window.prompt(
    `Para confirmar, escribe BORRAR en mayúsculas:`
  );
  if (confirm2 !== 'BORRAR') {
    showToast('Cancelado');
    return;
  }

  try {
    const token = await clerk.session.getToken();
    const res = await fetch('/api/user', {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Error ${res.status}`);
    }
    track('account_deleted');
    showToast('Cuenta eliminada. Adiós.');
    // Clerk signOut y redirect
    setTimeout(async () => {
      try { await clerk.signOut(); } catch {}
      localStorage.clear();
      window.location.href = '/';
    }, 1500);
  } catch (e) {
    console.error('[deleteAccount]', e);
    showToast(e.message || 'Error al eliminar cuenta. Contacta soporte.');
  }
}
