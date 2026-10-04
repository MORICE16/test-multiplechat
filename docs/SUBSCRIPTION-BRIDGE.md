# MORICE — liaison au forfait existant, sans crédit API acheté

## Décision validée
Alan demande d'utiliser ses abonnements existants et refuse un modèle imposant des recharges API. Les appels payants OpenAI sont bloqués par défaut; la clé privée reste conservée côté serveur. Toute activation future exige une décision explicite distincte, pas un simple rechargement de solde.

## Solution officielle proposée — preview, pas connectée
Sign in with ChatGPT peut autoriser des requêtes Responses au titre du forfait ChatGPT. Ce droit est différent de l'identification actuelle du site. Il ne donne pas accès aux conversations ChatGPT existantes. Les quotas du forfait restent applicables; aucune promesse d'usage illimité.

- Applications open-source/locales : parcours OAuth avec host ID stable et consentement propre, selon les conditions officielles.
- Site hébergé : éligibilité partenaire/autorisation OpenAI à établir avant implémentation. Ne pas détourner la session Codex ou les cookies du navigateur pour produire un accès.
- Responses : stream=true, store=false; contexte renvoyé à chaque demande; attendre response.completed avant confirmation.
- Le fonctionnement background actuel n'est pas compatible avec cette preview. Les analyses et leur journal nécessitent un adaptateur dédié; ne pas remplacer la brique actuelle sans test et confrontation architecturale MultipleChat.
- Audio et transcription non pris en charge par cette liaison : dictée du navigateur ou clavier vocal du téléphone, sans crédits OpenAI. Le navigateur peut utiliser son propre service en ligne; ce n'est pas une promesse de fonctionnement hors ligne.
- Alternative : exposer des outils Morice privés dans ChatGPT via plugin/MCP, avec consentement spécifique. Cela place la conversation dans ChatGPT, plutôt que d'inventer un transport automatique depuis le site.

## Disponible dès cette correction
Blocage serveur des clés API payantes; tâche/mémoire locales; connexions Graph/Gmail existantes; création To Do directe. Dictée navigateur réutilisée, non testée vocalement sur Fold dans ce lot. La connexion du forfait reste non vérifiée et affichée ainsi.

## Sources officielles consultées le 4 octobre 2026
- https://developers.openai.com/siwc/token-sharing-open-source
- https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference
- https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations
- https://developers.openai.com/siwc/request-client-id

## Prochaines actions
1. Confirmer l'éligibilité du site hébergé ou d'un hôte local dédié, sans transmettre automatiquement des données privées.
2. Confronter le choix architectural dans MultipleChat avant migration; ne pas consommer de crédit API pour cette confrontation.
3. Réaliser un consentement au forfait et un test minimal terminé, puis seulement adapter conversation et fichiers.
