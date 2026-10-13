/* =====================================================================
   Boosters créés dans l'admin : une pochette par booster (nom, image, prix, cartes,
   catégories, dates de vente). Ils rejoignent la boutique avec les boosters thématiques ;
   une fois la date de fin passée, ils ne sont plus vendus mais ceux déjà achetés s'ouvrent toujours.
   ===================================================================== */
const CLE_BOOSTERS_PERSO = "worldcards:boosters-perso";
function appliquerBoostersPerso(liste) {
  for (const k of Object.keys(PACKS)) if (PACKS[k].perso) delete PACKS[k];
  for (const b of liste || []) {
    const cats = b.categories || [], fin = b.fin || null;
    const enVente = b.enVente !== false && (!fin || fin > Date.now());
    const ordre = RARETES[b.garantie]?.ordre ?? 2;
    PACKS["perso-" + b.cle] = {
      nom: b.nom, emoji: "🎁", prix: b.prix, cartes: b.cartes, garanties: ordre > 0 ? [ordre] : [], shiny: b.shiny || 1,
      perso: true, theme: enVente, couleur: b.couleur || undefined, fin,
      filtre: cats.length ? (c) => cats.includes(c.type) : null,
      desc: (b.description ? esc(b.description) + " " : `${b.cartes} cartes${cats.length ? " « " + cats.map((k) => esc(TYPES[k] || k)).join(", ") + " »" : ""}, dont une ${esc(RARETES[b.garantie]?.nom?.toLowerCase() || "rare")} ou mieux. `)
        + (fin && enVente ? `<b>Jusqu'au ${new Date(fin).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}.</b>` : ""),
    };
  }
}
try { appliquerBoostersPerso(JSON.parse(localStorage.getItem(CLE_BOOSTERS_PERSO) || "[]")); } catch {}
async function chargerBoostersPerso(frais) {
  try {
    const { boosters } = await api(`boosters/perso?t=${frais ? Date.now() : Math.floor(Date.now() / 6e4)}`);
    appliquerBoostersPerso(boosters);
    try { localStorage.setItem(CLE_BOOSTERS_PERSO, JSON.stringify(boosters)); } catch {}
    if (S.vue === "boosters" && $("#modal").classList.contains("hidden")) aller("boosters");
  } catch {}
}
addEventListener("DOMContentLoaded", () => setTimeout(chargerBoostersPerso, 400));

