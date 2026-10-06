# Fabien AI — Salle des agents

Application web statique et gratuite à l’usage. L’IA s’exécute directement dans le navigateur via WebGPU/WebLLM.

## Principes
- Pas de clé API, pas de facturation par message.
- Les projets, mémoires, conversations et rapports sont stockés dans le navigateur de l’utilisateur (localStorage).
- Le dépôt ne contient pas les données personnelles ou métiers saisies dans l’application.
- Le premier lancement d’un modèle télécharge ses fichiers depuis les fournisseurs publics utilisés par WebLLM; l’inférence se fait ensuite localement dans le navigateur.
- L’application ne fournit pas de validation médicale, juridique, comptable, architecturale ou réglementaire. Les sorties nécessitant une expertise réglementée doivent être vérifiées par un professionnel compétent.

## Publication
Ce dépôt est conçu pour GitHub Pages. Dans **Settings → Pages**, choisir **Deploy from a branch**, branche **main**, dossier **/(root)**.

## Licence du code de cette interface
MIT. Les modèles et dépendances conservent leurs propres licences.
