// Somatic Service Worker — cache-first for app shell, network-first for API
// IMPORTANT: bump the cache version whenever you change this file so the
// new SW activates and old cached files are cleared.
const CACHE = "somatic-v3";

// Files to pre-cache on install (the app shell)
const SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/aisteth.html",
  "/heartsize.html",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// These paths must be served as-is, never replaced with index.html.
// aisteth.html and heartsize.html are standalone pages (not React routes).
function isStandalonePage(pathname) {
  return pathname === "/aisteth.html" || pathname === "/heartsize.html";
}

// Static assets that belong to the scan page
function isScanAsset(pathname) {
  return pathname.startsWith("/aisteth/") || pathname.startsWith("/models/");
}

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

  // 1. API calls — always network, never cache
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(fetch(e.request));
    return;
  }

  // 2. Standalone pages (aisteth.html) — serve the real file, NOT index.html.
  //    Without this, the SPA catch-all below swallows the navigation and the
  //    scan page never loads when the app is installed on the home screen.
  if (e.request.mode === "navigate" && isStandalonePage(url.pathname)) {
    e.respondWith(
      caches.match(url.pathname).then((cached) => cached || fetch(e.request))
    );
    return;
  }

  // 3. All other navigation — serve index.html (React SPA shell)
  if (e.request.mode === "navigate") {
    e.respondWith(
      caches.match("/index.html").then((cached) => cached || fetch(e.request))
    );
    return;
  }

  // 4. Scan-page assets (JS modules, models) — cache first, then network
  if (isScanAsset(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then(
        (cached) => cached || fetch(e.request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
      )
    );
    return;
  }

  // 5. Everything else — cache first, fall back to network
  e.respondWith(
    caches.match(e.request).then(
      (cached) => cached || fetch(e.request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      })
    )
  );
});
