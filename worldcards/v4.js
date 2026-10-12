"use strict";
/* Play2F1 v4 : réglages du jeu (chances des boosters, decks), rangs officiels 2F1 et ligues,
   nouvelle navigation (Collection à côté de l'Accueil), accueil centré sur les boosters,
   raccourci clavier Espace. Chargé après v3.js. */

/* ---------- Réglages du jeu (admin → serveur → tous les joueurs) ---------- */
const REGLAGES_CLIENT_DEFAUT = {
  chances: { pityPas: 5, bonusNouvelle: 1, packs: { monde: { poids: { "commun": 68, "peu-commun": 22, "rare": 8, "epique": 1.5, "ultra-rare": 0.4, "legendaire": 0.1 }, garantie: 1 } } },
  deck: { budget: 30, maxLegendaires: 3 },
  classe: { parJour: 5, memeAdversaire: 1 },
};
let REGLAGES = REGLAGES_CLIENT_DEFAUT;
const GARANTIES_ORIGINE = Object.fromEntries(Object.entries(PACKS).map(([k, p]) => [k, (p.garanties || []).slice()]));
const POIDS_ORIGINE = Object.fromEntries(Object.entries(PACKS).map(([k, p]) => [k, p.poids ? { ...p.poids } : null]));
function appliquerReglages(r) {
  if (!r || !r.chances) return;
  REGLAGES = r;
  PITY_PAS = Number(r.chances.pityPas) >= 0 ? Number(r.chances.pityPas) : PITY_PAS;
  BONUS_NOUVELLE = Number(r.chances.bonusNouvelle) > 0 ? Number(r.chances.bonusNouvelle) : BONUS_NOUVELLE;
  for (const [k, p] of Object.entries(PACKS)) {
    const c = r.chances.packs?.[k];
    p.poids = c?.poids ? { ...c.poids } : POIDS_ORIGINE[k];
    const g = GARANTIES_ORIGINE[k] || [];
    // La garantie réglée remplace la rareté minimale de la dernière carte du booster
    p.garanties = !c || c.garantie === undefined ? g.slice() : c.garantie === null ? g.slice(0, -1) : [...g.slice(0, -1), c.garantie];
  }
  if (r.deck) { COMBAT.BUDGET = r.deck.budget; REGLES_DECK.maxLegendaires = r.deck.maxLegendaires; }
}
try { appliquerReglages(JSON.parse(localStorage.getItem("worldcards:reglages")) || REGLAGES_CLIENT_DEFAUT); } catch { appliquerReglages(REGLAGES_CLIENT_DEFAUT); }
async function chargerReglages() {
  try {
    const r = await api("reglages");
    appliquerReglages(r);
    try { localStorage.setItem("worldcards:reglages", JSON.stringify(r)); } catch {}
  } catch {}
}
chargerReglages();

/* ---------- Rangs officiels 2F1 ---------- */
let RANGS = [];
const chiffreRomain = (n) => ["", "I", "II", "III", "IV", "V"][n] || "";
// Badge de rang : le logo importé par l'admin (proportions et transparence conservées), sinon une pastille de couleur
function rangBadge(r, taille = "petit") {
  if (!r) return "";
  const titre = `${r.nom}${r.division ? " " + chiffreRomain(r.division) : ""}${r.trophees !== undefined ? ` · ${r.trophees} points` : ""}${r.suivant ? ` · ${r.progression} % vers ${r.suivant.nom}` : ""}`;
  return `<span class="rang-badge ${taille}" style="--rc:${esc(r.couleur || "#888")}" title="${esc(titre)}" data-rang="${esc(r.cle)}">${r.logo ? `<img src="${esc(r.logo)}" alt="${esc(r.nom)}" loading="lazy">` : `<b>${esc((r.nom || "?").slice(0, 1))}</b>`}</span>`;
}
async function chargerRangs() {
  try { const r = await api("rangs"); RANGS = r.rangs || []; return r; } catch { return { rangs: RANGS, moi: null }; }
}

