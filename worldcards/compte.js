"use strict";
/* Comptes, sauvegarde dans le cloud, hub communautaire, administration, pages légales et app installable.
   Ce fichier ne fait que déclarer des fonctions : app.js appelle initCompte() au démarrage. */

// À personnaliser : coordonnées affichées dans les mentions légales
const EDITEUR = "nuiraz";
const CONTACT = "[votre adresse e-mail de contact]";
const NOM_SITE = "WorldCards";
// Vente du Premium : la loi impose d'indiquer l'identité réelle du vendeur et son adresse (ou son numéro SIRET)
const ADRESSE = ""; // ex. : "Prénom Nom, 1 rue Exemple, 75000 Paris"
const SIRET = "";   // ex. : "SIRET 123 456 789 00010 (micro-entreprise)"
const TVA_NON_APPLICABLE = true;

let COMPTE = { etat: "inconnu", pseudo: null, admin: false, creeLe: null, premiumJusqu: 0 };
// Le statut Premium est mémorisé pour rester actif hors ligne
try { COMPTE.premiumJusqu = Number(localStorage.getItem("worldcards:premium")) || 0; } catch {}
const estPremium = () => COMPTE.premiumJusqu > Date.now();
const PREMIUM_VIE = 4102444800000; // « à vie » : jusqu'en 2100
function majPremium(jusqu) {
  COMPTE.premiumJusqu = Number(jusqu) || 0;
  try { localStorage.setItem("worldcards:premium", String(COMPTE.premiumJusqu)); } catch {}
  if (typeof renderNav === "function") renderNav();
}
const PAYPAL = "https://paypal.me/noozoaa";
const OFFRES_PREMIUM = { mois: { nom: "1 mois", prix: "5,99 €", lien: PAYPAL + "/5.99EUR" }, vie: { nom: "À vie", prix: "39,99 €", lien: PAYPAL + "/39.99EUR" } };
let SYNC = { etat: "", timer: 0, enCours: false, encore: false };

/* =====================================================================
   Appels au serveur
   ===================================================================== */
async function api(chemin, { methode = "GET", corps, keepalive = false } = {}) {
  let r;
  try {
    r = await fetch("/api/" + chemin, {
      method: methode, credentials: "same-origin", keepalive,
      headers: corps !== undefined ? { "content-type": "application/json" } : {},
      body: corps !== undefined ? JSON.stringify(corps) : undefined,
    });
  } catch {
    const e = new Error("Pas de connexion au serveur."); e.status = 0; throw e;
  }
  let j = null;
  try { j = await r.json(); } catch {}
  if (!r.ok || !j) {
    const e = new Error(j?.erreur || (r.status === 404 || !j ? "Les comptes ne sont pas disponibles sur ce site." : `Erreur ${r.status}`));
    e.status = !j ? 404 : r.status; throw e;
  }
  return j;
}
const connecte = () => COMPTE.etat === "connecte";

/* =====================================================================
   Démarrage
   ===================================================================== */
async function initCompte() {
  installerPWA();
  majBoutonCompte();
  if (location.protocol === "file:") { COMPTE.etat = "indispo"; majBoutonCompte(); return; }
  try {
    const moi = await api("moi");
    if (moi.connecte) { Object.assign(COMPTE, { etat: "connecte", pseudo: moi.pseudo, admin: moi.admin, creeLe: moi.creeLe }); majPremium(moi.premiumJusqu); await apresConnexion(false); }
    else { COMPTE.etat = "anonyme"; majPremium(0); }
  } catch (e) {
    COMPTE.etat = e.status === 0 ? "hors-ligne" : "indispo";
  }
  majBoutonCompte();
  if (["compte", "hub", "admin", "premium", "combat"].includes(S.vue) && $("#modal").classList.contains("hidden")) aller(S.vue);
}
function majBoutonCompte() {
  const b = $("#compteBtn");
  if (!b) return;
  const icone = { "": "", attente: " ⋯", ok: " ✓", erreur: " ⚠" }[SYNC.etat] || "";
  b.innerHTML = connecte() ? `<span class="avatar">${esc(COMPTE.pseudo[0].toUpperCase())}</span><span class="lbl">${esc(COMPTE.pseudo)}</span>${COMPTE.admin ? "👑" : ""}${estPremium() ? "💎" : ""}<span class="sync">${icone}</span>` : "👤<span class='lbl'> Connexion</span>";
  b.title = connecte() ? `Mon compte (${SYNC.etat === "ok" ? "sauvegardé dans le cloud" : SYNC.etat === "erreur" ? "sauvegarde en échec" : "synchronisation"})` : "Se connecter ou créer un compte";
}

/* =====================================================================
   Sauvegarde dans le cloud
   ===================================================================== */
const nbCartes = (save) => Object.keys(save?.owned || {}).filter((id) => !id.startsWith("perso:")).length;
function resumeSauvegarde() {
  const ids = CARDS.map((c) => c.id);
  return { cartes: count(ids.filter((id) => !BY_ID[id].type.includes("secrete"))), secretes: count(CARDS.filter((c) => c.type === "secrete").map((c) => c.id)), badges: Object.keys(S.badges).length };
}
// Appelé par app.js à chaque sauvegarde locale
function apresSauvegarde() {
  if (!connecte()) return;
  SYNC.etat = "attente"; majBoutonCompte();
  clearTimeout(SYNC.timer);
  SYNC.timer = setTimeout(envoyerSauvegarde, 4000);
}
async function envoyerSauvegarde() {
  clearTimeout(SYNC.timer);
  if (!connecte()) return;
  if (SYNC.enCours) { SYNC.encore = true; return; }
  SYNC.enCours = true;
  try {
    S.compte = COMPTE.pseudo;
    await api("sauvegarde", { methode: "PUT", corps: { data: { sauvegarde: S, perso: PERSO }, resume: resumeSauvegarde(), vitrine: S.vitrine || [] } });
    SYNC.etat = "ok";
  } catch (e) {
    SYNC.etat = "erreur";
    if (e.status === 401) { COMPTE.etat = "anonyme"; toast("Votre session a expiré : reconnectez-vous pour sauvegarder dans le cloud."); }
    else if (e.status === 413) toast("⚠ " + e.message, 6000);
  } finally {
    SYNC.enCours = false; majBoutonCompte();
    if (SYNC.encore) { SYNC.encore = false; envoyerSauvegarde(); }
  }
}
addEventListener("pagehide", () => {
  if (connecte() && SYNC.etat === "attente") {
    const corps = { data: { sauvegarde: S, perso: PERSO }, resume: resumeSauvegarde(), vitrine: S.vitrine || [] };
    if (JSON.stringify(corps).length < 60000) api("sauvegarde", { methode: "PUT", corps, keepalive: true }).catch(() => {});
  }
});
function appliquerSauvegardeCloud(data) {
  S = migrer(data.sauvegarde);
  PERSO = data.perso || PERSO;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch {}
  sauverPerso(); appliquerTheme(); majCoins();
}
// Après connexion : réunir la progression de cet appareil et celle du cloud
async function apresConnexion(interactif) {
  let cloud = null;
  try { cloud = (await api("sauvegarde")).data; } catch { SYNC.etat = "erreur"; majBoutonCompte(); return; }
  const local = nbCartes(S), distant = nbCartes(cloud?.sauvegarde);
  if (!cloud?.sauvegarde) { await envoyerSauvegarde(); }
  else if (S.compte === COMPTE.pseudo) {
    // Appareil déjà relié à ce compte : la version la plus récente gagne
    if ((cloud.sauvegarde.majLocale || 0) > (S.majLocale || 0)) { appliquerSauvegardeCloud(cloud); aller(S.vue); }
    else await envoyerSauvegarde();
  } else if (local === 0 && !S.ouverts) { appliquerSauvegardeCloud(cloud); aller(S.vue); }
  else if (interactif) {
    await new Promise((fin) => {
      ouvrirModal(`<h2 style="margin-top:0">Quelle progression garder ?</h2>
        <p>Votre compte contient déjà une sauvegarde. Choisissez celle à garder ; l'autre sera remplacée.</p>
        <div class="grid2">
          <button class="choix" id="gCloud"><b>☁️ Celle du compte</b><span>${distant} cartes · ${fmt(cloud.sauvegarde.coins || 0)} 🪙</span></button>
          <button class="choix" id="gLocal"><b>📱 Celle de cet appareil</b><span>${local} cartes · ${fmt(S.coins)} 🪙</span></button>
        </div>`, () => fin());
      $("#gCloud").onclick = () => { appliquerSauvegardeCloud(cloud); S.compte = COMPTE.pseudo; sauver(); fermerModal(); aller(S.vue); toast("☁️ Progression du compte récupérée."); };
      $("#gLocal").onclick = async () => { await envoyerSauvegarde(); fermerModal(); toast("☁️ Progression de cet appareil enregistrée sur le compte."); };
    });
  } else { appliquerSauvegardeCloud(cloud); aller(S.vue); }
  SYNC.etat = SYNC.etat || "ok"; majBoutonCompte();
  verifierCadeaux();
}
async function verifierCadeaux() {
  try {
    const { cadeaux } = await api("cadeaux");
    for (const c of cadeaux) {
      const g = await api(`cadeaux/${c.id}/recevoir`, { methode: "POST", corps: {} });
      S.coins += g.pieces;
      S.boosters.monde += g.boosters;
      sauver(); majCoins(); renderNav();
      ouvrirModal(`<div class="reveal"><div style="font-size:56px">🎁</div><h2>Un cadeau de l'équipe ${NOM_SITE} !</h2>
        ${g.message ? `<p>« ${esc(g.message)} »</p>` : ""}
        <p><b>${g.pieces ? `+${fmt(g.pieces)} 🪙` : ""}${g.pieces && g.boosters ? " et " : ""}${g.boosters ? `+${g.boosters} booster${g.boosters > 1 ? "s" : ""}` : ""}</b></p>
        <button class="btn primary" data-close>Merci !</button></div>`);
    }
  } catch {}
}

