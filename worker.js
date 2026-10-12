// Point d'entrée Cloudflare Workers : sert le jeu (dossier worldcards/) et l'API des comptes (/api/…).
// L'API est la même que pour Cloudflare Pages (functions/api/[[route]].js).
import { onRequest, planifie } from "./functions/api/[[route]].js";

const CACHE_PUBLIC = /^\/api\/(reglages|visuels|photos\/perso|photos\/corrections|evenement|saison\/finale|ouvertures\/semaine|visuel\/[A-Za-z0-9-]+|rang-logo\/[a-z0-9-]+|photo-perso\/[a-z]+~[A-Za-z0-9_-]+)$/;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // Données publiques identiques pour tous les joueurs : servies depuis le cache de Cloudflare (sans toucher à la base)
    if (request.method === "GET" && CACHE_PUBLIC.test(url.pathname)) {
      const cache = caches.default, cle = new Request(url.toString(), { method: "GET" });
      const deja = await cache.match(cle);
      if (deja) return deja;
      const r = await onRequest({ request, env, ctx });
      if (r.status === 200) {
        const copie = new Response(r.body, r);
        if (!copie.headers.get("cache-control")) copie.headers.set("cache-control", "public, max-age=60");
        ctx.waitUntil(cache.put(cle, copie.clone()));
        return copie;
      }
      return r;
    }
    if (url.pathname.startsWith("/api/")) return onRequest({ request, env, ctx });
    const invit = /^\/r\/([A-Za-z0-9_-]{3,20})\/?$/.exec(url.pathname);
    if (invit) return pageInvitation(invit[1]);
    return env.ASSETS.fetch(request);
  },
  // Toutes les 15 minutes : rappels « booster gratuit prêt » et ménage de la base
  async scheduled(event, env, ctx) {
    if (env.DB) ctx.waitUntil(planifie(env));
  },
};

// Lien d'invitation : https://play2f1.com/r/pseudo — aperçu soigné sur les réseaux, puis le jeu avec le parrainage pré-rempli
function pageInvitation(pseudo) {
  const e = (t) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const titre = `${pseudo} vous invite sur Play2F1`, desc = "Jeu de cartes à collectionner gratuit : ouvrez des boosters, collectionnez les pays, drapeaux, villes et monuments du monde, et affrontez vos amis. Un booster offert à vous deux au niveau 5 !";
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(titre)}</title>
<meta name="description" content="${e(desc)}"><meta property="og:title" content="${e(titre)}"><meta property="og:description" content="${e(desc)}"><meta property="og:type" content="website">
<meta property="og:url" content="https://play2f1.com/r/${e(pseudo)}"><meta property="og:image" content="https://play2f1.com/icons/icon-512.png"><meta name="twitter:card" content="summary"><meta name="robots" content="noindex">
<link rel="canonical" href="https://play2f1.com/"><meta http-equiv="refresh" content="0; url=/?parrain=${encodeURIComponent(pseudo)}"></head>
<body style="background:#111214;color:#f2ede4;font-family:system-ui;text-align:center;padding:40px"><p>${e(titre)}…</p><p><a style="color:#ff8a65" href="/?parrain=${encodeURIComponent(pseudo)}">Ouvrir Play2F1</a></p>
<script>location.replace("/?parrain=" + encodeURIComponent(${JSON.stringify(pseudo)}));</script></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
