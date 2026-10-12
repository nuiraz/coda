"use strict";
/* =====================================================================
   Play2F1 — v5 : Discord, défi du jour, tutoriel, boosters limités, Coupe des nations,
   duels en spectateur, cartes recherchées
   ===================================================================== */

/* ---------- Discord : lien d'invitation dans le jeu ---------- */
const lienDiscord = () => REGLAGES?.discord || "https://discord.gg/uHnvkZYB6c";
const ouvrirDiscord = () => window.open(lienDiscord(), "_blank", "noopener");
addEventListener("DOMContentLoaded", () => {
  const liens = document.querySelector(".pied .liens");
  if (liens) { liens.insertAdjacentHTML("beforeend", ` · <a href="#" id="piedDiscord">💬 Discord</a>`); $("#piedDiscord").onclick = (e) => { e.preventDefault(); ouvrirDiscord(); }; }
});
const _vueAccueilV5 = vueAccueil;
vueAccueil = function (v) {
  const r = _vueAccueilV5.apply(this, arguments);
  const t = $(".tuiles", v);
  if (t && !$("#tuileDiscord", v)) {
    t.insertAdjacentHTML("beforeend", `<button class="tuile tuile-discord" id="tuileDiscord"><span class="t-ic">💬</span><span class="t-txt"><b>Discord</b><small>Rejoignez la communauté</small></span></button>`);
    $("#tuileDiscord").onclick = ouvrirDiscord;
  }
  return r;
};
const _vueHubV5 = vueHub;
vueHub = function (v) {
  const r = _vueHubV5.apply(this, arguments);
  if (!$(".bandeau-discord", v) && (typeof hubEtat === "undefined" || hubEtat.onglet === "accueil")) {
    const b = document.createElement("a");
    b.className = "panel bandeau-discord"; b.href = lienDiscord(); b.target = "_blank"; b.rel = "noopener";
    b.innerHTML = `<span class="big">💬</span><div><b>Rejoignez le Discord de Play2F1</b><br><span class="muted">Annonces, échanges, tournois et entraide entre collectionneurs.</span></div><span class="btn primary">Rejoindre</span>`;
    const h = $(".hub2-titre", v) || $(".page-tete", v) || $(".sectiontitle", v);
    if (h) h.after(b); else v.prepend(b);
  }
  return r;
};

/* =====================================================================
   Défi du jour : deviner un pays d'après sa silhouette en 6 essais
   ===================================================================== */
