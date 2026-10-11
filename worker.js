// Point d'entrée Cloudflare Workers : sert le jeu (dossier worldcards/) et l'API des comptes (/api/…).
// L'API est la même que pour Cloudflare Pages (functions/api/[[route]].js).
import { onRequest } from "./functions/api/[[route]].js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return onRequest({ request, env, ctx });
    return env.ASSETS.fetch(request);
  },
};
