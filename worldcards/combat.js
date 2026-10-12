/* Moteur de combat de WorldCards, partagé par le jeu (navigateur) et le serveur (arène en ligne).
   Tout est déterministe à partir d'une graine : le serveur rejoue le combat pour vérifier le résultat. */
(function (racine, fabrique) {
  if (typeof module === "object" && module.exports) module.exports = fabrique();
  else racine.COMBAT = fabrique();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Puissance de base selon la rareté : l'écart reste raisonnable pour que le talent compte
  const PUISSANCE = { "commun": 500, "peu-commun": 530, "rare": 565, "epique": 600, "ultra-rare": 640, "legendaire": 680, "secrete": 700, "perso": 500 };
  // Profil selon le type : [attaque, défense, points de vie]
  const PROFILS = {
    pays: [1, 1, 1],
    ville: [1.08, 0.93, 0.99],
    monument: [0.97, 1.08, 1.02],
    merveille: [1.04, 1.04, 1.04],
    secrete: [1.06, 1.06, 1.06],
    nature: [0.95, 1.06, 1.06],
    animal: [1.08, 0.95, 1.0],
    plat: [1.0, 0.97, 1.04],
    culture: [1.02, 1.0, 1.0],
  };
  // Cycle des types : chacun l'emporte sur le suivant
  // Ville › Monument › Nature › Animal › Plat › Culture › Pays › Ville
  const CYCLE = ["ville", "monument", "nature", "animal", "plat", "culture", "pays"];
  // Attaque spéciale propre à chaque type (une fois par carte)
  const SPECIAUX = {
    pays: { nom: "Union nationale", mult: 1.75, desc: "×1,75 et soigne 15 % de la vie" },
    ville: { nom: "Heure de pointe", mult: 1.6, desc: "×1,6 de dégâts" },
    monument: { nom: "Rempart", mult: 1.55, desc: "×1,55 et divise par deux les dégâts subis jusqu'au tour suivant" },
    nature: { nom: "Tempête", mult: 1.45, desc: "×1,45 et 30 % des dégâts sur tout le banc adverse" },
    animal: { nom: "Double morsure", mult: 0.7, desc: "Deux attaques à ×0,7" },
    plat: { nom: "Festin", mult: 1.45, desc: "×1,45 et soigne 20 % de la vie" },
    culture: { nom: "Fête populaire", mult: 1.25, desc: "×1,25 et baisse l'attaque adverse de 15 %" },
    merveille: { nom: "Merveille du monde", mult: 1.9, desc: "×1,9 de dégâts" },
    secrete: { nom: "Mystère", mult: 1.8, desc: "×1,8 et ignore la moitié de la défense" },
  };
  const AVANTAGE = Object.fromEntries(CYCLE.map((t, i) => [t, CYCLE[(i + 1) % CYCLE.length]]));
  // Talents : chaque carte a un pouvoir, tiré parmi ceux de son type
  const TALENTS = {
    bouclier: { nom: "Bouclier", emoji: "🛡️", desc: "Subit 11 % de dégâts en moins." },
    rage: { nom: "Rage", emoji: "😡", desc: "+32 % de dégâts sous 50 % de vie." },
    vampire: { nom: "Vampire", emoji: "🧛", desc: "Récupère 18 % des dégâts infligés." },
    riposte: { nom: "Riposte", emoji: "↩️", desc: "Renvoie 15 % des dégâts subis." },
    precision: { nom: "Précision", emoji: "🎯", desc: "33 % de coups critiques au lieu de 15 %." },
    agilite: { nom: "Agilité", emoji: "💨", desc: "22 % d'esquive au lieu de 12 %." },
    vitesse: { nom: "Vitesse", emoji: "⚡", desc: "Frappe plus souvent en premier, +4 % de dégâts." },
    endurance: { nom: "Endurance", emoji: "🔋", desc: "La garde soigne 30 % de la vie et protège mieux." },
    colosse: { nom: "Colosse", emoji: "🗿", desc: "+12 % de points de vie." },
    perforant: { nom: "Perforant", emoji: "🗡️", desc: "Ignore 22 % de la défense adverse." },
  };
  const TALENTS_TYPE = {
    pays: ["bouclier", "endurance", "colosse", "riposte"],
    ville: ["vitesse", "precision", "rage", "perforant"],
    monument: ["bouclier", "riposte", "colosse", "endurance"],
    merveille: ["vampire", "precision", "bouclier", "rage"],
    secrete: ["vampire", "perforant", "agilite", "precision"],
    nature: ["colosse", "endurance", "riposte", "agilite"],
    animal: ["agilite", "rage", "vitesse", "vampire"],
    plat: ["vampire", "endurance", "precision", "agilite"],
    culture: ["precision", "riposte", "colosse", "vitesse"],
  };
  const BONUS_AVANTAGE = 1.12;
  const VARIATION = 8;     // chaque exemplaire varie de -8 % à +8 % par statistique
  const BONUS_NIVEAU = 2;   // +2 % par niveau au-delà du premier
  const NIVEAU_MAX = 5;
  const BONUS_SHINY = 5;    // une Shiny est 5 % plus forte
  const BONUS_DOREE = 15;   // une Dorée est 15 % plus forte
  const MULT_PV = 2.2;
  // Coût d'une carte dans un deck : le total est plafonné pour que les decks restent équilibrés
  const COUT = { "commun": 1, "peu-commun": 2, "rare": 3, "epique": 4, "ultra-rare": 5, "legendaire": 6, "secrete": 6, "perso": 1 };
  const BUDGET = 12;
  const TAILLE_DECK = 3;
  const TOURS_MAX = 80;

  function hash(texte) {
    let h = 2166136261;
    for (let i = 0; i < texte.length; i++) { h ^= texte.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  // Générateur pseudo-aléatoire (mulberry32)
  function rng(graine) {
    let a = graine >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const arrondi = (x) => Math.round(x / 5) * 5;
  const talentDe = (id, type) => { const l = TALENTS_TYPE[type] || TALENTS_TYPE.pays; return l[(hash(id) >>> 8) % l.length]; };

  // Statistiques de référence d'une carte : légère touche propre à chaque carte (une carte attaque un peu plus, une autre défend mieux)
  function base(id, type, rarete) {
    const p = PUISSANCE[rarete] || 500, pr = PROFILS[type] || PROFILS.pays;
    const penche = ((hash(id) % 17) - 8) / 100;
    return { atk: p * pr[0] * (1 + penche), def: p * pr[1] * (1 - penche), pv: p * MULT_PV * pr[2] };
  }
  // Niveau selon le nombre d'exemplaires : 1, 2, 4, 8, 16
  function niveau(exemplaires) {
    let n = 1;
    while (n < NIVEAU_MAX && exemplaires >= 2 ** n) n++;
    return n;
  }
  // Qualité d'un exemplaire : trois pourcentages entre -10 et +10
  function tirerQualite(aleat) {
    const r = aleat || Math.random;
    return [0, 1, 2].map(() => Math.round((r() * 2 - 1) * VARIATION));
  }
  const borne = (q) => [0, 1, 2].map((i) => Math.max(-VARIATION, Math.min(VARIATION, Math.round(Number(q?.[i]) || 0))));
  const noteQualite = (q) => Math.round(((borne(q).reduce((s, x) => s + x, 0) / 3) + VARIATION) / (2 * VARIATION) * 100);

  // Statistiques finales d'un exemplaire (prend en compte Shiny et Dorée)
  function stats(id, type, rarete, qualite, exemplaires, shiny, doree) {
    const b = base(id, type, rarete), q = borne(qualite);
    const mult = 1 + (BONUS_NIVEAU * (niveau(exemplaires || 1) - 1) + (shiny ? BONUS_SHINY : 0) + (doree ? BONUS_DOREE : 0)) / 100;
    return {
      atk: arrondi(b.atk * (1 + q[0] / 100) * mult),
      def: arrondi(b.def * (1 + q[1] / 100) * mult),
      pv: arrondi(b.pv * (1 + q[2] / 100) * mult),
      niveau: niveau(exemplaires || 1),
      talent: talentDe(id, type),
      doree: !!doree,
    };
  }
  const puissance = (s) => Math.round(s.atk + s.def + s.pv / MULT_PV);

  /* ---------- Combat ---------- */
  const METEOS = {
    soleil: { nom: "☀️ Soleil radieux", bonus: "nature,plat", desc: "+15 % de dégâts pour Nature et Gastronomie" },
    megalopole: { nom: "🏙️ Mégalopole animée", bonus: "ville,monument", desc: "+15 % de défense pour Villes et Monuments" },
    tempete: { nom: "🌪️ Tempête mondiale", bonus: "tous", desc: "+10 % de coups critiques et d'esquive pour tous" },
    nuit: { nom: "✨ Nuit étoilée", bonus: "merveille,secrete", desc: "+20 % de puissance pour Merveilles et Secrètes" },
  };

  function creer(equipeA, equipeB, graine, options = {}) {
    const prep = (eq) => eq.map((u) => {
      const talent = TALENTS[u.talent] || u.talent === "aucun" ? u.talent : talentDe(u.id, u.type);
      const pv = talent === "colosse" ? Math.round(u.pv * 1.12) : u.pv;
      return { ...u, talent, pvMax: pv, pv, special: true, garde: false, energie: 0, doree: !!u.doree };
    });
    const meteosKeys = Object.keys(METEOS);
    const meteoKey = meteosKeys[(graine >>> 4) % meteosKeys.length];
    return {
      equipes: [prep(equipeA), prep(equipeB)],
      actifs: [0, 0],
      tour: 0,
      graine: graine >>> 0,
      r: rng(graine),
      fini: false,
      gagnant: null,
      journal: [],
      ia: options.ia || 2,
      meteo: options.meteo || meteoKey,
    };
  }
  const actif = (etat, cote) => etat.equipes[cote][etat.actifs[cote]];
  const vivants = (etat, cote) => etat.equipes[cote].filter((u) => u.pv > 0).length;

  function choixIA(etat, cote) {
    const moi = actif(etat, cote), lui = actif(etat, 1 - cote), r = etat.r();
    const niveauIA = etat.ia || 2;
    if (moi.energie >= 100 && r < 0.7) return "supreme";
    if (niveauIA <= 1) {
      if (moi.special && r < 0.15) return "special";
      if (r > 0.88) return "garde";
      return "attaque";
    }
    if (niveauIA >= 3) {
      if (AVANTAGE[lui.type] === moi.type && moi.pv / moi.pvMax > 0.3 && etat.tour - (moi.change || -9) > 2) {
        const banc = etat.equipes[cote].map((u, i) => [u, i]).filter(([u, i]) => u.pv > 0 && i !== etat.actifs[cote] && AVANTAGE[lui.type] !== u.type);
        const mieux = banc.find(([u]) => AVANTAGE[u.type] === lui.type) || banc[0];
        if (mieux && r < 0.75) return "changer:" + mieux[1];
      }
      if (moi.special && (lui.pv / lui.pvMax > 0.5 || AVANTAGE[moi.type] === lui.type)) return "special";
      if (moi.pv / moi.pvMax < 0.35 && lui.special && r < 0.5) return "garde";
      if (moi.special && moi.pv / moi.pvMax < 0.3) return "special";
      return "attaque";
    }
    if (moi.special && (lui.pv / lui.pvMax > 0.45 || moi.pv / moi.pvMax < 0.35) && r < 0.45) return "special";
    if (moi.pv / moi.pvMax < 0.4 && r < 0.3) return "garde";
    return "attaque";
  }
  const actionValide = (a) => ["attaque", "special", "supreme", "garde"].includes(a) || /^changer:[0-9]$/.test(a);

  function degats(etat, att, def, action) {
    const sp = action === "special" ? (SPECIAUX[att.type] || SPECIAUX.ville) : null;
    const supreme = action === "supreme";
    let d = att.atk * (att.affaibli ? 0.85 : 1) * 600 / (600 + def.def * (supreme ? 0.6 : 1) * (att.talent === "perforant" ? 0.78 : 1) * (sp && att.type === "secrete" ? 0.5 : 1));
    if (AVANTAGE[att.type] === def.type) d *= BONUS_AVANTAGE;
    if (sp) d *= sp.mult;
    if (supreme) d *= 1.8;
    if (att.doree) d *= 1.15; // +15% frappe dorée
    if (att.talent === "rage" && att.pv / att.pvMax < 0.5) d *= 1.32;
    if (att.talent === "vitesse") d *= 1.04;

    // Effet météo
    const met = METEOS[etat.meteo];
    if (met && met.bonus.includes(att.type)) d *= 1.15;
    if (met && met.bonus.includes(def.type) && def.garde) d *= 0.85;

    d *= 0.6 + etat.r() * 0.8;
    const esquive = !supreme && etat.r() < (def.talent === "agilite" ? 0.22 : 0.12);
    const chanceCritique = (att.talent === "precision" ? 0.33 : 0.15) + (att.doree ? 0.1 : 0);
    const critique = !esquive && etat.r() < chanceCritique;
    if (critique) d *= 1.8;
    if (esquive) return { d: 0, critique: false, esquive: true, supreme };
    if (def.garde && !supreme) d *= def.talent === "endurance" ? 0.22 : 0.4;
    if (def.talent === "bouclier") d *= 0.89;
    if (def.rempart >= etat.tour) d *= 0.5;
    return { d: Math.max(1, Math.round(d)), critique, esquive: false, supreme };
  }

  // Joue un tour : action du joueur (côté 0), l'adversaire (côté 1) joue selon l'IA
  // actionAdverse : choix du 2e joueur en duel en direct (sinon l'IA décide)
  function jouer(etat, actionJoueur, actionAdverse) {
    if (etat.fini) return [];
    const ev = [];
    etat.tour++;
    const actions = [actionValide(actionJoueur) ? actionJoueur : "attaque", actionAdverse === undefined ? choixIA(etat, 1) : actionValide(actionAdverse) ? actionAdverse : "attaque"];
    // Changer de carte : la nouvelle entre tout de suite, mais le tour est utilisé
    for (const c of [0, 1]) {
      if (!actions[c].startsWith("changer:")) continue;
      const i = Number(actions[c].slice(8)), u = etat.equipes[c][i];
      if (!u || u.pv <= 0 || i === etat.actifs[c]) { actions[c] = "attaque"; continue; }
      etat.actifs[c] = i; u.change = etat.tour; actions[c] = "changer";
      ev.push({ t: "changer", cote: c, id: u.id });
    }
    for (const c of [0, 1]) {
      const u = actif(etat, c);
      if (actions[c] === "special" && !u.special) actions[c] = "attaque";
      if (actions[c] === "supreme" && (u.energie || 0) < 100) actions[c] = "attaque"; // la jauge doit être pleine
      u.garde = actions[c] === "garde";
      if (u.garde) {
        const soin = Math.round(u.pvMax * (u.talent === "endurance" ? 0.3 : 0.08));
        u.pv = Math.min(u.pvMax, u.pv + soin);
        ev.push({ t: "garde", cote: c, soin });
      }
    }
    // Le plus rapide frappe en premier : l'attaque compte, avec une part de hasard
    const vitesse = (u) => u.atk * (u.talent === "vitesse" ? 1.4 : 1);
    const vA = vitesse(actif(etat, 0)) * (0.8 + etat.r() * 0.4), vB = vitesse(actif(etat, 1)) * (0.8 + etat.r() * 0.4);
    const ordre = vA >= vB ? [0, 1] : [1, 0];
    for (const c of ordre) {
      if (actions[c] === "garde" || actions[c] === "changer") continue;
      const att = actif(etat, c), cible = actif(etat, 1 - c);
      if (att.pv <= 0 || cible.pv <= 0) continue;
      const special = actions[c] === "special";
      const supreme = actions[c] === "supreme";
      if (special) att.special = false;
      if (supreme) att.energie = 0;
      else att.energie = Math.min(100, (att.energie || 0) + 20);
      cible.energie = Math.min(100, (cible.energie || 0) + 15);

      const coups = special && att.type === "animal" ? 2 : 1;
      let d = 0, critique = false, esquive = false;
      for (let k = 0; k < coups && cible.pv > 0; k++) {
        const x = degats(etat, att, cible, actions[c]);
        cible.pv = Math.max(0, cible.pv - x.d);
        d += x.d; critique ||= x.critique; esquive = x.esquive && (k === 0 || esquive);
        ev.push({
          t: actions[c],
          cote: c,
          degats: x.d,
          critique: x.critique,
          esquive: x.esquive,
          avantage: AVANTAGE[att.type] === cible.type,
          nomSpecial: special ? (SPECIAUX[att.type] || SPECIAUX.ville).nom : null,
          supreme,
          doree: !!att.doree,
        });
      }
      if (special) {
        // Effets des attaques spéciales selon le type
        if (att.type === "pays" || att.type === "plat") { const soin = Math.round(att.pvMax * (att.type === "pays" ? 0.15 : 0.2)); att.pv = Math.min(att.pvMax, att.pv + soin); ev.push({ t: "effet", cote: c, effet: "soin", valeur: soin }); }
        if (att.type === "monument") { att.rempart = etat.tour + 1; ev.push({ t: "effet", cote: c, effet: "rempart" }); }
        if (att.type === "culture" && !cible.affaibli && cible.pv > 0) { cible.affaibli = true; ev.push({ t: "effet", cote: c, effet: "affaibli" }); }
        if (att.type === "nature" && d > 0) {
          const eclat = Math.round(d * 0.3);
          for (const u of etat.equipes[1 - c]) if (u !== cible && u.pv > 0) u.pv = Math.max(1, u.pv - eclat);
          ev.push({ t: "effet", cote: c, effet: "tempete", valeur: eclat });
        }
      }
      if (d > 0 && att.talent === "vampire") { const soin = Math.round(d * 0.18); att.pv = Math.min(att.pvMax, att.pv + soin); ev.push({ t: "talent", cote: c, talent: "vampire", valeur: soin }); }
      if (d > 0 && cible.talent === "riposte" && cible.pv > 0) { const r = Math.round(d * 0.15); att.pv = Math.max(0, att.pv - r); ev.push({ t: "talent", cote: 1 - c, talent: "riposte", valeur: r }); if (att.pv <= 0) ev.push({ t: "ko", cote: c, id: att.id }); }
      if (cible.pv <= 0) ev.push({ t: "ko", cote: 1 - c, id: cible.id });
    }
    for (const c of [0, 1]) actif(etat, c).garde = false;
    // Les cartes K.O. laissent la place à la suivante
    for (const c of [0, 1]) {
      if (actif(etat, c).pv <= 0) {
        const suivant = etat.equipes[c].findIndex((u) => u.pv > 0);
        if (suivant >= 0) { etat.actifs[c] = suivant; ev.push({ t: "entree", cote: c, id: actif(etat, c).id }); }
      }
    }
    const fin = [vivants(etat, 0), vivants(etat, 1)];
    if (!fin[0] || !fin[1] || etat.tour >= TOURS_MAX) {
      etat.fini = true;
      if (!fin[0] && !fin[1]) etat.gagnant = 1;
      else if (!fin[0]) etat.gagnant = 1;
      else if (!fin[1]) etat.gagnant = 0;
      else {
        const reste = (c) => etat.equipes[c].reduce((s, u) => s + u.pv / u.pvMax, 0);
        etat.gagnant = reste(0) > reste(1) ? 0 : 1;
      }
      ev.push({ t: "fin", gagnant: etat.gagnant });
    }
    etat.journal.push(actionJoueur && actionValide(actionJoueur) ? actionJoueur : "attaque");
    return ev;
  }

  // Rejoue un combat entier (serveur) : même graine + mêmes actions = même résultat
  function rejouer(equipeA, equipeB, graine, actions, options) {
    const etat = creer(equipeA, equipeB, graine, options);
    for (const a of actions.slice(0, TOURS_MAX)) { if (etat.fini) break; jouer(etat, a); }
    while (!etat.fini) jouer(etat, "attaque");
    return etat;
  }

  // Duel en direct : rejoue les tours déjà joués (paires [action A, action B]) sans terminer le combat
  function rejouerDuel(equipeA, equipeB, graine, paires) {
    const etat = creer(equipeA, equipeB, graine);
    for (const [a, b] of paires.slice(0, TOURS_MAX)) { if (etat.fini) break; jouer(etat, a, b); }
    return etat;
  }
  // Match automatique (tournoi) : l'IA choisit pour les deux camps avec son propre hasard,
  // pour que le combat se rejoue à l'identique avec rejouerDuel(paires)
  function simulerMatch(equipeA, equipeB, graine) {
    const etat = creer(equipeA, equipeB, graine, { ia: 3 }), rIA = rng(graine ^ 0x5bd1e995), paires = [];
    while (!etat.fini && paires.length < TOURS_MAX) {
      const r = etat.r; etat.r = rIA;
      const a0 = choixIA(etat, 0), a1 = choixIA(etat, 1);
      etat.r = r;
      paires.push([a0, a1]); jouer(etat, a0, a1);
    }
    return { gagnant: etat.gagnant, paires };
  }
  return { rejouerDuel, simulerMatch, SPECIAUX, TALENTS, TALENTS_TYPE, CYCLE, talentDe, COUT, BUDGET, TAILLE_DECK, PUISSANCE, PROFILS, AVANTAGE, VARIATION, NIVEAU_MAX, BONUS_SHINY, BONUS_DOREE, TOURS_MAX, METEOS,
    hash, rng, base, niveau, tirerQualite, borne, noteQualite, stats, puissance, creer, jouer, rejouer, actif, vivants };
});
