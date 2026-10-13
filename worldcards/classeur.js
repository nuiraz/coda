/* =====================================================================
   Classeur façon Pokémon : une page à part de la collection.
   Un vrai classeur à anneaux, 9 pochettes plastique par page, les cartes les plus rares
   devant (Dorées, Shiny, Holo, puis de la Légendaire à la Commune). Les pages se tournent
   avec les flèches, le clavier ou en glissant le doigt ; deux pages côte à côte sur ordinateur.
   ===================================================================== */
const classeur = { page: 0, tri: "rarete", cat: "tout", manquantes: false };
const POCHETTES = 9;
function cartesClasseur() {
  const poss = CARDS.filter((c) => (S.owned[c.id] || 0) > 0 && (classeur.cat === "tout" || c.type === classeur.cat));
  const prestige = (c) => (S.doree?.[c.id] ? 3 : S.shiny?.[c.id] ? 2 : S.holo?.[c.id] ? 1 : 0);
  const ordre = (c) => RARETES[c.rarete]?.ordre ?? 0;
  const tris = {
    rarete: (a, b) => prestige(b) - prestige(a) || ordre(b) - ordre(a) || a.type.localeCompare(b.type) || a.num - b.num,
    numero: (a, b) => a.type.localeCompare(b.type) || a.num - b.num,
    recentes: (a, b) => (S.vuLe?.[b.id] || 0) - (S.vuLe?.[a.id] || 0) || ordre(b) - ordre(a),
  };
  const liste = poss.sort(tris[classeur.tri] || tris.rarete).map((c) => ({ c, vide: false }));
  if (classeur.manquantes) {
    const manq = CARDS.filter((c) => !(S.owned[c.id] > 0) && c.type !== "secrete" && !c.saisonnier && (classeur.cat === "tout" || c.type === classeur.cat))
      .sort((a, b) => ordre(b) - ordre(a) || a.num - b.num);
    liste.push(...manq.map((c) => ({ c, vide: true })));
  }
  return liste;
}
function pageClasseur(cartes, n) {
  const debut = n * POCHETTES, items = cartes.slice(debut, debut + POCHETTES);
  return `<div class="cl-page" data-page="${n}">
    <div class="cl-pochettes">${Array.from({ length: POCHETTES }, (_, i) => {
      const x = items[i];
      if (!x) return `<div class="cl-pochette vide"></div>`;
      if (x.vide) return `<div class="cl-pochette manque"><span class="cl-manque">${typeof icCarte === "function" ? icCarte(ICONE_TYPE?.[x.c.type] || "point") : ""}<small>N° ${String(x.c.num).padStart(3, "0")}</small></span></div>`;
      const n = S.owned[x.c.id] || 0;
      return `<div class="cl-pochette">${cardHTML(x.c, { locked: false })}${n > 1 ? `<span class="cl-nb">×${n}</span>` : ""}</div>`;
    }).join("")}</div>
    <span class="cl-numero">${n + 1}</span></div>`;
}
function vueClasseur(v) {
  const cartes = cartesClasseur(), possedees = CARDS.filter((c) => (S.owned[c.id] || 0) > 0).length;
  const nbPages = Math.max(1, Math.ceil(cartes.length / POCHETTES));
  const double = matchMedia("(min-width: 900px)").matches;
  const pas = double ? 2 : 1;
  classeur.page = Math.max(0, Math.min(classeur.page, nbPages - 1));
  if (double) classeur.page -= classeur.page % 2;
  const types = [...new Set(CARDS.filter((c) => (S.owned[c.id] || 0) > 0).map((c) => c.type))];
  const pseudo = typeof COMPTE !== "undefined" && COMPTE.pseudo;
  v.innerHTML = `<header class="page-tete cl-tete"><h1>Mon classeur</h1><p>Toutes vos cartes rangées dans leurs pochettes, les plus rares devant. Tournez les pages avec les flèches ou en glissant le doigt.</p></header>
    <div class="cl-barre">
      <div class="toolbar">${[["tout", "Toutes"], ...types.map((k) => [k, TYPES[k] || k])].map(([k, n]) => `<button class="chip ${classeur.cat === k ? "on" : ""}" data-clcat="${k}">${esc(n)}</button>`).join("")}</div>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <select id="clTri"><option value="rarete" ${classeur.tri === "rarete" ? "selected" : ""}>Les plus rares devant</option><option value="numero" ${classeur.tri === "numero" ? "selected" : ""}>Par catégorie et numéro</option><option value="recentes" ${classeur.tri === "recentes" ? "selected" : ""}>Les plus récentes</option></select>
        <label class="check"><input type="checkbox" id="clManq" ${classeur.manquantes ? "checked" : ""}> Pochettes vides pour les cartes manquantes</label>
      </div></div>
    <div class="cl-classeur ${double ? "double" : "simple"}" id="clClasseur" tabindex="0" aria-label="Classeur de cartes">
      <div class="cl-couverture-dos" aria-hidden="true"></div>
      <div class="cl-feuilles" id="clFeuilles">
        ${cartes.length ? Array.from({ length: pas }, (_, k) => classeur.page + k < nbPages ? pageClasseur(cartes, classeur.page + k) : `<div class="cl-page cl-page-vide"><div class="cl-pochettes">${`<div class="cl-pochette vide"></div>`.repeat(POCHETTES)}</div></div>`).join(`<div class="cl-anneaux" aria-hidden="true"><i></i><i></i><i></i></div>`)
          : `<div class="cl-page cl-vide-tout"><p>Votre classeur est vide : ouvrez des boosters pour le remplir !</p><button class="btn primary" data-aller="boosters">Ouvrir un booster</button></div>`}
        ${!double ? `<div class="cl-anneaux cl-anneaux-gauche" aria-hidden="true"><i></i><i></i><i></i></div>` : ""}
      </div>
    </div>
    <div class="cl-nav">
      <button class="btn" id="clPrec" ${classeur.page === 0 ? "disabled" : ""} aria-label="Page précédente">‹<span class="cl-txt"> Précédente</span></button>
      <span class="cl-pagination"><b>${double && classeur.page + 1 < nbPages ? `Pages ${classeur.page + 1}–${classeur.page + 2}` : `Page ${classeur.page + 1}`}</b> sur ${nbPages}<small class="muted">${fmt(possedees)} cartes · ${fmt(cartes.length)} affichées</small></span>
      <button class="btn" id="clSuiv" ${classeur.page + pas >= nbPages ? "disabled" : ""} aria-label="Page suivante"><span class="cl-txt">Suivante </span>›</button>
    </div>
    ${!double && nbPages > 1 && nbPages <= 12 ? `<div class="cl-points" aria-hidden="true">${Array.from({ length: nbPages }, (_, i) => `<i class="${i === classeur.page ? "on" : ""}"></i>`).join("")}</div>` : ""}
    ${nbPages > 2 ? `<input type="range" class="cl-curseur" id="clCurseur" min="1" max="${nbPages}" value="${classeur.page + 1}" aria-label="Aller à la page">` : ""}
    <p class="muted" style="text-align:center;font-size:13px">${pseudo ? `Classeur de ${esc(pseudo)} · ` : ""}Touchez une carte pour voir sa fiche.</p>`;
  brancherLiens?.(v);
  const tourner = (sens) => {
    const cible = classeur.page + sens * pas;
    const f = $("#clFeuilles", v);
    if (cible < 0 || cible >= nbPages) { if (f) { f.style.transition = "transform .2s"; f.style.transform = ""; } return; }
    // Sur mobile, la page glisse (pas de rotation 3D : Safari l'agrandit énormément)
    const classe = double ? (sens > 0 ? "tourne-av" : "tourne-ar") : (sens > 0 ? "glisse-av" : "glisse-ar");
    f.style.transition = ""; f.style.transform = ""; f.classList.add(classe);
    setTimeout(() => { classeur.page = cible; vueClasseur(v); const nf = $("#clFeuilles", v); nf?.classList.add(double ? (sens > 0 ? "arrive-av" : "arrive-ar") : (sens > 0 ? "entre-av" : "entre-ar")); $("#clClasseur", v)?.focus({ preventScroll: true }); }, double ? 230 : 180);
  };
  $("#clPrec", v).onclick = () => tourner(-1);
  $("#clSuiv", v).onclick = () => tourner(1);
  $("#clCurseur", v)?.addEventListener("change", (e) => { classeur.page = Number(e.target.value) - 1; vueClasseur(v); });
  $("#clTri", v).onchange = (e) => { classeur.tri = e.target.value; classeur.page = 0; vueClasseur(v); };
  $("#clManq", v).onchange = (e) => { classeur.manquantes = e.target.checked; vueClasseur(v); };
  $$("[data-clcat]", v).forEach((b) => b.onclick = () => { classeur.cat = b.dataset.clcat; classeur.page = 0; vueClasseur(v); });
  const zone = $("#clClasseur", v);
  zone.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") tourner(1); if (e.key === "ArrowLeft") tourner(-1); });
  // Glisser le doigt : la page suit le doigt, puis se tourne
  let x0 = null, y0 = 0, dx = 0, horizontal = null;
  const feuilles = $("#clFeuilles", v);
  zone.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; horizontal = null; feuilles.style.transition = "none"; }, { passive: true });
  zone.addEventListener("touchmove", (e) => {
    if (x0 === null) return;
    dx = e.touches[0].clientX - x0; const dy = e.touches[0].clientY - y0;
    if (horizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) horizontal = Math.abs(dx) > Math.abs(dy);
    if (horizontal) { e.preventDefault(); const bord = (dx > 0 && classeur.page === 0) || (dx < 0 && classeur.page + pas >= nbPages); feuilles.style.transform = `translateX(${bord ? dx * 0.25 : dx}px)`; }
  }, { passive: false });
  zone.addEventListener("touchend", () => {
    if (x0 === null) return; x0 = null;
    if (horizontal && Math.abs(dx) > 50) tourner(dx < 0 ? 1 : -1);
    else { feuilles.style.transition = "transform .2s"; feuilles.style.transform = ""; }
  }, { passive: true });
}
ajouterPage("classeur", "📒", "Mon classeur", vueClasseur);
if (typeof ICONES === "object") ICONES.classeur = '<path d="M5 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5z"/><path d="M5 7H3M5 12H3M5 17H3M9 7h6M9 11h6"/>';
if (typeof GROUPES_PLUS === "object") { const g = GROUPES_PLUS.find(([n]) => n === "Ma collection"); if (g && !g[1].includes("classeur")) g[1].splice(1, 0, "classeur"); }
// Accès direct depuis la collection
const _vueAlbumClasseur = vueAlbum;
vueAlbum = function (v) {
  const r = _vueAlbumClasseur.apply(this, arguments);
  if (!$(".cl-lien", v)) v.insertAdjacentHTML("afterbegin", `<button class="panel cl-lien" data-aller="classeur"><span class="cl-lien-ic">${typeof svgIcone === "function" ? svgIcone("classeur") : ""}</span><span><b>Ouvrir mon classeur</b><small class="muted">Vos cartes dans leurs pochettes, les plus rares devant</small></span><span class="btn small primary">Ouvrir</span></button>`);
  brancherLiens?.(v);
  return r;
};
let clLargeur = innerWidth >= 900;
addEventListener("resize", () => { const d = innerWidth >= 900; if (d !== clLargeur) { clLargeur = d; if (S.vue === "classeur") aller("classeur"); } });
