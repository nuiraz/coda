/* =========================================================
   Plus aucun emoji dans l'interface : chaque emoji affiché est remplacé
   par une icône au trait (même famille que le menu Plus). Les illustrations
   des cartes et des boosters, les drapeaux et les messages des joueurs
   gardent leurs emoji.
   ========================================================= */
const TRAITS = {
  alerte: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.2h.01"/>',
  piece: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><path d="M12 9.5v5"/>',
  trophee: ICONES.samedi,
  medaille: '<circle cx="12" cy="14.5" r="6"/><path d="M8.5 9.5 6 3h4l2 4.5M15.5 9.5 18 3h-4l-2 4.5"/><path d="M12 12v5"/>',
  etincelle: '<path d="M11 3l1.9 5.6L18.5 10.5l-5.6 1.9L11 18l-1.9-5.6L3.5 10.5l5.6-1.9z"/><path d="M19 15.5l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6z"/>',
  epees: ICONES.combat,
  coche: '<circle cx="12" cy="12" r="9"/><path d="m8 12.2 2.8 2.8L16 9.5"/>',
  vu: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  diamant: ICONES.premium,
  cadeau: '<rect x="3" y="8" width="18" height="4.5" rx="1"/><path d="M5 12.5V21h14v-8.5M12 8v13M12 8c-2.5 0-5-1-5-3a2 2 0 0 1 4-.5L12 8l1-3.5a2 2 0 0 1 4 .5c0 2-2.5 3-5 3z"/>',
  couronne: ICONES.admin,
  poignee: '<path d="M2 11.5 6 7.5l3 1 3-2.5 3.5 1L19 5l3 4"/><path d="M6 7.5 4 15l5.5 4.5a1.4 1.4 0 0 0 2-2l1 .8a1.4 1.4 0 0 0 2-2l.7.5a1.4 1.4 0 0 0 2-2L20 12.5"/><path d="M9 8.5 13 12"/>',
  eclair: '<path d="M13 2.5 4.5 14H11l-1 7.5L19.5 10H13z"/>',
  cartes: ICONES.decks,
  bouclier: ICONES.guilde,
  etoile: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/>',
  coeur: ICONES.soutenir,
  globe: ICONES.langue,
  carte: ICONES.atlas,
  photo: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  drapeau: ICONES.collections,
  bulle: '<path d="M20.5 12a8.5 8.5 0 0 1-12.3 7.6L3.5 21l1.4-4.6A8.5 8.5 0 1 1 20.5 12z"/>',
  ajout: '<path d="M12 5v14M5 12h14"/>',
  sac: '<path d="M5 8h14l-1 13H6z"/><path d="M9 10V6.5a3 3 0 0 1 6 0V10"/>',
  flamme: '<path d="M12 2.5c1.2 3.6 5.5 5.6 5.5 10.5a5.5 5.5 0 0 1-11 0c0-2.2 1-3.6 2-4.8.3 2 1.4 2.8 2 2.8C10 7 11.5 4.8 12 2.5z"/>',
  ampoule: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
  fete: '<path d="M4 20.5 8.5 8l7.5 7.5z"/><path d="M13.5 4.5c.6 1.6.1 2.8-1 3.5M19.5 10.5c-1.6-.6-2.8-.1-3.5 1M17 3h.01M21 7h.01M20 14h.01M10.5 3h.01"/>',
  partager: '<path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M5 12.5V20h14v-7.5"/>',
  ticket: ICONES.passe,
  courbe: '<path d="M3 20.5h18"/><path d="m4 16 5-5 4 3 7-8"/><path d="M15 6h5v5"/>',
  baisse: '<path d="M3 20.5h18"/><path d="m4 6 5 5 4-3 7 8"/><path d="M15 16h5v-5"/>',
  stats: ICONES.stats,
  livre: ICONES.album,
  doc: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
  enveloppe: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
  calendrier: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  loupe: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  marteau: ICONES.encheres,
  cadenas: '<rect x="4.5" y="11" width="15" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
  ouvert: '<rect x="4.5" y="11" width="15" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 7.6-1.7"/>',
  stade: '<ellipse cx="12" cy="9" rx="9" ry="4"/><path d="M3 9v6c0 2.2 4 4 9 4s9-1.8 9-4V9M7.5 12.4V17M16.5 12.4V17"/>',
  cible: ICONES.missions,
  chrono: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 10v3.5l2.5 2M9.5 2.5h5M12 2.5V6"/>',
  sablier: '<path d="M6 2.5h12M6 21.5h12M7.5 2.5v3.5l4.5 6 4.5-6V2.5M7.5 21.5V18l4.5-6 4.5 6v3.5"/>',
  tourner: '<path d="M20.5 12a8.5 8.5 0 0 1-15 5.5M3.5 12a8.5 8.5 0 0 1 15-5.5"/><path d="M19 3v4h-4M5 21v-4h4"/>',
  retour: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  question: ICONES.quiz,
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  monument: '<path d="M3 21h18M5 18h14M6.5 18v-7.5M10 18v-7.5M14 18v-7.5M17.5 18v-7.5M3.5 10.5h17L12 4z"/>',
  montagne: '<path d="m2.5 20 7-12 4 6.5 2.5-4 5.5 9.5z"/><path d="m7.2 12 2.3 1.5 1.8-1.4"/>',
  arc: '<path d="M2.5 18a9.5 9.5 0 0 1 19 0M6.5 18a5.5 5.5 0 0 1 11 0M10.5 18a1.5 1.5 0 0 1 3 0"/>',
  boussole: ICONES.codex,
  presse: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 2.5h6v3H9zM9 11h6M9 15h4"/>',
  ville: '<path d="M3 21h18M5 21V9l5-3v15M10 21V3h9v18M13 7h3M13 11h3M13 15h3M7 12h.01M7 16h.01"/>',
  maison: ICONES.accueil,
  personne: ICONES.compte,
  groupe: ICONES.hub,
  cloche: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/>',
  silence: '<path d="M6 16v-5a6 6 0 0 1 9.4-4.9M18 11v5l1.5 2H9"/><path d="M10 21h4M3 3l18 18"/>',
  epingle: ICONES.expedition,
  reglage: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M2.5 12h3M18.5 12h3M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  masque: '<path d="M4 4h16v6.5a8 8 0 0 1-16 0z"/><path d="M8.5 9.5h.01M15.5 9.5h.01M9 13.5c1.7 1.3 4.3 1.3 6 0"/>',
  lecture: '<path d="M7 4.5v15l12-7.5z"/>',
  avance: '<path d="m4.5 5 7 7-7 7M12.5 5l7 7-7 7"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
  crane: '<path d="M12 3a7.5 7.5 0 0 0-4.5 13.5V20h9v-3.5A7.5 7.5 0 0 0 12 3z"/><circle cx="9.3" cy="11" r="1.4"/><circle cx="14.7" cy="11" r="1.4"/><path d="M10.5 20v-2.5M13.5 20v-2.5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9.5" r="1.6"/><path d="m21 15.5-5-5L6.5 20"/>',
  patte: '<circle cx="6.5" cy="9" r="1.8"/><circle cx="10" cy="5" r="1.8"/><circle cx="14" cy="5" r="1.8"/><circle cx="17.5" cy="9" r="1.8"/><path d="M12 11c-2.8 0-5.5 4-5.5 6.5a2.5 2.5 0 0 0 3.5 2.3c1.3-.6 2.7-.6 4 0a2.5 2.5 0 0 0 3.5-2.3C17.5 15 14.8 11 12 11z"/>',
  micro: '<rect x="9" y="2.5" width="6" height="11.5" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v4"/>',
  porte_voix: '<path d="M3 10v4h3.5l8.5 5V5L6.5 10z"/><path d="M18 9a4 4 0 0 1 0 6M6.5 14l1.5 6h2.5l-1-5.5"/>',
  disquette: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
  paiement: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6 15h4"/>',
  plat: '<path d="M3 11.5h18a9 9 0 0 1-18 0z"/><path d="M8 8c0-1.5 1-1.5 1-3.5M12 8c0-1.5 1-1.5 1-3.5M16 8c0-1.5 1-1.5 1-3.5"/>',
  cerveau: '<path d="M12 5a3.5 3.5 0 0 0-6.6 1.6A3.5 3.5 0 0 0 4 13a3.5 3.5 0 0 0 3 5.6A3 3 0 0 0 12 20zM12 5a3.5 3.5 0 0 1 6.6 1.6A3.5 3.5 0 0 1 20 13a3.5 3.5 0 0 1-3 5.6A3 3 0 0 1 12 20z"/><path d="M12 5v15M8.5 10.5a2.5 2.5 0 0 1 3.5 0M15.5 13.5a2.5 2.5 0 0 1-3.5 0"/>',
  croix: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
  interdit: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
  muet: '<path d="M3 10v4h4l5 4V6l-5 4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>',
  son: '<path d="M3 10v4h4l5 4V6l-5 4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
  crayon: '<path d="M16 3.5 20.5 8 8 20.5H3.5V16z"/><path d="m13 6.5 4.5 4.5"/>',
  nuage: '<path d="M7 19a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 10z"/>',
  mobile: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M11 18h2"/>',
  main: '<path d="M7 11.5V6a1.5 1.5 0 0 1 3 0v4.5M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V11M16 9.5a1.5 1.5 0 0 1 3 0v4.5a7 7 0 0 1-7 7h-.5a6 6 0 0 1-5-2.7L3.3 15a1.5 1.5 0 0 1 2.4-1.8L7 15"/>',
  corbeille: '<path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 14h11l1-14M9 7V4h6v3"/>',
  dossier: '<path d="M3 6.5a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
  boite: ICONES.boosters,
  de: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><circle cx="8.5" cy="8.5" r="1.1" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.1" fill="currentColor"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.1" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.1" fill="currentColor"/>',
  etiquette: '<path d="M3 3h8.5l9.5 9.5-8.5 8.5L3 11.5z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  palette: ICONES.style,
  diplome: '<path d="M2 9.5 12 4.5l10 5-10 5z"/><path d="M6 11.5V16c3 2.5 9 2.5 12 0v-4.5M22 9.5v5.5"/>',
  trefle: '<circle cx="9" cy="9" r="3"/><circle cx="15" cy="9" r="3"/><circle cx="9" cy="15" r="3"/><circle cx="15" cy="15" r="3"/><path d="m16 16 4.5 5"/>',
  lien: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  camera: ICONES.streamer,
  ecran: '<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  soleil: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
  lune: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  fiole: '<path d="M9 3h6M10 3v6L4.6 19a1.5 1.5 0 0 0 1.3 2h12.2a1.5 1.5 0 0 0 1.3-2L14 9V3M7 15h10"/>',
  vague: '<path d="M2 8c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 13c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 18c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/>',
  vent: '<path d="M3 8h10a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7"/>',
  flocon: '<path d="M12 2v20M3.3 7l17.4 10M20.7 7 3.3 17"/><path d="m9.5 4 2.5 2 2.5-2M9.5 20l2.5-2 2.5 2"/>',
  feuille: '<path d="M5 20c0-9 5-15 15-16 0 10-6 16-14 16z"/><path d="M5 20 13 12"/>',
  fleche_bas: '<path d="M12 4v16M6 14l6 6 6-6"/>',
  fleche_haut: '<path d="M12 20V4M6 10l6-6 6 6"/>',
  fleche_droite: '<path d="M4 12h16M14 6l6 6-6 6"/>',
  oeil: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  fusee: '<path d="M14 4c3-1.5 6-1 6-1s.5 3-1 6l-6 6-5-5z"/><path d="m8 10-3 .5L3 13l4 1M14 16l-.5 3L11 21l-1-4M15 9h.01"/>',
  robot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4M9 13h.01M15 13h.01M9.5 16.5h5"/>',
  prise: '<path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5"/>',
  cle: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M17 6l3 3M14.5 8.5l2 2"/>',
  puzzle: '<path d="M4 8h4a2 2 0 1 1 4 0h4v4a2 2 0 1 1 0 4v4H4v-4a2 2 0 1 0 0-4z"/>',
  menu: ICONES.plus,
  sac_dos: '<path d="M6 9a6 6 0 0 1 12 0v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z"/><path d="M9 4.5V3h6v1.5M9 14h6v4H9z"/>',
  batterie: '<rect x="2.5" y="7" width="17" height="10" rx="2"/><path d="M22 11v2M6 10v4M9.5 10v4"/>',
  journal: '<path d="M4 5h13v15H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v9a2 2 0 0 1-2 2M8 9h5M8 13h5M8 16h3"/>',
  ruban: '<circle cx="12" cy="8" r="5"/><path d="m9 12.5-2 8.5 5-2.5 5 2.5-2-8.5"/>',
  point: '<circle cx="12" cy="12" r="3.2"/>',
};

