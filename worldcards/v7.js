"use strict";
/* =====================================================================
   Play2F1 — v7 : marché d'échange automatique, défi photo du jour, combat express du jour
   ===================================================================== */
const attendreCompte = async () => { for (let i = 0; i < 40 && typeof COMPTE !== "undefined" && COMPTE.etat === "inconnu"; i++) await new Promise((r) => setTimeout(r, 100)); };
const estConnecte = () => typeof connecte === "function" && connecte();
const blocConnexion = (txt) => `<section class="panel"><p>${txt}</p><button class="btn primary" onclick="aller('compte')">Se connecter</button></section>`;
const miniCarte = (id) => { const c = BY_ID[id]; if (!c) return esc(id); return `<span class="mc r-${c.rarete}">${c.type === "pays" && c.code ? `<img src="flags/${c.code.toLowerCase()}.svg" alt="">` : `<i>${esc(c.emoji || "🃏")}</i>`}<b>${esc(c.nom)}</b><small>${RARETES[c.rarete]?.nom || ""}</small></span>`; };
function retirerCarteLocale(id) {
  if (!S.owned[id]) return false;
  S.owned[id]--; if (!S.owned[id]) { delete S.owned[id]; S.deck = (S.deck || []).filter((x) => x !== id); }
  sauver(); return true;
}

/* ---------- Marché d'échange ---------- */
async function vueMarche(v) {
  v.innerHTML = `<header class="page-tete"><h1>🔄 Marché d'échange</h1><p>Le jeu compare vos doublons et vos <a href="#" data-aller="souhaits">cartes recherchées</a> avec ceux des autres joueurs, et vous propose des échanges équitables. La carte proposée est mise de côté jusqu'à la réponse (3 jours au plus), puis rendue si l'échange ne se fait pas.</p></header><div id="maCorps"><p class="muted">Chargement…</p></div>`;
  brancherLiens(v);
  await attendreCompte();
  if (!estConnecte()) { $("#maCorps").innerHTML = blocConnexion("Connectez-vous pour échanger des cartes."); return; }
  let s, pr; try { [s, pr] = await Promise.all([api("marche/suggestions"), api("marche/propositions")]); } catch (e) { $("#maCorps").innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
  const el = $("#maCorps"); if (!el) return;
  const recues = pr.propositions.filter((x) => x.moi === "recue" && x.statut === "ouverte"), envoyees = pr.propositions.filter((x) => x.moi === "envoyee");
  const STATUTS = { ouverte: "⏳ En attente", acceptee: "✅ Acceptée", refusee: "❌ Refusée", annulee: "Annulée", expiree: "⌛ Expirée" };
  el.innerHTML = `${recues.length ? `<section class="panel ma-recues"><h3 style="margin-top:0">📨 Propositions reçues (${recues.length})</h3>${recues.map((x) => `<div class="ma-ligne"><div class="ma-echange"><span class="muted">${esc(x.de)} vous donne</span>${miniCarte(x.donne)}<span class="ma-fleche">⇄</span><span class="muted">contre votre</span>${miniCarte(x.recoit)}</div>
        <div class="row"><button class="btn primary small" data-accepter="${x.id}">✅ Accepter</button><button class="btn small" data-refuser="${x.id}">Refuser</button></div></div>`).join("")}</section>` : ""}
    <section class="panel"><h3 style="margin-top:0">💡 Échanges suggérés</h3>
      ${s.suggestions.length ? s.suggestions.map((x, i) => `<div class="ma-ligne"><div class="ma-echange"><span class="muted">Vous donnez</span>${miniCarte(x.donne)}<span class="ma-fleche">⇄</span><span class="muted">${esc(x.pseudo)} donne</span>${miniCarte(x.recoit)}${x.equitable ? `<span class="rbadge" data-r="peu-commun">Équitable</span>` : `<span class="rbadge">${x.ecart > 0 ? "Vous donnez plus rare" : "Vous recevez plus rare"}</span>`}</div>
          <button class="btn primary small" data-proposer="${i}">Proposer</button></div>`).join("")
        : `<p class="muted">Aucun échange croisé pour l'instant. ${s.souhaits ? "" : "Commencez par ajouter des cartes à vos <a href='#' data-aller='souhaits'>cartes recherchées</a>."} Il faut qu'un joueur ait en double une carte que vous cherchez, et cherche une carte que vous avez en double (vous en avez ${s.doubles}).</p>`}</section>
    ${envoyees.length ? `<section class="panel"><h3 style="margin-top:0">📤 Mes propositions</h3>${envoyees.map((x) => `<div class="ma-ligne"><div class="ma-echange">${miniCarte(x.donne)}<span class="ma-fleche">⇄</span>${miniCarte(x.recoit)}<span class="muted">avec ${esc(x.a)} · ${STATUTS[x.statut] || x.statut}</span></div>
        ${x.statut === "ouverte" ? `<button class="btn small" data-annuler="${x.id}">Annuler</button>` : ""}</div>`).join("")}</section>` : ""}`;
  brancherLiens(el);
  $$("[data-proposer]", el).forEach((b) => b.onclick = async () => {
    const x = s.suggestions[Number(b.dataset.proposer)];
    if (!confirm(`Proposer à ${x.pseudo} : votre « ${BY_ID[x.donne]?.nom} » contre son « ${BY_ID[x.recoit]?.nom} » ?\nVotre carte est mise de côté jusqu'à sa réponse.`)) return;
    b.disabled = true;
    try { await envoyerSauvegarde?.(); await api("marche/proposer", { methode: "POST", corps: { pseudo: x.pseudo, donne: x.donne, recoit: x.recoit } }); retirerCarteLocale(x.donne); toast("🔄 Proposition envoyée !"); aller("marche"); }
    catch (e) { toast("⚠ " + e.message); b.disabled = false; }
  });
  const agir = (sel, action, apres) => $$(`[data-${sel}]`, el).forEach((b) => b.onclick = async () => {
    b.disabled = true;
    try { const r = await api(`marche/propositions/${b.dataset[sel]}/${action}`, { methode: "POST", corps: {} }); await apres?.(r); aller("marche"); }
    catch (e) { toast("⚠ " + e.message); b.disabled = false; }
  });
  agir("accepter", "accepter", async (r) => { retirerCarteLocale(r.donne); toast("🤝 " + esc(r.message)); await verifierLivraisons(); });
  agir("refuser", "refuser", () => toast("Proposition refusée."));
  agir("annuler", "annuler", async () => { toast("Proposition annulée : votre carte revient."); await verifierLivraisons(); });
}
ajouterPage("marche", "🔄", "Marché d'échange", vueMarche);

