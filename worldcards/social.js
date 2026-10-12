"use strict";
/* Fonctions sociales et de progression : duels en direct, guildes, connexion quotidienne, passe de saison,
   personnalisation, expédition, enchères et statistiques. Chargé après extras.js. */

/* =====================================================================
   Duels en direct entre amis
   ===================================================================== */
const duelEtat = { attente: null, vues: new Set() };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
// Avant d'inviter : choix du duel classé (même règles, compte pour le classement) ou amical
async function defierEnDirect(pseudo, classe) {
  if (!connecte()) return toast("Connectez-vous pour défier vos amis.");
  if (classe === undefined) {
    let info = null; try { info = await api("classe/jour"); } catch {}
    ouvrirModal(`<div style="text-align:center"><h2 style="margin-top:0">⚔️ Défier ${esc(pseudo)}</h2>
      <p class="muted">Même plateau, mêmes règles et même journal dans les deux cas. Seuls le classement et les points changent.</p>
      <div class="choix-duel"><button class="btn primary" id="dClasse">🏆 Duel classé<small>${info ? `${info.restants}/${info.parJour} combats classés restants aujourd'hui${info.restants ? "" : " : il ne rapportera pas de points"}` : "Compte pour le classement"}</small></button>
      <button class="btn" id="dAmical">🤝 Duel amical<small>Sans effet sur le classement</small></button></div>
      ${info ? `<p class="muted" style="font-size:12.5px">Contre un même adversaire, ${info.memeAdversaire} duel classé par jour rapporte des points.</p>` : ""}</div>`);
    $("#dClasse").onclick = () => defierEnDirect(pseudo, true);
    $("#dAmical").onclick = () => defierEnDirect(pseudo, false);
    return;
  }
  if (!deckPret()) return;
  try {
    await envoyerDeckArene();
    const { id } = await api("duels/inviter", { methode: "POST", corps: { pseudo, classe: !!classe } });
    ouvrirModal(`<div style="text-align:center"><h2 style="margin-top:0">${classe ? "🏆 Duel classé" : "🤝 Duel amical"} en direct</h2>
      ${avatarHTML(pseudo, "grand")}<p>Invitation envoyée à <b>${esc(pseudo)}</b>.<br><span class="muted">En attente de sa réponse… (5 min max)</span></p>
      <div class="loader-duel"></div><button class="btn" id="duelAnnuler">Annuler</button></div>`, () => { duelEtat.attente = null; });
    duelEtat.attente = id;
    $("#duelAnnuler").onclick = () => { api(`duels/${id}/abandon`, { methode: "POST", corps: {} }).catch(() => {}); duelEtat.attente = null; fermerModal(); };
    const debut = Date.now();
    while (duelEtat.attente === id && Date.now() - debut < 5 * 60000) {
      await pause(1500);
      if (duelEtat.attente !== id) return;
      const v = await api(`duels/${id}`).catch(() => null);
      if (!v) continue;
      if (v.statut === "encours") { duelEtat.attente = null; return lancerDuel(v); }
      if (v.statut !== "invite") { duelEtat.attente = null; fermerModal(); return toast(`${pseudo} a refusé le duel.`); }
    }
    if (duelEtat.attente === id) { duelEtat.attente = null; fermerModal(); toast(`${pseudo} n'a pas répondu.`); }
  } catch (e) { toast("⚠ " + e.message); }
}
function lancerDuel(v) {
  duelEtat.vues.add(v.id);
  const id = v.id;
  lancerCombat({
    titre: `${v.classe ? "🏆 Duel classé" : "🤝 Duel amical"} contre ${v.adversaire}`, adversaire: v.adversaire, moi: v.deckA, lui: v.deckB, graine: v.graine, paires: v.paires || [],
    duel: {
      cote: v.cote, resteMs: v.resteMs,
      abandon: () => api(`duels/${id}/abandon`, { methode: "POST", corps: {} }),
      // Envoie notre choix puis attend que le serveur ait résolu le tour
      tours: async (tour, action) => {
        let r;
        try { r = await api(`duels/${id}/action`, { methode: "POST", corps: { tour, action } }); }
        catch (e) { if (e.status !== 409) throw e; }
        for (let i = 0; i < 40; i++) {
          if (r && r.paires.length >= tour) return r.paires.slice(tour - 1);
          if (r && r.statut === "fini") break;
          await pause(900);
          r = await api(`duels/${id}`).catch(() => r);
        }
        if (r?.statut === "fini") {
          // L'adversaire a abandonné
          arreterCombat(); fermerModal();
          if (r.gagne) S.duelsGagnes = (S.duelsGagnes || 0) + 1;
          if (r.pieces) S.coins += r.pieces;
          sauver(); majCoins();
          ouvrirModal(`<div style="text-align:center"><h2 style="margin-top:0">${r.gagne ? "🏆 Victoire !" : "💀 Défaite"}</h2><p>${r.gagne ? `${esc(v.adversaire)} a abandonné le duel.` : "Le duel est terminé."}${r.pieces ? ` +${r.pieces} 🪙` : ""}${r.classe && r.points ? ` · ${r.points > 0 ? "+" : ""}${r.points} 🏆` : ""}</p><button class="btn primary" data-close>Continuer</button></div>`);
          return null;
        }
        return [];
      },
    },
    fin: async () => {
      let r = null;
      for (let i = 0; i < 5 && r?.statut !== "fini"; i++) { r = await api(`duels/${id}`).catch(() => null); if (r?.statut !== "fini") await pause(800); }
      if (r?.pieces) { S.coins += r.pieces; sauver(); majCoins(); }
      if (r?.gagne) { S.combat.victoires++; S.duelsGagnes = (S.duelsGagnes || 0) + 1; } else S.combat.defaites++;
      const pts = r?.classe ? (r.points === null || r.points === undefined ? " · points en cours de calcul" : r.points ? ` · ${r.points > 0 ? "+" : ""}${r.points} 🏆` : " · sans points (limite du jour ou même adversaire)") : " · duel amical";
      return `Duel contre ${v.adversaire}${pts}${r?.pieces ? ` · +${r.pieces} 🪙` : ""}`;
    },
  });
}
// Invitations reçues : vérifiées toutes les 8 secondes
async function verifierDuels() {
  if (!connecte() || document.hidden || duelEtat.attente) return;
  try {
    const { invitations, enCours } = await api("duels/invitations");
    if (enCours && !duelEtat.vues.has(enCours) && $("#modal").classList.contains("hidden")) {
      const v = await api(`duels/${enCours}`);
      if (v.statut === "encours") return lancerDuel(v);
    }
    const inv = invitations.find((i) => !duelEtat.vues.has("i" + i.id));
    if (!inv || !$("#modal").classList.contains("hidden")) return;
    duelEtat.vues.add("i" + inv.id);
    son?.("special");
    ouvrirModal(`<div style="text-align:center"><h2 style="margin-top:0">⚡ Défi en direct !</h2>${avatarHTML(inv.pseudo, "grand")}
      <p><b>${esc(inv.pseudo)}</b> vous défie en direct en <b>${inv.classe ? "duel classé 🏆" : "duel amical 🤝"}</b>. Chacun choisit son action à chaque tour (20 s).</p>
      <div class="row" style="justify-content:center;gap:8px"><button class="btn primary" id="duelOk">⚔️ Accepter</button><button class="btn" id="duelNon">Refuser</button></div></div>`);
    $("#duelNon").onclick = () => { api(`duels/${inv.id}/refuser`, { methode: "POST", corps: {} }).catch(() => {}); fermerModal(); };
    $("#duelOk").onclick = async () => {
      if (!deckPret()) return;
      try {
        await envoyerDeckArene();
        await api(`duels/${inv.id}/accepter`, { methode: "POST", corps: {} });
        lancerDuel(await api(`duels/${inv.id}`));
      } catch (e) { toast("⚠ " + e.message); fermerModal(); }
    };
  } catch {}
}
setInterval(verifierDuels, 8000);

/* ---------- Nouvelles pages (menu) ---------- */
const VUES_EXTRA = {};
function ajouterPage(cle, ic, nom, vue) {
  VUES_EXTRA[cle] = vue;
  if (!VUES_GLOBALES.includes(cle)) VUES_GLOBALES.push(cle);
  if (!DESTINATIONS.some(([v]) => v === cle)) DESTINATIONS.splice(DESTINATIONS.findIndex(([v]) => v === "hub"), 0, [cle, ic, nom]);
  TITRES[cle] = `${ic} ${nom}`;
}

/* =====================================================================
   Récompense de connexion quotidienne (7 jours, la série repart à zéro si on rate un jour)
   ===================================================================== */
const CALENDRIER = [
  { ic: "🪙", txt: "100 pièces", donner: () => { S.coins += 100; } },
  { ic: "🪙", txt: "150 pièces", donner: () => { S.coins += 150; } },
  { ic: "🌍", txt: "Booster Classique", donner: () => { S.boosters.monde = (S.boosters.monde || 0) + 1; } },
  { ic: "🪙", txt: "250 pièces", donner: () => { S.coins += 250; } },
  { ic: "🥈", txt: "Booster Argent", donner: () => { S.boosters.argent = (S.boosters.argent || 0) + 1; } },
  { ic: "✨", txt: "400 pièces + 60 poussière", donner: () => { S.coins += 400; S.poussiere = (S.poussiere || 0) + 60; } },
  { ic: "💎", txt: "Carte rare garantie + booster Or", donner: () => {
    S.boosters.or = (S.boosters.or || 0) + 1;
    const pool = CARDS.filter((c) => ["rare", "epique"].includes(c.rarete) && !c.saisonnier && c.type !== "secrete");
    const neuves = pool.filter((c) => !has(c.id));
    const c = (neuves.length ? neuves : pool)[Math.floor(Math.random() * (neuves.length ? neuves : pool).length)];
    gagner(c.id); return c;
  } },
];
const hier = () => { const d = new Date(); d.setDate(d.getDate() - 1); return jourLocal(d); };
function etatConnexion() {
  const c = S.connexion || { serie: 0, dernier: null };
  const dispo = c.dernier !== today();
  const continue_ = c.dernier === hier() || c.dernier === today();
  const serie = continue_ ? c.serie : 0;                     // série en cours (jours déjà récupérés)
  const prochain = dispo ? (serie % 7) : (serie - 1) % 7;     // case du jour (0-6)
  return { dispo, serie, prochain, casse: !continue_ && c.serie > 0 };
}
function ouvrirCalendrier() {
  const e = etatConnexion();
  const fait = (i) => (e.dispo ? i < e.prochain : i <= e.prochain);
  ouvrirModal(`<h2 style="margin-top:0">📅 Récompense de connexion</h2>
    <p class="muted" style="margin-top:0">Revenez chaque jour : la récompense grandit jusqu'au 7e jour. ${e.casse ? "<b>Vous avez manqué un jour : la série repart du jour 1.</b>" : "Si vous manquez un jour, la série repart de zéro."}</p>
    <div class="calendrier">${CALENDRIER.map((r, i) => `<div class="jour-cal ${fait(i) ? "fait" : ""} ${e.dispo && i === e.prochain ? "aujourdhui" : ""} ${i === 6 ? "grand" : ""}">
      <small>Jour ${i + 1}</small><span>${fait(i) ? "✅" : r.ic}</span><b>${r.txt}</b></div>`).join("")}</div>
    ${e.dispo ? `<button class="btn primary" id="calOk" style="width:100%;margin-top:12px">🎁 Récupérer le jour ${e.prochain + 1}</button>` : `<p style="text-align:center;margin:12px 0 0">✅ Déjà récupéré aujourd'hui — revenez demain pour le jour ${((e.prochain + 1) % 7) + 1} !</p>`}`);
  $("#calOk")?.addEventListener("click", () => {
    const r = CALENDRIER[e.prochain], carte = r.donner();
    S.connexion = { serie: e.serie + 1, dernier: today() };
    S.serieMax = Math.max(S.serieMax || 0, e.serie + 1);
    if (typeof ajouterXPPasse === "function") ajouterXPPasse(50); // la connexion du jour fait aussi avancer le passe
    sauver(); majCoins(); fermerModal(); son?.("victoire");
    if (carte) { ouvrirModal(`<div style="text-align:center"><h2 style="margin-top:0">💎 Jour 7 !</h2><div style="max-width:220px;margin:0 auto">${cardHTML(carte)}</div><p>+ 1 booster Or. Bravo pour votre fidélité !</p><button class="btn primary" data-close>Super !</button></div>`); }
    else toast(`🎁 Jour ${e.prochain + 1} : ${r.txt} !`);
    if (S.vue === "accueil") aller("accueil");
  });
}

/* =====================================================================
   Statistiques de collection
   ===================================================================== */
function noterHistorique() {
  const n = count(of("monde").map((c) => c.id));
  const h = S.historique || [];
  if (h.length && h[h.length - 1][0] === today()) h[h.length - 1][1] = n; else h.push([today(), n]);
  S.historique = h.slice(-365);
}
function graphiqueProgression(h) {
  if (h.length < 2) return `<p class="muted">Le graphique se remplit jour après jour : revenez demain !</p>`;
  const L = 600, H = 180, max = Math.max(...h.map((x) => x[1]), 1), min = Math.min(...h.map((x) => x[1]));
  const x = (i) => 30 + (i / (h.length - 1)) * (L - 40), y = (v) => H - 24 - ((v - min) / Math.max(1, max - min)) * (H - 44);
  const pts = h.map((p, i) => `${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`).join(" ");
  const jour = (s) => new Date(s + "T12:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return `<svg viewBox="0 0 ${L} ${H}" class="graphe" role="img" aria-label="Évolution du nombre de cartes">
    <line x1="30" y1="${H - 24}" x2="${L - 10}" y2="${H - 24}" class="axe"/>
    <polygon points="30,${H - 24} ${pts} ${x(h.length - 1).toFixed(1)},${H - 24}" class="aire"/>
    <polyline points="${pts}" class="ligne"/>
    <circle cx="${x(h.length - 1)}" cy="${y(h[h.length - 1][1])}" r="5" class="point"/>
    <text x="30" y="${H - 6}" class="lib">${jour(h[0][0])}</text><text x="${L - 10}" y="${H - 6}" text-anchor="end" class="lib">${jour(h[h.length - 1][0])}</text>
    <text x="${x(h.length - 1) - 8}" y="${y(h[h.length - 1][1]) - 10}" text-anchor="end" class="val">${fmt(h[h.length - 1][1])} cartes</text>
  </svg>`;
}
function vueStats(v) {
  noterHistorique(); sauver();
  const toutes = of("monde").filter((c) => c.type !== "secrete" && !c.saisonnier);
  const miennes = CARDS.filter((c) => has(c.id));
  const rare = [...miennes].sort((a, b) => (RARETES[b.rarete]?.ordre ?? 0) - (RARETES[a.rarete]?.ordre ?? 0) || (S.doree?.[b.id] ? 1 : 0) - (S.doree?.[a.id] ? 1 : 0) || (S.shiny?.[b.id] ? 1 : 0) - (S.shiny?.[a.id] ? 1 : 0))[0];
  const conts = Object.entries(CONTINENTS).map(([k, ct]) => { const l = toutes.filter((c) => c.continent === k); return { ct, n: count(l.map((c) => c.id)), t: l.length }; }).filter((x) => x.t);
  const types = Object.entries(TYPES).filter(([t]) => t !== "secrete").map(([t, nom]) => { const l = toutes.filter((c) => c.type === t); return { nom, ic: EMOJI_TYPE[t], n: count(l.map((c) => c.id)), t: l.length }; }).filter((x) => x.t);
  const raretes = Object.entries(RARETES).filter(([r]) => r !== "secrete").map(([r, R]) => ({ R, r, n: miennes.filter((c) => c.rarete === r).length, t: toutes.filter((c) => c.rarete === r).length }));
  const presque = of("monde", "pays").map((c) => ({ c, ...progresPays(c.code) })).filter((x) => x.n < x.t && !S.paysRecompense?.[x.c.code]).sort((a, b) => (a.t - a.n) - (b.t - b.n) || b.n - a.n).slice(0, 6);
  const total = count(toutes.map((c) => c.id)), pct = (total / toutes.length) * 100;
  const barre = (n, t) => `<div class="bar"><i style="width:${(n / Math.max(1, t)) * 100}%"></i></div>`;
  v.innerHTML = `<section class="stats-hero panel">
      <div class="stats-anneau" style="--p:${pct}"><span><b>${pct.toFixed(1)} %</b><small>du monde</small></span></div>
      <div class="stats-chiffres">
        <div><b>${fmt(total)}</b><span>cartes uniques</span></div>
        <div><b>${fmt(Object.values(S.owned).reduce((a, b) => a + (b || 0), 0))}</b><span>exemplaires</span></div>
        <div><b>${CARDS.filter((c) => S.shiny?.[c.id]).length}</b><span>✨ Shiny</span></div>
        <div><b>${Object.keys(S.doree || {}).length}</b><span>👑 Dorées</span></div>
        <div><b>${of("monde", "pays").filter((c) => S.paysRecompense?.[c.code]).length}</b><span>pays complétés</span></div>
        <div><b>${S.ouverts || 0}</b><span>boosters ouverts</span></div>
      </div></section>
    <div class="panel"><h3 style="margin-top:0">📈 Ma progression</h3>${graphiqueProgression(S.historique || [])}</div>
    <div class="grid2 stats-grille">
      <div class="panel"><h3 style="margin-top:0">🌍 Par continent</h3>${conts.map((x) => `<div class="p"><span>${x.ct.emoji} ${x.ct.nom}</span>${barre(x.n, x.t)}<span>${Math.round((x.n / x.t) * 100)} %</span></div>`).join("")}</div>
      <div class="panel"><h3 style="margin-top:0">🗂️ Par type</h3>${types.map((x) => `<div class="p"><span>${x.ic} ${x.nom}</span>${barre(x.n, x.t)}<span>${x.n}/${x.t}</span></div>`).join("")}</div>
      <div class="panel"><h3 style="margin-top:0">💠 Par rareté</h3>${raretes.map((x) => `<div class="p"><span><span class="gem" style="color:var(--${x.r})">${x.R.gems}</span> ${x.R.nom}</span>${barre(x.n, x.t)}<span>${x.n}/${x.t}</span></div>`).join("")}</div>
      <div class="panel"><h3 style="margin-top:0">🏆 Ma carte la plus rare</h3>${rare ? `<div style="max-width:200px;margin:0 auto">${cardHTML(rare)}</div>` : `<p class="muted">Ouvrez des boosters !</p>`}</div>
    </div>
    <div class="panel"><h3 style="margin-top:0">🏳️ Collections de pays presque finies</h3>
      ${presque.length ? `<div class="presque">${presque.map((x) => `<button class="presque-pays" data-pays="${x.c.code}"><span class="big">${x.c.emoji || "🏳️"}</span><b>${esc(x.c.nom)}</b><small>${x.n}/${x.t} · plus que ${x.t - x.n} !</small>${barre(x.n, x.t)}</button>`).join("")}</div>` : `<p class="muted">Aucune pour l'instant.</p>`}</div>`;
  $$("[data-pays]", v).forEach((b) => b.onclick = () => aller("pays", { code: b.dataset.pays }));
}
ajouterPage("stats", "📊", "Statistiques", vueStats);

// Accueil : tuiles « connexion du jour » et « statistiques », calendrier automatique une fois par jour
const _vueAccueil = vueAccueil;
vueAccueil = function (v, opts) {
  _vueAccueil(v, opts);
  const e = etatConnexion(), t = $(".tuiles", v);
  if (!t) return;
  t.insertAdjacentHTML("afterbegin", `<button class="tuile ${e.dispo ? "chaude" : ""}" id="tuileCal"><span class="t-ic">📅</span><span class="t-txt"><b>Connexion du jour</b><small>${e.dispo ? `Jour ${e.prochain + 1} à récupérer !` : `Série : ${e.serie} jour${e.serie > 1 ? "s" : ""} 🔥`}</small></span></button>`);
  const pp = passe(), aRecup = [...Array(palierPasse()).keys()].filter((i) => !pp.gratuit.includes(i + 1)).length;
  t.insertAdjacentHTML("beforeend", `<button class="tuile ${aRecup ? "chaude" : ""}" id="tuilePasse"><span class="t-ic">🎟️</span><span class="t-txt"><b>Passe de saison</b><small>${aRecup ? `${aRecup} récompense${aRecup > 1 ? "s" : ""} à récupérer` : `Palier ${palierPasse()}/30 · ${esc(themeDe(pp.mois).nom)}`}</small></span></button>
    <button class="tuile" id="tuileExp"><span class="t-ic">🧭</span><span class="t-txt"><b>Expédition</b><small>Le monde pays par pays</small></span></button>
    <button class="tuile" id="tuileGuilde"><span class="t-ic">🛡️</span><span class="t-txt"><b>Guildes</b><small>Jouez en équipe</small></span></button>
    <button class="tuile" id="tuileEnch"><span class="t-ic">🔨</span><span class="t-txt"><b>Enchères</b><small>Vendez et achetez des cartes</small></span></button>
    <button class="tuile" id="tuileSoutenir"><span class="t-ic">❤️</span><span class="t-txt"><b>Soutenir le jeu</b><small>Un petit don sur PayPal</small></span></button>`);
  t.insertAdjacentHTML("beforeend", `<button class="tuile" id="tuileStats"><span class="t-ic">📊</span><span class="t-txt"><b>Statistiques</b><small>Ma progression en détail</small></span></button>`);
  $("#tuileCal").onclick = ouvrirCalendrier;
  $("#tuileStats").onclick = () => aller("stats");
  $("#tuilePasse").onclick = () => aller("passe"); $("#tuileExp").onclick = () => aller("expedition");
  $("#tuileGuilde").onclick = () => aller("guilde"); $("#tuileEnch").onclick = () => aller("encheres");
  $("#tuileSoutenir").onclick = () => aller("soutenir");
};
addEventListener("DOMContentLoaded", () => {
  noterHistorique(); sauver();
  // Le calendrier s'ouvre tout seul une fois par jour, dès qu'aucune autre fenêtre n'est ouverte
  let essais = 0;
  const t = setInterval(() => {
    if (++essais > 60 || !S.ouverts || !etatConnexion().dispo) return clearInterval(t);
    if ($("#modal").classList.contains("hidden")) { clearInterval(t); ouvrirCalendrier(); }
  }, 2000);
});

/* =====================================================================
   Guildes
   ===================================================================== */
const guildeEtat = { onglet: "membres" };
const ROLES = { chef: "👑 Chef", officier: "⭐ Officier", membre: "Membre" };
const EMBLEMES = ["🛡️", "🦁", "🐉", "🦅", "🐺", "🔥", "⚡", "🌍", "🏔️", "🌊", "🌟", "🗡️", "🏰", "🐻", "🦊", "🌸"];
async function vueGuilde(v) {
  if (!connecte()) { v.innerHTML = `<div class="panel"><h2 style="margin-top:0">🛡️ Guildes</h2><p>Connectez-vous pour rejoindre une guilde : 20 joueurs, un salon privé, un objectif commun chaque semaine.</p><button class="btn primary" data-aller="compte">Se connecter</button></div>`; brancherLiens(v); return; }
  v.innerHTML = `<p class="muted">Chargement…</p>`;
  try {
    const { guilde } = await api("guilde/moi");
    if (!guilde) return listeGuildes(v);
    const g = guilde, fait = g.victoires >= g.objectif, chef = g.monRole === "chef", gere = chef || g.monRole === "officier";
    v.innerHTML = `<section class="panel guilde-tete">
        <span class="guilde-embleme">${esc(g.embleme)}</span>
        <div style="flex:1;min-width:0"><h2 style="margin:0">${esc(g.nom)} <span class="tag-guilde">[${esc(g.tag)}]</span></h2>
          <p class="muted" style="margin:4px 0">${esc(g.description) || "Pas encore de description."}</p>
          <small class="muted">${g.membres.length}/20 membres · ${g.ouverte ? "🔓 ouverte" : "🔒 fermée"} · 🏆 ${fmt(g.score)} pts cette semaine · ${g.rang}e au classement</small></div>
        <div class="row" style="gap:6px">${chef ? `<button class="btn small" id="gModif">⚙️</button>` : ""}<button class="btn small" id="gQuitter">Quitter</button></div></section>
      <section class="panel objectif-guilde">
        <div class="row" style="justify-content:space-between"><b>🎯 Objectif de la semaine : ${fmt(g.objectif)} victoires ensemble</b><small class="muted">fin ${new Date(g.finLe).toLocaleDateString("fr-FR", { weekday: "long" })}</small></div>
        <div class="bar grosse"><i style="width:${Math.min(100, (g.victoires / g.objectif) * 100)}%"></i></div>
        <div class="row" style="justify-content:space-between"><span>${fmt(g.victoires)} / ${fmt(g.objectif)} victoires (arène, solo, duels…)</span>
          ${g.recompenseRecue ? `<span>✅ Récompense récupérée</span>` : `<button class="btn ${fait ? "primary" : ""}" id="gRecompense" ${fait ? "" : "disabled"}>🎁 Booster Or + 300 🪙</button>`}</div></section>
      <div class="toolbar">${[["membres", "👥 Membres"], ["raid", "🐉 Raid"], ["discussion", "💬 Salon de guilde"], ["classement", "🏆 Classement des guildes"]].map(([k, l]) => `<button class="chip ${guildeEtat.onglet === k ? "on" : ""}" data-go="${k}">${l}</button>`).join("")}</div>
      <div id="gCorps"></div>`;
    $$("[data-go]", v).forEach((b) => b.onclick = () => { guildeEtat.onglet = b.dataset.go; vueGuilde(v); });
    $("#gQuitter").onclick = () => confirmer(`Quitter ${g.nom} ?${chef && g.membres.length > 1 ? " Un autre membre deviendra chef." : g.membres.length === 1 ? " La guilde sera supprimée." : ""}`, "Quitter", async () => {
      try { await api("guilde/quitter", { methode: "POST", corps: {} }); fermerModal(); aller("guilde"); } catch (e) { toast("⚠ " + e.message); }
    });
    $("#gRecompense")?.addEventListener("click", async () => {
      try { const r = await api("guilde/recompense", { methode: "POST", corps: {} }); S.boosters[r.booster] = (S.boosters[r.booster] || 0) + 1; S.coins += r.pieces; sauver(); majCoins(); toast("🎁 Booster Or + 300 🪙 pour la guilde !"); vueGuilde(v); }
      catch (e) { toast("⚠ " + e.message); }
    });
    $("#gModif")?.addEventListener("click", () => {
      ouvrirModal(`<h2 style="margin-top:0">⚙️ Ma guilde</h2><form class="form" id="fGModif">
        <label>Emblème<div class="emblemes">${EMBLEMES.map((e) => `<button type="button" class="chip ${e === g.embleme ? "on" : ""}" data-emb="${e}">${e}</button>`).join("")}</div></label>
        <label>Description<textarea id="gDesc" maxlength="200" rows="3">${esc(g.description)}</textarea></label>
        <label class="row" style="gap:8px"><input type="checkbox" id="gOuverte" ${g.ouverte ? "checked" : ""}> Ouverte : tout le monde peut rejoindre</label>
        <button class="btn primary">Enregistrer</button></form>`);
      let emb = g.embleme;
      $$("[data-emb]").forEach((b) => b.onclick = () => { emb = b.dataset.emb; $$("[data-emb]").forEach((x) => x.classList.toggle("on", x === b)); });
      $("#fGModif").onsubmit = async (e) => { e.preventDefault(); try { await api("guilde/modifier", { methode: "POST", corps: { description: $("#gDesc").value, ouverte: $("#gOuverte").checked, embleme: emb } }); fermerModal(); vueGuilde(v); } catch (err) { toast("⚠ " + err.message); } };
    });
    const corps = $("#gCorps");
    if (guildeEtat.onglet === "discussion") return hubDiscussion(corps, "g" + g.id);
    if (guildeEtat.onglet === "classement") return classementGuildes(corps, g.id);
    if (guildeEtat.onglet === "raid") return afficherRaid(corps);
    corps.innerHTML = `<div class="amis">${g.membres.map((m) => `<div class="ami">${avatarHTML(m.pseudo, "", m.cadre || null)}
      <div class="ami-infos"><b>${esc(m.pseudo)} ${m.enLigne ? `<span class="enligne">●</span>` : ""}</b>${m.titre && nomTitre(m.titre) ? `<small class="titre-joueur">${esc(nomTitre(m.titre))}</small>` : ""}<small class="muted">${ROLES[m.role]} · ⚔️ ${m.victoires} victoires · ${fmt(m.score)} pts · 🏆 ${fmt(m.trophees)}</small></div>
      <div class="row" style="gap:6px">${m.pseudo !== COMPTE.pseudo ? `<button class="btn small" data-joueur="${esc(m.pseudo)}">👤</button>` : ""}
        ${gere && m.pseudo !== COMPTE.pseudo && (chef || m.role === "membre") ? `<button class="btn small" data-gerer="${esc(m.pseudo)}" data-role="${m.role}">⚙️</button>` : ""}</div></div>`).join("")}</div>`;
    $$("[data-joueur]", corps).forEach((b) => b.onclick = () => ficheJoueur(b.dataset.joueur));
    $$("[data-gerer]", corps).forEach((b) => b.onclick = () => {
      const ps = b.dataset.gerer, role = b.dataset.role;
      ouvrirModal(`<h2 style="margin-top:0">${esc(ps)}</h2><div class="row" style="gap:8px;flex-wrap:wrap">
        ${chef ? (role === "officier" ? `<button class="btn" data-act="membre">Retirer officier</button>` : `<button class="btn" data-act="officier">⭐ Nommer officier</button>`) : ""}
        ${chef ? `<button class="btn" data-act="chef">👑 Passer chef</button>` : ""}
        <button class="btn danger" data-act="exclure">Exclure</button></div>`);
      $$("[data-act]").forEach((x) => x.onclick = async () => {
        if (["exclure", "chef"].includes(x.dataset.act) && !confirm(x.dataset.act === "chef" ? `Donner la direction à ${ps} ?` : `Exclure ${ps} ?`)) return;
        try { await api("guilde/membre/" + encodeURIComponent(ps), { methode: "POST", corps: { action: x.dataset.act } }); fermerModal(); vueGuilde(v); } catch (e) { toast("⚠ " + e.message); }
      });
    });
  } catch (e) { v.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}
async function listeGuildes(v, q = "") {
  v.innerHTML = `<section class="panel"><h2 style="margin-top:0">🛡️ Rejoignez une guilde</h2>
      <p class="muted" style="margin-top:0">Jusqu'à 20 joueurs, un salon privé et un objectif commun chaque semaine : <b>25 victoires par membre</b> (500 pour 20 joueurs) = un <b>booster Or + 300 🪙</b> pour chacun !</p>
      <div class="row" style="gap:8px"><input class="search" id="gRech" placeholder="🔎 Chercher une guilde…" value="${esc(q)}" style="flex:1;max-width:none"><button class="btn primary" id="gCreer">➕ Créer ma guilde</button></div></section>
    <div id="gListe"><p class="muted">Chargement…</p></div>`;
  let t; $("#gRech").oninput = (e) => { clearTimeout(t); t = setTimeout(() => remplir(e.target.value), 300); };
  $("#gCreer").onclick = creerGuilde;
  const remplir = async (texte) => {
    try {
      const { guildes } = await api("guildes?q=" + encodeURIComponent(texte || ""));
      $("#gListe").innerHTML = guildes.length ? `<div class="amis">${guildes.map((g, i) => `<div class="ami"><span class="guilde-embleme petit">${esc(g.embleme)}</span>
        <div class="ami-infos"><b>${i < 3 && !texte ? ["🥇", "🥈", "🥉"][i] + " " : ""}${esc(g.nom)} <span class="tag-guilde">[${esc(g.tag)}]</span></b><small class="muted">${g.membres}/20 · ${fmt(g.score)} pts cette semaine${g.description ? " · " + esc(g.description.slice(0, 60)) : ""}</small></div>
        <button class="btn small ${g.ouverte && !g.pleine ? "primary" : ""}" data-rejoindre="${g.id}" ${g.ouverte && !g.pleine ? "" : "disabled"}>${g.pleine ? "Pleine" : g.ouverte ? "Rejoindre" : "🔒 Fermée"}</button></div>`).join("")}</div>`
        : `<p class="muted">Aucune guilde${texte ? " trouvée" : " pour l'instant : créez la première !"}</p>`;
      $$("[data-rejoindre]").forEach((b) => b.onclick = async () => { try { await api(`guildes/${b.dataset.rejoindre}/rejoindre`, { methode: "POST", corps: {} }); toast("🛡️ Bienvenue dans la guilde !"); aller("guilde"); } catch (e) { toast("⚠ " + e.message); } });
    } catch (e) { $("#gListe").innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  };
  remplir(q);
}
function creerGuilde() {
  ouvrirModal(`<h2 style="margin-top:0">➕ Créer une guilde</h2><form class="form" id="fGuilde">
    <label>Nom<input id="gNom" maxlength="24" minlength="3" required placeholder="Les Explorateurs"></label>
    <label>Tag (2 à 4 caractères)<input id="gTag" maxlength="4" minlength="2" required placeholder="EXPL" style="text-transform:uppercase"></label>
    <label>Emblème<div class="emblemes">${EMBLEMES.map((e, i) => `<button type="button" class="chip ${i ? "" : "on"}" data-emb="${e}">${e}</button>`).join("")}</div></label>
    <label>Description<textarea id="gDesc" maxlength="200" rows="2" placeholder="Guilde francophone, entraide et bonne humeur !"></textarea></label>
    <button class="btn primary">Créer</button></form>`);
  let emb = EMBLEMES[0];
  $$("[data-emb]").forEach((b) => b.onclick = () => { emb = b.dataset.emb; $$("[data-emb]").forEach((x) => x.classList.toggle("on", x === b)); });
  $("#fGuilde").onsubmit = async (e) => {
    e.preventDefault();
    try { await api("guildes", { methode: "POST", corps: { nom: $("#gNom").value, tag: $("#gTag").value, embleme: emb, description: $("#gDesc").value } }); fermerModal(); toast("🛡️ Guilde créée !"); aller("guilde"); }
    catch (err) { toast("⚠ " + err.message); }
  };
}
async function classementGuildes(el, monId) {
  el.innerHTML = `<p class="muted">Chargement…</p>`;
  try {
    const { guildes } = await api("guildes");
    el.innerHTML = `<div class="panel" style="padding:0;overflow-x:auto"><table class="classement"><thead><tr><th>#</th><th>Guilde</th><th>Membres</th><th>Points (semaine)</th></tr></thead><tbody>
      ${guildes.map((g, i) => `<tr class="${g.id === monId ? "moi" : ""}"><td>${["🥇", "🥈", "🥉"][i] || i + 1}</td><td>${esc(g.embleme)} ${esc(g.nom)} <span class="tag-guilde">[${esc(g.tag)}]</span></td><td>${g.membres}/20</td><td>${fmt(g.score)}</td></tr>`).join("")}</tbody></table></div>`;
  } catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}
ajouterPage("guilde", "🛡️", "Guilde", vueGuilde);

/* =====================================================================
   Passe de saison : un thème différent chaque mois, 30 paliers, piste gratuite + piste Premium (7,99 €)
   ===================================================================== */
const THEMES_PASSE = [
  { nom: "Aurores boréales", ic: "🌌", c1: "#3ad6a8", c2: "#6c4cf1" },
  { nom: "Grand Carnaval", ic: "🎭", c1: "#ff4fa3", c2: "#ffb300" },
  { nom: "Cerisiers en fleur", ic: "🌸", c1: "#ff8fc2", c2: "#b388ff" },
  { nom: "Jungle sauvage", ic: "🌿", c1: "#1fa971", c2: "#c0e64a" },
  { nom: "Routes de la soie", ic: "🐫", c1: "#e0913a", c2: "#8d4a1c" },
  { nom: "Océans profonds", ic: "🌊", c1: "#1e88e5", c2: "#26c6da" },
  { nom: "Soleil d'été", ic: "☀️", c1: "#ff9800", c2: "#ffd54f" },
  { nom: "Terre de volcans", ic: "🌋", c1: "#e53935", c2: "#ff9100" },
  { nom: "Grands explorateurs", ic: "🧭", c1: "#8d6e63", c2: "#f5b21b" },
  { nom: "Nuit des légendes", ic: "🎃", c1: "#7b1fa2", c2: "#ff6f00" },
  { nom: "Sommets du monde", ic: "🏔️", c1: "#546e7a", c2: "#90caf9" },
  { nom: "Étoiles d'hiver", ic: "❄️", c1: "#42a5f5", c2: "#e1f5fe" },
];
const moisPasse = () => new Date().toISOString().slice(0, 7);
const themeDe = (mois) => THEMES_PASSE[(Number(String(mois).slice(5, 7)) || 1) - 1];
const nomMois = (mois) => new Date(mois + "-15T12:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
const XP_PALIER = 80, PALIERS_PASSE = 30;
const passeEtat = { actif: null, mois: null };
function passe() {
  if (!S.passe || S.passe.mois !== moisPasse()) S.passe = { mois: moisPasse(), xp: 0, gratuit: [], premium: [] };
  return S.passe;
}
const palierPasse = () => Math.min(PALIERS_PASSE, Math.floor(passe().xp / XP_PALIER));
// Récompenses : identiques chaque mois, mais les objets exclusifs changent avec le thème
function recompensesPasse(n, mois = moisPasse()) {
  const gratuit = n === 30 ? { t: "cosm", type: "titre", id: `passe-${mois}`, txt: `Titre « ${nomTitre(`passe-${mois}`)} »` }
    : n % 5 === 0 ? { t: "booster", k: n % 10 === 0 ? "argent" : "monde" }
    : n % 3 === 0 ? { t: "poussiere", n: 40 } : { t: "pieces", n: 50 + n * 5 };
  const premium = n === 10 ? { t: "cosm", type: "cadre", id: `passe-${mois}`, txt: "Cadre de profil exclusif du mois" }
    : n === 20 ? { t: "cosm", type: "dos", id: `passe-${mois}`, txt: "Dos de cartes exclusif du mois" }
    : n === 30 ? { t: "cosm", type: "titre", id: `passe-${mois}-elite`, txt: `Titre « ${nomTitre(`passe-${mois}-elite`)} » + carte épique`, carte: "epique" }
    : n === 15 || n === 25 ? { t: "carte", r: "epique" }
    : n % 5 === 0 ? { t: "booster", k: n === 5 ? "or" : "prestige" }
    : n % 2 === 0 ? { t: "poussiere", n: 100 } : { t: "pieces", n: 150 + n * 10 };
  return { gratuit, premium };
}
function texteRecompense(r) {
  if (r.txt) return r.txt;
  if (r.t === "pieces") return `${r.n} 🪙`;
  if (r.t === "poussiere") return `${r.n} ✨ poussière`;
  if (r.t === "booster") return `Booster ${PACKS[r.k]?.nom || r.k}`;
  if (r.t === "carte") return `Carte ${RARETES[r.r].nom.toLowerCase()} garantie`;
  return "";
}
const iconeRecompense = (r) => ({ pieces: "🪙", poussiere: "✨", booster: PACKS[r.k]?.emoji || "🎁", carte: "💎", cosm: r.type === "titre" ? "🏷️" : r.type === "cadre" ? "🖼️" : "🂠" }[r.t] || "🎁");
function carteGarantie(rarete) {
  const pool = CARDS.filter((c) => c.rarete === rarete && !c.saisonnier && c.type !== "secrete");
  const neuves = pool.filter((c) => !has(c.id)), l = neuves.length ? neuves : pool;
  const c = l[Math.floor(Math.random() * l.length)]; gagner(c.id); return c;
}
function donnerRecompense(r) {
  if (r.t === "pieces") S.coins += r.n;
  else if (r.t === "poussiere") S.poussiere = (S.poussiere || 0) + r.n;
  else if (r.t === "booster") S.boosters[r.k] = (S.boosters[r.k] || 0) + 1;
  else if (r.t === "carte") return carteGarantie(r.r);
  else if (r.t === "cosm") { debloquerCosm(r.type, r.id); if (r.carte) return carteGarantie(r.carte); }
  return null;
}
function ajouterXPPasse(n) { const p = passe(), avant = palierPasse(); p.xp += n; if (palierPasse() > avant) toast(`🎟️ Passe : palier ${palierPasse()} atteint !`); }
const _gagnerXP = gagnerXP;
gagnerXP = function (n, pourquoi) { ajouterXPPasse(n); return _gagnerXP(n, pourquoi); };
async function chargerPasse() {
  if (!connecte()) { passeEtat.actif = false; return; }
  try { const r = await api("passe/moi"); passeEtat.actif = r.actif; passeEtat.mois = r.mois; } catch { passeEtat.actif = false; }
}
async function vuePasse(v) {
  const p = passe(), th = themeDe(p.mois), niv = palierPasse(), fin = new Date(Date.UTC(+p.mois.slice(0, 4), +p.mois.slice(5, 7), 1));
  const jours = Math.max(0, Math.ceil((fin - Date.now()) / 86400000));
  v.innerHTML = `<p class="muted">Chargement…</p>`;
  await chargerPasse();
  const actif = passeEtat.actif;
  const peutGratuit = (n) => n <= niv && !p.gratuit.includes(n), peutPremium = (n) => actif && n <= niv && !p.premium.includes(n);
  const aRecuperer = [...Array(PALIERS_PASSE).keys()].map((i) => i + 1).filter((n) => peutGratuit(n) || peutPremium(n)).length;
  v.innerHTML = `<section class="passe-tete" style="--p1:${th.c1};--p2:${th.c2}">
      <div class="passe-ic">${th.ic}</div>
      <div style="flex:1;min-width:0"><small>PASSE DE SAISON · ${esc(nomMois(p.mois)).toUpperCase()}</small><h2>${esc(th.nom)}</h2>
        <div class="passe-xp"><div class="bar"><i style="width:${niv >= PALIERS_PASSE ? 100 : ((p.xp % XP_PALIER) / XP_PALIER) * 100}%"></i></div>
        <span>Palier <b>${niv}</b>/${PALIERS_PASSE}${niv < PALIERS_PASSE ? ` · ${p.xp % XP_PALIER}/${XP_PALIER} XP` : " · terminé !"} · encore ${jours} j</span></div></div>
    </section>
    <p class="muted">Gagnez de l'XP en jouant (boosters, combats, quiz, quêtes, connexion du jour). Chaque mois, un nouveau thème et de nouvelles récompenses exclusives.</p>
    ${actif ? `<div class="panel passe-ok">💎 Piste Premium débloquée pour ${esc(nomMois(p.mois))} !</div>`
      : connecte() ? `<div class="panel passe-achat"><div><b>🔓 Débloquez la piste Premium — 7,99 €/mois</b><br><small class="muted">Cadre et dos de cartes exclusifs, titre « ${esc(nomTitre(`passe-${p.mois}-elite`))} », cartes épiques, boosters Or et Prestige… Abonnement renouvelé chaque mois pour le nouveau passe, résiliable à tout moment.</small></div>
        <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn primary premium hidden" data-stripe="passe">💳 Payer 7,99 € par carte</button><a class="btn premium" href="${PAYPAL}/7.99EUR" target="_blank" rel="noopener" id="passePayer">Payer avec PayPal</a><button class="btn" id="passeDemande">✅ J'ai payé (PayPal)</button></div>
        <div class="zone-paypal hidden" data-paypal="passe"></div></div>`
      : `<div class="panel"><a href="#" data-aller="compte">Connectez-vous</a> pour pouvoir débloquer la piste Premium.</div>`}
    ${aRecuperer ? `<button class="btn primary" id="passeTout" style="width:100%;margin:10px 0">🎁 Tout récupérer (${aRecuperer})</button>` : ""}
    <div class="passe-pistes"><div class="passe-entete"><span></span><b>Gratuit</b><b>💎 Premium</b></div>
      ${[...Array(PALIERS_PASSE).keys()].map((i) => {
        const n = i + 1, r = recompensesPasse(n, p.mois), ok = n <= niv;
        const caseR = (rec, pris, peut, piste) => `<button class="passe-case ${pris ? "prise" : ""} ${peut ? "dispo" : ""} ${piste === "premium" && !actif ? "verrou" : ""}" data-n="${n}" data-piste="${piste}" ${peut ? "" : "disabled"}>
          <span>${pris ? "✅" : iconeRecompense(rec)}</span><small>${esc(texteRecompense(rec))}</small></button>`;
        return `<div class="passe-ligne ${ok ? "atteint" : ""}"><span class="passe-n">${n}</span>${caseR(r.gratuit, p.gratuit.includes(n), peutGratuit(n), "gratuit")}${caseR(r.premium, p.premium.includes(n), peutPremium(n), "premium")}</div>`;
      }).join("")}</div>`;
  brancherLiens(v);
  const recuperer = (n, piste) => {
    const r = recompensesPasse(n, p.mois)[piste];
    const carte = donnerRecompense(r);
    p[piste].push(n);
    return { r, carte };
  };
  const apres = (gains) => {
    sauver(); majCoins();
    const cartes = gains.map((g) => g.carte).filter(Boolean);
    if (cartes.length) ouvrirModal(`<div style="text-align:center"><h2 style="margin-top:0">🎟️ Récompenses du passe</h2><div class="cards" style="justify-content:center">${cartes.map((c) => cardHTML(c)).join("")}</div><p>${gains.map((g) => esc(texteRecompense(g.r))).join(" · ")}</p><button class="btn primary" data-close>Super !</button></div>`, () => aller("passe"));
    else { toast(`🎁 ${gains.map((g) => texteRecompense(g.r)).join(" · ")}`); aller("passe"); }
  };
  $$("[data-n]", v).forEach((b) => b.onclick = () => apres([recuperer(Number(b.dataset.n), b.dataset.piste)]));
  $("#passeTout")?.addEventListener("click", () => {
    const gains = [];
    for (let n = 1; n <= niv; n++) { if (peutGratuit(n)) gains.push(recuperer(n, "gratuit")); if (peutPremium(n)) gains.push(recuperer(n, "premium")); }
    apres(gains);
  });
  $("#passeDemande")?.addEventListener("click", async () => {
    try { await api("premium/demande", { methode: "POST", corps: { formule: "passe", note: "" } }); ouvrirModal(`<div class="reveal"><div style="font-size:52px">🎟️</div><h2>Demande envoyée !</h2><p>L'administrateur vérifie votre paiement et débloque la piste Premium, en général sous 24 h. N'oubliez pas d'indiquer votre pseudo dans la note PayPal.</p><button class="btn primary" data-close>OK</button></div>`); }
    catch (e) { toast("⚠ " + e.message); }
  });
  if (!actif && connecte()) { brancherPaypal(); brancherStripe(v); }
}
ajouterPage("passe", "🎟️", "Passe", vuePasse);

/* =====================================================================
   Personnalisation : titres, cadres de profil, dos de cartes
   ===================================================================== */
const nbCartesMonde = () => count(of("monde").map((c) => c.id));
const pctContinent = (k) => { const l = of("monde").filter((c) => c.continent === k && c.type !== "secrete" && !c.saisonnier); return l.length ? count(l.map((c) => c.id)) / l.length : 0; };
const nbShiny = () => CARDS.filter((c) => S.shiny?.[c.id]).length;
const COSM = {
  titre: {
    nouveau: { nom: "Nouvel explorateur", aide: "Par défaut", ok: () => true },
    voyageur: { nom: "Voyageur", aide: "100 cartes", ok: () => nbCartesMonde() >= 100 },
    collectionneur: { nom: "Collectionneur", aide: "500 cartes", ok: () => nbCartesMonde() >= 500 },
    "grand-collectionneur": { nom: "Grand collectionneur", aide: "1 000 cartes", ok: () => nbCartesMonde() >= 1000 },
    "maitre-du-monde": { nom: "Maître du monde", aide: "Les 195 pays", ok: () => count(of("monde", "pays").map((c) => c.id)) >= of("monde", "pays").length },
    ...Object.fromEntries(Object.entries(CONTINENTS).map(([k, ct]) => [`explorateur-${k.toLowerCase()}`, { nom: `Explorateur · ${ct.nom}`, aide: `50 % des cartes ${ct.emoji} ${ct.nom}`, ok: () => pctContinent(k) >= 0.5 }])),
    "chasseur-shiny": { nom: "Chasseur de Shiny", aide: "10 cartes Shiny", ok: () => nbShiny() >= 10 },
    stratege: { nom: "Stratège", aide: "60 étoiles en mode Solo", ok: () => Object.values(S.solo || {}).reduce((a, b) => a + b, 0) >= 60 },
    duelliste: { nom: "Duelliste", aide: "10 duels en direct gagnés", ok: () => (S.duelsGagnes || 0) >= 10 },
    fidele: { nom: "Fidèle", aide: "7 jours de connexion d'affilée", ok: () => (S.serieMax || 0) >= 7 },
    "champion-or": { nom: "Champion 🥇 Or", aide: "1 300 trophées d'arène", ok: () => (S.meilleurTrophees || 0) >= 1300 },
    "champion-diamant": { nom: "Champion 💠 Diamant", aide: "1 700 trophées d'arène", ok: () => (S.meilleurTrophees || 0) >= 1700 },
    expeditionnaire: { nom: "Expéditionnaire", aide: "Finir l'Expédition d'un continent", ok: () => Object.values(S.expedition || {}).some((x) => x?.fini) },
    mecene: { nom: "Mécène 💎", aide: "Être Premium", ok: () => premium() },
  },
  cadre: {
    aucun: { nom: "Sans cadre", aide: "Par défaut", ok: () => true },
    argent: { nom: "Argent", aide: "Niveau 5", ok: () => niveauJoueur().niveau >= 5 },
    or: { nom: "Or", aide: "Niveau 15", ok: () => niveauJoueur().niveau >= 15 },
    feu: { nom: "Flammes", aide: "50 victoires", ok: () => S.combat.victoires >= 50 },
    glace: { nom: "Glace", aide: "100 pays", ok: () => count(of("monde", "pays").map((c) => c.id)) >= 100 },
    "arc-en-ciel": { nom: "Arc-en-ciel", aide: "25 badges", ok: () => badgesDe().filter((b) => S.badges[b.id]).length >= 25 },
    diamant: { nom: "Diamant", aide: "1 700 trophées d'arène", ok: () => (S.meilleurTrophees || 0) >= 1700 },
    premium: { nom: "Premium", aide: "Être Premium", ok: () => premium() },
  },
  dos: {
    classique: { nom: "Classique", aide: "Par défaut", ok: () => true, ic: "🌐" },
    nuit: { nom: "Nuit étoilée", aide: "10 boosters ouverts", ok: () => (S.ouverts || 0) >= 10, ic: "✨" },
    ocean: { nom: "Océan", aide: "50 boosters ouverts", ok: () => (S.ouverts || 0) >= 50, ic: "🌊" },
    or: { nom: "Or royal", aide: "Niveau 20", ok: () => niveauJoueur().niveau >= 20, ic: "👑" },
    neon: { nom: "Néon", aide: "20 cartes Shiny", ok: () => nbShiny() >= 20, ic: "⚡" },
    monde: { nom: "Planisphère", aide: "1 000 cartes", ok: () => nbCartesMonde() >= 1000, ic: "🗺️" },
    premium: { nom: "Premium", aide: "Être Premium", ok: () => premium(), ic: "💎" },
  },
};
// Objets du passe (un par mois) : « passe-2026-10 » et « passe-2026-10-elite »
function infoCosm(type, id) {
  if (COSM[type]?.[id]) return COSM[type][id];
  const m = /^passe-(\d{4}-\d{2})(-elite)?$/.exec(id || "");
  if (!m) return null;
  const th = themeDe(m[1]), mois = nomMois(m[1]);
  if (type === "titre") return { nom: m[2] ? `Légende · ${th.nom}` : `Pionnier · ${th.nom}`, aide: `Passe de ${mois}${m[2] ? " (Premium)" : ""}`, ok: () => false, passe: true };
  return { nom: `${th.nom}`, aide: `Passe de ${mois} (Premium)`, ok: () => false, ic: th.ic, th, passe: true };
}
const nomTitre = (id) => infoCosm("titre", id)?.nom || "";
function debloquerCosm(type, id) { S.cosmetiques = S.cosmetiques || {}; S.cosmetiques.debloques = { ...(S.cosmetiques.debloques || {}), [`${type}:${id}`]: true }; }
const cosmDebloque = (type, id) => !!(infoCosm(type, id)?.ok() || S.cosmetiques?.debloques?.[`${type}:${id}`]);
const cosmChoisi = (type) => { const id = S.cosmetiques?.[type]; return id && cosmDebloque(type, id) ? id : null; };
function styleCadre(id) { const i = infoCosm("cadre", id); return i?.th ? `--k1:${i.th.c1};--k2:${i.th.c2}` : ""; }
function dosChoisi() {
  const id = cosmChoisi("dos") || "classique", i = infoCosm("dos", id);
  return { cls: `dos-${i?.passe ? "passe" : id}`, style: i?.th ? `--d1:${i.th.c1};--d2:${i.th.c2}` : "", ic: i?.ic || "🌐" };
}
// Avatar avec cadre : avatarHTML(pseudo, classe, cadre)
const _avatarHTML = avatarHTML;
avatarHTML = function (pseudo, classe = "", cadre) {
  if (cadre === undefined && pseudo === COMPTE.pseudo) cadre = cosmChoisi("cadre");
  if (!cadre || cadre === "aucun") return _avatarHTML(pseudo, classe);
  const i = infoCosm("cadre", cadre);
  return _avatarHTML(pseudo, `${classe} cadre cadre-${i?.passe ? "passe" : cadre}`).replace('<span class="avatar', `<span style="${styleCadre(cadre)}" class="avatar`);
};
async function vueStyle(v) {
  if (connecte()) api("arene/moi").then((a) => { if (a.trophees > (S.meilleurTrophees || 0)) { S.meilleurTrophees = a.trophees; sauver(); } }).catch(() => {});
  const passeIds = Object.keys(S.cosmetiques?.debloques || {}).map((k) => k.split(":"));
  const liste = (type) => [...Object.keys(COSM[type]), ...passeIds.filter(([t]) => t === type).map(([, id]) => id)];
  const actuel = (type, def) => cosmChoisi(type) || def;
  const apercu = () => `<div class="style-apercu">${avatarHTML(COMPTE.pseudo || "?", "grand", actuel("cadre", "aucun"))}
      <div><b style="font-size:20px">${esc(COMPTE.pseudo || "Vous")}</b><br><span class="titre-joueur" style="font-size:14px">${esc(nomTitre(actuel("titre", "nouveau")))}</span></div>
      <div class="flip"><div class="face back ${dosChoisi().cls}" style="${dosChoisi().style};position:relative;width:74px;height:104px;font-size:30px">${dosChoisi().ic}</div></div></div>`;
  const section = (type, titre) => `<h3>${titre}</h3><div class="cosm-grille">${liste(type).map((id) => {
    const i = infoCosm(type, id), ok = cosmDebloque(type, id), on = actuel(type, Object.keys(COSM[type])[0]) === id;
    const visu = type === "titre" ? `<span class="cosm-titre">🏷️</span>` : type === "cadre" ? avatarHTML(COMPTE.pseudo || "?", "", id === "aucun" ? null : id)
      : `<span class="cosm-dos face back dos-${i.passe ? "passe" : id}" style="${i.th ? `--d1:${i.th.c1};--d2:${i.th.c2}` : ""}">${i.ic || "🌐"}</span>`;
    return `<button class="cosm ${on ? "on" : ""} ${ok ? "" : "verrou"}" data-type="${type}" data-id="${id}" ${ok ? "" : "disabled"}>${visu}<b>${esc(i.nom)}</b><small>${ok ? (on ? "✓ Équipé" : "Débloqué") : "🔒 " + esc(i.aide)}</small></button>`;
  }).join("")}</div>`;
  v.innerHTML = `<div class="panel">${apercu()}<p class="muted" style="margin-bottom:0">Votre titre et votre cadre sont visibles par les autres joueurs (discussion, amis, guilde). Le dos de cartes s'affiche quand vous ouvrez des boosters.</p></div>
    ${section("titre", "🏷️ Titres")}${section("cadre", "🖼️ Cadres de profil")}${section("dos", "🂠 Dos de cartes")}`;
  $$("[data-type]", v).forEach((b) => b.onclick = () => {
    S.cosmetiques = { ...(S.cosmetiques || {}), [b.dataset.type]: b.dataset.id }; sauver();
    if (connecte()) api("profil/apparence", { methode: "POST", corps: { titre: cosmChoisi("titre"), cadre: cosmChoisi("cadre") } }).catch(() => {});
    vueStyle(v);
  });
}
ajouterPage("style", "🎨", "Personnaliser", vueStyle);

/* =====================================================================
   Enchères (24 h, taxe de 10 % pour le vendeur)
   ===================================================================== */
const enchEtat = { vue: "toutes", minuteur: null };
const resteTemps = (fin) => { const s = Math.max(0, Math.floor((fin - Date.now()) / 1000)); return s >= 3600 ? `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}` : s > 0 ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s` : "terminée"; };
async function vueEncheres(v) {
  clearInterval(enchEtat.minuteur);
  if (connecte()) verifierLivraisons();
  v.innerHTML = `<section class="panel"><div class="row" style="justify-content:space-between;gap:10px;flex-wrap:wrap">
      <div><h2 style="margin:0">🔨 Hôtel des enchères</h2><small class="muted">Mettez une carte en vente 24 h : les joueurs enchérissent en pièces. Le vendeur paie une taxe de 10 %. Une offre dans les 2 dernières minutes prolonge l'enchère.</small></div>
      ${connecte() ? `<button class="btn primary" id="enchVendre">➕ Vendre une carte</button>` : `<button class="btn primary" data-aller="compte">Se connecter</button>`}</div></section>
    <div class="toolbar">${[["toutes", "🔥 En cours"], ["miennes", "📦 Mes enchères"]].map(([k, l]) => `<button class="chip ${enchEtat.vue === k ? "on" : ""}" data-ev="${k}">${l}</button>`).join("")}</div>
    <div id="enchListe"><p class="muted">Chargement…</p></div>`;
  brancherLiens(v);
  $$("[data-ev]", v).forEach((b) => b.onclick = () => { enchEtat.vue = b.dataset.ev; vueEncheres(v); });
  $("#enchVendre")?.addEventListener("click", vendreAuxEncheres);
  try {
    const { encheres } = await api("encheres" + (enchEtat.vue === "miennes" ? "?vue=miennes" : ""));
    $("#enchListe").innerHTML = encheres.length ? `<div class="encheres">${encheres.map((e) => {
      const c = BY_ID[e.carte]; if (!c) return "";
      const statut = e.statut === "ouverte" ? `<span class="ench-temps" data-fin="${e.fin}">⏱️ ${resteTemps(e.fin)}</span>` : `<span class="muted">${{ vendue: `✅ Vendue ${fmt(e.offre)} 🪙 à ${esc(e.acheteur)}`, invendue: "Sans offre", annulee: "Annulée" }[e.statut] || e.statut}</span>`;
      return `<div class="ench ${e.enTete ? "en-tete" : ""}">
        <div class="ench-carte">${cardHTML(c, { doree: e.doree })}</div>
        <div class="ench-infos"><b>${esc(e.nom)}${e.doree ? " 👑" : ""}</b><small class="muted">par ${esc(e.vendeur)} · ${e.nbOffres} offre${e.nbOffres > 1 ? "s" : ""}</small>
          <div class="ench-prix">${e.offre ? `<b>${fmt(e.offre)} 🪙</b><small>${e.enTete ? "🏆 vous êtes en tête" : "par " + esc(e.acheteur)}</small>` : `<b>${fmt(e.prixDepart)} 🪙</b><small>prix de départ</small>`}</div>
          ${statut}
          ${e.statut === "ouverte" && !e.moi && !e.enTete && connecte() ? `<button class="btn small primary" data-offre="${e.id}" data-min="${e.minimum}" data-nom="${esc(e.nom)}">🔨 Enchérir (min. ${fmt(e.minimum)})</button>` : ""}
          ${e.statut === "ouverte" && (e.moi || COMPTE.admin) && (!e.offre || COMPTE.admin) ? `<button class="btn small" data-annuler="${e.id}">Annuler</button>` : ""}</div></div>`;
    }).join("")}</div>` : `<p class="muted">${enchEtat.vue === "miennes" ? "Vous n'avez encore rien vendu ni enchéri." : "Aucune enchère en cours : soyez le premier à vendre une carte !"}</p>`;
    $$("[data-offre]", v).forEach((b) => b.onclick = () => encherir(Number(b.dataset.offre), Number(b.dataset.min), b.dataset.nom));
    $$("[data-annuler]", v).forEach((b) => b.onclick = async () => { try { await api(`encheres/${b.dataset.annuler}/annuler`, { methode: "POST", corps: {} }); toast("Enchère annulée : la carte revient dans votre collection."); setTimeout(verifierLivraisons, 500); vueEncheres(v); } catch (e) { toast("⚠ " + e.message); } });
    enchEtat.minuteur = setInterval(() => {
      if (!document.body.contains(v) || S.vue !== "encheres") return clearInterval(enchEtat.minuteur);
      $$("[data-fin]", v).forEach((x) => x.textContent = "⏱️ " + resteTemps(Number(x.dataset.fin)));
    }, 1000);
  } catch (e) { $("#enchListe").innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}
function vendreAuxEncheres() {
  choisirCarte("Quelle carte vendre aux enchères ?", (id) => {
    const c = BY_ID[id], doree = !!S.doree?.[id], conseil = RARETES[c.rarete]?.prix || 100;
    ouvrirModal(`<h2 style="margin-top:0">🔨 Vendre ${esc(c.nom)}</h2><div style="max-width:170px;margin:0 auto 10px">${cardHTML(c)}</div>
      <form class="form" id="fEnch"><label>Prix de départ (pièces)<input id="enchPrix" type="number" min="10" max="100000" value="${conseil}" required></label>
      ${doree ? `<label class="row" style="gap:8px"><input type="checkbox" id="enchDoree"> Vendre la version 👑 Dorée</label>` : ""}
      <p class="muted" style="margin:0;font-size:13px">Durée 24 h. La carte est mise de côté pendant la vente et vous est rendue s'il n'y a aucune offre. Taxe de 10 % sur le prix final.</p>
      <button class="btn primary">Mettre en vente</button></form>`);
    $("#fEnch").onsubmit = async (e) => {
      e.preventDefault();
      try {
        await envoyerSauvegarde();
        const vendDoree = !!$("#enchDoree")?.checked;
        await api("encheres", { methode: "POST", corps: { carte: id, prix: Number($("#enchPrix").value), doree: vendDoree } });
        S.owned[id] = Math.max(0, (S.owned[id] || 0) - 1);
        if (!S.owned[id]) { delete S.owned[id]; S.deck = S.deck.filter((x) => x !== id); }
        if (vendDoree) delete S.doree[id];
        sauver(); envoyerSauvegarde(); fermerModal(); toast("🔨 Votre carte est aux enchères pour 24 h !"); enchEtat.vue = "miennes"; aller("encheres");
      } catch (err) { toast("⚠ " + err.message); }
    };
  });
}
function encherir(id, minimum, nom) {
  ouvrirModal(`<h2 style="margin-top:0">🔨 Enchérir sur ${esc(nom)}</h2><form class="form" id="fOffre">
    <label>Votre offre (minimum ${fmt(minimum)} 🪙 · vous avez ${fmt(S.coins)} 🪙)<input id="offreMontant" type="number" min="${minimum}" value="${minimum}" required></label>
    <p class="muted" style="margin:0;font-size:13px">Les pièces sont mises de côté. Si quelqu'un enchérit plus, elles vous sont rendues automatiquement.</p>
    <button class="btn primary">Enchérir</button></form>`);
  $("#fOffre").onsubmit = async (e) => {
    e.preventDefault();
    const montant = Math.floor(Number($("#offreMontant").value));
    if (montant > S.coins) return toast("⚠ Vous n'avez pas assez de pièces.");
    try {
      await envoyerSauvegarde();
      await api(`encheres/${id}/offre`, { methode: "POST", corps: { montant } });
      S.coins -= montant; sauver(); majCoins(); envoyerSauvegarde();
      fermerModal(); toast(`🔨 Offre de ${fmt(montant)} 🪙 enregistrée : vous êtes en tête !`); aller("encheres");
    } catch (err) { toast("⚠ " + err.message); }
  };
}
ajouterPage("encheres", "🔨", "Enchères", vueEncheres);
// Les ventes, surenchères et cartes rendues arrivent par « livraisons »
setInterval(() => { if (connecte() && !document.hidden) verifierLivraisons(); }, 60000);

/* =====================================================================
   Expédition : traverser chaque continent pays par pays (quiz ou combat), avec un boss au bout
   ===================================================================== */
const expEtat = { cont: "EU" };
// Les pays d'un continent, d'ouest en est (longitude moyenne de leurs cartes), puis le boss
function parcours(k) {
  const lon = (p) => { const l = cartesDuPays(p.code).filter((c) => Number.isFinite(c.lon)); return l.length ? l.reduce((s, c) => s + c.lon, 0) / l.length : 0; };
  const pays = of("monde", "pays").filter((p) => p.continent === k).map((p) => ({ p, x: lon(p) })).sort((a, b) => a.x - b.x || a.p.nom.localeCompare(b.p.nom)).map((x) => x.p);
  return pays.map((p, i) => ({ p, i, mode: i % 2 ? "combat" : "quiz" })).concat([{ boss: true, i: pays.length, mode: "boss" }]);
}
const progresExp = (k) => S.expedition?.[k] || { i: 0, fini: false };
function deckPaysExp(p, i, n) {
  const force = 0.72 + 0.48 * (i / Math.max(1, n - 1));
  const pool = cartesDuPays(p.code).filter((c) => c.type !== "secrete").sort((a, b) => coutDe(b) - coutDe(a) || COMBAT.hash(a.id) - COMBAT.hash(b.id));
  const l = pool.length >= 3 ? pool.slice(0, 3) : [...pool, ...of("monde", "pays").filter((c) => c.continent === p.continent && c.id !== p.id).slice(0, 3 - pool.length)];
  return { ia: i < n / 3 ? 1 : i < (2 * n) / 3 ? 2 : 3, lui: l.map((c) => { const st = COMBAT.stats(c.id, c.type, c.rarete, [0, 0, 0], 1, false); return { id: c.id, type: c.type, nom: c.nom, shiny: false, atk: Math.round(st.atk * force), def: Math.round(st.def * force), pv: Math.round(st.pv * force), niveau: 1, talent: st.talent }; }) };
}
function deckBossExp(k) {
  const l = CARDS.filter((c) => c.continent === k && c.type !== "secrete" && !c.saisonnier).sort((a, b) => coutDe(b) - coutDe(a) || COMBAT.hash(a.id) - COMBAT.hash(b.id)).slice(0, 3);
  return l.map((c) => { const st = COMBAT.stats(c.id, c.type, c.rarete, [0, 0, 0], 1, false); return { id: c.id, type: c.type, nom: c.nom, shiny: true, atk: Math.round(st.atk * 1.3), def: Math.round(st.def * 1.3), pv: Math.round(st.pv * 1.35), niveau: 1, talent: st.talent }; });
}
function avancerExp(k, etape) {
  const n = parcours(k).length - 1, pr = progresExp(k);
  let txt;
  if (etape.boss) {
    S.coins += 500; S.boosters.or = (S.boosters.or || 0) + 1;
    S.expedition = { ...(S.expedition || {}), [k]: { i: n + 1, fini: true } };
    txt = `👑 ${CONTINENTS[k].nom} conquis ! +500 🪙 · booster Or · titre « Expéditionnaire » débloqué`;
    gagnerXP(80);
  } else {
    const gain = etape.mode === "quiz" ? 15 + Math.floor(etape.i / 2) : 25 + etape.i;
    S.coins += gain; txt = `+${gain} 🪙`;
    if ((etape.i + 1) % 10 === 0) { S.boosters.monde = (S.boosters.monde || 0) + 1; txt += " · 🎁 booster Classique"; }
    S.expedition = { ...(S.expedition || {}), [k]: { i: Math.max(pr.i, etape.i + 1), fini: false } };
    gagnerXP(etape.mode === "quiz" ? 10 : 15);
  }
  sauver(); majCoins();
  return txt;
}
function quizPays(k, etape) {
  const p = etape.p, pays = of("monde", "pays"), voisins = pays.filter((x) => x.continent === p.continent);
  const autres = cartesDuPays(p.code).filter((c) => c.type !== "pays");
  const qs = [
    { q: `Quelle est la capitale de ce pays : ${p.nom} ?`, bonne: court(p.capitale), choix: options(court(p.capitale), voisins.map((x) => court(x.capitale))) },
    { q: "À quel pays appartient ce drapeau ?", media: `<img class="qflag" src="flags/${p.code.toLowerCase()}.svg" alt="Drapeau mystère">`, bonne: p.nom, choix: options(p.nom, voisins.map((x) => x.nom)) },
  ];
  if (autres.length) { const c = pick(autres); qs.push({ q: `Dans quel pays se trouve ou vient : ${c.nom} ?`, media: `<div class="qemoji">${c.emoji || EMOJI_TYPE[c.type]}</div>`, bonne: p.nom, choix: options(p.nom, voisins.map((x) => x.nom)) }); }
  else qs.push({ q: `Sur quel continent se trouve ${p.nom} ?`, bonne: CONTINENTS[p.continent].nom, choix: options(CONTINENTS[p.continent].nom, Object.values(CONTINENTS).map((x) => x.nom)) });
  let n = 0, bonnes = 0;
  const poser = () => {
    if (n >= qs.length) {
      const ok = bonnes >= 2;
      $("#modal .box").innerHTML = `<div style="text-align:center"><h2 style="margin-top:0">${ok ? "✅ Étape réussie !" : "❌ Raté…"}</h2><p>${bonnes}/3 bonnes réponses${ok ? " · " + avancerExp(k, etape) : " · il en faut 2 pour passer. Réessayez !"}</p><button class="btn primary" data-close>Continuer</button></div>`;
      $("#modal")._onClose = () => aller("expedition");
      return;
    }
    const Q = qs[n];
    $("#modal .box").innerHTML = `<div class="quiz"><div class="row" style="justify-content:space-between"><b>🧭 ${esc(p.nom)}</b><span class="muted">Question ${n + 1}/3</span></div>
      <div class="q">${esc(Q.q)}</div>${Q.media || ""}<div class="answers" style="margin-top:14px">${Q.choix.map((x) => `<button>${esc(x)}</button>`).join("")}</div><div class="feedback" id="fbExp"></div></div>`;
    $$("#modal .answers button").forEach((b) => b.onclick = () => {
      const bon = b.textContent === Q.bonne; if (bon) bonnes++;
      $$("#modal .answers button").forEach((x) => { x.disabled = true; if (x.textContent === Q.bonne) x.classList.add("good"); else if (x === b) x.classList.add("bad"); });
      $("#fbExp").textContent = bon ? "✅ Bonne réponse !" : `❌ C'était ${Q.bonne}`;
      son?.(bon ? "victoire" : "defaite");
      n++; setTimeout(poser, 1100);
    });
  };
  ouvrirModal(`<p class="muted">Chargement…</p>`); poser();
}
function lancerEtapeExp(k, etape) {
  if (etape.mode === "quiz") return quizPays(k, etape);
  if (!deckPret()) return;
  const n = parcours(k).length - 1;
  const adv = etape.boss ? { ia: 3, lui: deckBossExp(k) } : deckPaysExp(etape.p, etape.i, n);
  lancerCombat({
    titre: etape.boss ? `👑 Boss · ${CONTINENTS[k].nom}` : `🧭 Expédition · ${etape.p.nom}`, adversaire: etape.boss ? `le Gardien d'${CONTINENTS[k].nom}` : `les gardiens de ${etape.p.nom}`,
    ia: adv.ia, moi: S.deck.map((id) => uniteDe(BY_ID[id])), lui: adv.lui, graine: (Math.random() * 2 ** 32) >>> 0,
    fin: async (etat) => {
      const gagne = etat.gagnant === 0;
      if (gagne) S.combat.victoires++; else S.combat.defaites++;
      sauver();
      if (!gagne) return "Raté ! Améliorez votre deck et réessayez.";
      const txt = avancerExp(k, etape);
      $("#modal")._onClose = () => aller("expedition");
      return txt;
    },
  });
}
function vueExpedition(v) {
  const k = expEtat.cont, etapes = parcours(k), pr = progresExp(k), ct = CONTINENTS[k];
  v.innerHTML = `<section class="panel"><h2 style="margin:0 0 4px">🧭 Expédition</h2>
      <p class="muted" style="margin:0">Traversez chaque continent d'ouest en est, pays par pays : un quiz sur le pays ou un combat contre ses gardiens. Le boss du continent offre un booster Or et 500 🪙.</p></section>
    <div class="toolbar">${Object.entries(CONTINENTS).map(([c, x]) => { const pc = progresExp(c), tot = parcours(c).length; return `<button class="chip ${c === k ? "on" : ""}" data-cont="${c}">${x.emoji} ${x.nom} <small>${pc.fini ? "👑" : `${pc.i}/${tot}`}</small></button>`; }).join("")}</div>
    <div class="exp-chemin" style="--c:${ct.couleur}">${etapes.map((e) => {
      const fait = e.i < pr.i, actuel = e.i === pr.i && !pr.fini;
      return `<button class="exp-etape ${fait ? "faite" : ""} ${actuel ? "actuelle" : ""} ${e.boss ? "boss" : ""}" data-i="${e.i}" ${actuel ? "" : "disabled"}>
        ${e.boss ? `<span class="exp-ic">👑</span>` : `<img src="flags/${e.p.code.toLowerCase()}.svg" alt="" loading="lazy">`}
        <b>${e.boss ? `Boss ${ct.nom}` : esc(e.p.nom)}</b><small>${fait ? "✅" : actuel ? (e.mode === "quiz" ? "❓ Quiz · jouer" : e.mode === "boss" ? "⚔️ Boss · jouer" : "⚔️ Combat · jouer") : e.mode === "quiz" ? "❓ Quiz" : "⚔️ Combat"}</small></button>`;
    }).join("")}</div>`;
  $$("[data-cont]", v).forEach((b) => b.onclick = () => { expEtat.cont = b.dataset.cont; vueExpedition(v); });
  $$(".exp-etape.actuelle", v).forEach((b) => b.onclick = () => lancerEtapeExp(k, etapes[Number(b.dataset.i)]));
  v.querySelector(".exp-etape.actuelle")?.scrollIntoView({ block: "center" });
}
ajouterPage("expedition", "🧭", "Expédition", vueExpedition);


