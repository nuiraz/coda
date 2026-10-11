# 🌐 WorldCards — Collectionner le monde

Une application web de cartes à collectionner, en deux univers.

## 🌍 Monde
- **195 pays** (les 193 membres de l'ONU, plus le Vatican et la Palestine) avec drapeau, silhouette, capitale et anecdote
- **70 villes**, **93 monuments** rares, épiques et ultra rares, et les **14 merveilles** (7 modernes et 7 antiques), toutes légendaires
- **Badges par continent** : bronze (25 %), argent (50 %) et or (100 %), plus des badges spéciaux
- **Atlas interactif** : la carte du monde se colore à mesure que vous collectionnez ; villes et monuments y sont épinglés
- **Cartes secrètes** : terminez une collection pour les débloquer (Avalon, El Dorado, Shangri-La, l'Atlantide…)

## 🧰 Objets du quotidien
- **76 objets** de la vie courante (fourchette, crayon, jean, ampoule, smartphone…) en 6 catégories :
  cuisine, maison, bureau & école, mode & soin, jeux & loisirs, technologie
- Quatre raretés : **commune**, **rare**, **ultra rare** et **légendaire**, avec date d'apparition, origine et anecdote
- 7 cartes secrètes : la pierre de Rosette, la lampe d'Aladin, le Disque d'or de Voyager…

## 🎮 Gaming — les cartes du gaming
- Une **encyclopédie de 71 jeux vidéo** à collectionner, de Pong (1972) à Elden Ring (2022), rangés par époque
- Des cartes secrètes en hommage aux légendes du jeu vidéo (MissingNo., le code Konami…)
- **Mes collections** : créez vos propres collections autour de vos jeux préférés, avec **vos illustrations**
  (dessins, captures, photos) et vos propres cartes

## Comment jouer
- **Boosters** : 5 cartes par booster, dont au moins une rare. 3 boosters Monde, 2 Gaming et 2 Objets offerts au départ,
  puis un cadeau chaque jour. Les cartes que vous n'avez pas sortent plus souvent ; les doublons rapportent des pièces.
- **Quiz** : capitales, drapeaux, lieux, années de sortie, studios, anecdotes… Chaque bonne réponse rapporte 20 🪙,
  avec un bonus toutes les 5 bonnes réponses d'affilée.
- **Pièces** : achetez des boosters, ou obtenez directement une carte qui vous manque depuis l'album.
- Les **anecdotes** se révèlent quand vous possédez la carte.

## 👤 Comptes, sauvegarde dans le cloud et communauté
- **Inscription** avec un pseudo et un mot de passe (sans e-mail), acceptation des conditions et de la politique
  de confidentialité, vérification de l'âge (15 ans ou accord parental).
- **Sauvegarde dans le cloud** automatique : la collection suit le joueur sur tous ses appareils. Si un appareil
  a déjà une progression, le jeu demande laquelle garder.
- **Hub communautaire** : fil de messages avec cartes jointes, « j'aime », signalements, classement des joueurs
  et profils publics avec une vitrine de 5 cartes.
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
Les villes, monuments, merveilles, objets et cartes secrètes affichent la photo principale de leur article Wikipédia,
chargée depuis Wikimedia Commons dans le navigateur du joueur, puis gardée en mémoire 30 jours. Les cartes non
possédées montrent un aperçu flouté. La fiche de chaque carte indique l'auteur et la licence de la photo. Sans
connexion, les cartes gardent leur dessin. Les photos se désactivent dans ⚙︎ Réglages. Les jeux vidéo n'ont pas
de photo (les jaquettes sont protégées par le droit d'auteur) : ajoutez-y vos propres illustrations.

## Crédits
- Photos : contributeurs de [Wikipédia](https://fr.wikipedia.org) et [Wikimedia Commons](https://commons.wikimedia.org), licences libres (auteur et licence sur chaque fiche)
- Carte du monde : [Natural Earth](https://www.naturalearthdata.com) via [world-atlas](https://github.com/topojson/world-atlas) (domaine public)
- Drapeaux : [flag-icons](https://github.com/lipis/flag-icons) (licence MIT)
- [D3](https://d3js.org) et [TopoJSON](https://github.com/topojson/topojson-client) (licence ISC)
