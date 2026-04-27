// Single source of truth para precios mostrados al usuario.
// Carga /pricing.json al arrancar; si falla, mantiene el fallback embebido.
// El cobro real lo decide Lemon Squeezy — esto es solo display.
// Mantener este fallback sincronizado con /pricing.json.

window.PRICING = {
  version: 'fallback-embedded',
  currency: 'USD',
  plans: {
    free:      { label: 'Gratis',    monthly: null,     annualEquiv: null,    monthlyTotal: null,     annualTotal: null },
    essential: { label: 'Essential', monthly: '$9.99',  annualEquiv: '$7.99', monthlyTotal: '$9.99',  annualTotal: '$95.88' },
    premium:   { label: 'Premium',   monthly: '$19.99', annualEquiv: '$15.99', monthlyTotal: '$19.99', annualTotal: '$191.88' },
    studio:    { label: 'Studio',    monthly: '$39.99', annualEquiv: '$31.99', monthlyTotal: '$39.99', annualTotal: '$383.88' }
  },
  promos: {
    essentialMonthlyFirstMonth: '$6.99'
  }
};

(function loadPricing() {
  if (typeof fetch !== 'function') return;
  fetch('/pricing.json', { cache: 'default' })
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (data && data.plans && data.plans.essential) {
        window.PRICING = data;
        document.dispatchEvent(new CustomEvent('pricing:loaded', { detail: data }));
      }
    })
    .catch(() => { /* fallback embebido ya está activo */ });
})();

// ── API pública ─────────────────────────────────

window.getPlanLabel = function(plan) {
  return (window.PRICING.plans[plan] || {}).label || plan;
};

// Precio mostrado en cards del paywall: "al mes" según ciclo
window.getDisplayMonthly = function(plan, cycle) {
  const p = window.PRICING.plans[plan];
  if (!p) return '';
  return cycle === 'annual' ? (p.annualEquiv || '') : (p.monthly || '');
};

// Total cobrado HOY
window.getTotalToday = function(plan, cycle) {
  const p = window.PRICING.plans[plan];
  if (!p) return '';
  return cycle === 'annual' ? (p.annualTotal || '') : (p.monthlyTotal || p.monthly || '');
};

// Para el perfil: "$9.99/mes" o "—" para free
window.getProfilePrice = function(plan) {
  const p = window.PRICING.plans[plan];
  if (!p || !p.monthly) return '—';
  return p.monthly + '/mes';
};

window.getEssentialFirstMonthPromo = function() {
  return (window.PRICING.promos || {}).essentialMonthlyFirstMonth || '$6.99';
};
