let clerk = null;
let pendingGeneration = false;
let pwBillingMode = 'monthly';

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

    const { plan, usage, limit, canGenerate, profileCompleted,
            streak, minutesThisWeek, totalSessions, level,
            savedCount, saveLimit } = await res.json();

    const planEl  = document.getElementById('plan-badge');
    const usageEl = document.getElementById('usage-info');

    state.userPlan           = plan;
    state.userCanGenerate    = canGenerate;
    state.profileCompleted   = !!profileCompleted;
    state.creditsRemaining   = Math.max(0, limit - usage);
    state.creditsLimit       = limit;
    state.savedCount         = savedCount ?? 0;
    state.saveLimit          = saveLimit ?? null;
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
  pwBillingMode = 'monthly';
  pwSetBilling('monthly');
  const modal = document.getElementById('paywall-modal');
  if (modal) modal.classList.add('active');
}

function pwSetBilling(mode) {
  pwBillingMode = mode;

  const btnM = document.getElementById('pw-btn-monthly');
  const btnA = document.getElementById('pw-btn-annual');
  if (btnM) btnM.classList.toggle('pw-billing-active', mode === 'monthly');
  if (btnA) btnA.classList.toggle('pw-billing-active', mode === 'annual');

  const essWas    = document.getElementById('pw-ess-was');
  const essPrice  = document.getElementById('pw-ess-price');
  const essPeriod = document.getElementById('pw-ess-period');
  const essExtra  = document.getElementById('pw-ess-extra');
  const premWas   = document.getElementById('pw-prem-was');
  const premPrice  = document.getElementById('pw-prem-price');
  const premPeriod = document.getElementById('pw-prem-period');
  const premExtra  = document.getElementById('pw-prem-extra');

  if (mode === 'monthly') {
    if (essWas)    essWas.textContent    = '€9.99';
    if (essPrice)  essPrice.textContent  = '€6.99';
    if (essPeriod) essPeriod.textContent = '/mes';
    if (essExtra)  essExtra.textContent  = 'primer mes · luego €9.99';
    if (premWas)   premWas.textContent   = '€19.99';
    if (premPrice)  premPrice.textContent  = '€13.99';
    if (premPeriod) premPeriod.textContent = '/mes';
    if (premExtra)  premExtra.textContent  = 'primer mes · luego €19.99';
  } else {
    // Anual: mostrar precio total anual para que el ahorro sea obvio
    if (essWas)    essWas.textContent    = '€119';
    if (essPrice)  essPrice.textContent  = '€80';
    if (essPeriod) essPeriod.textContent = '/año';
    if (essExtra)  essExtra.textContent  = 'ahorras €40 · equivale a €6.67/mes';
    if (premWas)   premWas.textContent   = '€240';
    if (premPrice)  premPrice.textContent  = '€160';
    if (premPeriod) premPeriod.textContent = '/año';
    if (premExtra)  premExtra.textContent  = 'ahorras €80 · equivale a €13.33/mes';
  }
}

function pwGetPlan(base) {
  return pwBillingMode === 'annual' ? `${base}-annual` : base;
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
    state.profileCompleted = false;
    clerk.signOut().then(() => {
      const el = document.getElementById('user-status');
      if (el) el.style.display = 'none';
      applyDurationLocks();
      updateUserStatus();
    });
  }
}
