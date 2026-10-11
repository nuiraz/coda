"use strict";
/* Collections de pays, quêtes de la semaine, poussière d'étoiles (recyclage et fabrication), amis,
   paliers d'arène, paiement PayPal automatique et corrections de photos. Chargé après app.js et compte.js. */

/* =====================================================================
   Collections de pays : un album par pays, avec une récompense quand il est complet
   ===================================================================== */
const cartesDuPays = (code) => [`pays:${code}`, ...(CARTES_PAR_PAYS[code] || []).filter((id) => id !== `pays:${code}`)].map((id) => BY_ID[id]).filter((c) => c && !c.saisonnier);
const progresPays = (code) => { const l = cartesDuPays(code); return { n: count(l.map((c) => c.id)), t: l.length }; };
const recompensePays = (code) => 60 + cartesDuPays(code).length * 25;
const filtrePays = { cont: "tout", tri: "proche", q: "" };

function vueCollectionsPays(v) {
  const f = filtrePays;
  v.innerHTML = `<div class="toolbar">
      ${[["tout", "🌐 Tous"], ...Object.entries(CONTINENTS).map(([k, c]) => [k, `${c.emoji} ${c.nom}`])].map(([k, l]) => `<button class="chip ${f.cont === k ? "on" : ""}" data-cont="${k}">${l}</button>`).join("")}
    </div>
    <div class="toolbar">
      <input class="search" id="pq" type="search" placeholder="Rechercher un pays…" value="${esc(f.q)}">
      <select class="chip" id="ptri"><option value="proche">Les plus proches d'être complets</option><option value="nom">Par nom</option><option value="cartes">Le plus de cartes</option><option value="complets">Complets d'abord</option></select>
    </div>
    <p class="muted" style="margin-top:0">Complétez toutes les cartes d'un pays pour gagner des pièces et un booster du continent. ✨ Poussière : <b>${fmt(S.poussiere || 0)}</b></p>
    <div class="grille-pays" id="grillePays"></div>`;
  $("#ptri").value = f.tri;
  $$("[data-cont]", v).forEach((b) => b.onclick = () => { f.cont = b.dataset.cont; aller("collections"); });
  $("#ptri").onchange = (e) => { f.tri = e.target.value; dessiner(); };
  let t = 0; $("#pq").oninput = (e) => { f.q = e.target.value; clearTimeout(t); t = setTimeout(dessiner, 120); };
  function dessiner() {
    const q = sansAccents(f.q.trim());
    let liste = of("monde", "pays").filter((c) => (f.cont === "tout" || c.continent === f.cont) && (!q || sansAccents(c.nom).includes(q)))
      .map((c) => ({ c, ...progresPays(c.code) }));
    const r = (x) => x.n / x.t;
    if (f.tri === "nom") liste.sort((a, b) => a.c.nom.localeCompare(b.c.nom, "fr"));
    else if (f.tri === "cartes") liste.sort((a, b) => b.t - a.t);
    else if (f.tri === "complets") liste.sort((a, b) => (b.n === b.t) - (a.n === a.t) || r(b) - r(a));
    else liste.sort((a, b) => (a.n === a.t) - (b.n === b.t) || r(b) - r(a));
    $("#grillePays").innerHTML = liste.map(({ c, n, t }) => `<button class="pays-tuile ${n === t ? "complet" : ""}" data-pays="${c.code}">
        <img src="flags/${c.code.toLowerCase()}.svg" alt="" loading="lazy"><span class="pt-nom">${esc(c.nom)}</span>
        <span class="bar"><i style="width:${(n / t) * 100}%"></i></span><small>${n}/${t}${n === t ? (S.paysRecompense?.[c.code] ? " ✓" : " 🎁") : ""}</small></button>`).join("")
      || `<p class="muted">Aucun pays ne correspond.</p>`;
    $$("[data-pays]").forEach((b) => b.onclick = () => aller("pays", { code: b.dataset.pays }));
  }
  dessiner();
}

