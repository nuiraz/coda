/* =====================================================================
   Interface « Pop » : jaune soleil et bleu cobalt, contours encre et ombres franches,
   autocollants inclinés, bords de section en vague, bandeau défilant.
   Ce fichier ajoute les éléments propres à cette interface ; le style est dans pop.css.
   ===================================================================== */
const VAGUE_BAS = `<svg class="vague vague-bas" viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true"><path class="vague-fond" d="M0 22 C 320 64, 760 -18, 1440 30 L1440 60 L0 60 Z"/><path class="vague-trait" d="M0 22 C 320 64, 760 -18, 1440 30"/></svg>`;
const VAGUE_HAUT = `<svg class="vague vague-haut" viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true"><path class="vague-fond" d="M0 38 C 420 -6, 980 70, 1440 26 L1440 0 L0 0 Z"/><path class="vague-trait" d="M0 38 C 420 -6, 980 70, 1440 26"/></svg>`;

// ---------- Bandeau défilant en haut de toutes les pages ----------
function bandeauPop() {
  if ($("#bandeauPop")) return;
  const messages = ["Booster gratuit toutes les 12 h", "Une Devinette du jour chaque matin", "Tournoi en direct chaque samedi à 20 h", `${fmt(CARDS.length)} cartes à collectionner`, "Défi photo et pays mystère quotidiens", "Échangez vos doublons au marché", "Coupe des nations : jouez pour votre pays"];
  const ligne = messages.map((m) => `<span>${esc(m)}</span><i aria-hidden="true">✦</i>`).join("");
  const b = document.createElement("div");
  b.id = "bandeauPop"; b.className = "pop-bandeau"; b.setAttribute("aria-label", "Infos du jeu");
  b.innerHTML = `<div class="pop-defile">${ligne}${ligne}</div>`;
  document.body.insertBefore(b, $(".top"));
}

// ---------- Accueil : grand titre, pile de boosters encadrée, autocollants ----------
heroAccueil = function () {
  const n = niveauJoueur(), pseudo = typeof COMPTE !== "undefined" && COMPTE.pseudo;
  const possedees = Object.keys(S.owned || {}).filter((id) => S.owned[id] > 0 && BY_ID[id]).length;
  const pays = Object.keys(S.owned || {}).filter((id) => S.owned[id] > 0 && id.startsWith("pays:")).length;
  const stock = Object.keys(PACKS).filter((k) => S.boosters[k] > 0), nb = stock.reduce((t, k) => t + S.boosters[k], 0);
  const attente = gratuitDans();
  const empile = (stock.length ? stock : ["monde"]).slice(0, 3);
  const mots = (txt, depart = 0) => txt.split(" ").map((m, i) => `<span class="mot" style="--i:${depart + i}">${m}</span>`).join(" ");
  const el = document.createElement("section");
  el.className = "pop-hero";
  el.innerHTML = `<div class="pop-hero-in">
      <div class="pop-hero-txt">
        <p class="pop-kicker">${pseudo ? `Salut ${esc(pseudo)} !` : "Bienvenue, explorateur !"}</p>
        <h1>${mots("Collectionnez")}<br>${mots("le", 1)} <em class="mot" style="--i:2">monde</em><br>${mots("entier.", 3)}</h1>
        <p class="pop-intro">Pays, villes, monuments, animaux et merveilles : ouvrez vos boosters, complétez votre collection et affrontez les autres joueurs.</p>
        <div class="pop-actions"><button class="btn pop-bleu" id="ecOuvrir">${nb ? "Ouvrir un booster" : attente === 0 ? "Récupérer mon booster gratuit" : "Aller à la boutique"}</button>
          <button class="btn" id="ecCollection">Ma collection</button></div>
        <dl class="pop-stats"><div><dt>Cartes</dt><dd>${fmt(possedees)}<small>/${fmt(CARDS.length)}</small></dd></div>
          <div><dt>Pays</dt><dd>${pays}<small>/195</small></dd></div>
          <div><dt>Niveau</dt><dd>${n.niveau}</dd></div></dl>
      </div>
      <div class="pop-hero-visuel">
        <button class="pop-cadre" id="ecPile" aria-label="Ouvrir un booster">
          <span class="pop-pile">${empile.map((k, i) => `<span class="pack ${k} pop-p${i}" ${PACKS[k].couleur ? `style="--pc:${PACKS[k].couleur}"` : ""}><span class="big">${PACKS[k].emoji}</span><b>${esc(PACKS[k].nom)}</b></span>`).join("")}</span>
          <span class="pop-note">${nb ? `${nb} booster${nb > 1 ? "s" : ""} en stock` : attente === 0 ? "Booster gratuit prêt !" : `Gratuit dans ${duree(attente)}`}</span>
        </button>
        <span class="sticker sticker-rose" style="--r:-10deg">Gratuit<br>toutes les<br>12 h</span>
        <span class="sticker sticker-bleu sticker-etoile" style="--r:9deg">${nb ? `${nb}<br>boosters !` : attente === 0 ? "Prêt à<br>ouvrir !" : "Nouvelles<br>cartes !"}</span>
      </div>
    </div>${VAGUE_BAS}`;
  $("#ecOuvrir", el).onclick = ouvrirDepuisAccueil;
  $("#ecPile", el).onclick = ouvrirDepuisAccueil;
  $("#ecCollection", el).onclick = () => aller("album");
  return el;
};

