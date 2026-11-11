const CACHE_NAME = "konta-shell-v4";
const APP_SHELL = ["/login", "/loja", "/servicos", "/formacao", "/manifest.webmanifest", "/konta-icon.svg"];
const STORE_ROUTES = new Set(["/login", "/loja", "/loja/vendas", "/loja/produtos", "/loja/relatorios", "/loja/caixa", "/loja/definicoes", "/servicos", "/formacao"]);
const LEGACY_ROUTES = {
  "/": "/login",
  "/vendas": "/loja/vendas",
  "/produtos": "/loja/produtos",
  "/relatorios": "/loja/relatorios",
  "/caixa": "/loja/caixa",
  "/definicoes": "/loja/definicoes",
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key.startsWith("konta-shell-") && key !== CACHE_NAME).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    const legacyDestination = LEGACY_ROUTES[url.pathname];
    if (legacyDestination) {
      event.respondWith(Response.redirect(new URL(legacyDestination + url.search, url.origin), 307));
      return;
    }
    if (!STORE_ROUTES.has(url.pathname)) return;
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match(request)) ?? (await cache.match("/loja")) ?? Response.error();
        }),
    );
    return;
  }

  if (["script", "style", "image", "font"].includes(request.destination)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          const copy = response.clone();
          void cache.put(request, copy);
        }
        return response;
      }),
    );
  }
});
