"use strict";
/* Mode Combat : deck de 3 cartes, entraînement contre l'ordinateur et arène en ligne contre les decks des autres joueurs.
   Le moteur (combat.js) est partagé avec le serveur, qui rejoue chaque combat d'arène pour vérifier le résultat. */

const DIFFICULTES = {
  facile: { nom: "Facile", emoji: "🌱", force: 0.88, gain: 15 },
  normal: { nom: "Normal", emoji: "⚔️", force: 1, gain: 30 },
  difficile: { nom: "Difficile", emoji: "🔥", force: 1.1, gain: 50 },
};
const limiteRecompenses = () => (premium() ? 30 : 15);
const recompensesFaites = () => (S.combat.jour === today() ? S.combat.recompenses : 0);
const coutDeck = (ids) => ids.reduce((s, id) => s + coutDe(BY_ID[id]), 0);
const uniteDe = (c) => ({ id: c.id, type: c.type, nom: c.nom, shiny: !!S.shiny?.[c.id], ...statsDe(c) });
let combatTimers = [];
function arreterCombat() { combatTimers.forEach(clearTimeout); combatTimers = []; }

// Le meilleur deck possible dans le budget (essaie les meilleures cartes de chaque coût)
function deckAuto() {
  const miennes = CARDS.filter((c) => has(c.id)).map((c) => ({ c, p: puissanceDe(c), k: coutDe(c) })).sort((a, b) => b.p - a.p).slice(0, 45);
  let meilleur = null;
  for (let i = 0; i < miennes.length; i++) for (let j = i + 1; j < miennes.length; j++) for (let k = j + 1; k < miennes.length; k++) {
    const t = [miennes[i], miennes[j], miennes[k]];
    if (t.reduce((s, x) => s + x.k, 0) > COMBAT.BUDGET) continue;
    const p = t.reduce((s, x) => s + x.p, 0);
    if (!meilleur || p > meilleur.p) meilleur = { p, ids: t.map((x) => x.c.id) };
  }
  return meilleur?.ids || miennes.slice(0, 3).map((x) => x.c.id);
}

function vueCombat(v) {
  const deck = S.deck.map((id) => BY_ID[id]).filter(Boolean);
  const cout = coutDeck(S.deck);
  const complet = deck.length === COMBAT.TAILLE_DECK;
  const puissance = deck.reduce((s, c) => s + puissanceDe(c), 0);
  v.innerHTML = `
    <div class="sectiontitle"><h3>⚔️ Combat</h3><span class="muted">Ville bat Monument · Monument bat Pays · Pays bat Ville (+12 % de dégâts)</span></div>
    <div class="panel">
      <div class="row" style="justify-content:space-between">
        <h3 style="margin:0">Mon deck</h3>
        <div class="row"><span class="budget ${cout > COMBAT.BUDGET ? "trop" : ""}">Coût ${cout}/${COMBAT.BUDGET}</span><span class="muted">Puissance ${fmt(puissance)}</span>
        <button class="btn small" id="dAuto">✨ Deck automatique</button></div>
      </div>
      <div class="cards deck" data-noclick>${[0, 1, 2].map((i) => deck[i]
        ? `<div class="slotcarte" data-slot="${i}">${cardHTML(deck[i])}<span class="cout">Coût ${coutDe(deck[i])}</span></div>`
        : `<button class="slot" data-slot="${i}">＋<small>Choisir une carte</small></button>`).join("")}</div>
      <p class="muted" style="margin-bottom:0;font-size:13.5px">3 cartes, ${COMBAT.BUDGET} points de coût au maximum : commune 1, peu commune 2, rare 3, épique 4, ultra rare 5, légendaire et secrète 6. Les cartes combattent dans l'ordre. Touchez une carte pour la changer.</p>
    </div>
    <div class="grid2" style="margin-top:16px">
      <div class="panel">
        <h3 style="margin-top:0">🤖 Entraînement</h3>
        <p class="muted" style="margin-top:0">Contre l'ordinateur, avec un deck de même puissance. Récompenses : ${recompensesFaites()}/${limiteRecompenses()} combats récompensés aujourd'hui.</p>
        <div class="row">${Object.entries(DIFFICULTES).map(([k, d]) => `<button class="btn ${k === "normal" ? "primary" : ""}" data-diff="${k}" ${complet ? "" : "disabled"}>${d.emoji} ${d.nom} · +${d.gain} 🪙</button>`).join("")}</div>
        <p class="muted" style="font-size:13px;margin-bottom:0">Victoires : ${S.combat.victoires} · Défaites : ${S.combat.defaites}</p>
      </div>
      <div class="panel" id="areneBloc"><h3 style="margin-top:0">🏟️ Arène en ligne</h3><p class="muted">Chargement…</p></div>
    </div>
    <div class="panel" style="margin-top:16px">
      <h3 style="margin-top:0">Comment ça marche ?</h3>
      <ul class="regles">
        <li><b>⚔️ Attaque</b> : dégâts selon votre attaque et la défense adverse.</li>
        <li><b>✨ Spécial</b> : 1,7 fois plus de dégâts, une seule fois par carte.</li>
        <li><b>🛡️ Garde</b> : vous ne subissez que 40 % des dégâts ce tour-ci et regagnez 8 % de vos points de vie.</li>
        <li>La carte la plus rapide (attaque élevée) frappe en premier. 15 % de coups critiques, 12 % d'esquives.</li>
        <li>Deux exemplaires d'une même carte n'ont pas les mêmes statistiques (de -8 % à +8 %). Les doublons font monter de niveau (+2 % par niveau) et peuvent améliorer vos statistiques.</li>
      </ul>
    </div>`;
  $$("[data-slot]", v).forEach((el) => el.onclick = () => choisirPourDeck(Number(el.dataset.slot)));
  $("#dAuto").onclick = () => {
    if (!CARDS.some((c) => has(c.id))) return toast("Ouvrez d'abord des boosters !");
    S.deck = deckAuto(); sauver(); aller("combat"); toast("✨ Deck le plus puissant composé.");
  };
  $$("[data-diff]", v).forEach((b) => b.onclick = () => entrainement(b.dataset.diff));
  if (!complet) $$("[data-diff]", v).forEach((b) => b.title = "Complétez votre deck de 3 cartes");
  blocArene($("#areneBloc"), complet);
}

