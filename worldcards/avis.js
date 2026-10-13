/* =====================================================================
   Avis des joueurs, en bas de toutes les pages, et leur gestion dans l'admin.
   La note en étoiles reprend le composant PeekRating de React Bits (licence MIT),
   réécrit sans React : les étoiles se soulèvent jusqu'au pointeur, une bulle
   affiche le libellé, l'étoile choisie « saute » à la validation, clavier compris.
   ===================================================================== */
const ETOILE_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" d="M12 2.8l2.75 5.57 6.15.9-4.45 4.33 1.05 6.12L12 16.83l-5.5 2.89 1.05-6.12L3.1 9.27l6.15-.9z"/></svg>`;
const LIBELLES_AVIS = ["Bof", "Moyen", "Bien", "Très bien", "Génial !"];

function creerPeekRating({ valeur = 0, nombre = 5, libelles = LIBELLES_AVIS, taille = 32, levee = 7, loupe = 1.15, duree = 320, saut = 1.3, bulle = true, effacer = true, lecture = false, onChange } = {}) {
  const lent = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const racine = document.createElement("div");
  racine.className = "peek-rating" + (lecture ? " lecture" : "");
  racine.setAttribute("role", lecture ? "img" : "radiogroup");
  racine.setAttribute("aria-label", lecture ? `${valeur} sur ${nombre}` : "Votre note");
  const salle = !lecture && bulle ? Math.round(taille * 0.9) : 0;
  racine.style.cssText = `--pr-size:${taille}px;--pr-gap:${Math.round(taille * 0.22)}px;--pr-room:${lecture ? 0 : levee + salle}px;--pr-rise:${duree}ms`;
  const rangee = document.createElement("div"); rangee.className = "peek-rating__row"; racine.appendChild(rangee);
  const pointe = !lecture && bulle ? Object.assign(document.createElement("span"), { className: "peek-rating__tip" }) : null;
  if (pointe) { pointe.setAttribute("aria-hidden", "true"); rangee.appendChild(pointe); }
  const etoiles = [], levees = [], glyphes = [];
  for (let i = 0; i < nombre; i++) {
    const b = document.createElement(lecture ? "span" : "button");
    b.className = "peek-rating__star";
    if (!lecture) { b.type = "button"; b.setAttribute("role", "radio"); b.setAttribute("aria-label", `${i + 1} sur ${nombre}${libelles[i] ? ", " + libelles[i] : ""}`); }
    const l = document.createElement("span"); l.className = "peek-rating__lift";
    const g = document.createElement("span"); g.className = "peek-rating__glyph garder-emoji"; g.innerHTML = ETOILE_SVG;
    l.appendChild(g); b.appendChild(l); rangee.appendChild(b);
    etoiles.push(b); levees.push(l); glyphes.push(g);
  }
  const st = { survol: null, appui: false, pointeur: null, pose: false, rect: null };
  function peindre() {
    const apercu = st.survol !== null && !st.pose, montre = apercu ? st.survol + 1 : valeur, fixe = lent();
    for (let i = 0; i < nombre; i++) {
      levees[i].style.transform = apercu && !fixe && i <= st.survol ? `translateY(${-levee}px) scale(${i === st.survol ? loupe : 1})` : "translateY(0px) scale(1)";
      glyphes[i].dataset.lit = i < (lecture ? Math.round(montre) : montre) ? "true" : "false";
      if (!lecture) { etoiles[i].setAttribute("aria-checked", String(valeur === i + 1)); etoiles[i].tabIndex = (valeur === 0 ? i === 0 : valeur === i + 1) ? 0 : -1; }
    }
    if (!pointe) return;
    if (apercu) {
      const cache = pointe.dataset.show !== "true", place = rangee.clientWidth / nombre;
      if (cache) pointe.style.transition = "none";
      pointe.textContent = libelles[st.survol] ?? String(st.survol + 1);
      pointe.style.transform = `translate(calc(${place * (st.survol + 0.5)}px - 50%), 0)`;
      if (cache) { void pointe.offsetWidth; pointe.style.transition = ""; }
      pointe.dataset.show = "true";
    } else pointe.dataset.show = "false";
  }
  const survoler = (i) => { if (i === st.survol) return; st.survol = i; if (i !== null) st.pose = false; peindre(); };
  const mesurer = () => { st.rect = rangee.getBoundingClientRect(); };
  const indiceA = (x, y) => {
    const r = st.rect; if (!r || !r.width) return null;
    if (st.appui && (y < r.top - taille || y > r.bottom + taille)) return null;
    return Math.min(nombre - 1, Math.max(0, Math.floor((x - r.left) / r.width * nombre)));
  };
  function valider(n, sauter = true) {
    valeur = n; st.pose = true; peindre(); onChange?.(n);
    const g = glyphes[n - 1];
    if (sauter && n > 0 && saut > 1 && g?.animate && !lent()) {
      g.getAnimations().forEach((a) => a.cancel());
      g.animate([{ transform: "scale(1)", easing: "cubic-bezier(.23,1,.32,1)" }, { transform: `scale(${saut})`, offset: .35, easing: "cubic-bezier(.23,1,.32,1)" }, { transform: "scale(1)" }], { duration: 300 });
    }
  }
  if (!lecture) {
    rangee.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") { racine.removeAttribute("data-instant"); mesurer(); } });
    rangee.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || st.pointeur !== null) return;
      racine.removeAttribute("data-instant");
      try { rangee.setPointerCapture(e.pointerId); } catch {}
      st.pointeur = e.pointerId; st.appui = true; mesurer(); survoler(indiceA(e.clientX, e.clientY));
    });
    rangee.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse" && !st.appui) return;
      if (st.appui && e.pointerId !== st.pointeur) return;
      if (!st.appui && !st.rect) mesurer();
      survoler(indiceA(e.clientX, e.clientY));
    });
    const finAppui = (e) => {
      if (!st.appui || e.pointerId !== st.pointeur) return;
      st.appui = false; st.pointeur = null;
      if (e.type === "pointerup" && st.survol !== null) { const n = st.survol + 1; valider(effacer && n === valeur ? 0 : n); }
      if (e.pointerType !== "mouse") survoler(null);
    };
    for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) rangee.addEventListener(t, finAppui);
    rangee.addEventListener("pointerleave", () => { if (!st.appui) survoler(null); });
    racine.addEventListener("keydown", (e) => {
      const min = effacer ? 0 : 1; let n;
      switch (e.key) {
        case "ArrowRight": case "ArrowUp": n = Math.min(nombre, valeur + 1); break;
        case "ArrowLeft": case "ArrowDown": n = Math.max(min, valeur - 1); break;
        case "Home": n = 1; break;
        case "End": n = nombre; break;
        case "Backspace": case "Delete": if (!effacer) return; n = 0; break;
        case " ": case "Enter": { const i = etoiles.indexOf(e.target); if (i < 0) return; n = effacer && i + 1 === valeur ? 0 : i + 1; break; }
        default: return;
      }
      e.preventDefault(); racine.setAttribute("data-instant", "true"); st.survol = null; valider(n, false); etoiles[Math.max(n, 1) - 1]?.focus();
    });
  }
  peindre();
  return { el: racine, get valeur() { return valeur; }, set valeur(v) { valeur = v; st.pose = true; peindre(); } };
}
const etoilesLecture = (note, taille = 18) => creerPeekRating({ valeur: note, taille, lecture: true, bulle: false }).el.outerHTML;

