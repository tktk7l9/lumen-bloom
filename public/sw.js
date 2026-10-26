// Minimal offline support. Navigations are network-first (so deploys are picked
// up online) with a cached shell fallback; other same-origin GETs are
// cache-first with runtime caching (build assets are content-hashed).

const CACHE = "lumen-bloom-v3";
// The shell is keyed by "/" only. Workers static assets redirect
// "/index.html" to "/" (307), and a redirected response stored by addAll
// can't be served for a navigation (redirect mode "manual") — Chrome turns
// it into a network error, so the offline fallback would fail.
const SHELL_URL = "/";
const SHELL = [
  SHELL_URL,
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Only a successful response may replace the offline shell; a 404
          // or 5xx page must never become what every offline navigation shows.
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(SHELL_URL, copy));
          }
          return res;
        })
        .catch(() => caches.match(SHELL_URL)),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
