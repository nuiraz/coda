/* =====================================================================
   Catégories de cartes gérées par l'admin : renommer celles du jeu (nom, icône, couleur)
   et en créer de nouvelles. Une nouvelle catégorie combat comme un type existant choisi
   (stats, attaque spéciale, talents, avantage) pour garder les combats équilibrés.
   ===================================================================== */
const CLE_CATEGORIES = "worldcards:categories";
const TYPES_ORIGINE = { ...TYPES };
const BASES_COMBAT = ["pays", "ville", "monument", "nature", "animal", "plat", "culture"];
let CATEGORIES_PERSO = {}; // cle → { nom, icone, couleur, base, perso: true si créée }
function appliquerCategories(liste) {
  // On repart des noms d'origine, puis on applique les réglages de l'admin
  for (const k of Object.keys(TYPES)) if (!(k in TYPES_ORIGINE)) delete TYPES[k];
  Object.assign(TYPES, TYPES_ORIGINE);
  CATEGORIES_PERSO = {};
  for (const c of liste || []) {
    const perso = !(c.cle in TYPES_ORIGINE);
    CATEGORIES_PERSO[c.cle] = { nom: c.nom, icone: c.icone || "etincelle", couleur: c.couleur || "", base: c.base || "culture", perso, ordre: c.ordre || 0 };
    TYPES[c.cle] = c.nom;
    if (typeof ICONE_TYPE === "object") ICONE_TYPE[c.cle] = c.icone || ICONE_TYPE[c.cle] || "etincelle";
    if (perso && COMBAT.PROFILS[c.base]) {
      COMBAT.PROFILS[c.cle] = COMBAT.PROFILS[c.base]; COMBAT.SPECIAUX[c.cle] = COMBAT.SPECIAUX[c.base];
      COMBAT.TALENTS_TYPE[c.cle] = COMBAT.TALENTS_TYPE[c.base]; if (COMBAT.AVANTAGE[c.base]) COMBAT.AVANTAGE[c.cle] = COMBAT.AVANTAGE[c.base];
    }
  }
}
try { appliquerCategories(JSON.parse(localStorage.getItem(CLE_CATEGORIES) || "[]")); } catch {}
async function chargerCategories(frais) {
  try {
    const { categories } = await api(`categories?t=${frais ? Date.now() : Math.floor(Date.now() / 60000)}`);
    appliquerCategories(categories);
    try { localStorage.setItem(CLE_CATEGORIES, JSON.stringify(categories)); } catch {}
    if (["album", "codex", "accueil"].includes(S.vue) && $("#modal").classList.contains("hidden")) aller(S.vue);
  } catch {}
}
addEventListener("DOMContentLoaded", () => setTimeout(chargerCategories, 500));
// Couleur choisie par l'admin pour une catégorie
const _couleurCarteCat = couleurCarte;
couleurCarte = function (c) { return CATEGORIES_PERSO[c.type]?.couleur || _couleurCarteCat(c); };
// Sous-titre des cartes d'une nouvelle catégorie : leur pays
const _sousTitreCat = sousTitre;
sousTitre = function (c) { const t = _sousTitreCat(c); return t || (c.pays && NOM_PAYS[c.pays] ? NOM_PAYS[c.pays] : ""); };
// Liste des catégories proposées pour une carte créée (celles du jeu + les nouvelles)
const categoriesPourCartes = () => [["monument", "Monument"], ["nature", "Nature"], ["animal", "Animal"], ["plat", "Gastronomie"], ["culture", "Culture"], ["ville", "Ville"]]
  .map(([k, n]) => [k, TYPES[k] || n]).concat(Object.entries(CATEGORIES_PERSO).filter(([, c]) => c.perso).sort((a, b) => a[1].ordre - b[1].ordre).map(([k, c]) => [k, c.nom]));
const svgCat = (k) => `<svg class="ico-cat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(typeof TRAITS === "object" && TRAITS[k]) || '<circle cx="12" cy="12" r="3"/>'}</svg>`;

