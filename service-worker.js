const CACHE = 'stillova-v6';
const PRECACHE = [
  '/',
  '/index.html',
  '/css/base.css',
  '/css/layout.css',
  '/css/player.css',
  '/css/paywall.css',
  '/css/dashboard.css',
  '/css/onboarding.css',
  '/css/responsive.css',
  '/js/state.js',
  '/js/utils.js',
  '/js/analytics.js',
  '/js/navigation.js',
  '/js/onboarding.js',
  '/js/create.js',
  '/js/generation.js',
  '/js/player.js',
  '/js/gamification.js',
  '/js/auth.js',
  '/js/save.js',
  '/js/profile.js',
  '/js/init.js',
  '/apple-touch-icon.png',
  '/favicon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // API calls: network only, no cache
  if (url.pathname.startsWith('/api/')) return;

  // Everything else: cache-first, fall back to network
  e.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(res => {
      if (res.ok && request.method === 'GET') {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(request, clone));
      }
      return res;
    }))
  );
});