// ---------- Accueil : la collection par catégorie (grosses cartes colorées) ----------
const CATS_POP = [["pays", "Pays", "drapeau"], ["ville", "Villes", "ville"], ["monument", "Monuments", "monument"], ["animal", "Animaux", "patte"]];
function categoriesPop() {
  const el = document.createElement("section");
  el.className = "pop-cats-zone";
  el.innerHTML = `<div class="pop-titre"><h2>Votre collection, <em>catégorie par catégorie.</em></h2><button class="btn small" data-aller="album">Tout voir</button></div>
    <div class="pop-cats">${CATS_POP.map(([k, nom, ic], i) => {
      const toutes = CARDS.filter((c) => c.type === k && !c.saisonnier), miennes = toutes.filter((c) => (S.owned[c.id] || 0) > 0).length;
      const pc = toutes.length ? Math.round(miennes / toutes.length * 100) : 0;
      return `<button class="pop-cat pop-cat-${i}" data-popcat="${k}" style="--i:${i}">
        <span class="pop-cat-ic">${typeof TRAITS === "object" && TRAITS[ic] ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TRAITS[ic]}</svg>` : ""}</span>
        <b>${nom}</b><small>${fmt(miennes)} / ${fmt(toutes.length)} cartes</small>
        <span class="pop-barre"><i style="width:${pc}%"></i></span>
        ${i === 0 ? `<span class="sticker sticker-rose sticker-mini" style="--r:12deg">${pc}&nbsp;%</span>` : ""}</button>`;
    }).join("")}</div>`;
  $$("[data-popcat]", el).forEach((b) => b.onclick = () => { filtres.type = b.dataset.popcat; filtres.cont = "tout"; aller("album"); });
  brancherLiens?.(el);
  return el;
}
const _vueAccueilPop = vueAccueil;
vueAccueil = function (v) {
  const r = _vueAccueilPop.apply(this, arguments);
  try {
    const hero = $(".pop-hero", v);
    if (hero && !$(".pop-cats-zone", v)) {
      const apres = [$(".tuto", v), $(".bandeau-evenement", v), $(".bandeau-bientot", v)].filter(Boolean).pop() || hero;
      apres.after(categoriesPop());
    }
    $$(".tuile", v).forEach((t, i) => t.style.setProperty("--i", i));
    const exp = $(".ec-explorer .ec-tete", v);
    if (exp && !exp.dataset.pop) { exp.dataset.pop = "1"; exp.innerHTML = `<h2>Tous les modes de jeu, <em>en un coup d'œil.</em></h2>`; }
  } catch (e) { console.error(e); }
  return r;
};

// ---------- Pied de page : grand nom du jeu ----------
function piedPop() {
  const pied = $(".pied");
  if (!pied || $(".pop-mot", pied)) return;
  pied.insertAdjacentHTML("afterbegin", `${VAGUE_HAUT}<div class="pop-mot" aria-hidden="true">PLAY2F1</div>`);
}

function demarrerPop() { bandeauPop(); piedPop(); }
if (document.readyState === "loading") addEventListener("DOMContentLoaded", demarrerPop); else demarrerPop();
