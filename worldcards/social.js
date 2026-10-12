"use strict";
/* Fonctions sociales et de progression : duels en direct, guildes, connexion quotidienne, passe de saison,
   personnalisation, expédition, enchères et statistiques. Chargé après extras.js. */

/* =====================================================================
   Duels en direct entre amis
   ===================================================================== */
const duelEtat = { attente: null, vues: new Set() };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function defierEnDirect(pseudo) {
  if (!connecte()) return toast("Connectez-vous pour défier vos amis.");
  if (!deckPret()) return;
  try {
    await envoyerDeckArene();
    const { id } = await api("duels/inviter", { methode: "POST", corps: { pseudo } });
    ouvrirModal(`<div style="text-align:center"><h2 style="margin-top:0">⚡ Duel en direct</h2>
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
    titre: `⚡ Duel en direct contre ${v.adversaire}`, adversaire: v.adversaire, moi: v.deckA, lui: v.deckB, graine: v.graine,
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
          ouvrirModal(`<div style="text-align:center"><h2 style="margin-top:0">${r.gagne ? "🏆 Victoire !" : "💀 Défaite"}</h2><p>${r.gagne ? `${esc(v.adversaire)} a abandonné le duel.` : "Le duel est terminé."}${r.pieces ? ` +${r.pieces} 🪙` : ""}</p><button class="btn primary" data-close>Continuer</button></div>`);
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
      return `Duel contre ${v.adversaire}${r?.pieces ? ` · +${r.pieces} 🪙` : " · (récompense : 10 duels par jour, 3 tours minimum)"}`;
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
      <p><b>${esc(inv.pseudo)}</b> vous défie en direct. Chacun choisit son action à chaque tour (20 s).</p>
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
  t.insertAdjacentHTML("beforeend", `<button class="tuile" id="tuileStats"><span class="t-ic">📊</span><span class="t-txt"><b>Statistiques</b><small>Ma progression en détail</small></span></button>`);
  $("#tuileCal").onclick = ouvrirCalendrier;
  $("#tuileStats").onclick = () => aller("stats");
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
      <div class="toolbar">${[["membres", "👥 Membres"], ["discussion", "💬 Salon de guilde"], ["classement", "🏆 Classement des guildes"]].map(([k, l]) => `<button class="chip ${guildeEtat.onglet === k ? "on" : ""}" data-go="${k}">${l}</button>`).join("")}</div>
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
      : connecte() ? `<div class="panel passe-achat"><div><b>🔓 Débloquez la piste Premium — 7,99 €</b><br><small class="muted">Cadre et dos de cartes exclusifs, titre « ${esc(nomTitre(`passe-${p.mois}-elite`))} », cartes épiques, boosters Or et Prestige… Valable jusqu'à la fin du mois.</small></div>
        <div class="row" style="gap:8px;flex-wrap:wrap"><a class="btn primary premium" href="${PAYPAL}/7.99EUR" target="_blank" rel="noopener" id="passePayer">Payer 7,99 € avec PayPal</a><button class="btn" id="passeDemande">✅ J'ai payé</button></div>
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
  if (!actif && connecte()) brancherPaypal();
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