const CLE_DEFI = "worldcards:defi";
const defiLocal = () => { try { return JSON.parse(localStorage.getItem(CLE_DEFI)) || null; } catch { return null; } };
const garderDefiLocal = (d) => { try { localStorage.setItem(CLE_DEFI, JSON.stringify(d)); } catch {} };
const carresProximite = (p) => { const pleins = Math.floor(p / 20), demi = p % 20 >= 10 && pleins < 5 ? 1 : 0; return "🟩".repeat(pleins) + "🟨".repeat(demi) + "⬜".repeat(5 - pleins - demi); };
function texteDefi(d) {
  const n = d.essais.length, ok = d.gagne;
  return `🌍 Play2F1 · Défi du jour n° ${d.numero} — ${ok ? n : "X"}/${d.essaisMax}\n${d.essais.map((e) => `${carresProximite(e.proximite)} ${e.fleche}`).join("\n")}\nhttps://play2f1.com/#defi`;
}
async function partagerDefi(d) {
  const t = texteDefi(d);
  try { if (navigator.share) { await navigator.share({ text: t }); return; } } catch (e) { if (e?.name === "AbortError") return; }
  try { await navigator.clipboard.writeText(t); toast("📋 Résultat copié : collez-le où vous voulez !"); } catch { prompt("Copiez votre résultat :", t); }
}
async function vueDefi(v) {
  v.innerHTML = `<header class="page-tete"><h1>🌍 Défi du jour</h1><p>Quel est ce pays ? Vous avez <b>6 essais</b>. Après chaque essai : la distance, la direction et la proximité avec le bon pays. Un nouveau pays chaque jour à minuit.</p></header><div id="dfCorps"><p class="muted">Chargement…</p></div>`;
  // Au démarrage, le compte se charge juste après la première page : on l'attend un instant
  for (let i = 0; i < 40 && typeof COMPTE !== "undefined" && COMPTE.etat === "inconnu"; i++) await new Promise((r) => setTimeout(r, 100));
  let d; try { d = await api("defi"); } catch (e) { $("#dfCorps").innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
  const connecteV = typeof connecte === "function" && connecte();
  if (!connecteV) { // sans compte : les essais restent dans le navigateur
    const l = defiLocal();
    if (l?.jour === d.jour) Object.assign(d, { essais: l.essais, fini: l.fini, gagne: l.gagne, solution: l.solution });
    else d.essais = [];
  }
  d.essais ||= [];
  S.tuto = { ...(S.tuto || {}), defi: true };
  if (d.fini) S.defiJour = d.jour;
  const noms = Object.fromEntries(d.pays), parNom = new Map(d.pays.map(([c, n]) => [sansAccents(n), c]));
  const dessiner = () => {
    const el = $("#dfCorps"); if (!el) return;
    const lignes = [...d.essais.map((e) => `<div class="df-essai ${e.juste ? "juste" : ""}"><span class="df-nom">${BY_ID["pays:" + e.code] ? `<img src="flags/${e.code.toLowerCase()}.svg" alt="">` : ""}${esc(e.nom)}</span><span>${e.juste ? "🎯" : fmt(e.distance) + " km"}</span><span class="df-fleche">${e.fleche}</span><span class="df-prox"><i style="width:${e.proximite}%"></i><b>${e.proximite} %</b></span></div>`),
      ...Array(Math.max(0, d.essaisMax - d.essais.length)).fill(`<div class="df-essai vide"><span>&nbsp;</span></div>`)].join("");
    const sol = d.solution ? BY_ID["pays:" + d.solution.code] : null;
    el.innerHTML = `<div class="df-grille"><section class="panel df-jeu">
        <div class="df-num">Défi n° ${d.numero}${d.serie ? ` · 🔥 série de ${d.serie} jour${d.serie > 1 ? "s" : ""}` : ""}</div>
        <div class="df-sil ${d.fini ? (d.gagne ? "gagne" : "perdu") : ""}"><svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-label="Silhouette du pays mystère"><path d="${esc(d.silhouette)}"/></svg></div>
        <div class="df-essais">${lignes}</div>
        ${d.fini ? `<div class="df-fin"><h3>${d.gagne ? `🎉 Bravo ! Trouvé en ${d.essais.length} essai${d.essais.length > 1 ? "s" : ""}` : "😢 Perdu pour aujourd'hui"}</h3>
            <p>C'était <b>${esc(d.solution.nom)}</b>${sol ? ` <button class="lien-chances" id="dfFiche">voir la carte</button>` : ""}.</p>
            ${d.recompense ? `<p class="sc-ok">+${d.recompense} 🪙 ajoutés à votre compte !</p>` : ""}
            <div class="row" style="justify-content:center"><button class="btn primary" id="dfPartager">📤 Partager mon résultat</button>${!connecteV ? `<button class="btn" id="dfCompte">Créer un compte</button>` : ""}</div>
            <p class="muted" style="font-size:13px">Nouveau pays demain à minuit (heure de Bruxelles).</p></div>`
          : `<form class="df-form" id="dfForm"><input id="dfQ" list="dfListe" placeholder="Tapez un pays…" autocomplete="off" required><datalist id="dfListe">${d.pays.map(([, n]) => `<option value="${esc(n)}">`).join("")}</datalist><button class="btn primary">Deviner (${d.essais.length + 1}/${d.essaisMax})</button></form><p class="err" id="dfErr"></p>`}
      </section>
      <aside class="panel df-cote"><h3 style="margin-top:0">🏆 Classement du jour</h3>
        ${d.top?.length ? `<ol class="df-top">${d.top.map((x) => `<li><b>${esc(x.pseudo)}</b><span>${x.n}/6</span></li>`).join("")}</ol>` : `<p class="muted">Personne n'a encore trouvé aujourd'hui. Soyez le premier !</p>`}
        <p class="muted" style="font-size:13px">${d.joueurs} joueur${d.joueurs > 1 ? "s" : ""} aujourd'hui · ${d.gagnants || 0} ont trouvé.</p>
        <h4>Récompenses (avec un compte)</h4><p class="muted" style="font-size:13px">${d.recompenses.slice(1).map((r, i) => `${i + 1} essai${i ? "s" : ""} : ${r} 🪙`).join(" · ")}</p>
        ${connecteV ? "" : `<p class="df-invit">Jouez avec un compte gratuit pour gagner des pièces, garder votre série et entrer au classement.</p>`}</aside></div>`;
    $("#dfFiche")?.addEventListener("click", () => ficheCarte(sol));
    $("#dfPartager")?.addEventListener("click", () => partagerDefi(d));
    $("#dfCompte")?.addEventListener("click", () => aller("compte"));
    const f = $("#dfForm");
    if (f) {
      $("#dfQ").focus({ preventScroll: true });
      f.onsubmit = async (e) => {
        e.preventDefault();
        const q = sansAccents($("#dfQ").value.trim()), code = parNom.get(q) || [...parNom.entries()].find(([n]) => n.startsWith(q) && q.length >= 3)?.[1];
        if (!code) { $("#dfErr").textContent = "Choisissez un pays de la liste."; return; }
        if (d.essais.some((x) => x.code === code)) { $("#dfErr").textContent = `Vous avez déjà proposé ${noms[code]}.`; return; }
        f.querySelector("button").disabled = true;
        try {
          const r = await api("defi/essai", { methode: "POST", corps: { code, numero: d.essais.length + 1 } });
          if (r.essais) d.essais = r.essais; else d.essais.push(r.resultat);
          Object.assign(d, { fini: r.fini, gagne: r.gagne, solution: r.solution, recompense: r.recompense || 0 });
          if (r.serie !== undefined && r.fini) d.serie = r.serie;
          if (r.fini) S.defiJour = d.jour;
          if (!connecteV) garderDefiLocal({ jour: d.jour, essais: d.essais, fini: d.fini, gagne: d.gagne, solution: d.solution });
          if (r.gagne) { navigator.vibrate?.([30, 50, 80]); if (typeof son === "function") son("niveau"); if (r.recompense && typeof verifierCadeaux === "function") verifierCadeaux(); }
          sauver(); dessiner();
        } catch (err) { $("#dfErr").textContent = err.message; f.querySelector("button").disabled = false; }
      };
    }
  };
  dessiner();
}
ajouterPage("defi", "🌍", "Défi du jour", vueDefi);

/* =====================================================================
   Tutoriel des nouveaux joueurs : 5 étapes guidées et une récompense
   ===================================================================== */
const _allerV5 = aller;
aller = function (vue) {
  if (vue === "album" && S && !S.tuto?.collection) { S.tuto = { ...(S.tuto || {}), collection: true }; }
  return _allerV5.apply(this, arguments);
};
function etapesTuto() {
  const t = S.tuto || {}, possedees = Object.keys(S.owned || {}).length;
  return [
    { cle: "booster", ic: "🎁", nom: "Ouvrez votre premier booster", fait: (S.ouverts || 0) >= 1, aller: "boosters", aide: "Touchez un booster, puis déchirez-le !" },
    { cle: "collection", ic: "📚", nom: "Découvrez votre collection", fait: !!t.collection, aller: "album", aide: "Toutes vos cartes, rangées par pays et par type." },
    { cle: "deck", ic: "🃏", nom: "Préparez votre deck", fait: (S.deck || []).length >= Math.max(1, Math.min(COMBAT.TAILLE_DECK, possedees)), aller: "combat", aide: `Choisissez jusqu'à ${COMBAT.TAILLE_DECK} cartes pour combattre (bouton « Remplir automatiquement »).` },
    { cle: "combat", ic: "⚔️", nom: "Jouez votre premier combat", fait: ((S.combat?.victoires || 0) + (S.combat?.defaites || 0)) >= 1, aller: "combat", aide: "Un combat d'entraînement contre l'ordinateur suffit." },
    { cle: "defi", ic: "🌍", nom: "Tentez le défi du jour", fait: !!t.defi, aller: "defi", aide: "Devinez le pays mystère d'après sa silhouette." },
  ];
}
function blocTuto(v) {
  if (S.tuto?.fini || S.tuto?.masque || (S.ouverts || 0) > 60) return;
  const etapes = etapesTuto(), faites = etapes.filter((e) => e.fait).length, prochaine = etapes.find((e) => !e.fait);
  const el = document.createElement("section");
  el.className = "panel tuto";
  el.innerHTML = `<div class="tuto-tete"><div><h3>🎓 Bien démarrer <small>${faites}/${etapes.length}</small></h3><p class="muted">Terminez ces étapes et recevez <b>500 🪙 + 3 boosters</b> (dont un Argent).</p></div><button class="lien-chances" id="tutoMasquer">Masquer</button></div>
    <div class="tuto-barre"><i style="width:${(faites / etapes.length) * 100}%"></i></div>
    <ol class="tuto-etapes">${etapes.map((e) => `<li class="${e.fait ? "fait" : e === prochaine ? "prochaine" : ""}"><span class="te-ic">${e.fait ? "✅" : e.ic}</span><div><b>${e.nom}</b>${e === prochaine ? `<small>${e.aide}</small>` : ""}</div>${e.fait ? "" : `<button class="btn small ${e === prochaine ? "primary" : ""}" data-tuto="${e.aller}">Y aller</button>`}</li>`).join("")}</ol>
    ${!prochaine ? `<button class="btn primary" id="tutoRecompense" style="width:100%">🎁 Récupérer ma récompense</button>` : ""}`;
  const ab = $(".accueil-booster", v);
  if (ab) ab.before(el); else v.prepend(el);
  $$("[data-tuto]", el).forEach((b) => b.onclick = () => aller(b.dataset.tuto));
  $("#tutoMasquer").onclick = () => { S.tuto = { ...(S.tuto || {}), masque: true }; sauver(); el.remove(); };
  $("#tutoRecompense")?.addEventListener("click", async () => {
    if (typeof connecte !== "function" || !connecte()) { toast("Créez un compte gratuit pour récupérer la récompense (et sauvegarder votre collection)."); aller("compte"); return; }
    const b = $("#tutoRecompense"); b.disabled = true;
    try {
      if (typeof envoyerSauvegarde === "function") await envoyerSauvegarde().catch(() => {});
      await api("tuto/recompense", { methode: "POST", corps: {} });
      S.tuto = { ...(S.tuto || {}), fini: Date.now() }; sauver();
      ouvrirModal(`<div class="reveal"><div style="font-size:56px">🎓</div><h2>Bravo, vous êtes prêt !</h2><p>500 🪙 et 3 boosters arrivent dans votre collection.</p><button class="btn primary" data-close>Ouvrir mes boosters</button></div>`, () => { if (typeof verifierCadeaux === "function") verifierCadeaux(); aller("boosters"); });
    } catch (e) {
      if (/déjà/.test(e.message)) { S.tuto = { ...(S.tuto || {}), fini: Date.now() }; sauver(); el.remove(); }
      toast("⚠ " + e.message, 6000); b.disabled = false;
    }
  });
}
// Accueil : le tutoriel (nouveaux joueurs) et le défi du jour
const _vueAccueilV5b = vueAccueil;
vueAccueil = function (v) {
  const r = _vueAccueilV5b.apply(this, arguments);
  blocTuto(v);
  const t = $(".tuiles", v);
  if (t && !$("#tuileDefi", v)) {
    const l = defiLocal(), aujourdhui = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Brussels" });
    const fait = S.defiJour === aujourdhui || (l?.jour === aujourdhui && l.fini);
    t.insertAdjacentHTML("afterbegin", `<button class="tuile ${fait ? "" : "chaude"}" id="tuileDefi"><span class="t-ic">🌍</span><span class="t-txt"><b>Défi du jour</b><small>${fait ? "✅ Fait : revenez demain" : "Quel est ce pays ? 6 essais"}</small></span></button>`);
    $("#tuileDefi").onclick = () => aller("defi");
  }
  return r;
};

/* =====================================================================
   Boosters à durée limitée : compte à rebours en direct et annonce de l'événement à venir
   ===================================================================== */
function texteRebours(ms) {
  if (ms <= 0) return "terminé";
  const j = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1000) % 60;
  const d2 = (n) => String(n).padStart(2, "0");
  return j ? `${j} j ${d2(h)} h ${d2(m)} min` : `${d2(h)} h ${d2(m)} min ${d2(s)} s`;
}
const reboursHTML = (fin, prefixe = "Plus que") => `<span class="rebours" data-fin="${fin}"><small>${prefixe}</small> <b>${texteRebours(fin - Date.now())}</b></span>`;
setInterval(() => {
  for (const el of document.querySelectorAll(".rebours[data-fin]")) {
    const reste = Number(el.dataset.fin) - Date.now(), b = el.querySelector("b");
    if (b) b.textContent = texteRebours(reste);
    if (reste <= 0 && !el.dataset.fini) { el.dataset.fini = "1"; if (typeof chargerEvenement === "function") chargerEvenement(); }
  }
}, 1000);
function decorerEvenement(v) {
  const ev = EVENEMENT && EVENEMENTS_SAISONNIERS?.[EVENEMENT.cle] ? EVENEMENTS_SAISONNIERS[EVENEMENT.cle] : null;
  const ban = $(".bandeau-evenement", v);
  if (ev && ban && !$(".rebours", ban)) $("div", ban)?.insertAdjacentHTML("beforeend", `<br>${reboursHTML(EVENEMENT.fin)}`);
  const ev2 = PROCHAIN_EVENEMENT && EVENEMENTS_SAISONNIERS?.[PROCHAIN_EVENEMENT.cle];
  if (!ev && ev2 && !$(".bandeau-bientot", v)) {
    const el = document.createElement("div");
    el.className = "panel bandeau-evenement bandeau-bientot"; el.style.setProperty("--ec", ev2.couleur || "var(--accent)");
    el.innerHTML = `<span class="big">${ev2.emoji}</span><div><b>Bientôt : événement ${esc(ev2.nom)}</b><br><span>${ev2.cartes.length} cartes exclusives et un booster limité.</span><br>${reboursHTML(PROCHAIN_EVENEMENT.debut, "Début dans")}</div>`;
    const ref = $(".accueil-booster", v) || v.firstChild;
    ref?.after(el);
  }
}
const _vueAccueilV5c = vueAccueil;
vueAccueil = function (v) { const r = _vueAccueilV5c.apply(this, arguments); decorerEvenement(v); return r; };
const _vueBoostersV5 = vueBoosters;
vueBoosters = function (v) {
  const r = _vueBoostersV5.apply(this, arguments);
  const t = $(".boutique.evenement", v);
  if (t && EVENEMENT && !$(".rebours", t.previousElementSibling || t)) (t.previousElementSibling || t).insertAdjacentHTML("beforeend", reboursHTML(EVENEMENT.fin));
  return r;
};