function choisirPourDeck(slot) {
  const autres = S.deck.filter((_, i) => i !== slot);
  const reste = COMBAT.BUDGET - coutDeck(autres);
  const miennes = CARDS.filter((c) => has(c.id) && !autres.includes(c.id));
  ouvrirModal(`<h2 style="margin-top:0">Carte ${slot + 1} du deck</h2>
    <p class="muted" style="margin-top:0">Budget restant : <b>${reste}</b> point${reste > 1 ? "s" : ""}. Triées par puissance.</p>
    <input class="search" id="dq" type="search" placeholder="Rechercher une de vos cartes…" style="max-width:none;width:100%;margin-bottom:10px">
    ${S.deck[slot] ? `<button class="btn small" id="dRetirer" style="margin-bottom:10px">Retirer la carte</button>` : ""}
    <div class="cards" id="dl" style="max-height:60vh;overflow:auto;padding:8px 4px" data-noclick></div>`);
  const dessiner = () => {
    const q = sansAccents($("#dq").value);
    const liste = miennes.filter((c) => sansAccents(c.nom).includes(q)).sort((a, b) => (coutDe(a) <= reste ? 0 : 1) - (coutDe(b) <= reste ? 0 : 1) || puissanceDe(b) - puissanceDe(a)).slice(0, 90);
    $("#dl").innerHTML = liste.length ? liste.map((c) => `<div class="slotcarte ${coutDe(c) > reste ? "trop" : ""}" data-pid="${c.id}">${cardHTML(c)}<span class="cout">Coût ${coutDe(c)}</span></div>`).join("") : `<p class="muted">Aucune carte. Ouvrez des boosters !</p>`;
    $$("#dl [data-pid]").forEach((el) => el.onclick = () => {
      const c = BY_ID[el.dataset.pid];
      if (coutDe(c) > reste) return toast(`⚠ Trop cher pour votre budget (${coutDe(c)} > ${reste}).`);
      const d = S.deck.slice(); d[slot] = c.id; S.deck = d.filter(Boolean).slice(0, 3); sauver(); fermerModal(); aller("combat");
    });
  };
  let t = 0;
  $("#dq").oninput = () => { clearTimeout(t); t = setTimeout(dessiner, 120); };
  dessiner();
  $("#dRetirer")?.addEventListener("click", () => { S.deck = S.deck.filter((_, i) => i !== slot); sauver(); fermerModal(); aller("combat"); });
}

