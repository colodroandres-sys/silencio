// PWA — banner "Añadir Stillova a tu inicio".
// Mobile-only. Solo aparece si NO está ya instalada como PWA (standalone mode)
// y el user ya ha pasado ≥2 veces por home (no asusta a primera visita).
//
// Android (Chrome): captura `beforeinstallprompt` y dispara el prompt nativo.
// iOS (Safari): no hay API automática, mostramos modal con pasos visuales.
//
// Persistente: si el user dismissa, no vuelve a aparecer en 14 días.

const PWA_DISMISSED_KEY = 'stillova_pwa_dismissed_v1';
const PWA_DISMISSED_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const PWA_HOME_VIEWS_KEY = 'stillova_home_views';
const PWA_MIN_HOME_VIEWS = 2;

let _deferredInstallPrompt = null;
let _pwaInitialized = false;

function _isMobile() {
  // Pointer coarse + tamaño viewport ≤ 820 cubre iPhone, iPad mini, Android phones.
  return window.matchMedia && window.matchMedia('(pointer: coarse) and (max-width: 820px)').matches;
}

function _isStandalone() {
  // Standalone iOS Safari + display-mode estándar
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true;
}

function _isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function _isDismissed() {
  try {
    const ts = parseInt(localStorage.getItem(PWA_DISMISSED_KEY) || '0', 10);
    return ts > 0 && (Date.now() - ts < PWA_DISMISSED_TTL_MS);
  } catch (_) { return false; }
}

function _bumpHomeViews() {
  try {
    const n = parseInt(localStorage.getItem(PWA_HOME_VIEWS_KEY) || '0', 10) + 1;
    localStorage.setItem(PWA_HOME_VIEWS_KEY, String(n));
    return n;
  } catch (_) { return 1; }
}

function _shouldShowBanner() {
  if (!_isMobile()) return false;
  if (_isStandalone()) return false;
  if (_isDismissed()) return false;
  const views = parseInt(localStorage.getItem(PWA_HOME_VIEWS_KEY) || '0', 10);
  if (views < PWA_MIN_HOME_VIEWS) return false;
  return true;
}

function dismissPwaBanner() {
  try { localStorage.setItem(PWA_DISMISSED_KEY, String(Date.now())); } catch (_) {}
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.style.display = 'none';
  try { track('pwa_banner_dismissed', {}); } catch (_) {}
}

function showPwaBanner() {
  const banner = document.getElementById('pwa-install-banner');
  if (!banner) return;
  banner.style.display = 'flex';
  // Adapta el icono/copy según plataforma
  const sub = document.getElementById('pwa-banner-sub');
  if (sub) {
    sub.textContent = _isIOS()
      ? 'Toca el botón compartir y "Añadir a pantalla de inicio".'
      : 'Acceso rápido sin App Store. Toca para instalar.';
  }
  try { track('pwa_banner_shown', { platform: _isIOS() ? 'ios' : 'android' }); } catch (_) {}
}

async function handlePwaInstallClick() {
  try { track('pwa_install_clicked', { platform: _isIOS() ? 'ios' : 'android' }); } catch (_) {}

  if (_isIOS()) {
    // No hay API en iOS. Mostramos modal con pasos visuales.
    const modal = document.getElementById('pwa-ios-modal');
    if (modal) modal.classList.add('active');
    return;
  }

  // Android Chrome / Edge: dispara el prompt diferido si lo capturamos.
  if (_deferredInstallPrompt) {
    _deferredInstallPrompt.prompt();
    const choice = await _deferredInstallPrompt.userChoice.catch(() => ({ outcome: 'dismissed' }));
    try { track('pwa_install_outcome', { outcome: choice.outcome }); } catch (_) {}
    _deferredInstallPrompt = null;
    if (choice.outcome === 'accepted') {
      const banner = document.getElementById('pwa-install-banner');
      if (banner) banner.style.display = 'none';
    }
    return;
  }

  // Si no capturamos el evento (ya pasó o navegador raro): mostramos modal genérico
  const modal = document.getElementById('pwa-ios-modal');
  if (modal) modal.classList.add('active');
}

function closePwaIosModal() {
  const modal = document.getElementById('pwa-ios-modal');
  if (modal) modal.classList.remove('active');
}

// Captura el evento beforeinstallprompt (Android Chrome) para usarlo cuando
// el user pulse nuestro botón. Sin esto, navigator.installPrompt no existe.
function _initPwaListeners() {
  if (_pwaInitialized) return;
  _pwaInitialized = true;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferredInstallPrompt = e;
  });

  window.addEventListener('appinstalled', () => {
    try { track('pwa_app_installed', {}); } catch (_) {}
    const banner = document.getElementById('pwa-install-banner');
    if (banner) banner.style.display = 'none';
  });
}

// Llamar desde navigation.js updateHomeDisplay tras renderizar home.
function maybeShowPwaBanner() {
  _initPwaListeners();
  _bumpHomeViews();
  if (_shouldShowBanner()) showPwaBanner();
}