/* =====================================================================
   Paiement par carte (Stripe Checkout) : redirection vers la page sécurisée de Stripe, puis retour sur le site
   ===================================================================== */
async function brancherStripe(racine) {
  const boutons = $$("[data-stripe]", racine);
  $$("[data-portail]", racine).forEach((b) => b.onclick = async () => {
    b.disabled = true;
    try { location.href = (await api("stripe/portail", { methode: "POST", corps: {} })).url; } catch (e) { toast("⚠ " + e.message, 6000); b.disabled = false; }
  });
  if (!boutons.length || !connecte()) return;
  let config; try { config = await api("premium/config"); } catch { return; }
  if (!config.stripe) return;
  boutons.forEach((b) => {
    b.classList.remove("hidden");
    b.closest(".offre-premium")?.querySelector("[data-payer]")?.classList.add("secours");
    b.onclick = async () => {
      b.disabled = true; const texte = b.textContent; b.textContent = "Redirection vers Stripe…";
      try { location.href = (await api("stripe/checkout", { methode: "POST", corps: { formule: b.dataset.stripe } })).url; }
      catch (e) { toast("⚠ " + e.message, 6000); b.disabled = false; b.textContent = texte; }
    };
  });
}
// Retour de Stripe : on confirme le paiement auprès du serveur (qui vérifie tout chez Stripe)
addEventListener("DOMContentLoaded", async () => {
  const url = new URL(location.href), session = url.searchParams.get("stripe_session");
  if (url.searchParams.get("stripe") === "annule") { history.replaceState(null, "", location.pathname + location.hash); toast("Paiement annulé : aucun montant n'a été prélevé."); return; }
  if (!session) return;
  history.replaceState(null, "", location.pathname);
  for (let i = 0; i < 40 && !connecte(); i++) await pause(250); // le temps de retrouver la session du compte
  if (!connecte()) return toast("⚠ Connectez-vous pour activer votre achat, puis rouvrez le lien de retour.", 8000);
  for (let essai = 0; essai < 5; essai++) {
    try {
      const r = await api("stripe/valider", { methode: "POST", corps: { session } });
      if (r.formule === "pack") { await verifierCadeaux(); aller("boosters"); toast(`🛍️ ${esc(r.nomPack || "Pack")} livré : merci pour votre achat !`, 6000); return; }
      if (r.formule === "passe") { passeEtat.actif = true; ouvrirModal(`<div class="reveal"><div style="font-size:56px">🎟️</div><h2>Merci ! Votre passe de saison est actif.</h2><p>La piste Premium est débloquée : récupérez vos récompenses !</p><button class="btn primary" data-close>Voir mon passe</button></div>`, () => aller("passe")); }
      else { majPremium(r.premiumJusqu); COMPTE.stripe = true; majBoutonCompte(); ouvrirModal(`<div class="reveal"><div style="font-size:56px">💎</div><h2>Merci ! Votre Premium est activé.</h2><p>${r.formule === "vie" ? "Premium à vie : merci pour votre soutien !" : "Votre abonnement se renouvelle automatiquement ; vous pouvez le gérer depuis la page Premium."}</p><button class="btn primary" data-close>Super !</button></div>`, () => aller("premium")); }
      return;
    } catch (e) {
      if (e.status !== 402) return toast("⚠ " + e.message, 8000);
      await pause(2000); // paiement en cours de confirmation chez Stripe
    }
  }
  toast("⏳ Paiement en cours de confirmation : votre achat sera activé sous peu.", 8000);
});

