function track(event, props) {
  try {
    if (window.posthog && typeof posthog.capture === 'function') {
      posthog.capture(event, props || {});
    }
  } catch (e) { /* silencioso */ }
}