/* ---------- Défi photo du jour ---------- */
const CLE_PHOTO = "worldcards:defi-photo";
const ZOOMS_PHOTO = [4, 3, 2.3, 1.7, 1.3, 1, 1];
async function vuePhoto(v) {
  v.innerHTML = `<header class="page-tete"><h1>📷 Défi photo</h1><p>Quel est ce monument ? La photo est très zoomée au début et se dévoile à chaque essai. 6 essais, un nouveau monument chaque jour à minuit.</p></header><div id="phCorps"><p class="muted">Chargement…</p></div>`;
  await attendreCompte();
  let d; try { d = await api("defi-photo"); } catch (e) { $("#phCorps").innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
  const local = !estConnecte();
  if (local) { try { const l = JSON.parse(localStorage.getItem(CLE_PHOTO)); if (l?.jour === d.jour) Object.assign(d, l); else d.essais = []; } catch { d.essais = []; } }
  const noms = Object.fromEntries(d.noms), parNom = new Map(d.noms.map(([id, n]) => [sansAccents(n), id]));
  // Point de zoom du jour (le même pour tous)
  const h = COMBAT.hash("photo-focus:" + d.jour), fx = 25 + (h % 50), fy = 25 + ((h >> 8) % 50);
  const dessiner = () => {
    const el = $("#phCorps"); if (!el) return;
    const zoom = d.fini ? 1 : ZOOMS_PHOTO[d.essais.length];
    el.innerHTML = `<div class="df-grille"><section class="panel df-jeu">
        <div class="df-num">Défi photo n° ${d.numero}</div>
        <div class="ph-cadre ${d.fini ? (d.gagne ? "gagne" : "perdu") : ""}"><img src="/api/defi-photo/image?j=${d.jour}" alt="Monument mystère" style="transform:scale(${zoom});transform-origin:${fx}% ${fy}%" onerror="this.replaceWith(Object.assign(document.createElement('p'), { className: 'muted ph-erreur', textContent: 'La photo du jour ne se charge pas. Réessayez dans un instant.' }))"></div>
        <div class="ph-indices">${d.indices?.continent ? `<span class="chip">🌍 ${esc(d.indices.continent)}</span>` : `<span class="chip muted">🌍 Continent au 2e essai</span>`}${d.indices?.pays ? `<span class="chip">${drapeau(d.indices.pays.code)} ${esc(d.indices.pays.nom)}</span>` : `<span class="chip muted">🏳️ Pays au 4e essai</span>`}</div>
        <ol class="ph-essais">${d.essais.map((id) => `<li class="${d.solution?.id === id ? "juste" : ""}">${d.solution?.id === id ? "✅" : "❌"} ${esc(noms[id] || id)}</li>`).join("")}</ol>
        ${d.fini ? `<div class="df-fin"><h3>${d.gagne ? `🎉 Trouvé en ${d.essais.length} essai${d.essais.length > 1 ? "s" : ""} !` : "😢 Perdu pour aujourd'hui"}</h3><p>C'était <b>${esc(d.solution.nom)}</b>${BY_ID[d.solution.id] ? ` <button class="lien-chances" id="phFiche">voir la carte</button>` : ""}.</p>${d.recompense ? `<p class="sc-ok">+${d.recompense} 🪙</p>` : ""}
            <button class="btn primary" id="phPartager">📤 Partager</button></div>`
          : `<form class="df-form" id="phForm"><input id="phQ" list="phListe" placeholder="Nom du monument…" autocomplete="off" required><datalist id="phListe"></datalist><button class="btn primary">Deviner (${d.essais.length + 1}/${d.essaisMax})</button></form><p class="err" id="phErr"></p>`}
      </section>
      <aside class="panel df-cote"><h3 style="margin-top:0">🏆 Classement du jour</h3>${d.top.length ? `<ol class="df-top">${d.top.map((x) => `<li><b>${esc(x.pseudo)}</b><span>${x.n}/6</span></li>`).join("")}</ol>` : `<p class="muted">Personne n'a encore trouvé. À vous !</p>`}
        <p class="muted" style="font-size:13px">Avec un compte : ${d.recompenses.slice(1).map((r, i) => `${i + 1} essai${i ? "s" : ""} ${r} 🪙`).join(" · ")}</p></aside></div>`;
    $("#phFiche")?.addEventListener("click", () => ficheCarte(BY_ID[d.solution.id]));
    $("#phPartager")?.addEventListener("click", () => {
      const t = `📷 Play2F1 · Défi photo n° ${d.numero} — ${d.gagne ? d.essais.length : "X"}/6\n${d.essais.map((id) => (id === d.solution?.id ? "🟩" : "🟥")).join("")}\nhttps://play2f1.com/#photo`;
      (navigator.share ? navigator.share({ text: t }) : navigator.clipboard.writeText(t).then(() => toast("📋 Résultat copié !"))).catch(() => {});
    });
    const f = $("#phForm");
    if (!f) return;
    $("#phQ").oninput = (e) => { const q = sansAccents(e.target.value); $("#phListe").innerHTML = q.length < 2 ? "" : d.noms.filter(([, n]) => sansAccents(n).includes(q)).slice(0, 15).map(([, n]) => `<option value="${esc(n)}">`).join(""); };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const id = parNom.get(sansAccents($("#phQ").value.trim()));
      if (!id) { $("#phErr").textContent = "Choisissez un monument de la liste."; return; }
      if (d.essais.includes(id)) { $("#phErr").textContent = "Déjà proposé."; return; }
      f.querySelector("button").disabled = true;
      try {
        const r = await api("defi-photo/essai", { methode: "POST", corps: { id, numero: d.essais.length + 1 } });
        d.essais = r.essais || [...d.essais, id];
        Object.assign(d, { fini: r.fini, gagne: r.gagne, solution: r.solution, indices: r.indices, recompense: r.recompense || 0 });
        if (local) try { localStorage.setItem(CLE_PHOTO, JSON.stringify({ jour: d.jour, essais: d.essais, fini: d.fini, gagne: d.gagne, solution: d.solution, indices: d.indices })); } catch {}
        if (r.gagne && r.recompense && typeof verifierCadeaux === "function") verifierCadeaux();
        dessiner();
      } catch (err) { $("#phErr").textContent = err.message; f.querySelector("button").disabled = false; }
    };
  };
  dessiner();
}
ajouterPage("photo", "📷", "Défi photo", vuePhoto);