// Onglet admin « Boosters créés »
const versLocal = (ms) => { if (!ms) return ""; const d = new Date(ms - new Date().getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };
async function adminBoosters(el, edition) {
  el.innerHTML = `<p class="muted">Chargement…</p>`;
  let liste = [];
  try {
    liste = (await api("admin/boosters")).boosters;
    VISUELS = (await api(`visuels?t=${Date.now()}`)).visuels || VISUELS;
  } catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
  const b = liste.find((x) => x.cle === edition) || {};
  const cats = [["pays", "Pays"], ...(typeof categoriesPourCartes === "function" ? categoriesPourCartes() : [])];
  const nb = (k) => CARDS.filter((c) => c.type === k && c.type !== "secrete" && !c.saisonnier).length;
  const rars = Object.keys(RARETES).filter((r) => r !== "secrete");
  el.innerHTML = `<p class="muted">Créez vos propres pochettes de boosters : choisissez les catégories de cartes qu'elles contiennent, le prix, le nombre de cartes et la période de vente, puis envoyez l'image de la pochette (portrait 2:3 conseillé, par exemple 800 × 1200).</p>
    <form class="form panel bp-form" id="fBooster">
      <h3 style="margin-top:0">${b.cle ? "Modifier « " + esc(b.nom) + " »" : "Nouveau booster"}</h3>
      <div class="bp-grille">
        <label>Nom<input name="nom" required maxlength="40" value="${esc(b.nom || "")}" placeholder="Booster Merveilles"></label>
        <label>Identifiant<input name="cle" required pattern="[a-z0-9-]{2,30}" value="${esc(b.cle || "")}" ${b.cle ? "readonly" : ""} placeholder="merveilles"><small class="muted">minuscules, chiffres et tirets</small></label>
        <label>Prix (pièces)<input name="prix" type="number" min="10" max="100000" value="${b.prix || 300}"></label>
        <label>Cartes par booster<input name="cartes" type="number" min="1" max="15" value="${b.cartes || 5}"></label>
        <label>Rareté garantie<select name="garantie">${rars.map((r) => `<option value="${r}" ${(b.garantie || "rare") === r ? "selected" : ""}>${esc(RARETES[r].nom)} ou mieux</option>`).join("")}</select></label>
        <label>Chance Shiny ×<input name="shiny" type="number" min="0" max="10" step="0.5" value="${b.shiny || 1}"></label>
        <label>Couleur<input name="couleur" type="color" value="${b.couleur || "#2a5ae6"}"></label>
        <label>Ordre<input name="ordre" type="number" value="${b.ordre || 0}"></label>
        <label>Début de la vente<input name="debut" type="datetime-local" value="${versLocal(b.debut)}"><small class="muted">vide : tout de suite</small></label>
        <label>Fin de la vente<input name="fin" type="datetime-local" value="${versLocal(b.fin)}"><small class="muted">vide : sans fin</small></label>
      </div>
      <label>Description (facultatif)<input name="description" maxlength="160" value="${esc(b.description || "")}" placeholder="5 cartes de merveilles du monde, dont une épique ou mieux."></label>
      <fieldset class="bp-cats"><legend>Catégories contenues <small class="muted">(aucune cochée : toutes les cartes)</small></legend>
        ${cats.map(([k, n]) => `<label class="check"><input type="checkbox" name="cat" value="${k}" ${(b.categories || []).includes(k) ? "checked" : ""}> ${esc(n)} <small class="muted">${nb(k)}</small></label>`).join("")}</fieldset>
      <label class="check"><input type="checkbox" name="actif" ${b.actif === false ? "" : "checked"}> Actif (visible en boutique pendant la période de vente)</label>
      <label>Image de la pochette<input type="file" name="image" accept="image/*"></label>
      <div class="row" style="gap:8px"><button class="btn primary">${b.cle ? "Enregistrer" : "Créer le booster"}</button>${b.cle ? `<button type="button" class="btn" id="bpAnnuler">Nouveau booster</button>` : ""}</div>
    </form>
    <h3>Boosters créés (${liste.length})</h3>
    ${liste.length ? `<div class="bp-liste">${liste.map((x) => {
      const k = "perso-" + x.cle, t = Date.now();
      const etat = !x.actif ? "désactivé" : x.debut && x.debut > t ? "à venir" : x.fin && x.fin <= t ? "terminé" : "en vente";
      return `<div class="bp-item panel">
        <div class="pack ${k} mini-visuel" style="--pc:${x.couleur || "#2a5ae6"}"><span class="big">🎁</span><b>${esc(x.nom)}</b></div>
        <div class="bp-infos"><b>${esc(x.nom)}</b> <span class="rbadge ${etat === "en vente" ? "" : "muted"}">${etat}</span>
          <small class="muted">${fmt(x.prix)} pièces · ${x.cartes} cartes · ${esc(RARETES[x.garantie]?.nom || x.garantie)} garantie${x.categories.length ? " · " + x.categories.map((c) => esc(TYPES[c] || c)).join(", ") : " · toutes catégories"}</small>
          <small class="muted">${x.debut ? "du " + new Date(x.debut).toLocaleString("fr-FR") : "dès maintenant"}${x.fin ? " au " + new Date(x.fin).toLocaleString("fr-FR") : ", sans fin"}${VISUELS[k] ? " · image envoyée" : " · pas d'image"}</small>
          <div class="row" style="gap:6px;margin-top:6px"><button class="btn small" data-bp-edit="${x.cle}">Modifier</button><button class="btn small" data-bp-suppr="${x.cle}">Supprimer</button></div></div></div>`;
    }).join("")}</div>` : `<p class="muted">Aucun booster créé pour l'instant.</p>`}`;
  appliquerVisuels(el);
  // Pochettes non encore chargées dans PACKS : on pose l'image à la main
  $$(".bp-item .pack", el).forEach((p) => { const k = [...p.classList].find((c) => c.startsWith("perso-")); if (k && VISUELS[k] && !p.classList.contains("a-visuel")) { p.classList.add("a-visuel"); p.style.setProperty("background-image", `url(/api/visuel/${encodeURIComponent(k)}?v=${VISUELS[k]})`, "important"); } });
  $("#bpAnnuler", el)?.addEventListener("click", () => adminBoosters(el));
  $$("[data-bp-edit]", el).forEach((x) => x.onclick = () => { adminBoosters(el, x.dataset.bpEdit); scrollTo({ top: 0, behavior: "smooth" }); });
  $$("[data-bp-suppr]", el).forEach((x) => x.onclick = async () => {
    if (!confirm("Supprimer ce booster ? Les joueurs qui l'ont en stock ne pourront plus l'ouvrir.")) return;
    try { await api("admin/boosters/" + x.dataset.bpSuppr, { methode: "DELETE" }); await api("admin/visuels/" + encodeURIComponent("perso-" + x.dataset.bpSuppr), { methode: "DELETE" }).catch(() => {}); toast("Booster supprimé."); chargerBoostersPerso(true); adminBoosters(el); }
    catch (e) { toast("⚠ " + e.message); }
  });
  $("#fBooster", el).onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target, d = new FormData(f), bouton = $("button.primary", f);
    const cle = String(d.get("cle") || "").trim().toLowerCase();
    if (!/^[a-z0-9-]{2,30}$/.test(cle)) return toast("⚠ Identifiant invalide (minuscules, chiffres, tirets).");
    const date = (v) => (v ? new Date(v).getTime() : null);
    const corps = { nom: d.get("nom"), description: d.get("description"), prix: Number(d.get("prix")), cartes: Number(d.get("cartes")), garantie: d.get("garantie"), shiny: Number(d.get("shiny")),
      couleur: d.get("couleur"), ordre: Number(d.get("ordre")), debut: date(d.get("debut")), fin: date(d.get("fin")), actif: !!d.get("actif"), categories: d.getAll("cat") };
    if (corps.debut && corps.fin && corps.fin <= corps.debut) return toast("⚠ La fin doit être après le début.");
    bouton.disabled = true;
    try {
      const r = await api("admin/boosters/" + cle, { methode: "PUT", corps });
      const fichier = f.image.files[0];
      if (fichier) { const image = await preparerVisuel(fichier); const v = await api("admin/visuels", { methode: "POST", corps: { cle: r.cle, image } }); VISUELS[r.cle] = v.maj; }
      toast("📦 Booster enregistré" + (fichier ? " avec son image." : "."));
      await chargerBoostersPerso(true); adminBoosters(el, cle);
    } catch (err) { toast("⚠ " + err.message, 6000); bouton.disabled = false; }
  };
}
