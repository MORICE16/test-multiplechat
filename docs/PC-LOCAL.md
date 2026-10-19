# Morice — première liaison PC locale

Périmètre : santé générique et calculatrice Windows. Aucun modèle IA, secret, tunnel, accès aux fichiers, mails, microphone ou téléphone. Ce n'est pas un remplacement complet d'OpenClaw ou de JARVIS.

Le programme `scripts/pc-local.mjs` utilise Node déjà installé. Lancer `scripts/start-pc-local.cmd` dans la session interactive Windows, puis ouvrir Mon ordinateur dans Morice. Fermer la fenêtre coupe la liaison. Aucun lancement automatique n'est installé.

Le service écoute seulement 127.0.0.1:17616. Origine HTTPS Morice exacte et Host exact exigés sur les vraies requêtes, sans origine absente ou joker ; taille, format, méthodes, connexions et débit bornés. Aucune clé de compte n'est reçue. Un programme local peut falsifier Origin : cette protection navigateur n'est pas une authentification contre les autres programmes du PC. Le vrai garde de lancement est la confirmation native Windows, sans texte/argument/chemin issu de la requête.

Une seule confirmation à la fois, vingt secondes minimum entre invites, refus par défaut après quarante secondes. Calculatrice déjà présente : résultat incertain et pas de nouveau lancement. Processus observé après lancement : aucune garantie de fenêtre visible. Aucun réessai automatique. Déduplication par identifiant et session du programme ; après 256 identifiants, redémarrage nécessaire, aucune éviction permettant un rejeu silencieux.

Le navigateur peut demander une autorisation réseau local. Ne jamais contourner une protection ou remplacer le contrôle par un tunnel public. Ce lien ne permet pas au téléphone de commander le PC.

Le journal existant conserve une demande avant l'appel local puis un reçu strict. L'identité vient de la session serveur ; écritures même origine ; reçus limités à deux actions et statuts connus. La provenance indique explicitement « rapport du navigateur, non attesté par le serveur ». Un autre programme occupant le port peut imiter la santé ; aucun statut de confiance durable n'en est déduit. Enregistrement indisponible : réessayer uniquement l'enregistrement du reçu, jamais la commande.

Contrôles automatisés : serveur HTTP réel sur boucle locale, transport Windows substitué, base SQLite réelle pour le journal. Aucun test substitué ne prouve un lancement Windows ni le passage du navigateur en production.

Références officielles consultées :
- https://nodejs.org/api/http.html
- https://developer.chrome.com/blog/local-network-access
- https://learn.microsoft.com/en-us/dotnet/api/system.windows.forms.messagebox.show

Revue de description Claude dans MultipleChat MC-PC-LOCAL-20261019 réellement reçue ; ce n'est pas une revue du code final. Réserves intégrées : Host/Origin ne sont pas une identité, refus strict du POST, confirmation bornée, limitation des invites, contrôle du processus déjà présent et provenance explicite du journal.