/* ---------- Admin : les catégories ---------- */
async function adminCategories(el) {
  el.innerHTML = `<p class="muted">Chargement…</p>`;
  let liste = [];
  try { liste = (await api(`categories?t=${Date.now()}`)).categories; appliquerCategories(liste); try { localStorage.setItem(CLE_CATEGORIES, JSON.stringify(liste)); } catch {} } catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
  const icones = typeof TRAITS === "object" ? Object.keys(TRAITS).filter((k) => !["point", "menu"].includes(k)) : [];
  const toutes = [...Object.keys(TYPES_ORIGINE).filter((k) => k !== "secrete").map((k) => [k, false]), ...Object.entries(CATEGORIES_PERSO).filter(([, c]) => c.perso).map(([k]) => [k, true])];
  const nbCartes = (k) => CARDS.filter((c) => c.type === k).length;
  const formulaire = (cle = "", perso = true) => {
    const c = CATEGORIES_PERSO[cle] || {}, nom = c.nom || TYPES[cle] || "";
    const icone = c.icone || (typeof ICONE_TYPE === "object" && ICONE_TYPE[cle]) || "etincelle";
    return `<form class="form panel cat-form" id="fCat">
      <h3 style="margin:0">${cle ? `Modifier « ${esc(nom)} »` : "Nouvelle catégorie"}</h3>
      <div class="rf-grille">
        ${cle ? `<input type="hidden" name="cle" value="${esc(cle)}">` : `<label>Identifiant (minuscules, sans espace)<input name="cle" required pattern="[a-z][a-z0-9-]{1,23}" placeholder="sport"></label>`}
        <label>Nom affiché<input name="nom" required maxlength="30" value="${esc(nom)}" placeholder="Sport"></label>
        <label>Couleur des cartes<input type="color" name="couleur" value="${esc(c.couleur || "#4f7cff")}"></label>
        ${perso ? `<label>Combat comme<select name="base">${BASES_COMBAT.map((b) => `<option value="${b}" ${(c.base || "culture") === b ? "selected" : ""}>${esc(TYPES_ORIGINE[b])} — ${esc(COMBAT.SPECIAUX[b]?.nom || "")}</option>`).join("")}</select></label>` : ""}
      </div>
      <input type="hidden" name="icone" value="${esc(icone)}">
      <p class="muted" style="margin:6px 0 4px">Icône</p>
      <div class="cat-icones">${icones.map((k) => `<button type="button" class="cat-ic ${k === icone ? "on" : ""}" data-ic="${k}" title="${k}">${svgCat(k)}</button>`).join("")}</div>
      <label class="check"><input type="checkbox" name="sansCouleur" ${c.couleur ? "" : "checked"}> Garder la couleur automatique (selon le continent)</label>
      <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn primary">${cle ? "Enregistrer" : "Créer la catégorie"}</button>${cle ? `<button type="button" class="btn" id="catAnnuler">Annuler</button>` : ""}<span class="err" id="catErr"></span></div></form>`;
  };
  el.innerHTML = `<p class="muted">Renommez les catégories du jeu, changez leur icône ou leur couleur, et créez-en de nouvelles. Les cartes d'une nouvelle catégorie se créent ensuite dans « Nouvelles cartes ».</p>
    <div id="catZone">${formulaire()}</div>
    <h3>Catégories (${toutes.length})</h3>
    <div class="cat-liste">${toutes.map(([k, perso]) => { const c = CATEGORIES_PERSO[k]; return `<div class="cat-ligne panel">
      <span class="cat-pastille" style="${c?.couleur ? `background:${esc(c.couleur)}` : ""}">${svgCat(c?.icone || ICONE_TYPE[k] || "etincelle")}</span>
      <span class="cat-txt"><b>${esc(TYPES[k])}</b><small class="muted">${perso ? `Nouvelle · combat comme ${esc(TYPES_ORIGINE[c.base] || c.base)}` : c ? "Catégorie du jeu · modifiée" : "Catégorie du jeu"} · ${nbCartes(k)} carte${nbCartes(k) > 1 ? "s" : ""}</small></span>
      <span class="row" style="gap:6px"><button class="btn small" data-cat-modif="${k}" data-perso="${perso ? 1 : 0}">Modifier</button>
        ${perso ? `<button class="btn small" data-cat-suppr="${k}">Supprimer</button>` : c ? `<button class="btn small" data-cat-suppr="${k}">Nom d'origine</button>` : ""}</span></div>`; }).join("")}</div>`;
  const brancher = () => {
    const f = $("#fCat", el);
    $$(".cat-ic", f).forEach((b) => b.onclick = () => { $$(".cat-ic", f).forEach((x) => x.classList.toggle("on", x === b)); f.icone.value = b.dataset.ic; });
    f.onsubmit = async (e) => {
      e.preventDefault();
      const o = Object.fromEntries(new FormData(f));
      try {
        await api(`admin/categories/${encodeURIComponent(o.cle)}`, { methode: "PUT", corps: { nom: o.nom, icone: o.icone, couleur: f.sansCouleur.checked ? "" : o.couleur, base: o.base } });
        toast("Catégorie enregistrée."); adminCategories(el);
      } catch (err) { $("#catErr", el).textContent = err.message; }
    };
    $("#catAnnuler", el)?.addEventListener("click", () => { $("#catZone", el).innerHTML = formulaire(); brancher(); });
  };
  brancher();
  $$("[data-cat-modif]", el).forEach((b) => b.onclick = () => { $("#catZone", el).innerHTML = formulaire(b.dataset.catModif, b.dataset.perso === "1"); brancher(); $("#catZone", el).scrollIntoView({ behavior: "smooth" }); });
  $$("[data-cat-suppr]", el).forEach((b) => b.onclick = async () => {
    if (!confirm(CATEGORIES_PERSO[b.dataset.catSuppr]?.perso ? "Supprimer cette catégorie ?" : "Revenir au nom, à l'icône et à la couleur d'origine ?")) return;
    try { await api(`admin/categories/${encodeURIComponent(b.dataset.catSuppr)}`, { methode: "DELETE" }); toast("C'est fait."); adminCategories(el); } catch (e) { toast("⚠ " + e.message); }
  });
}

