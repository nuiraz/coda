"use strict";
/* =====================================================================
   Play2F1 — v5 : Discord, défi du jour, tutoriel, boosters limités, Coupe des nations,
   duels en spectateur, cartes recherchées
   ===================================================================== */

/* ---------- Discord : lien d'invitation dans le jeu ---------- */
const lienDiscord = () => REGLAGES?.discord || "https://discord.gg/uHnvkZYB6c";
const ouvrirDiscord = () => window.open(lienDiscord(), "_blank", "noopener");
addEventListener("DOMContentLoaded", () => {
  const liens = document.querySelector(".pied .liens");
  if (liens) { liens.insertAdjacentHTML("beforeend", ` · <a href="#" id="piedDiscord">💬 Discord</a>`); $("#piedDiscord").onclick = (e) => { e.preventDefault(); ouvrirDiscord(); }; }
});
const _vueAccueilV5 = vueAccueil;
vueAccueil = function (v) {
  const r = _vueAccueilV5.apply(this, arguments);
  const t = $(".tuiles", v);
  if (t && !$("#tuileDiscord", v)) {
    t.insertAdjacentHTML("beforeend", `<button class="tuile tuile-discord" id="tuileDiscord"><span class="t-ic">💬</span><span class="t-txt"><b>Discord</b><small>Rejoignez la communauté</small></span></button>`);
    $("#tuileDiscord").onclick = ouvrirDiscord;
  }
  return r;
};
const _vueHubV5 = vueHub;
vueHub = function (v) {
  const r = _vueHubV5.apply(this, arguments);
  if (!$(".bandeau-discord", v) && (typeof hubEtat === "undefined" || hubEtat.onglet === "accueil")) {
    const b = document.createElement("a");
    b.className = "panel bandeau-discord"; b.href = lienDiscord(); b.target = "_blank"; b.rel = "noopener";
    b.innerHTML = `<span class="big">💬</span><div><b>Rejoignez le Discord de Play2F1</b><br><span class="muted">Annonces, échanges, tournois et entraide entre collectionneurs.</span></div><span class="btn primary">Rejoindre</span>`;
    const h = $(".hub2-titre", v) || $(".page-tete", v) || $(".sectiontitle", v);
    if (h) h.after(b); else v.prepend(b);
  }
  return r;
};
