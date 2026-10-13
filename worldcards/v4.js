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
  // La description du booster Classique suit la garantie réglée par l'admin
  const gm = PACKS.monde?.garanties?.slice(-1)[0], rg = Object.values(RARETES).find((x) => x.ordre === gm);
  if (PACKS.monde) PACKS.monde.desc = rg && gm > 0 ? `5 cartes, dont au moins une ${rg.nom.toLowerCase()} ou mieux.` : "5 cartes du monde entier.";
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
        <div class="row"><button class="btn primary" id="lgMatch">⚡ Adversaire en direct</button><button class="btn" data-aller="combat">⚔️ Arène</button><button class="btn" data-aller="hub">🤝 Défier un ami</button></div></div>`;
      $("#lgMatch").onclick = () => chercherAdversaire();
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
    <section class="panel"><h3 style="margin-top:0">🏅 Récompenses des succès (pièces)</h3><div class="rf-grille" id="rgSucces"><p class="muted">Chargement…</p></div></section>
    <button class="btn primary">Enregistrer les réglages</button> <span class="muted" id="rgEtat"></span></form>`;
  api("succes").then(({ succes }) => { const z = $("#rgSucces"); if (z) z.innerHTML = succes.map((x) => `<label>${x.icone} ${esc(x.nom)}<input type="number" min="0" max="100000" data-succes="${esc(x.cle)}" value="${x.pieces}"></label>`).join(""); }).catch(() => { const z = $("#rgSucces"); if (z) z.textContent = "Indisponible."; });
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
      deck: { budget: f.budget.value, maxLegendaires: f.maxLegendaires.value }, classe: { parJour: f.parJour.value, memeAdversaire: f.memeAdversaire.value },
      succes: Object.fromEntries($$("[data-succes]", el).map((i) => [i.dataset.succes, i.value])) };
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