async function vueLigues(v) {
  v.innerHTML = `<header class="page-tete"><h1>Ligues</h1><p>Gagnez des combats classés pour monter de rang. <b>${REGLAGES.classe.parJour} combats classés</b> comptent chaque jour (arène et duels classés entre amis) ; au-delà, vous pouvez continuer à jouer sans points.</p></header>
    <section class="panel ligue-moi" id="lgMoi"><p class="muted">Chargement…</p></section>
    <section class="panel"><h3 style="margin-top:0">Les rangs</h3><div class="rangs-grille" id="lgRangs"></div></section>
    <div class="grid2"><section class="panel"><h3 style="margin-top:0">🏆 Classement</h3><div id="lgClassement" class="muted">Chargement…</div></section>
      <section class="panel"><h3 style="margin-top:0">📈 Mon historique de rang</h3><div id="lgHisto" class="muted">—</div></section></div>`;
  const { rangs, moi } = await chargerRangs();
  const actifs = (rangs || []).filter((r) => r.actif).sort((a, b) => a.min - b.min);
  const g = $("#lgRangs"); if (!g) return;
  g.innerHTML = actifs.length ? actifs.map((r, i) => `<div class="rang-carte ${moi?.cle === r.cle ? "moi" : ""}" style="--rc:${esc(r.couleur)}">${rangBadge(r, "grand")}
      <b>${esc(r.nom)}</b><span class="muted">${fmt(r.min)}${actifs[i + 1] ? ` – ${fmt(actifs[i + 1].min - 1)}` : r.max !== null && r.max !== undefined ? ` – ${fmt(r.max)}` : " +"} points</span>
      ${r.description ? `<small>${esc(r.description)}</small>` : ""}${r.recompense?.pieces || r.recompense?.boosters ? `<small class="recomp">Fin de saison : ${r.recompense.pieces ? fmt(r.recompense.pieces) + " 🪙" : ""}${r.recompense.boosters ? ` · ${r.recompense.boosters} booster${r.recompense.boosters > 1 ? "s" : ""}` : ""}</small>` : ""}</div>`).join("")
    : `<p class="muted">Les rangs ne sont pas encore configurés.</p>`;
  const el = $("#lgMoi");
  if (typeof connecte !== "function" || !connecte()) {
    el.innerHTML = `<p>Connectez-vous pour obtenir un rang et participer aux ligues.</p><button class="btn primary" data-aller="compte">Se connecter</button>`; brancherLiens(el);
  } else {
    try {
      const a = await api("arene/moi");
      const r = a.rangInfo || moi;
      el.innerHTML = `${rangBadge(r, "geant")}<div class="lm-infos"><span class="muted">Mon rang</span><h2>${esc(r?.nom || "—")} ${r?.division ? chiffreRomain(r.division) : ""}</h2>
        <p><b>${fmt(a.trophees)}</b> points${r?.suivant ? ` · encore <b>${fmt(r.suivant.min - a.trophees)}</b> pour ${esc(r.suivant.nom)}` : " · rang maximum"}</p>
        <div class="pvbar"><i style="width:${r?.progression ?? 0}%"></i></div>
        <p class="muted">Combats classés restants aujourd'hui : <b>${a.classes?.restants ?? "—"}/${a.classes?.parJour ?? "—"}</b> · ${a.victoires} victoires · ${a.defaites} défaites</p>
        <div class="row"><button class="btn primary" data-aller="combat">⚔️ Combat classé</button><button class="btn" data-aller="hub">🤝 Défier un ami</button></div></div>`;
      brancherLiens(el);
    } catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
    try {
      const { historique } = await api("rangs/historique/" + encodeURIComponent(COMPTE.pseudo));
      const nom = (k) => esc(RANGS.find((x) => x.cle === k)?.nom || k || "—");
      $("#lgHisto").innerHTML = historique.length ? historique.map((h) => `<div class="codex-ligne"><span>${nom(h.ancien)} → <b>${nom(h.nouveau)}</b></span><small>${fmt(h.trophees)} pts · ${depuis(h.cree_le)}</small></div>`).join("") : "Pas encore de changement de rang.";
    } catch {}
  }
  try {
    const { joueurs } = await api("arene/classement");
    $("#lgClassement").innerHTML = joueurs.length ? `<table class="classement"><tbody>${joueurs.slice(0, 30).map((j, i) => `<tr class="${j.pseudo === COMPTE.pseudo ? "moi" : ""}"><td>${["🥇", "🥈", "🥉"][i] || i + 1}</td><td>${rangBadge(j.rang, "petit")} <a href="#" data-joueur="${esc(j.pseudo)}">${esc(j.pseudo)}</a></td><td>${fmt(j.trophees)}</td><td class="muted">${j.victoires}V ${j.defaites}D</td></tr>`).join("")}</tbody></table>` : "Personne pour l'instant.";
    $$("[data-joueur]", $("#lgClassement")).forEach((a) => a.onclick = (e) => { e.preventDefault(); if (typeof ficheJoueur === "function") ficheJoueur(a.dataset.joueur); });
  } catch (e) { $("#lgClassement").textContent = e.message; }
}
ajouterPage("ligues", "🏅", "Ligues", vueLigues);
ICONES.ligues = '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>';
ICONES.collection = ICONES.album;