function vuePays(v, opts = {}) {
  const code = opts.code || S.dernierPays || "FR";
  S.dernierPays = code;
  const p = BY_ID["pays:" + code];
  if (!p) return aller("collections");
  const cartes = cartesDuPays(code), { n, t } = progresPays(code);
  const complet = n === t, recu = !!S.paysRecompense?.[code];
  const parType = Object.keys(TYPES).map((ty) => [ty, cartes.filter((c) => c.type === ty)]).filter(([, l]) => l.length);
  v.innerHTML = `<div class="row" style="margin-bottom:10px"><button class="btn small" id="retourPays">← Tous les pays</button></div>
    <section class="pays-entete" style="--c:${CONTINENTS[p.continent]?.couleur || "#556"}">
      <img src="flags/${code.toLowerCase()}.svg" alt="Drapeau : ${esc(p.nom)}">
      <div><h1>${esc(p.nom)}</h1><p>🏛️ ${esc(court(p.capitale))} · ${CONTINENTS[p.continent].emoji} ${CONTINENTS[p.continent].nom}</p>
        <div class="bar"><i style="width:${(n / t) * 100}%"></i></div><p><b>${n}/${t}</b> cartes · récompense : ${fmt(recompensePays(code))} 🪙 + 1 booster ${CONTINENTS[p.continent].nom}</p></div>
      ${complet && !recu ? `<button class="btn primary" id="recompensePays">🎁 Récupérer la récompense</button>` : recu ? `<span class="rbadge" data-r="legendaire">✓ Collection complète</span>` : ""}
    </section>
    ${parType.map(([ty, l]) => `<div class="sectiontitle"><h3>${EMOJI_TYPE[ty]} ${PLURIEL[ty]}</h3><span class="muted">${count(l.map((c) => c.id))}/${l.length}</span></div>
      <div class="cards">${l.map((c) => cardHTML(c, { compte: true })).join("")}</div>`).join("")}
    <div class="row" style="margin-top:16px"><button class="btn" id="paysAtlas">🗺️ Voir sur l'atlas</button></div>`;
  $("#retourPays").onclick = () => aller("collections");
  $("#paysAtlas").onclick = () => aller("atlas", { focus: p });
  $("#recompensePays")?.addEventListener("click", () => {
    if (!complet || S.paysRecompense?.[code]) return;
    S.paysRecompense = { ...(S.paysRecompense || {}), [code]: today() };
    const pieces = recompensePays(code), b = "cont-" + p.continent;
    S.coins += pieces; S.boosters[b] = (S.boosters[b] || 0) + 1;
    gagnerXP(50); sauver(); majCoins(); son("niveau");
    toast(`🎉 Collection ${esc(p.nom)} complète : +${fmt(pieces)} 🪙 et un booster ${CONTINENTS[p.continent].nom} !`, 5000);
    aller("pays", { code });
  });
}

/* =====================================================================
   Quêtes de la semaine : plus longues que les défis du jour, avec un booster Or à la clé
   ===================================================================== */
