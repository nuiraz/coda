"use strict";
// Service worker de Play2F1 : le jeu fonctionne hors ligne et se charge instantanément.
// Changez VERSION à chaque mise en ligne pour forcer la mise à jour du cache.
const VERSION = "wc-2026-10-13-75";
const COEUR = ["./", "index.html", "site.min.css", "jeu.min.js", "fonts/bricolage-v1.woff2", "fonts/nunito-v1.woff2", "manifest.webmanifest", "apple-touch-icon.png", "icons/apple-touch-icon.png", "icons/apple-180.png", "icons/favicon-32.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/icon.svg", "icons/logo-2f1.png", "icons/logo-site.png"];

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
  // Pages (navigation) : le réseau d'abord pour avoir la dernière version, le cache si le réseau tarde ou manque
  if (e.request.mode === "navigate") {
    e.respondWith((async () => {
      const c = await caches.open(VERSION);
      const reseau = fetch(e.request).then((r) => { if (r.ok && typeAttendu(url.pathname, r)) c.put(e.request, r.clone()); return r; });
      const delai = new Promise((ok) => setTimeout(() => ok(null), 3500));
      try { const r = await Promise.race([reseau, delai]); if (r) return r; } catch {}
      return (await c.match(e.request)) || (await c.match("index.html")) || reseau.catch(() => Response.error());
    })());
    return;
  }
  // Fichiers du jeu : servis tout de suite depuis le cache, mis à jour en arrière-plan pour la prochaine visite
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    const enCache = await c.match(e.request);
    const reseau = fetch(e.request).then((r) => { if (r.ok && typeAttendu(url.pathname, r)) c.put(e.request, r.clone()); return r; }).catch(() => null);
    if (enCache) { e.waitUntil(reseau); return enCache; }
    return (await reseau) || (await c.match(e.request, { ignoreSearch: true })) || Response.error();
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

// Notifications push : le serveur envoie un signal vide, le texte est lu sur /api/notifs/derniere
self.addEventListener("push", (e) => {
  e.waitUntil((async () => {
    let n = { titre: "Play2F1", texte: "Du nouveau vous attend !", url: "./" };
    try { const r = await fetch("/api/notifs/derniere", { credentials: "include" }); if (r.ok) { const j = await r.json(); if (j.notif) n = j.notif; } } catch {}
    await self.registration.showNotification(n.titre, { body: n.texte, icon: "icons/icon-192.png", badge: "icons/favicon-32.png", data: { url: n.url || "./" }, tag: n.tag || undefined });
  })());
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "./", self.location.href).href;
  e.waitUntil((async () => {
    const fenetres = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const f of fenetres) { if ("focus" in f) { await f.navigate(url).catch(() => {}); return f.focus(); } }
    return self.clients.openWindow(url);
  })());
});
