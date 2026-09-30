# Connexion Google propre à Morice

Parcours préparé : client OAuth web, comptes séparés par identité Google et utilisateur Morice, tokens AES-GCM côté serveur, lecture Gmail uniquement. Aucun envoi ou classement Gmail implémenté par ces routes.

Configuration nécessaire : GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET dans les variables privées du site; Gmail API activée; URI de retour HTTPS exacte /api/google/callback sur le site existant. Le secret ne doit jamais entrer dans Git, le navigateur de Morice ou MultipleChat.

Utiliser un projet Google existant si possible. Ne pas activer d’essai payant ni ajouter de facturation pour ce travail. Configurer les utilisateurs de test si le consentement est en mode Testing; vérifier les règles et durées Google plutôt que promettre un accès permanent. Le compte Workspace peut imposer une validation administrateur.

Seuls les boutons de test appellent Gmail. OAuth accepté signifie autorisé; la mention Lecture vérifiée exige un appel réel au profil Gmail. Le connecteur Gmail disponible dans Codex ne fournit pas ses secrets au runtime Morice.

État vérifié : client et API configurés dans le serveur privé, première boîte autorisée et profil lu réellement. L’aperçu dans Emails examine au maximum 20 messages INBOX, uniquement objets, expéditeurs et états lus/non lus. Le classement repose sur les règles communes Outlook, dont Assurances et Newsletters. Il ne lit aucun corps ni pièce jointe, ne modifie aucun message, ne crée aucune tâche et ne couvre pas la boîte entière. Les propositions nécessitent une vérification humaine. Chaque autre boîte nécessite sa propre authentification.

Sources officielles consultées le 30 septembre 2026 :
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/workspace/gmail/api/auth/scopes
- https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance
