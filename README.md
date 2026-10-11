# ✦ Coda — toutes vos IA sur un seul site

Une seule application web pour utiliser **Claude**, **ChatGPT**, **Gemini**, **Grok**, des centaines d'autres
modèles via **OpenRouter**, et des **IA locales gratuites, sans compte** (Ollama, LM Studio).

Tout tourne sur votre ordinateur : pas d'inscription, pas de serveur, pas de base de données en ligne.

## 🔑 Avec vos abonnements, sans aucun frais

Vous avez déjà ChatGPT, Claude Pro, Gemini Pro ou SuperGrok ? Deux façons de les utiliser **sans clé API
et sans payer en plus** :

### Coda Bureau : les 4 IA côte à côte dans une seule fenêtre (recommandé)
Une application pour ordinateur qui affiche **les sites officiels** de ChatGPT, Claude, Gemini et Grok,
connectés à **vos** comptes. Vous tapez une seule fois, en bas, et la question part :
- **à toutes les IA en même temps** pour comparer leurs réponses côte à côte ;
- ou en **✦ Auto** : uniquement à l'IA choisie pour la tâche (vidéo/YouTube → Gemini, code → Claude,
  actualité → Grok, images → ChatGPT…), réglable avec le bouton « Règles Auto » ;
- ou à une seule IA, au choix. `@gemini`, `@claude`, `@chatgpt` ou `@grok` en début de message force une IA.