/* ---------- Combat express du jour ---------- */
async function vueExpress(v) {
  v.innerHTML = `<header class="page-tete"><h1>⚡ Combat express</h1><p>Chaque jour, le même deck adverse pour tout le monde. Votre deck l'affronte en combat automatique (environ 30 secondes). 3 essais : seul votre meilleur score compte au classement.</p></header><div id="exCorps"><p class="muted">Chargement…</p></div>`;
  await attendreCompte();
  let d; try { d = await api("express"); } catch (e) { $("#exCorps").innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
  const el = $("#exCorps"); if (!el) return;
  const essais = d.moi?.essais || 0, deckOk = (S.deck || []).length === COMBAT.TAILLE_DECK;
  el.innerHTML = `<div class="df-grille"><section class="panel">
      <h3 style="margin-top:0">Adversaire du jour n° ${d.numero}</h3>
      <div class="ex-deck">${d.adversaire.map((u) => `<div class="ex-u r-${BY_ID[u.id]?.rarete || ""}">${miniCarte(u.id)}<small>⚔️ ${u.atk} · 🛡️ ${u.def} · ❤️ ${u.pv}</small></div>`).join("")}</div>
      <div class="ex-action">${!estConnecte() ? blocConnexion("Connectez-vous pour participer au classement.")
        : !deckOk ? `<p>Il vous faut un deck complet de ${COMBAT.TAILLE_DECK} cartes.</p><button class="btn primary" onclick="aller('combat')">Préparer mon deck</button>`
        : essais >= d.essaisMax ? `<p class="muted">Vos 3 essais du jour sont utilisés. Meilleur score : <b>${d.moi.score}</b>. Revenez demain !</p>`
        : `<button class="btn primary" id="exGo">⚡ Lancer le combat (${essais + 1}/${d.essaisMax})</button>${d.moi ? `<p class="muted">Meilleur score aujourd'hui : <b>${d.moi.score}</b></p>` : ""}<p class="muted" style="font-size:13px">Astuce : changez votre deck entre deux essais pour contrer celui du jour.</p>`}</div></section>
    <aside class="panel df-cote"><h3 style="margin-top:0">🏆 Classement du jour</h3>${d.top.length ? `<ol class="df-top">${d.top.map((x) => `<li><b>${esc(x.pseudo)}</b><span>${x.score}${x.gagne ? " ✅" : ""}</span></li>`).join("")}</ol>` : `<p class="muted">Aucun score pour l'instant.</p>`}
      <p class="muted" style="font-size:13px">Score : victoire +1 000, chaque K.O. infligé +120, chaque K.O. subi −40, bonus de rapidité. Première victoire du jour : +150 🪙.</p></aside></div>`;
  $("#exGo")?.addEventListener("click", async (e) => {
    e.target.disabled = true;
    try {
      await envoyerSauvegarde?.();
      const r = await api("express/jouer", { methode: "POST", corps: { deck: S.deck } });
      lancerCombat({ titre: `⚡ Combat express n° ${d.numero}`, adversaire: "Deck du jour", moi: r.deckA, lui: r.deckB, graine: r.graine, spectateur: true,
        fin: async () => `${r.gagne ? "🏆 Victoire !" : "Défaite."} Score : <b>${r.score}</b> (meilleur : ${r.meilleur}) · ${r.rang}${r.rang > 1 ? "e" : "er"} du jour${r.gagne ? " · +150 🪙 si c'est votre première victoire du jour" : ""}`,
        duel: { cote: 0, resteMs: 600000, abandon: async () => {}, tours: async (t) => [r.paires[t - 1] || ["attaque", "attaque"]] } });
      setTimeout(() => $("#cbAuto")?.click(), 500);
      if (r.gagne && typeof verifierCadeaux === "function") setTimeout(verifierCadeaux, 4000);
    } catch (err) { toast("⚠ " + err.message); e.target.disabled = false; }
  });
}
ajouterPage("express", "⚡", "Combat express", vueExpress);

// Menu « Plus » et accueil : les nouveaux modes
if (typeof GROUPES_PLUS !== "undefined") {
  GROUPES_PLUS[0][1].splice(3, 0, "photo", "express");
  GROUPES_PLUS[2][1].splice(1, 0, "marche");
}
const _vueAccueilV7 = vueAccueil;
vueAccueil = function (v) {
  const r = _vueAccueilV7.apply(this, arguments);
  const t = $(".tuiles", v);
  if (t && !$("#tuilePhoto", v)) {
    $("#tuileDefi", v)?.insertAdjacentHTML("afterend", `<button class="tuile" id="tuilePhoto"><span class="t-ic">📷</span><span class="t-txt"><b>Défi photo</b><small>Quel est ce monument ?</small></span></button>
      <button class="tuile" id="tuileExpress"><span class="t-ic">⚡</span><span class="t-txt"><b>Combat express</b><small>Le deck du jour, 3 essais</small></span></button>
      <button class="tuile" id="tuileMarche"><span class="t-ic">🔄</span><span class="t-txt"><b>Marché d'échange</b><small>Échanges suggérés</small></span></button>`);
    $("#tuilePhoto").onclick = () => aller("photo"); $("#tuileExpress").onclick = () => aller("express"); $("#tuileMarche").onclick = () => aller("marche");
  }
  return r;
};