/* ---------- Boutique de packs payants ---------- */
const prixEuros = (n) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const valeurPieces = (o) => o.pieces + Object.entries(o.boosters || {}).reduce((t, [k, n]) => t + (PACKS[k]?.prix || 0) * n, 0);
function contenuPack(o) {
  const cosm = o.cosmetique ? (() => { const [t, id] = o.cosmetique.split(":"); const i = infoCosm(t, id); return i ? `${i.ic || "🎨"} ${i.nom} (${{ dos: "dos de cartes", cadre: "cadre de profil", effet: "effet d'ouverture", titre: "titre" }[t] || t})` : o.cosmetique; })() : null;
  return [cosm, o.pieces ? `${fmt(o.pieces)} 🪙 pièces` : null, ...Object.entries(o.boosters || {}).filter(([k, n]) => n && PACKS[k]).map(([k, n]) => `${n} booster${n > 1 ? "s" : ""} ${PACKS[k].emoji} ${PACKS[k].nom}`)].filter(Boolean);
}
async function blocPacks(el) {
  let r; try { r = await api("offres"); } catch { el.remove(); return; }
  if (!r.offres.length) { el.remove(); return; }
  el.innerHTML = `<div class="sectiontitle"><h3>🛍️ Packs</h3><span class="muted">Paiement par carte ou PayPal · prix TTC · contenu livré sur votre compte</span></div>
    <div class="packs-offres">${r.offres.map((o) => `<article class="offre ${o.badge ? "mise-en-avant" : ""}">
      ${o.badge ? `<span class="offre-badge">${esc(o.badge)}</span>` : ""}<h4>${esc(o.nom)}</h4><p class="muted">${esc(o.description)}</p>
      <ul>${contenuPack(o).map((l) => `<li>${l}</li>`).join("")}</ul>
      ${valeurPieces(o) ? `<p class="offre-valeur">Contenu équivalent à ${fmt(valeurPieces(o))} 🪙 en jeu</p>` : `<p class="offre-valeur">Purement décoratif : aucun avantage en combat</p>`}
      <div class="offre-prix">${o.prixReference ? `<s title="${esc(o.referenceNote)}">${prixEuros(o.prixReference)}</s>` : ""}<b>${prixEuros(o.prix)}</b></div>
      ${o.prixReference ? `<p class="offre-note">Prix de référence : ${esc(o.referenceNote)}</p>` : ""}
      ${o.uneFois ? `<p class="offre-note">Limité à un achat par compte.</p>` : ""}${o.fin ? `<p class="offre-note">Jusqu'au ${new Date(o.fin).toLocaleDateString("fr-FR")}.</p>` : ""}
      <button class="btn primary" data-offre="${esc(o.cle)}" ${o.dejaAchete ? "disabled" : ""}>${o.dejaAchete ? "Déjà acheté" : "Acheter"}</button>
      <button class="lien-chances" data-chances="${esc(o.cle)}">Probabilités des boosters</button></article>`).join("")}</div>`;
  $$("[data-chances]", el).forEach((b) => b.onclick = () => {
    const o = r.offres.find((x) => x.cle === b.dataset.chances);
    ouvrirModal(`<h2 style="margin-top:0">🎲 Probabilités : ${esc(o.nom)}</h2><p class="muted">Chances par carte selon le booster (la dernière carte a une rareté minimale garantie). Mêmes règles pour tous les joueurs.</p>
      ${Object.keys(o.boosters || {}).filter((k) => PACKS[k]).map((k) => `<h4>${PACKS[k].emoji} ${esc(PACKS[k].nom)}</h4><div class="row">${chancesPack(k).map(([rr, pc]) => `<span class="rbadge" data-r="${rr}">${RARETES[rr].nom} · ${pc} %</span>`).join(" ")}</div>`).join("")}`);
  });
  $$("[data-offre]", el).forEach((b) => b.onclick = () => {
    if (typeof connecte !== "function" || !connecte()) return aller("compte");
    const o = r.offres.find((x) => x.cle === b.dataset.offre);
    ouvrirModal(`<h2 style="margin-top:0">${esc(o.nom)} · ${prixEuros(o.prix)}</h2><ul>${contenuPack(o).map((l) => `<li>${l}</li>`).join("")}</ul>
      <p class="muted" style="font-size:13px">Contenu numérique (monnaie et boosters virtuels, sans valeur réelle ni revente possible), livré sur votre compte dès le paiement confirmé. Prix TTC. Voir les <a href="#" data-legal="cgv">conditions de vente</a>.</p>
      <label class="check"><input type="checkbox" id="ofRenonce"> Je demande la livraison immédiate et je reconnais perdre mon droit de rétractation de 14 jours une fois le contenu livré.</label>
      <div class="of-paiements" id="ofPaiements">
        ${r.stripe ? `<button class="btn primary" id="ofPayer" disabled>💳 Payer ${prixEuros(o.prix)} par carte</button>` : ""}
        <div id="ofPaypalAuto" class="hidden"></div>
        <div id="ofPaypalManuel" class="of-manuel">
          <a class="btn premium" id="ofPaypalLien" href="${PAYPAL}/${o.prix.toFixed(2)}EUR" target="_blank" rel="noopener" aria-disabled="true">🅿️ Payer ${prixEuros(o.prix)} avec PayPal</a>
          <p class="muted" style="font-size:13px;margin:6px 0">Indiquez votre pseudo <b>${esc(S.compte || "")}</b> et « ${esc(o.nom)} » dans la note PayPal, puis prévenez-nous : le pack est livré après vérification, en général sous 24 h.</p>
          <div class="row"><input id="ofNote" placeholder="Nom ou e-mail du compte PayPal (facultatif)" maxlength="120" style="flex:1;min-width:180px"><button class="btn" id="ofDemande" disabled>✅ J'ai payé avec PayPal</button></div>
        </div>
      </div>
      <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-close>Annuler</button></div>`);
    brancherLiens($("#modal"));
    const accepte = () => $("#ofRenonce")?.checked;
    $("#ofRenonce").onchange = () => {
      if ($("#ofPayer")) $("#ofPayer").disabled = !accepte();
      $("#ofDemande").disabled = !accepte();
      $("#ofPaypalLien").setAttribute("aria-disabled", String(!accepte()));
    };
    $("#ofPaypalLien").onclick = (e) => { if (!accepte()) { e.preventDefault(); toast("Cochez d'abord la case de livraison immédiate."); } };
    if ($("#ofPayer")) $("#ofPayer").onclick = async () => {
      $("#ofPayer").disabled = true;
      try { location.href = (await api("stripe/pack", { methode: "POST", corps: { cle: o.cle, renonciation: true } })).url; }
      catch (e) { toast("⚠ " + e.message); $("#ofPayer").disabled = false; }
    };
    $("#ofDemande").onclick = async () => {
      $("#ofDemande").disabled = true;
      try {
        await api("pack/demande", { methode: "POST", corps: { cle: o.cle, renonciation: true, note: $("#ofNote").value } });
        ouvrirModal(`<div class="reveal"><div style="font-size:52px">🛍️</div><h2>Demande envoyée !</h2><p>L'administrateur vérifie votre paiement PayPal et vous livre le ${esc(o.nom)}, en général sous 24 h. Vous recevrez une notification.</p><button class="btn primary" data-close>OK</button></div>`);
      } catch (e) { toast("⚠ " + e.message); $("#ofDemande").disabled = false; }
    };
    paypalPack(o, accepte);
  });
}
// Boutons PayPal automatiques (si l'administrateur a configuré PayPal) ; sinon le lien PayPal manuel reste affiché
async function paypalPack(o, accepte) {
  let config; try { config = await api("premium/config"); } catch { return; }
  if (!config.paypalClientId) return;
  if (!window.paypal) await new Promise((ok, ko) => { const s = document.createElement("script"); s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(config.paypalClientId)}&currency=EUR&intent=capture`; s.onload = ok; s.onerror = ko; document.head.appendChild(s); }).catch(() => null);
  const zone = $("#ofPaypalAuto");
  if (!window.paypal || !zone) return;
  zone.classList.remove("hidden"); $("#ofPaypalManuel")?.classList.add("hidden");
  window.paypal.Buttons({
    style: { layout: "horizontal", tagline: false, height: 42 },
    onClick: (_, actions) => { if (accepte()) return actions.resolve(); toast("Cochez d'abord la case de livraison immédiate."); return actions.reject(); },
    createOrder: async () => (await api("paypal/pack/commande", { methode: "POST", corps: { cle: o.cle, renonciation: true } })).id,
    onApprove: async (data) => {
      try {
        await api("paypal/pack/valider", { methode: "POST", corps: { commande: data.orderID } });
        ouvrirModal(`<div class="reveal"><div style="font-size:56px">🛍️</div><h2>Merci ! ${esc(o.nom)} est livré.</h2><p>Vos pièces et boosters arrivent dans le jeu.</p><button class="btn primary" data-close>Ouvrir mes boosters</button></div>`, () => { if (typeof verifierCadeaux === "function") verifierCadeaux(); aller("boosters"); });
      } catch (e) { toast("⚠ " + e.message, 6000); }
    },
    onError: () => toast("⚠ Le paiement PayPal n'a pas abouti."),
  }).render(zone);
}
const _vueBoostersV4 = vueBoosters;
vueBoosters = function (v) {
  const r = _vueBoostersV4.apply(this, arguments);
  const bloc = document.createElement("section"); bloc.className = "bloc-packs";
  const avant = $(".poussiere-bloc", v) || $(".sectiontitle", v);
  if (avant) avant.before(bloc); else v.append(bloc);
  blocPacks(bloc);
  return r;
};
async function adminOffres(el) {
  el.innerHTML = `<p class="muted">Les packs payants de la boutique (payés par carte avec Stripe ou par PayPal). Pour livrer un pack payé par PayPal manuel, ou en offrir un, allez dans l’onglet « 🎁 Cadeaux &amp; packs ». <b>Prix barré</b> : n'indiquez un prix de référence que s'il s'agit d'un prix réellement pratiqué avant la réduction (règle européenne : le prix le plus bas des 30 jours précédents) ; sinon laissez vide. La « valeur en jeu » affichée aux joueurs est calculée automatiquement à partir du prix des boosters en pièces.</p><div id="aoListe">Chargement…</div>
    <button class="btn" id="aoNouveau" style="margin-top:12px">＋ Nouvelle offre</button>`;
  const { offres } = await api("admin/offres");
  const dateLocale = (ms) => (ms ? new Date(ms - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
  const formulaire = (o, nouveau) => `<form class="panel form rang-form" data-cle="${esc(o.cle || "")}" style="--rc:var(--accent)">
      <div class="rf-tete"><div><b>${esc(o.nom || "Nouvelle offre")}</b><span class="muted">${nouveau ? "" : "clé : " + esc(o.cle)}</span></div></div>
      <div class="rf-grille">
        ${nouveau ? `<label>Clé (lettres, chiffres, tirets)<input name="cle" required pattern="[a-z0-9-]{2,30}"></label>` : ""}
        <label>Nom<input name="nom" value="${esc(o.nom || "")}" required maxlength="60"></label>
        <label>Badge (ex. Offre de lancement)<input name="badge" value="${esc(o.badge || "")}" maxlength="40"></label>
        <label>Prix TTC (€)<input name="prix" type="number" step="0.01" min="0.5" value="${o.prix ?? ""}" required></label>
        <label>Prix de référence barré (€, facultatif)<input name="prixReference" type="number" step="0.01" min="0.5" value="${o.prixReference ?? ""}"></label>
        <label class="large">Justification du prix de référence<input name="referenceNote" value="${esc(o.referenceNote || "")}" maxlength="300" placeholder="Ex. : prix pratiqué du 1er au 30 septembre 2026"></label>
        <label>Pièces<input name="pieces" type="number" min="0" value="${o.pieces ?? 0}"></label>
        ${["monde", "argent", "or", "prestige"].map((k) => `<label>Boosters ${esc(PACKS[k]?.nom || k)}<input name="b_${k}" type="number" min="0" max="500" value="${o.boosters?.[k] ?? 0}"></label>`).join("")}
        <label>Cosmétique (ex. effet:aurore, dos:galaxie)<input name="cosmetique" value="${esc(o.cosmetique || "")}" pattern="(dos|cadre|effet|titre):[a-z0-9-]{2,30}"></label>
        <label>Ordre<input name="ordre" type="number" min="0" max="99" value="${o.ordre ?? 0}"></label>
        <label>Début (facultatif)<input name="debut" type="datetime-local" value="${dateLocale(o.debut)}"></label>
        <label>Fin (facultatif)<input name="fin" type="datetime-local" value="${dateLocale(o.fin)}"></label>
        <label class="large">Description<input name="description" value="${esc(o.description || "")}" maxlength="300"></label>
        <label class="check"><input name="uneFois" type="checkbox" ${o.uneFois ? "checked" : ""}> Un seul achat par compte</label>
        <label class="check"><input name="actif" type="checkbox" ${o.actif !== false ? "checked" : ""}> Offre active</label>
      </div><p class="muted" data-etat></p><button class="btn primary">Enregistrer</button></form>`;
  $("#aoListe").innerHTML = `<div class="admin-rangs">${offres.map((o) => formulaire(o, false)).join("")}</div>`;
  $("#aoNouveau").onclick = () => { $("#aoListe .admin-rangs").insertAdjacentHTML("afterbegin", formulaire({}, true)); brancher(); };
  const brancher = () => $$("#aoListe form").forEach((f) => f.onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f)), cle = f.dataset.cle || d.cle;
    const corps = { ...d, uneFois: !!f.elements.uneFois.checked, actif: !!f.elements.actif.checked, boosters: Object.fromEntries(["monde", "argent", "or", "prestige"].map((k) => [k, d["b_" + k]])),
      debut: d.debut ? new Date(d.debut).toISOString() : null, fin: d.fin ? new Date(d.fin).toISOString() : null };
    try { await api(`admin/offres/${cle}`, { methode: "PUT", corps }); toast("🛍️ Offre enregistrée."); adminOffres(el); }
    catch (err) { $("[data-etat]", f).textContent = "⚠ " + err.message; }
  });
  brancher();
}

/* ---------- Profil public complet (rang, stats, matchs, succès, deck favori, confidentialité) ---------- */
const COULEURS_BANNIERE = { corail: "#ff5b35", ocean: "#1e88e5", foret: "#2e9e5b", nuit: "#3b3f8f", or: "#d4a72c", rubis: "#c62842", lavande: "#8e6bd8", graphite: "#4a4d55" };
async function profilComplet(pseudo) {
  ouvrirModal(`<p class="muted">Chargement du profil…</p>`);
  let p; try { p = await api("profil/" + encodeURIComponent(pseudo)); } catch (e) { $("#modal .box").innerHTML = `<button class="close" data-close>✕</button><p class="err">${esc(e.message)}</p>`; return; }
  const vitrine = (p.vitrine || []).map((id) => BY_ID[id]).filter(Boolean), total = (p.victoires || 0) + (p.defaites || 0);
  const ratio = total ? Math.round(((p.victoires || 0) / total) * 100) : null, coul = COULEURS_BANNIERE[p.banniere] || COULEURS_BANNIERE.corail;
  $("#modal .box").innerHTML = `<button class="close" data-close aria-label="Fermer">✕</button>
    <div class="profil-banniere" style="--bn:${coul}"></div>
    <div class="profil-tete">${avatarHTML(p.pseudo, "grand", p.cadre || null)}<div class="pt-nom"><h2>${esc(p.pseudo)}${p.admin ? " 👑" : ""}${p.premium ? " 💎" : ""}</h2>
      ${p.titre && typeof nomTitre === "function" ? `<span class="pt-titre">${esc(nomTitre(p.titre))}</span>` : ""}
      <span class="muted">Membre depuis le ${new Date(p.creeLe).toLocaleDateString("fr-FR")}${p.derniereCo ? ` · vu ${depuis(p.derniereCo)}` : ""}</span></div>
      ${p.champion?.length ? `<span class="pt-champion" title="Champion de saison">🏆 Champion ${p.champion.map(esc).join(", ")}</span>` : ""}
      <div class="pt-rang">${rangBadge(p.rang, "grand")}<b style="color:${esc(p.rang?.couleur || "")}">${esc(p.rang?.nom || "")}</b><small>${fmt(p.rang?.trophees ?? p.trophees)} pts</small></div></div>
    <div class="statgrid"><div class="stat"><b>${fmt(p.cartes)}</b><span>cartes (${Math.round((p.cartes / (p.totalCartes || 1)) * 100)} %)</span></div>
      ${p.victoires !== undefined ? `<div class="stat"><b>${p.victoires}/${p.defaites}</b><span>victoires / défaites</span></div><div class="stat"><b>${ratio === null ? "—" : ratio + " %"}</b><span>ratio de victoires</span></div>` : ""}
      <div class="stat"><b>${p.badges}</b><span>badges</span></div></div>
    ${p.moi ? "" : `<div class="row" style="gap:8px;flex-wrap:wrap;margin:10px 0"><button class="btn primary" id="pfDuel">⚔️ Défier</button><button class="btn" id="pfAmi">➕ Ami</button><button class="btn" id="pfMp">✉️ Message</button><button class="btn" id="pfCollec">📚 Collection</button><button class="btn" id="pfEchange">🤝 Échanger</button><button class="btn small" id="pfPlus">⋯</button></div>`}
    ${p.succes?.length ? `<h3>🏅 Succès (${p.succes.length})</h3><div class="succes-mini">${p.succes.map((x) => `<span title="${esc(x.nom + " : " + x.desc)}">${x.icone}</span>`).join("")}</div>` : ""}
    ${vitrine.length ? `<div class="vt-tete"><h3>Vitrine</h3><button class="btn small vt-like ${p.vitrineAime ? "on" : ""}" id="pfVtLike" ${p.moi ? "disabled" : ""} aria-pressed="${!!p.vitrineAime}"><span class="vt-coeur">${typeof icCarte === "function" ? icCarte("coeur") : ""}</span><b>${fmt(p.vitrineLikes || 0)}</b> j'aime</button></div><div class="cards vitrine9">${vitrine.map((c) => cardHTML(c, { locked: false })).join("")}</div>` : ""}
    ${p.deck?.length ? `<h3>🃏 Deck favori</h3><div class="deck-mini">${p.deck.map((id) => { const c = BY_ID[id]; return c ? `<span title="${esc(c.nom)}">${c.type === "pays" && c.code ? `<img src="flags/${esc(c.code.toLowerCase())}.svg" alt="" class="dm-drapeau">` : esc(c.emoji || "🃏")}<small>${esc(c.nom)}</small></span>` : ""; }).join("")}</div>` : ""}
    ${p.matchs ? `<h3>📜 Derniers matchs</h3>${p.matchs.length ? `<div class="matchs">${p.matchs.map((m) => `<div class="match ${m.gagne ? "v" : "d"}"><b>${m.gagne ? "Victoire" : "Défaite"}</b><span>${esc(m.mode)} contre ${esc(m.adversaire)}</span><span class="muted">${m.points ? `${m.points > 0 ? "+" : ""}${m.points} pts · ` : ""}${depuis(m.t)}${m.revoir ? ` <button class="btn small" data-revoir="${m.type}:${m.id}">▶ Revoir</button>` : ""}</span></div>`).join("")}</div>` : `<p class="muted">Aucun match pour l'instant.</p>`}` : ""}
    ${p.historiqueRangs?.length ? `<h3>📈 Rangs</h3>${p.historiqueRangs.map((h) => `<div class="codex-ligne"><span>${esc(RANGS.find((r) => r.cle === h.ancien)?.nom || h.ancien || "—")} → <b>${esc(RANGS.find((r) => r.cle === h.nouveau)?.nom || h.nouveau)}</b></span><small>${fmt(h.trophees)} pts · ${depuis(h.cree_le)}</small></div>`).join("")}` : ""}
    ${p.moi ? `<h3>⚙️ Mon profil public</h3><form class="form" id="pfReglages"><p class="muted" style="margin:0">Choisissez ce que les autres joueurs voient.</p>
      <div class="rf-grille">${[["statistiques", "Statistiques de combat"], ["historique", "Historique des matchs"], ["deck", "Deck favori"], ["collection", "Cartes favorites"], ["succes", "Succès"], ["activite", "Activité récente"]].map(([k, n]) => `<label class="check"><input type="checkbox" name="${k}" ${p.confidentialite?.[k] ? "checked" : ""}> ${n}</label>`).join("")}</div>
      <div class="bannieres">${Object.entries(COULEURS_BANNIERE).map(([k, c]) => `<label title="${k}"><input type="radio" name="banniere" value="${k}" ${p.banniere === k ? "checked" : ""}><span style="background:${c}"></span></label>`).join("")}</div>
      <button class="btn primary">Enregistrer</button> <button type="button" class="btn" data-aller="style">🎨 Titres et cadres</button> <button type="button" class="btn" id="pfVitrine">⭐ Choisir mes cartes favorites</button></form>` : ""}`;
  brancherLiens($("#modal"));
  $("#pfVtLike")?.addEventListener("click", async (e) => {
    if (typeof connecte !== "function" || !connecte()) return toast("Connectez-vous pour aimer une vitrine.");
    const b = e.currentTarget; b.disabled = true;
    try { const r = await api(`profil/${encodeURIComponent(p.pseudo)}/vitrine-like`, { methode: "POST", corps: {} }); b.classList.toggle("on", r.aime); b.setAttribute("aria-pressed", r.aime); $("b", b).textContent = fmt(r.likes); }
    catch (err) { toast("⚠ " + err.message); }
    b.disabled = false;
  });
  $$("[data-revoir]", $("#modal")).forEach((b) => b.onclick = () => { const [t, i] = b.dataset.revoir.split(":"); revoirCombat(t, i); });
  if (!p.moi) {
    $("#pfDuel").onclick = () => defierEnDirect(p.pseudo);
    $("#pfAmi").onclick = async () => { try { await api("amis", { methode: "POST", corps: { pseudo: p.pseudo } }); toast(`👫 ${esc(p.pseudo)} ajouté à vos amis !`); } catch (e) { toast("⚠ " + e.message); } };
    $("#pfMp").onclick = () => { fermerModal(); ouvrirConversation(p.pseudo); };
    $("#pfCollec").onclick = () => voirCollectionAmi(p.pseudo);
    $("#pfEchange").onclick = () => proposerEchangeDirect(p.pseudo);
    $("#pfPlus").onclick = () => _ficheJoueurV4(p.pseudo);
  } else {
    $("#pfReglages").onsubmit = async (e) => {
      e.preventDefault(); const f = e.target;
      const confidentialite = Object.fromEntries(["statistiques", "historique", "deck", "collection", "succes", "activite"].map((k) => [k, f.elements[k].checked]));
      try { await api("profil/reglages", { methode: "PUT", corps: { confidentialite, banniere: f.elements.banniere.value } }); toast("✅ Profil enregistré."); profilComplet(p.pseudo); } catch (err) { toast("⚠ " + err.message); }
    };
    $("#pfVitrine").onclick = () => { fermerModal(); aller("album"); toast("Ouvrez une carte et touchez « Mettre en vitrine » pour l'ajouter à vos favorites.", 5000); };
  }
}
const _ficheJoueurV4 = ficheJoueur;
ficheJoueur = function (pseudo) { if (!pseudo) return; return profilComplet(pseudo); };
ouvrirProfil = function (pseudo) { return profilComplet(pseudo); };

/* ---------- Succès et trophées ---------- */
async function vueSucces(v) {
  v.innerHTML = `<header class="page-tete"><h1>Succès</h1><p>Des objectifs pour progresser : chaque succès accompli rapporte une récompense, vérifiée par le serveur et versée une seule fois.</p></header><div id="scListe" class="muted">Chargement…</div>`;
  if (typeof connecte !== "function" || !connecte()) { $("#scListe").innerHTML = `<p>Connectez-vous pour suivre vos succès.</p><button class="btn primary" data-aller="compte">Se connecter</button>`; brancherLiens(v); return; }
  try {
    const { succes } = await api("succes");
    const faits = succes.filter((x) => x.fait).length;
    $("#scListe").innerHTML = `<p><b>${faits}/${succes.length}</b> succès accomplis</p><div class="succes-grille">${succes.map((x) => `<div class="succes ${x.fait ? "fait" : ""}">
        <span class="sc-ic">${x.icone}</span><div class="sc-txt"><b>${esc(x.nom)}</b><small>${esc(x.desc)}</small>
        <div class="pvbar"><i style="width:${Math.round((x.valeur / x.objectif) * 100)}%"></i></div><small class="muted">${fmt(x.valeur)} / ${fmt(x.objectif)} · récompense ${fmt(x.pieces)} 🪙</small></div>
        ${x.fait ? x.recu ? `<span class="sc-ok">✓ Reçu</span>` : `<button class="btn primary small" data-reclamer="${esc(x.cle)}">Récupérer</button>` : ""}</div>`).join("")}</div>`;
    $$("[data-reclamer]", v).forEach((b) => b.onclick = async () => {
      b.disabled = true;
      try { const r = await api(`succes/${b.dataset.reclamer}/reclamer`, { methode: "POST", corps: {} }); S.coins += r.pieces; sauver(); majCoins(); toast(`🏅 ${esc(r.nom)} : +${fmt(r.pieces)} 🪙`); vueSucces(v); }
      catch (e) { toast("⚠ " + e.message); b.disabled = false; }
    });
  } catch (e) { $("#scListe").innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}
ajouterPage("succes", "🏅", "Succès", vueSucces);
ICONES.succes = '<circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 7 5-3 5 3-1.5-7"/>';

/* ---------- Hub communautaire réorganisé : sections séparées ---------- */
const SECTIONS_HUB = [
  ["accueil", "🏠", "Accueil"], ["amis", "👫", "Amis"], ["defis", "⚔️", "Défis"], ["joueurs", "🔎", "Joueurs"], ["classements", "🏆", "Classements"],
  ["activite", "📰", "Activité"], ["evenements", "🎉", "Événements"], ["succes", "🏅", "Succès"], ["notifications", "🔔", "Notifications"],
  ["discussion", "💬", "Discussion"], ["messages", "✉️", "Messages"], ["echanges", "🤝", "Échanges"],
];
const _vueHubV4 = vueHub;
vueHub = function (v) {
  if (!["connecte", "anonyme"].includes(COMPTE.etat)) return _vueHubV4(v);
  if (!SECTIONS_HUB.some(([k]) => k === hubEtat.onglet)) hubEtat.onglet = "accueil";
  v.innerHTML = `<div class="hub2"><nav class="hub2-menu" aria-label="Sections de la communauté">${SECTIONS_HUB.map(([k, ic, n]) => `<button class="${hubEtat.onglet === k ? "on" : ""}" data-o="${k}"><span>${ic}</span>${n}</button>`).join("")}</nav>
    <section class="hub2-corps"><h2 class="hub2-titre">${SECTIONS_HUB.find(([k]) => k === hubEtat.onglet)[1]} ${SECTIONS_HUB.find(([k]) => k === hubEtat.onglet)[2]}</h2><div id="hubCorps"></div></section></div>`;
  $$("[data-o]", v).forEach((b) => b.onclick = () => { hubEtat.onglet = b.dataset.o; aller("hub"); });
  const el = $("#hubCorps");
  const router = { accueil: hubAccueil, amis: hubAmis, defis: hubDefis, joueurs: hubJoueurs, classements: hubClassements, activite: hubFil, evenements: hubEvenements,
    succes: (e) => vueSucces(e), notifications: hubNotifications, discussion: hubDiscussion, messages: hubMessages, echanges: hubEchanges };
  (router[hubEtat.onglet] || hubAccueil)(el);
};
const videHub = (ic, t, s, bouton) => `<div class="vide-hub"><span>${ic}</span><b>${t}</b><p class="muted">${s}</p>${bouton || ""}</div>`;
async function hubAccueil(el) {
  el.innerHTML = `<div class="hub-raccourcis">${[["defis", "⚔️", "Défier un ami"], ["classements", "🏆", "Classements"], ["evenements", "🎉", "Événements"], ["joueurs", "🔎", "Trouver des joueurs"]].map(([k, ic, n]) => `<button data-o2="${k}"><span>${ic}</span>${n}</button>`).join("")}</div>
    <h3>📌 Annonces et actualités</h3><div id="haAnnonces" class="muted">Chargement…</div>`;
  $$("[data-o2]", el).forEach((b) => b.onclick = () => { hubEtat.onglet = b.dataset.o2; aller("hub"); });
  try {
    const r = await api("posts");
    const posts = (r.posts || []).filter((x) => x.epingle).slice(0, 5);
    $("#haAnnonces").innerHTML = posts.length ? `<div class="posts">${posts.map((x) => `<article class="post"><header><b>${esc(x.pseudo)}</b><span class="muted">${depuis(x.cree_le)}</span></header><p class="txt">${esc(x.texte)}</p></article>`).join("")}</div>` : videHub("📭", "Pas d'annonce pour le moment", "Les annonces importantes de l'équipe apparaîtront ici.");
  } catch { $("#haAnnonces").innerHTML = videHub("📭", "Pas d'annonce pour le moment", ""); }
}
async function hubDefis(el) {
  if (!connecte()) { el.innerHTML = videHub("⚔️", "Connectez-vous pour défier vos amis", "", `<button class="btn primary" data-aller="compte">Se connecter</button>`); brancherLiens(el); return; }
  el.innerHTML = `<div id="hdInfo" class="muted"></div><h3>Invitations reçues</h3><div id="hdInv" class="muted">Chargement…</div><h3>Défier un ami</h3><div id="hdAmis" class="muted">Chargement…</div>`;
  try { const c = await api("classe/jour"); $("#hdInfo").innerHTML = `Combats classés restants aujourd'hui : <b>${c.restants}/${c.parJour}</b>. Un duel classé contre un ami compte comme un combat classé normal.`; } catch {}
  try {
    const { invitations } = await api("duels/invitations");
    $("#hdInv").innerHTML = invitations.length ? invitations.map((i) => `<div class="codex-ligne"><span><b>${esc(i.pseudo)}</b> · ${i.classe ? "duel classé 🏆" : "duel amical 🤝"}</span><span><button class="btn small primary" data-acc="${i.id}">Accepter</button> <button class="btn small" data-ref="${i.id}">Refuser</button></span></div>`).join("") : videHub("📭", "Aucune invitation", "Quand un ami vous défie, l'invitation apparaît ici (elle expire après 5 minutes).");
    $$("[data-acc]", el).forEach((b) => b.onclick = async () => { if (!deckPret()) return; try { await envoyerDeckArene(); await api(`duels/${b.dataset.acc}/accepter`, { methode: "POST", corps: {} }); lancerDuel(await api(`duels/${b.dataset.acc}`)); } catch (e) { toast("⚠ " + e.message); } });
    $$("[data-ref]", el).forEach((b) => b.onclick = async () => { await api(`duels/${b.dataset.ref}/refuser`, { methode: "POST", corps: {} }).catch(() => {}); hubDefis(el); });
  } catch (e) { $("#hdInv").textContent = e.message; }
  try {
    const { amis } = await api("amis");
    const ok = amis.filter((a) => a.reciproque);
    $("#hdAmis").innerHTML = ok.length ? ok.map((a) => `<div class="codex-ligne"><span>${a.enLigne ? "🟢" : "⚪"} <a href="#" data-joueur="${esc(a.pseudo)}">${esc(a.pseudo)}</a> <small class="muted">${fmt(a.trophees || 0)} pts</small></span><span class="row" style="gap:4px"><button class="btn small" data-ech="${esc(a.pseudo)}">🤝 Échanger</button><button class="btn small primary" data-def="${esc(a.pseudo)}">⚔️ Défier</button></span></div>`).join("")
      : videHub("👫", "Pas encore d'amis", "Ajoutez des joueurs en ami (et qu'ils vous ajoutent aussi) pour vous défier en direct.", `<button class="btn" data-o3="joueurs">Trouver des joueurs</button>`);
    $$("[data-def]", el).forEach((b) => b.onclick = () => defierEnDirect(b.dataset.def));
    $$("[data-ech]", el).forEach((b) => b.onclick = () => proposerEchangeDirect(b.dataset.ech));
    $$("[data-joueur]", el).forEach((a) => a.onclick = (e) => { e.preventDefault(); profilComplet(a.dataset.joueur); });
    $$("[data-o3]", el).forEach((b) => b.onclick = () => { hubEtat.onglet = b.dataset.o3; aller("hub"); });
  } catch (e) { $("#hdAmis").textContent = e.message; }
}
async function hubJoueurs(el) {
  if (!connecte()) { el.innerHTML = videHub("🔎", "Connectez-vous pour chercher des joueurs", "", `<button class="btn primary" data-aller="compte">Se connecter</button>`); brancherLiens(el); return; }
  el.innerHTML = `<div class="codex-recherche"><input id="hjQ" type="search" placeholder="Pseudo d'un joueur…" maxlength="20"></div><div id="hjRes" class="muted">Chargement…</div>`;
  const chercher = async () => {
    try {
      const { joueurs } = await api("joueurs/recherche?q=" + encodeURIComponent($("#hjQ").value.trim()));
      $("#hjRes").innerHTML = joueurs.length ? `<div class="joueurs-grille">${joueurs.map((j) => `<button class="joueur-carte" data-joueur="${esc(j.pseudo)}">${avatarHTML(j.pseudo)}<b>${esc(j.pseudo)}${j.premium ? " 💎" : ""}</b><small>${j.enLigne ? "🟢 en ligne" : "hors ligne"} · ${fmt(j.cartes)} cartes</small></button>`).join("")}</div>` : videHub("🔎", "Aucun joueur trouvé", "Vérifiez l'orthographe du pseudo.");
      $$("[data-joueur]", el).forEach((b) => b.onclick = () => profilComplet(b.dataset.joueur));
    } catch (e) { $("#hjRes").textContent = e.message; }
  };
  let t; $("#hjQ").oninput = () => { clearTimeout(t); t = setTimeout(chercher, 250); };
  chercher();
}
async function hubClassements(el) {
  el.innerHTML = `<div class="toolbar"><button class="chip on" data-cl="ligue">🏅 Ligues (PvP)</button><button class="chip" data-cl="semaine">🌟 Semaine</button></div><div id="hcCorps"></div>`;
  const montrer = async (k) => {
    $$("[data-cl]", el).forEach((b) => b.classList.toggle("on", b.dataset.cl === k));
    const c = $("#hcCorps");
    if (k === "semaine") return hubClassement(c);
    c.innerHTML = `<p class="muted">Chargement…</p>`;
    try {
      await chargerRangs();
      const { joueurs } = await api("arene/classement");
      c.innerHTML = joueurs.length ? `<table class="classement"><tbody>${joueurs.map((j, i) => `<tr class="${j.pseudo === COMPTE.pseudo ? "moi" : ""}"><td>${["🥇", "🥈", "🥉"][i] || i + 1}</td><td>${rangBadge(j.rang, "petit")} <a href="#" data-joueur="${esc(j.pseudo)}">${esc(j.pseudo)}</a></td><td>${esc(j.rang?.nom || "")}</td><td>${fmt(j.trophees)} pts</td><td class="muted">${j.victoires}V ${j.defaites}D</td></tr>`).join("")}</tbody></table>` : videHub("🏆", "Classement vide", "Faites vos premiers combats classés pour y apparaître.");
      $$("[data-joueur]", c).forEach((a) => a.onclick = (e) => { e.preventDefault(); profilComplet(a.dataset.joueur); });
    } catch (e) { c.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  };
  $$("[data-cl]", el).forEach((b) => b.onclick = () => montrer(b.dataset.cl));
  montrer("ligue");
}
async function hubEvenements(el) {
  el.innerHTML = `<div class="hub-raccourcis">${[["samedi", "🏟️", "Tournoi du samedi"], ["guilde", "🛡️", "Guildes et raid"], ["passe", "🎟️", "Passe de saison"], ["expedition", "🧭", "Expédition"]].filter(([k]) => DESTINATIONS.some((d) => d[0] === k) || VUES_EXTRA[k]).map(([k, ic, n]) => `<button data-aller="${k}"><span>${ic}</span>${n}</button>`).join("")}</div><h3>🏆 Tournoi de la semaine</h3><div id="heTournoi"></div>`;
  brancherLiens(el);
  hubTournois($("#heTournoi"));
}
async function hubNotifications(el) {
  if (!connecte()) { el.innerHTML = videHub("🔔", "Connectez-vous pour voir vos notifications", "", `<button class="btn primary" data-aller="compte">Se connecter</button>`); brancherLiens(el); return; }
  el.innerHTML = `<div id="hnListe" class="muted">Chargement…</div>`;
  const lignes = [];
  try { const { invitations } = await api("duels/invitations"); invitations.forEach((i) => lignes.push({ t: i.cree_le, ic: "⚔️", txt: `${i.pseudo} vous défie (${i.classe ? "classé" : "amical"})`, aller: "defis" })); } catch {}
  try { const { succes } = await api("succes"); succes.filter((x) => x.fait && !x.recu).forEach((x) => lignes.push({ t: Date.now(), ic: "🏅", txt: `Succès accompli : ${x.nom} (+${fmt(x.pieces)} 🪙 à récupérer)`, aller: "succes" })); } catch {}
  try { const { historique } = await api("rangs/historique/" + encodeURIComponent(COMPTE.pseudo)); historique.slice(0, 5).forEach((h) => lignes.push({ t: h.cree_le, ic: "📈", txt: `Nouveau rang : ${RANGS.find((r) => r.cle === h.nouveau)?.nom || h.nouveau} (${fmt(h.trophees)} pts)`, aller: "classements" })); } catch {}
  lignes.sort((a, b) => b.t - a.t);
  $("#hnListe").innerHTML = lignes.length ? lignes.map((l, i) => `<button class="notif-ligne" data-i="${i}"><span>${l.ic}</span><span>${esc(l.txt)}</span><small class="muted">${depuis(l.t)}</small></button>`).join("") : videHub("🔔", "Tout est à jour", "Invitations, récompenses et changements de rang apparaîtront ici.");
  $$("[data-i]", el).forEach((b) => b.onclick = () => { hubEtat.onglet = lignes[b.dataset.i].aller; aller("hub"); });
}
// Mon compte : lien vers mon profil public
const _vueCompteV4 = vueCompte;
vueCompte = function (v) {
  const r = _vueCompteV4.apply(this, arguments);
  if (typeof connecte === "function" && connecte() && !$("#monProfilPublic", v)) {
    v.insertAdjacentHTML("afterbegin", `<div class="panel row" style="justify-content:space-between;gap:8px;flex-wrap:wrap"><span>👤 Votre profil public : rang, statistiques, succès et confidentialité.</span><span class="row" style="gap:8px"><button class="btn primary" id="monProfilPublic">Voir mon profil</button><button class="btn" data-aller="succes">🏅 Succès</button></span></div>`);
    $("#monProfilPublic").onclick = () => profilComplet(COMPTE.pseudo);
    brancherLiens(v);
  }
  return r;
};

/* ---------- Decks : plusieurs decks enregistrés, decks publics, recherche ---------- */
const NOMS_STYLES = { equilibre: "Équilibré", attaque: "Attaque", defense: "Défense", vitesse: "Vitesse", types: "Avantage de types" };
const decksSauves = () => (Array.isArray(S.decks) ? S.decks : (S.decks = []));
function gestionDecks(el) {
  const liste = decksSauves();
  el.innerHTML = `<div class="row" style="justify-content:space-between;gap:8px;flex-wrap:wrap"><h3 style="margin:0">🗂️ Mes decks enregistrés</h3>
    <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn small" id="gdSauver">💾 Enregistrer le deck actuel</button><button class="btn small" id="gdPublier">🌐 Rendre public</button><button class="btn small" data-aller="decks">🔎 Decks de la communauté</button></div></div>
    ${liste.length ? `<div class="decks-sauves">${liste.map((d, i) => `<div class="deck-sauve"><b>${esc(d.nom)}</b><small class="muted">${d.cartes.length} cartes · ${d.cartes.filter((id) => !has(id)).length ? `${d.cartes.filter((id) => !has(id)).length} manquante(s)` : "complet"}</small>
      <div class="row" style="gap:4px"><button class="btn small primary" data-dk-util="${i}">Utiliser</button><button class="btn small" data-dk-ren="${i}" title="Renommer">✏️</button><button class="btn small" data-dk-dup="${i}" title="Dupliquer">⧉</button><button class="btn small" data-dk-sup="${i}" title="Supprimer">🗑</button></div></div>`).join("")}</div>`
      : `<p class="muted" style="margin:8px 0 0">Enregistrez plusieurs decks pour passer de l'un à l'autre en un clic.</p>`}`;
  brancherLiens(el);
  $("#gdSauver").onclick = () => {
    if (S.deck.length !== COMBAT.TAILLE_DECK) return toast(`⚠ Complétez d'abord votre deck (${COMBAT.TAILLE_DECK} cartes).`);
    const nom = prompt("Nom du deck :", `Deck ${liste.length + 1}`); if (!nom) return;
    liste.push({ nom: nom.slice(0, 40), cartes: S.deck.slice() }); sauver(); gestionDecks(el); toast("💾 Deck enregistré.");
  };
  $("#gdPublier").onclick = () => publierDeck(S.deck);
  $$("[data-dk-util]", el).forEach((b) => b.onclick = () => utiliserDeck(liste[b.dataset.dkUtil].cartes));
  $$("[data-dk-ren]", el).forEach((b) => b.onclick = () => { const d = liste[b.dataset.dkRen], n = prompt("Nouveau nom :", d.nom); if (n) { d.nom = n.slice(0, 40); sauver(); gestionDecks(el); } });
  $$("[data-dk-dup]", el).forEach((b) => b.onclick = () => { const d = liste[b.dataset.dkDup]; liste.push({ nom: (d.nom + " (copie)").slice(0, 40), cartes: d.cartes.slice() }); sauver(); gestionDecks(el); });
  $$("[data-dk-sup]", el).forEach((b) => b.onclick = () => { if (confirm("Supprimer ce deck enregistré ?")) { liste.splice(b.dataset.dkSup, 1); sauver(); gestionDecks(el); } });
}
// Utiliser un deck : on garde les cartes possédées, les manquantes sont signalées puis complétées automatiquement
function utiliserDeck(ids) {
  const manquantes = ids.filter((id) => !has(id));
  S.deck = ids.filter((id) => has(id) && BY_ID[id]).slice(0, COMBAT.TAILLE_DECK);
  sauver();
  if (manquantes.length) { toast(`${manquantes.length} carte(s) manquante(s) : ${manquantes.slice(0, 4).map((id) => esc(BY_ID[id]?.nom || id)).join(", ")}${manquantes.length > 4 ? "…" : ""}. Complétées avec vos meilleures cartes.`, 6000); deckPret(); }
  else toast("✅ Deck chargé.");
  aller("combat");
}
function publierDeck(ids) {
  if (typeof connecte !== "function" || !connecte()) return toast("Connectez-vous pour publier un deck.");
  if (ids.length !== COMBAT.TAILLE_DECK) return toast(`⚠ Un deck public doit contenir ${COMBAT.TAILLE_DECK} cartes.`);
  ouvrirModal(`<h2 style="margin-top:0">🌐 Rendre ce deck public</h2><form class="form" id="fPub"><label>Nom du deck<input id="pubNom" maxlength="40" required placeholder="Ex. : Tempête européenne"></label>
    <label>Style de jeu<select id="pubStyle">${Object.entries(NOMS_STYLES).map(([k, n]) => `<option value="${k}">${n}</option>`).join("")}</select></label>
    <p class="muted" style="margin:0;font-size:13px">Les autres joueurs pourront le trouver, le mettre en favori et le copier. Vous pouvez le retirer à tout moment.</p>
    <div class="row" style="justify-content:flex-end"><button type="button" class="btn" data-close>Annuler</button><button class="btn primary">Publier</button></div></form>`);
  $("#fPub").onsubmit = async (e) => {
    e.preventDefault();
    try { await api("decks", { methode: "POST", corps: { nom: $("#pubNom").value, style: $("#pubStyle").value, cartes: ids } }); fermerModal(); toast("🌐 Deck publié !"); }
    catch (err) { toast("⚠ " + err.message); }
  };
}
const decksEtat = { q: "", style: "", tri: "popularite", carte: "", rarete: "", ligue: "", mes: false, favoris: false };
async function vueDecks(v) {
  await chargerRangs();
  v.innerHTML = `<header class="page-tete"><h1>Decks</h1><p>Trouvez un deck par son nom, une carte qu'il contient, son style ou la ligue de son auteur. Les cartes que vous n'avez pas sont signalées.</p></header>
    <div class="codex-recherche"><input id="dkQ" type="search" placeholder="Nom du deck…" value="${esc(decksEtat.q)}" maxlength="40"><input id="dkCarte" list="dkCartes" placeholder="Contient la carte…" value="${esc(decksEtat.carte ? BY_ID[decksEtat.carte]?.nom || "" : "")}"><datalist id="dkCartes"></datalist></div>
    <div class="toolbar">
      <select id="dkStyle"><option value="">Tous les styles</option>${Object.entries(NOMS_STYLES).map(([k, n]) => `<option value="${k}" ${decksEtat.style === k ? "selected" : ""}>${n}</option>`).join("")}</select>
      <select id="dkRarete"><option value="">Toutes raretés</option>${Object.entries(RARETES).filter(([r]) => r !== "secrete").map(([r, x]) => `<option value="${x.ordre}" ${String(decksEtat.rarete) === String(x.ordre) ? "selected" : ""}>Jusqu'à ${x.nom}</option>`).join("")}</select>
      <select id="dkLigue"><option value="">Toutes les ligues</option>${RANGS.filter((r) => r.actif).map((r) => `<option value="${esc(r.cle)}" ${decksEtat.ligue === r.cle ? "selected" : ""}>${esc(r.nom)}</option>`).join("")}</select>
      <select id="dkTri">${[["popularite", "Popularité"], ["date", "Plus récents"], ["performances", "Performances de l'auteur"], ["cout", "Coût le plus bas"]].map(([k, n]) => `<option value="${k}" ${decksEtat.tri === k ? "selected" : ""}>${n}</option>`).join("")}</select>
      <button class="chip ${decksEtat.favoris ? "on" : ""}" id="dkFav">⭐ Favoris</button><button class="chip ${decksEtat.mes ? "on" : ""}" id="dkMes">Mes decks</button>
    </div><div id="dkRes" class="muted">Chargement…</div>`;
  const recharger = async () => {
    const qs = new URLSearchParams({ q: decksEtat.q, style: decksEtat.style, tri: decksEtat.tri, carte: decksEtat.carte, rarete: decksEtat.rarete, ligue: decksEtat.ligue, mes: decksEtat.mes ? "1" : "", favoris: decksEtat.favoris ? "1" : "" });
    try {
      const { decks } = await api("decks?" + qs);
      // Suggestions : les decks dont vous avez le plus de cartes passent en premier si aucun filtre n'est actif
      const possede = (d) => d.cartes.filter((id) => has(id)).length;
      const liste = !decksEtat.q && !decksEtat.carte && decksEtat.tri === "popularite" ? decks.slice().sort((a, b) => possede(b) - possede(a)) : decks;
      $("#dkRes").innerHTML = liste.length ? `${!decksEtat.q && !decksEtat.carte && decksEtat.tri === "popularite" ? `<p class="muted">Suggestions adaptées à votre collection en premier.</p>` : ""}<div class="decks-publics">${liste.map((d) => {
        const manque = d.cartes.filter((id) => !has(id)).length;
        return `<article class="deck-public"><header><b>${esc(d.nom)}</b><span class="muted">${esc(NOMS_STYLES[d.style] || d.style)} · coût ${d.cout}</span></header>
          <div class="deck-mini">${d.cartes.map((id) => { const c = BY_ID[id]; return c ? `<span class="${has(id) ? "" : "manque"}" title="${esc(c.nom)}${has(id) ? "" : " (manquante)"}">${c.type === "pays" && c.code ? `<img src="flags/${esc(c.code.toLowerCase())}.svg" alt="" class="dm-drapeau">` : esc(c.emoji || "🃏")}<small>${esc(c.nom)}</small></span>` : ""; }).join("")}</div>
          <footer><span>${rangBadge(d.rang, "petit")} <a href="#" data-joueur="${esc(d.auteur)}">${esc(d.auteur)}</a> · ⭐ ${d.favoris}</span><span class="${manque ? "dk-manque" : "dk-ok"}">${manque ? `${manque} carte(s) manquante(s)` : "✓ Vous avez toutes les cartes"}</span>
          <span class="row" style="gap:4px">${connecte() ? `<button class="btn small" data-fav="${d.id}">${d.monFavori ? "★" : "☆"}</button>` : ""}<button class="btn small primary" data-util="${d.id}">Utiliser</button>${d.mien || COMPTE.admin ? `<button class="btn small" data-suppr="${d.id}">🗑</button>` : ""}</span></footer></article>`;
      }).join("")}</div>` : `<div class="vide-hub"><span>🃏</span><b>Aucun deck trouvé</b><p class="muted">Changez les filtres, ou publiez le vôtre depuis la page Combat.</p><button class="btn" data-aller="combat">Aller au Combat</button></div>`;
      brancherLiens(v);
      $$("[data-util]", v).forEach((b) => b.onclick = () => utiliserDeck(decks.find((d) => d.id === Number(b.dataset.util)).cartes));
      $$("[data-fav]", v).forEach((b) => b.onclick = async () => { try { await api(`decks/${b.dataset.fav}/favori`, { methode: "POST", corps: {} }); recharger(); } catch (e) { toast("⚠ " + e.message); } });
      $$("[data-suppr]", v).forEach((b) => b.onclick = async () => { if (confirm("Retirer ce deck public ?")) { await api(`decks/${b.dataset.suppr}`, { methode: "DELETE" }).catch(() => {}); recharger(); } });
      $$("[data-joueur]", v).forEach((a) => a.onclick = (e) => { e.preventDefault(); profilComplet(a.dataset.joueur); });
    } catch (e) { $("#dkRes").innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  };
  let t; $("#dkQ").oninput = (e) => { decksEtat.q = e.target.value; clearTimeout(t); t = setTimeout(recharger, 250); };
  $("#dkCarte").oninput = (e) => {
    const q = sansAccents(e.target.value);
    $("#dkCartes").innerHTML = q.length < 2 ? "" : CARDS.filter((c) => sansAccents(c.nom).includes(q)).slice(0, 15).map((c) => `<option value="${esc(c.nom)}">`).join("");
    const c = CARDS.find((x) => sansAccents(x.nom) === q); decksEtat.carte = c ? c.id : "";
    if (c || !q) { clearTimeout(t); t = setTimeout(recharger, 250); }
  };
  for (const [id, k] of [["#dkStyle", "style"], ["#dkRarete", "rarete"], ["#dkLigue", "ligue"], ["#dkTri", "tri"]]) $(id).onchange = (e) => { decksEtat[k] = e.target.value; recharger(); };
  $("#dkFav").onclick = () => { decksEtat.favoris = !decksEtat.favoris; vueDecks(v); };
  $("#dkMes").onclick = () => { decksEtat.mes = !decksEtat.mes; vueDecks(v); };
  recharger();
}
ajouterPage("decks", "🃏", "Decks", vueDecks);
ICONES.decks = '<rect x="3" y="6" width="12" height="15" rx="2"/><path d="M8 3h10a2 2 0 0 1 2 2v12"/>';
// Page Combat : gestionnaire de decks sous le deck actuel
const _vueCombatV4 = vueCombat;
vueCombat = function (v) {
  const r = _vueCombatV4.apply(this, arguments);
  const premier = $(".panel", v);
  if (premier) { const g = document.createElement("div"); g.className = "panel"; g.style.marginTop = "16px"; premier.after(g); gestionDecks(g); }
  return r;
};

/* ---------- Mode streamer : plein écran, compteur, meilleures cartes, infos personnelles masquées ---------- */
const streamer = (() => { try { return JSON.parse(localStorage.getItem("worldcards:streamer")) || null; } catch { return null; } })() || { ouvertures: 0, meilleures: [], masquer: true, fond: "jeu", debut: Date.now() };
const sauverStreamer = () => { try { localStorage.setItem("worldcards:streamer", JSON.stringify(streamer)); } catch {} };
let modeStreamer = false;
function majOverlayStreamer() {
  const o = $("#overlayStreamer"); if (!o) return;
  o.innerHTML = `<div class="os-tete"><img src="icons/logo-site.png" alt="Play2F1"><span>play2f1.com</span></div>
    <div class="os-compteur"><b>${streamer.ouvertures}</b><span>booster${streamer.ouvertures > 1 ? "s" : ""} ouvert${streamer.ouvertures > 1 ? "s" : ""}</span></div>
    <h4>🏆 Meilleures cartes</h4><ol>${streamer.meilleures.slice(0, 8).map((m) => `<li class="r-${m.r}"><span>${esc(m.e || "🃏")}</span><b>${esc(m.n)}</b><small>${esc(RARETES[m.r]?.nom || "")}${m.s ? " ✨" : ""}</small></li>`).join("") || `<li class="muted">Ouvrez un booster !</li>`}</ol>
    <div class="os-actions"><button id="osReset" title="Remettre le compteur à zéro">↺</button><button id="osQuitter">Quitter le mode streamer</button></div>`;
  $("#osReset").onclick = () => { if (confirm("Remettre le compteur et l'historique à zéro ?")) { Object.assign(streamer, { ouvertures: 0, meilleures: [], debut: Date.now() }); sauverStreamer(); majOverlayStreamer(); } };
  $("#osQuitter").onclick = () => basculerStreamer(false);
}
function basculerStreamer(actif) {
  modeStreamer = actif;
  document.body.classList.toggle("mode-streamer", actif);
  document.body.classList.toggle("streamer-masque", actif && streamer.masquer);
  document.body.dataset.fondStreamer = actif ? streamer.fond : "";
  $("#overlayStreamer")?.remove();
  if (actif) { document.body.insertAdjacentHTML("beforeend", `<aside id="overlayStreamer" class="overlay-streamer" aria-label="Mode streamer"></aside>`); majOverlayStreamer(); aller("boosters"); document.documentElement.requestFullscreen?.().catch(() => {}); }
  else if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}
// Chaque booster ouvert alimente le compteur et l'historique ; une carte exceptionnelle est mise en valeur à l'écran.
// Rien n'est montré avant la fin de l'ouverture : les spectateurs découvrent les cartes en même temps que le streamer.
let streamerEnAttente = null;
function revelerStreamer() {
  const res = streamerEnAttente; streamerEnAttente = null;
  if (!res || !modeStreamer) return;
  streamer.ouvertures++;
  for (const x of res) {
    const ordre = RARETES[x.c.rarete]?.ordre ?? 0;
    if (ordre >= 3 || x.shiny) streamer.meilleures.push({ id: x.c.id, n: x.c.nom, r: x.c.rarete, e: x.c.emoji, s: !!x.shiny, o: ordre + (x.shiny ? 0.5 : 0), t: Date.now() });
  }
  streamer.meilleures.sort((a, b) => b.o - a.o || b.t - a.t); streamer.meilleures = streamer.meilleures.slice(0, 20);
  sauverStreamer(); majOverlayStreamer();
  const top = res.slice().sort((a, b) => (RARETES[b.c.rarete]?.ordre ?? 0) - (RARETES[a.c.rarete]?.ordre ?? 0))[0];
  if (top && (RARETES[top.c.rarete]?.ordre ?? 0) >= 4) setTimeout(() => {
    $(".streamer-alerte")?.remove();
    document.body.insertAdjacentHTML("beforeend", `<div class="streamer-alerte r-${top.c.rarete}"><span>${esc(RARETES[top.c.rarete].nom.toUpperCase())} !</span><b>${esc(top.c.nom)}</b></div>`);
    setTimeout(() => $(".streamer-alerte")?.remove(), 4200);
  }, 400);
}
document.addEventListener("booster-revele", revelerStreamer);
const _deballerV4 = deballer;
deballer = function (type) {
  const res = _deballerV4.apply(this, arguments);
  if (modeStreamer) { if (streamerEnAttente) revelerStreamer(); streamerEnAttente = res; }
  return res;
};
// Ouverture fermée avant la fin : on compte quand même le booster
const _fermerModalV4 = fermerModal;
fermerModal = function () { const r = _fermerModalV4.apply(this, arguments); if (streamerEnAttente) revelerStreamer(); return r; };
async function vueStreamer(v) {
  v.innerHTML = `<header class="page-tete"><h1>Mode streamer</h1><p>Un affichage plein écran pensé pour Twitch, YouTube ou TikTok Live : compteur d'ouvertures, historique des meilleures cartes, alerte à l'écran pour les ultra rares et légendaires. Appuyez sur <kbd>Espace</kbd> pour ouvrir et faire défiler les cartes.</p></header>
    <section class="panel form"><label class="check"><input type="checkbox" id="stMasquer" ${streamer.masquer ? "checked" : ""}> Masquer mes informations personnelles (pseudo, pièces, compte, notifications)</label>
      <label>Fond<select id="stFond"><option value="jeu" ${streamer.fond === "jeu" ? "selected" : ""}>Fond du jeu</option><option value="vert" ${streamer.fond === "vert" ? "selected" : ""}>Fond vert (incrustation OBS)</option><option value="noir" ${streamer.fond === "noir" ? "selected" : ""}>Noir</option></select></label>
      <p class="muted" style="margin:0">Compteur actuel : <b>${streamer.ouvertures}</b> booster(s) depuis le ${new Date(streamer.debut).toLocaleString("fr-FR")}.</p>
      <button class="btn primary" id="stGo">🎥 Lancer le mode streamer</button></section>`;
  $("#stMasquer").onchange = (e) => { streamer.masquer = e.target.checked; sauverStreamer(); };
  $("#stFond").onchange = (e) => { streamer.fond = e.target.value; sauverStreamer(); };
  $("#stGo").onclick = () => basculerStreamer(true);
}
ajouterPage("streamer", "🎥", "Mode streamer", vueStreamer);
ICONES.streamer = '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/>';

/* ---------- Matchmaking en direct ---------- */
let matchEtat = null;
async function chercherAdversaire(classe) {
  if (typeof connecte !== "function" || !connecte()) return toast("Connectez-vous pour jouer en ligne.");
  if (classe === undefined) {
    let info = null; try { info = await api("classe/jour"); } catch {}
    ouvrirModal(`<div style="text-align:center"><h2 style="margin-top:0">⚡ Trouver un adversaire</h2><p class="muted">Un joueur en ligne de niveau proche, en direct. Même plateau et mêmes règles que les duels entre amis.</p>
      <div class="choix-duel"><button class="btn primary" id="mmClasse">🏆 Classé<small>${info ? `${info.restants}/${info.parJour} combats classés restants` : "Compte pour la ligue"}</small></button><button class="btn" id="mmAmical">🤝 Amical<small>Sans effet sur le classement</small></button></div></div>`);
    $("#mmClasse").onclick = () => chercherAdversaire(true); $("#mmAmical").onclick = () => chercherAdversaire(false);
    return;
  }
  if (!deckPret()) return;
  try { await envoyerDeckArene(); } catch (e) { return toast("⚠ " + e.message); }
  const debut = Date.now(), jeton = (matchEtat = { actif: true });
  ouvrirModal(`<div style="text-align:center"><h2 style="margin-top:0">${classe ? "🏆 Match classé" : "🤝 Match amical"}</h2><div class="loader-duel"></div>
    <p>Recherche d'un adversaire… <b id="mmTemps">0 s</b></p><p class="muted" id="mmInfo">Restez sur cette page : le duel commence dès qu'un joueur est trouvé.</p><button class="btn" id="mmAnnuler">Annuler</button></div>`, () => { jeton.actif = false; api("matchmaking", { methode: "DELETE" }).catch(() => {}); });
  $("#mmAnnuler").onclick = () => fermerModal();
  while (jeton.actif) {
    const el = $("#mmTemps"); if (!el) break; el.textContent = `${Math.round((Date.now() - debut) / 1000)} s`;
    let r; try { r = await api("matchmaking", { methode: "POST", corps: { classe } }); } catch (e) { toast("⚠ " + e.message); fermerModal(); return; }
    if (r.duel) {
      jeton.actif = false; duelEtat.vues.add(r.duel);
      const m = $("#modal"); m._onClose = null;
      try { lancerDuel(await api(`duels/${r.duel}`)); } catch (e) { toast("⚠ " + e.message); }
      return;
    }
    if ($("#mmInfo") && Date.now() - debut > 30000) $("#mmInfo").textContent = `Écart de niveau accepté : ±${r.ecart} points. Invitez un ami à jouer en même temps !`;
    await pause(2000);
  }
}
// Boutons « Trouver un adversaire » : page Combat et page Ligues
const _blocAreneV4 = blocArene;
blocArene = async function (el, complet) {
  await _blocAreneV4.apply(this, arguments);
  const row = $("#aChercher")?.parentElement;
  if (row && !$("#mmGo", el)) { row.insertAdjacentHTML("afterbegin", `<button class="btn primary" id="mmGo">⚡ Adversaire en direct</button>`); $("#mmGo").onclick = () => chercherAdversaire(); $("#aChercher").classList.remove("primary"); $("#aChercher").textContent = "🔎 Défier un deck"; }
};

/* ---------- Revoir un combat ---------- */
async function revoirCombat(type, id) {
  try {
    const m = await api(`revoir/${type}/${id}`);
    const fin = async () => `🏁 ${m.gagnant === 0 ? m.a : m.b} remporte le combat.`;
    if (m.mode === "duel") lancerCombat({ titre: `▶ ${m.a} contre ${m.b}`, adversaire: m.b, moi: m.deckA, lui: m.deckB, graine: m.graine, spectateur: true, fin,
      duel: { cote: 0, resteMs: 600000, abandon: async () => {}, tours: async (t) => (m.paires[t - 1] ? [m.paires[t - 1]] : [["attaque", "attaque"]]) } });
    else lancerCombat({ titre: `▶ ${m.a} contre ${m.b} (arène)`, adversaire: m.b, moi: m.deckA, lui: m.deckB, graine: m.graine, spectateur: true, arene: true, script: m.actions, fin });
    setTimeout(() => $("#cbAuto")?.click(), 600);
  } catch (e) { toast("⚠ " + e.message); }
}

/* ---------- Missions PvP (vérifiées par le serveur) ---------- */
function htmlMission(m) {
  const rec = [m.pieces ? `${fmt(m.pieces)} 🪙` : "", ...Object.entries(m.boosters || {}).map(([k, n]) => `${n} ${PACKS[k]?.emoji || "🎁"} ${PACKS[k]?.nom || k}`)].filter(Boolean).join(" + ");
  return `<div class="succes ${m.fait ? "fait" : ""}"><span class="sc-ic">${m.cle === "type" ? "🧩" : m.cle === "direct" ? "⚡" : m.cle === "points" ? "📈" : m.cle === "arene" ? "🏟️" : "⚔️"}</span>
    <div class="sc-txt"><b>${esc(m.nom)}</b><div class="pvbar"><i style="width:${Math.round((m.valeur / m.n) * 100)}%"></i></div><small class="muted">${m.valeur} / ${m.n} · ${rec}</small></div>
    ${m.fait ? m.recu ? `<span class="sc-ok">✓ Reçu</span>` : `<button class="btn primary small" data-mission="${esc(m.periode)}:${esc(m.cle)}">Récupérer</button>` : ""}</div>`;
}
async function blocMissions(el, compact) {
  if (typeof connecte !== "function" || !connecte()) { el.innerHTML = compact ? "" : `<p>Connectez-vous pour recevoir des missions de combat.</p><button class="btn primary" data-aller="compte">Se connecter</button>`; brancherLiens(el); return; }
  try {
    const m = await api("missions");
    const fin = new Date(); fin.setUTCHours(24, 0, 0, 0);
    el.innerHTML = `${compact ? `<div class="sectiontitle"><h3>🎯 Missions de combat</h3><a href="#" data-aller="missions">Toutes les missions →</a></div>` : ""}
      <h4 class="mission-titre">Aujourd'hui <small class="muted">· nouvelles missions dans ${duree(fin - Date.now())}</small></h4><div class="succes-grille">${m.jour.map(htmlMission).join("")}</div>
      ${compact ? "" : `<h4 class="mission-titre">Cette semaine <small class="muted">· chaque lundi</small></h4><div class="succes-grille">${m.semaine.map(htmlMission).join("")}</div>`}`;
    brancherLiens(el);
    $$("[data-mission]", el).forEach((b) => b.onclick = async () => {
      const [periode, cle] = b.dataset.mission.split(":"); b.disabled = true;
      try {
        const r = await api(`missions/${periode}/${cle}/reclamer`, { methode: "POST", corps: {} });
        S.coins += r.pieces; for (const [k, n] of Object.entries(r.boosters || {})) if (PACKS[k]) S.boosters[k] = (S.boosters[k] || 0) + n;
        sauver(); majCoins(); renderNav(); toast(`🎯 ${esc(r.nom)} : récompense reçue !`); blocMissions(el, compact);
      } catch (e) { toast("⚠ " + e.message); b.disabled = false; }
    });
  } catch (e) { el.innerHTML = compact ? "" : `<p class="err">${esc(e.message)}</p>`; }
}
ajouterPage("missions", "🎯", "Missions", (v) => { v.innerHTML = `<header class="page-tete"><h1>Missions</h1><p>Des objectifs de combat chaque jour et chaque semaine. La progression vient de vos vrais combats (arène, duels en direct), comptés par le serveur.</p></header><section class="panel" id="msCorps">Chargement…</section>`; blocMissions($("#msCorps"), false); });
ICONES.missions = '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>';

/* ---------- Finale de saison ---------- */
async function blocFinaleSaison(el) {
  try {
    const f = await api("saison/finale");
    const reste = f.fin - Date.now(), j = Math.floor(reste / 864e5), h = Math.floor((reste % 864e5) / 36e5);
    el.innerHTML = `<div class="sectiontitle"><h3>🏆 Saison ${esc(f.saison)}</h3><span class="finale-cpt">${j > 0 ? `${j} j ${h} h` : `${h} h ${Math.floor((reste % 36e5) / 6e4)} min`} avant la finale</span></div>
      <div class="finale"><ol>${f.top.map((x, i) => `<li class="${x.pseudo === COMPTE.pseudo ? "moi" : ""}"><span class="fn-pos">${["🥇", "🥈", "🥉"][i] || i + 1}</span>${rangBadge(x.rang, "petit")}<a href="#" data-joueur="${esc(x.pseudo)}">${esc(x.pseudo)}</a><b>${fmt(x.trophees)}</b></li>`).join("") || `<li class="muted">Personne n'a encore joué en classé cette saison : soyez le premier !</li>`}</ol>
      <div class="finale-info"><p>Le n° 1 à la fin du mois devient <b>Champion de la saison</b> : titre sur son profil, un booster 💎 Prestige, 3 boosters 🥇 Or et 5 000 🪙. Chaque rang reçoit aussi sa récompense.</p>
        ${f.champions.length ? `<p class="muted">Derniers champions : ${f.champions.map((c) => `<b>${esc(c.pseudo)}</b> (${esc(c.saison)})`).join(", ")}</p>` : ""}
        <button class="btn primary" id="fnJouer">⚡ Jouer un match classé</button></div></div>`;
    $$("[data-joueur]", el).forEach((a) => a.onclick = (e) => { e.preventDefault(); profilComplet(a.dataset.joueur); });
    $("#fnJouer").onclick = () => chercherAdversaire(true);
  } catch { el.remove(); }
}

/* ---------- Carte du jour : une carte rare en vedette, à prix réduit, aujourd'hui seulement ---------- */
function carteDuJour() {
  const jour = new Date().toISOString().slice(0, 10), r = COMBAT.rng(COMBAT.hash("carte-du-jour:" + jour));
  const pool = CARDS.filter((c) => c.univers === "monde" && ["epique", "ultra-rare", "legendaire"].includes(c.rarete) && c.type !== "secrete" && !c.saisonnier);
  const c = pool[Math.floor(r() * pool.length)];
  return { c, jour, poussiere: Math.round((POUSSIERE_FABRICATION[c.rarete] || 500) * 0.6), pieces: Math.round((RARETES[c.rarete].prix || 1000) * 2) };
}
function blocCarteDuJour(el) {
  const d = carteDuJour(), deja = S.carteDuJour === d.jour;
  el.innerHTML = `<div class="sectiontitle"><h3>✨ Carte du jour</h3><span class="muted">Change à minuit (UTC)</span></div>
    <div class="cdj"><div class="cdj-carte">${cardHTML(d.c, { locked: false })}</div><div><h4>${esc(d.c.nom)}</h4><p class="muted">${esc(RARETES[d.c.rarete].nom)} · ${esc(TYPES[d.c.type] || "")}${d.c.anecdote ? ` · ${esc(d.c.anecdote)}` : ""}</p>
      ${deja ? `<p class="sc-ok">✓ Déjà obtenue aujourd'hui</p>` : `<div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn primary" id="cdjP" ${(S.poussiere || 0) < d.poussiere ? "disabled" : ""}>✨ ${fmt(d.poussiere)} poussière (-40 %)</button><button class="btn" id="cdjC" ${S.coins < d.pieces ? "disabled" : ""}>🪙 ${fmt(d.pieces)} pièces</button></div>
      <p class="muted" style="font-size:12.5px">Une seule fois par jour. Si vous l'avez déjà, elle compte comme un doublon (niveau, poussière).</p>`}</div></div>`;
  const acheter = (champ, prix) => { if ((S[champ] || 0) < prix || S.carteDuJour === d.jour) return; S[champ] -= prix; S.carteDuJour = d.jour; gagner(d.c.id); sauver(); majCoins(); toast(`✨ ${esc(d.c.nom)} rejoint votre collection !`); blocCarteDuJour(el); };
  $("#cdjP")?.addEventListener("click", () => acheter("poussiere", d.poussiere));
  $("#cdjC")?.addEventListener("click", () => acheter("coins", d.pieces));
  $(".cdj-carte .card", el)?.addEventListener("click", (e) => { e.stopPropagation(); ficheCarte(d.c); });
}
// Accueil : missions, carte du jour et finale de saison sous le booster
const _vueAccueilV4b = vueAccueil;
vueAccueil = function (v) {
  const r = _vueAccueilV4b.apply(this, arguments);
  const ab = $(".accueil-booster", v);
  const zone = document.createElement("div"); zone.className = "accueil-v4";
  zone.innerHTML = `<section class="panel" id="acMissions"></section><div class="grid2"><section class="panel" id="acCdj"></section><section class="panel" id="acFinale"></section></div>`;
  (ab || v.firstChild)?.after(zone);
  blocMissions($("#acMissions"), true).then(() => { if (!$("#acMissions")?.innerHTML.trim()) $("#acMissions")?.remove(); });
  blocCarteDuJour($("#acCdj")); blocFinaleSaison($("#acFinale"));
  return r;
};
// Ligues : la finale de saison en haut de page
const _vueLiguesV4 = vueLigues;
vueLigues = async function (v) {
  await _vueLiguesV4.apply(this, arguments);
  const s = document.createElement("section"); s.className = "panel"; $("#lgMoi", v)?.after(s); blocFinaleSaison(s);
};
VUES_EXTRA.ligues = vueLigues;

/* ---------- Échange en direct entre amis ---------- */
const echDirEtat = { vues: new Set(), ouvert: null };
async function ouvrirEchangeDirect(id) {
  echDirEtat.ouvert = id;
  let etat = null, enCours = false;
  ouvrirModal(`<h2 style="margin-top:0">🤝 Échange en direct</h2><div id="edCorps"><p class="muted">Chargement…</p></div>`, () => { echDirEtat.ouvert = null; });
  const offreHTML = (o, mien) => `${o.cartes.length ? `<div class="ed-cartes">${o.cartes.map((cid, i) => { const c = BY_ID[cid]; return c ? `<span class="ed-carte r-${c.rarete}">${c.type === "pays" && c.code ? `<img src="flags/${esc(c.code.toLowerCase())}.svg" alt="" class="dm-drapeau">` : esc(c.emoji || "🃏")} <b>${esc(c.nom)}</b><small>${esc(RARETES[c.rarete]?.nom || "")}</small>${mien ? `<button data-ed-retirer="${i}" title="Retirer">✕</button>` : ""}</span>` : ""; }).join("")}</div>` : `<p class="muted">Aucune carte</p>`}
    <p>${o.pieces ? `+ <b>${fmt(o.pieces)} 🪙</b>` : ""}</p>`;
  const dessiner = () => {
    const c = $("#edCorps"); if (!c || !etat) return;
    if (etat.statut !== "ouvert") {
      c.innerHTML = etat.statut === "conclu" ? `<p class="sc-ok">✅ Échange conclu avec ${esc(etat.ami)} !</p><p>Vous recevez : ${etat.lui.cartes.map((x) => esc(BY_ID[x]?.nom || x)).join(", ") || "—"}${etat.lui.pieces ? ` et ${fmt(etat.lui.pieces)} 🪙` : ""}.</p><button class="btn primary" data-close>Super !</button>` : `<p>L'échange a été annulé.</p><button class="btn" data-close>Fermer</button>`;
      if (etat.statut === "conclu" && !(S.echDirFaits || []).includes(etat.id)) {
        // On retire de sa collection ce qu'on a donné (une seule fois), et on reçoit l'offre de l'ami par livraison
        S.echDirFaits = [...(S.echDirFaits || []).slice(-50), etat.id];
        for (const cid of etat.moi.cartes) { S.owned[cid] = Math.max(0, (S.owned[cid] || 0) - 1); if (!S.owned[cid]) { delete S.owned[cid]; S.deck = S.deck.filter((x) => x !== cid); } }
        S.coins = Math.max(0, S.coins - etat.moi.pieces); sauver(); majCoins(); verifierLivraisons();
      }
      return;
    }
    c.innerHTML = `<div class="ed-cols"><section><h4>Vous donnez ${etat.jaiValide ? "<span class='sc-ok'>✓ validé</span>" : ""}</h4>${offreHTML(etat.moi, true)}
        <div class="row" style="gap:6px"><input id="edQ" placeholder="Ajouter une carte…" list="edListe" style="flex:1"><datalist id="edListe"></datalist><input id="edPieces" type="number" min="0" placeholder="Pièces" value="${etat.moi.pieces || ""}" style="width:100px"></div></section>
      <section><h4>${esc(etat.ami)} donne ${etat.aValide ? "<span class='sc-ok'>✓ validé</span>" : ""}</h4>${offreHTML(etat.lui, false)}</section></div>
      <p class="muted" style="font-size:13px">Chaque modification annule les deux validations. L'échange se fait seulement quand vous avez validé tous les deux la même offre.</p>
      <div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" id="edAnnuler">Annuler l'échange</button><button class="btn primary" id="edValider" ${etat.jaiValide ? "disabled" : ""}>${etat.jaiValide ? "En attente de votre ami…" : "✅ Valider l'échange"}</button></div>`;
    const envoyer = async (o) => { if (enCours) return; enCours = true; try { etat = await api(`direct/echange/${id}/offre`, { methode: "PUT", corps: o }); dessiner(); } catch (e) { toast("⚠ " + e.message); } enCours = false; };
    $("#edQ").oninput = (e) => {
      const q = sansAccents(e.target.value);
      $("#edListe").innerHTML = q.length < 2 ? "" : CARDS.filter((x) => has(x.id) && sansAccents(x.nom).includes(q)).slice(0, 15).map((x) => `<option value="${esc(x.nom)}">`).join("");
      const carte = CARDS.find((x) => has(x.id) && sansAccents(x.nom) === q);
      if (carte) envoyer({ cartes: [...etat.moi.cartes, carte.id], pieces: etat.moi.pieces });
    };
    $("#edPieces").onchange = (e) => envoyer({ cartes: etat.moi.cartes, pieces: Number(e.target.value) || 0 });
    $$("[data-ed-retirer]", c).forEach((b) => b.onclick = () => envoyer({ cartes: etat.moi.cartes.filter((_, i) => i !== Number(b.dataset.edRetirer)), pieces: etat.moi.pieces }));
    $("#edAnnuler").onclick = async () => { await api(`direct/echange/${id}/annuler`, { methode: "POST", corps: {} }).catch(() => {}); fermerModal(); };
    $("#edValider").onclick = async () => { try { etat = await api(`direct/echange/${id}/valider`, { methode: "POST", corps: { version: etat.version } }); dessiner(); } catch (e) { toast("⚠ " + e.message); etat = await api(`direct/echange/${id}`).catch(() => etat); dessiner(); } };
  };
  // Suivi en direct : on se met à jour quand l'ami modifie ou valide
  while (echDirEtat.ouvert === id) {
    try {
      const n = await api(`direct/echange/${id}`);
      const change = !etat || n.version !== etat.version || n.statut !== etat.statut || n.aValide !== etat.aValide || n.jaiValide !== etat.jaiValide;
      etat = n; if (change && !enCours && document.activeElement?.id !== "edQ" && document.activeElement?.id !== "edPieces") dessiner();
      if (n.statut !== "ouvert") { dessiner(); break; }
    } catch { break; }
    await pause(2000);
  }
}
async function proposerEchangeDirect(pseudo) {
  try { const { id } = await api("direct/echange", { methode: "POST", corps: { pseudo } }); ouvrirEchangeDirect(id); } catch (e) { toast("⚠ " + e.message); }
}
setInterval(async () => {
  if (typeof connecte !== "function" || !connecte() || document.hidden || !$("#modal").classList.contains("hidden")) return;
  try {
    const { invitations } = await api("direct/echanges");
    const inv = invitations.find((i) => !echDirEtat.vues.has(i.id)); if (!inv) return;
    echDirEtat.vues.add(inv.id);
    ouvrirModal(`<div style="text-align:center"><h2 style="margin-top:0">🤝 Échange en direct</h2>${avatarHTML(inv.pseudo, "grand")}<p><b>${esc(inv.pseudo)}</b> veut échanger des cartes avec vous.</p>
      <div class="row" style="justify-content:center;gap:8px"><button class="btn primary" id="edOui">Ouvrir l'échange</button><button class="btn" data-close>Plus tard</button></div></div>`);
    $("#edOui").onclick = () => ouvrirEchangeDirect(inv.id);
  } catch {}
}, 9000);

/* ---------- Guerre de guildes (week-end) ---------- */
async function blocGuerre(el) {
  try {
    const g = await api("guerre"), w = g.weekend;
    if (!g.guilde) { el.innerHTML = `<h3 style="margin-top:0">⚔️ Guerre de guildes</h3><p class="muted">Chaque week-end, les guildes s'affrontent : chaque victoire classée d'un membre rapporte 1 point à sa guilde. La guilde gagnante reçoit 500 🪙 et un booster Or par membre.</p><button class="btn" data-aller="guilde">Rejoindre une guilde</button>`; brancherLiens(el); return; }
    const debut = new Date(w.debut);
    el.innerHTML = `<h3 style="margin-top:0">⚔️ Guerre de guildes · week-end du ${debut.toLocaleDateString("fr-FR")}</h3>
      ${w.enCours ? (g.adversaire ? `<div class="guerre"><div><span>${esc(g.guilde.embleme)}</span><b>[${esc(g.guilde.tag)}] ${esc(g.guilde.nom)}</b><strong>${g.guilde.score}</strong></div><em>VS</em><div><span>${esc(g.adversaire.embleme)}</span><b>[${esc(g.adversaire.tag)}] ${esc(g.adversaire.nom)}</b><strong>${g.adversaire.score}</strong></div></div>
          <p class="muted">Fin dimanche à minuit (UTC). Chaque victoire classée (arène, duel classé, matchmaking) compte.</p>` : `<p class="muted">Pas d'adversaire ce week-end (nombre impair de guildes ou guilde de moins de 2 membres).</p>`)
        : `<p class="muted">La prochaine guerre commence samedi à 0 h (UTC). Préparez vos decks !</p>`}
      ${g.membres.length ? `<p><b>Meilleurs membres</b> : ${g.membres.filter((m) => m.v).slice(0, 5).map((m) => `${esc(m.pseudo)} (${m.v})`).join(", ") || "—"}</p>` : ""}`;
  } catch (e) { el.innerHTML = ""; }
}
const _hubEvenementsV4 = hubEvenements;
hubEvenements = async function (el) { await _hubEvenementsV4(el); const s = document.createElement("section"); s.className = "panel"; s.style.marginBottom = "14px"; $(".hub-raccourcis", el)?.after(s); blocGuerre(s); };

/* ---------- Albums à thème ---------- */
async function vueAlbums(v) {
  v.innerHTML = `<header class="page-tete"><h1>Albums</h1><p>Complétez des albums à thème. Le 1er joueur à terminer un album gagne 3× la récompense, les 10 premiers 2×.</p></header><div id="alListe" class="muted">Chargement…</div>`;
  try {
    const { albums } = await api("albums");
    $("#alListe").innerHTML = `<div class="albums">${albums.map((a) => {
      const manquantes = a.ids.filter((id) => !has(id)), local = a.ids.length - manquantes.length;
      return `<article class="album"><header><span class="al-ic">${typeof TRAITS === "object" && TRAITS[a.icone] && typeof svgCat === "function" ? svgCat(a.icone) : esc(a.icone)}</span><div><b>${esc(a.nom)}</b><small class="muted">${local}/${a.ids.length} cartes · ${a.termines} joueur(s) l'ont terminé</small></div></header>
        <div class="pvbar"><i style="width:${Math.round((local / a.ids.length) * 100)}%"></i></div>
        ${a.moi ? `<p class="sc-ok">✓ Terminé (${a.moi}${a.moi === 1 ? "er" : "e"})</p>` : manquantes.length ? `<details><summary>${manquantes.length} carte(s) manquante(s)</summary><p class="muted" style="font-size:13px">${manquantes.slice(0, 40).map((id) => esc(BY_ID[id]?.nom || id)).join(", ")}${manquantes.length > 40 ? "…" : ""}</p></details>`
          : `<button class="btn primary" data-album="${esc(a.cle)}">🏆 Valider l'album (+${fmt(a.pieces)} 🪙 ou plus)</button>`}
        ${a.premiers.length ? `<p class="muted" style="font-size:12.5px;margin-bottom:0">Premiers : ${a.premiers.slice(0, 5).map((x, i) => `${["🥇", "🥈", "🥉"][i] || i + 1} ${esc(x.pseudo)}`).join(" · ")}</p>` : ""}</article>`;
    }).join("")}</div>`;
    $$("[data-album]", v).forEach((b) => b.onclick = async () => {
      if (typeof connecte !== "function" || !connecte()) return aller("compte");
      b.disabled = true;
      try { await envoyerSauvegarde(); const r = await api(`albums/${b.dataset.album}/terminer`, { methode: "POST", corps: {} }); S.coins += r.pieces; sauver(); majCoins(); toast(`🏆 ${esc(r.nom)} terminé (${r.rang}${r.rang === 1 ? "er" : "e"}) : +${fmt(r.pieces)} 🪙`, 6000); vueAlbums(v); }
      catch (e) { toast("⚠ " + e.message); b.disabled = false; }
    });
  } catch (e) { $("#alListe").innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}
ajouterPage("albums", "📒", "Albums", vueAlbums);
ICONES.albums = '<path d="M4 4h12a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z"/><path d="M4 17a3 3 0 0 1 3-3h12"/>';

/* ---------- Cosmétiques payants, effets d'ouverture ---------- */
COSM.effet = {
  aucun: { nom: "Sans effet", aide: "Par défaut", ok: () => true, ic: "▫️" },
  aurore: { nom: "Aurore", aide: "Boutique (cosmétique)", ok: () => false, ic: "🌌", achat: true },
  eclairs: { nom: "Éclairs", aide: "Boutique (cosmétique)", ok: () => false, ic: "⚡", achat: true },
};
COSM.dos.galaxie = { nom: "Galaxie (animé)", aide: "Boutique (cosmétique)", ok: () => false, ic: "🌌", achat: true };
COSM.cadre.plasma = { nom: "Plasma (animé)", aide: "Boutique (cosmétique)", ok: () => false, achat: true };
async function chargerAchatsCosmetiques() {
  try {
    const r = await api("cosmetiques/achetes");
    for (const k of r.cosmetiques) { const [t, id] = k.split(":"); debloquerCosm(t, id); }
    S.codeCreateur = r.codeCreateur; sauver();
  } catch {}
  try { const { dedicaces } = await api("dedicaces/moi"); S.dedicaces = Object.fromEntries(dedicaces.map((d) => [d.carte, d.signature])); sauver(); } catch {}
}
setTimeout(() => { if (typeof connecte === "function" && connecte()) chargerAchatsCosmetiques(); }, 3000);
// Personnaliser : section « Effets d'ouverture » et achat des objets verrouillés
const _vueStyleV4 = vueStyle;
vueStyle = async function (v) {
  await _vueStyleV4.apply(this, arguments);
  const actuel = cosmChoisi("effet") || "aucun";
  v.insertAdjacentHTML("beforeend", `<h3>✨ Effets d'ouverture de booster</h3><div class="cosm-grille">${Object.entries(COSM.effet).map(([id, i]) => { const ok = cosmDebloque("effet", id);
    return `<button class="cosm ${actuel === id ? "on" : ""} ${ok ? "" : "verrou"}" data-effet="${id}" ${ok || i.achat ? "" : "disabled"}><span class="cosm-titre">${i.ic}</span><b>${esc(i.nom)}</b><small>${ok ? (actuel === id ? "✓ Équipé" : "Débloqué") : "🛍️ En boutique"}</small></button>`; }).join("")}</div>
    <p class="muted" style="font-size:13px">Les objets marqués 🛍️ s'achètent dans la Boutique (section Packs). Ils sont purement décoratifs et n'apportent aucun avantage en combat.</p>`);
  $$("[data-effet]", v).forEach((b) => b.onclick = () => { if (!cosmDebloque("effet", b.dataset.effet)) return aller("boosters"); S.cosmetiques = { ...(S.cosmetiques || {}), effet: b.dataset.effet }; sauver(); vueStyle(v); });
  $$(".cosm.verrou[disabled]", v).forEach((b) => { const i = infoCosm(b.dataset.type, b.dataset.id); if (i?.achat) { b.disabled = false; b.onclick = () => aller("boosters"); b.querySelector("small").textContent = "🛍️ En boutique"; } });
};
const _ouvrirBoosterV4 = ouvrirBooster;
ouvrirBooster = function (type) {
  const r = _ouvrirBoosterV4.apply(this, arguments);
  const effet = cosmChoisi("effet");
  if (effet && effet !== "aucun") { const sc = $("#pkScene"); if (sc) { sc.insertAdjacentHTML("afterbegin", `<div class="effet-ouverture effet-${effet}" aria-hidden="true"></div>`); setTimeout(() => $(".effet-ouverture")?.remove(), 6000); } }
  return r;
};

/* ---------- Cartes dédicacées ---------- */
const _cardHTMLV4 = cardHTML;
cardHTML = function (c, opts = {}) {
  const h = _cardHTMLV4.apply(this, arguments);
  const sig = c && S.dedicaces?.[c.id];
  if (!sig || !(opts.locked === false || has(c.id))) return h;
  return h.replace('<div class="in">', `<div class="in"><span class="dedicace" title="Carte dédicacée">${typeof icCarte === "function" ? icCarte("crayon") : ""} ${esc(sig)}</span>`);
};

/* ---------- Code créateur (Mon compte) ---------- */
const _vueCompteV4b = vueCompte;
vueCompte = function (v) {
  const r = _vueCompteV4b.apply(this, arguments);
  if (typeof connecte === "function" && connecte() && !$("#blocCreateur", v)) {
    const s = document.createElement("section"); s.className = "panel"; s.id = "blocCreateur";
    ($("#monProfilPublic", v)?.closest(".panel") || v.firstChild)?.after(s);
    s.innerHTML = `<h3 style="margin-top:0">🎙️ Soutenir un créateur</h3><form class="row" id="fCreateur" style="gap:8px;flex-wrap:wrap"><input id="ccCode" placeholder="Code créateur" value="${esc(S.codeCreateur || "")}" maxlength="20" style="padding:9px 11px;border-radius:9px;border:1px solid var(--border);background:var(--panel2);color:var(--text)"><button class="btn">Enregistrer</button></form>
      <p class="muted" style="font-size:13px;margin-bottom:0">Une partie de vos achats (packs, Premium) est reversée au créateur que vous soutenez, sans rien vous coûter de plus.</p><div id="ccMoi"></div>`;
    $("#fCreateur").onsubmit = async (e) => {
      e.preventDefault();
      try { const r2 = await api("createur/soutien", { methode: "PUT", corps: { code: $("#ccCode").value } }); S.codeCreateur = r2.code; sauver(); toast(r2.code ? `🎙️ Vous soutenez ${esc(r2.createur)} !` : "Code retiré."); } catch (err) { toast("⚠ " + err.message); }
    };
    api("createur/moi").then(({ createur: c }) => { if (c) $("#ccMoi").innerHTML = `<div class="statgrid petit" style="margin-top:10px"><div class="stat"><b>${esc(c.code)}</b><span>mon code (${c.part} %)</span></div><div class="stat"><b>${c.soutiens}</b><span>joueurs me soutiennent</span></div><div class="stat"><b>${c.ventes}</b><span>achats</span></div><div class="stat"><b>${c.gains.toFixed(2)} €</b><span>ma part</span></div></div>`; }).catch(() => {});
  }
  return r;
};
/* ---------- Admin : créateurs et dédicaces ---------- */
async function adminCreateurs(el) {
  el.innerHTML = `<section class="panel"><h3 style="margin-top:0">🎙️ Créateurs</h3><p class="muted">Chaque créateur a un code ; ses soutiens reversent une part (en %) de leurs achats Stripe. Le montant dû est calculé automatiquement ; le versement se fait de votre côté.</p>
      <form class="rf-grille" id="fCr"><label>Pseudo du créateur<input name="pseudo" required></label><label>Code<input name="code" required maxlength="20"></label><label>Part reversée (%)<input name="part" type="number" min="0" max="50" value="10"></label><label class="check"><input name="actif" type="checkbox" checked> Actif</label><button class="btn primary">Enregistrer</button></form><div id="crListe" class="muted">Chargement…</div></section>
    <section class="panel"><h3 style="margin-top:0">✍️ Offrir une carte dédicacée</h3><form class="rf-grille" id="fDed"><label>Pseudo du joueur<input name="pseudo" required></label><label>Carte<input name="carte" list="dedListe" required placeholder="Nom de la carte…"><datalist id="dedListe"></datalist></label><label>Signature<input name="signature" required maxlength="24" placeholder="Ex. : Skiuez"></label><button class="btn primary">Offrir</button></form></section>`;
  const charger = async () => { try { const { createurs } = await api("admin/createurs"); $("#crListe").innerHTML = createurs.length ? `<table class="classement"><tbody>${createurs.map((c) => `<tr><td><b>${esc(c.code)}</b></td><td>${esc(c.pseudo)}</td><td>${c.part} %</td><td>${c.soutiens} soutiens</td><td>${c.ventes} ventes</td><td><b>${c.du.toFixed(2)} €</b> dus</td><td>${c.actif ? "✅" : "⏸️"}</td></tr>`).join("")}</tbody></table>` : "Aucun créateur."; } catch (e) { $("#crListe").textContent = e.message; } };
  $("#fCr").onsubmit = async (e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); d.actif = e.target.actif.checked; try { await api("admin/createurs", { methode: "PUT", corps: d }); toast("🎙️ Créateur enregistré."); charger(); } catch (err) { toast("⚠ " + err.message); } };
  $("#fDed [name=carte]").oninput = (e) => { const q = sansAccents(e.target.value); $("#dedListe").innerHTML = q.length < 2 ? "" : CARDS.filter((c) => sansAccents(c.nom).includes(q)).slice(0, 15).map((c) => `<option value="${esc(c.nom)}">`).join(""); };
  $("#fDed").onsubmit = async (e) => {
    e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); const c = CARDS.find((x) => sansAccents(x.nom) === sansAccents(d.carte));
    if (!c) return toast("⚠ Choisissez la carte dans la liste.");
    try { await api("admin/dedicaces", { methode: "POST", corps: { ...d, carte: c.id } }); toast("✍️ Carte dédicacée envoyée."); e.target.reset(); } catch (err) { toast("⚠ " + err.message); }
  };
  charger();
}

/* ---------- Défi viral : plus belles ouvertures de la semaine ---------- */
const _deballerV4b = deballer;
deballer = function (type) {
  const res = _deballerV4b.apply(this, arguments);
  if (typeof connecte === "function" && connecte()) {
    api("ouvertures", { methode: "POST", corps: { cartes: res.map((x) => x.c.id), shiny: res.filter((x) => x.shiny).map((x) => x.c.id), pack: type } }).then((r) => {
      if (!r || r.ignore) return;
      const affiche = () => { const z = $(".poke .meilleure-carte"); if (!z) return false; if (!$(".defi-ouverture")) z.insertAdjacentHTML("afterend", `<p class="defi-ouverture">🔥 Défi de la semaine : <b>${fmt(r.score)} points</b> · n° ${r.rang} pour l'instant</p>`); return true; };
      if (!affiche()) { let n = 0; const t = setInterval(() => { if (affiche() || ++n > 40) clearInterval(t); }, 500); }
    }).catch(() => {});
  }
  return res;
};
async function blocOuvertures(el) {
  try {
    const { top } = await api("ouvertures/semaine");
    el.innerHTML = `<h3 style="margin-top:0">🔥 Plus belles ouvertures de la semaine</h3><p class="muted" style="margin-top:0">Chaque booster ouvert compte : commune 1 pt, peu commune 2, rare 5, épique 15, ultra rare 40, légendaire 100 (×2 si Shiny). Partagez la vôtre !</p>
      ${top.length ? `<ol class="top-ouvertures">${top.map((o, i) => `<li><span>${["🥇", "🥈", "🥉"][i] || i + 1}</span><a href="#" data-joueur="${esc(o.pseudo)}">${esc(o.pseudo)}</a><span class="to-cartes">${o.cartes.map((x) => { const c = BY_ID[x.id]; return c ? `<i class="r-${c.rarete}" title="${esc(c.nom)}${x.s ? " ✨ Shiny" : ""}">${esc(c.emoji || (c.type === "pays" ? "🏳️" : "🃏"))}</i>` : ""; }).join("")}</span><b>${fmt(o.score)}</b></li>`).join("")}</ol>` : `<p class="muted">Personne cette semaine pour l'instant : ouvrez un booster !</p>`}`;
    $$("[data-joueur]", el).forEach((a) => a.onclick = (e) => { e.preventDefault(); profilComplet(a.dataset.joueur); });
  } catch { el.remove(); }
}
const _hubEvenementsV4b = hubEvenements;
hubEvenements = async function (el) { await _hubEvenementsV4b(el); const s = document.createElement("section"); s.className = "panel"; s.style.marginBottom = "14px"; el.append(s); blocOuvertures(s); };

/* ---------- Admin : tableau de bord des combats et stockage des images ---------- */
async function adminCombats(el) {
  el.innerHTML = `<p class="muted">Chargement…</p>`;
  try {
    const r = await api("admin/combats");
    const jours = [...new Set([...r.parJour.arene, ...r.parJour.duels].map((x) => x.j))].sort();
    const n = (l, j) => l.find((x) => x.j === j)?.n || 0, max = Math.max(1, ...jours.map((j) => n(r.parJour.arene, j) + n(r.parJour.duels, j)));
    const tableau = (titre, l) => `<section class="panel"><h3 style="margin-top:0">${titre}</h3>${l.length ? `<table class="classement"><thead><tr><th>Carte</th><th>Rareté</th><th>Jouée</th><th>Victoires</th></tr></thead><tbody>${l.map((c) => `<tr><td>${esc(c.nom)}</td><td class="r-${c.rarete}">${esc(RARETES[c.rarete]?.nom || "")}</td><td>${c.joues}</td><td>${c.taux} %</td></tr>`).join("")}</tbody></table>` : `<p class="muted">Pas encore assez de combats.</p>`}</section>`;
    el.innerHTML = `<section class="panel"><h3 style="margin-top:0">📊 Combats des 14 derniers jours</h3>
        <div class="statgrid petit"><div class="stat"><b>${fmt(r.parJour.arene.reduce((t, x) => t + x.n, 0))}</b><span>arène</span></div><div class="stat"><b>${fmt(r.modes.classes || 0)}</b><span>duels classés</span></div><div class="stat"><b>${fmt(r.modes.amicaux || 0)}</b><span>duels amicaux</span></div><div class="stat"><b>${fmt(r.modes.matchmaking || 0)}</b><span>via matchmaking</span></div></div>
        <div class="barres" role="img" aria-label="Combats par jour">${jours.map((j) => `<div title="${j} : ${n(r.parJour.arene, j)} arène, ${n(r.parJour.duels, j)} duels"><i class="b-duel" style="height:${(n(r.parJour.duels, j) / max) * 100}%"></i><i class="b-arene" style="height:${(n(r.parJour.arene, j) / max) * 100}%"></i><small>${j.slice(8)}</small></div>`).join("") || `<p class="muted">Aucun combat.</p>`}</div>
        <p class="muted" style="font-size:12.5px">■ arène · <span style="color:var(--accent)">■</span> duels en direct</p></section>
      <div class="grid2">${tableau("🃏 Cartes les plus jouées", r.plusJouees)}${tableau("💪 Meilleur taux de victoire (5 combats min.)", r.meilleures)}</div>${tableau("🔻 Taux de victoire le plus bas", r.pires)}
      <p class="muted">Pour rééquilibrer : ajustez le budget des decks et le nombre de légendaires dans « 🎲 Chances & règles ».</p>`;
  } catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}
async function adminImages(el) {
  el.innerHTML = `<p class="muted">Chargement…</p>`;
  try {
    const r = await api("admin/images"), mo = (o) => (o / 1048576).toFixed(1) + " Mo";
    const ligne = (n, x) => `<tr><td>${n}</td><td>${x.n}</td><td>${x.r2}</td><td>${mo(x.octets)}</td></tr>`;
    el.innerHTML = `<section class="panel"><h3 style="margin-top:0">💾 Stockage des images</h3>
      <p>${r.r2 ? "✅ Le bucket R2 « IMAGES » est relié : les nouvelles images y sont stockées." : "ℹ️ Les images sont stockées dans la base D1 (500 Mo en offre gratuite). Pour passer à Cloudflare R2 (10 Go gratuits) : créez un bucket « play2f1-images » dans Cloudflare → R2, puis décommentez le bloc <code>[[r2_buckets]]</code> du fichier <code>wrangler.toml</code> et redéployez."}</p>
      <table class="classement"><thead><tr><th></th><th>Images</th><th>Dans R2</th><th>Poids dans D1</th></tr></thead><tbody>${ligne("Visuels de boosters", r.visuels)}${ligne("Photos de cartes", r.photos)}${ligne("Logos des rangs", r.rangs)}</tbody></table>
      ${r.r2 ? `<button class="btn primary" id="imMigrer" style="margin-top:12px">Déplacer les images de D1 vers R2</button> <span class="muted" id="imEtat"></span>` : ""}</section>`;
    $("#imMigrer")?.addEventListener("click", async () => {
      let total = 0;
      for (;;) { const x = await api("admin/images/migrer", { methode: "POST", corps: {} }).catch((e) => ({ erreur: e.message })); if (x.erreur) { $("#imEtat").textContent = "⚠ " + x.erreur; return; } total += x.migrees; $("#imEtat").textContent = `${total} image(s) déplacée(s)…`; if (!x.migrees) break; }
      toast(`💾 ${total} image(s) déplacée(s) vers R2.`); adminImages(el);
    });
  } catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}

/* ---------- Admin : envoyer une notification aux joueurs ---------- */
const MODELES_NOTIF = [
  ["🎉 Événement en cours", "🎉 Événement en cours !", "Un événement vient de commencer sur Play2F1 : venez en profiter maintenant !", "accueil"],
  ["🏟️ Tournoi", "🏟️ Le tournoi commence !", "Le tournoi du samedi ouvre ses inscriptions : rejoignez-le avant le départ.", "samedi"],
  ["🎁 Nouveau booster", "🎁 Nouveau booster disponible", "Un nouveau booster vient d'arriver dans la boutique. Qui sortira la légendaire ?", "boosters"],
  ["⚔️ Week-end classé", "⚔️ Week-end de combats classés", "Grimpez dans votre ligue ce week-end : la guerre de guildes a commencé !", "ligues"],
  ["🔧 Maintenance", "🔧 Petite pause technique", "Play2F1 fait une courte maintenance. Merci de votre patience, on revient vite !", "accueil"],
];
async function adminNotifs(el) {
  el.innerHTML = `<p class="muted">Chargement…</p>`;
  let d; try { d = await api("admin/notifs"); } catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
  const NOMS_PAGES = { accueil: "Accueil", boosters: "Boutique", ligues: "Ligues", hub: "Communauté", missions: "Missions", combat: "Combat", albums: "Albums", decks: "Decks", succes: "Succès", passe: "Passe de saison", samedi: "Tournoi du samedi", guilde: "Guildes", premium: "Premium", defi: "Défi du jour", nations: "Coupe des nations" };
  const nomCible = (c) => (c.startsWith("@") ? c : d.cibles[c]?.nom || c);
  const local = (ms) => new Date(ms - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const etat = (h) => h.statut === "programmee" ? `⏰ Prévue le ${new Date(h.programme_le).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} <button class="btn small" data-annuler="${h.id}">Annuler</button>`
    : h.statut === "envoi" ? `⏳ En cours ${h.envoyes}/${h.total}` : `✅ ${h.envoyes}/${h.total}`;
  el.innerHTML = `<section class="panel"><h3 style="margin-top:0">🔔 Envoyer une notification</h3>
      <p class="muted">Elle arrive sur le téléphone ou l'ordinateur des joueurs qui ont activé les notifications, même jeu fermé. Toucher la notification ouvre la page choisie. Vous pouvez aussi la <b>programmer</b> : elle part toute seule à l'heure prévue (à 15 minutes près).</p>
      <div class="toolbar">${MODELES_NOTIF.map((m, i) => `<button class="chip" data-modele="${i}">${esc(m[0])}</button>`).join("")}</div>
      <form class="form" id="fNotif"><div class="rf-grille">
        <label class="large">Titre<input name="titre" maxlength="80" required placeholder="Ex. : 🎉 Événement Halloween en cours !"></label>
        <label class="large">Message<input name="texte" maxlength="200" required placeholder="Ex. : 12 cartes exclusives jusqu'à dimanche : ouvrez vite un booster !"></label>
        <label>Page ouverte au toucher<select name="page">${d.pages.map((p) => `<option value="${p}">${esc(NOMS_PAGES[p] || p)}</option>`).join("")}</select></label>
        <label>Destinataires<select name="cible">${Object.entries(d.cibles).map(([k, c]) => `<option value="${k}">${esc(c.nom)} (${c.n})</option>`).join("")}<option value="pseudo">Un seul joueur (test)</option></select></label>
        <label id="nfPseudo" hidden>Pseudo<input name="pseudo" maxlength="20"></label>
        <label>Quand<select name="quand"><option value="">Tout de suite</option><option value="plus-tard">Programmer…</option></select></label>
        <label id="nfDate" hidden>Date et heure<input type="datetime-local" name="date" min="${local(Date.now())}"></label></div>
        <div class="toolbar" id="nfRaccourcis" hidden><button type="button" class="chip" data-raccourci="samedi">Samedi 20 h</button><button type="button" class="chip" data-raccourci="demain">Demain 18 h</button><button type="button" class="chip" data-raccourci="heure">Dans 1 h</button></div>
        <label class="check"><input type="checkbox" name="discord" ${d.discord ? "" : "disabled"}> Publier aussi sur Discord ${d.discord ? "" : `<small class="muted">(configurez le webhook dans l'onglet 💬 Discord)</small>`}</label>
        <div class="notif-apercu"><img src="icons/icon-192.png" alt=""><div><b id="nfT">Titre</b><span id="nfX">Message</span></div><small>Play2F1 · maintenant</small></div>
        <button class="btn primary" id="nfGo">📣 Envoyer</button> <span class="muted" id="nfEtat"></span></form></section>
    <section class="panel"><h3 style="margin-top:0">Programmées et historique</h3>${d.historique.length ? `<div style="overflow-x:auto"><table class="classement"><tbody>${d.historique.map((h) => `<tr><td>${depuis(h.cree_le)}</td><td><b>${esc(h.titre)}</b>${h.discord ? " 💬" : ""}<br><small class="muted">${esc(h.texte)}</small></td><td>${esc(nomCible(h.cible))}</td><td>${etat(h)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">Aucune notification envoyée pour l'instant.</p>`}</section>`;
  const f = $("#fNotif");
  const plusTard = () => f.quand.value === "plus-tard";
  const apercu = () => {
    $("#nfT").textContent = f.titre.value || "Titre"; $("#nfX").textContent = f.texte.value || "Message"; $("#nfPseudo").hidden = f.cible.value !== "pseudo";
    $("#nfDate").hidden = $("#nfRaccourcis").hidden = !plusTard(); f.date.required = plusTard();
    $("#nfGo").textContent = plusTard() ? "⏰ Programmer" : "📣 Envoyer";
  };
  f.oninput = apercu; f.onchange = apercu;
  $$("[data-modele]", el).forEach((b) => b.onclick = () => { const m = MODELES_NOTIF[b.dataset.modele]; f.titre.value = m[1]; f.texte.value = m[2]; f.page.value = m[3]; apercu(); });
  $$("[data-raccourci]", el).forEach((b) => b.onclick = () => {
    const x = new Date(); x.setSeconds(0, 0);
    if (b.dataset.raccourci === "heure") x.setHours(x.getHours() + 1);
    else { x.setMinutes(0); x.setHours(b.dataset.raccourci === "demain" ? 18 : 20); x.setDate(x.getDate() + (b.dataset.raccourci === "demain" ? 1 : ((6 - x.getDay() + 7) % 7 || (new Date().getHours() >= 20 ? 7 : 0)))); }
    f.date.value = local(x.getTime());
  });
  $$("[data-annuler]", el).forEach((b) => b.onclick = async () => {
    if (!confirm("Annuler cette notification programmée ?")) return;
    try { await api(`admin/notifs/${b.dataset.annuler}`, { methode: "DELETE" }); toast("Notification annulée."); adminNotifs(el); } catch (e) { toast("⚠ " + e.message); }
  });
  f.onsubmit = async (e) => {
    e.preventDefault();
    const nb = f.cible.value === "pseudo" ? 1 : d.cibles[f.cible.value]?.n || 0;
    const quand = plusTard() ? new Date(f.date.value).getTime() : 0;
    if (plusTard() && !(quand > Date.now())) { $("#nfEtat").textContent = "⚠ Choisissez une date à venir."; return; }
    if (!confirm(plusTard() ? `Programmer « ${f.titre.value} » pour le ${new Date(quand).toLocaleString("fr-FR")} ?` : `Envoyer « ${f.titre.value} » à ${nb} joueur(s) ?`)) return;
    $("#nfGo").disabled = true;
    const corps = { titre: f.titre.value, texte: f.texte.value, page: f.page.value, cible: f.cible.value, pseudo: f.pseudo.value, discord: f.discord.checked, programme: quand || undefined };
    try {
      const r0 = await api("admin/notifs", { methode: "POST", corps });
      if (r0.programme) { toast(`⏰ Notification programmée pour le ${new Date(r0.programme).toLocaleString("fr-FR")}.`); adminNotifs(el); return; }
      const { id, total } = r0;
      for (let r = { restants: total }; r.restants;) {
        r = await api(`admin/notifs/${id}/envoyer`, { methode: "POST", corps: {} });
        $("#nfEtat").textContent = `Envoi… ${r.envoyes}/${total}`;
      }
      toast(`📣 Notification envoyée à ${total} joueur(s).`); adminNotifs(el);
    } catch (err) { $("#nfEtat").textContent = "⚠ " + err.message; $("#nfGo").disabled = false; }
  };
}

/* ---------- Admin : Discord (webhook des annonces et lien d'invitation) ---------- */
async function adminDiscord(el) {
  el.innerHTML = `<p class="muted">Chargement…</p>`;
  let d; try { d = await api("admin/discord"); } catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
  el.innerHTML = `<section class="panel"><h3 style="margin-top:0">💬 Discord</h3>
    <p class="muted">Le lien d'invitation apparaît dans le jeu (accueil, communauté, bas de page). Le <b>webhook</b> permet au jeu de publier tout seul dans un salon de votre serveur : sur Discord, ouvrez les paramètres du salon (ex. #annonces) → <b>Intégrations</b> → <b>Webhooks</b> → <b>Nouveau webhook</b> → <b>Copier l'URL du webhook</b>, puis collez-la ici.</p>
    <form class="form" id="fDiscord" style="max-width:640px">
      <label>Lien d'invitation<input name="invitation" value="${esc(d.invitation)}" placeholder="https://discord.gg/…"></label>
      <label>URL du webhook ${d.configure ? "✅" : ""}<input name="webhook" value="${esc(d.webhook)}" placeholder="https://discord.com/api/webhooks/…" autocomplete="off"></label>
      <fieldset class="panel" style="margin:0"><legend>Annonces automatiques</legend>
        <label class="check"><input type="checkbox" name="legendaires" ${d.annonces.legendaires ? "checked" : ""}> 🌟 Cartes légendaires ouvertes (une fois par jour et par joueur)</label>
        <label class="check"><input type="checkbox" name="tournois" ${d.annonces.tournois ? "checked" : ""}> 🏆 Début et champion du tournoi du samedi</label>
        <label class="check"><input type="checkbox" name="evenements" ${d.annonces.evenements ? "checked" : ""}> 🎉 Lancement des événements et boosters limités</label>
        <p class="muted" style="margin:6px 0 0;font-size:13px">Les notifications de l'onglet 🔔 peuvent aussi être publiées sur Discord (case à cocher).</p></fieldset>
      <div class="row"><button class="btn primary">Enregistrer</button><button type="button" class="btn" id="dcTest" ${d.configure ? "" : "disabled"}>📨 Envoyer un message de test</button><span class="muted" id="dcEtat"></span></div>
    </form></section>`;
  const f = $("#fDiscord");
  f.onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api("admin/discord", { methode: "PUT", corps: { invitation: f.invitation.value, webhook: f.webhook.value, annonces: { legendaires: f.legendaires.checked, tournois: f.tournois.checked, evenements: f.evenements.checked } } });
      toast("💬 Réglages Discord enregistrés."); adminDiscord(el);
    } catch (err) { $("#dcEtat").textContent = "⚠ " + err.message; }
  };
  $("#dcTest").onclick = async () => {
    try { await api("admin/discord/tester", { methode: "POST", corps: {} }); $("#dcEtat").textContent = "✅ Message publié sur Discord."; } catch (err) { $("#dcEtat").textContent = "⚠ " + err.message; }
  };
}

/* ---------- Admin : rétention et entonnoir des nouveaux joueurs ---------- */
async function adminRetention(el) {
  el.innerHTML = `<p class="muted">Chargement…</p>`;
  let d; try { d = await api("admin/retention"); } catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
  const pc = (n, t) => (t ? Math.round((n / t) * 100) : 0);
  const cellule = (n, t, mur) => mur ? `<td class="muted">—</td>` : `<td><span class="ret-pc" style="--p:${pc(n, t)}">${pc(n, t)} %</span><small class="muted"> ${n}</small></td>`;
  const ageJours = (jour) => Math.floor((Date.now() - Date.parse(jour + "T00:00:00Z")) / 86400000);
  const total = (k) => d.cohortes.reduce((t, c) => t + (c[k] || 0), 0);
  const base = (min) => d.cohortes.filter((c) => ageJours(c.jour) >= min).reduce((t, c) => t + c.inscrits, 0);
  const totalMur = (k, min) => d.cohortes.filter((c) => ageJours(c.jour) >= min).reduce((t, c) => t + (c[k] || 0), 0);
  const e = d.entonnoir, etapes = [["inscrits", "Inscription"], ["booster", "1er booster ouvert"], ["tuto", "Tutoriel terminé"], ["deck", "Deck créé"], ["combat", "1er combat"], ["revenu", "Revenu un autre jour"], ["boosters5", "5 boosters ouverts"], ["niveau5", "Niveau 5"], ["payeur", "Achat"]];
  const max = Math.max(1, ...d.parJour.map((x) => x.n));
  el.innerHTML = `<div class="statgrid" style="margin-bottom:12px">
      <div class="stat"><b>${d.actifs.jour}</b><span>Actifs aujourd'hui</span></div><div class="stat"><b>${d.actifs.semaine}</b><span>Actifs (7 jours)</span></div>
      <div class="stat"><b>${d.actifs.mois}</b><span>Actifs (30 jours)</span></div><div class="stat"><b>${d.actifs.total}</b><span>Comptes au total</span></div>
      <div class="stat"><b>${pc(totalMur("j1", 1), base(1))} %</b><span>Reviennent le lendemain (J1)</span></div><div class="stat"><b>${pc(totalMur("j7", 8), base(8))} %</b><span>Encore là après 7 jours (J7)</span></div></div>
    <section class="panel"><h3 style="margin-top:0">Joueurs actifs par jour (30 jours)</h3><div class="barres">${d.parJour.map((x) => `<div title="${x.jour} : ${x.n}"><i class="b-duel" style="height:${(x.n / max) * 100}%"></i><small>${x.jour.slice(8)}</small></div>`).join("")}</div></section>
    <section class="panel"><h3 style="margin-top:0">Où les nouveaux s'arrêtent (inscrits des 30 derniers jours)</h3>
      <p class="muted">Chaque barre montre la part des nouveaux joueurs qui ont atteint l'étape. La plus grosse chute indique ce qu'il faut améliorer en priorité.</p>
      <div class="entonnoir">${etapes.map(([k, nom], i) => `<div class="et-ligne"><span>${nom}</span><div class="et-barre"><i style="width:${pc(e[k] || 0, e.inscrits)}%"></i></div><b>${pc(e[k] || 0, e.inscrits)} %</b><small class="muted">${e[k] || 0}${i && etapes[i - 1] && (e[etapes[i - 1][0]] || 0) > (e[k] || 0) && k !== "tuto" ? ` · −${(e[etapes[i - 1][0]] || 0) - (e[k] || 0)}` : ""}</small></div>`).join("")}</div></section>
    <section class="panel"><h3 style="margin-top:0">Rétention par jour d'inscription</h3>
      <p class="muted">J1 : revenu le lendemain · J7 : revenu autour du 7e jour · J30 : autour du 30e jour · Revenus : revenu au moins une fois. « — » : pas encore mesurable.</p>
      <div style="overflow-x:auto"><table class="classement"><thead><tr><th>Inscription</th><th>Inscrits</th><th>J1</th><th>J7</th><th>J30</th><th>Revenus</th></tr></thead><tbody>
      ${d.cohortes.map((c) => `<tr><td>${new Date(c.jour).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</td><td>${c.inscrits}</td>${cellule(c.j1, c.inscrits, ageJours(c.jour) < 1)}${cellule(c.j7, c.inscrits, ageJours(c.jour) < 8)}${cellule(c.j30, c.inscrits, ageJours(c.jour) < 32)}${cellule(c.revenus, c.inscrits, ageJours(c.jour) < 1)}</tr>`).join("")}
      <tr><td><b>Total</b></td><td><b>${total("inscrits")}</b></td>${cellule(totalMur("j1", 1), base(1))}${cellule(totalMur("j7", 8), base(8))}${cellule(totalMur("j30", 32), base(32), !base(32))}${cellule(totalMur("revenus", 1), base(1))}</tr></tbody></table></div>
      <p class="muted" style="font-size:13px">Le suivi jour par jour commence avec cette version : avant, seuls le jour d'inscription et la dernière connexion sont connus.</p></section>`;
}