/* ---------- Navigation : Collection juste à côté de l'Accueil ---------- */
{
  const d = DESTINATIONS.find((x) => x[0] === "album"); if (d) d[2] = "Collection";
  TITRES.album = "📚 Collection";
  ONGLETS_MOBILE.splice(0, ONGLETS_MOBILE.length, "accueil", "album", "boosters", "combat");
  NAV_ORDI.splice(0, NAV_ORDI.length, "accueil", "album", "boosters", "combat", "ligues", "hub", "compte");
  for (const k of ["ligues"]) { const i = DESTINATIONS.findIndex((x) => x[0] === k); if (i >= 0) { const [x] = DESTINATIONS.splice(i, 1); DESTINATIONS.splice(DESTINATIONS.findIndex((y) => y[0] === "combat") + 1, 0, x); } }
}

/* ---------- Accueil : les boosters d'abord, puis des raccourcis ---------- */
const _vueAccueilV4 = vueAccueil;
vueAccueil = function (v) {
  const r = _vueAccueilV4.apply(this, arguments);
  const stock = boostersEnStock(), gratuit = gratuitDans() === 0;
  const pack = Object.keys(PACKS).find((k) => S.boosters[k] > 0) || "monde";
  v.insertAdjacentHTML("afterbegin", `<section class="accueil-booster">
      <div class="ab-pack"><div class="pack ${pack}" style="--pc:${esc(PACKS[pack].couleur || "#ff5b35")}"><span class="big">${PACKS[pack].emoji}</span><b>${esc(PACKS[pack].nom)}</b></div></div>
      <div class="ab-texte"><span class="ab-sur">${stock ? `${stock} booster${stock > 1 ? "s" : ""} à ouvrir` : gratuit ? "Booster gratuit disponible" : `Prochain booster gratuit dans ${duree(gratuitDans())}`}</span>
        <h2>${stock || gratuit ? "Votre prochain booster vous attend" : "Ouvrez un booster"}</h2>
        <p class="muted">5 cartes du monde entier. La meilleure arrive en dernier.<span class="ordi-seul"> Appuyez sur <kbd>Espace</kbd> pour ouvrir.</span></p>
        <div class="row"><button class="btn-ouvrir" id="abOuvrir">${stock ? "Ouvrir maintenant" : gratuit ? "Récupérer le booster gratuit" : "Voir la boutique"}</button></div></div>
      <nav class="ab-raccourcis" aria-label="Raccourcis">
        ${[["album", "Collection"], ["combat", "Combat"], ["combat", "Mon deck", "deck"], ["ligues", "Ligues"], ["compte", "Profil"]].map(([k, n, ic]) => `<button data-aller="${k}">${svgIcone(ic === "deck" ? "boosters" : k)}<span>${n}</span></button>`).join("")}
      </nav></section>`);
  appliquerVisuels(v);
  brancherLiens(v);
  $("#abOuvrir").onclick = () => {
    if (stock) return ouvrirBooster(pack);
    if (gratuit) { aller("boosters"); setTimeout(() => $("#gratuit")?.click(), 300); return; }
    aller("boosters");
  };
  return r;
};