/* =====================================================================
   Admin : Stripe et Supabase
   ===================================================================== */
async function adminIntegrations(el) {
  el.innerHTML = `<p class="muted">Chargement…</p>`;
  try {
    const r = await api("admin/integrations"), st = r.cles, d = r.supabase.derniere;
    const ligne = (nom, titre, aide, ph) => `<div class="panel integ">
      <div class="row" style="justify-content:space-between;gap:8px"><b>${titre}</b><span>${st[nom].configuree ? `✅ configurée (${st[nom].source === "Cloudflare" ? "variable Cloudflare" : "saisie ici"}) · <code>${esc(st[nom].apercu)}</code>` : "❌ pas encore configurée"}</span></div>
      <p class="muted" style="margin:6px 0">${aide}</p>
      ${st[nom].source === "Cloudflare" ? "" : `<div class="row" style="gap:6px"><input type="password" autocomplete="off" data-cle="${nom}" placeholder="${ph}" style="flex:1"><button class="btn primary" data-enr="${nom}">Enregistrer</button>${st[nom].configuree ? `<button class="btn" data-suppr="${nom}">Retirer</button>` : ""}</div>`}</div>`;
    el.innerHTML = `${ligne("STRIPE_SECRET_KEY", "💳 Stripe (paiement par carte)", "Stripe → Développeurs → Clés API → « Clé secrète » (sk_live_…) ou une clé restreinte (rk_live_…). Les 4 produits Stripe sont déjà reliés au site.", "sk_live_… ou rk_live_…")}
      ${ligne("SUPABASE_SECRET_KEY", "🗄️ Supabase (copie de sauvegarde)", `Supabase → projet « worldcards » → Project Settings → API Keys → « Secret keys » (sb_secret_…). Copie automatique toutes les 15 min vers ${esc(r.supabase.url)}.`, "sb_secret_…")}
      <div class="panel integ"><b>⚡ Webhook Stripe (prévenu à la seconde)</b>
        <p class="muted" style="margin:6px 0">Stripe → Développeurs → Webhooks → « Ajouter une destination » → URL : <code>${esc(location.origin)}/api/stripe/webhook</code>. Événements : <code>checkout.session.completed</code>, <code>customer.subscription.created</code>, <code>customer.subscription.updated</code>, <code>customer.subscription.deleted</code>, <code>invoice.paid</code>, <code>invoice.payment_failed</code>, <code>charge.refunded</code>, <code>charge.dispute.created</code>. Pas besoin de copier le « secret de signature » : chaque événement est relu directement chez Stripe.</p></div>
      <div class="panel"><b>📊 État</b><p style="margin:6px 0">${r.abonnementsActifs} abonnement(s) Stripe actif(s) · Dernière copie Supabase : ${d ? `${depuis(d.t)} (${Object.entries(d.n || {}).map(([k, v]) => `${v} ${k}`).join(", ") || "rien de neuf"})` : "jamais"}</p>
        <button class="btn primary" id="integTester">🔄 Tester Stripe et lancer une copie complète</button><div id="integRes" style="margin-top:8px"></div></div>
      <p class="muted" style="font-size:12.5px">Les clés sont gardées côté serveur et ne sont jamais renvoyées au navigateur (seul un aperçu masqué s'affiche). Pour plus de sécurité, vous pouvez aussi les mettre en « secrets » dans Cloudflare (Workers → coda → Settings → Variables) : elles sont alors prioritaires.</p>`;
    $$("[data-enr]", el).forEach((b) => b.onclick = async () => {
      const nom = b.dataset.enr, v = $(`[data-cle="${nom}"]`, el).value.trim(); if (!v) return;
      try { await api("admin/integrations", { methode: "POST", corps: { [nom]: v } }); toast("🔐 Clé enregistrée."); adminIntegrations(el); } catch (e) { toast("⚠ " + e.message, 6000); }
    });
    $$("[data-suppr]", el).forEach((b) => b.onclick = async () => { if (!confirm("Retirer cette clé ?")) return; await api("admin/integrations", { methode: "POST", corps: { [b.dataset.suppr]: "" } }); adminIntegrations(el); });
    $("#integTester").onclick = async () => {
      $("#integRes").textContent = "Test en cours…";
      try { const t = await api("admin/integrations/tester", { methode: "POST", corps: {} }); $("#integRes").innerHTML = `<div>${esc(t.stripe)}</div><div>${esc(t.supabase)}</div><div class="muted">${esc(t.abonnements)}</div>`; }
      catch (e) { $("#integRes").textContent = "⚠ " + e.message; }
    };
  } catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}