// Deck de l'ordinateur : même budget, puissance ajustée à la difficulté
function deckOrdinateur(force) {
  const mien = S.deck.map((id) => uniteDe(BY_ID[id]));
  const cible = mien.reduce((s, u) => s + COMBAT.puissance(u), 0) / 3;
  const pool = CARDS.filter((c) => c.type !== "secrete");
  const choix = [];
  let budget = COMBAT.BUDGET;
  for (let i = 0; i < 3; i++) {
    const restant = 2 - i;
    const cands = pool.filter((c) => !choix.includes(c) && coutDe(c) <= budget - restant);
    const c = pick(cands.length ? cands : pool);
    choix.push(c); budget -= coutDe(c);
  }
  // Ajuste les statistiques pour approcher la puissance du joueur
  return choix.map((c) => {
    const s = COMBAT.stats(c.id, c.type, c.rarete, COMBAT.tirerQualite(), 1, false);
    const k = (cible * force) / COMBAT.puissance(s);
    return { id: c.id, type: c.type, nom: c.nom, shiny: false, atk: Math.round(s.atk * k), def: Math.round(s.def * k), pv: Math.round(s.pv * k), niveau: 1 };
  });
}
function entrainement(diff) {
  if (S.deck.length < 3) return;
  const d = DIFFICULTES[diff];
  lancerCombat({
    titre: `🤖 Entraînement ${d.nom}`, adversaire: "L'ordinateur",
    moi: S.deck.map((id) => uniteDe(BY_ID[id])), lui: deckOrdinateur(d.force), graine: (Math.random() * 2 ** 32) >>> 0,
    fin: async (etat) => {
      const gagne = etat.gagnant === 0;
      if (gagne) S.combat.victoires++; else S.combat.defaites++;
      let gain = 0;
      if (recompensesFaites() < limiteRecompenses()) {
        gain = gagne ? d.gain : 5;
        S.combat = { ...S.combat, jour: today(), recompenses: recompensesFaites() + 1 };
      }
      S.coins += gain; sauver(); majCoins();
      return gain ? `+${gain} 🪙` : "Limite de récompenses du jour atteinte";
    },
  });
}

