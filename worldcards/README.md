# 🌐 WorldCards — Collectionner le monde

Une application web de cartes à collectionner sur le monde, avec un mode combat.

## 🌍 Les cartes
- **195 pays** (les 193 membres de l'ONU, plus le Vatican et la Palestine) avec drapeau, silhouette, capitale,
  anecdote et la **photo d'un lieu emblématique** (souvent la capitale)
- **210 villes**, **203 monuments et sites naturels** (peu communs à ultra rares) et les **14 merveilles**
  (7 modernes et 7 antiques), toutes légendaires, avec de vraies photos de Wikipédia
- **Cartes Shiny** (environ 1 sur 45) avec effet holographique
- **Badges**, **atlas interactif**, **cartes secrètes** (Avalon, El Dorado, l'Atlantide…)

## ⚔️ Combat
- Chaque carte a des points d'**attaque**, de **défense** et de **vie**, selon sa rareté et son type.
  Deux exemplaires d'une même carte diffèrent (de -8 % à +8 % par statistique).
- Les **doublons** font monter la carte de niveau (+2 % par niveau, niveau 5 à 16 exemplaires) et peuvent améliorer ses statistiques.
- **Deck de 3 cartes** avec un budget de 12 points (une légendaire coûte 6, une commune 1) : les decks restent équilibrés.
- Triangle des types : Ville > Monument > Pays > Ville. Actions : attaque, spécial (une fois par carte), garde.
- **Entraînement** contre l'ordinateur (3 difficultés) et **arène en ligne** contre les decks des autres joueurs,
  avec trophées et classement. Le serveur rejoue chaque combat (`combat.js`, partagé) pour vérifier le résultat.

## 🎁 Économie
- **Booster gratuit toutes les 12 heures** (avec notification quand il est prêt).
- **Boutique** : Classique (120 🪙), Argent (380 🪙), Or (900 🪙) et Prestige (1 500 🪙, Premium) : plus cher, plus rare.
- **Quiz** : 10 questions par jour (20 en Premium), 25 🪙 par bonne réponse.

## 💎 Premium (5,99 € par mois ou 39,99 € à vie)
- Paiement par PayPal (paypal.me/noozoaa), pseudo dans la note, puis « J'ai payé » dans le jeu ; l'administrateur
  vérifie et active le Premium depuis *Administration → Premium* (le joueur reçoit une notification).
- Avantages : +2 boosters par jour, boosters Prestige (un offert par semaine), Shiny ×2, 20 questions de quiz,
  20 combats d'arène par jour, badge 💎.
- ⚠ **Vendre impose d'indiquer votre identité réelle** : remplissez `ADRESSE`, `SIRET` et `CONTACT` en haut de
  `compte.js` (mentions légales et CGV). Les revenus doivent être déclarés (micro-entreprise conseillée).

## 🔔 Notifications push
Web Push standard : les clés VAPID sont créées automatiquement et gardées dans la base D1. Une tâche planifiée
(cron toutes les 15 minutes, dans `wrangler.toml`) envoie les rappels de booster gratuit. Sur iPhone, il faut
d'abord ajouter le site à l'écran d'accueil (iOS 16.4 ou plus).

## 👤 Comptes, sauvegarde dans le cloud et communauté
- **Inscription** avec un pseudo et un mot de passe (sans e-mail), acceptation des conditions et de la politique
  de confidentialité, vérification de l'âge (15 ans ou accord parental).
- **Sauvegarde dans le cloud** automatique : la collection suit le joueur sur tous ses appareils. Si un appareil
  a déjà une progression, le jeu demande laquelle garder.
- **Hub communautaire** : fil de messages avec cartes jointes, « j'aime », signalements, classement des joueurs
  et profils publics avec une vitrine de 5 cartes et les trophées d'arène.
- **Mode administrateur** (réservé au pseudo `nuiraz`) : statistiques, liste des joueurs, bannissement,
  réinitialisation de mot de passe, suppression de compte, traitement des signalements, cadeaux (pièces et
  boosters) à un joueur ou à tous, annonces épinglées et outils de test.
- **RGPD** : téléchargement de ses données et suppression de son compte depuis « Mon compte ».
- **Pages légales** : mentions légales, conditions d'utilisation et politique de confidentialité.
  ⚠ Remplacez `CONTACT` en haut de `compte.js` par votre adresse e-mail de contact. Ces textes sont un modèle
  adapté au site : relisez-les et adaptez-les à votre situation.

## 📲 Application installable
Le site s'installe comme une application (icône sur l'écran d'accueil, plein écran, fonctionne hors ligne) :
bouton « Installer l'app » sur Android et ordinateur, ou menu Partager → « Sur l'écran d'accueil » sur iPhone.

## ☁️ Mise en ligne sur Cloudflare Pages (gratuit)
Les comptes ont besoin des **fonctions** du dossier `functions/` et d'une base **D1** : il faut donc relier
le dépôt GitHub (l'envoi d'un zip ne prend pas en charge les fonctions).

1. **Projet Pages relié à GitHub** : *Settings → Builds & deployments*
   - Production branch : `claude/worldcards`
   - Build command : *(vide)* — Build output directory : `worldcards` — Root directory : *(vide)*
2. **Créer la base** : *Workers & Pages → D1 SQL Database → Create* — nom : `worldcards`.
   Les tables se créent toutes seules au premier lancement.
3. **Relier la base au site** : projet Pages → *Settings → Bindings → Add → D1 database* —
   nom de la variable : `DB`, base : `worldcards`.
4. **Code administrateur** : *Settings → Variables and Secrets → Add* — type *Secret*, nom `ADMIN_CODE`,
   valeur : un code long que vous seul connaissez.
5. **Redéployer** : *Deployments → Retry deployment* (les réglages ne s'appliquent qu'au déploiement suivant).
6. Ouvrez le site → 👤 → « Créer un compte » avec le pseudo **nuiraz** : un champ « Code administrateur »
   apparaît, entrez-y le code de l'étape 4. Personne d'autre ne peut prendre ce pseudo (ni « Nu1raz »,
   « nuiraz_ »…).

Gratuit dans les limites de l'offre de base de Cloudflare (100 000 requêtes par jour pour les fonctions,
5 Go pour D1). Sans base D1, le jeu reste jouable : seuls les comptes et le hub sont indisponibles.

## Lancer
Ouvrez `index.html` dans un navigateur : tout fonctionne sans serveur et sans connexion internet.
La progression est enregistrée dans le navigateur ; exportez-la depuis ⚙︎ Réglages pour la garder ou changer d'appareil.

Pour la publier en ligne, activez GitHub Pages sur ce dépôt (le dossier `worldcards/` est un site statique).

## Vraies photos
Les pays, villes, monuments et merveilles affichent la photo principale de leur article Wikipédia,
chargée depuis Wikimedia Commons dans le navigateur du joueur, puis gardée en mémoire 30 jours. Les cartes non
possédées montrent un aperçu flouté. La fiche de chaque carte indique l'auteur et la licence de la photo. Sans
connexion, les cartes gardent leur dessin. Les photos se désactivent dans ⚙︎ Réglages. Les jeux vidéo n'ont pas
de photo (les jaquettes sont protégées par le droit d'auteur) : ajoutez-y vos propres illustrations.

## Crédits
- Photos : contributeurs de [Wikipédia](https://fr.wikipedia.org) et [Wikimedia Commons](https://commons.wikimedia.org), licences libres (auteur et licence sur chaque fiche)
- Carte du monde : [Natural Earth](https://www.naturalearthdata.com) via [world-atlas](https://github.com/topojson/world-atlas) (domaine public)
- Drapeaux : [flag-icons](https://github.com/lipis/flag-icons) (licence MIT)
- [D3](https://d3js.org) et [TopoJSON](https://github.com/topojson/topojson-client) (licence ISC)