/* ---------- Raccourci clavier : Espace ouvre un booster ou passe à l'étape suivante ---------- */
let derniereTouche = 0;
document.addEventListener("keydown", (e) => {
  if (e.code !== "Space" && e.key !== " ") return;
  const t = e.target;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return; // on écrit : on ne touche à rien
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const m = $("#modal"), ouverte = m && !m.classList.contains("hidden");
  const scene = ouverte ? $("#pkScene") : null;
  let action = null;
  if (scene) {
    const resume = $(".opening", scene) && $(".poke .row", scene);
    if (resume) { const again = $("#again"); if (again && !again.disabled) action = () => again.click(); }
    else action = () => scene.click();
  } else if (!ouverte && S.vue === "boosters") {
    const b = $(".btn-ouvrir"); if (b && !b.disabled) action = () => b.click();
  } else if (!ouverte && S.vue === "accueil") {
    const b = $("#abOuvrir"); if (b && boostersEnStock()) action = () => b.click();
  }
  if (!action) return;
  e.preventDefault();
  // Anti-rafale : jamais deux ouvertures ou achats accidentels d'affilée
  const n = Date.now(); if (n - derniereTouche < 450) return; derniereTouche = n;
  action();
});

/* ---------- Admin : ligues et rangs ---------- */
async function adminRangs(el) {
  el.innerHTML = `<p class="muted">Les 8 rangs officiels 2F1. Leur ordre, leurs seuils et leurs règles se règlent ici ; le rang de chaque joueur est calculé par le serveur à partir de ses points de combat classé. Logos : PNG ou WebP (transparence conservée), 1 Mo maximum.</p><div id="arListe">Chargement…</div>`;
  const { rangs } = await chargerRangs();
  const liste = $("#arListe");
  liste.innerHTML = `<div class="admin-rangs">${rangs.map((r) => `<form class="panel form rang-form" data-cle="${esc(r.cle)}" style="--rc:${esc(r.couleur)}">
      <div class="rf-tete"><div class="rf-logo" data-apercu>${rangBadge(r, "grand")}</div><div><b>${esc(r.nom)}</b><span class="muted">clé : ${esc(r.cle)}</span></div>
        <label class="btn small" style="cursor:pointer">${r.logo ? "Remplacer le logo" : "Importer le logo"}<input type="file" accept="image/png,image/webp" hidden data-logo></label>
        ${r.logo ? `<button type="button" class="btn small" data-sans-logo>Retirer</button>` : ""}</div>
      <p class="muted rf-etat" data-etat></p>
      <div class="rf-grille">
        <label>Nom affiché<input name="nom" value="${esc(r.nom)}" maxlength="24" required></label>
        <label>Couleur<input name="couleur" type="color" value="${esc(r.couleur)}"></label>
        <label>Ordre d'affichage<input name="ordre" type="number" min="0" max="99" value="${r.ordre}"></label>
        <label>Points minimum<input name="min" type="number" min="0" value="${r.min}" required></label>
        <label>Points maximum (vide = jusqu'au rang suivant)<input name="max" type="number" min="0" value="${r.max ?? ""}"></label>
        <label>Divisions (1 à 5)<input name="divisions" type="number" min="1" max="5" value="${r.divisions}"></label>
        <label>Récompense de fin de saison : pièces<input name="recompensePieces" type="number" min="0" value="${r.recompense.pieces}"></label>
        <label>… et boosters<input name="recompenseBoosters" type="number" min="0" max="50" value="${r.recompense.boosters}"></label>
        <label class="large">Description<input name="description" value="${esc(r.description || "")}" maxlength="300"></label>
        <label class="large">Conditions de montée<input name="montee" value="${esc(r.montee || "")}" maxlength="200" placeholder="Ex. : atteindre le seuil de points du rang"></label>
        <label class="large">Conditions de descente<input name="descente" value="${esc(r.descente || "")}" maxlength="200" placeholder="Ex. : repasser sous le seuil"></label>
        <label class="check"><input name="actif" type="checkbox" ${r.actif ? "checked" : ""}> Rang actif</label>
      </div>
      <button class="btn primary">Enregistrer ${esc(r.nom)}</button></form>`).join("")}</div>`;
  $$(".rang-form", liste).forEach((f) => {
    const cle = f.dataset.cle, etat = $("[data-etat]", f);
    let logoEnAttente = null;
    $("[data-logo]", f).onchange = async (e) => {
      const fi = e.target.files[0]; if (!fi) return;
      if (!/^image\/(png|webp)$/.test(fi.type)) return (etat.textContent = "⚠ Choisissez un PNG ou un WebP.");
      if (fi.size > 1.4e6) return (etat.textContent = "⚠ Fichier trop lourd (1 Mo maximum).");
      logoEnAttente = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(fi); });
      $("[data-apercu]", f).innerHTML = `<span class="rang-badge grand"><img src="${logoEnAttente}" alt=""></span>`;
      etat.innerHTML = `Aperçu du nouveau logo. <button type="button" class="btn small primary" data-publier>Publier ce logo</button> <button type="button" class="btn small" data-annuler>Annuler</button>`;
      $("[data-publier]", f).onclick = async () => {
        try { await api(`admin/rangs/${cle}/logo`, { methode: "POST", corps: { image: logoEnAttente } }); toast("🏅 Logo publié."); adminRangs(el); }
        catch (err) { etat.textContent = "⚠ " + err.message; }
      };
      $("[data-annuler]", f).onclick = () => adminRangs(el);
    };
    const sans = $("[data-sans-logo]", f);
    if (sans) sans.onclick = async () => { if (!confirm("Retirer le logo de ce rang ?")) return; await api(`admin/rangs/${cle}/logo`, { methode: "DELETE" }).catch(() => {}); adminRangs(el); };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f)); d.actif = !!f.elements.actif.checked;
      try { await api(`admin/rangs/${cle}`, { methode: "PUT", corps: d }); toast(`🏅 Rang ${d.nom} enregistré.`); adminRangs(el); }
      catch (err) { etat.textContent = "⚠ " + err.message; }
    };
  });
}