/* ---------- Admin : les cartes créées (création, modification, image, suppression) ---------- */
adminCartes = async function (el) {
  el.innerHTML = `<p class="muted">Chargement…</p>`;
  let d; try { d = await api(`admin/cartes?t=${Date.now()}`); } catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
  await chargerCategories(true);
  ajouterCartesAdmin(d.cartes, true);
  const local = (ms) => new Date(ms - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const pays = PAYS_BRUTS.map((p) => [p[0], p[1]]).sort((a, b) => a[1].localeCompare(b[1], "fr"));
  let image = null; // nouvelle image choisie (data:…), envoyée après l'enregistrement
  const formulaire = (c = {}) => `<form class="form panel" id="fCarteAdmin" style="max-width:760px">
      <h3 style="margin:0">${c.id ? `Modifier « ${esc(c.nom)} »` : "Nouvelle carte"}</h3>
      <div class="ca-form-grille"><div class="ca-form-champs rf-grille">
        ${c.id ? `<input type="hidden" name="cle" value="${esc(c.id.slice(4))}">` : `<label>Identifiant (lettres, chiffres, tirets)<input name="cle" required pattern="[a-z0-9-]{2,40}" placeholder="tour-de-pise-nuit"></label>`}
        <label>Nom<input name="nom" required maxlength="60" value="${esc(c.nom || "")}"></label>
        <label>Catégorie<select name="type">${categoriesPourCartes().map(([k, n]) => `<option value="${k}" ${c.type === k ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
        <label>Rareté<select name="rarete">${["commun", "peu-commun", "rare", "epique", "ultra-rare", "legendaire"].map((r) => `<option value="${r}" ${c.rarete === r ? "selected" : ""}>${RARETES[r].nom}</option>`).join("")}</select></label>
        <label>Pays<select name="pays">${pays.map(([k, n]) => `<option value="${k}" ${c.pays === k ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
        <label class="large">Anecdote (vérifiable)<input name="anecdote" maxlength="300" value="${esc(c.anecdote || "")}"></label>
        <label>Article Wikipédia pour la photo (si vous n'envoyez pas d'image)<input name="wiki" maxlength="120" value="${esc(c.wiki || "")}" placeholder="Tour de Pise"></label>
        <label>Sortie le<input type="datetime-local" name="sortie" required value="${local(c.sortie || Date.now())}"></label>
        <label>Dans quels boosters<select name="evenement"><option value="">Boosters normaux</option>${d.evenements.map(([k, n]) => `<option value="${k}" ${c.evenement === k ? "selected" : ""}>Événement : ${esc(n)}</option>`).join("")}</select></label>
        <label class="check"><input type="checkbox" name="actif" ${c.actif === false ? "" : "checked"}> Dans les boosters (décocher pour la retirer des boosters sans l'enlever des collections)</label>
      </div><div class="ca-form-image">
        <div class="ca-image-apercu" id="caApercu">${(() => { const u = c.id && (PHOTOS_PERSO[c.id] ? urlPhotoPerso(c.id) : typeof photoDe === "function" && photoDe(c.id)); return u ? `<img src="${esc(u)}" alt="">` : `<span class="muted">Pas encore d'image</span>`; })()}</div>
        <label class="btn small" style="cursor:pointer">Choisir une image<input type="file" id="caFichier" accept="image/*" hidden></label>
        <small class="muted">JPEG, PNG ou WebP. Elle est réduite et compressée automatiquement.</small>
      </div></div>
      <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn primary">${c.id ? "Enregistrer" : "Créer la carte"}</button>${c.id ? `<button type="button" class="btn" id="caAnnuler">Annuler</button>` : ""}<span class="err" id="caErr"></span></div></form>`;
  const etat = (c) => c.sortie > Date.now() ? `Sort le ${new Date(c.sortie).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}` : c.actif ? "Dans les boosters" : "Retirée des boosters";
  el.innerHTML = `<p class="muted">Créez vos cartes, modifiez-les, changez leur image ou supprimez-les. Programmez leur sortie : à la date prévue elles entrent dans les boosters et sont annoncées sur Discord.</p>
    <div id="caForm">${formulaire()}</div>
    <h3>Cartes créées (${d.cartes.length})</h3>
    ${d.cartes.length ? `<div class="ca-liste">${d.cartes.map((c) => `<div class="ca-carte"><div class="ca-apercu">${BY_ID[c.id] ? cardHTML(BY_ID[c.id], { locked: false }) : ""}</div>
        <div><b>${esc(c.nom)}</b><br><small class="muted">${esc(TYPES[c.type] || c.type)} · ${RARETES[c.rarete]?.nom || c.rarete} · ${esc(NOM_PAYS[c.pays] || c.pays)}${c.evenement ? ` · ${esc(c.evenement)}` : ""}</small><br><small>${etat(c)}</small>
        <div class="row" style="margin-top:6px;gap:6px;flex-wrap:wrap"><button class="btn small" data-modif="${esc(c.id)}">Modifier</button><button class="btn small" data-suppr="${esc(c.id)}" data-sortie="${c.sortie}">Supprimer</button></div></div></div>`).join("")}</div>`
      : `<p class="muted">Aucune carte créée pour l'instant.</p>`}`;
  const brancher = () => {
    const f = $("#fCarteAdmin", el); image = null;
    $("#caFichier", f).onchange = async (e) => {
      const fi = e.target.files[0]; if (!fi) return;
      try { image = await preparerVisuel(fi, true); $("#caApercu", f).innerHTML = `<img src="${image}" alt="">`; } catch (err) { $("#caErr", el).textContent = err.message; }
    };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const o = Object.fromEntries(new FormData(f));
      try {
        const r = await api(`admin/cartes/${encodeURIComponent(o.cle)}`, { methode: "PUT", corps: { ...o, sortie: new Date(o.sortie).getTime(), actif: f.actif.checked } });
        if (image) { const ph = await api("admin/photo-perso", { methode: "POST", corps: { carte: r.id, image } }); if (typeof PHOTOS_PERSO === "object") { PHOTOS_PERSO[r.id] = ph.maj; majPhotosPerso?.(r.id); } }
        toast(new Date(o.sortie).getTime() > Date.now() ? `Carte programmée pour le ${new Date(o.sortie).toLocaleString("fr-FR")}.` : "Carte enregistrée : elle est dans les boosters.");
        adminCartes(el);
      } catch (err) { $("#caErr", el).textContent = err.message; }
    };
    $("#caAnnuler", el)?.addEventListener("click", () => { $("#caForm", el).innerHTML = formulaire(); brancher(); });
  };
  brancher();
  $$("[data-modif]", el).forEach((b) => b.onclick = () => { $("#caForm", el).innerHTML = formulaire(d.cartes.find((c) => c.id === b.dataset.modif)); brancher(); $("#caForm", el).scrollIntoView({ behavior: "smooth" }); });
  $$("[data-suppr]", el).forEach((b) => b.onclick = async () => {
    const sortie = Number(b.dataset.sortie) <= Date.now();
    if (!confirm(sortie ? "Cette carte est déjà sortie : les joueurs qui l'ont la perdront. Supprimer quand même ?" : "Supprimer cette carte programmée ?")) return;
    try {
      await api(`admin/cartes/${encodeURIComponent(b.dataset.suppr.slice(4))}`, { methode: "DELETE" });
      const i = CARDS.findIndex((c) => c.id === b.dataset.suppr); if (i >= 0) CARDS.splice(i, 1); delete BY_ID[b.dataset.suppr];
      toast("Carte supprimée."); adminCartes(el);
    } catch (e) { toast("⚠ " + e.message); }
  });
};
