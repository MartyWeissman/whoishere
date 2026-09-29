// Service worker: lets the student page open and record check-ins with no connection.
// Files are fetched fresh whenever online, so edits show up without changing anything here.
const VERSION = "wih-v2";
const SHELL = ["./", "./index.html", "./config.js", "./common.js",
               "./manifest.webmanifest", "./icon.svg", "./icon-180.png", "./icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Same-site files: network first (so updates show up), cached copy when offline.
// Requests to the database are never cached.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.endsWith("/teach.html")) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const fresh = await fetch(e.request);
      if (fresh.ok) cache.put(e.request, fresh.clone());
      return fresh;
    } catch (err) {
      const hit = await cache.match(e.request, { ignoreSearch: true });
      if (hit) return hit;
      if (e.request.mode === "navigate") return cache.match("./index.html");
      throw err;
    }
  })());
});