/* ---------- Admin : chances des boosters et règles ---------- */
async function adminReglages(el) {
  try { const r = await api("reglages"); appliquerReglages(r); } catch {}
  const R = REGLAGES, rs = Object.keys(RARETES).filter((r) => r !== "secrete");
  const packs = Object.keys(PACKS);
  const nomRar = (o) => Object.values(RARETES).find((x) => x.ordre === Number(o))?.nom || "—";
  el.innerHTML = `<form class="form" id="fReglages">
    <section class="panel"><h3 style="margin-top:0">🎲 Chances des boosters</h3>
      <p class="muted">Poids de chaque rareté (relatifs : ils sont convertis en pourcentages). Laissez une ligne vide pour garder les valeurs d'origine du booster. La « garantie » fixe la rareté minimale de la dernière carte.</p>
      <div style="overflow-x:auto"><table class="table-chances"><thead><tr><th>Booster</th>${rs.map((r) => `<th>${RARETES[r].nom}</th>`).join("")}<th>Garantie</th><th>% réels</th></tr></thead><tbody>
      ${packs.map((k) => { const c = R.chances.packs?.[k] || {}; const p = c.poids || {};
        return `<tr data-pack="${k}"><td><b>${esc(PACKS[k].emoji || "")} ${esc(PACKS[k].nom)}</b></td>${rs.map((r) => `<td><input type="number" step="0.1" min="0" max="1000" data-r="${r}" value="${p[r] ?? ""}" placeholder="${(POIDS_ORIGINE[k] || {})[r] ?? RARETES[r].poids}"></td>`).join("")}
          <td><select data-garantie><option value="">D'origine (${(GARANTIES_ORIGINE[k] || []).length ? nomRar(GARANTIES_ORIGINE[k].slice(-1)[0]) : "aucune"})</option><option value="aucune" ${c.garantie === null ? "selected" : ""}>Aucune</option>${rs.map((r) => `<option value="${RARETES[r].ordre}" ${c.garantie === RARETES[r].ordre ? "selected" : ""}>${RARETES[r].nom} ou mieux</option>`).join("")}</select></td>
          <td class="muted" data-pc></td></tr>`; }).join("")}
      </tbody></table></div>
      <div class="rf-grille">
        <label>Jauge de chance : % ajoutés par booster (0 = désactivée)<input name="pityPas" type="number" min="0" max="50" step="1" value="${R.chances.pityPas}"></label>
        <label>Bonus des cartes jamais obtenues (1 = aucun ; plus bas = plus de doublons)<input name="bonusNouvelle" type="number" min="0.2" max="5" step="0.1" value="${R.chances.bonusNouvelle}"></label>
      </div></section>
    <section class="panel"><h3 style="margin-top:0">🃏 Règles des decks et du classement</h3><div class="rf-grille">
      <label>Budget de coût d'un deck (${COMBAT.TAILLE_DECK} cartes)<input name="budget" type="number" min="10" max="60" value="${R.deck.budget}"></label>
      <label>Légendaires / secrètes max par deck<input name="maxLegendaires" type="number" min="0" max="10" value="${R.deck.maxLegendaires}"></label>
      <label>Combats classés comptés par jour<input name="parJour" type="number" min="1" max="50" value="${R.classe.parJour}"></label>
      <label>Duels classés qui rapportent des points contre un même adversaire (par jour)<input name="memeAdversaire" type="number" min="0" max="10" value="${R.classe.memeAdversaire}"></label>
    </div></section>
    <button class="btn primary">Enregistrer les réglages</button> <span class="muted" id="rgEtat"></span></form>`;
  const majPc = () => $$("tr[data-pack]", el).forEach((tr) => {
    const k = tr.dataset.pack, w = rs.map((r) => { const i = $(`[data-r="${r}"]`, tr); return Number(i.value === "" ? i.placeholder : i.value) || 0; });
    const tot = w.reduce((a, b) => a + b, 0) || 1;
    $("[data-pc]", tr).textContent = w.map((x) => (Math.round((x / tot) * 1000) / 10) + "%").join(" · ");
  });
  majPc(); $$("tr[data-pack] input", el).forEach((i) => i.oninput = majPc);
  $("#fReglages").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target, packsOut = {};
    $$("tr[data-pack]", el).forEach((tr) => {
      const poids = {}; let vide = true;
      rs.forEach((r) => { const v = $(`[data-r="${r}"]`, tr).value; if (v !== "") { poids[r] = Number(v); vide = false; } });
      const g = $("[data-garantie]", tr).value;
      if (!vide || g !== "") packsOut[tr.dataset.pack] = { poids: vide ? null : poids, garantie: g === "" ? undefined : g === "aucune" ? null : Number(g) };
    });
    const corps = { chances: { pityPas: f.pityPas.value, bonusNouvelle: f.bonusNouvelle.value, packs: packsOut },
      deck: { budget: f.budget.value, maxLegendaires: f.maxLegendaires.value }, classe: { parJour: f.parJour.value, memeAdversaire: f.memeAdversaire.value } };
    try {
      const r = await api("admin/reglages", { methode: "PUT", corps });
      appliquerReglages({ ...r.reglages }); try { localStorage.setItem("worldcards:reglages", JSON.stringify(r.reglages)); } catch {}
      $("#rgEtat").textContent = "✅ Enregistré : appliqué à tous les joueurs à leur prochain chargement.";
    } catch (err) { $("#rgEtat").textContent = "⚠ " + err.message; }
  };
}