const MODELES_QUETES = [
  { id: "boosters", nom: "Ouvrir {n} boosters", cibles: [12, 18], emoji: "🎁" },
  { id: "victoires", nom: "Gagner {n} combats", cibles: [12, 20], emoji: "⚔️" },
  { id: "solo", nom: "Gagner {n} étapes en mode Solo", cibles: [4, 6], emoji: "🗺️" },
  { id: "quiz", nom: "Donner {n} bonnes réponses au quiz", cibles: [25, 40], emoji: "❓" },
  { id: "nouvelles", nom: "Découvrir {n} nouvelles cartes", cibles: [30, 50], emoji: "🆕" },
  { id: "speciaux", nom: "Utiliser {n} attaques spéciales", cibles: [15, 25], emoji: "✨" },
  { id: "ko", nom: "Mettre {n} cartes K.O.", cibles: [30, 45], emoji: "💥" },
];
function quetesSemaine() {
  if (S.quetes?.s === semaine()) return S.quetes;
  const r = COMBAT.rng(COMBAT.hash("quetes" + semaine() + (S.compte || "")));
  const choix = MODELES_QUETES.slice().sort(() => r() - 0.5).slice(0, 4);
  S.quetes = { s: semaine(), bonus: false, liste: choix.map((m) => ({ id: m.id, n: m.cibles[Math.floor(r() * m.cibles.length)], prog: 0, recu: false })) };
  return S.quetes;
}
const recompenseQuete = (q) => 200 + q.n * 8;
// Chaque progrès des défis du jour fait aussi avancer les quêtes de la semaine
const progresDefiJour = progresDefi;
progresDefi = function (id, n = 1) {
  progresDefiJour(id, n);
  for (const q of quetesSemaine().liste) {
    if (q.id !== id || q.prog >= q.n) continue;
    q.prog = Math.min(q.n, q.prog + n);
    if (q.prog >= q.n) toast(`🗓️ Quête de la semaine réussie : ${MODELES_QUETES.find((m) => m.id === id).nom.replace("{n}", q.n)} !`, 4500);
  }
};
function recupererQuete(i) {
  const Q = quetesSemaine(), q = Q.liste[i];
  if (!q || q.prog < q.n || q.recu) return;
  q.recu = true; S.coins += recompenseQuete(q); gagnerXP(80);
  if (!Q.bonus && Q.liste.every((x) => x.recu)) { Q.bonus = true; S.boosters.or = (S.boosters.or || 0) + 1; toast("🏆 Toutes les quêtes de la semaine : un booster Or offert !", 5000); }
  sauver(); majCoins(); verifierProgression(); aller(S.vue);
}
function blocQuetes() {
  const Q = quetesSemaine();
  const fin = new Date(semaine()); fin.setDate(fin.getDate() + 7);
  return `<div class="panel defis quetes"><div class="row" style="justify-content:space-between"><h3 style="margin:0">🗓️ Quêtes de la semaine</h3><span class="muted">Toutes réussies : un booster Or ${Q.bonus ? "✓" : ""} · reste ${duree(fin - Date.now())}</span></div>
    ${Q.liste.map((q, i) => { const m = MODELES_QUETES.find((x) => x.id === q.id); return `<div class="defi ${q.recu ? "fait" : ""}"><span class="em">${m.emoji}</span>
      <div style="flex:1;min-width:0"><b>${m.nom.replace("{n}", q.n)}</b><div class="bar"><i style="width:${(q.prog / q.n) * 100}%"></i></div><small class="muted">${q.prog}/${q.n} · +${recompenseQuete(q)} 🪙 +80 XP</small></div>
      ${q.recu ? "✅" : `<button class="btn small ${q.prog >= q.n ? "primary" : ""}" data-quete="${i}" ${q.prog >= q.n ? "" : "disabled"}>Récupérer</button>`}</div>`; }).join("")}</div>`;
}

/* =====================================================================
   Poussière d'étoiles : recycler ses doublons et fabriquer la carte de son choix
   ===================================================================== */
const POUSSIERE_RECYCLAGE = { "commun": 5, "peu-commun": 10, "rare": 25, "epique": 60, "ultra-rare": 100, "legendaire": 150 };
const POUSSIERE_FABRICATION = { "commun": 40, "peu-commun": 80, "rare": 200, "epique": 500, "ultra-rare": 900, "legendaire": 1600 };
// On garde toujours 1 exemplaire (3 si la carte peut encore être forgée en Dorée)
const aGarder = (c) => (S.doree?.[c.id] ? 1 : Math.min(3, S.owned[c.id] || 0) >= 3 ? 1 : 1);
const doublonsRecyclables = (c) => Math.max(0, (S.owned[c.id] || 0) - aGarder(c));
function recycler(c, quantite = doublonsRecyclables(c)) {
  const q = Math.min(quantite, doublonsRecyclables(c));
  if (!q || !POUSSIERE_RECYCLAGE[c.rarete]) return 0;
  S.owned[c.id] -= q;
  const gain = q * POUSSIERE_RECYCLAGE[c.rarete];
  S.poussiere = (S.poussiere || 0) + gain;
  return gain;
}
function fabriquer(c) {
  const prix = POUSSIERE_FABRICATION[c.rarete];
  if (!prix || has(c.id) || c.type === "secrete" || c.saisonnier || (S.poussiere || 0) < prix) return false;
  S.poussiere -= prix; gagner(c.id); sauver(); return true;
}
function toutRecycler() {
  const cartes = CARDS.filter((c) => doublonsRecyclables(c) > 0 && POUSSIERE_RECYCLAGE[c.rarete]);
  const total = cartes.reduce((t, c) => t + doublonsRecyclables(c) * POUSSIERE_RECYCLAGE[c.rarete], 0);
  const nb = cartes.reduce((t, c) => t + doublonsRecyclables(c), 0);
  if (!nb) return toast("Aucun doublon à recycler.");
  confirmer(`Recycler ${fmt(nb)} doublons (vous gardez 1 exemplaire de chaque carte) contre ${fmt(total)} ✨ poussière ? Les niveaux des cartes concernées baisseront.`, "Recycler", () => {
    for (const c of cartes) recycler(c);
    sauver(); fermerModal(); toast(`♻️ +${fmt(total)} ✨ poussière`); aller(S.vue);
  });
}

