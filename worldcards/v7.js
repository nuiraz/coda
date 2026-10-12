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
