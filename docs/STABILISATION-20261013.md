# MORICE — stabilisation du 13 octobre 2026

## État et sauvegarde
main récupéré à 8bc86be, sans changement utilisateur écrasé. Ancienne copie Documents/morice : ec80476, non modifiée. Site privé version 39 : source b90d03f. Sauvegarde privée complète : outputs/MORICE-BEFORE-20261013.bundle.

## Statuts réellement vérifiés
| Module | Statut | Preuve / limite |
|---|---|---|
| GitHub et sauvegarde | OPÉRATIONNEL | main récupéré; bundle créé |
| Hébergement privé | OPÉRATIONNEL | Version 39 et accès propriétaire contrôlés; session runtime à rétablir |
| Conversation, tâches, mémoire | PARTIEL | Tests SQL; preuve historique; nouveau parcours runtime attend clé d'accès |
| Dictée, lecteur, fichiers | PARTIEL | Tests automatiques; microphone, Fold et nouveaux uploads non testés physiquement |
| Jobs / recherche | PARTIEL | Garde sans API et identifiant conservé testés; recherche IA bloquée |
| Microsoft principal | PARTIEL | Anciennes lectures runtime; deux commandes exactes testées avec Graph substitué |
| Multi-comptes | PARTIEL | Secondaires limitées au mail; agenda/To Do/OneDrive restent sur le principal |
| Validations | PARTIEL | Concurrence, réponse perdue et succès externe/échec DB testés; pas de nouvelle écriture externe |
| OpenClaw | PARTIEL | CLI globale 2026.7.1-2; /healthz live/ok; lecture nodes CLI interrompue après attente; tunnel/appareil non confirmés |
| Desktop Commander | BLOQUÉ | Alan Offline; commandes locales Codex disponibles séparément |
| Android / widget | PARTIEL | ADB ne voit aucun appareil; pas de commande physique |
| HTTP Shortcuts / Make | BLOQUÉ | Historique du 7 octobre : Queue is full; ancien Make inactif au 4 octobre; appareil actuel inaccessible |
| Push | PARTIEL | Code testé; aucune notification de test envoyée; réception Fold non prouvée |
| MultipleChat | PARTIEL | CORE/GitHub et chat prouvés auparavant; support refuse l'API d'intégration pour assistant personnel |
| Forfait OpenAI | BLOQUÉ | Demande reçue; éligibilité du site non confirmée; API payante désactivée |
| Automatisations avancées | BACKLOG | Pas de nouvelle installation ni accès |

## Corrections
- Travaux IA actifs sans clé autorisée : Bloqué explicite, identifiant/résultat/preuves conservés, aucun renvoi automatique.
- Polling de 15 secondes seulement avec travail actif, page visible et réseau en ligne. Réouverture et Actualiser conservés.
- Commandes exactes « Lis mes mails » et « Affiche mon agenda » : Graph direct en lecture seule avec journal existant. Demandes mixtes/écritures non reconnues par ces raccourcis.

## Nouveautés comparées à l'existant
- À CONSERVER : Graph direct, D1/R2, isolation des comptes, verrous, logo et interface.
- À AMÉLIORER : états de travaux et polling; lint complet préexistant.
- À TESTER : ARTEMIS MCP sur émulateur, Android CLI déjà identifié par RADAR. Pas de remplacement Tasker/OpenClaw. L'issue ARTEMIS #55 rapporte une injection shell et reste ouverte; cela ne prouve pas que chaque version est affectée. Vérifier le commit avant essai physique.
- BACKLOG : nouveaux fournisseurs Claude/Gemini/Grok et outils Make sans accès/coût prouvé.
- À REMPLACER : aucune nouvelle brique dans ce lot. To Do direct avait déjà remplacé Make; HTTP Shortcuts doit être neutralisé précisément sur appareil.
- SIWC hébergé : accès partenaire requis, pas de preuve d'acceptation. Les nouveautés ChatGPT/Work ne fournissent pas automatiquement l'inférence dans Morice.

Sources officielles relues : https://github.com/google/artemis/blob/main/mcp_server/README.md ; https://github.com/google/artemis/issues/55 ; https://developers.openai.com/siwc/request-client-id ; https://multiplechat.ai/help-guide ; https://tasker.joaoapps.com/userguide/en/faqs/faq-problem.html ; https://docs.openclaw.ai/releases/2026.9.6 .

## Vérifications et limites
94 tests, TypeScript, lint ciblé et build réussis. Lint complet : 12 erreurs préexistantes au départ, dont une corrigée dans jobs; les autres ne sont pas déclarées résolues. Authentification de production attend clé d'accès. Pas de nouvelle preuve D1/R2/Microsoft/Fold complète. Aucune notification, écriture mail, achat ou installation.
