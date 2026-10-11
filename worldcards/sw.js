"use strict";
// Service worker de WorldCards : le jeu fonctionne hors ligne et se charge instantanément.
// Changez VERSION à chaque mise en ligne pour forcer la mise à jour du cache.
const VERSION = "wc-2026-10-11-3";
const COEUR = ["./","index.html","style.css","app.js","compte.js","manifest.webmanifest","data/carte.js","data/gaming.js","data/monde.js","data/objets.js","data/photos.js","vendor/d3.min.js","vendor/topojson-client.min.js","icons/apple-touch-icon.png","icons/favicon-32.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","icons/icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => Promise.allSettled(COEUR.map((f) => c.add(f)))).then(() => self.skipWaiting()));
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
  // Fichiers du jeu : le réseau d'abord (toujours la dernière version), le cache seulement hors ligne
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    try {
      const r = await fetch(e.request, { cache: "no-cache" });
      if (r.ok && typeAttendu(url.pathname, r)) c.put(e.request, r.clone());
      return r;
    } catch {
      return (await c.match(e.request, { ignoreSearch: true })) || (e.request.mode === "navigate" ? c.match("index.html") : Response.error());
    }
  })());
});

// Ne garde en cache que des fichiers du bon type (évite de mémoriser une page d'erreur à la place du jeu)
function typeAttendu(chemin, r) {
  const t = r.headers.get("content-type") || "";
  if (/\.css$/.test(chemin)) return t.includes("css");
  if (/\.js$/.test(chemin)) return t.includes("javascript");
  if (/\.svg$/.test(chemin)) return t.includes("svg");
  if (/\.png$/.test(chemin)) return t.includes("png");
  if (/\.webmanifest$/.test(chemin)) return t.includes("json") || t.includes("manifest");
  if (chemin.endsWith("/") || /\.html$/.test(chemin)) return t.includes("html");
  return true;
}
