/* Service worker for 我的記帳 PWA.
 * Strategy:
 *   - Precache the app shell on install (HTML, CSS, JS modules, manifest, icons, Chart.js CDN).
 *   - HTML / JS / CSS / manifest: network-first (always pick up deploys), fall back to cache offline.
 *   - Icons + pinned Chart.js CDN URL: cache-first (immutable, fine to serve stale).
 * Bump CACHE_VERSION to force clients to refresh assets.
 */

const CACHE_VERSION = 'v4';
const CACHE_NAME = `accounting-shell-${CACHE_VERSION}`;

const CHART_JS_URL =
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';

const PRECACHE_URLS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './js/main.js',
  './js/storage.js',
  './js/records.js',
  './js/categories.js',
  './js/stats.js',
  './js/csv.js',
  './js/ui.js',
  './js/charts.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/favicon-16.png',
  CHART_JS_URL,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // addAll is atomic — if any request fails the install fails. Use
      // individual adds so a transient CDN hiccup doesn't break installation.
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            await cache.add(url);
          } catch (err) {
            console.warn('[SW] precache miss:', url, err);
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('accounting-shell-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

function isChartCdn(url) {
  return url.href === CHART_JS_URL;
}

async function networkFirst(request, navigationFallback = false) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone()).catch(() => {});
    return fresh;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (navigationFallback) {
      const shell = await cache.match('/index.html');
      if (shell) return shell;
    }
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh && fresh.ok) cache.put(request, fresh.clone()).catch(() => {});
  return fresh;
}

function isAlwaysFresh(url, request) {
  if (request.mode === 'navigate') return true;
  const p = url.pathname;
  return (
    p.endsWith('.js') ||
    p.endsWith('.css') ||
    p.endsWith('.webmanifest') ||
    p.endsWith('.html')
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin && isAlwaysFresh(url, request)) {
    event.respondWith(networkFirst(request, request.mode === 'navigate'));
    return;
  }

  if (sameOrigin || isChartCdn(url)) {
    event.respondWith(cacheFirst(request));
  }
});