/* =====================================================================
   Vue « Mon compte »
   ===================================================================== */
function lienLegal(page, texte) { return `<a href="#" data-legal="${page}">${texte}</a>`; }
function brancherLiens(root) {
  $$("[data-legal]", root).forEach((a) => a.onclick = (e) => { e.preventDefault(); fermerModal(); aller("legal", { page: a.dataset.legal }); });
  $$("[data-aller]", root).forEach((a) => a.onclick = (e) => { e.preventDefault(); aller(a.dataset.aller); });
}
function vueCompte(v) {
  const indispo = ["indispo", "hors-ligne", "inconnu"].includes(COMPTE.etat);
  let haut = "";
  if (indispo) {
    haut = `<div class="panel"><h2 style="margin-top:0">👤 Compte</h2>
      <p>${COMPTE.etat === "inconnu" ? "Vérification…" : COMPTE.etat === "hors-ligne" ? "Pas de connexion internet : les comptes reviendront dès que vous serez en ligne." : "Les comptes ne sont pas disponibles sur cette version du jeu (ouverte depuis un fichier, ou serveur non configuré)."}</p>
      <p class="muted">Votre progression reste enregistrée sur cet appareil.</p></div>`;
  } else if (!connecte()) {
    haut = `<div class="panel"><h2 style="margin-top:0">Créez votre compte ${NOM_SITE}</h2>
      <p class="muted" style="margin-top:0">Gratuit, sans adresse e-mail. Votre collection est sauvegardée dans le cloud et vous la retrouvez sur tous vos appareils. Vous rejoignez aussi le hub communautaire : messages, classement et vitrine de vos plus belles cartes.</p>
      <div class="grid2">
        <form class="form" id="fConnexion" autocomplete="on">
          <h3 style="margin:0">J'ai déjà un compte</h3>
          <label>Pseudo<input id="cPseudo" name="username" autocomplete="username" required maxlength="20"></label>
          <label>Mot de passe<input id="cMdp" type="password" name="password" autocomplete="current-password" required></label>
          <button class="btn primary">Se connecter</button>
          <p class="err" id="cErr"></p>
        </form>
        <form class="form" id="fInscription" autocomplete="on">
          <h3 style="margin:0">Créer un compte</h3>
          <label>Pseudo (public)<input id="iPseudo" name="username" autocomplete="username" required minlength="3" maxlength="20" pattern="[A-Za-z0-9_\\-]{3,20}" title="3 à 20 caractères : lettres, chiffres, - ou _"></label>
          <label>Mot de passe (8 caractères minimum)<input id="iMdp" type="password" name="new-password" autocomplete="new-password" required minlength="8"></label>
          <label>Confirmer le mot de passe<input id="iMdp2" type="password" autocomplete="new-password" required minlength="8"></label>
          <label class="hidden" id="iCodeL">Code administrateur<input id="iCode" type="password" autocomplete="off"></label>
          <label class="check"><input type="checkbox" id="iCgu" required> J'accepte les ${lienLegal("cgu", "conditions d'utilisation")} et la ${lienLegal("confidentialite", "politique de confidentialité")}.</label>
          <label class="check"><input type="checkbox" id="iAge" required> J'ai 15 ans ou plus, ou l'accord d'un parent.</label>
          <button class="btn primary">Créer mon compte</button>
          <p class="err" id="iErr"></p>
          <p class="muted" style="font-size:12.5px;margin:0">Pas d'e-mail demandé : notez bien votre mot de passe. En cas d'oubli, l'administrateur peut le réinitialiser.</p>
        </form>
      </div></div>`;
  } else {
    haut = `<div class="panel">
      <div class="row" style="justify-content:space-between">
        <div class="row"><span class="avatar big">${esc(COMPTE.pseudo[0].toUpperCase())}</span>
          <div><h2 style="margin:0">${esc(COMPTE.pseudo)} ${COMPTE.admin ? `<span class="rbadge" data-r="legendaire">👑 Admin</span>` : ""}</h2>
          <span class="muted">Membre depuis le ${new Date(COMPTE.creeLe).toLocaleDateString("fr-FR")} · ${SYNC.etat === "erreur" ? "⚠ dernière sauvegarde en échec" : "☁️ progression sauvegardée dans le cloud"}</span></div></div>
        <div class="row">${COMPTE.admin ? `<button class="btn primary" data-aller="admin">👑 Administration</button>` : ""}
          <button class="btn" id="syncBtn">☁️ Sauvegarder maintenant</button><button class="btn" id="deco">Se déconnecter</button></div>
      </div></div>
      <div class="grid2" style="margin-top:16px">
        <div class="panel"><h3 style="margin-top:0">💎 Premium</h3>
          <p class="muted" style="margin-top:0">${estPremium() ? (COMPTE.premiumJusqu >= PREMIUM_VIE ? "Premium à vie : merci pour votre soutien !" : `Premium actif jusqu'au ${new Date(COMPTE.premiumJusqu).toLocaleDateString("fr-FR")}.`) : "2 boosters de plus par jour, boosters Prestige, Shiny ×2, 20 questions de quiz par jour…"}</p>
          <button class="btn ${estPremium() ? "" : "primary premium"}" data-aller="premium">${estPremium() ? "Voir mes avantages" : "💎 Découvrir le Premium"}</button></div>
        <div class="panel"><h3 style="margin-top:0">🔔 Notifications</h3>
          <p class="muted" style="margin-top:0" id="notifEtat">${etatNotifications()}</p>
          <button class="btn" id="notifBtn">${NOTIF.active ? "Désactiver" : "🔔 Activer les notifications"}</button></div>
      </div>
      <div class="panel" style="margin-top:16px">
        <h3 style="margin-top:0">🏆 Ma vitrine</h3>
        <p class="muted" style="margin-top:0">Choisissez jusqu'à 5 cartes à montrer sur votre profil public.</p>
        <div class="cards vitrine">${[0, 1, 2, 3, 4].map((i) => { const c = BY_ID[(S.vitrine || [])[i]]; return c && has(c.id) ? `<div data-slot="${i}" data-noclick>${cardHTML(c)}</div>` : `<button class="slot" data-slot="${i}">＋</button>`; }).join("")}</div>
      </div>
      <div class="grid2" style="margin-top:16px">
        <form class="panel form" id="fMdp"><h3 style="margin:0">Changer de mot de passe</h3>
          <label>Mot de passe actuel<input id="mAncien" type="password" autocomplete="current-password" required></label>
          <label>Nouveau mot de passe<input id="mNouveau" type="password" autocomplete="new-password" required minlength="8"></label>
          <button class="btn">Changer</button><p class="err" id="mErr"></p></form>
        <div class="panel form"><h3 style="margin:0">Mes données</h3>
          <p class="muted" style="margin:0">Conformément au RGPD, vous pouvez télécharger toutes vos données ou supprimer votre compte à tout moment.</p>
          <button class="btn" id="exportCompte">⬇ Télécharger mes données</button>
          ${COMPTE.admin ? "" : `<button class="btn" id="supprCompte" style="color:var(--bad)">Supprimer mon compte</button>`}</div>
      </div>`;
  }
  v.innerHTML = haut + `
    <div class="panel" style="margin-top:16px">
      <h3 style="margin-top:0">Application et réglages</h3>
      <div class="row">
        <button class="btn" id="ouvrirReglages">⚙︎ Réglages du jeu</button>
        ${PWA.prompt ? `<button class="btn primary" id="installer">📲 Installer l'app</button>` : PWA.installee ? `<span class="muted">✓ Application installée</span>` : `<span class="muted">📲 Pour installer l'app : menu du navigateur → « Installer » ou « Sur l'écran d'accueil ».</span>`}
      </div>
      <p class="muted" style="margin-bottom:0;font-size:13.5px">${lienLegal("mentions", "Mentions légales")} · ${lienLegal("cgu", "Conditions d'utilisation")} · ${lienLegal("confidentialite", "Confidentialité")}</p>
    </div>`;
  brancherLiens(v);
  $("#ouvrirReglages").onclick = () => $("#settingsBtn").click();
  $("#notifBtn")?.addEventListener("click", () => (NOTIF.active ? desactiverNotifications() : activerNotifications()));
  $("#installer")?.addEventListener("click", installer);
  // Connexion
  $("#fConnexion")?.addEventListener("submit", async (e) => {
    e.preventDefault(); $("#cErr").textContent = "";
    try {
      const r = await api("connexion", { methode: "POST", corps: { pseudo: $("#cPseudo").value.trim(), motdepasse: $("#cMdp").value } });
      Object.assign(COMPTE, { etat: "connecte", pseudo: r.pseudo, admin: r.admin, creeLe: r.creeLe }); majPremium(r.premiumJusqu);
      majBoutonCompte(); toast(`👋 Bon retour, <b>${esc(r.pseudo)}</b> !`);
      await apresConnexion(true); aller("compte");
    } catch (err) { $("#cErr").textContent = err.message; }
  });
  // Inscription
  $("#iPseudo")?.addEventListener("input", (e) => $("#iCodeL").classList.toggle("hidden", e.target.value.trim().toLowerCase() !== EDITEUR.toLowerCase()));
  $("#fInscription")?.addEventListener("submit", async (e) => {
    e.preventDefault(); $("#iErr").textContent = "";
    if ($("#iMdp").value !== $("#iMdp2").value) { $("#iErr").textContent = "Les deux mots de passe ne sont pas identiques."; return; }
    try {
      const r = await api("inscription", { methode: "POST", corps: { pseudo: $("#iPseudo").value.trim(), motdepasse: $("#iMdp").value, cgu: $("#iCgu").checked, age: $("#iAge").checked, codeAdmin: $("#iCode").value || undefined } });
      Object.assign(COMPTE, { etat: "connecte", pseudo: r.pseudo, admin: r.admin, creeLe: r.creeLe });
      S.compte = r.pseudo; await envoyerSauvegarde();
      majBoutonCompte(); aller("compte");
      toast(`🎉 Bienvenue, <b>${esc(r.pseudo)}</b> ! Votre collection est maintenant sauvegardée dans le cloud.`, 5000);
    } catch (err) { $("#iErr").textContent = err.message; }
  });
  // Compte connecté
  $("#deco")?.addEventListener("click", async () => {
    await envoyerSauvegarde();
    try { await api("deconnexion", { methode: "POST", corps: {} }); } catch {}
    Object.assign(COMPTE, { etat: "anonyme", pseudo: null, admin: false }); SYNC.etat = ""; majPremium(0);
    majBoutonCompte(); aller("compte"); toast("Vous êtes déconnecté. Votre progression reste aussi sur cet appareil.");
  });
  $("#syncBtn")?.addEventListener("click", async () => { await envoyerSauvegarde(); toast(SYNC.etat === "ok" ? "☁️ Sauvegardé." : "⚠ La sauvegarde a échoué."); aller("compte"); });
  $$(".vitrine [data-slot]", v).forEach((el) => el.addEventListener("click", () => choisirCarte("Carte de la vitrine", (id) => {
    S.vitrine = (S.vitrine || []).slice(); S.vitrine[Number(el.dataset.slot)] = id;
    S.vitrine = S.vitrine.filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).slice(0, 5); sauver(); aller("compte");
  }, (S.vitrine || [])[Number(el.dataset.slot)] ? () => { S.vitrine.splice(Number(el.dataset.slot), 1); sauver(); aller("compte"); } : null)));
  $("#fMdp")?.addEventListener("submit", async (e) => {
    e.preventDefault(); $("#mErr").textContent = "";
    try { await api("motdepasse", { methode: "POST", corps: { ancien: $("#mAncien").value, nouveau: $("#mNouveau").value } }); toast("🔒 Mot de passe changé."); aller("compte"); }
    catch (err) { $("#mErr").textContent = err.message; }
  });
  $("#exportCompte")?.addEventListener("click", async () => {
    try {
      const data = await api("compte/export");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }));
      a.download = `worldcards-mes-donnees-${today()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (err) { toast("⚠ " + err.message); }
  });
  $("#supprCompte")?.addEventListener("click", () => {
    ouvrirModal(`<h2 style="margin-top:0">Supprimer mon compte</h2>
      <p>Votre compte, votre sauvegarde dans le cloud et tous vos messages seront effacés définitivement. La progression restera sur cet appareil.</p>
      <form class="form" id="fSuppr"><label>Mot de passe<input id="sMdp" type="password" autocomplete="current-password" required></label>
      <div class="row" style="justify-content:flex-end"><button type="button" class="btn" data-close>Annuler</button><button class="btn primary" style="background:var(--bad);border-color:var(--bad)">Supprimer définitivement</button></div>
      <p class="err" id="sErr"></p></form>`);
    $("#fSuppr").onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api("compte", { methode: "DELETE", corps: { motdepasse: $("#sMdp").value } });
        Object.assign(COMPTE, { etat: "anonyme", pseudo: null, admin: false }); delete S.compte; sauver();
        fermerModal(); majBoutonCompte(); aller("compte"); toast("Votre compte a été supprimé.");
      } catch (err) { $("#sErr").textContent = err.message; }
    };
  });
}
// Sélecteur de carte parmi celles que l'on possède
function choisirCarte(titre, choisir, retirer) {
  const miennes = CARDS.filter((c) => has(c.id));
  ouvrirModal(`<h2 style="margin-top:0">${esc(titre)}</h2>
    <input class="search" id="pcq" type="search" placeholder="Rechercher une de vos cartes…" style="max-width:none;width:100%;margin-bottom:10px">
    ${retirer ? `<button class="btn small" id="pcRetirer" style="margin-bottom:10px">Retirer la carte</button>` : ""}
    <div class="cards" id="pcl" style="max-height:60vh;overflow:auto;padding:8px 4px" data-noclick></div>`);
  const dessiner = () => {
    const q = sansAccents($("#pcq").value);
    const liste = miennes.filter((c) => sansAccents(c.nom).includes(q)).sort((a, b) => RARETES[b.rarete].ordre - RARETES[a.rarete].ordre).slice(0, 120);
    $("#pcl").innerHTML = liste.length ? liste.map((c) => cardHTML(c)).join("") : `<p class="muted">Aucune carte. Ouvrez des boosters !</p>`;
    $$("#pcl .card").forEach((el) => el.addEventListener("click", () => { fermerModal(); choisir(el.dataset.id); }));
  };
  $("#pcq").oninput = dessiner; dessiner();
  $("#pcRetirer")?.addEventListener("click", () => { fermerModal(); retirer(); });
}