/* =====================================================================
   Coupe des nations : chaque joueur représente un pays
   ===================================================================== */
const drapeau = (code) => `<img class="drap" src="flags/${esc(String(code).toLowerCase())}.svg" alt="" loading="lazy">`;
async function vueNations(v) {
  v.innerHTML = `<header class="page-tete"><h1>🏳️ Coupe des nations</h1><p>Représentez un pays : vos points de la semaine s'ajoutent à ceux de tous ses joueurs. Lundi, les membres actifs des 3 meilleures nations reçoivent un lot.</p></header><div id="naCorps"><p class="muted">Chargement…</p></div>`;
  for (let i = 0; i < 40 && typeof COMPTE !== "undefined" && COMPTE.etat === "inconnu"; i++) await new Promise((r) => setTimeout(r, 100));
  let d; try { d = await api("nations"); } catch (e) { $("#naCorps").innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
  const el = $("#naCorps"); if (!el) return;
  const lots = d.lots.map((l, i) => `${["🥇", "🥈", "🥉"][i]} ${l.pieces} 🪙${Object.entries(l.boosters).map(([k, n]) => ` + ${n} booster ${PACKS[k]?.nom || k}`).join("")}`).join(" · ");
  const moi = d.moi;
  el.innerHTML = `<div class="na-grille">
    <section class="panel na-moi">${moi ? (moi.nation ? `<div class="na-pays">${drapeau(moi.nation)}<div><small class="muted">Vous représentez</small><h2>${esc(moi.nom)}</h2></div></div>
        <p>Vos points cette semaine : <b>${moi.points}</b>${moi.points < d.minPoints ? ` <small class="muted">(${d.minPoints} minimum pour recevoir le lot)</small>` : " ✅"}</p>
        ${moi.membres.length ? `<h4>Meilleurs joueurs de ${esc(moi.nom)}</h4><ol class="df-top">${moi.membres.map((m) => `<li><b>${esc(m.pseudo)}</b><span>${m.points} pts</span></li>`).join("")}</ol>` : ""}
        <details><summary class="muted">Changer de pays</summary><div class="na-choix"></div></details>`
      : `<h3 style="margin-top:0">Choisissez votre pays</h3><p class="muted">Vous pourrez en changer tous les 30 jours.</p><div class="na-choix"></div>`)
      : `<h3 style="margin-top:0">Rejoignez la Coupe</h3><p>Créez un compte gratuit pour représenter votre pays.</p><button class="btn primary" id="naCompte">Créer un compte</button>`}
      <h4>Comment gagner des points</h4><ul class="na-regles"><li>Venir jouer chaque jour : <b>+1</b></li><li>Réussir le défi du jour : <b>+1 à +6</b></li><li>Victoire classée en arène : <b>+3</b></li><li>Duel classé gagné : <b>+5</b></li></ul>
      <p class="muted" style="font-size:13px">Lots du lundi : ${lots}.</p></section>
    <section class="panel"><div class="na-tete"><h3 style="margin:0">Classement de la semaine</h3>${reboursHTML(d.fin, "Fin dans")}</div>
      ${d.classement.length ? `<table class="classement na-table"><tbody>${d.classement.map((n, i) => `<tr class="${moi?.nation === n.nation ? "moi" : ""}"><td>${["🥇", "🥈", "🥉"][i] || i + 1}</td><td>${drapeau(n.nation)} <b>${esc(n.nom)}</b><br><small class="muted">${n.joueurs} joueur${n.joueurs > 1 ? "s" : ""} · meilleur : ${esc(n.meilleur || "—")}</small></td><td><b>${fmt(n.points)}</b> pts</td></tr>`).join("")}</tbody></table>`
        : `<p class="muted">Aucun point cette semaine pour l'instant. Choisissez votre pays et marquez les premiers !</p>`}
      ${d.precedente.length ? `<h4>Semaine dernière</h4><p>${d.precedente.map((n, i) => `${["🥇", "🥈", "🥉"][i]} ${drapeau(n.nation)} ${esc(n.nom)} (${fmt(n.points)})`).join(" · ")}</p>` : ""}</section></div>`;
  $("#naCompte")?.addEventListener("click", () => aller("compte"));
  const choix = $(".na-choix", el);
  if (choix) {
    choix.innerHTML = `<form class="row" id="naForm"><select id="naPays" style="flex:1;min-width:180px">${d.pays.map(([c, n]) => `<option value="${c}" ${moi?.nation === c ? "selected" : ""}>${esc(n)}</option>`).join("")}</select><button class="btn primary">Représenter ce pays</button></form><p class="err" id="naErr"></p>`;
    $("#naForm").onsubmit = async (e) => {
      e.preventDefault();
      try { await api("nations/moi", { methode: "PUT", corps: { code: $("#naPays").value } }); toast("🏳️ C'est noté : vous jouez pour " + $("#naPays").selectedOptions[0].textContent + " !"); aller("nations"); }
      catch (err) { $("#naErr").textContent = err.message; }
    };
  }
}
ajouterPage("nations", "🏳️", "Coupe des nations", vueNations);