/* ---------- Partage : image d'une carte ou d'un booster (Story 9:16 ou Post 4:5) ---------- */
let SLUGS = null;
async function slugDe(id) {
  if (!SLUGS) { try { SLUGS = await (await fetch("/carte/index.json")).json(); } catch { SLUGS = {}; } }
  return SLUGS[id] || null;
}
const COULEUR_RARETE = { "commun": "#9aa5b4", "peu-commun": "#34d399", "rare": "#60a5fa", "epique": "#c084fc", "ultra-rare": "#fb7185", "legendaire": "#fbbf24", "secrete": "#f0abfc" };
const chargerImage = (src) => new Promise((ok) => { if (!src) return ok(null); const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
function sourceVisuel(c) {
  if (typeof PHOTOS_PERSO !== "undefined" && PHOTOS_PERSO[c.id]) return urlPhotoPerso(c.id);
  if (c.type === "pays" && c.code) return `flags/${c.code.toLowerCase()}.svg`;
  return photoDe(c.id) || null;
}
function texteAjuste(g, t, x, y, largeur, taille, poids = 800, police = "Bricolage Grotesque, DM Sans, sans-serif") {
  let s = taille; do { g.font = `${poids} ${s}px ${police}`; s -= 2; } while (g.measureText(t).width > largeur && s > 12);
  g.fillText(t, x, y);
}
function rectArrondi(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
// Dessine une carte dans le rectangle (x, y, w, h) : visuel, cadre de rareté, nom, rareté, statistiques
async function dessinerCarte(g, c, x, y, w, h) {
  const col = COULEUR_RARETE[c.rarete] || "#999", r = w * 0.06;
  g.save(); rectArrondi(g, x, y, w, h, r); g.fillStyle = "#1b1c20"; g.fill(); g.clip();
  const img = await chargerImage(sourceVisuel(c)), ph = h * 0.66;
  if (img) {
    if (c.type === "pays" && !PHOTOS_PERSO?.[c.id]) { g.fillStyle = "#26282d"; g.fillRect(x, y, w, ph); const fw = w * 0.78, fh = fw * (img.height / img.width || 0.66); g.drawImage(img, x + (w - fw) / 2, y + (ph - fh) / 2, fw, fh); }
    else { const k = Math.max(w / img.width, ph / img.height), iw = img.width * k, ih = img.height * k; g.drawImage(img, x + (w - iw) / 2, y + (ph - ih) / 2, iw, ih); }
  } else { g.fillStyle = "#26282d"; g.fillRect(x, y, w, ph); g.font = `${w * 0.36}px serif`; g.textAlign = "center"; g.fillText(c.emoji || "🃏", x + w / 2, y + ph * 0.62); }
  const grad = g.createLinearGradient(0, y + ph * 0.7, 0, y + ph); grad.addColorStop(0, "rgba(27,28,32,0)"); grad.addColorStop(1, "#1b1c20"); g.fillStyle = grad; g.fillRect(x, y + ph * 0.7, w, ph * 0.3);
  g.textAlign = "center"; g.fillStyle = "#f2ede4";
  texteAjuste(g, c.nom, x + w / 2, y + ph + h * 0.09, w * 0.9, Math.round(w * 0.1));
  g.fillStyle = col; g.font = `800 ${Math.round(w * 0.055)}px DM Sans, sans-serif`;
  g.fillText(`${RARETES[c.rarete]?.nom || ""} · ${TYPES[c.type] || ""} n° ${String(c.num || 0).padStart(3, "0")}`.toUpperCase(), x + w / 2, y + ph + h * 0.16);
  const st = statsDe(c); g.fillStyle = "#cfc9be"; g.font = `700 ${Math.round(w * 0.06)}px DM Sans, sans-serif`;
  g.fillText(`⚔️ ${st.atk}   🛡️ ${st.def}   ❤️ ${st.pv}`, x + w / 2, y + ph + h * 0.25);
  g.restore();
  rectArrondi(g, x, y, w, h, r); g.lineWidth = Math.max(4, w * 0.025); g.strokeStyle = col; g.stroke(); // cadre par-dessus tout
}
async function imagePartage(cartes, { format = "story", pseudo = "", titre = "", lienTxt = "play2f1.com" } = {}) {
  const W = 1080, H = format === "story" ? 1920 : 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  const fond = g.createLinearGradient(0, 0, 0, H); fond.addColorStop(0, "#1a1310"); fond.addColorStop(1, "#0d0e10"); g.fillStyle = fond; g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(255,91,53,.10)"; g.beginPath(); g.arc(W * 0.15, H * 0.05, W * 0.6, 0, Math.PI * 2); g.fill();
  const logo = await chargerImage("icons/logo-site.png");
  if (logo) { const lh = 90, lw = logo.width * (lh / logo.height); g.drawImage(logo, (W - lw) / 2, 60, lw, lh); }
  g.textAlign = "center"; g.fillStyle = "#f2ede4"; texteAjuste(g, titre, W / 2, 220, W - 120, 56);
  if (cartes.length === 1) {
    const w = format === "story" ? 760 : 640, h = w * 1.4; await dessinerCarte(g, cartes[0], (W - w) / 2, format === "story" ? 330 : 270, w, h);
  } else {
    const top = cartes.slice(0, 5), best = top[top.length - 1];
    const bw = format === "story" ? 560 : 420, bh = bw * 1.4, by = format === "story" ? 290 : 260;
    await dessinerCarte(g, best, (W - bw) / 2, by, bw, bh);
    const autres = top.slice(0, -1), sw = format === "story" ? 230 : 200, sh = sw * 1.4, gap = 18, tot = autres.length * sw + (autres.length - 1) * gap;
    for (let i = 0; i < autres.length; i++) await dessinerCarte(g, autres[i], (W - tot) / 2 + i * (sw + gap), by + bh + 40, sw, sh);
  }
  g.fillStyle = "#9d978c"; g.font = "600 34px DM Sans, sans-serif";
  if (pseudo) g.fillText(`Collection de ${pseudo}`, W / 2, H - 150);
  g.fillStyle = "#ff8a65"; g.font = "800 44px DM Sans, sans-serif"; g.fillText(lienTxt, W / 2, H - 90);
  return new Promise((ok) => cv.toBlob(ok, "image/png"));
}
async function partager(cartes, titre) {
  cartes = cartes.filter(Boolean); if (!cartes.length) return;
  const slug = cartes.length === 1 ? await slugDe(cartes[0].id) : null;
  const url = slug ? `https://play2f1.com/carte/${slug}` : "https://play2f1.com/";
  const etat = { format: "story", pseudo: true };
  ouvrirModal(`<h2 style="margin-top:0">📤 Partager</h2>
    <div class="partage"><div class="partage-apercu"><img id="ptImg" alt="Aperçu de l'image à partager"><p class="muted" id="ptEtat">Création de l'image…</p></div>
    <div class="partage-options"><div class="seg" id="ptFormat"><button data-f="story" class="on">Story 9:16<small>TikTok, Insta, Snap</small></button><button data-f="post">Post 4:5<small>Instagram, X</small></button></div>
      ${typeof connecte === "function" && connecte() ? `<label class="check"><input type="checkbox" id="ptPseudo" checked> Afficher mon pseudo (${esc(COMPTE.pseudo)})</label>` : ""}
      <button class="btn primary" id="ptNatif">📤 Partager…</button><button class="btn" id="ptTelecharger">⬇️ Télécharger l'image</button><button class="btn" id="ptLien">🔗 Copier le lien</button>
      ${slug ? `<a class="btn" href="/carte/${esc(slug)}" target="_blank" rel="noopener">🌐 Page publique de la carte</a>` : ""}</div></div>`);
  let blob = null;
  const regenerer = async () => {
    $("#ptEtat").textContent = "Création de l'image…";
    blob = await imagePartage(cartes, { format: etat.format, pseudo: etat.pseudo && connecte?.() ? COMPTE.pseudo : "", titre, lienTxt: url.replace("https://", "").replace(/\/$/, "") });
    const img = $("#ptImg"); if (!img) return;
    if (img.src) URL.revokeObjectURL(img.src); img.src = URL.createObjectURL(blob); $("#ptEtat").textContent = "";
  };
  $$("#ptFormat button").forEach((b) => b.onclick = () => { $$("#ptFormat button").forEach((x) => x.classList.toggle("on", x === b)); etat.format = b.dataset.f; regenerer(); });
  $("#ptPseudo")?.addEventListener("change", (e) => { etat.pseudo = e.target.checked; regenerer(); });
  $("#ptTelecharger").onclick = () => { if (!blob) return; const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `play2f1-${slug || "booster"}.png`; a.click(); };
  $("#ptLien").onclick = async () => { try { await navigator.clipboard.writeText(url); toast("🔗 Lien copié."); } catch { prompt("Copiez le lien :", url); } };
  $("#ptNatif").onclick = async () => {
    if (!blob) return;
    const fichier = new File([blob], `play2f1-${slug || "booster"}.png`, { type: "image/png" });
    try {
      if (navigator.canShare?.({ files: [fichier] })) await navigator.share({ files: [fichier], title: "Play2F1", text: `${titre} ${url}` });
      else if (navigator.share) await navigator.share({ title: "Play2F1", text: titre, url });
      else { $("#ptTelecharger").click(); toast("Image téléchargée : partagez-la depuis vos fichiers."); }
    } catch {}
  };
  regenerer();
}
// Fiche d'une carte : bouton Partager + lien vers sa page publique
const _ficheCarteV4 = ficheCarte;
ficheCarte = function (c) {
  const r = _ficheCarteV4.apply(this, arguments);
  const zone = $("#modal .detail .row") || $("#modal .detail");
  if (zone && c && !$("#fcPartager")) {
    zone.insertAdjacentHTML("beforeend", `<button class="btn" id="fcPartager">📤 Partager</button>`);
    $("#fcPartager").onclick = () => partager([c], c.nom);
  }
  return r;
};