/* =====================================================================
   Amis (onglet du hub)
   ===================================================================== */
async function hubAmis(el) {
  if (!connecte()) { el.innerHTML = `<div class="panel"><p>Connectez-vous pour ajouter des amis, voir leur collection et les défier.</p><button class="btn primary" data-aller="compte">Se connecter</button></div>`; brancherLiens(el); return; }
  el.innerHTML = `<form class="panel row" id="fAmi" style="gap:8px"><input class="search" id="amiPseudo" placeholder="Pseudo d'un joueur…" maxlength="20" style="flex:1;max-width:none" required><button class="btn primary">➕ Ajouter en ami</button></form>
    <div id="amisListe" style="margin-top:12px"><p class="muted">Chargement…</p></div>`;
  $("#fAmi").onsubmit = async (e) => {
    e.preventDefault();
    try { const r = await api("amis", { methode: "POST", corps: { pseudo: $("#amiPseudo").value.trim() } }); toast(`👫 ${esc(r.pseudo)} ajouté à vos amis !`); hubAmis(el); }
    catch (err) { toast("⚠ " + err.message); }
  };
  try {
    const { amis, demandes } = await api("amis");
    $("#amisListe").innerHTML = `${demandes.length ? `<div class="panel" style="margin-bottom:12px"><b>📨 Ils vous ont ajouté :</b> ${demandes.map((p) => `<button class="chip" data-ajouter="${esc(p)}">➕ ${esc(p)}</button>`).join(" ")}</div>` : ""}
      ${amis.length ? `<div class="amis">${amis.map((a) => `<div class="ami">
        <span class="avatar">${esc(a.pseudo[0].toUpperCase())}</span>
        <div class="ami-infos"><b>${esc(a.pseudo)}${a.premium ? " 💎" : ""} ${a.enLigne ? `<span class="enligne">● en ligne</span>` : ""}</b>
          <small class="muted">${fmt(a.cartes)} cartes · ${a.palier.nom} · 🏆 ${fmt(a.trophees)}${a.reciproque ? "" : " · ne vous a pas encore ajouté"}</small></div>
        <div class="row" style="gap:6px"><button class="btn small" data-collec="${esc(a.pseudo)}">📚 Collection</button>
          <button class="btn small primary" data-defier="${esc(a.pseudo)}" ${a.deck ? "" : "disabled title=\"Pas encore de deck de défense\""}>⚔️ Défier</button>
          <button class="btn small" data-retirer="${esc(a.pseudo)}">✕</button></div></div>`).join("")}</div>`
        : `<p class="muted">Pas encore d'amis. Ajoutez un joueur avec son pseudo (il apparaît dans le fil et le classement).</p>`}`;
    $$("[data-ajouter]", el).forEach((b) => b.onclick = async () => { try { await api("amis", { methode: "POST", corps: { pseudo: b.dataset.ajouter } }); hubAmis(el); } catch (e) { toast("⚠ " + e.message); } });
    $$("[data-retirer]", el).forEach((b) => b.onclick = async () => { await api("amis/" + encodeURIComponent(b.dataset.retirer), { methode: "DELETE" }).catch(() => {}); hubAmis(el); });
    $$("[data-collec]", el).forEach((b) => b.onclick = () => voirCollectionAmi(b.dataset.collec));
    $$("[data-defier]", el).forEach((b) => b.onclick = async () => {
      if (!deckPret()) return;
      try { await envoyerDeckArene(); defier(b.dataset.defier); } catch (e) { toast("⚠ " + e.message); }
    });
  } catch (err) { $("#amisListe").innerHTML = `<p class="err">${esc(err.message)}</p>`; }
}
async function voirCollectionAmi(pseudo) {
  ouvrirModal(`<p class="muted">Chargement de la collection…</p>`);
  try {
    const r = await api("collection/" + encodeURIComponent(pseudo));
    const siennes = new Set(r.cartes), shiny = new Set(r.shiny);
    const lui = CARDS.filter((c) => siennes.has(c.id));
    const manquentAMoi = lui.filter((c) => !has(c.id));
    $("#modal .box").innerHTML = `<button class="close" data-close aria-label="Fermer">✕</button>
      <h2 style="margin-top:0">📚 Collection de ${esc(r.pseudo)}</h2>
      <p class="muted">${fmt(lui.length)} cartes · ${r.shiny.length} ✨ Shiny · ${r.doree.length} 👑 Dorées · <b>${fmt(manquentAMoi.length)}</b> que vous n'avez pas (idéal pour un échange !)</p>
      <div class="toolbar"><button class="chip on" data-vue="manque">Celles qui me manquent</button><button class="chip" data-vue="tout">Toute sa collection</button></div>
      <div class="cards" id="collecAmi" style="max-height:60vh;overflow:auto" data-noclick></div>`;
    const dessiner = (liste) => { $("#collecAmi").innerHTML = liste.slice(0, 200).map((c) => cardHTML(c, { locked: false, shiny: shiny.has(c.id) })).join("") || `<p class="muted">Rien à afficher.</p>`; };
    dessiner(manquentAMoi);
    $$("[data-vue]").forEach((b) => b.onclick = () => { $$("[data-vue]").forEach((x) => x.classList.toggle("on", x === b)); dessiner(b.dataset.vue === "tout" ? lui : manquentAMoi); });
  } catch (err) { $("#modal .box").innerHTML = `<button class="close" data-close>✕</button><p class="err">${esc(err.message)}</p>`; }
}

