
const CACHE = "antares-cache-v1";

// Ajuste esta lista aos caminhos reais do portal.
// Todo arquivo necessário offline precisa estar disponível no cache.
const ARQUIVOS = [
  "./",
  "./index.html",
  "./manifest.webmanifest"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ARQUIVOS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith("antares-cache-") && key !== CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);

  // Não intercepta outros sites nem requisições que não sejam GET.
  if (req.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // Para páginas HTML, tenta a rede e guarda a versão recebida.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(req, copy));
          }
          return response;
        })
        .catch(async () => {
          return await caches.match(req)
            || await caches.match("./index.html")
            || Response.error();
        })
    );
    return;
  }

  // Para scripts, estilos, imagens e outros recursos:
  // usa o cache quando disponível.
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;

      return fetch(req).then(response => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy));
        }
        return response;
      });
    })
  );
});