**Lancer :** installez [Node.js](https://nodejs.org) (version LTS), puis double-cliquez sur
`bureau/lancer-bureau.bat` (Windows) ou `bureau/lancer-bureau.command` (Mac), ou tapez
`bureau/lancer-bureau.sh` (Linux). La première fois, l'installation télécharge environ 100 Mo. Connectez-vous
ensuite une fois dans chaque panneau : les connexions sont gardées.

Toutes les fonctions de vos abonnements restent disponibles dans les panneaux : images, vidéos (Veo pour
Gemini Pro), fichiers (glissez-les dans le panneau), recherche web, historique, etc.

### Mode « 🔑 Abonnements » du site Coda (sans rien installer, marche aussi sur téléphone)
Vous écrivez dans Coda, et la bonne IA s'ouvre dans un nouvel onglet avec votre question déjà remplie
(ChatGPT, Claude et Grok). Pour Gemini, la question est copiée : il suffit de la coller.
Pour ouvrir plusieurs IA d'un coup, autorisez les fenêtres pop-up pour Coda dans votre navigateur.

### À savoir
- Les réponses restent sur les sites officiels : l'arbitre automatique et le classement ont besoin des clés
  API (ou des IA locales). Avec les abonnements, c'est vous qui comparez, côte à côte.
- Coda Bureau tape votre question à votre place dans les sites. Si un site change son interface, l'envoi
  automatique peut ne plus marcher : le panneau l'indique, et vous pouvez toujours taper directement dedans.
- Les conditions d'utilisation des services grand public interdisent en général l'automatisation. Coda Bureau
  se contente de saisir votre question quand vous cliquez sur Envoyer, sans rien récupérer automatiquement,
  mais l'usage reste sous votre responsabilité.
- **Gemini gratuit en plus :** Google AI Studio donne une clé API Gemini avec une offre gratuite
  (https://aistudio.google.com/apikey). Avec elle, Gemini marche aussi dans les modes Auto, Comparer et
  arbitre du site, sans frais dans les limites de l'offre gratuite.

## Démarrer

| Système | Comment lancer |
|---|---|
| **Windows** | double-cliquez sur `lancer.bat` |
| **macOS** | double-cliquez sur `lancer.command` (la première fois : clic droit → Ouvrir) |
| **Linux** | `./lancer.sh` |

Le navigateur s'ouvre sur **http://localhost:8080**. Il faut Python (déjà présent sur macOS et Linux ;
sous Windows : https://www.python.org/downloads/, en cochant « Add python to PATH »). À défaut, Node.js suffit.

### Option 1 : IA locales, gratuites et sans compte

1. Installez **Ollama** : https://ollama.com/download
2. Téléchargez un modèle, par exemple dans un terminal :
   ```
   ollama pull llama3.2      # rapide, polyvalent
   ollama pull gemma3        # voit aussi les images
   ```
3. Lancez Coda : Ollama est **détecté et activé automatiquement**.

Rien ne quitte votre ordinateur, et ça marche même sans internet.
LM Studio fonctionne aussi : démarrez son serveur local, activez « Enable CORS », puis cochez-le dans
Réglages → IA locales.

### Option 2 : IA en ligne (clé API)

Dans **⚙︎ Réglages → IA en ligne**, collez les clés que vous voulez :

| IA | Où obtenir la clé | Points forts dans Coda |
|---|---|---|
| Claude | https://console.anthropic.com/settings/keys | code, rédaction, PDF |
| ChatGPT | https://platform.openai.com/api-keys | polyvalent, **création d'images** |
| Gemini | https://aistudio.google.com/apikey (offre gratuite) | **vidéos, audio, YouTube**, images, **création de vidéos (Veo)** |
| Grok | https://console.x.ai | actualité, création d'images |
| OpenRouter | https://openrouter.ai/keys | Mistral, Llama, DeepSeek, Qwen… avec une seule clé |

Les abonnements grand public (ChatGPT Plus, Gemini Advanced, Claude Pro…) ne peuvent pas être branchés sur un
site tiers : les clés API sont facturées à l'usage, séparément.

## Les 3 modes

### ✦ Auto : la bonne IA pour chaque tâche
Vous écrivez, Coda choisit l'IA. Sous la zone de saisie, vous voyez **en direct** quelle IA va répondre.

| Tâche | Détectée quand… | IA par défaut |
|---|---|---|
| 🔒 Privé | le message contient `#privé` ou `#local` | Ollama (local) |
| 🎬 Créer une vidéo | « crée une vidéo de… » | Gemini (Veo) |
| 🎨 Créer une image | « dessine… », « génère une image de… », « fais un logo… » | ChatGPT |
| 🎞️ Analyser une vidéo / un audio | vidéo ou audio joint, lien YouTube | Gemini |
| 📄 Lire un PDF | PDF joint | Claude |
| 🖼️ Analyser une image | image jointe | Gemini |
| 💻 Programmation | code, bug, Python… | Claude |
| 📰 Actualité | actu, news, tendances, Twitter… | Grok |
| ✍️ Rédaction & traduction | rédige, traduis, résume, e-mail… | Claude |
| 💬 Tout le reste | — | Claude |

Tout se change dans **Réglages → Mode Auto**. Si l'IA choisie n'est pas configurée, la première IA compatible
prend le relais. Pour forcer une IA, commencez le message par `@gemini`, `@claude`, `@chatgpt`, `@grok`,
`@ollama`…

### Un assistant
Vous choisissez une IA et discutez avec elle. Demandez-lui une image si elle sait en créer.

### Comparer
La même question part à plusieurs IA à la fois. Chaque réponse s'affiche en direct, avec un chronomètre.
Ensuite, une **IA arbitre** lit les réponses anonymisées, les note sur 10 et désigne la meilleure 🏆.
Un **classement** des victoires s'affiche dans la barre latérale.

## Pièces jointes

📎, glisser-déposer ou coller : images, PDF, vidéos, audio, fichiers texte et code (20 Mo maximum par fichier).
Si l'IA choisie ne sait pas lire un type de fichier, Coda vous le signale.

## Vos données

- Les clés et réglages sont stockés dans le navigateur (`localStorage`), les conversations dans `IndexedDB`.
  Rien n'est envoyé ailleurs qu'aux IA que vous utilisez.
- Vous pouvez exporter et importer vos conversations (Réglages → Arbitre & général).
- Utilisez Coda sur un appareil personnel : quiconque y a accès voit vos clés.

## Bon à savoir

- Les noms de modèles se modifient dans les Réglages. Quand un fournisseur sort un nouveau modèle, tapez
  simplement son identifiant.
- La création de vidéos (Veo) est payante chez Google et prend généralement 1 à 3 minutes.
- Chaque arbitrage en mode Comparer coûte un appel API de plus. Il peut être désactivé.
- Ouvrir `index.html` directement (sans le script `lancer`) fonctionne pour les IA en ligne, mais pas pour les
  IA locales : le navigateur bloque alors l'accès à Ollama.

## Structure

```
index.html     page
style.css      apparence (thème clair / sombre, mobile)
app.js         logique : fournisseurs, routage, arbitre, pièces jointes, stockage
vendor/        marked + DOMPurify (Markdown sécurisé, inclus pour fonctionner hors ligne)
lancer.*       scripts de démarrage local
bureau/        Coda Bureau (Electron) : sites officiels côte à côte avec vos abonnements
```
