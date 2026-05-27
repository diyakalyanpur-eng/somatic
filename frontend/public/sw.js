// Somatic Service Worker — cache-first for app shell, network-first for API
const CACHE = "somatic-v1";

// Files to pre-cache on install (the app shell)
const SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  // Remove old cache versions
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // API calls — always network, never cache
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Navigation requests — serve index.html from cache (SPA shell)
  if (e.request.mode === "navigate") {
    e.respondWith(
      caches.match("/index.html").then((cached) => cached || fetch(e.request))
    );
    return;
  }

  // Everything else — cache first, fall back to network
  e.respondWith(
    caches.match(e.request).then(
      (cached) => cached || fetch(e.request).then((res) => {
        // Cache fresh static assets
        if (res.ok && !url.pathname.startsWith("/api/")) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      })
    )
  );
});
