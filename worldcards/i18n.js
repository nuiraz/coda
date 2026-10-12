"use strict";
/* Version anglaise (bêta) : l'interface est traduite à l'affichage, sans toucher au code du jeu.
   - Langue : choix du joueur, sinon langue du navigateur (français si « fr », anglais sinon).
   - Dictionnaire de textes exacts + règles pour les phrases avec des nombres.
   - Les noms de pays sont traduits automatiquement par le navigateur (codes ISO).
   Les noms des autres cartes et les anecdotes restent en français pour l'instant. */
const LANGUE = (() => { try { return localStorage.getItem("worldcards:langue") || ((navigator.language || "fr").toLowerCase().startsWith("fr") ? "fr" : "en"); } catch { return "fr"; } })();
function changerLangue(l) { try { localStorage.setItem("worldcards:langue", l); } catch {} location.reload(); }

const TRAD_EN = {
  // Navigation et titres
  "Accueil": "Home", "Boutique": "Shop", "Album": "Album", "Combat": "Battle", "Pays": "Countries", "Atlas": "Atlas", "Quiz": "Quiz", "Badges": "Badges",
  "Communauté": "Community", "Premium": "Premium", "Mon compte": "My account", "Plus": "More", "Statistiques": "Statistics", "Guilde": "Guild", "Guildes": "Guilds",
  "Passe": "Pass", "Personnaliser": "Customize", "Enchères": "Auctions", "Expédition": "Expedition", "Tournoi du samedi": "Saturday tournament", "Parrainage": "Referral",
  "Soutenir": "Support", "Réglages": "Settings", "Idée ou bug": "Idea or bug", "Installer": "Install", "Administration": "Administration", "Admin": "Admin",
  "Informations légales": "Legal information", "Collection du pays": "Country collection", "Invité": "Guest", "en ligne": "online", "Langue": "Language",
  // Accueil
  "Collectionnez le monde": "Collect the world", "Bienvenue, explorateur 👋": "Welcome, explorer 👋", "Bonjour,": "Hello,", "pays": "countries", "victoires": "wins",
  "✨ Shiny": "✨ Shiny", "badges": "badges", "Booster gratuit": "Free booster", "Disponible maintenant !": "Available now!", "Ouvrir mes boosters": "Open my boosters",
  "Mode Solo": "Solo mode", "Combat & Arène": "Battle & Arena", "Contre l'ordinateur ou les joueurs": "Against the computer or players", "Quiz du jour": "Daily quiz",
  "Défis du jour": "Daily challenges", "Échanges, tournoi, classement": "Trades, tournament, leaderboard", "Installer l'app": "Install the app", "Sur votre écran d'accueil": "On your home screen",
  "Connexion du jour": "Daily login", "Passe de saison": "Season pass", "Le monde pays par pays": "The world, country by country", "Jouez en équipe": "Play as a team",
  "Vendez et achetez des cartes": "Sell and buy cards", "Soutenir le jeu": "Support the game", "Un petit don sur PayPal": "A small PayPal donation", "Ma progression en détail": "My progress in detail",
  "🆕 Dernières découvertes": "🆕 Latest discoveries", "Tout l'album →": "Whole album →", "🌍 Progression": "🌍 Progress", "📅 Défis du jour": "📅 Daily challenges",
  "🗓️ Quêtes de la semaine": "🗓️ Weekly quests", "Récupérer": "Claim", "Récupéré": "Claimed", "Villes": "Cities", "Monuments": "Monuments", "Nature": "Nature",
  "Animaux": "Animals", "Gastronomie": "Food", "Culture": "Culture", "Merveilles": "Wonders", "🏙️ Villes": "🏙️ Cities", "🏛️ Monuments": "🏛️ Monuments", "🏔️ Nature": "🏔️ Nature",
  "🐾 Animaux": "🐾 Animals", "🍜 Gastronomie": "🍜 Food", "🎭 Culture": "🎭 Culture", "🌟 Merveilles": "🌟 Wonders",
  // Continents
  "Afrique": "Africa", "Europe": "Europe", "Asie": "Asia", "Amérique du Nord": "North America", "Amérique du Sud": "South America", "Océanie": "Oceania",
  "🌍 Afrique": "🌍 Africa", "🏰 Europe": "🏰 Europe", "🏯 Asie": "🏯 Asia", "🗽 Amérique du Nord": "🗽 North America", "🦙 Amérique du Sud": "🦙 South America", "🏝️ Océanie": "🏝️ Oceania",
  // Raretés et types
  "Commune": "Common", "Peu commune": "Uncommon", "Rare": "Rare", "Épique": "Epic", "Ultra rare": "Ultra rare", "Légendaire": "Legendary", "Secrète": "Secret",
  "PEU COMMUNE": "UNCOMMON", "COMMUNE": "COMMON", "RARE": "RARE", "ÉPIQUE": "EPIC", "LÉGENDAIRE": "LEGENDARY", "Ville": "City", "Monument": "Monument", "Animal": "Animal", "Merveille": "Wonder",
  "PAYS": "COUNTRY", "VILLE": "CITY", "MONUMENT": "MONUMENT", "NATURE": "NATURE", "ANIMAL": "ANIMAL", "GASTRONOMIE": "FOOD", "CULTURE": "CULTURE", "MERVEILLE": "WONDER", "SECRÈTE": "SECRET",
  "NOUVELLE": "NEW", "Non découverte": "Not discovered", "Capitale": "Capital", "Continent": "Continent", "Coordonnées": "Coordinates",
  // Boutique et boosters
  "Classique": "Classic", "Argent": "Silver", "Or": "Gold", "Prestige": "Prestige", "Méga": "Mega", "Touchez pour ouvrir": "Tap to open", "Touchez pour ouvrir un booster": "Tap to open a booster",
  "Tout voir ⏭": "See all ⏭", "Terminer": "Finish", "Touchez pour retourner la carte": "Tap to flip the card", "Ça brille… Touchez pour retourner !": "It's shining… Tap to flip!",
  "Touchez pour la carte suivante": "Tap for the next card", "Touchez pour voir votre booster": "Tap to see your booster", "Glissez le doigt sur le haut du booster pour le déchirer, ou touchez-le": "Swipe across the top of the booster to tear it, or tap it",
  "🛒 Boutique du jour": "🛒 Daily shop", "✅ Acheté": "✅ Bought", "⭐ Vedette": "⭐ Featured", "✓ déjà dans votre collection": "✓ already in your collection", "✨ nouvelle pour vous": "✨ new for you",
  "Plus vous ouvrez de boosters, plus vos chances de raretés légendaires augmentent": "The more boosters you open, the better your legendary odds",
  "Mes boosters": "My boosters", "Acheter": "Buy", "Annuler": "Cancel", "Confirmer": "Confirm", "Fermer": "Close", "Continuer": "Continue", "Envoyer": "Send", "Enregistrer": "Save",
  "Retirer": "Remove", "Valider": "Confirm", "Gratuit": "Free", "Recycler": "Recycle", "Fabriquer": "Craft", "Super !": "Great!", "OK": "OK", "Compris": "Got it",
  // Combat
  "⚔️ Attaque": "⚔️ Attack", "🛡️ Garde": "🛡️ Guard", "⏩ Auto": "⏩ Auto", "🏳️ Abandon": "🏳️ Give up", "🏆 Victoire !": "🏆 Victory!", "💀 Défaite…": "💀 Defeat…",
  "Tour": "Turn", "Mon deck": "My deck", "Deck automatique": "Auto deck", "Meilleur deck": "Best deck", "Entraînement": "Training", "Arène en ligne": "Online arena",
  "🗺️ Mode Solo : le tour du monde": "🗺️ Solo mode: around the world", "🏟️ Arène en ligne": "🏟️ Online arena", "Classement": "Leaderboard", "Défier": "Challenge",
  "Facile": "Easy", "Normal": "Normal", "Difficile": "Hard", "Expert": "Expert",
  // Compte
  "Se connecter": "Log in", "Se déconnecter": "Log out", "Créer mon compte": "Create my account", "Créer un compte": "Create an account", "J'ai déjà un compte": "I already have an account",
  "Pseudo": "Username", "Mot de passe": "Password", "Confirmer le mot de passe": "Confirm password", "Pseudo (public)": "Username (public)", "Mot de passe (8 caractères minimum)": "Password (8 characters minimum)",
  "Sauvegarder maintenant": "Save now", "Photo de profil": "Profile picture", "📷 Choisir une photo": "📷 Choose a photo", "Changer de mot de passe": "Change password",
  // Communauté
  "💬 Discussion": "💬 Chat", "✉️ Messages": "✉️ Messages", "📰 Fil d'actualité": "📰 News feed", "🤝 Marché d'échanges": "🤝 Trade market", "🏆 Tournoi hebdo": "🏆 Weekly tournament",
  "🌟 Classement": "🌟 Leaderboard", "👫 Amis": "👫 Friends", "💬 Général": "💬 General", "🤝 Échanges": "🤝 Trades", "⚔️ Combat": "⚔️ Battle", "🆘 Entraide": "🆘 Help",
  "Écrire dans le salon…": "Write in the room…", "Conversations": "Conversations", "✉️ Message privé": "✉️ Private message", "➕ Ajouter en ami": "➕ Add friend", "📚 Collection": "📚 Collection",
  "⚡ Duel en direct": "⚡ Live duel", "🚩 Signaler sa photo": "🚩 Report photo", "🚫 Bloquer / débloquer": "🚫 Block / unblock", "➕ Ajouter en ami ": "➕ Add friend",
  // Premium et passe
  "Payer par carte": "Pay by card", "J'ai payé": "I paid", "⚙️ Gérer mon abonnement": "⚙️ Manage my subscription", "Comment ça marche ?": "How does it work?", "1 mois": "1 month", "1 an": "1 year", "À vie": "Lifetime",
  "Populaire": "Popular", "Meilleure offre": "Best deal", "Gratuit": "Free", "💎 Premium": "💎 Premium", "🎁 Tout récupérer": "🎁 Claim all",
  // Divers
  "à l'instant": "just now", "Chargement…": "Loading…", "Aucun": "None", "Oui": "Yes", "Non": "No", "Nouveau": "New", "Membre": "Member", "👑 Chef": "👑 Leader", "⭐ Officier": "⭐ Officer",
  "Mentions légales": "Legal notice", "Conditions d'utilisation": "Terms of use", "Confidentialité": "Privacy", "CGV": "Terms of sale", "💡 Idée ou bug ?": "💡 Idea or bug?",
  "Communauté & Échanges": "Community & Trades", "🏆 Tournoi": "🏆 Tournament", "💎 Premium": "💎 Premium", "❤️ Soutenir le jeu": "❤️ Support the game", "📲 Installer l'app": "📲 Install the app",
  "❤️ Faire un don sur PayPal": "❤️ Donate on PayPal", "Soutenir Play2F1": "Support Play2F1", "Merci du fond du cœur pour votre soutien ! 🙏": "Thank you so much for your support! 🙏",
  "📅 Récompense de connexion": "📅 Login reward", "🎟️ Passe de saison": "🎟️ Season pass", "📈 Ma progression": "📈 My progress", "🌍 Par continent": "🌍 By continent", "🗂️ Par type": "🗂️ By type",
  "💠 Par rareté": "💠 By rarity", "🏆 Ma carte la plus rare": "🏆 My rarest card", "🏳️ Collections de pays presque finies": "🏳️ Country collections almost complete",
  "cartes uniques": "unique cards", "exemplaires": "copies", "👑 Dorées": "👑 Golden", "pays complétés": "countries completed", "boosters ouverts": "boosters opened", "du monde": "of the world",
  "🏷️ Titres": "🏷️ Titles", "🖼️ Cadres de profil": "🖼️ Profile frames", "🂠 Dos de cartes": "🂠 Card backs", "✓ Équipé": "✓ Equipped", "Débloqué": "Unlocked",
  "🔥 En cours": "🔥 Live", "📦 Mes enchères": "📦 My auctions", "🔨 Hôtel des enchères": "🔨 Auction house", "➕ Vendre une carte": "➕ Sell a card", "Annuler l'enchère": "Cancel auction",
  "👥 Membres": "👥 Members", "🐉 Raid": "🐉 Raid", "💬 Salon de guilde": "💬 Guild room", "🏆 Classement des guildes": "🏆 Guild leaderboard", "Quitter": "Leave",
  "🛡️ Rejoignez une guilde": "🛡️ Join a guild", "➕ Créer ma guilde": "➕ Create my guild", "Rejoindre": "Join", "Pleine": "Full", "🔒 Fermée": "🔒 Closed",
  "🧭 Expédition": "🧭 Expedition", "❓ Quiz": "❓ Quiz", "⚔️ Combat": "⚔️ Battle", "🏆 Lots": "🏆 Prizes", "🎁 Lots": "🎁 Prizes", "📝 Inscriptions": "📝 Registration", "📋 Tableau": "📋 Bracket",
  "Finale": "Final", "Demi-finales": "Semi-finals", "Quarts de finale": "Quarter-finals", "Huitièmes de finale": "Round of 16", "▶ Regarder": "▶ Watch", "à venir": "upcoming",
  "✍️ M'inscrire avec mon deck": "✍️ Register with my deck", "✅ Vous êtes inscrit !": "✅ You're registered!", "Se désinscrire": "Unregister", "🤝 Invitez vos amis": "🤝 Invite your friends",
  "📋 Copier": "📋 Copy", "📤 Partager": "📤 Share", "Mes filleuls": "My referrals",
  "Mes boosters": "My boosters", "Ouvrir": "Open", "Boosters thématiques": "Themed boosters", "Boosters par continent": "Continent boosters", "Offre du jour": "Deal of the day",
  "Album de la collection": "Collection album", "Tout": "All", "Possédées": "Owned", "Rechercher…": "Search…", "Tri : numéro": "Sort: number", "Tri : puissance": "Sort: power",
  "Tri : rareté": "Sort: rarity", "Tri : nom": "Sort: name", "Tous les continents": "All continents", "Secrètes": "Secret", "Aucune carte ne correspond.": "No matching card.",
  "Bonne réponse !": "Correct!", "Question suivante": "Next question", "Quiz terminé pour aujourd'hui": "Quiz finished for today", "Série :": "Streak:", "Record :": "Record:",
  "Mes badges": "My badges", "Collections de pays": "Country collections", "Récompense": "Reward", "Complète !": "Complete!", "Voir le pays": "See the country",
  "Attaque": "Attack", "Défense": "Defense", "Points de vie": "Health", "Niveau": "Level", "Talent": "Talent", "Spécial": "Special", "Rareté": "Rarity", "Type": "Type",
  "Voir en 3D": "View in 3D", "Ajouter au deck": "Add to deck", "Retirer du deck": "Remove from deck", "Proposer un échange": "Offer a trade",
  "Le combat commence !": "The battle begins!", "Le graphique se remplit jour après jour : revenez demain !": "The chart fills up day after day: come back tomorrow!",
  "Ouvrez des boosters !": "Open some boosters!", "Aucune pour l'instant.": "None yet.", "Calcul du résultat…": "Calculating the result…", "Vos cartes": "Your cards",
};
// Nouveautés v40 → v49
Object.assign(TRAD_EN, {
  "Collection": "Collection", "Ligues": "Leagues", "Decks": "Decks", "Succès": "Achievements", "Missions": "Missions", "Albums": "Albums", "Mode streamer": "Streamer mode",
  "Forge": "Forge", "Codex": "Codex", "Défis": "Challenges", "Joueurs": "Players", "Classements": "Leaderboards", "Activité": "Activity", "Événements": "Events",
  "Notifications": "Notifications", "Discussion": "Chat", "Messages": "Messages", "Échanges": "Trades", "Amis": "Friends", "Profil": "Profile", "Mon deck": "My deck",
  "Votre prochain booster vous attend": "Your next booster is waiting", "Ouvrez un booster": "Open a booster", "Ouvrir maintenant": "Open now", "OUVRIR MAINTENANT": "OPEN NOW",
  "Voir la boutique": "See the shop", "Récupérer le booster gratuit": "Claim the free booster", "🏆 Meilleure carte": "🏆 Best card", "📤 Partager": "📤 Share", "📤 Partager…": "📤 Share…",
  "⬇️ Télécharger l'image": "⬇️ Download image", "🔗 Copier le lien": "🔗 Copy link", "🌐 Page publique de la carte": "🌐 Card's public page", "Story 9:16": "Story 9:16", "Post 4:5": "Post 4:5",
  "🎯 Missions de combat": "🎯 Battle missions", "Toutes les missions →": "All missions →", "Aujourd'hui": "Today", "Cette semaine": "This week", "✓ Reçu": "✓ Claimed",
  "✨ Carte du jour": "✨ Card of the day", "Change à minuit (UTC)": "Changes at midnight (UTC)", "✓ Déjà obtenue aujourd'hui": "✓ Already obtained today",
  "⚡ Jouer un match classé": "⚡ Play a ranked match", "⚡ Adversaire en direct": "⚡ Live opponent", "⚡ Trouver un adversaire": "⚡ Find an opponent", "🏆 Classé": "🏆 Ranked", "🤝 Amical": "🤝 Friendly",
  "🏆 Duel classé": "🏆 Ranked duel", "🤝 Duel amical": "🤝 Friendly duel", "Compte pour la ligue": "Counts for your league", "Sans effet sur le classement": "No effect on ranking",
  "Annuler": "Cancel", "Fermer": "Close", "Continuer": "Continue", "Enregistrer": "Save", "Valider": "Confirm", "Accepter": "Accept", "Refuser": "Decline", "Défier": "Challenge", "⚔️ Défier": "⚔️ Challenge",
  "🤝 Échanger": "🤝 Trade", "➕ Ami": "➕ Friend", "✉️ Message": "✉️ Message", "📚 Collection": "📚 Collection", "▶ Revoir": "▶ Replay", "Utiliser": "Use",
  "Mon rang": "My rank", "Les rangs": "Ranks", "🏆 Classement": "🏆 Leaderboard", "📈 Mon historique de rang": "📈 My rank history", "⚔️ Arène": "⚔️ Arena", "🤝 Défier un ami": "🤝 Challenge a friend",
  "📜 Journal du combat": "📜 Battle log", "K.O. infligés": "K.O. dealt", "Main": "Hand", "⚔️ Attaque": "⚔️ Attack", "🛡️ Garde": "🛡️ Guard", "⏩ Auto": "⏩ Auto", "🏳️ Abandon": "🏳️ Forfeit",
  "🏆 Victoire !": "🏆 Victory!", "💀 Défaite…": "💀 Defeat…", "Victoire": "Victory", "Défaite": "Defeat",
  "⚡ Remplir avec mes meilleures cartes": "⚡ Fill with my best cards", "🗂️ Mes decks enregistrés": "🗂️ My saved decks", "💾 Enregistrer le deck actuel": "💾 Save current deck",
  "🌐 Rendre public": "🌐 Make public", "🔎 Decks de la communauté": "🔎 Community decks", "⭐ Favoris": "⭐ Favorites", "Mes decks": "My decks", "Tous les styles": "All styles",
  "Toutes raretés": "All rarities", "Toutes les ligues": "All leagues", "Popularité": "Popularity", "Plus récents": "Newest", "Coût le plus bas": "Lowest cost",
  "Équilibré": "Balanced", "Défense": "Defense", "Vitesse": "Speed", "Avantage de types": "Type advantage", "✓ Vous avez toutes les cartes": "✓ You own every card",
  "🛍️ Packs": "🛍️ Packs", "Acheter": "Buy", "Déjà acheté": "Already bought", "Bientôt disponible": "Coming soon", "Probabilités des boosters": "Booster odds", "Limité à un achat par compte.": "Limited to one purchase per account.",
  "Purement décoratif : aucun avantage en combat": "Purely cosmetic: no battle advantage", "Offre de lancement": "Launch offer", "Cosmétique": "Cosmetic",
  "🏅 Succès": "🏅 Achievements", "📜 Derniers matchs": "📜 Recent matches", "🃏 Deck favori": "🃏 Favourite deck", "⭐ Cartes favorites": "⭐ Favourite cards", "📈 Rangs": "📈 Ranks",
  "⚙️ Mon profil public": "⚙️ My public profile", "Voir mon profil": "View my profile", "🎙️ Soutenir un créateur": "🎙️ Support a creator", "Statistiques de combat": "Battle statistics",
  "Historique des matchs": "Match history", "Activité récente": "Recent activity", "🎨 Titres et cadres": "🎨 Titles and frames", "⭐ Choisir mes cartes favorites": "⭐ Choose my favourite cards",
  "📌 Annonces et actualités": "📌 Announcements and news", "Invitations reçues": "Invitations received", "Aucune invitation": "No invitations", "Pas encore d'amis": "No friends yet",
  "Trouver des joueurs": "Find players", "Défier un ami": "Challenge a friend", "Tout est à jour": "All caught up", "🏅 Ligues (PvP)": "🏅 Leagues (PvP)", "🌟 Semaine": "🌟 This week",
  "⚔️ Guerre de guildes": "⚔️ Guild war", "🔥 Plus belles ouvertures de la semaine": "🔥 Best openings of the week", "Rejoindre une guilde": "Join a guild",
  "🤝 Échange en direct": "🤝 Live trade", "✅ Valider l'échange": "✅ Confirm trade", "Annuler l'échange": "Cancel trade", "Ouvrir l'échange": "Open trade", "Plus tard": "Later",
  "🎥 Lancer le mode streamer": "🎥 Start streamer mode", "Quitter le mode streamer": "Exit streamer mode", "🏆 Meilleures cartes": "🏆 Best cards",
  "Mon profil": "My profile", "Chargement…": "Loading…", "Récompense déjà reçue.": "Reward already claimed.",
});