/* ---------- Bloc « Avis des joueurs » au-dessus du pied de page ---------- */
let avisDonnees = null;
async function chargerAvis(bloc) {
  try { avisDonnees = await api(`avis?t=${Date.now()}`); } catch (e) { bloc.innerHTML = ""; return; }
  rendreAvis(bloc);
}
function carteAvis(a) {
  const admin = typeof COMPTE !== "undefined" && COMPTE.admin;
  return `<article class="avis-carte" data-avis="${a.id}">
    <header><b>${esc(a.pseudo)}</b>${etoilesLecture(a.note, 17)}<small class="muted">${new Date(a.maj).toLocaleDateString("fr-FR")}</small></header>
    ${a.texte ? `<p>${esc(a.texte)}</p>` : ""}
    ${a.reponse ? `<div class="avis-reponse"><b>Réponse de Play2F1</b><p>${esc(a.reponse)}</p></div>` : ""}
    ${admin ? `<div class="avis-actions"><button class="btn small" data-av-rep>${a.reponse ? "Modifier ma réponse" : "Répondre"}</button><button class="btn small" data-av-suppr>Supprimer</button></div>
      <div class="avis-repondre hidden"><textarea rows="2" maxlength="600" placeholder="Votre réponse publique…">${esc(a.reponse || "")}</textarea>
        <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn primary small" data-av-envoyer>Publier la réponse</button>${a.reponse ? `<button class="btn small" data-av-retirer>Retirer la réponse</button>` : ""}<button class="btn small" data-av-annuler>Annuler</button></div></div>` : ""}</article>`;
}
function rendreAvis(bloc) {
  const d = avisDonnees, co = typeof connecte === "function" && connecte();
  const max = Math.max(1, ...d.repartition);
  bloc.innerHTML = `<div class="avis-in">
    <div class="avis-tete">
      <div><h2>Ce que les joueurs <em>en pensent.</em></h2>
        <div class="avis-moyenne">${d.total ? `<b>${String(d.moyenne).replace(".", ",")}</b>${etoilesLecture(d.moyenne, 24)}<span class="muted">${d.total} avis</span>` : `<span class="muted">Aucun avis pour l'instant : soyez le premier !</span>`}</div>
        ${d.total ? `<div class="avis-barres">${[5, 4, 3, 2, 1].map((n) => `<div><span>${n}</span><i><b style="width:${Math.round(d.repartition[n - 1] / max * 100)}%"></b></i><small>${d.repartition[n - 1]}</small></div>`).join("")}</div>` : ""}
      </div>
      <div class="avis-form panel">
        <h3>${d.moi ? "Votre avis" : "Donnez votre avis"}</h3>
        ${co ? `<div id="avisNote"></div>
          <textarea id="avisTexte" rows="3" maxlength="600" placeholder="Qu'est-ce qui vous plaît ? Qu'est-ce qu'on pourrait améliorer ?">${esc(d.moi?.texte || "")}</textarea>
          <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn primary" id="avisEnvoyer">${d.moi ? "Mettre à jour" : "Publier mon avis"}</button>${d.moi ? `<button class="btn small" id="avisRetirer">Retirer mon avis</button>` : ""}</div>
          ${d.moi?.reponse ? `<div class="avis-reponse"><b>Réponse de Play2F1</b><p>${esc(d.moi.reponse)}</p></div>` : ""}`
        : `<p class="muted">Connectez-vous pour noter le jeu et laisser un commentaire.</p><button class="btn primary" data-aller="compte">Se connecter</button>`}
      </div>
    </div>
    ${d.liste.length ? `<div class="avis-liste" id="avisListe">${d.liste.map(carteAvis).join("")}</div>` : ""}
    ${d.suite ? `<button class="btn" id="avisPlus" style="margin-top:14px">Voir plus d'avis</button>` : ""}
  </div>`;
  brancherLiens?.(bloc);
  brancherAdminAvis(bloc);
  if (!co) return;
  const note = creerPeekRating({ valeur: d.moi?.note || 0 });
  $("#avisNote", bloc).appendChild(note.el);
  $("#avisEnvoyer", bloc).onclick = async () => {
    if (!note.valeur) return toast("Choisissez d'abord une note en étoiles.");
    $("#avisEnvoyer", bloc).disabled = true;
    try { await api("avis", { methode: "POST", corps: { note: note.valeur, texte: $("#avisTexte", bloc).value } }); toast("Merci pour votre avis !"); chargerAvis(bloc); }
    catch (e) { toast("⚠ " + e.message); $("#avisEnvoyer", bloc).disabled = false; }
  };
  $("#avisRetirer", bloc)?.addEventListener("click", async () => {
    if (!confirm("Retirer votre avis ?")) return;
    try { await api("avis", { methode: "DELETE" }); toast("Avis retiré."); chargerAvis(bloc); } catch (e) { toast("⚠ " + e.message); }
  });
  let page = 0;
  $("#avisPlus", bloc)?.addEventListener("click", async (e) => {
    page++;
    try { const r = await api(`avis?page=${page}`); $("#avisListe", bloc).insertAdjacentHTML("beforeend", r.liste.map(carteAvis).join("")); brancherAdminAvis(bloc); if (!r.suite) e.target.remove(); } catch {}
  });
}
// L'admin répond ou supprime directement sous chaque avis
function brancherAdminAvis(bloc) {
  if (typeof COMPTE === "undefined" || !COMPTE.admin) return;
  for (const art of $$(".avis-carte[data-avis]:not([data-branche])", bloc)) {
    art.dataset.branche = "1";
    const id = art.dataset.avis, zone = $(".avis-repondre", art);
    const envoyer = async (texte) => {
      try { await api(`admin/avis/${id}/reponse`, { methode: "POST", corps: { texte } }); toast(texte ? "Réponse publiée : le joueur est prévenu." : "Réponse retirée."); chargerAvis(bloc); }
      catch (e) { toast("⚠ " + e.message); }
    };
    $("[data-av-rep]", art).onclick = () => { zone.classList.remove("hidden"); $("textarea", zone).focus(); };
    $("[data-av-annuler]", art).onclick = () => zone.classList.add("hidden");
    $("[data-av-envoyer]", art).onclick = () => { const t = $("textarea", zone).value.trim(); if (!t) return toast("Écrivez une réponse."); envoyer(t); };
    $("[data-av-retirer]", art)?.addEventListener("click", () => envoyer(""));
    $("[data-av-suppr]", art).onclick = async () => {
      if (!confirm("Supprimer définitivement cet avis ?")) return;
      try { await api(`admin/avis/${id}`, { methode: "DELETE" }); toast("Avis supprimé."); chargerAvis(bloc); } catch (e) { toast("⚠ " + e.message); }
    };
  }
}
function installerAvis() {
  if ($("#avis")) return;
  const bloc = document.createElement("section");
  bloc.id = "avis"; bloc.className = "avis-zone"; bloc.setAttribute("aria-label", "Avis des joueurs");
  $(".pied")?.before(bloc);
  // Chargé seulement quand on arrive en bas de la page
  const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { io.disconnect(); chargerAvis(bloc); } }, { rootMargin: "300px" });
  io.observe(bloc);
  if (location.hash === "#avis") setTimeout(() => bloc.scrollIntoView({ behavior: "smooth" }), 1200);
}
if (document.readyState === "loading") addEventListener("DOMContentLoaded", installerAvis); else installerAvis();
// Une fois connecté, le formulaire apparaît
setTimeout(() => { const b = $("#avis"); if (b && avisDonnees) chargerAvis(b); }, 4000);

/* ---------- Admin : tous les avis, réponses et suppression ---------- */
let adminAvisFiltre = "tous";
async function adminAvis(el) {
  el.innerHTML = "Chargement…";
  try {
    const d = await api(`admin/avis?filtre=${adminAvisFiltre}&t=${Date.now()}`);
    el.innerHTML = `<div class="eco-chiffres">
        <div class="panel"><small class="muted">Note moyenne</small><b>${d.total ? String(d.moyenne).replace(".", ",") + " / 5" : "—"}</b><small class="muted">${d.total} avis</small></div>
        <div class="panel"><small class="muted">Avis négatifs (1 ou 2 étoiles)</small><b>${d.negatifs}</b></div>
        <div class="panel"><small class="muted">Commentaires sans réponse</small><b>${d.sansReponse}</b></div></div>
      <div class="toolbar" style="margin:14px 0">${[["tous", "Tous"], ["negatifs", "Négatifs"], ["sans-reponse", "Sans réponse"]].map(([k, n]) => `<button class="chip ${adminAvisFiltre === k ? "on" : ""}" data-af="${k}">${n}</button>`).join("")}</div>
      ${d.avis.length ? d.avis.map((a) => `<article class="panel avis-admin ${a.note <= 2 ? "negatif" : ""}" data-id="${a.id}">
        <header><b>${esc(a.pseudo)}</b>${etoilesLecture(a.note, 18)}<small class="muted">${new Date(a.maj).toLocaleString("fr-FR")}</small></header>
        ${a.texte ? `<p>${esc(a.texte)}</p>` : `<p class="muted">(note sans commentaire)</p>`}
        <label class="muted" style="font-size:13px">Votre réponse publique${a.reponse ? " (déjà envoyée, vous pouvez la modifier)" : ""}</label>
        <textarea rows="2" maxlength="600" data-rep>${esc(a.reponse || "")}</textarea>
        <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn primary small" data-repondre>${a.reponse ? "Modifier la réponse" : "Répondre"}</button>
          ${a.reponse ? `<button class="btn small" data-effacer>Retirer la réponse</button>` : ""}<button class="btn small" data-suppr>Supprimer l'avis</button></div></article>`).join("") : `<p class="muted">Aucun avis ici.</p>`}`;
    $$("[data-af]", el).forEach((b) => b.onclick = () => { adminAvisFiltre = b.dataset.af; adminAvis(el); });
    $$(".avis-admin", el).forEach((art) => {
      const id = art.dataset.id;
      const envoyer = async (texte) => { try { await api(`admin/avis/${id}/reponse`, { methode: "POST", corps: { texte } }); toast(texte ? "Réponse publiée : le joueur est prévenu." : "Réponse retirée."); adminAvis(el); } catch (e) { toast("⚠ " + e.message); } };
      $("[data-repondre]", art).onclick = () => { const t = $("[data-rep]", art).value.trim(); if (!t) return toast("Écrivez une réponse."); envoyer(t); };
      $("[data-effacer]", art)?.addEventListener("click", () => envoyer(""));
      $("[data-suppr]", art).onclick = async () => { if (!confirm("Supprimer définitivement cet avis ?")) return; try { await api(`admin/avis/${id}`, { methode: "DELETE" }); toast("Avis supprimé."); adminAvis(el); } catch (e) { toast("⚠ " + e.message); } };
    });
  } catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}