/* =====================================================================
   Hub communautaire
   ===================================================================== */
const hubEtat = { onglet: "fil", tri: "cartes", carte: null };
const depuis = (t) => {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: s > 300 * 86400 ? "numeric" : undefined });
};
function vueHub(v) {
  if (!["connecte", "anonyme"].includes(COMPTE.etat)) {
    v.innerHTML = `<div class="panel"><h2 style="margin-top:0">👥 Communauté</h2><p>${COMPTE.etat === "hors-ligne" ? "Pas de connexion internet : le hub revient dès que vous êtes en ligne." : COMPTE.etat === "inconnu" ? "Chargement…" : "Le hub communautaire n'est pas disponible sur cette version du jeu."}</p></div>`;
    return;
  }
  v.innerHTML = `<div class="sectiontitle"><h3>👥 Communauté ${NOM_SITE}</h3><span class="muted">Partagez vos cartes, comparez vos collections</span></div>
    <div class="toolbar">${[["fil", "💬 Fil"], ["classement", "🏆 Classement"]].map(([k, l]) => `<button class="chip ${hubEtat.onglet === k ? "on" : ""}" data-o="${k}">${l}</button>`).join("")}</div>
    <div id="hubCorps"></div>`;
  $$("[data-o]", v).forEach((b) => b.onclick = () => { hubEtat.onglet = b.dataset.o; aller("hub"); });
  (hubEtat.onglet === "fil" ? hubFil : hubClassement)($("#hubCorps"));
}
async function hubFil(el) {
  el.innerHTML = `${connecte() ? `<form class="panel form composer" id="fPost">
      <textarea id="pTxt" maxlength="500" rows="3" placeholder="Quoi de neuf, ${esc(COMPTE.pseudo)} ? Montrez votre dernière carte rare…"></textarea>
      <div id="pCarte"></div>
      <div class="row" style="justify-content:space-between">
        <div class="row"><button type="button" class="btn small" id="pJoindre">🃏 Joindre une carte</button>
        ${COMPTE.admin ? `<label class="check"><input type="checkbox" id="pEpingle"> 📌 Annonce épinglée</label>` : ""}</div>
        <div class="row"><span class="muted" id="pNb">0/500</span><button class="btn primary">Publier</button></div>
      </div><p class="err" id="pErr"></p></form>`
    : `<div class="panel row" style="justify-content:space-between"><span>Connectez-vous pour publier, aimer des messages et apparaître au classement.</span><button class="btn primary" data-aller="compte">Se connecter</button></div>`}
    <div id="posts" class="posts"><p class="muted">Chargement…</p></div>`;
  brancherLiens(el);
  const majCarte = () => { $("#pCarte").innerHTML = hubEtat.carte ? `<div class="pj"><div style="width:110px">${cardHTML(BY_ID[hubEtat.carte])}</div><button type="button" class="btn small" id="pRetirer">Retirer</button></div>` : ""; $("#pRetirer")?.addEventListener("click", () => { hubEtat.carte = null; majCarte(); }); };
  if (connecte()) {
    majCarte();
    $("#pTxt").oninput = (e) => $("#pNb").textContent = `${e.target.value.length}/500`;
    $("#pJoindre").onclick = () => choisirCarte("Joindre une carte", (id) => { hubEtat.carte = id; aller("hub"); });
    $("#fPost").onsubmit = async (e) => {
      e.preventDefault(); $("#pErr").textContent = "";
      try {
        await api("posts", { methode: "POST", corps: { texte: $("#pTxt").value, carte: hubEtat.carte, epingle: $("#pEpingle")?.checked } });
        hubEtat.carte = null; aller("hub");
      } catch (err) { $("#pErr").textContent = err.message; }
    };
  }
  await chargerPosts($("#posts"));
}
async function chargerPosts(box, avant) {
  try {
    const { posts } = await api("posts" + (avant ? `?avant=${avant}` : ""));
    if (!avant) box.innerHTML = "";
    box.querySelector(".plus")?.remove();
    if (!posts.length && !avant) box.innerHTML = `<p class="muted" style="text-align:center">Aucun message pour l'instant. Soyez le premier !</p>`;
    for (const p of posts) box.insertAdjacentHTML("beforeend", postHTML(p));
    if (posts.length === 30) {
      box.insertAdjacentHTML("beforeend", `<button class="btn plus" style="justify-self:center">Messages plus anciens</button>`);
      box.querySelector(".plus").onclick = () => chargerPosts(box, posts[posts.length - 1].id);
    }
    brancherPosts(box);
  } catch (err) { box.innerHTML = `<p class="err">${esc(err.message)}</p>`; }
}
function postHTML(p) {
  const c = p.carte && BY_ID[p.carte];
  return `<article class="post${p.epingle ? " pinned" : ""}" data-post="${p.id}">
    <header><button class="pseudo" data-profil="${esc(p.pseudo)}"><span class="avatar">${esc(p.pseudo[0].toUpperCase())}</span>${esc(p.pseudo)}${p.admin ? " 👑" : ""}${p.premium ? " 💎" : ""}</button>
      <span class="muted">${p.epingle ? "📌 Annonce · " : ""}${depuis(p.cree_le)}</span></header>
    ${p.texte ? `<p class="txt">${esc(p.texte)}</p>` : ""}
    ${c ? `<div class="pj"><div style="width:130px">${cardHTML(c, { locked: false })}</div></div>` : ""}
    <footer>
      <button class="act${p.aime ? " on" : ""}" data-like ${connecte() ? "" : "disabled"}>${p.aime ? "❤️" : "🤍"} <span>${p.likes}</span></button>
      ${connecte() && !p.moi ? `<button class="act" data-signaler>🚩 Signaler</button>` : ""}
      ${p.moi || COMPTE.admin ? `<button class="act" data-suppr>🗑️ Supprimer</button>` : ""}
      ${COMPTE.admin ? `<button class="act" data-epingle>${p.epingle ? "Désépingler" : "📌 Épingler"}</button>` : ""}
    </footer></article>`;
}
function brancherPosts(box) {
  $$(".post:not([data-ok])", box).forEach((el) => {
    el.dataset.ok = 1;
    const id = el.dataset.post;
    el.querySelector("[data-profil]").onclick = (e) => ouvrirProfil(e.currentTarget.dataset.profil);
    el.querySelector("[data-like]").onclick = async (e) => {
      const b = e.currentTarget;
      try { const r = await api(`posts/${id}/like`, { methode: "POST", corps: {} }); b.classList.toggle("on", r.aime); b.innerHTML = `${r.aime ? "❤️" : "🤍"} <span>${r.likes}</span>`; }
      catch (err) { toast("⚠ " + err.message); }
    };
    el.querySelector("[data-signaler]")?.addEventListener("click", () => {
      ouvrirModal(`<h2 style="margin-top:0">Signaler ce message</h2><form class="form" id="fSig">
        <label>Pourquoi ?<select id="sigMotif"><option>Insulte ou harcèlement</option><option>Spam</option><option>Contenu choquant</option><option>Informations personnelles</option><option>Autre</option></select></label>
        <div class="row" style="justify-content:flex-end"><button type="button" class="btn" data-close>Annuler</button><button class="btn primary">Signaler</button></div></form>`);
      $("#fSig").onsubmit = async (e) => { e.preventDefault(); try { await api(`posts/${id}/signaler`, { methode: "POST", corps: { motif: $("#sigMotif").value } }); fermerModal(); toast("Merci, le message a été signalé à l'administrateur."); } catch (err) { toast("⚠ " + err.message); } };
    });
    el.querySelector("[data-suppr]")?.addEventListener("click", () => confirmer("Supprimer ce message ?", "Supprimer", async () => {
      try { await api(`posts/${id}`, { methode: "DELETE" }); fermerModal(); el.remove(); } catch (err) { toast("⚠ " + err.message); }
    }));
    el.querySelector("[data-epingle]")?.addEventListener("click", async () => { try { await api(`admin/posts/${id}/epingle`, { methode: "POST", corps: {} }); aller("hub"); } catch (err) { toast("⚠ " + err.message); } });
  });
}
async function hubClassement(el) {
  el.innerHTML = `<div class="toolbar">${[["cartes", "Cartes"], ["secretes", "Cartes secrètes"], ["badges", "Badges"]].map(([k, l]) => `<button class="chip ${hubEtat.tri === k ? "on" : ""}" data-tri="${k}">Par ${l.toLowerCase()}</button>`).join("")}</div>
    <div class="panel" style="padding:0;overflow-x:auto"><table class="classement"><thead><tr><th>#</th><th>Joueur</th><th>Cartes</th><th>Secrètes</th><th>Badges</th></tr></thead><tbody id="cl"><tr><td colspan="5" class="muted">Chargement…</td></tr></tbody></table></div>`;
  $$("[data-tri]", el).forEach((b) => b.onclick = () => { hubEtat.tri = b.dataset.tri; hubClassement(el); });
  try {
    const { joueurs } = await api(`classement?tri=${hubEtat.tri}`);
    $("#cl").innerHTML = joueurs.length ? joueurs.map((j, i) => `<tr class="${j.pseudo === COMPTE.pseudo ? "moi" : ""}">
      <td>${["🥇", "🥈", "🥉"][i] || i + 1}</td><td><button class="pseudo" data-profil="${esc(j.pseudo)}"><span class="avatar">${esc(j.pseudo[0].toUpperCase())}</span>${esc(j.pseudo)}${j.admin ? " 👑" : ""}${j.premium ? " 💎" : ""}</button></td>
      <td>${fmt(j.cartes)}</td><td>${j.secretes}</td><td>${j.badges}</td></tr>`).join("") : `<tr><td colspan="5" class="muted">Personne au classement pour l'instant.</td></tr>`;
    $$("[data-profil]", el).forEach((b) => b.onclick = () => ouvrirProfil(b.dataset.profil));
  } catch (err) { $("#cl").innerHTML = `<tr><td colspan="5" class="err">${esc(err.message)}</td></tr>`; }
}
async function ouvrirProfil(pseudo) {
  ouvrirModal(`<p class="muted">Chargement du profil…</p>`);
  try {
    const p = await api("profil/" + encodeURIComponent(pseudo));
    const vitrine = p.vitrine.map((id) => BY_ID[id]).filter(Boolean);
    $("#modal .box").innerHTML = `<button class="close" data-close aria-label="Fermer">✕</button>
      <div class="row"><span class="avatar big">${esc(p.pseudo[0].toUpperCase())}</span><div><h2 style="margin:0">${esc(p.pseudo)}${p.admin ? " 👑" : ""}${p.premium ? " 💎" : ""}</h2>
      <span class="muted">Membre depuis le ${new Date(p.creeLe).toLocaleDateString("fr-FR")}</span></div></div>
      <div class="statgrid"><div class="stat"><b>${fmt(p.cartes)}</b><span>cartes</span></div><div class="stat"><b>${p.secretes}</b><span>secrètes</span></div>
      <div class="stat"><b>${p.badges}</b><span>badges</span></div><div class="stat"><b>🏆 ${fmt(p.trophees || 0)}</b><span>trophées</span></div></div>
      <h3>🏆 Vitrine</h3>${vitrine.length ? `<div class="cards">${vitrine.map((c) => cardHTML(c, { locked: false })).join("")}</div>` : `<p class="muted">Pas encore de cartes en vitrine.</p>`}`;
  } catch (err) { $("#modal .box").innerHTML = `<button class="close" data-close>✕</button><p class="err">${esc(err.message)}</p>`; }
}