/* ---------- Écran de combat ---------- */
function lancerCombat({ titre, adversaire, moi, lui, graine, fin }) {
  arreterCombat();
  const etat = COMBAT.creer(moi, lui, graine);
  let occupe = false, auto = false;
  ouvrirModal(`<div class="arene">
      <div class="arene-top"><span>${esc(titre)}</span><span class="muted">Tour <b id="cbTour">1</b></span></div>
      <div class="cote adv" id="cbAdv"></div>
      <div class="cbLog" id="cbLog">Le combat commence contre ${esc(adversaire)} !</div>
      <div class="cote moi" id="cbMoi"></div>
      <div class="actions" id="cbActions">
        <button class="btn primary" data-a="attaque">⚔️ Attaque</button>
        <button class="btn" data-a="special">✨ Spécial</button>
        <button class="btn" data-a="garde">🛡️ Garde</button>
        <button class="btn small" id="cbAuto">⏩ Auto</button>
      </div>
    </div>`);
  const m = $("#modal");
  m.classList.add("plein", "verrou");
  m.querySelector(".close").classList.add("hidden");
  const ligne = (u, cote) => {
    const c = BY_ID[u.id];
    const banc = etat.equipes[cote].map((x, i) => `<span class="mini ${x.pv <= 0 ? "ko" : i === etat.actifs[cote] ? "on" : ""}" title="${esc(x.nom)}">${esc(c && BY_ID[x.id]?.emoji || "🃏")}</span>`).join("");
    return `<div class="banc">${banc}</div>
      <div class="combattant" data-cote="${cote}">
        <div class="cb-carte">${c ? cardHTML(c, { locked: false, shiny: u.shiny, stats: u }) : ""}</div>
        <div class="cb-infos"><b>${esc(u.nom)}</b><span class="muted">${TYPES[u.type] || ""}${u.special ? " · ✨ spécial prêt" : ""}</span>
          <div class="pvbar"><i style="width:${(u.pv / u.pvMax) * 100}%" class="${u.pv / u.pvMax < 0.3 ? "bas" : ""}"></i></div>
          <span class="pvtxt">❤️ ${u.pv} / ${u.pvMax}</span></div>
      </div>`;
  };
  const dessiner = () => {
    $("#cbAdv").innerHTML = ligne(COMBAT.actif(etat, 1), 1);
    $("#cbMoi").innerHTML = ligne(COMBAT.actif(etat, 0), 0);
    $("#cbTour").textContent = etat.tour + 1;
    const sp = $("[data-a=special]");
    if (sp) sp.disabled = !COMBAT.actif(etat, 0).special;
  };
  dessiner();
  const nomDe = (cote) => (cote === 0 ? "Votre carte" : "L'adversaire");
  const texte = (e) => {
    if (e.t === "garde") return `🛡️ ${nomDe(e.cote)} se met en garde (+${e.soin} ❤️).`;
    if (e.t === "attaque" || e.t === "special") {
      if (e.esquive) return `💨 ${nomDe(1 - e.cote)} esquive ${e.t === "special" ? "l'attaque spéciale" : "l'attaque"} !`;
      return `${e.t === "special" ? "✨ Attaque spéciale" : "⚔️ Attaque"} ${e.cote === 0 ? "de votre carte" : "adverse"} : ${e.degats} dégâts${e.critique ? " (critique !)" : ""}${e.avantage ? " (avantage de type)" : ""}.`;
    }
    if (e.t === "ko") return `💥 ${BY_ID[e.id]?.nom || "Une carte"} est K.O. !`;
    if (e.t === "entree") return `➡️ ${BY_ID[e.id]?.nom || "Une carte"} entre en jeu.`;
    return "";
  };
  const attendre = (ms) => new Promise((r) => combatTimers.push(setTimeout(r, ms)));
  async function tour(action) {
    if (occupe || etat.fini) return;
    occupe = true;
    $$("#cbActions button[data-a]").forEach((b) => b.disabled = true);
    const evs = COMBAT.jouer(etat, action);
    for (const e of evs) {
      if (e.t === "fin") continue;
      const t = texte(e);
      if (t) $("#cbLog").textContent = t;
      if ((e.t === "attaque" || e.t === "special") && !e.esquive) {
        const cible = $(`.combattant[data-cote="${1 - e.cote}"]`);
        cible?.classList.remove("touche"); void cible?.offsetWidth; cible?.classList.add("touche");
        cible?.insertAdjacentHTML("beforeend", `<span class="degat ${e.critique ? "crit" : ""}">-${e.degats}</span>`);
      }
      await attendre(auto ? 260 : 650);
      if (e.t !== "garde") dessiner();
    }
    dessiner();
    occupe = false;
    if (etat.fini) return terminer();
    $$("#cbActions button[data-a]").forEach((b) => b.disabled = b.dataset.a === "special" && !COMBAT.actif(etat, 0).special);
    if (auto) tour(choixAuto());
  }
  const choixAuto = () => { const me = COMBAT.actif(etat, 0), lui = COMBAT.actif(etat, 1); return me.special && lui.pv / lui.pvMax > 0.4 ? "special" : "attaque"; };
  async function terminer() {
    const gagne = etat.gagnant === 0;
    $("#cbActions").innerHTML = `<p class="muted">Calcul du résultat…</p>`;
    let detail = "";
    try { detail = await fin(etat); } catch (e) { detail = "⚠ " + e.message; }
    m.classList.remove("verrou");
    m.querySelector(".close")?.classList.remove("hidden");
    $("#cbLog").innerHTML = `<div class="resultat ${gagne ? "gagne" : "perdu"}">${gagne ? "🏆 Victoire !" : "💀 Défaite…"}</div>`;
    $("#cbActions").innerHTML = `<p style="margin:0 0 8px;font-weight:700">${detail || ""}</p><button class="btn primary" data-close>Continuer</button>`;
    verifierProgression();
  }
  $$("#cbActions button[data-a]").forEach((b) => b.onclick = () => tour(b.dataset.a));
  $("#cbAuto").onclick = () => { auto = !auto; $("#cbAuto").classList.toggle("on", auto); if (auto) tour(choixAuto()); };
  m._onClose = () => { arreterCombat(); aller(S.vue); };
}