/* =====================================================================
   Soutenir le jeu : don libre sur PayPal, sans contrepartie
   ===================================================================== */
function vueSoutenir(v) {
  v.innerHTML = `<section class="panel soutenir">
      <div class="soutenir-coeur">❤️</div>
      <h1>Soutenir Play2F1</h1>
      <p>Play2F1 est gratuit et sans publicité. Si le jeu vous plaît, vous pouvez soutenir la chaîne et le projet avec un <b>don libre</b> sur PayPal, du montant de votre choix.</p>
      <p class="muted">Votre don aide à payer l'hébergement, à ajouter de nouvelles cartes et de nouveaux modes de jeu. C'est un don sans contrepartie : il ne débloque rien dans le jeu (pour les avantages, voir le Premium).</p>
      <a class="btn primary soutenir-btn" href="${PAYPAL}" target="_blank" rel="noopener">❤️ Faire un don sur PayPal</a>
      <p class="muted" style="font-size:13px;margin-bottom:0">Merci du fond du cœur pour votre soutien ! 🙏</p></section>`;
}
ajouterPage("soutenir", "❤️", "Soutenir", vueSoutenir);
addEventListener("DOMContentLoaded", () => {
  const liens = document.querySelector(".pied .liens");
  if (liens) { liens.insertAdjacentHTML("beforeend", ` · <a href="#" id="piedSoutenir">❤️ Soutenir le jeu</a>`); $("#piedSoutenir").onclick = (e) => { e.preventDefault(); aller("soutenir"); }; }
});