/* =====================================================================
   Administration (réservée à nuiraz)
   ===================================================================== */
const adminEtat = { onglet: "joueurs", q: "" };
async function vueAdmin(v) {
  if (!COMPTE.admin) { v.innerHTML = `<div class="panel"><p>Accès réservé à l'administrateur.</p><button class="btn" data-aller="compte">Mon compte</button></div>`; brancherLiens(v); return; }
  v.innerHTML = `<div class="sectiontitle"><h3>👑 Administration</h3><span class="muted">Connecté en tant que ${esc(COMPTE.pseudo)}</span></div>
    <div class="statgrid" id="aStats"><div class="stat"><b>…</b><span>chargement</span></div></div>
    <div class="toolbar" style="margin-top:16px">${[["joueurs", "👥 Joueurs"], ["premium", "💎 Premium"], ["signalements", "🚩 Signalements"], ["cadeaux", "🎁 Cadeaux"], ["annonce", "📌 Annonce"], ["outils", "🧪 Outils de test"]].map(([k, l]) => `<button class="chip ${adminEtat.onglet === k ? "on" : ""}" data-a="${k}">${l}</button>`).join("")}</div>
    <div id="aCorps"></div>`;
  $$("[data-a]", v).forEach((b) => b.onclick = () => { adminEtat.onglet = b.dataset.a; aller("admin"); });
  api("admin/stats").then((s) => {
    $("#aStats").innerHTML = [["Joueurs", s.joueurs], ["Nouveaux (7 j)", s.nouveaux7j], ["Actifs (7 j)", s.actifs7j], ["Messages", s.messages], ["Messages signalés", s.signales], ["Bannis", s.bannis]]
      .map(([l, n]) => `<div class="stat"><b>${fmt(n)}</b><span>${l}</span></div>`).join("");
  }).catch((e) => { $("#aStats").innerHTML = `<p class="err">${esc(e.message)}</p>`; });
  const corps = $("#aCorps");
  ({ joueurs: adminJoueurs, premium: adminPremium, signalements: adminSignalements, cadeaux: adminCadeaux, annonce: adminAnnonce, outils: adminOutils })[adminEtat.onglet](corps);
}
async function adminJoueurs(el) {
  el.innerHTML = `<input class="search" id="aq" type="search" placeholder="Rechercher un joueur…" value="${esc(adminEtat.q)}" style="max-width:none;width:100%;margin-bottom:10px">
    <div class="panel" style="padding:0;overflow-x:auto"><table class="classement"><thead><tr><th>Joueur</th><th>Inscrit</th><th>Dernière visite</th><th>Cartes</th><th>Messages</th><th>Actions</th></tr></thead><tbody id="aj"></tbody></table></div>`;
  let t = 0;
  $("#aq").oninput = (e) => { adminEtat.q = e.target.value; clearTimeout(t); t = setTimeout(charger, 300); };
  async function charger() {
    try {
      const { utilisateurs } = await api("admin/utilisateurs?q=" + encodeURIComponent(adminEtat.q));
      $("#aj").innerHTML = utilisateurs.map((u) => `<tr class="${u.banni ? "banni" : ""}" data-u="${u.id}" data-p="${esc(u.pseudo)}">
        <td><button class="pseudo" data-profil="${esc(u.pseudo)}">${esc(u.pseudo)}${u.admin ? " 👑" : ""}${u.banni ? " ⛔" : ""}</button></td>
        <td>${new Date(u.cree_le).toLocaleDateString("fr-FR")}${u.premium_jusqu > Date.now() ? " 💎" : ""}</td><td>${u.derniere_co ? depuis(u.derniere_co) : "—"}</td><td>${fmt(u.cartes)}</td><td>${u.messages}</td>
        <td><div class="row" style="gap:4px;flex-wrap:nowrap">${u.admin ? "" : `<button class="btn small" data-ban>${u.banni ? "Réactiver" : "Bannir"}</button>
          <button class="btn small" data-mdp>Nouveau mot de passe</button><button class="btn small" data-prem>💎</button><button class="btn small" data-cadeau>🎁</button><button class="btn small" data-del style="color:var(--bad)">Supprimer</button>`}</div></td></tr>`).join("") || `<tr><td colspan="6" class="muted">Aucun joueur.</td></tr>`;
      $$("#aj [data-profil]").forEach((b) => b.onclick = () => ouvrirProfil(b.dataset.profil));
      $$("#aj tr[data-u]").forEach((tr) => {
        const id = tr.dataset.u, pseudo = tr.dataset.p;
        tr.querySelector("[data-ban]")?.addEventListener("click", async () => {
          const bannir = !tr.classList.contains("banni");
          try { await api(`admin/utilisateurs/${id}/bannir`, { methode: "POST", corps: { banni: bannir } }); toast(bannir ? `⛔ ${esc(pseudo)} est banni.` : `✅ ${esc(pseudo)} est réactivé.`); charger(); } catch (e) { toast("⚠ " + e.message); }
        });
        tr.querySelector("[data-mdp]")?.addEventListener("click", () => confirmer(`Créer un nouveau mot de passe pour ${pseudo} ? L'ancien ne marchera plus.`, "Réinitialiser", async () => {
          try {
            const r = await api(`admin/utilisateurs/${id}/motdepasse`, { methode: "POST", corps: {} });
            ouvrirModal(`<h2 style="margin-top:0">Nouveau mot de passe de ${esc(pseudo)}</h2><p>Transmettez-le au joueur. Il pourra le changer depuis « Mon compte ».</p>
              <p class="code">${esc(r.motdepasse)}</p><button class="btn primary" data-close>Fermer</button>`);
          } catch (e) { toast("⚠ " + e.message); }
        }));
        tr.querySelector("[data-prem]")?.addEventListener("click", () => { adminEtat.onglet = "premium"; adminEtat.pseudoPremium = pseudo; aller("admin"); });
        tr.querySelector("[data-cadeau]")?.addEventListener("click", () => { adminEtat.onglet = "cadeaux"; adminEtat.pseudoCadeau = pseudo; aller("admin"); });
        tr.querySelector("[data-del]")?.addEventListener("click", () => confirmer(`Supprimer définitivement le compte de ${pseudo}, sa sauvegarde et ses messages ?`, "Supprimer", async () => {
          try { await api(`admin/utilisateurs/${id}`, { methode: "DELETE" }); fermerModal(); toast(`Compte de ${esc(pseudo)} supprimé.`); charger(); } catch (e) { toast("⚠ " + e.message); }
        }));
      });
    } catch (e) { $("#aj").innerHTML = `<tr><td colspan="6" class="err">${esc(e.message)}</td></tr>`; }
  }
  charger();
}
async function adminSignalements(el) {
  el.innerHTML = `<p class="muted">Chargement…</p>`;
  try {
    const { signalements } = await api("admin/signalements");
    el.innerHTML = signalements.length ? `<div class="posts">${signalements.map((s) => `<article class="post" data-s="${s.id}" data-u="${s.user_id}">
      <header><b>${esc(s.pseudo)}</b><span class="muted">${depuis(s.cree_le)} · 🚩 ${s.nombre} signalement${s.nombre > 1 ? "s" : ""} : ${esc(s.motifs || "")}</span></header>
      ${s.texte ? `<p class="txt">${esc(s.texte)}</p>` : ""}${s.carte && BY_ID[s.carte] ? `<p class="muted">Carte jointe : ${esc(BY_ID[s.carte].nom)}</p>` : ""}
      <footer><button class="btn small" data-x style="color:var(--bad)">Supprimer le message</button><button class="btn small" data-ok>Ignorer</button><button class="btn small" data-ban>Bannir l'auteur</button></footer></article>`).join("")}</div>`
      : `<p class="muted" style="text-align:center">✅ Aucun signalement en attente.</p>`;
    $$("[data-s]", el).forEach((a) => {
      const id = a.dataset.s;
      a.querySelector("[data-x]").onclick = async () => { await api(`posts/${id}`, { methode: "DELETE" }).catch((e) => toast("⚠ " + e.message)); aller("admin"); };
      a.querySelector("[data-ok]").onclick = async () => { await api(`admin/signalements/${id}`, { methode: "DELETE" }).catch((e) => toast("⚠ " + e.message)); aller("admin"); };
      a.querySelector("[data-ban]").onclick = async () => { await api(`admin/utilisateurs/${a.dataset.u}/bannir`, { methode: "POST", corps: { banni: true } }).catch((e) => toast("⚠ " + e.message)); toast("⛔ Auteur banni."); aller("admin"); };
    });
  } catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}
