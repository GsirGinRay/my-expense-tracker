/* Service worker for 我的記帳 PWA.
 * Strategy:
 *   - Precache the app shell on install (HTML, CSS, JS modules, manifest, icons, Chart.js CDN).
 *   - Navigation requests: network-first, fall back to cached index.html (offline shell).
 *   - Same-origin static + the pinned Chart.js CDN URL: cache-first.
 * Bump CACHE_VERSION to force clients to refresh assets.
 */

const CACHE_VERSION = 'v3';
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

async function networkFirstNavigation(request) {
  try {
    const fresh = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put('./index.html', fresh.clone()).catch(() => {});
    return fresh;
  } catch {
    const cache = await caches.open(CACHE_NAME);
    return (
      (await cache.match('./index.html')) ||
      (await cache.match(request)) ||
      Response.error()
    );
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone()).catch(() => {});
    return fresh;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (url.origin === self.location.origin || isChartCdn(url)) {
    event.respondWith(cacheFirst(request));
  }
});