/* =====================================================================
   Boutique du jour : 6 cartes précises, renouvelées chaque jour, à pièces ou à poussière
   ===================================================================== */
const PRIX_BOUTIQUE = { "commun": [90, 30], "peu-commun": [180, 60], "rare": [450, 150], "epique": [1100, 380], "ultra-rare": [1800, 650], "legendaire": [2800, 1100] };
function boutiqueDuJour() {
  const r = COMBAT.rng(COMBAT.hash("boutique-" + today()));
  const pool = CARDS.filter((c) => c.univers === "monde" && c.type !== "secrete" && !c.saisonnier && PRIX_BOUTIQUE[c.rarete]);
  // 1 carte « vedette » épique ou mieux, puis des raretés variées
  const gammes = [["epique", "ultra-rare", "legendaire"], ["rare", "epique"], ["rare"], ["peu-commun", "rare"], ["peu-commun"], ["commun", "peu-commun"]];
  const choix = [];
  for (const g of gammes) {
    const l = pool.filter((c) => g.includes(c.rarete) && !choix.includes(c));
    choix.push(l[Math.floor(r() * l.length)]);
  }
  return choix.filter(Boolean);
}
function blocBoutiqueDuJour() {
  const achats = S.boutiqueJour?.jour === today() ? S.boutiqueJour.achats : [];
  const fin = new Date(); fin.setHours(24, 0, 0, 0);
  return `<div class="panel boutique-jour"><div class="row" style="justify-content:space-between;gap:8px"><h3 style="margin:0">🛒 Boutique du jour</h3><small class="muted">Nouvelles cartes dans ${duree(fin - Date.now())}</small></div>
    <p class="muted" style="margin:4px 0 10px">6 cartes choisies pour aujourd'hui : achetez celle qui vous manque, en pièces ou en ✨ poussière (vous avez ${fmt(S.poussiere || 0)} ✨).</p>
    <div class="bj-grille">${boutiqueDuJour().map((c, k) => {
      const [pc, pp] = PRIX_BOUTIQUE[c.rarete], pris = achats.includes(c.id);
      return `<div class="bj-carte ${k === 0 ? "vedette" : ""}">${k === 0 ? `<span class="bj-ruban">⭐ Vedette</span>` : ""}${cardHTML(c, { locked: false })}${has(c.id) ? `<small class="bj-deja">✓ déjà dans votre collection</small>` : `<small class="bj-deja neuve">✨ nouvelle pour vous</small>`}
        ${pris ? `<div class="bj-pris">✅ Acheté</div>` : `<div class="bj-prix"><button class="btn small primary" data-bj="${c.id}" data-m="pieces" ${S.coins < pc ? "disabled" : ""}>${fmt(pc)} 🪙</button><button class="btn small" data-bj="${c.id}" data-m="poussiere" ${(S.poussiere || 0) < pp ? "disabled" : ""}>${fmt(pp)} ✨</button></div>`}</div>`;
    }).join("")}</div></div>`;
}
function brancherBoutiqueDuJour(racine) {
  $$("[data-bj]", racine).forEach((b) => b.onclick = (e) => {
    e.stopPropagation();
    const c = BY_ID[b.dataset.bj], [pc, pp] = PRIX_BOUTIQUE[c.rarete], parPieces = b.dataset.m === "pieces";
    if (!boutiqueDuJour().includes(c)) return toast("Cette offre a expiré : la boutique a changé.");
    if (parPieces ? S.coins < pc : (S.poussiere || 0) < pp) return toast("⚠ Pas assez de " + (parPieces ? "pièces." : "poussière."));
    confirmer(`Acheter « ${c.nom} » pour ${parPieces ? fmt(pc) + " 🪙" : fmt(pp) + " ✨"} ?`, "Acheter", () => {
      if (parPieces) S.coins -= pc; else S.poussiere -= pp;
      gagner(c.id);
      S.boutiqueJour = { jour: today(), achats: [...(S.boutiqueJour?.jour === today() ? S.boutiqueJour.achats : []), c.id] };
      sauver(); majCoins(); fermerModal(); verifierProgression();
      toast(`🛒 <b>${esc(c.nom)}</b> ajoutée à votre collection !`); aller("boosters");
    });
  });
}
const _vueBoosters = vueBoosters;
vueBoosters = function (v, opts) {
  _vueBoosters(v, opts);
  // Série de cartes du mois, en haut de la boutique
  const cleSaison = "saison-" + MOIS_SAISON, ps = PACKS[cleSaison], sa = SAISONS[MOIS_SAISON];
  if (ps) {
    const fin = new Date(Date.UTC(+MOIS_SAISON.slice(0, 4), +MOIS_SAISON.slice(5, 7), 1));
    const cartes = CARDS.filter((c) => c.saisonnier === cleSaison), animee = cartes.find((c) => c.animee);
    const html = `<section class="panel serie-mois" style="--sc:${sa.couleur}">
      <div class="serie-texte"><small>🗓️ SÉRIE DU MOIS · encore ${Math.max(1, Math.ceil((fin - Date.now()) / 86400000))} jours</small>
        <h3>${sa.emoji} ${esc(sa.nom)}</h3>
        <p>${cartes.length} cartes exclusives, disponibles seulement ce mois-ci · vous en avez <b>${count(cartes.map((c) => c.id))}/${cartes.length}</b>. La carte <b>animée</b> « ${esc(animee?.nom || "")} » est la plus rare !</p>
        <button class="btn primary" id="acheterSaison" ${S.coins < ps.prix ? "disabled" : ""}>Booster ${esc(sa.nom)} · ${fmt(ps.prix)} 🪙</button></div>
      ${animee ? `<div class="serie-carte">${cardHTML(animee, { locked: false })}</div>` : ""}</section>`;
    const ancre = $(".pity-box", v);
    if (ancre) ancre.insertAdjacentHTML("beforebegin", html); else v.insertAdjacentHTML("afterbegin", html);
    $("#acheterSaison", v)?.addEventListener("click", () => {
      if (S.coins < ps.prix) return;
      S.coins -= ps.prix; S.boosters[cleSaison] = (S.boosters[cleSaison] || 0) + 1; sauver(); majCoins(); toast(`🎁 Booster ajouté à vos boosters !`); aller("boosters");
    });
  }
  const ancre = $(".pity-box", v);
  if (ancre) ancre.insertAdjacentHTML("afterend", blocBoutiqueDuJour()); else v.insertAdjacentHTML("beforeend", blocBoutiqueDuJour());
  brancherBoutiqueDuJour(v);
};