function adminCadeaux(el) {
  el.innerHTML = `<form class="panel form" id="fCadeau" style="max-width:520px">
    <h3 style="margin:0">Envoyer un cadeau</h3>
    <label>Joueur (laisser vide pour tout le monde)<input id="gPseudo" value="${esc(adminEtat.pseudoCadeau || "")}" placeholder="Tous les joueurs"></label>
    <div class="grid2" style="gap:10px"><label>Pièces<input id="gPieces" type="number" min="0" max="100000" value="500"></label><label>Boosters<input id="gBoosters" type="number" min="0" max="50" value="1"></label></div>
    <label>Message<input id="gMsg" maxlength="200" placeholder="Ex. : Merci de jouer à WorldCards !"></label>
    <p class="muted" style="margin:0;font-size:13px">Les boosters offerts sont des boosters Classiques. Les joueurs qui ont activé les notifications sont prévenus.</p>
    <button class="btn primary">🎁 Envoyer</button><p class="err" id="gErr"></p>
    <p class="muted" style="margin:0;font-size:13px">Le joueur reçoit le cadeau à sa prochaine visite, une seule fois.</p></form>`;
  adminEtat.pseudoCadeau = "";
  $("#fCadeau").onsubmit = async (e) => {
    e.preventDefault(); $("#gErr").textContent = "";
    try {
      await api("admin/cadeaux", { methode: "POST", corps: { pseudo: $("#gPseudo").value.trim() || null, pieces: $("#gPieces").value, boosters: $("#gBoosters").value, message: $("#gMsg").value } });
      toast("🎁 Cadeau envoyé !"); aller("admin");
    } catch (err) { $("#gErr").textContent = err.message; }
  };
}
function adminAnnonce(el) {
  el.innerHTML = `<form class="panel form" id="fAnnonce" style="max-width:640px"><h3 style="margin:0">Publier une annonce épinglée</h3>
    <textarea id="anTxt" rows="4" maxlength="500" placeholder="Nouveautés, événement, règles du hub…" required></textarea>
    <button class="btn primary">📌 Publier l'annonce</button><p class="err" id="anErr"></p></form>`;
  $("#fAnnonce").onsubmit = async (e) => {
    e.preventDefault();
    try { await api("posts", { methode: "POST", corps: { texte: $("#anTxt").value, epingle: true } }); toast("📌 Annonce publiée."); hubEtat.onglet = "fil"; aller("hub"); }
    catch (err) { $("#anErr").textContent = err.message; }
  };
}
function adminOutils(el) {
  el.innerHTML = `<div class="panel"><h3 style="margin-top:0">Outils de test (sur votre progression uniquement)</h3>
    <p class="muted">Pratique pour vérifier une nouveauté. Ces outils modifient votre propre collection, puis la sauvegardent.</p>
    <div class="row"><button class="btn" id="tPieces">+1 000 🪙</button><button class="btn" id="tBoosters">+5 boosters de chaque sorte</button>
    <button class="btn" id="tTout">Débloquer toutes les cartes</button></div></div>`;
  $("#tPieces").onclick = () => { S.coins += 1000; sauver(); majCoins(); toast("+1 000 🪙"); };
  $("#tBoosters").onclick = () => { for (const k of Object.keys(PACKS)) S.boosters[k] = (S.boosters[k] || 0) + 5; sauver(); renderNav(); toast("+5 boosters de chaque sorte"); };
  $("#tTout").onclick = () => confirmer("Ajouter toutes les cartes à votre collection ?", "Débloquer", () => {
    for (const c of CARDS) if (c.type !== "secrete") S.owned[c.id] = Math.max(1, S.owned[c.id] || 0);
    sauver(); fermerModal(); verifierProgression(); toast("Toutes les cartes sont débloquées.");
  });
}


