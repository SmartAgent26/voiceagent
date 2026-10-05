const CACHE_NAME = "aksis-public-shell-v1";
const PUBLIC_SHELL = ["/offline.html", "/favicon.ico", "/icons/aksis-192.png", "/icons/aksis-512.png", "/icons/aksis-maskable-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PUBLIC_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Nunca se cachean rutas de API, datos autenticados, archivos del usuario ni respuestas del coach.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/storage/")) return;

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/offline.html")));
    return;
  }

  // Los demás recursos se solicitan por red: no se conserva información de sesión fuera del navegador.
  event.respondWith(fetch(event.request));
});