// emoji (sans variation) → [icône, couleur facultative]
const EMOJI_TRAIT = {};
const lier = (ic, liste, coul) => { for (const e of liste.split(" ")) EMOJI_TRAIT[e.replace(/️/g, "")] = [ic, coul]; };
lier("alerte", "⚠ 🚨 🆘", "alerte");
lier("piece", "🪙 💰 🏦", "or");
lier("trophee", "🏆");
lier("medaille", "🥇", "or"); lier("medaille", "🥈", "argent"); lier("medaille", "🥉", "bronze"); lier("medaille", "🏅 🎖️");
lier("etincelle", "✨ 🌟 💠 🆕 💥 🌌 🎆 🎇 🔮 🧛 🎃 🎄 🎅 ✦ 🪄");
lier("epees", "⚔️ 🗡️ 🥊 🤼 🏹");
lier("coche", "✅ ☑️ ✔️", "ok"); lier("vu", "✓ ✔");
lier("diamant", "💎");
lier("cadeau", "🎁 🧧");
lier("couronne", "👑");
lier("poignee", "🤝");
lier("eclair", "⚡");
lier("cartes", "🃏 🂠 🎴");
lier("bouclier", "🛡️");
lier("etoile", "⭐ ★ ☆ 🌠", "or");
lier("coeur", "❤️ 💙 🤍 💚 ♡ 🩷 💖 💜 🧡 💛 ♥️ 💌", "rose");
lier("globe", "🌍 🌎 🌏 🌐");
lier("carte", "🗺️");
lier("photo", "📷 📸");
lier("drapeau", "🏳️ 🚩 🏁 🏴");
lier("bulle", "💬 🗨️ 💭");
lier("ajout", "➕");
lier("sac", "🛍️ 🛒 🏪");
lier("flamme", "🔥", "feu");
lier("ampoule", "💡");
lier("fete", "🎉 🎊 🎈 🥳");
lier("partager", "📤 📲");
lier("ticket", "🎟️ 🎫");
lier("courbe", "📈 🚀"); lier("baisse", "📉"); lier("stats", "📊");
lier("livre", "📚 📖 📒 📔 📕 📗 📘 📙");
lier("doc", "📜 📄 📃 🧾 📑");
lier("journal", "📰 🗞️");
lier("crayon", "✍️ ✏️ 🖋️ 📝 🖊️ 🖌️");
lier("enveloppe", "✉️ 📨 📩 📭 📬 📮 📧");
lier("calendrier", "📅 🗓️ 📆");
lier("loupe", "🔎 🔍");
lier("marteau", "🔨 ⚒️ 🛠️ 🔧 ⛏️");
lier("cadenas", "🔒 🔐"); lier("ouvert", "🔓"); lier("cle", "🔑 🗝️");
lier("stade", "🏟️");
lier("cible", "🎯");
lier("chrono", "⏱️ ⏰ ⏲️ 🕰️ ⌚"); lier("sablier", "⏳ ⌛");
lier("tourner", "🔄 ♻️ 🔁 🔃"); lier("retour", "↩️ ↪️ ↩ ↪");
lier("question", "❓ ❔"); lier("info", "ℹ️");
lier("monument", "🏛️ 🏰 🏯 🏺 🗿 🗽 🕌 ⛪ 🛕 🗼 🕍 ⛩️");
lier("montagne", "🏔️ ⛰️ 🌋 🗻 🏝️ 🏞️ 🏜️ 🏖️");
lier("arc", "🌈");
lier("boussole", "🧭");
lier("presse", "📋");
lier("ville", "🏙️ 🏘️ 🏢 🏗️ 🌆 🌃 🏬");
lier("maison", "🏠 🏡");
lier("personne", "👤 🧑 🙋");
lier("groupe", "👥 👫 👬 👭 🫂");
lier("cloche", "🔔"); lier("silence", "🔕");
lier("epingle", "📌 📍");
lier("reglage", "⚙️");
lier("masque", "🎭");
lier("lecture", "▶ ▶️ 🎬"); lier("avance", "⏩ ⏭ ⏭️"); lier("pause", "⏸ ⏸️"); lier("stop", "⏹ ⏹️");
lier("crane", "💀 ☠️");
lier("image", "🖼️");
lier("patte", "🐾 🦁 🦅 🐺 🐻 🦊 🐫 🦙 🐉 🐛 🐲 🐯 🐘 🦒");
lier("micro", "🎙️ 🎤"); lier("porte_voix", "📣 📢");
lier("disquette", "💾");
lier("paiement", "💳 🅿️ 💶 💵");
lier("plat", "🍜 🍽️ 🍲 🍕 🥘");
lier("cerveau", "🧠");
lier("croix", "❌ ✖️ ❎", "ko"); lier("interdit", "🚫 ⛔", "ko");
lier("muet", "🔇"); lier("son", "🔊 🔉 🔈 🎵 🎶");
lier("nuage", "☁️ 🌧️ ⛅");
lier("mobile", "📱");
lier("main", "👋 🙏 💪 ✋ 👏 🙌 👍");
lier("corbeille", "🗑 🗑️");
lier("dossier", "🗂️ 🗃️ 🗄️ 📁 📂");
lier("boite", "📦");
lier("de", "🎲");
lier("etiquette", "🏷️");
lier("palette", "🎨");
lier("diplome", "🎓");
lier("trefle", "🍀 ☘️");
lier("lien", "🔗");
lier("camera", "🎥 📹"); lier("ecran", "📺 💻 🖥️");
lier("soleil", "☀️ 🌞"); lier("lune", "🌙");
lier("fiole", "🧪");
lier("vague", "🌊"); lier("vent", "💨 🌪️ 🌬️");
lier("flocon", "❄️ 🧊");
lier("feuille", "🌱 🌿 🌸 🍁 🌳 🌲 🌴 🌺");
lier("fleche_bas", "⬇ ⬇️ 🔻"); lier("fleche_haut", "⬆ ⬆️"); lier("fleche_droite", "➡️ ➡");
lier("oeil", "👁 👁️ 👀");
lier("robot", "🤖");
lier("prise", "🔌");
lier("puzzle", "🧩");
lier("menu", "☰");
lier("sac_dos", "🎒");
lier("batterie", "🔋");
lier("ruban", "🎗️");
// Pastilles de couleur : on garde l'information de couleur sans emoji
const PASTILLES = { "🟢": "#2f9e6a", "🟩": "#2f9e6a", "🟨": "#e0b100", "🟥": "#d9534f", "🔵": "#3b82f6", "🟦": "#3b82f6", "⚪": "#d6d0c4", "⬜": "#d6d0c4", "🔴": "#d9534f", "🟡": "#e0b100", "🟠": "#f08c2e", "🟣": "#8b5cf6", "🟫": "#8b5a2b", "⬛": "#333", "⚫": "#333", "▫": "#d6d0c4" };

