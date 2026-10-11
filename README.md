# Coda — tous vos assistants IA sur un seul site

Une seule page web pour discuter avec **Claude**, **ChatGPT**, **Gemini** et des centaines d'autres modèles (Mistral, Llama, DeepSeek, Grok… via **OpenRouter**).

## Fonctionnalités

- **Un assistant** : discutez avec l'IA de votre choix et changez d'IA en cours de conversation.
- **Comparer** : envoyez la même question à plusieurs IA en même temps et voyez leurs réponses côte à côte.
- Réponses affichées en direct (streaming), mise en forme Markdown, bouton « Copier ».
- Historique des conversations enregistré dans votre navigateur.
- Instructions système communes à tous les assistants (ex. « Réponds en français »).
- Thème clair/sombre, adapté au mobile.

## Utilisation

1. Ouvrez `index.html` dans votre navigateur (double-clic), ou publiez-le avec GitHub Pages
   (Settings → Pages → branche `main`, dossier `/`).
2. Cliquez sur **⚙︎ Clés & modèles** et collez vos clés API :
   - Claude : https://console.anthropic.com/settings/keys
   - ChatGPT (OpenAI) : https://platform.openai.com/api-keys
   - Gemini : https://aistudio.google.com/apikey (offre gratuite disponible)
   - OpenRouter : https://openrouter.ai/keys
3. Choisissez un assistant en haut, ou passez en mode **Comparer**.

## Important

- Les abonnements grand public (ChatGPT Plus, Gemini Advanced, Claude Pro) **ne peuvent pas** être
  connectés à un site tiers : chaque fournisseur exige une clé API, facturée à l'usage séparément.
- Les clés sont stockées uniquement dans le `localStorage` de votre navigateur et envoyées directement
  aux fournisseurs. N'utilisez ce site que sur un appareil personnel, et ne partagez pas une version
  contenant vos clés.
- Les noms de modèles sont modifiables dans les paramètres : quand un fournisseur sort un nouveau
  modèle, tapez simplement son identifiant.