/* ---------- Arène en ligne ---------- */
async function blocArene(el, complet) {
  if (typeof connecte !== "function" || !connecte()) {
    el.innerHTML = `<h3 style="margin-top:0">🏟️ Arène en ligne</h3>
      <p class="muted">Affrontez les decks des autres joueurs, gagnez des trophées et grimpez au classement. ${COMPTE.etat === "anonyme" ? "Un compte (gratuit) est nécessaire." : "Indisponible pour le moment."}</p>
      ${COMPTE.etat === "anonyme" ? `<button class="btn primary" data-aller="compte">Se connecter</button>` : ""}`;
    brancherLiens(el);
    return;
  }
  try {
    const a = await api("arene/moi");
    el.innerHTML = `<h3 style="margin-top:0">🏟️ Arène en ligne</h3>
      <div class="statgrid petit"><div class="stat"><b>🏆 ${fmt(a.trophees)}</b><span>trophées</span></div><div class="stat"><b>${a.rang ? "#" + a.rang : "—"}</b><span>rang</span></div>
      <div class="stat"><b>${a.victoires}/${a.defaites}</b><span>V / D</span></div><div class="stat"><b>${a.restants}/${a.limite}</b><span>combats aujourd'hui</span></div></div>
      <p class="muted" style="font-size:13.5px">Votre deck sert aussi à défendre : les autres joueurs l'affrontent quand vous êtes absent. ${a.deck ? "✅ Deck de défense enregistré." : "⚠ Pas encore de deck de défense."}</p>
      <div class="row"><button class="btn primary" id="aChercher" ${complet && a.restants ? "" : "disabled"}>🔎 Trouver des adversaires</button>
      <button class="btn" id="aDefense" ${complet ? "" : "disabled"}>🛡️ Mettre à jour ma défense</button><button class="btn" id="aClassement">🏆 Classement</button></div>
      <div id="aListe"></div>`;
    $("#aDefense").onclick = async () => { try { await envoyerDeckArene(); toast("🛡️ Deck de défense enregistré."); aller("combat"); } catch (e) { toast("⚠ " + e.message); } };
    $("#aClassement").onclick = () => classementArene();
    $("#aChercher").onclick = async () => {
      $("#aListe").innerHTML = `<p class="muted">Recherche…</p>`;
      try {
        await envoyerDeckArene();
        const { adversaires } = await api("arene/adversaires");
        $("#aListe").innerHTML = adversaires.length ? `<div class="adversaires">${adversaires.map((x) => `<div class="adversaire">
            <div><b>${esc(x.pseudo)}${x.premium ? " 💎" : ""}</b><span class="muted">🏆 ${fmt(x.trophees)} · puissance ${fmt(x.puissance)}</span>
            <span class="emojis">${x.cartes.map((id) => BY_ID[id]?.emoji || "🃏").join(" ")}</span></div>
            <button class="btn primary small" data-defi="${esc(x.pseudo)}">⚔️ Défier</button></div>`).join("")}</div>`
          : `<p class="muted">Aucun adversaire pour l'instant : invitez vos amis à enregistrer leur deck !</p>`;
        $$("[data-defi]").forEach((b) => b.onclick = () => defier(b.dataset.defi));
      } catch (e) { $("#aListe").innerHTML = `<p class="err">${esc(e.message)}</p>`; }
    };
  } catch (e) {
    el.innerHTML = `<h3 style="margin-top:0">🏟️ Arène en ligne</h3><p class="err">${esc(e.message)}</p>`;
  }
}
// Le serveur lit les statistiques dans la sauvegarde du compte : on l'envoie d'abord
async function envoyerDeckArene() {
  await envoyerSauvegarde();
  await api("arene/deck", { methode: "PUT", corps: { deck: S.deck } });
}
async function defier(pseudo) {
  try {
    const d = await api("arene/defi", { methode: "POST", corps: { pseudo } });
    lancerCombat({
      titre: `🏟️ Arène contre ${d.adversaire}`, adversaire: d.adversaire, moi: d.moi, lui: d.lui, graine: d.graine,
      fin: async (etat) => {
        const r = await api("arene/fin", { methode: "POST", corps: { combat: d.combat, actions: etat.journal } });
        if (r.gagne) S.combat.victoires++; else S.combat.defaites++;
        S.coins += r.pieces; sauver(); majCoins();
        return `${r.delta >= 0 ? "+" : ""}${r.delta} 🏆 (${fmt(r.trophees)}) · +${r.pieces} 🪙`;
      },
    });
  } catch (e) { toast("⚠ " + e.message); }
}
async function classementArene() {
  ouvrirModal(`<h2 style="margin-top:0">🏆 Classement de l'arène</h2><div id="clA"><p class="muted">Chargement…</p></div>`);
  try {
    const { joueurs } = await api("arene/classement");
    $("#clA").innerHTML = `<div style="overflow-x:auto"><table class="classement"><thead><tr><th>#</th><th>Joueur</th><th>Trophées</th><th>V / D</th></tr></thead><tbody>
      ${joueurs.map((j, i) => `<tr class="${j.pseudo === COMPTE.pseudo ? "moi" : ""}"><td>${["🥇", "🥈", "🥉"][i] || i + 1}</td><td>${esc(j.pseudo)}${j.premium ? " 💎" : ""}${j.admin ? " 👑" : ""}</td><td>${fmt(j.trophees)}</td><td>${j.victoires} / ${j.defaites}</td></tr>`).join("") || `<tr><td colspan="4" class="muted">Personne pour l'instant.</td></tr>`}
      </tbody></table></div>`;
  } catch (e) { $("#clA").innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}