/* =====================================================================
   Parrainage : le code est le pseudo du parrain ; booster + 200 🪙 pour les deux au niveau 5 du filleul
   ===================================================================== */
(() => { // lien de parrainage : https://…/?parrain=Pseudo
  const p = new URL(location.href).searchParams.get("parrain");
  if (p && /^[A-Za-z0-9_-]{3,20}$/.test(p)) { try { localStorage.setItem("worldcards:parrain", p); } catch {} history.replaceState(null, "", location.pathname + location.hash); }
})();
async function vueParrainage(v) {
  if (!connecte()) { v.innerHTML = `<div class="panel"><h2 style="margin-top:0">🤝 Parrainage</h2><p>Créez un compte pour obtenir votre lien de parrainage : vous et votre ami recevez chacun <b>un booster + 200 🪙</b> quand il atteint le niveau 5.</p><button class="btn primary" data-aller="compte">Créer un compte</button></div>`; brancherLiens(v); return; }
  v.innerHTML = `<p class="muted">Chargement…</p>`;
  try {
    const r = await api("parrainage"), lien = `${location.origin}/r/${encodeURIComponent(r.code)}`;
    const valides = r.filleuls.filter((f) => f.valide).length;
    v.innerHTML = `<section class="panel parrain-tete"><div style="font-size:52px">🤝</div>
        <h2 style="margin:4px 0">Invitez vos amis</h2>
        <p>Quand votre ami atteint le <b>niveau 5</b>, vous recevez <b>chacun un booster + 200 🪙</b> (jusqu'à ${r.max} amis).</p>
        <div class="lien-parrain"><input readonly value="${esc(lien)}" id="lienParrain"><button class="btn primary" id="copierParrain">📋 Copier</button>${navigator.share ? `<button class="btn" id="partagerParrain">📤 Partager</button>` : ""}</div>
        <p class="muted" style="margin-bottom:0">Votre code : <b>${esc(r.code)}</b> (votre pseudo) · ${r.filleuls.length} filleul(s), ${valides} récompensé(s)</p></section>
      ${r.peutAjouter ? `<form class="panel row" id="fParrain" style="gap:8px"><span style="flex:1;min-width:180px">Un ami vous a invité ? Entrez son code (7 jours après l'inscription) :</span><input id="codeParrain" maxlength="20" placeholder="Pseudo du parrain" required><button class="btn primary">Valider</button></form>`
        : r.parrain ? `<div class="panel">👤 Votre parrain : <b>${esc(r.parrain)}</b> · ${r.recompense ? "✅ récompense reçue" : "atteignez le niveau 5 pour votre booster !"}</div>` : ""}
      <h3>Mes filleuls</h3>${r.filleuls.length ? `<div class="amis">${r.filleuls.map((f) => `<div class="ami">${avatarHTML(f.pseudo, "", null)}<div class="ami-infos"><b>${esc(f.pseudo)}</b><small class="muted">inscrit ${depuis(f.depuis)} · ${f.valide ? "✅ niveau 5 atteint" : "⏳ pas encore niveau 5"}</small></div></div>`).join("")}</div>` : `<p class="muted">Personne pour l'instant : partagez votre lien !</p>`}`;
    $("#copierParrain").onclick = async () => { try { await navigator.clipboard.writeText(lien); toast("📋 Lien copié !"); } catch { $("#lienParrain").select(); } };
    $("#partagerParrain")?.addEventListener("click", () => navigator.share({ title: "Play2F1", text: "Rejoins-moi sur Play2F1, le jeu de cartes du monde entier ! On gagne chacun un booster 🎁", url: lien }).catch(() => {}));
    $("#fParrain")?.addEventListener("submit", async (e) => { e.preventDefault(); try { await api("parrainage", { methode: "POST", corps: { code: $("#codeParrain").value } }); toast("🤝 Parrain enregistré ! Atteignez le niveau 5 pour votre booster."); vueParrainage(v); } catch (err) { toast("⚠ " + err.message); } });
  } catch (e) { v.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}
ajouterPage("parrainage", "🤝", "Parrainage", vueParrainage);

/* =====================================================================
   Admin : tableau de bord des ventes
   ===================================================================== */
const euros = (n) => (Number(n) || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const LIBELLES_EVT = { "checkout.session.completed": "💳 Achat", "customer.subscription.created": "🆕 Abonnement", "customer.subscription.updated": "🔄 Abonnement modifié", "customer.subscription.deleted": "📉 Résiliation", "invoice.paid": "✅ Renouvellement", "invoice.payment_failed": "⚠️ Paiement refusé", "charge.refunded": "↩️ Remboursement", "charge.dispute.created": "🚨 Litige" };
async function adminVentes(el) {
  el.innerHTML = `<p class="muted">Chargement…</p>`;
  try {
    const r = await api("admin/ventes");
    const max = Math.max(1, ...r.historique.map((h) => h.total));
    const nomMoisCourt = (m) => new Date(m + "-15T12:00").toLocaleDateString("fr-FR", { month: "short" });
    const tuile = (titre, valeur, sous = "") => `<div class="kpi"><small>${titre}</small><b>${valeur}</b>${sous ? `<span>${sous}</span>` : ""}</div>`;
    el.innerHTML = `<div class="kpis">
        ${tuile("Ventes ce mois-ci", euros(r.mois.total), `${r.mois.ventes} paiement(s)`)}
        ${tuile("Revenu mensuel récurrent", euros(r.mrr), "abonnements actifs")}
        ${tuile("Abonnés actifs", (r.abonnesActifs.mois || 0) + (r.abonnesActifs.an || 0) + (r.abonnesActifs.passe || 0), `${r.abonnesActifs.mois || 0} mensuel · ${r.abonnesActifs.an || 0} annuel · ${r.abonnesActifs.passe || 0} passe`)}
        ${tuile("Joueurs Premium", r.premiumsActifs, `dont ${r.premiumsVie} à vie`)}
        ${tuile("Résiliations (mois)", r.problemes["customer.subscription.deleted"] || 0, `${r.problemes["invoice.payment_failed"] || 0} paiement(s) refusé(s)`)}
        ${tuile("Remboursements (mois)", r.problemes["charge.refunded"] || 0, `${r.problemes["charge.dispute.created"] || 0} litige(s)`)}
      </div>
      <div class="panel"><h3 style="margin-top:0">📈 Ventes des 6 derniers mois</h3>
        ${r.historique.length ? `<div class="barres">${r.historique.map((h) => `<div class="barre"><span class="val">${euros(h.total)}</span><i style="height:${Math.max(4, (h.total / max) * 100)}%"></i><small>${nomMoisCourt(h.mois)}</small></div>`).join("")}</div>` : `<p class="muted">Pas encore de vente.</p>`}</div>
      <div class="grid2">
        <div class="panel"><h3 style="margin-top:0">🧾 Ce mois-ci par formule</h3>${r.parFormule.length ? `<table class="classement"><tbody>${r.parFormule.map((x) => `<tr><td>${esc(libelleFormule(x.formule))}</td><td>${x.source === "stripe" ? "💳 Stripe" : "🅿️ PayPal"}</td><td>${x.n}</td><td><b>${euros(x.total)}</b></td></tr>`).join("")}</tbody></table>` : `<p class="muted">Aucune vente ce mois-ci.</p>`}</div>
        <div class="panel"><h3 style="margin-top:0">⚡ Derniers événements Stripe</h3>${r.evenements.length ? `<div class="evts">${r.evenements.map((e) => `<div><span>${LIBELLES_EVT[e.type] || esc(e.type)}</span> <b>${esc(e.pseudo || "")}</b> <small class="muted">${esc(e.resume || "")} · ${depuis(e.cree_le)}</small></div>`).join("")}</div>` : `<p class="muted">Aucun événement reçu : vérifiez que le webhook Stripe est ajouté (voir l'onglet 🔌 Intégrations).</p>`}</div>
      </div>
      <p class="muted" style="font-size:12.5px">Les ventes PayPal comptent dès que vous les activez dans l'onglet 💎 Premium. Copie Supabase : ${r.supabase ? depuis(r.supabase.t) : "pas encore faite"}.</p>`;
  } catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}


