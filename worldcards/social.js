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
