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
          if (r.pieces) { S.coins += r.pieces; sauver(); majCoins(); }
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
      if (r?.gagne) S.combat.victoires++; else S.combat.defaites++;
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