const traitSVG = (ic, coul) => `<svg class="ico-e${coul ? " ico-" + coul : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TRAITS[ic] || TRAITS.point}</svg>`;
// Une séquence emoji complète (variations, teint, ZWJ), suivie d'une espace éventuelle
const RE_EMOJI = /(?:\p{Extended_Pictographic}|[\u{1F7E0}-\u{1F7EB}])[︎️]?(?:\p{Emoji_Modifier})?(?:‍\p{Extended_Pictographic}[︎️]?)*⃣?/gu;
const RE_TEST = /[\p{Extended_Pictographic}\u{1F7E0}-\u{1F7EB}]/u;
const PAS_EMOJI = new Set(["©", "®", "™", "‼", "⁉", "↔", "↕", "▪", "◀", "↗", "↘", "↙", "↖", "⤴", "⤵", "〰", "〽", "㊗", "㊙"]);
// Zones qui gardent leurs emoji : illustrations de cartes et de boosters, messages des joueurs
const GARDER = ".card, .pack, .art, .garder-emoji, .bulle-texte, .card3d, .cb-carte, .hs-carte, textarea, input, select, script, style, title, svg, code, pre, [contenteditable]";

function cleEmoji(e) { return e.replace(/[︎️⃣]|\p{Emoji_Modifier}/gu, "").split("‍")[0]; }
function remplacerTexte(noeud) {
  const t = noeud.nodeValue;
  if (!RE_TEST.test(t)) return;
  const parent = noeud.parentNode;
  if (!parent || parent.nodeType !== 1) return;
  // Dans une liste déroulante ou une infobulle, impossible d'insérer une icône : on retire juste l'emoji
  if (parent.closest("option, optgroup, title")) { noeud.nodeValue = t.replace(RE_EMOJI, (m) => PAS_EMOJI.has(m.replace(/️/g, "")) ? m : "").replace(/^\s+/, ""); return; }
  const seul = t.replace(RE_EMOJI, "").trim() === "";
  let html = "", dernier = 0, change = false;
  for (const m of t.matchAll(RE_EMOJI)) {
    const brut = m[0], cle = cleEmoji(brut);
    if (PAS_EMOJI.has(cle)) continue;
    change = true;
    html += esc(t.slice(dernier, m.index));
    dernier = m.index + brut.length;
    if (PASTILLES[cle]) html += `<i class="pastille-e" style="background:${PASTILLES[cle]}"></i>`;
    else if (EMOJI_TRAIT[cle]) html += traitSVG(...EMOJI_TRAIT[cle]);
    else if (seul) html += traitSVG("point");
    else if (t[dernier] === " ") dernier++; // emoji décoratif inconnu : retiré avec son espace
  }
  if (!change) return;
  html += esc(t.slice(dernier));
  const tmp = document.createElement("template");
  tmp.innerHTML = html;
  parent.replaceChild(tmp.content, noeud);
}
function nettoyerEmoji(racine) {
  if (!racine) return;
  if (racine.nodeType === 3) { if (!racine.parentElement?.closest(GARDER)) remplacerTexte(racine); return; }
  if (racine.nodeType !== 1 && racine.nodeType !== 11) return;
  if (racine.nodeType === 1 && racine.closest(GARDER)) return;
  if (!RE_TEST.test(racine.textContent)) return;
  const textes = [];
  const w = document.createTreeWalker(racine, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => n.nodeType === 1 ? (n.matches(GARDER) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP) : (RE_TEST.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
  });
  while (w.nextNode()) textes.push(w.currentNode);
  textes.forEach(remplacerTexte);
}
const observateurEmoji = new MutationObserver((liste) => {
  for (const m of liste) {
    if (m.type === "characterData") nettoyerEmoji(m.target);
    else for (const n of m.addedNodes) nettoyerEmoji(n);
  }
});
function demarrerSansEmoji() {
  nettoyerEmoji(document.body);
  observateurEmoji.observe(document.body, { childList: true, subtree: true, characterData: true });
}
if (document.body) demarrerSansEmoji(); else addEventListener("DOMContentLoaded", demarrerSansEmoji);