/* =====================================================================
   Premium (paiement PayPal, activation par l'administrateur)
   ===================================================================== */
const AVANTAGES_PREMIUM = [
  ["🎁", "2 boosters Classiques de plus chaque jour", "à récupérer sur l'accueil ou dans la boutique"],
  ["💎", "Boosters Prestige", "6 cartes dont une légendaire garantie, Shiny ×3 ; un offert chaque semaine"],
  ["✨", "Chances de Shiny ×2", "dans tous les boosters"],
  ["❓", "20 questions de quiz par jour", "au lieu de 10"],
  ["⚔️", "20 combats d'arène par jour", "au lieu de 10, et 30 entraînements récompensés au lieu de 15"],
  ["💠", "Badge 💎 à côté de votre pseudo", "dans le hub, le classement et l'arène"],
  ["❤️", "Vous soutenez le jeu", "hébergement, nouvelles cartes et nouveautés"],
];
function vuePremium(v) {
  const actif = estPremium();
  v.innerHTML = `<div class="panel premium-hero">
      <div style="font-size:52px">💎</div>
      <h1 style="margin:6px 0">WorldCards Premium</h1>
      <p class="muted" style="margin:0">${actif ? (COMPTE.premiumJusqu >= PREMIUM_VIE ? "Vous êtes Premium à vie. Merci !" : `Votre Premium est actif jusqu'au <b>${new Date(COMPTE.premiumJusqu).toLocaleDateString("fr-FR")}</b>.`) : "Plus de boosters, plus de Shiny, plus de jeu."}</p>
    </div>
    <div class="avantages">${AVANTAGES_PREMIUM.map(([e, t, d]) => `<div class="avantage"><span>${e}</span><div><b>${t}</b><small class="muted">${d}</small></div></div>`).join("")}</div>
    <div class="grid2 offres" style="margin-top:16px">${Object.entries(OFFRES_PREMIUM).map(([k, o]) => `<div class="panel offre-premium ${k === "vie" ? "meilleure" : ""}">
        ${k === "vie" ? `<span class="ruban">Meilleure offre</span>` : ""}
        <h3 style="margin:0">${o.nom}</h3><div class="prix">${o.prix}</div>
        <p class="muted" style="margin:0 0 10px">${k === "vie" ? "Un seul paiement, Premium pour toujours." : "31 jours de Premium, sans renouvellement automatique."}</p>
        <a class="btn primary premium" href="${o.lien}" target="_blank" rel="noopener" data-payer="${k}">Payer ${o.prix} avec PayPal</a></div>`).join("")}</div>
    <div class="panel" style="margin-top:16px">
      <h3 style="margin-top:0">Comment ça marche ?</h3>
      <ol class="regles">
        <li>${connecte() ? `Vous êtes connecté en tant que <b>${esc(COMPTE.pseudo)}</b>.` : `<a href="#" data-aller="compte">Créez un compte ou connectez-vous</a> : le Premium est lié à votre compte.`}</li>
        <li>Payez avec PayPal et <b>écrivez votre pseudo dans la note du paiement</b>.</li>
        <li>Revenez ici et touchez « J'ai payé » : l'administrateur vérifie le paiement et active votre Premium, en général sous 24 heures. Vous recevez une notification.</li>
      </ol>
      ${connecte() ? `<form class="form" id="fDemande" style="max-width:520px">
        <label>Formule<select id="dFormule"><option value="mois">1 mois · 5,99 €</option><option value="vie">À vie · 39,99 €</option></select></label>
        <label>Nom ou e-mail utilisé sur PayPal (pour retrouver le paiement)<input id="dNote" maxlength="120" placeholder="Facultatif"></label>
        <button class="btn primary">✅ J'ai payé</button><p class="err" id="dErr"></p></form>` : ""}
      <p class="muted" style="font-size:12.5px;margin-bottom:0">En payant, vous acceptez les ${lienLegal("cgv", "conditions générales de vente")}. Le Premium est un contenu numérique fourni dès son activation : vous renoncez donc à votre droit de rétractation une fois le Premium activé (article L221-28 du Code de la consommation). Une question ? ${esc(CONTACT)}.</p>
    </div>`;
  brancherLiens(v);
  $$("[data-payer]", v).forEach((a) => a.addEventListener("click", () => { if ($("#dFormule")) $("#dFormule").value = a.dataset.payer; }));
  $("#fDemande")?.addEventListener("submit", async (e) => {
    e.preventDefault(); $("#dErr").textContent = "";
    try {
      await api("premium/demande", { methode: "POST", corps: { formule: $("#dFormule").value, note: $("#dNote").value } });
      ouvrirModal(`<div class="reveal"><div style="font-size:52px">💎</div><h2>Demande envoyée !</h2><p>L'administrateur va vérifier votre paiement et activer votre Premium. Activez les notifications pour être prévenu.</p>
        <button class="btn primary" data-close>OK</button></div>`);
    } catch (err) { $("#dErr").textContent = err.message; }
  });
}
async function adminPremium(el) {
  el.innerHTML = `<form class="panel form" id="fPrem" style="max-width:520px"><h3 style="margin:0">Activer le Premium</h3>
      <label>Joueur<input id="prPseudo" value="${esc(adminEtat.pseudoPremium || "")}" required></label>
      <label>Formule<select id="prFormule"><option value="mois">+1 mois (5,99 €)</option><option value="vie">À vie (39,99 €)</option><option value="retirer">Retirer le Premium</option></select></label>
      <button class="btn primary">💎 Valider</button><p class="err" id="prErr"></p>
      <p class="muted" style="margin:0;font-size:13px">Vérifiez d'abord le paiement dans votre compte PayPal (montant et pseudo dans la note).</p></form>
    <h3>Demandes en attente</h3><div id="prDemandes"><p class="muted">Chargement…</p></div>
    <h3>Joueurs Premium</h3><div id="prListe"></div>`;
  adminEtat.pseudoPremium = "";
  const activer = async (pseudo, formule, demande) => {
    try {
      const r = await api("admin/premium", { methode: "POST", corps: { pseudo, formule, demande } });
      toast(formule === "retirer" ? `Premium retiré à ${esc(pseudo)}.` : `💎 ${esc(pseudo)} est Premium jusqu'au ${new Date(r.premiumJusqu).toLocaleDateString("fr-FR")}.`);
      aller("admin");
    } catch (e) { toast("⚠ " + e.message); }
  };
  $("#fPrem").onsubmit = (e) => { e.preventDefault(); activer($("#prPseudo").value.trim(), $("#prFormule").value); };
  try {
    const { demandes, premiums } = await api("admin/premium");
    $("#prDemandes").innerHTML = demandes.length ? `<div class="posts">${demandes.map((d) => `<article class="post" data-d="${d.id}" data-p="${esc(d.pseudo)}" data-f="${d.formule}">
        <header><b>${esc(d.pseudo)}</b><span class="muted">${depuis(d.cree_le)} · ${d.formule === "vie" ? "À vie · 39,99 €" : "1 mois · 5,99 €"}</span></header>
        ${d.note ? `<p class="txt">PayPal : ${esc(d.note)}</p>` : ""}
        <footer><button class="btn small primary" data-ok>✅ Paiement reçu : activer</button><button class="btn small" data-non>Refuser</button></footer></article>`).join("")}</div>`
      : `<p class="muted">Aucune demande en attente.</p>`;
    $$("#prDemandes [data-d]").forEach((a) => {
      a.querySelector("[data-ok]").onclick = () => activer(a.dataset.p, a.dataset.f, Number(a.dataset.d));
      a.querySelector("[data-non]").onclick = async () => { await api(`admin/premium/demandes/${a.dataset.d}`, { methode: "DELETE" }).catch((e) => toast("⚠ " + e.message)); aller("admin"); };
    });
    $("#prListe").innerHTML = premiums.length ? `<div class="panel" style="padding:0;overflow-x:auto"><table class="classement"><thead><tr><th>Joueur</th><th>Jusqu'au</th></tr></thead><tbody>
      ${premiums.map((u) => `<tr><td>${esc(u.pseudo)}</td><td>${u.premium_jusqu >= PREMIUM_VIE ? "À vie" : new Date(u.premium_jusqu).toLocaleDateString("fr-FR")}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">Aucun joueur Premium pour l'instant.</p>`;
  } catch (e) { $("#prDemandes").innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}