// Règles pour les textes avec des nombres ou des noms (appliquées si aucun texte exact ne correspond)
const REGLES_EN = [
  [/^Booster (.+)$/, (m, x) => `${tr(x)} booster`], [/^Carte (\d+) \/ (\d+)$/, "Card $1 / $2"], [/^(\d[\d\s]*) cartes?$/, "$1 cards"], [/^Acheter · (.+)$/, "Buy · $1"],
  [/^Dans (.+)$/, "In $1"], [/^il y a (\d+) min$/, "$1 min ago"], [/^il y a (\d+) h$/, "$1 h ago"], [/^(\d+) en attente$/, "$1 waiting"], [/^Niveau (\d+)$/, "Level $1"],
  [/^Niv\.$/, "Lvl"], [/^Prochain booster gratuit dans (.+)$/, "Next free booster in $1"], [/^(\d+) nouvelles? cartes?(.*)$/, (m, n, r) => `${n} new card${n > 1 ? "s" : ""}${r.replace("de doublons", "from duplicates").replace("Chance", "Luck")}`],
  [/^(\d+) questions? restantes?$/, "$1 questions left"], [/^(\d+)\/3 réussis$/, "$1/3 done"], [/^Série : (\d+) jours?(.*)$/, "Streak: $1 day(s)$2"], [/^Jour (\d+) à récupérer !$/, "Day $1 ready to claim!"],
  [/^Jour (\d+)$/, "Day $1"], [/^Palier (\d+)\/30 · (.+)$/, "Tier $1/30 · $2"], [/^(\d+) récompenses? à récupérer$/, "$1 reward(s) to claim"], [/^⭐ (\d+) étoiles · tour du monde$/, "⭐ $1 stars · around the world"],
  [/^Ambassadeur : (.+)$/, (m, x) => `Ambassador: ${tr(x)}`], [/^Explorateur · (.+)$/, (m, x) => `Explorer · ${tr(x)}`], [/^(.+) — (bronze|argent|or)$/, (m, x, n) => `${tr(x)} — ${{ bronze: "bronze", argent: "silver", or: "gold" }[n]}`],
  [/^(\d+) cartes « (.+) », dont une rare ou mieux\.$/, (m, n, t) => `${n} "${tr(t)}" cards, including one rare or better.`], [/^(\d+) cartes d'(.+), dont une rare ou mieux\.$/, (m, n, c) => `${n} cards from ${tr(c)}, including one rare or better.`],
  [/^(\d+) cartes, dont au moins une rare ou mieux\.$/, "$1 cards, including at least one rare or better."], [/^Ouvrir un booster (.+) \((\d+)\)$/, (m, x, n) => `Open a ${tr(x)} booster (${n})`],
  [/^(.+) · (\d+) %$/, (m, x, n) => `${tr(x)} · ${n} %`], [/^Tour (\d+)$/, "Turn $1"], [/^Duel contre (.+)$/, "Duel against $1"],
  [/^Mes boosters \((\d+)\)$/, "My boosters ($1)"], [/^(\d+) \/ ([\d\s]+) cartes · ([\d.,]+) % du monde · (\d+)\/(\d+) XP$/, "$1 / $2 cards · $3 % of the world · $4/$5 XP"],
  [/^(\d+) cartes exclusives jusqu'au (.+)\.$/, "$1 exclusive cards until $2."], [/^Événement (.+) !$/, (m, x) => `${tr(x)} event!`], [/^Voir le booster$/, "See the booster"],
  [/^Plus que (\d+) !$/, "Only $1 left!"], [/^Encore (\d+) booster\(s\) avant le gros lot garanti$/, "$1 more booster(s) before the guaranteed jackpot"],
  [/^🍀 Jauge de Chance & Pity System : (\d+) %$/, "🍀 Luck gauge: $1 %"], [/^Nouvelles cartes dans (.+)$/, "New cards in $1"],
  [/^Récupérer le jour (\d+)$/, "Claim day $1"], [/^Revenez demain pour le jour (\d+) !$/, "Come back tomorrow for day $1!"], [/^vous avez (\d+)$/, "you have $1"],
];
// Repli générique : « emoji + texte » et segments séparés par « · »
function trGenerique(t) {
  const m = /^([^\p{L}\d«(]+?)\s+(.+)$/u.exec(t);
  if (m) { const r = tr(m[2]); if (r !== m[2]) return `${m[1]} ${r}`; }
  if (t.includes(" · ")) { const parts = t.split(" · "), trad = parts.map((x) => tr(x)); if (trad.some((x, i) => x !== parts[i])) return trad.join(" · "); }
  return t;
}
const COMPLEMENT_EN = new Map();
function tr(x) {
  const t = String(x).replace(/\s+/g, " ").trim();
  if (TRAD_EN[t] !== undefined) return TRAD_EN[t];
  if (COMPLEMENT_EN.has(t)) return COMPLEMENT_EN.get(t);
  for (const [re, rep] of REGLES_EN) if (re.test(t)) return t.replace(re, rep);
  if (!tr.profond) { tr.profond = true; try { const g = trGenerique(t); if (g !== t) return g; } finally { tr.profond = false; } }
  return x;
}
if (LANGUE === "en") {
  document.documentElement.lang = "en";
  // Noms de pays traduits par le navigateur
  try {
    const dn = new Intl.DisplayNames(["en"], { type: "region" });
    for (const [code, nom] of Object.entries(typeof NOM_PAYS !== "undefined" ? NOM_PAYS : {})) { const en = dn.of(code); if (en && en !== code) COMPLEMENT_EN.set(nom, en); }
  } catch {}
  const ATTRS = ["placeholder", "title", "aria-label"];
  const traduireTexte = (n) => {
    const orig = n.__fr ?? n.nodeValue;
    if (!/[A-Za-zÀ-ÿ]{2}/.test(orig)) return;
    const t = orig.replace(/\s+/g, " ").trim(), res = tr(t);
    if (res !== t && res !== orig) { n.__fr = orig; const val = orig.replace(t, res); if (n.nodeValue !== val) n.nodeValue = val; }
  };
  const traduire = (racine) => {
    if (racine.nodeType === 3) return traduireTexte(racine);
    if (racine.nodeType !== 1 || racine.closest?.("[data-notrad], script, style, textarea")) return;
    const w = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) if (!n.parentElement?.closest("script, style, textarea, [data-notrad]")) traduireTexte(n);
    for (const el of [racine, ...racine.querySelectorAll("[placeholder], [title], [aria-label]")]) for (const a of ATTRS) {
      const v = el.getAttribute?.(a); if (!v) continue; const r = tr(v); if (r !== v) el.setAttribute(a, r);
    }
  };
  const obs = new MutationObserver((liste) => {
    for (const m of liste) {
      if (m.type === "characterData") { if (m.target.nodeValue !== m.target.__dernier) { delete m.target.__fr; traduireTexte(m.target); m.target.__dernier = m.target.nodeValue; } }
      else m.addedNodes.forEach(traduire);
    }
  });
  addEventListener("DOMContentLoaded", () => {
    traduire(document.body);
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.title = "Play2F1 — Collectible card game: countries, cities and monuments of the world";
  });
}
// Choix de la langue (menu « Plus » et pied de page)
function vueLangue(v) {
  v.innerHTML = `<section class="panel" style="max-width:520px;margin:0 auto;text-align:center"><div style="font-size:52px">🌐</div>
    <h2>Langue / Language</h2><p class="muted">The English version is in beta: card names and fun facts are still in French.</p>
    <div class="row" style="justify-content:center;gap:10px"><button class="btn ${LANGUE === "fr" ? "primary" : ""}" data-l="fr">🇫🇷 Français</button><button class="btn ${LANGUE === "en" ? "primary" : ""}" data-l="en">🇬🇧 English (beta)</button></div></section>`;
  $$("[data-l]", v).forEach((b) => b.onclick = () => changerLangue(b.dataset.l));
}
if (typeof ajouterPage === "function") ajouterPage("langue", "🌐", LANGUE === "en" ? "Language" : "Langue", vueLangue);
addEventListener("DOMContentLoaded", () => {
  const liens = document.querySelector(".pied .liens");
  if (liens) { liens.insertAdjacentHTML("beforeend", ` · <a href="#" id="piedLangue">🌐 ${LANGUE === "en" ? "Français" : "English"}</a>`); document.getElementById("piedLangue").onclick = (e) => { e.preventDefault(); changerLangue(LANGUE === "en" ? "fr" : "en"); }; }
});
