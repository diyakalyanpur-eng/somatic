// Somatic Service Worker — cache-first for app shell, network-first for API
// IMPORTANT: bump the cache version whenever you change this file so the
// new SW activates and old cached files are cleared.
const CACHE = "somatic-v6";

// Files to pre-cache on install (the app shell)
// NOTE: Use "/" (not "/index.html") for the SPA shell — "/" always goes through
// Vite's transform pipeline in dev and the server's SPA handler in production,
// whereas "/index.html" serves the bare static file from public/ which has no scripts.
const SHELL = [
  "/",
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

// True for any request that wants a full HTML document — covers both
// user-gesture navigations (mode:'navigate') and programmatic ones
// (location.href, replaceState) where destination:'document' is set
// but mode may be 'cors' or 'same-origin' in some browsers/contexts.
function isDocRequest(req) {
  return req.mode === "navigate" || req.destination === "document";
}

// Returns true if the pathname looks like a React SPA route (no file extension).
function isSpaRoute(pathname) {
  const last = pathname.split("/").pop();
  return !last.includes(".");
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

  // 2. Standalone pages (aisteth.html, heartsize.html) — serve the real file.
  //    Fetch by pathname string, NOT e.request: SW can't call fetch() with a
  //    navigate-mode Request object without risking a TypeError in some envs.
  if (isDocRequest(e.request) && isStandalonePage(url.pathname)) {
    e.respondWith(
      caches.match(url.pathname)
        .then((cached) => cached || fetch(url.pathname))
        .catch(() => caches.match(url.pathname) || new Response("Offline", { status: 503 }))
    );
    return;
  }

  // 3. All other document navigations — serve the React SPA shell ("/").
  //    Use "/" not "/index.html": "/" always goes through Vite's pipeline in dev
  //    and the server's SPA handler in production. "/index.html" would serve the
  //    bare static file from public/ (which has no <script> tags).
  //    Always fetch by URL string, never by e.request (navigate-mode fetch throws in SW).
  if (isDocRequest(e.request)) {
    e.respondWith(
      caches.match("/")
        .then((cached) => cached || fetch("/"))
        .catch(() => new Response("App offline", { status: 503, headers: { "Content-Type": "text/plain" } }))
    );
    return;
  }

  // 4. Scan-page assets (JS modules, models) — cache first, then network
  if (isScanAsset(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then(
        (cached) => cached || fetch(e.request).then((res) => {
          if (res.ok) {
            caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
          }
          return res;
        })
      )
    );
    return;
  }

  // 5. Everything else — cache first, network fallback.
  //    Extra safety net: if the fetch fails and the URL looks like a SPA route
  //    (no file extension), serve the cached index.html shell instead of erroring.
  e.respondWith(
    caches.match(e.request).then(
      (cached) => cached || fetch(e.request).then((res) => {
        if (res.ok) {
          caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
        }
        return res;
      }).catch(() => {
        if (isSpaRoute(url.pathname)) {
          return caches.match("/") || fetch("/");
        }
        return new Response("Not found", { status: 404 });
      })
    )
  );
});