/* ---------- Raid de guilde ---------- */
async function afficherRaid(el) {
  el.innerHTML = `<p class="muted">Chargement du raid…</p>`;
  try {
    const r = await api("raid");
    const pct = Math.min(100, (r.degats / r.pv) * 100), reste = Math.max(0, r.pv - r.degats);
    el.innerHTML = `<section class="raid-boss ${r.vaincu ? "vaincu" : ""}">
        <div class="raid-emoji">${r.boss.emoji}</div>
        <div style="flex:1;min-width:0"><small>RAID DE LA SEMAINE · fin ${new Date(r.finLe).toLocaleDateString("fr-FR", { weekday: "long" })}</small>
          <h2>${esc(r.boss.nom)}</h2>
          <div class="raid-pv"><i style="width:${100 - pct}%"></i><span>${r.vaincu ? "💀 VAINCU !" : `❤️ ${fmt(reste)} / ${fmt(r.pv)}`}</span></div>
          <small>${fmt(r.degats)} dégâts infligés par la guilde · ${Math.round(pct)} %</small></div></section>
      <div class="row" style="gap:8px;margin:12px 0;flex-wrap:wrap">
        ${r.vaincu ? (r.recompenseRecue ? `<span class="panel" style="margin:0">✅ Récompense de raid récupérée</span>` : `<button class="btn primary" id="raidRecompense" ${r.aParticipe ? "" : "disabled title=\"Il faut avoir attaqué au moins une fois\""}>🎁 Récupérer : booster Or + 400 🪙</button>`)
          : `<button class="btn primary" id="raidAttaque" ${r.restantes ? "" : "disabled"}>⚔️ Attaquer le boss (${r.restantes}/3 aujourd'hui)</button>`}
        <span class="muted">Chaque attaque est un combat contre les 3 gardiens du boss (très résistants) : tous les dégâts infligés comptent, même en cas de défaite !</span></div>
      <div class="panel"><h3 style="margin-top:0">🏆 Dégâts de la guilde</h3>${r.classement.length ? `<table class="classement"><tbody>${r.classement.map((x, i) => `<tr class="${x.pseudo === COMPTE.pseudo ? "moi" : ""}"><td>${["🥇", "🥈", "🥉"][i] || i + 1}</td><td>${esc(x.pseudo)}</td><td><b>${fmt(x.degats)}</b></td><td class="muted">${x.attaques} attaque(s)</td></tr>`).join("")}</tbody></table>` : `<p class="muted">Personne n'a encore attaqué : à vous de commencer !</p>`}</div>`;
    $("#raidAttaque")?.addEventListener("click", () => attaquerRaid(el));
    $("#raidRecompense")?.addEventListener("click", async () => {
      try { const x = await api("raid/recompense", { methode: "POST", corps: {} }); S.boosters[x.booster] = (S.boosters[x.booster] || 0) + 1; S.coins += x.pieces; sauver(); majCoins(); toast("🎁 Booster Or + 400 🪙 : bravo à toute la guilde !"); afficherRaid(el); }
      catch (e) { toast("⚠ " + e.message); }
    });
  } catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}
async function attaquerRaid(el) {
  if (!deckPret()) return;
  try {
    await envoyerDeckArene();
    const d = await api("raid/attaque", { methode: "POST", corps: {} });
    lancerCombat({
      titre: `🐉 Raid · ${d.boss}`, adversaire: d.boss, ia: d.ia, moi: d.moi, lui: d.lui, graine: d.graine,
      fin: async (etat) => {
        const r = await api("raid/fin", { methode: "POST", corps: { attaque: d.attaque, actions: etat.journal } });
        $("#modal")._onClose = () => { guildeEtat.onglet = "raid"; aller("guilde"); };
        return `💥 ${fmt(r.degats)} dégâts infligés · le boss a encore ${fmt(Math.max(0, r.pv - r.total))} PV${r.vaincu ? " · 💀 BOSS VAINCU !" : ""}`;
      },
    });
  } catch (e) { toast("⚠ " + e.message); }
}

/* =====================================================================
   Tournoi en direct du samedi soir
   ===================================================================== */
const samediEtat = { minuteur: null };
const NOMS_TOURS = (n) => ({ 1: "Finale", 2: "Demi-finales", 4: "Quarts de finale", 8: "Huitièmes de finale" }[n] || `Manche (${n} matchs)`);
async function vueSamedi(v) {
  clearInterval(samediEtat.minuteur);
  v.innerHTML = `<p class="muted">Chargement…</p>`;
  try {
    const r = await api("samedi");
    const depart = new Date(r.depart), t = r.tableau;
    const compte = (cible) => { const s = Math.max(0, Math.floor((cible - Date.now()) / 1000)); const j = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60); return s <= 0 ? "maintenant" : `${j ? j + " j " : ""}${h} h ${String(m).padStart(2, "0")} min ${j ? "" : String(s % 60).padStart(2, "0") + " s"}`; };
    v.innerHTML = `<section class="samedi-tete">
        <div class="samedi-ic">🏆</div>
        <div style="flex:1;min-width:0"><small>TOURNOI EN DIRECT · CHAQUE SAMEDI À 20 H</small>
          <h2>${r.statut === "fini" ? `Champion : ${esc(t?.champion || "")} 👑` : r.statut === "encours" ? "Le tournoi est en cours !" : r.statut === "annule" ? "Tournoi annulé (pas assez d'inscrits)" : `Départ ${depart.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} à 20 h`}</h2>
          <span id="samediCompte">${r.statut === "inscriptions" ? `⏱️ dans ${compte(r.depart)}` : r.statut === "encours" ? `⏱️ prochaine manche dans ${compte(r.prochainTour)}` : ""}</span></div></section>
      <div class="grid2" style="margin:12px 0">
        <div class="panel"><b>📝 Inscriptions</b><p style="margin:6px 0">${r.inscrits} inscrit(s) · tableau de 4, 8 ou 16 joueurs (les meilleurs en trophées d'arène si plus de 16). Votre <b>deck d'arène</b> combat pour vous, une manche toutes les 15 minutes.</p>
          ${r.statut !== "inscriptions" ? "" : !connecte() ? `<button class="btn primary" data-aller="compte">Se connecter pour s'inscrire</button>`
            : r.inscrit ? `<span>✅ Vous êtes inscrit !</span> <button class="btn small" id="samediDesinscrire">Se désinscrire</button> <button class="btn small" id="samediDeck">🔄 Mettre à jour mon deck</button>` : `<button class="btn primary" id="samediInscrire">✍️ M'inscrire avec mon deck</button>`}</div>
        <div class="panel"><b>🎁 Lots</b><ul class="lots">${Object.entries(r.lots).map(([pl, [pc, bo, msg]]) => `<li>${["", "🥇", "🥈", "🥉", "🎖️", "🎗️"][pl]} ${esc(msg.replace(/ du tournoi du samedi.*$/, "").replace(/^[^\p{L}]+/u, ""))} : <b>${fmt(pc)} 🪙</b>${bo ? ` + ${bo} booster${bo > 1 ? "s" : ""}` : ""}</li>`).join("")}</ul></div></div>
      ${t ? `<div class="panel"><h3 style="margin-top:0">📋 Tableau</h3><div class="tableau-tournoi">${t.tours.map((tour, k) => `<div class="colonne-tour"><b>${NOMS_TOURS(tour.length)}</b>${tour.map((m, i) => {
          const nom = (x) => `<span class="${m.joue && m.gagnant === x ? "gagnant" : m.joue ? "perdant" : ""} ${t.joueurs[x].pseudo === COMPTE.pseudo ? "moi" : ""}">${esc(t.joueurs[x].pseudo)}</span>`;
          return `<div class="match-tournoi">${nom(m.a)}${nom(m.b)}${m.joue ? `<button class="btn small" data-match="${k}-${i}">▶ Regarder</button>` : `<small class="muted">à venir</small>`}</div>`;
        }).join("")}</div>`).join("")}</div></div>` : ""}
      ${COMPTE.admin ? `<div class="panel row" style="gap:6px;flex-wrap:wrap"><b>👑 Admin :</b><button class="btn small" data-sa="lancer">Lancer maintenant</button><button class="btn small" data-sa="manche">Jouer la manche suivante</button><button class="btn small" data-sa="reinitialiser">Réinitialiser</button></div>` : ""}`;
    brancherLiens(v);
    const inscrire = async () => { if (!deckPret()) return; try { await envoyerDeckArene(); await api("samedi/inscription", { methode: "POST", corps: {} }); toast("✍️ Inscrit au tournoi du samedi ! Rendez-vous à 20 h."); vueSamedi(v); } catch (e) { toast("⚠ " + e.message); } };
    $("#samediInscrire")?.addEventListener("click", inscrire);
    $("#samediDeck")?.addEventListener("click", inscrire);
    $("#samediDesinscrire")?.addEventListener("click", async () => { try { await api("samedi/inscription", { methode: "DELETE" }); vueSamedi(v); } catch (e) { toast("⚠ " + e.message); } });
    $$("[data-sa]", v).forEach((b) => b.onclick = async () => { try { const x = await api("admin/samedi", { methode: "POST", corps: { action: b.dataset.sa } }); if (x.statut === "annule") toast("Annulé : il faut au moins 4 inscrits."); vueSamedi(v); } catch (e) { toast("⚠ " + e.message); } });
    $$("[data-match]", v).forEach((b) => b.onclick = () => regarderMatch(...b.dataset.match.split("-")));
    samediEtat.minuteur = setInterval(() => {
      if (S.vue !== "samedi" || !document.body.contains(v)) return clearInterval(samediEtat.minuteur);
      const el = $("#samediCompte"); if (!el) return;
      if (r.statut === "inscriptions") el.textContent = `⏱️ dans ${compte(r.depart)}`;
      else if (r.statut === "encours") { el.textContent = `⏱️ prochaine manche dans ${compte(r.prochainTour)}`; if (Date.now() > r.prochainTour + 20000) { clearInterval(samediEtat.minuteur); vueSamedi(v); } }
    }, 1000);
  } catch (e) { v.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}
// Rediffusion d'un match : les actions enregistrées sont rejouées à l'identique, en accéléré
async function regarderMatch(tour, match) {
  try {
    const m = await api(`samedi/match/${tour}/${match}`);
    lancerCombat({
      titre: `🏆 ${m.a} contre ${m.b}`, adversaire: m.b, moi: m.deckA, lui: m.deckB, graine: m.graine, spectateur: true,
      duel: { cote: 0, resteMs: 600000, abandon: async () => {}, tours: async (t) => (m.paires[t - 1] ? [m.paires[t - 1]] : [["attaque", "attaque"]]) },
      fin: async () => `🏆 ${m.gagnant === 0 ? m.a : m.b} remporte le match !`,
    });
    setTimeout(() => $("#cbAuto")?.click(), 600);
  } catch (e) { toast("⚠ " + e.message); }
}
ajouterPage("samedi", "🏆", "Tournoi du samedi", vueSamedi);
