/* =====================================================================
   Image à partager : la carte telle qu'elle apparaît dans le jeu, en métal.
   Photo derrière toute la carte, reflets métalliques brossés, badge de catégorie,
   statut (Holo, Shiny, Dorée), nom, numéro, coût et statistiques avec icônes au trait.
   ===================================================================== */
const iconeImage = (k, couleur = "#fff", trait = 1.8) => chargerImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96" fill="none" stroke="${couleur}" stroke-width="${trait}" stroke-linecap="round" stroke-linejoin="round">${(typeof TRAITS === "object" && TRAITS[k]) || '<circle cx="12" cy="12" r="3"/>'}</svg>`));
function pilule(g, x, y, h, texte, { fond = "rgba(10,14,30,.55)", bord = "rgba(255,255,255,.35)", couleur = "#fff", taille = h * 0.46, ic = null, aDroite = false } = {}) {
  g.font = `800 ${Math.round(taille)}px "Bricolage Grotesque", Nunito, sans-serif`;
  const pad = h * 0.42, icw = ic ? h * 0.62 : 0, w = pad * 2 + icw + (ic ? h * 0.18 : 0) + g.measureText(texte).width;
  const x0 = aDroite ? x - w : x;
  rectArrondi(g, x0, y, w, h, h / 2); g.fillStyle = fond; g.fill(); g.lineWidth = Math.max(1.5, h * 0.05); g.strokeStyle = bord; g.stroke();
  if (ic) g.drawImage(ic, x0 + pad, y + (h - icw) / 2, icw, icw);
  g.fillStyle = couleur; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(texte, x0 + pad + icw + (ic ? h * 0.18 : 0), y + h / 2 + 1);
  g.textBaseline = "alphabetic";
  return w;
}
// Reflets métalliques : bandes diagonales et fines stries brossées
function refletsMetal(g, x, y, w, h, teinte) {
  g.save();
  g.globalCompositeOperation = "screen";
  const bande = g.createLinearGradient(x, y, x + w, y + h);
  [[0, "rgba(255,255,255,0)"], [0.18, "rgba(255,255,255,.22)"], [0.26, "rgba(255,255,255,0)"], [0.48, "rgba(255,255,255,0)"], [0.56, "rgba(255,255,255,.30)"], [0.62, "rgba(255,255,255,.04)"], [0.84, "rgba(255,255,255,.16)"], [1, "rgba(255,255,255,0)"]].forEach(([o, c]) => bande.addColorStop(o, c));
  g.fillStyle = bande; g.fillRect(x, y, w, h);
  g.globalAlpha = 0.22; g.fillStyle = teinte; g.fillRect(x, y, w, h); g.globalAlpha = 1;
  g.globalCompositeOperation = "overlay"; g.globalAlpha = 0.12;
  let graine = 7; const alea = () => (graine = (graine * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < h; i += 2) { g.fillStyle = alea() > 0.5 ? "#fff" : "#000"; g.fillRect(x, y + i, w, 1); }
  g.restore();
}
function effetsSpeciaux(g, x, y, w, h, { holo, shiny, doree }) {
  g.save();
  if (holo || doree) {
    g.globalCompositeOperation = doree ? "overlay" : "color-dodge"; g.globalAlpha = doree ? 0.5 : 0.32;
    const arc = g.createLinearGradient(x, y + h, x + w, y);
    (doree ? ["#7a5200", "#ffe08a", "#b07a10", "#fff3c4", "#8a5d00"] : ["#ff5f6d", "#ffc371", "#7bff9e", "#5ad1ff", "#b47bff", "#ff5fd2"]).forEach((c, i, a) => arc.addColorStop(i / (a.length - 1), c));
    g.fillStyle = arc; g.fillRect(x, y, w, h);
  }
  if (shiny || holo || doree) {
    g.globalCompositeOperation = "screen"; g.globalAlpha = 1;
    let graine = 42; const alea = () => (graine = (graine * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < (shiny ? 46 : 22); i++) {
      const sx = x + alea() * w, sy = y + alea() * h, r = w * (0.006 + alea() * (shiny ? 0.02 : 0.012));
      g.fillStyle = shiny ? "rgba(255,248,220,.95)" : "rgba(255,255,255,.8)";
      g.beginPath(); for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4, rr = k % 2 ? r * 0.28 : r; g.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); } g.closePath(); g.fill();
    }
  }
  g.restore();
}
dessinerCarte = async function (g, c, x, y, w, h) {
  const col = couleurCarte(c), r = w * 0.065, u = w / 100;
  const doree = !!S.doree?.[c.id], shiny = !doree && !!S.shiny?.[c.id], holo = !doree && !shiny && !!S.holo?.[c.id];
  const n = S.owned[c.id] || 0;
  const st = n ? statsDe(c, S.qualite[c.id], n, shiny, doree) : statsDe(c);
  const tal = COMBAT.TALENTS?.[st.talent || COMBAT.talentDe?.(c.id, c.type)];
  const [img, icType, icEpee, icBouclier, icCoeur, icTuile] = await Promise.all([chargerImage(sourceVisuel(c)), iconeImage(ICONE_TYPE[c.type] || "point"),
    iconeImage("epees", "#ff9b8a", 2.2), iconeImage("bouclier", "#9cc8ff", 2.2), iconeImage("coeur", "#ff8fb1", 2.2), iconeImage(tal ? "eclair" : ICONE_TYPE[c.type] || "point", "#fff", 2)]);
  // Ombre portée
  g.save(); g.shadowColor = "rgba(10,15,40,.45)"; g.shadowBlur = w * 0.08; g.shadowOffsetY = w * 0.03; rectArrondi(g, x, y, w, h, r); g.fillStyle = "#151b33"; g.fill(); g.restore();
  g.save(); rectArrondi(g, x, y, w, h, r); g.clip();
  // Fond : dégradé de la couleur de la carte puis la photo sur toute la carte, nette
  const fond = g.createLinearGradient(x, y, x + w, y + h); fond.addColorStop(0, col); fond.addColorStop(1, "#151b33"); g.fillStyle = fond; g.fillRect(x, y, w, h);
  if (img) {
    const drapeau = c.type === "pays" && !PHOTOS_PERSO?.[c.id] && /flags\//.test(img.src);
    if (drapeau) { const fw = w * 0.8, fh = fw * (img.height / img.width || 0.66); g.drawImage(img, x + (w - fw) / 2, y + h * 0.36 - fh / 2, fw, fh); }
    else { const k = Math.max(w / img.width, h / img.height), iw = img.width * k, ih = img.height * k; g.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); }
  } else if (icType) { g.globalAlpha = 0.35; g.drawImage(icType, x + w * 0.2, y + h * 0.16, w * 0.6, w * 0.6); g.globalAlpha = 1; }
  refletsMetal(g, x, y, w, h, col);
  effetsSpeciaux(g, x, y, w, h, { holo, shiny, doree });
  // Voile sombre en haut et en bas pour lire le texte
  const voile = g.createLinearGradient(0, y, 0, y + h);
  [[0, "rgba(8,12,28,.55)"], [0.16, "rgba(8,12,28,0)"], [0.5, "rgba(8,12,28,0)"], [0.72, "rgba(8,12,28,.6)"], [1, "rgba(8,12,28,.92)"]].forEach(([o, c2]) => voile.addColorStop(o, c2));
  g.fillStyle = voile; g.fillRect(x, y, w, h);
  // En-tête : badge de catégorie et statut
  const ph = 9 * u;
  pilule(g, x + 5 * u, y + 5 * u, ph, TYPES[c.type] || "", { ic: icType });
  const statut = doree ? "Dorée" : shiny ? "Shiny" : holo ? "Holo" : RARETES[c.rarete]?.nom || "";
  pilule(g, x + w - 5 * u, y + 5 * u, ph, statut, { aDroite: true, fond: "rgba(255,255,255,.88)", bord: col, couleur: "#151b33" });
  // Identité
  g.textAlign = "left"; g.fillStyle = "#fff";
  g.shadowColor = "rgba(0,0,0,.45)"; g.shadowBlur = u * 2;
  texteAjuste(g, c.nom, x + 6 * u, y + h - 33 * u, w - 12 * u, Math.round(11 * u), 800, '"Bricolage Grotesque", Nunito, sans-serif');
  const sous = String(sousTitre(c) || "").replace(/[\p{Extended_Pictographic}️]+\s*/gu, "");
  if (sous) { g.fillStyle = "rgba(255,255,255,.82)"; g.font = `600 ${Math.round(5 * u)}px Nunito, sans-serif`; g.fillText(sous.slice(0, 40), x + 6 * u, y + h - 26 * u); }
  g.shadowBlur = 0;
  // Pied : étiquette, statistiques, tuile du talent
  const py = y + h - 21 * u, pw = w - 12 * u - 17 * u;
  rectArrondi(g, x + 5 * u, py, pw, 16 * u, 4 * u); g.fillStyle = "rgba(255,255,255,.12)"; g.fill(); g.strokeStyle = "rgba(255,255,255,.3)"; g.lineWidth = Math.max(1, u * 0.4); g.stroke();
  g.fillStyle = "rgba(255,255,255,.75)"; g.font = `700 ${Math.round(3.6 * u)}px Nunito, sans-serif`;
  g.fillText(`N° ${String(c.num || 0).padStart(3, "0")} · Coût ${coutDe(c)}${st.niveau > 1 ? ` · Niv. ${st.niveau}` : ""}`.toUpperCase(), x + 8 * u, py + 5.6 * u);
  let sx = x + 8 * u; g.font = `800 ${Math.round(6 * u)}px "Bricolage Grotesque", Nunito, sans-serif`; g.fillStyle = "#fff";
  for (const [ic, v] of [[icEpee, st.atk], [icBouclier, st.def], [icCoeur, st.pv]]) { if (ic) g.drawImage(ic, sx, py + 7.6 * u, 5.6 * u, 5.6 * u); g.fillText(String(v), sx + 6.8 * u, py + 12.8 * u); sx += 7.6 * u + g.measureText(String(v)).width + 4 * u; }
  const tx = x + w - 5 * u - 15 * u;
  rectArrondi(g, tx, py, 15 * u, 16 * u, 4 * u); g.fillStyle = col; g.fill(); g.strokeStyle = "rgba(255,255,255,.55)"; g.stroke();
  if (icTuile) g.drawImage(icTuile, tx + 3.5 * u, py + 4 * u, 8 * u, 8 * u);
  g.restore();
  // Liseré métal
  const lis = g.createLinearGradient(x, y, x + w, y + h); ["#ffffff", col, "#d9dde8", col, "#ffffff"].forEach((c2, i) => lis.addColorStop(i / 4, c2));
  rectArrondi(g, x, y, w, h, r); g.lineWidth = Math.max(4, w * 0.022); g.strokeStyle = lis; g.stroke();
};
// Fond clair aux couleurs du site (bleu clair et cobalt)
imagePartage = async function (cartes, { format = "story", pseudo = "", titre = "", lienTxt = "play2f1.com" } = {}) {
  const W = 1080, H = format === "story" ? 1920 : 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  try { await document.fonts?.load('800 40px "Bricolage Grotesque"'); } catch {}
  const fond = g.createLinearGradient(0, 0, 0, H); fond.addColorStop(0, "#dff2ff"); fond.addColorStop(1, "#8fd3ff"); g.fillStyle = fond; g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(42,90,230,.12)"; g.beginPath(); g.arc(W * 0.9, H * 0.08, W * 0.45, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(W * 0.05, H * 0.92, W * 0.4, 0, Math.PI * 2); g.fill();
  const logo = await chargerImage("icons/logo-site.png");
  if (logo) { const lh = 90, lw = logo.width * (lh / logo.height); g.drawImage(logo, (W - lw) / 2, 60, lw, lh); }
  g.textAlign = "center"; g.fillStyle = "#151b33"; texteAjuste(g, titre, W / 2, 220, W - 120, 56, 800, '"Bricolage Grotesque", Nunito, sans-serif');
  if (cartes.length === 1) {
    const w = format === "story" ? 760 : 610, h = w * 1.4; await dessinerCarte(g, cartes[0], (W - w) / 2, format === "story" ? 330 : 262, w, h);
  } else {
    const top = cartes.slice(0, 5), best = top[top.length - 1];
    const bw = format === "story" ? 560 : 420, bh = bw * 1.4, by = format === "story" ? 290 : 260;
    await dessinerCarte(g, best, (W - bw) / 2, by, bw, bh);
    const autres = top.slice(0, -1), sw = format === "story" ? 230 : 200, sh = sw * 1.4, gap = 18, tot = autres.length * sw + (autres.length - 1) * gap;
    for (let i = 0; i < autres.length; i++) await dessinerCarte(g, autres[i], (W - tot) / 2 + i * (sw + gap), by + bh + 40, sw, sh);
  }
  g.textAlign = "center";
  if (pseudo) { g.fillStyle = "#3a4466"; g.font = "700 34px Nunito, sans-serif"; g.fillText(`Collection de ${pseudo}`, W / 2, H - 150); }
  g.font = '800 44px "Bricolage Grotesque", Nunito, sans-serif'; const lw = g.measureText(lienTxt).width + 70;
  rectArrondi(g, (W - lw) / 2, H - 132, lw, 68, 34); g.fillStyle = "#2a5ae6"; g.fill(); g.lineWidth = 4; g.strokeStyle = "#151b33"; g.stroke();
  g.fillStyle = "#fff"; g.fillText(lienTxt, W / 2, H - 83);
  return new Promise((ok) => cv.toBlob(ok, "image/png"));
};
