"use strict";
/* Mode Combat : deck de 3 cartes, entraînement contre l'ordinateur et arène en ligne contre les decks des autres joueurs.
   Le moteur (combat.js) est partagé avec le serveur, qui rejoue chaque combat d'arène pour vérifier le résultat. */

const DIFFICULTES = {
  facile: { nom: "Facile", emoji: "🌱", force: 0.9, gain: 15, ia: 1 },
  normal: { nom: "Normal", emoji: "⚔️", force: 1, gain: 30, ia: 2 },
  difficile: { nom: "Difficile", emoji: "🔥", force: 1.08, gain: 50, ia: 3 },
};

/* ---------- Mode Solo : l'aventure autour du monde ---------- */
const CHAPITRES = ["EU", "AF", "AS", "NA", "SA", "OC"];
const ETAPES = 5; // la 5e étape de chaque continent est un boss
const NOMS_ETAPES = ["Éclaireur", "Gardien", "Champion", "Maître", "Boss"];
const cleEtape = (ch, n) => `${CHAPITRES[ch]}-${n}`;
const etoiles = (ch, n) => (S.solo || {})[cleEtape(ch, n)] || 0;
const indexEtape = (ch, n) => ch * ETAPES + n;
const etapeOuverte = (ch, n) => indexEtape(ch, n) === 0 || (n > 0 ? etoiles(ch, n - 1) : etoiles(ch - 1, ETAPES - 1)) > 0;
function reglagesEtape(ch, n) {
  const g = indexEtape(ch, n), boss = n === ETAPES - 1;
  return {
    force: 0.7 + g * 0.018 + (boss ? 0.06 : 0),               // de 0,70 (très facile) à 1,28 (dernier boss)
    ia: Math.min(3, (g < 8 ? 1 : g < 20 ? 2 : 3) + (boss && g < 20 ? 1 : 0)),
    gain: 30 + g * 6 + (boss ? 60 : 0),
    booster: boss ? (ch < 2 ? "monde" : ch < 4 ? "argent" : "or") : null,
  };
}
// Deck de l'étape : des cartes du continent, toujours le même pour une étape donnée
function deckEtape(ch, n) {
  const { force } = reglagesEtape(ch, n);
  const r = COMBAT.rng(9000 + indexEtape(ch, n) * 31);
  const pool = CARDS.filter((c) => c.continent === CHAPITRES[ch] && c.type !== "secrete");
  const choix = [];
  let budget = COMBAT.BUDGET;
  if (n === ETAPES - 1) {
    // Le boss a la carte la plus prestigieuse du continent
    const top = pool.filter((c) => coutDe(c) <= 6).sort((a, b) => coutDe(b) - coutDe(a) || COMBAT.hash(a.id) - COMBAT.hash(b.id))[0];
    if (top) { choix.push(top); budget -= coutDe(top); }
  }
  while (choix.length < 3) {
    const restant = 2 - choix.length;
    const cands = pool.filter((c) => !choix.includes(c) && coutDe(c) <= budget - restant);
    const c = (cands.length ? cands : pool)[Math.floor(r() * (cands.length || pool.length))];
    choix.push(c); budget -= coutDe(c);
  }
  return choix.map((c) => {
    const st = COMBAT.stats(c.id, c.type, c.rarete, [0, 0, 0], 1, false);
    return { id: c.id, type: c.type, nom: c.nom, shiny: false, atk: Math.round(st.atk * force), def: Math.round(st.def * force), pv: Math.round(st.pv * force), niveau: 1, talent: st.talent };
  });
}
function blocSolo(el, complet) {
  const total = CHAPITRES.length * ETAPES;
  const faites = CHAPITRES.reduce((t, _, ch) => t + [...Array(ETAPES).keys()].filter((n) => etoiles(ch, n)).length, 0);
  const nbEtoiles = CHAPITRES.reduce((t, _, ch) => t + [...Array(ETAPES).keys()].reduce((u, n) => u + etoiles(ch, n), 0), 0);
  el.innerHTML = `<div class="row" style="justify-content:space-between"><h3 style="margin:0">🗺️ Mode Solo : le tour du monde</h3><span class="muted">${faites}/${total} étapes · ⭐ ${nbEtoiles}/${total * 3}</span></div>
    <p class="muted" style="margin:6px 0 12px">Battez les gardiens de chaque continent, de plus en plus forts et rusés. Le boss de chaque continent offre un booster. 3 étoiles si aucune de vos cartes n'est K.O.</p>
    <div class="chapitres">${CHAPITRES.map((cont, ch) => `<div class="chapitre" style="--c:${CONTINENTS[cont].couleur}">
      <b>${CONTINENTS[cont].emoji} ${CONTINENTS[cont].nom}</b>
      <div class="etapes">${[...Array(ETAPES).keys()].map((n) => {
        const ouverte = etapeOuverte(ch, n), et = etoiles(ch, n);
        return `<button class="etape ${n === ETAPES - 1 ? "boss" : ""} ${et ? "faite" : ""}" data-etape="${ch}-${n}" ${ouverte ? "" : "disabled"} title="${NOMS_ETAPES[n]}">
          <span>${ouverte ? (n === ETAPES - 1 ? "👑" : n + 1) : "🔒"}</span><small>${"★".repeat(et)}${"☆".repeat(3 - et)}</small></button>`;
      }).join("")}</div></div>`).join("")}</div>
`;
  $$("[data-etape]", el).forEach((b) => b.onclick = () => { const [ch, n] = b.dataset.etape.split("-").map(Number); lancerEtape(ch, n); });
}
function lancerEtape(ch, n) {
  if (!deckPret()) return;
  const reg = reglagesEtape(ch, n), cont = CONTINENTS[CHAPITRES[ch]];
  const nom = `${NOMS_ETAPES[n]} ${n === ETAPES - 1 ? "d'" : "d'"}${cont.nom}`;
  lancerCombat({
    titre: `${cont.emoji} ${cont.nom} · étape ${n + 1}/${ETAPES}`, adversaire: nom, ia: reg.ia,
    moi: S.deck.map((id) => uniteDe(BY_ID[id])), lui: deckEtape(ch, n), graine: (Math.random() * 2 ** 32) >>> 0,
    fin: async (etat) => {
      const gagne = etat.gagnant === 0;
      if (gagne) S.combat.victoires++; else S.combat.defaites++;
      if (gagne) { progresDefi("solo"); gagnerXP(15); }
      if (!gagne) { sauver(); return "Retentez votre chance : changez de deck ou utilisez mieux les types !"; }
      const intactes = etat.equipes[0].filter((u) => u.pv > 0).length;
      const et = intactes === 3 ? 3 : intactes === 2 ? 2 : 1;
      const premiere = !etoiles(ch, n);
      S.solo = { ...(S.solo || {}), [cleEtape(ch, n)]: Math.max(et, etoiles(ch, n)) };
      let txt = `${"⭐".repeat(et)}`;
      if (premiere) {
        S.coins += reg.gain; txt += ` · +${reg.gain} 🪙`;
        if (reg.booster) { S.boosters[reg.booster] = (S.boosters[reg.booster] || 0) + 1; txt += ` · 🎁 booster ${PACKS[reg.booster].nom} !`; }
      } else if (recompensesFaites() < limiteRecompenses()) {
        S.coins += 10; txt += " · +10 🪙"; S.combat = { ...S.combat, jour: today(), recompenses: recompensesFaites() + 1 };
      }
      sauver(); majCoins();
      return txt;
    },
  });
}
const limiteRecompenses = () => (premium() ? 30 : 15);
const recompensesFaites = () => (S.combat.jour === today() ? S.combat.recompenses : 0);
const coutDeck = (ids) => ids.reduce((s, id) => s + coutDe(BY_ID[id]), 0);
const uniteDe = (c) => ({ id: c.id, type: c.type, nom: c.nom, shiny: !!S.shiny?.[c.id], doree: !!S.doree?.[c.id], ...statsDe(c) });
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
    <div class="sectiontitle"><h3>⚔️ Combat</h3><span class="muted">${COMBAT.CYCLE.map((t) => EMOJI_TYPE[t] + " " + TYPES[t]).join(" › ")} › ${EMOJI_TYPE.ville} (+12 % de dégâts)</span></div>
    <div class="panel">
      <div class="row" style="justify-content:space-between">
        <h3 style="margin:0">Mon deck</h3>
        <div class="row"><span class="budget ${cout > COMBAT.BUDGET ? "trop" : ""}">Coût ${cout}/${COMBAT.BUDGET}</span><span class="muted">Puissance ${fmt(puissance)}</span></div>
      </div>
      <button class="btn primary meilleur" id="dAuto">⚡ Remplir avec mes meilleures cartes</button>
      <div class="cards deck" data-noclick>${[0, 1, 2].map((i) => deck[i]
        ? `<div class="slotcarte" data-slot="${i}">${cardHTML(deck[i])}<span class="cout">Coût ${coutDe(deck[i])}</span></div>`
        : `<button class="slot" data-slot="${i}">＋<small>Choisir une carte</small></button>`).join("")}</div>
      <p class="muted" style="margin-bottom:0;font-size:13.5px">3 cartes, ${COMBAT.BUDGET} points de coût au maximum : commune 1, peu commune 2, rare 3, épique 4, ultra rare 5, légendaire et secrète 6. Les cartes combattent dans l'ordre. Touchez une carte pour la changer.</p>
    </div>
    <div class="panel" id="soloBloc" style="margin-top:16px"></div>
    <div class="grid2" style="margin-top:16px">
      <div class="panel">
        <h3 style="margin-top:0">🤖 Combat rapide</h3>
        <p class="muted" style="margin-top:0">Contre l'ordinateur, avec un deck de puissance proche du vôtre. Plus c'est difficile, plus il joue malin. Récompenses : ${recompensesFaites()}/${limiteRecompenses()} combats récompensés aujourd'hui.</p>
        <div class="row">${Object.entries(DIFFICULTES).map(([k, d]) => `<button class="btn ${k === "normal" ? "primary" : ""}" data-diff="${k}">${d.emoji} ${d.nom} · +${d.gain} 🪙</button>`).join("")}</div>
        <p class="muted" style="font-size:13px;margin-bottom:0">Victoires : ${S.combat.victoires} · Défaites : ${S.combat.defaites}</p>
      </div>
      <div class="panel" id="areneBloc"><h3 style="margin-top:0">🏟️ Arène en ligne</h3><p class="muted">Chargement…</p></div>
    </div>
    <div class="panel" style="margin-top:16px">
      <h3 style="margin-top:0">Comment ça marche ?</h3>
      <ul class="regles">
        <li><b>⚔️ Attaque</b> : dégâts selon votre attaque et la défense adverse.</li>
        <li><b>✨ Spécial</b> (une fois par carte), différent selon le type : ${Object.entries(COMBAT.SPECIAUX).map(([t, sp]) => `${EMOJI_TYPE[t]} <b>${sp.nom}</b> (${sp.desc})`).join(" · ")}.</li>
        <li><b>🔄 Changer</b> : touchez une carte de votre banc pour la faire entrer (utilise votre tour). Idéal pour profiter des types.</li>
        <li><b>🛡️ Garde</b> : vous ne subissez que 40 % des dégâts ce tour-ci et regagnez 8 % de vos points de vie.</li>
        <li><b>Types</b> : ${COMBAT.CYCLE.map((t) => EMOJI_TYPE[t] + " " + TYPES[t]).join(" bat ")} qui bat ${TYPES.ville} (+12 % de dégâts). Merveilles et secrètes sont neutres.</li>
        <li><b>Talents</b> : chaque carte a un pouvoir, visible en haut à droite de son image. ${Object.values(COMBAT.TALENTS).map((t) => `${t.emoji} <b>${t.nom}</b> : ${t.desc.toLowerCase()}`).join(" · ")}</li>
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
  blocSolo($("#soloBloc"), complet);
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
// Deck incomplet : on le complète automatiquement avec les meilleures cartes
function deckPret() {
  if (S.deck.length >= 3) return true;
  const auto = deckAuto();
  if (auto.length < 3) { toast("Il vous faut au moins 3 cartes : ouvrez des boosters !"); return false; }
  S.deck = auto; sauver(); toast("⚡ Deck complété avec vos meilleures cartes."); return true;
}
function entrainement(diff) {
  if (!deckPret()) return;
  const d = DIFFICULTES[diff];
  lancerCombat({
    titre: `🤖 Combat rapide ${d.nom}`, adversaire: "L'ordinateur", ia: d.ia,
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
function lancerCombat({ titre, adversaire, moi, lui, graine, fin, ia, arene: estArene = false }) {
  arreterCombat();
  const etat = COMBAT.creer(moi, lui, graine, { ia });
  const met = COMBAT.METEOS?.[etat.meteo] || { nom: "☀️ Climat Équilibré", desc: "Arène standard" };
  let occupe = false, auto = false;
  ouvrirModal(`<div class="arene">
      <div class="arene-top"><span>${esc(titre)}</span><span class="meteo-badge" title="${esc(met.desc)}">${esc(met.nom)}</span><span class="muted">Tour <b id="cbTour">1</b></span></div>
      <div class="cote adv" id="cbAdv"></div>
      <div class="cbLog" id="cbLog">Le combat commence contre ${esc(adversaire)} ! (${esc(met.desc)})</div>
      <div class="cote moi" id="cbMoi"></div>
      <div class="actions" id="cbActions">
        <button class="btn primary" data-a="attaque">⚔️ Attaque</button>
        <button class="btn" data-a="special">✨ Spécial</button>
        <button class="btn" data-a="supreme" id="btnSupreme" disabled>⚡ Suprême (0%)</button>
        <button class="btn" data-a="garde">🛡️ Garde</button>
        <button class="btn small" id="cbAuto">⏩ Auto</button>
      </div>
    </div>`);
  const m = $("#modal");
  m.classList.add("plein", "verrou");
  m.querySelector(".close").classList.add("hidden");
  const ligne = (u, cote) => {
    const c = BY_ID[u.id];
    const banc = etat.equipes[cote].map((x, i) => {
      const peut = cote === 0 && x.pv > 0 && i !== etat.actifs[0] && !etat.fini;
      return `<${peut ? "button" : "span"} class="mini ${x.pv <= 0 ? "ko" : i === etat.actifs[cote] ? "on" : ""} ${peut ? "changeable" : ""}" ${peut ? `data-changer="${i}"` : ""} title="${esc(x.nom)} · ❤️ ${x.pv}/${x.pvMax}${peut ? " — toucher pour la faire entrer" : ""}">${esc(BY_ID[x.id]?.emoji || "🃏")}<i style="width:${(x.pv / x.pvMax) * 100}%"></i></${peut ? "button" : "span"}>`;
    }).join("");
    return `<div class="banc">${banc}</div>
      <div class="combattant" data-cote="${cote}">
        <div class="cb-carte">${c ? cardHTML(c, { locked: false, shiny: u.shiny, doree: u.doree, stats: u }) : ""}</div>
        <div class="cb-infos"><b>${esc(u.nom)}${u.doree ? " 👑" : ""}</b><span class="muted">${TYPES[u.type] || ""} · ${COMBAT.TALENTS[u.talent]?.emoji || ""} ${COMBAT.TALENTS[u.talent]?.nom || ""}${u.special ? " · ✨ prêt" : ""}</span>
          <div class="pvbar"><i style="width:${(u.pv / u.pvMax) * 100}%" class="${u.pv / u.pvMax < 0.3 ? "bas" : ""}"></i></div>
          <span class="pvtxt">❤️ ${u.pv} / ${u.pvMax}</span>
          <div class="jauge-energie" title="Adrénaline : ${u.energie || 0}% / 100%"><i class="fill" style="width:${u.energie || 0}%"></i></div>
        </div>
      </div>`;
  };
  const dessiner = () => {
    $("#cbAdv").innerHTML = ligne(COMBAT.actif(etat, 1), 1);
    $("#cbMoi").innerHTML = ligne(COMBAT.actif(etat, 0), 0);
    $("#cbTour").textContent = etat.tour + 1;
    const a = COMBAT.actif(etat, 0);
    const sp = $("[data-a=special]");
    if (sp) { sp.disabled = !a.special; sp.innerHTML = `✨ ${(COMBAT.SPECIAUX[a.type] || COMBAT.SPECIAUX.ville).nom}`; sp.title = (COMBAT.SPECIAUX[a.type] || COMBAT.SPECIAUX.ville).desc; }
    const sup = $("#btnSupreme");
    if (sup) {
      sup.disabled = (a.energie || 0) < 100;
      sup.className = `btn ${(a.energie || 0) >= 100 ? "btn-supreme" : ""}`;
      sup.innerHTML = (a.energie || 0) >= 100 ? "⚡ ATTAQUE SUPRÊME !" : `⚡ Suprême (${a.energie || 0}%)`;
    }
    $$("#cbMoi [data-changer]").forEach((b) => b.onclick = () => tour("changer:" + b.dataset.changer));
  };
  dessiner();
  const nomDe = (cote) => (cote === 0 ? "Votre carte" : "L'adversaire");
  const texte = (e) => {
    if (e.t === "garde") return `🛡️ ${nomDe(e.cote)} se met en garde (+${e.soin} ❤️).`;
    if (e.t === "supreme") {
      return `⚡ ATTAQUE SUPRÊME ${e.cote === 0 ? "dévastatrice de votre carte" : "de l'adversaire"} : ${e.degats} dégâts titanesques${e.critique ? " (coup critique d'or !)" : ""} !`;
    }
    if (e.t === "attaque" || e.t === "special") {
      if (e.esquive) return `💨 ${nomDe(1 - e.cote)} esquive ${e.t === "special" ? "l'attaque spéciale" : "l'attaque"} !`;
      return `${e.t === "special" ? `✨ ${e.nomSpecial || "Attaque spéciale"}` : "⚔️ Attaque"} ${e.cote === 0 ? "de votre carte" : "adverse"}${e.doree ? " (Dorée 👑)" : ""} : ${e.degats} dégâts${e.critique ? " (critique !)" : ""}${e.avantage ? " (avantage de type)" : ""}.`;
    }
    if (e.t === "effet") return { soin: `💚 ${nomDe(e.cote)} se soigne de ${e.valeur} ❤️.`, rempart: `🧱 ${nomDe(e.cote)} dresse un rempart : dégâts réduits de moitié !`, affaibli: `🎉 La fête affaiblit l'attaque adverse de 15 % !`, tempete: `🌪️ La tempête frappe aussi le banc : ${e.valeur} dégâts !` }[e.effet] || "";
    if (e.t === "changer") return `🔄 ${e.cote === 0 ? "Vous faites" : "L'adversaire fait"} entrer ${BY_ID[e.id]?.nom || "une carte"}.`;
    if (e.t === "talent") return e.talent === "vampire" ? `🧛 ${nomDe(e.cote)} récupère ${e.valeur} ❤️ (Vampire).` : `↩️ Riposte : ${e.valeur} dégâts renvoyés !`;
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
      if (e.t === "attaque" || e.t === "special" || e.t === "supreme") {
        // L'attaquant s'élance vers sa cible
        const att = $(`.combattant[data-cote="${e.cote}"]`);
        att?.classList.remove("frappe", "frappe-haut"); void att?.offsetWidth; att?.classList.add(e.cote === 0 ? "frappe-haut" : "frappe");
        if (e.t === "special" || e.t === "supreme") {
          $(".arene")?.classList.remove("flash"); void $(".arene")?.offsetWidth; $(".arene")?.classList.add("flash");
          son("special");
        }
      }
      if ((e.t === "attaque" || e.t === "special" || e.t === "supreme") && !e.esquive) {
        const cible = $(`.combattant[data-cote="${1 - e.cote}"]`);
        cible?.classList.remove("touche"); void cible?.offsetWidth; cible?.classList.add("touche");
        cible?.insertAdjacentHTML("beforeend", `<span class="degat ${e.critique || e.t === "supreme" ? "crit" : ""}">-${e.degats}${e.critique ? " !" : ""}</span>`);
        son(e.critique || e.t === "supreme" ? "crit" : "coup");
      }
      if (e.t === "ko") { son("ko"); const ar = $(".arene"); ar?.classList.remove("secousse"); void ar?.offsetWidth; ar?.classList.add("secousse"); }
      if (e.t === "effet" && e.effet === "soin" || e.t === "garde") son("soin");
      await attendre(auto ? 260 : 650);
      if (e.t !== "garde") dessiner();
      if (e.t === "changer") $$("#cbMoi [data-changer]").forEach((b) => b.disabled = true);
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
    // Défis du jour et expérience
    progresDefi("speciaux", etat.journal.filter((a) => a === "special").length);
    progresDefi("ko", etat.equipes[1].filter((u) => u.pv <= 0).length);
    if (gagne) progresDefi("victoires");
    gagnerXP(gagne ? 25 : 8); sauver();
    // Points du tournoi de la semaine (l'arène est comptée directement par le serveur)
    if (!estArene && typeof connecte === "function" && connecte()) api("tournois/victoire", { methode: "POST", corps: { gagne } }).catch(() => {});
    son(gagne ? "victoire" : "defaite");
    $("#cbLog").innerHTML = `<div class="resultat ${gagne ? "gagne" : "perdu"}">${gagne ? "🏆 Victoire !" : "💀 Défaite…"}</div>${gagne ? `<div class="confettis">${Array.from({ length: 24 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${(i % 6) * 0.12}s;--c:${["#ffd34d", "#e0458b", "#3a9bff", "#3ad6a8", "#ff8a65"][i % 5]}"></i>`).join("")}</div>` : ""}`;
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
      titre: `🏟️ Arène contre ${d.adversaire}`, adversaire: d.adversaire, arene: true, moi: d.moi, lui: d.lui, graine: d.graine,
      fin: async (etat) => {
        const r = await api("arene/fin", { methode: "POST", corps: { combat: d.combat, actions: etat.journal } });
        let tournoiBonus = "";
        if (r.gagne) {
          S.combat.victoires++;
          try {
            const tv = await api("tournois/victoire", { methode: "POST" });
            if (tv?.score !== undefined) tournoiBonus = ` · +25 pts Tournoi ⚡ (${tv.score} pts)`;
          } catch {}
        } else {
          S.combat.defaites++;
        }
        S.coins += r.pieces; sauver(); majCoins();
        return `${r.delta >= 0 ? "+" : ""}${r.delta} 🏆 (${fmt(r.trophees)}) · +${r.pieces} 🪙${tournoiBonus}`;
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