/* =====================================================================
   Paiement PayPal automatique (si l'administrateur l'a configuré)
   ===================================================================== */
async function brancherPaypal() {
  if (typeof connecte !== "function" || !connecte()) return;
  let config;
  try { config = await api("premium/config"); } catch { return; }
  if (!config.paypalClientId) return;
  const zones = $$("[data-paypal]");
  if (!zones.length) return;
  if (!window.paypal) {
    await new Promise((ok, ko) => { const s = document.createElement("script"); s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(config.paypalClientId)}&currency=EUR&intent=capture`; s.onload = ok; s.onerror = ko; document.head.appendChild(s); }).catch(() => null);
  }
  if (!window.paypal) return;
  for (const zone of zones) {
    const formule = zone.dataset.paypal;
    zone.innerHTML = ""; zone.classList.remove("hidden");
    window.paypal.Buttons({
      style: { layout: "horizontal", tagline: false, height: 40 },
      createOrder: async () => (await api("premium/paypal/commande", { methode: "POST", corps: { formule } })).id,
      onApprove: async (data) => {
        try {
          const r = await api("premium/paypal/valider", { methode: "POST", corps: { commande: data.orderID } });
          majPremium(r.premiumJusqu); majBoutonCompte();
          ouvrirModal(`<div class="reveal"><div style="font-size:56px">💎</div><h2>Merci ! Votre Premium est activé.</h2><p>Profitez de vos avantages dès maintenant.</p><button class="btn primary" data-close>Super !</button></div>`, () => aller("premium"));
        } catch (e) { toast("⚠ " + e.message, 6000); }
      },
      onError: () => toast("⚠ Le paiement PayPal n'a pas abouti."),
    }).render(zone);
    // Le lien manuel devient une solution de secours
    zone.closest(".offre-premium")?.querySelector("[data-payer]")?.classList.add("secours");
  }
}

/* =====================================================================
   Photos corrigées par l'administrateur
   ===================================================================== */
async function chargerCorrectionsPhotos() {
  try {
    const { corrections } = await api("photos/corrections");
    let change = false;
    for (const { carte, titre, maj } of corrections) {
      if (!BY_ID[carte]) continue;
      if (PHOTOS_WIKI[carte] !== titre || (PHOTOS[carte]?.maj || 0) < maj) { PHOTOS_WIKI[carte] = titre; delete PHOTOS[carte]; RECHERCHE_PHOTO[carte] = titre; change = true; }
    }
    if (change) { chargerPhotos().then(() => { for (const { carte, maj } of corrections) if (PHOTOS[carte]) PHOTOS[carte].maj = maj; memoriserPhotos(); }); }
  } catch {}
}
function signalerPhoto(c) {
  ouvrirModal(`<h2 style="margin-top:0">📷 Photo incorrecte ?</h2><p>La photo de « ${esc(c.nom)} » ne correspond pas ? Dites-le à l'administrateur, il pourra la corriger.</p>
    <form class="form" id="fPhoto"><label>Ce qui ne va pas (facultatif)<input id="phNote" maxlength="200" placeholder="Ex. : c'est une autre ville"></label>
    <div class="row" style="justify-content:flex-end"><button type="button" class="btn" data-close>Annuler</button><button class="btn primary">Envoyer</button></div></form>`);
  $("#fPhoto").onsubmit = async (e) => {
    e.preventDefault();
    try { await api("feedback", { methode: "POST", corps: { type: "photo", titre: `Photo : ${c.nom}`, texte: `${c.id} — ${$("#phNote").value || "photo incorrecte"} (article actuel : ${PHOTOS_WIKI[c.id] || "aucun"})` } }); fermerModal(); toast("📷 Merci, l'administrateur va vérifier la photo."); }
    catch (err) { toast("⚠ " + err.message); }
  };
}
async function adminPhotos(el) {
  el.innerHTML = `<form class="panel form" id="fCorrPhoto" style="max-width:640px"><h3 style="margin:0">📷 Corriger la photo d'une carte</h3>
      <label>Carte<input id="cpCarte" list="cpListe" placeholder="Tapez le nom de la carte…" required><datalist id="cpListe"></datalist></label>
      <label>Titre exact de l'article Wikipédia (fr) à utiliser<input id="cpTitre" placeholder="Ex. : Victoria (Seychelles) — vide pour revenir à l'original"></label>
      <button class="btn primary">Enregistrer</button><p class="muted" style="margin:0;font-size:13px">La nouvelle photo apparaît chez tous les joueurs à leur prochaine visite.</p></form>
    <h3>Signalements de photos</h3><div id="cpSignal"><p class="muted">Chargement…</p></div>`;
  $("#cpCarte").oninput = (e) => {
    const q = sansAccents(e.target.value);
    $("#cpListe").innerHTML = q.length < 2 ? "" : CARDS.filter((c) => sansAccents(c.nom).includes(q)).slice(0, 20).map((c) => `<option value="${esc(c.id)}">${esc(c.nom)} (${TYPES[c.type]})</option>`).join("");
  };
  $("#fCorrPhoto").onsubmit = async (e) => {
    e.preventDefault();
    try { await api("admin/photos", { methode: "POST", corps: { carte: $("#cpCarte").value.trim(), titre: $("#cpTitre").value.trim() } }); toast("📷 Photo corrigée."); chargerCorrectionsPhotos(); }
    catch (err) { toast("⚠ " + err.message); }
  };
  try {
    const { feedbacks } = await api("feedback/liste");
    const photos = feedbacks.filter((f) => f.type === "photo" && f.statut !== "resolu");
    $("#cpSignal").innerHTML = photos.length ? `<div class="posts">${photos.map((f) => `<article class="post"><header><b>${esc(f.titre)}</b><span class="muted">${esc(f.pseudo)} · ${depuis(f.cree_le)}</span></header><p class="txt">${esc(f.texte)}</p>
      <footer><button class="btn small" data-corr="${esc(f.texte.split(" ")[0])}" data-fb="${f.id}">Corriger</button><button class="btn small" data-fbok="${f.id}">Marquer résolu</button></footer></article>`).join("")}</div>` : `<p class="muted">Aucun signalement de photo.</p>`;
    $$("[data-corr]").forEach((b) => b.onclick = () => { $("#cpCarte").value = b.dataset.corr; $("#cpTitre").focus(); });
    $$("[data-fbok]").forEach((b) => b.onclick = async () => { await api(`feedback/${b.dataset.fbok}/statut`, { methode: "POST", corps: { statut: "resolu" } }).catch(() => {}); adminPhotos(el); });
  } catch (e) { $("#cpSignal").innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}