/* =====================================================================
   Notifications push
   ===================================================================== */
const NOTIF = { active: false };
try { NOTIF.active = localStorage.getItem("worldcards:notif") === "1" && typeof Notification !== "undefined" && Notification.permission === "granted"; } catch {}
const pushPossible = () => "serviceWorker" in navigator && "PushManager" in window && typeof Notification !== "undefined";
const iosNonInstalle = () => /iPhone|iPad|iPod/.test(navigator.userAgent) && !PWA.installee;
function etatNotifications() {
  if (NOTIF.active) return "✅ Activées : booster gratuit prêt, attaques dans l'arène, Premium, cadeaux.";
  if (iosNonInstalle()) return "Sur iPhone, ajoutez d'abord WorldCards à l'écran d'accueil (bouton Partager → « Sur l'écran d'accueil »), puis ouvrez l'app depuis l'icône.";
  if (!pushPossible()) return "Votre navigateur ne gère pas les notifications.";
  if (Notification.permission === "denied") return "Notifications bloquées : autorisez-les dans les réglages du navigateur.";
  return "Soyez prévenu quand votre booster gratuit est prêt, quand on attaque votre deck, et plus encore.";
}
const b64urlVersOctets = (t) => { const b = atob(t.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((t.length + 3) % 4)); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
async function activerNotifications() {
  if (!connecte()) { toast("Connectez-vous pour activer les notifications."); return; }
  if (iosNonInstalle() || !pushPossible()) { toast(etatNotifications(), 6000); return; }
  try {
    if ((await Notification.requestPermission()) !== "granted") { toast("Notifications refusées."); return; }
    const reg = await navigator.serviceWorker.ready;
    const { cle } = await api("push/cle");
    let abo = await reg.pushManager.getSubscription();
    if (!abo) abo = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlVersOctets(cle) });
    await api("push/abonner", { methode: "POST", corps: { abonnement: abo.toJSON() } });
    NOTIF.active = true; localStorage.setItem("worldcards:notif", "1");
    if (gratuitDans() > 0) programmerRappel(S.gratuitLe + GRATUIT_MS);
    toast("🔔 Notifications activées !");
  } catch (e) { toast("⚠ Impossible d'activer les notifications : " + e.message, 5000); }
  if (S.vue === "compte") aller("compte");
}
async function desactiverNotifications() {
  try {
    const abo = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    if (abo) { await api("push/abonner", { methode: "DELETE", corps: { endpoint: abo.endpoint } }).catch(() => {}); await abo.unsubscribe(); }
  } catch {}
  NOTIF.active = false; localStorage.removeItem("worldcards:notif");
  toast("🔕 Notifications désactivées."); if (S.vue === "compte") aller("compte");
}
// Le serveur enverra une notification quand le booster gratuit sera prêt
function programmerRappel(quand) {
  if (!connecte() || !NOTIF.active) return;
  api("push/rappel", { methode: "POST", corps: { quand } }).catch(() => {});
}

/* =====================================================================
   Pages légales
   ===================================================================== */