/* =====================================================================
   Devinettes : devinez un pays, une ville, un monument, un plat, un animal…
   On choisit la catégorie et le mode ; les indices se dévoilent un par un (moins d'indices = plus de points).
   ===================================================================== */
const CATS_DEVINE = [
  ["tout", "🎲", "Tout mélangé"], ["pays", "🏳️", "Pays"], ["ville", "🏙️", "Villes"], ["monument", "🏛️", "Monuments"],
  ["nature", "🏔️", "Nature"], ["animal", "🐾", "Animaux"], ["plat", "🍜", "Plats"], ["culture", "🎭", "Culture"],
  ["drapeau", "🚩", "Drapeaux"], ["sport", "⚽", "Sport"], ["invention", "💡", "Inventions"], ["personnage", "👤", "Personnages"],
];
// Banque de devinettes écrites (indépendantes des cartes), chargée à la demande :
// { cat: [[réponse, [3 leurres], [3 indices du plus dur au plus facile], explication], …] }
let BANQUE_DEVINE = null;
function chargerBanqueDevine() {
  if (BANQUE_DEVINE || chargerBanqueDevine.p) return chargerBanqueDevine.p;
  chargerBanqueDevine.p = fetch(`data/devinettes.json?v=${VERSION_JEU}`).then((r) => r.json()).then((d) => { BANQUE_DEVINE = d; }).catch(() => { BANQUE_DEVINE = {}; });
  return chargerBanqueDevine.p;
}
const banqueDevine = (cat) => {
  const B = BANQUE_DEVINE || {};
  return (cat === "tout" ? Object.keys(B) : [cat]).flatMap((k) => (B[k] || []).map((e, i) => ({ id: `dv:${k}:${i}`, nom: e[0], leurres: e[1], indices: e[2], anecdote: e[3], banque: k })));
};
const PIECES_DEVINE_JOUR = 400, QUESTIONS_DEVINE = 10, DUREE_CHRONO = 60;
const devine = { cat: "tout", mode: "classique", partie: null };
const poolDevine = (cat) => CARDS.filter((c) => !c.saisonnier && !["secrete", "merveille"].includes(c.type) && (cat === "tout" || c.type === cat) && (c.anecdote || c.type === "pays"));
const masquerNom = (texte, c) => {
  let t = String(texte || "");
  for (const mot of [c.nom, ...c.nom.split(/[\s'’-]+/).filter((m) => m.length > 3)]) t = t.replace(new RegExp(mot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "…");
  return t;
};
function indicesDevine(c) {
  if (c.banque) return c.indices.map((t) => `<p class="dv-texte">${esc(t)}</p>`);
  const cont = CONTINENTS[c.continent], pays = c.pays && NOM_PAYS[c.pays];
  const photo = typeof photoDe === "function" && photoDe(c.id);
  const premier = c.type === "pays"
    ? `<div class="dv-sil">${silhouette(c.code) || "🗺️"}</div><p>Un pays d'${esc(cont?.nom || "?")}</p>`
    : `<div class="dv-gros garder-emoji">${esc(c.emoji || "❔")}</div><p>${esc(TYPES[c.type])}${pays ? ` · ${drapeau(c.pays)} ${esc(pays)}` : ""}</p>`;
  const anecdote = `<p class="dv-anecdote">« ${esc(masquerNom(c.anecdote, c))} »</p>`;
  const troisieme = c.type === "pays" ? `<p>Sa capitale : <b>${esc(c.capitale || "?")}</b></p>`
    : photo ? `<div class="dv-photo"><img src="${esc(photo)}" alt=""></div>` : `<p>Première lettre : <b>${esc(c.nom[0])}</b> · ${c.nom.length} lettres</p>`;
  return [premier, anecdote, troisieme];
}
function questionDevine(cat, deja) {
  // 3 questions sur 4 viennent de la banque de devinettes écrites, le reste des cartes
  const banque = banqueDevine(cat), cartes = poolDevine(cat);
  const banqueLibre = banque.filter((x) => !deja.has(x.id));
  if (banque.length && (!cartes.length || (banqueLibre.length && Math.random() < 0.75))) {
    const c = pick(banqueLibre.length ? banqueLibre : banque);
    return { c, choix: [c, ...c.leurres.map((n) => ({ id: "f:" + n, nom: n }))].sort(() => Math.random() - 0.5) };
  }
  const pool = cartes;
  const libres = pool.filter((c) => !deja.has(c.id)), c = pick(libres.length ? libres : pool);
  // Les mauvaises réponses : même type, de préférence du même continent (plus difficile)
  const memeType = pool.filter((x) => x.type === c.type && x.id !== c.id && x.nom !== c.nom);
  const proches = memeType.filter((x) => x.continent === c.continent);
  const leurres = [];
  for (const l of [proches, memeType]) while (leurres.length < 3 && l.length > leurres.length) { const x = pick(l); if (!leurres.includes(x) && x.nom !== c.nom) leurres.push(x); }
  return { c, choix: [c, ...leurres.slice(0, 3)].sort(() => Math.random() - 0.5) };
}
function piecesDevine(n) {
  const j = today();
  if (!S.devineJour || S.devineJour.d !== j) S.devineJour = { d: j, pieces: 0 };
  const g = Math.max(0, Math.min(n, PIECES_DEVINE_JOUR - S.devineJour.pieces));
  S.devineJour.pieces += g; S.coins += g; return g;
}
function vueDevine(v) {
  if (!BANQUE_DEVINE) { v.innerHTML = `<p class="muted" style="text-align:center;padding:40px">Chargement des devinettes…</p>`; chargerBanqueDevine().then(() => { if (S.vue === "devine") aller("devine"); }); return; }
  const p = devine.partie;
  if (!p) {
    const rec = S.devineRecords || {};
    v.innerHTML = `<header class="page-tete"><h1>🧠 Devinettes</h1><p>Pays, villes, drapeaux, plats, animaux, inventions, personnages… Les indices se dévoilent un par un : moins vous en utilisez, plus vous marquez de points.</p></header>
      <section class="panel dv-choix"><h3 style="margin-top:0">1. Choisissez une catégorie</h3>
        <div class="dv-cats">${CATS_DEVINE.map(([k, ic, n]) => `<button class="dv-cat ${devine.cat === k ? "on" : ""}" data-cat="${k}"><span>${ic}</span><b>${n}</b><small>${banqueDevine(k).length + poolDevine(k).length} devinettes${rec[`classique:${k}`] ? ` · record ${rec[`classique:${k}`]}` : ""}</small></button>`).join("")}</div>
        <h3>2. Choisissez le mode</h3>
        <div class="dv-modes"><button class="dv-mode ${devine.mode === "classique" ? "on" : ""}" data-mode="classique"><b>🎯 Classique</b><small>${QUESTIONS_DEVINE} questions, jusqu'à 3 indices chacune</small></button>
          <button class="dv-mode ${devine.mode === "chrono" ? "on" : ""}" data-mode="chrono"><b>⏱️ Contre la montre</b><small>${DUREE_CHRONO} secondes, un maximum de bonnes réponses</small></button></div>
        <button class="btn primary" id="dvGo" style="margin-top:16px;width:100%">C'est parti !</button>
        <p class="muted" style="font-size:13px;margin-bottom:0">Jusqu'à ${PIECES_DEVINE_JOUR} 🪙 à gagner par jour aux Devinettes${S.devineJour?.d === today() ? ` (déjà ${S.devineJour.pieces} aujourd'hui)` : ""}.</p></section>`;
    $$("[data-cat]", v).forEach((b) => b.onclick = () => { devine.cat = b.dataset.cat; aller("devine"); });
    $$("[data-mode]", v).forEach((b) => b.onclick = () => { devine.mode = b.dataset.mode; aller("devine"); });
    $("#dvGo").onclick = () => {
      devine.partie = { cat: devine.cat, mode: devine.mode, n: 0, score: 0, bonnes: 0, serie: 0, deja: new Set(), fin: devine.mode === "chrono" ? Date.now() + DUREE_CHRONO * 1000 : 0, q: null, indice: 1 };
      aller("devine");
    };
    return;
  }
  const finie = p.mode === "classique" ? p.n >= QUESTIONS_DEVINE : Date.now() >= p.fin;
  if (finie) {
    const cle = `${p.mode}:${p.cat}`, rec = (S.devineRecords ||= {}), record = p.score > (rec[cle] || 0);
    if (record) rec[cle] = p.score;
    sauver();
    v.innerHTML = `<section class="panel dv-fin"><div style="font-size:52px;color:var(--accent)">${record ? "🏆" : "🧠"}</div><h2>${p.score} points${record ? " · nouveau record !" : ""}</h2>
      <p>${p.bonnes} bonne${p.bonnes > 1 ? "s" : ""} réponse${p.bonnes > 1 ? "s" : ""} sur ${p.n} · ${CATS_DEVINE.find((x) => x[0] === p.cat)[2]} · ${p.mode === "chrono" ? "Contre la montre" : "Classique"}</p>
      <p class="muted">Record : ${rec[cle] || p.score} points</p>
      <div class="row" style="justify-content:center"><button class="btn primary" id="dvRejouer">Rejouer</button><button class="btn" id="dvMenu">Changer de catégorie</button>
      <button class="btn" id="dvPartager">📤 Partager</button></div></section>`;
    $("#dvRejouer").onclick = () => { devine.partie = { cat: p.cat, mode: p.mode, n: 0, score: 0, bonnes: 0, serie: 0, deja: new Set(), fin: p.mode === "chrono" ? Date.now() + DUREE_CHRONO * 1000 : 0, q: null, indice: 1 }; aller("devine"); };
    $("#dvMenu").onclick = () => { devine.partie = null; aller("devine"); };
    $("#dvPartager").onclick = () => { const t = `🧠 Play2F1 · Devinettes ${CATS_DEVINE.find((x) => x[0] === p.cat)[2]} : ${p.score} points (${p.bonnes}/${p.n})\nhttps://play2f1.com/#devine`; (navigator.share ? navigator.share({ text: t }) : navigator.clipboard.writeText(t).then(() => toast("📋 Copié !"))).catch(() => {}); };
    return;
  }
  if (!p.q) { p.q = questionDevine(p.cat, p.deja); p.indice = p.mode === "chrono" ? 2 : 1; p.deja.add(p.q.c.id); }
  const { c, choix } = p.q, indices = indicesDevine(c);
  const points = p.mode === "chrono" ? 2 : [0, 3, 2, 1][p.indice];
  v.innerHTML = `<section class="panel dv-jeu">
      <div class="dv-tete"><span>${CATS_DEVINE.find((x) => x[0] === p.cat)[1]} ${p.mode === "chrono" ? `<b class="dv-chrono" id="dvChrono">${Math.ceil((p.fin - Date.now()) / 1000)} s</b>` : `Question ${p.n + 1}/${QUESTIONS_DEVINE}`}</span>
        <span>Score <b>${p.score}</b>${p.serie >= 3 ? ` · 🔥 ${p.serie}` : ""}</span></div>
      <div class="dv-indices">${indices.slice(0, p.indice).map((h, i) => `<div class="dv-indice"><small>Indice ${i + 1}</small>${h}</div>`).join("")}</div>
      ${p.mode === "classique" && p.indice < 3 ? `<button class="lien-chances" id="dvIndice">💡 Indice suivant (la réponse vaudra ${[0, 3, 2, 1][p.indice + 1]} point${p.indice + 1 < 3 ? "s" : ""})</button>` : ""}
      <div class="answers dv-reps">${choix.map((x) => `<button data-rep="${esc(x.id)}">${esc(x.nom)}</button>`).join("")}</div>
      <div id="dvFb" class="feedback"></div>
      <button class="lien-chances" id="dvQuitter">Arrêter la partie</button></section>`;
  $("#dvIndice")?.addEventListener("click", () => { p.indice++; aller("devine"); });
  $("#dvQuitter").onclick = () => { if (p.mode === "chrono") p.fin = 0; else p.n = QUESTIONS_DEVINE; p.q = null; aller("devine"); };
  if (p.mode === "chrono") {
    const t = setInterval(() => { const el = $("#dvChrono"); if (!el || devine.partie !== p) { clearInterval(t); return; } const s = Math.ceil((p.fin - Date.now()) / 1000); el.textContent = `${Math.max(0, s)} s`; if (s <= 0) { clearInterval(t); p.q = null; aller("devine"); } }, 250);
  }
  $$("[data-rep]", v).forEach((b) => b.onclick = () => {
    const bon = b.dataset.rep === c.id;
    $$("[data-rep]", v).forEach((x) => { x.disabled = true; if (x.dataset.rep === c.id) x.classList.add("good"); });
    if (!bon) b.classList.add("bad");
    p.n++;
    let gain = 0;
    if (bon) { p.bonnes++; p.serie++; const pts = points + (p.serie >= 3 ? 1 : 0); p.score += pts; gain = piecesDevine(pts * 4); gagnerXP?.(2); }
    else p.serie = 0;
    majCoins(); sauver();
    $("#dvFb").innerHTML = `<p style="font-weight:700;margin:6px 0">${bon ? `✅ Bravo ! +${points + (p.serie >= 3 ? 1 : 0)} pt${gain ? ` · +${gain} 🪙` : ""}` : `❌ C'était <b>${esc(c.nom)}</b>`}</p>${!bon || p.mode === "classique" ? `<p class="muted" style="margin:4px 0">${esc(c.anecdote || "")}</p>` : ""}
      ${p.mode === "classique" ? `<button class="btn primary" id="dvSuite">${p.n >= QUESTIONS_DEVINE ? "Voir le résultat" : "Question suivante →"}</button>` : ""}`;
    p.q = null;
    if (p.mode === "chrono") setTimeout(() => { if (devine.partie === p && S.vue === "devine") aller("devine"); }, bon ? 450 : 1100);
    else { $("#dvSuite").onclick = () => aller("devine"); $("#dvSuite").focus(); }
  });
}
ajouterPage("devine", "🧠", "Devinettes", vueDevine);
if (typeof GROUPES_PLUS !== "undefined") GROUPES_PLUS[0][1].splice(1, 0, "devine");
// Le quiz du jour propose aussi les Devinettes (illimitées, par catégorie)
const _vueQuizV7 = vueQuiz;
vueQuiz = function (v) {
  const r = _vueQuizV7.apply(this, arguments);
  v.insertAdjacentHTML("afterbegin", `<button class="panel dv-pub" id="dvPub"><span>🧠</span><div><b>Nouveau : les Devinettes</b><small class="muted">Choisissez la catégorie (pays, villes, plats, animaux…) et jouez sans limite, en classique ou contre la montre.</small></div><span class="btn primary small">Jouer</span></button>`);
  $("#dvPub").onclick = () => aller("devine");
  return r;
};
const _vueAccueilV7b = vueAccueil;
vueAccueil = function (v) {
  const r = _vueAccueilV7b.apply(this, arguments);
  if ($("#tuileExpress", v) && !$("#tuileDevine", v)) {
    $("#tuileExpress", v).insertAdjacentHTML("afterend", `<button class="tuile" id="tuileDevine"><span class="t-ic">🧠</span><span class="t-txt"><b>Devinettes</b><small>Pays, villes, plats… au choix</small></span></button>`);
    $("#tuileDevine").onclick = () => aller("devine");
  }
  return r;
};
