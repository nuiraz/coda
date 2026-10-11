"use strict";
// Service worker de WorldCards : le jeu fonctionne hors ligne et se charge instantanément.
// Changez VERSION à chaque mise en ligne pour forcer la mise à jour du cache.
const VERSION = "wc-2026-10-11-1";
const COEUR = ["./","index.html","style.css","app.js","compte.js","manifest.webmanifest","data/carte.js","data/gaming.js","data/monde.js","data/objets.js","data/photos.js","vendor/d3.min.js","vendor/topojson-client.min.js","icons/apple-touch-icon.png","icons/favicon-32.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","icons/icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(COEUR)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((cles) => Promise.all(cles.filter((k) => k !== VERSION && k !== "wc-photos").map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // API (comptes, hub) : toujours le réseau
  if (url.origin === location.origin && url.pathname.startsWith("/api/")) return;
  // Photos Wikimedia : depuis le cache si possible
  if (url.hostname === "upload.wikimedia.org") {
    e.respondWith(caches.open("wc-photos").then(async (c) => (await c.match(e.request)) || fetch(e.request).then((r) => { if (r.ok || r.type === "opaque") c.put(e.request, r.clone()); return r; })));
    return;
  }
  if (url.origin !== location.origin) return;
  // Fichiers du jeu : cache d'abord, mise à jour en arrière-plan
  e.respondWith(caches.open(VERSION).then(async (c) => {
    const enCache = await c.match(e.request, { ignoreSearch: true });
    const reseau = fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => enCache || (e.request.mode === "navigate" ? c.match("index.html") : undefined));
    return enCache || reseau;
  }));
});