const MAJ_LEGALE = "11 octobre 2026";
const PAGES_LEGALES = {
  mentions: ["Mentions légales", `
    <h3>Éditeur du site</h3>
    <p>${NOM_SITE} est édité par <b>${EDITEUR}</b>${ADRESSE ? `, ${ADRESSE}` : ""}.<br>
    Contact : ${CONTACT}.${SIRET ? `<br>Immatriculation : ${SIRET}.` : ""}</p>
    <h3>Directeur de la publication</h3><p>${EDITEUR}.</p>
    <h3>Hébergement</h3>
    <p>Cloudflare, Inc. (service Cloudflare Workers), 101 Townsend St, San Francisco, CA 94107, États-Unis. Site : cloudflare.com.</p>
    <h3>Propriété intellectuelle</h3>
    <p>Les textes, le code et le graphisme de ${NOM_SITE} appartiennent à l'éditeur, sauf mention contraire.<br>
    Photos : contributeurs de Wikipédia et de Wikimedia Commons, sous licences libres ; l'auteur et la licence de chaque photo sont indiqués sur la fiche de la carte.
    Carte du monde : Natural Earth (domaine public). Drapeaux : projet flag-icons (licence MIT). Bibliothèques : D3 et TopoJSON (licence ISC).</p>
    <h3>Signaler un contenu</h3>
    <p>Tout contenu illicite publié dans le hub peut être signalé avec le bouton « Signaler » ou à l'adresse de contact ci-dessus.</p>`],
  cgu: ["Conditions générales d'utilisation", `
    <h3>1. Objet</h3><p>Les présentes conditions encadrent l'utilisation de ${NOM_SITE}, un jeu de cartes à collectionner gratuit (avec une option Premium payante), et de son hub communautaire. Créer un compte implique de les accepter.</p>
    <h3>2. Accès et compte</h3><p>Le jeu est gratuit et jouable sans compte. Le compte, gratuit lui aussi, permet de sauvegarder sa collection dans le cloud et de participer au hub. L'inscription est ouverte aux personnes de 15 ans et plus, ou plus jeunes avec l'accord d'un parent. Vous êtes responsable de la confidentialité de votre mot de passe ; un seul compte par personne est conseillé.</p>
    <h3>3. Pièces, cartes et Premium</h3><p>Les pièces, boosters et cartes du jeu n'ont aucune valeur monétaire : ils ne se vendent pas et ne s'échangent pas contre de l'argent. Seule l'option Premium est payante ; elle est régie par les conditions générales de vente. Le jeu reste entièrement jouable sans payer.</p>
    <h3>3 bis. Arène et combats</h3><p>L'arène oppose votre deck à celui d'autres joueurs. Toute triche (modification de la sauvegarde, automatisation) peut entraîner la remise à zéro des trophées ou la suspension du compte.</p>
    <h3>4. Règles du hub communautaire</h3><p>Sont interdits : les insultes, le harcèlement, les propos haineux ou discriminatoires, les contenus violents, sexuels ou illégaux, le spam, la publicité, la publication d'informations personnelles (les vôtres ou celles d'autrui) et l'usurpation d'identité, notamment de l'administrateur. Les pseudos doivent rester respectueux.</p>
    <h3>5. Modération</h3><p>L'administrateur peut supprimer tout message contraire à ces règles et suspendre ou supprimer un compte, sans préavis en cas de manquement grave. Chacun peut signaler un message.</p>
    <h3>6. Vos contenus</h3><p>Vous restez propriétaire des messages que vous publiez et accordez à ${NOM_SITE} le droit de les afficher dans le hub tant qu'ils sont en ligne. Les illustrations que vous ajoutez à vos cartes restent privées : elles ne sont pas publiées dans le hub.</p>
    <h3>7. Responsabilité</h3><p>Le jeu est fourni tel quel, sans garantie de disponibilité permanente. L'éditeur fait ses meilleurs efforts pour conserver les sauvegardes mais ne peut garantir l'absence de perte ; pensez à exporter votre progression. Les anecdotes sont proposées à titre ludique et peuvent comporter des imprécisions.</p>
    <h3>8. Modification</h3><p>Ces conditions peuvent évoluer ; la date de mise à jour figure en bas de page. En cas de changement important, une annonce est publiée dans le hub.</p>
    <h3>9. Droit applicable</h3><p>Ces conditions sont soumises au droit français.</p>`],
  confidentialite: ["Politique de confidentialité", `
    <p>${NOM_SITE} collecte le moins de données possible : pas d'adresse e-mail, pas de publicité, pas de traceur, pas de revente de données.</p>
    <h3>Responsable du traitement</h3><p>${EDITEUR}, éditeur du site. Contact : ${CONTACT}.</p>
    <h3>Données traitées</h3>
    <ul><li><b>Sans compte</b> : votre progression est enregistrée uniquement dans votre navigateur (stockage local). Elle ne nous est pas transmise.</li>
    <li><b>Avec un compte</b> : votre pseudo, votre mot de passe (enregistré sous forme chiffrée et irréversible, jamais en clair), la date d'inscription, de dernière connexion et d'acceptation des conditions, votre sauvegarde de jeu (y compris vos collections et illustrations personnelles), votre vitrine, et vos activités dans le hub (messages, « j'aime », signalements).</li>
    <li><b>Données techniques</b> : comme tout hébergeur, Cloudflare traite les adresses IP et journaux de connexion pour faire fonctionner et sécuriser le site.</li></ul>
    <h3>Finalités et bases légales</h3>
    <ul><li>Fournir le compte, la sauvegarde et le hub : exécution du service que vous demandez (article 6.1.b du RGPD).</li>
    <li>Sécurité du site et modération : intérêt légitime de l'éditeur (article 6.1.f).</li></ul>
    <h3>Notifications</h3><p>Si vous les activez, l'adresse technique d'abonnement fournie par votre navigateur (Apple, Google ou Mozilla) est enregistrée pour vous envoyer des notifications ; les notifications ne contiennent aucune donnée personnelle. Vous pouvez les désactiver à tout moment depuis « Mon compte ».</p>
    <h3>Premium</h3><p>Pour activer le Premium, nous conservons la formule choisie, la date et l'information que vous indiquez pour retrouver votre paiement. Le paiement lui-même est traité par PayPal, selon sa propre politique de confidentialité ; nous ne recevons jamais vos coordonnées bancaires. Ces données sont conservées 10 ans à des fins comptables (obligation légale).</p>
    <h3>Cookies et stockage local</h3><p>Le site utilise un seul cookie, « wc_session », strictement nécessaire pour rester connecté (durée : 30 jours), ainsi que le stockage local du navigateur pour votre progression et vos réglages. Ces éléments sont indispensables au service et ne nécessitent pas de consentement. Aucun cookie publicitaire ou de mesure d'audience n'est utilisé.</p>
    <h3>Photos de Wikipédia</h3><p>Les photos des cartes sont chargées directement depuis les serveurs de la Wikimedia Foundation, qui reçoivent donc votre adresse IP lors de leur affichage (voir la politique de confidentialité de la Wikimedia Foundation). Vous pouvez désactiver les photos dans les réglages du jeu.</p>
    <h3>Destinataires</h3><p>Seul l'administrateur du site accède aux données des comptes. Le pseudo, la vitrine, les statistiques de collection et les messages sont publics dans le hub. Les données sont hébergées par Cloudflare, Inc., qui peut les traiter hors de l'Union européenne dans le cadre de garanties prévues par le RGPD (Data Privacy Framework UE–États-Unis et clauses contractuelles types).</p>
    <h3>Durée de conservation</h3><p>Les données du compte sont conservées tant que le compte existe et peuvent être supprimées après 3 ans sans connexion. Les sessions de connexion expirent après 30 jours. Un compte supprimé est effacé immédiatement, avec sa sauvegarde et ses messages.</p>
    <h3>Vos droits</h3><p>Vous disposez des droits d'accès, de rectification, d'effacement, de portabilité, d'opposition et de limitation. Depuis « Mon compte », vous pouvez télécharger toutes vos données et supprimer votre compte vous-même. Pour toute autre demande : ${CONTACT}. Vous pouvez aussi adresser une réclamation à la CNIL (www.cnil.fr).</p>
    <h3>Mineurs</h3><p>Avant 15 ans, l'inscription nécessite l'accord d'un parent.</p>`],
  cgv: ["Conditions générales de vente", `
    <h3>1. Vendeur</h3><p>${EDITEUR}${ADRESSE ? `, ${ADRESSE}` : ""}. Contact : ${CONTACT}.${SIRET ? ` ${SIRET}.` : ""}</p>
    <h3>2. Offre</h3><p>Le Premium est un abonnement à des avantages numériques dans ${NOM_SITE} : 2 boosters Classiques supplémentaires par jour, accès aux boosters Prestige (dont un offert par semaine), chances de cartes Shiny doublées, 20 questions de quiz par jour au lieu de 10, 20 combats d'arène par jour au lieu de 10 et un badge 💎. Deux formules : <b>1 mois pour 5,99 €</b> (31 jours, sans renouvellement automatique) et <b>à vie pour 39,99 €</b> (pendant toute la durée d'exploitation du jeu). Prix toutes taxes comprises${TVA_NON_APPLICABLE ? " ; TVA non applicable, article 293 B du CGI" : ""}.</p>
    <h3>3. Commande et paiement</h3><p>Le paiement se fait par PayPal (paypal.me/noozoaa), en indiquant son pseudo dans la note. Le Premium est lié au compte du joueur et activé manuellement après vérification du paiement, en général sous 24 heures et au plus tard sous 7 jours. Sans activation dans ce délai, le joueur est remboursé sur simple demande.</p>
    <h3>4. Droit de rétractation</h3><p>Le Premium est un contenu numérique fourni sur un support immatériel. Conformément à l'article L221-28 13° du Code de la consommation, en demandant son activation, le joueur accepte que l'exécution commence immédiatement et renonce à son droit de rétractation une fois le Premium activé. Avant activation, il peut annuler sa commande et être remboursé intégralement.</p>
    <h3>5. Durée et fin</h3><p>Les avantages s'appliquent pendant la durée achetée. En cas de suspension du compte pour manquement grave aux conditions d'utilisation, le Premium prend fin sans remboursement. En cas d'arrêt définitif du jeu, les joueurs Premium en cours (formule mensuelle) sont remboursés au prorata de la durée restante.</p>
    <h3>6. Réclamations et médiation</h3><p>Pour toute réclamation : ${CONTACT}. En cas de litige, le consommateur peut recourir gratuitement à un médiateur de la consommation ou à la plateforme européenne de règlement en ligne des litiges. Droit applicable : droit français.</p>`],
};
function vueLegal(v, opts = {}) {
  const page = PAGES_LEGALES[opts.page] ? opts.page : "mentions";
  const [titre, html] = PAGES_LEGALES[page];
  v.innerHTML = `<div class="toolbar">${Object.entries(PAGES_LEGALES).map(([k, [t]]) => `<button class="chip ${k === page ? "on" : ""}" data-legal="${k}">${t}</button>`).join("")}</div>
    <article class="panel legal"><h2 style="margin-top:0">${titre}</h2>${html}<p class="muted" style="font-size:13px">Dernière mise à jour : ${MAJ_LEGALE}.</p></article>`;
  brancherLiens(v);
}

/* =====================================================================
   Application installable (PWA)
   ===================================================================== */
const PWA = { prompt: null, installee: matchMedia("(display-mode: standalone)").matches || navigator.standalone === true };
function installerPWA() {
  addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); PWA.prompt = e; majBoutonInstall(); });
  addEventListener("appinstalled", () => { PWA.prompt = null; PWA.installee = true; majBoutonInstall(); toast("📲 WorldCards est installé sur votre appareil !"); });
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}
function majBoutonInstall() {
  const b = $("#installBtn");
  if (b) b.classList.toggle("hidden", !PWA.prompt);
  if (S.vue === "compte") aller("compte");
}
async function installer() {
  if (!PWA.prompt) return;
  PWA.prompt.prompt();
  await PWA.prompt.userChoice.catch(() => {});
  PWA.prompt = null; majBoutonInstall();
}
