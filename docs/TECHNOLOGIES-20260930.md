# Disponibilité vérifiée — 30 septembre 2026

Disponibilité d’un produit et accès de ce runtime sont deux vérifications distinctes. Aucun abonnement de conversation n’est assimilé à une clé API.

| Technologie | Classement | Décision pour Morice |
| --- | --- | --- |
| OpenAI Work / Codex / Responses | DISPONIBLE | Réutiliser les accès; catalogue API interrogé pour les analyses. Tests runtime nécessaires. |
| OpenAI dots | DISPONIBLE, accès de ce compte NON CONFIRMÉ | Ordinateur cloud et délégation ne prouvent pas les droits du runtime Morice. |
| OpenClaw 2026.9.6 | DISPONIBLE | Installation globale observée : 2026.7.1-2; launcher séparé configuré sur 2026.8.1. Aucun remplacement aveugle. |
| Microsoft Work IQ MCP | BÊTA-PREVIEW | Tenant et consentement administrateur nécessaires; NON ACCESSIBLE via la connexion actuelle tant que non confirmés. |
| Work IQ REST / A2A | DISPONIBLE dans l’offre documentée | Activation tenant, authentification déléguée et facturation Copilot à vérifier. Conserver Graph. |
| Microsoft Graph | DISPONIBLE | Réutiliser les connexions existantes, vérifier chaque service séparément. |
| Make AI Agents nouvelle application | BÊTA-PREVIEW | Ne pas remplacer les actions sans vérifier scénario, compte et coût. |
| Make MCP Client / Server / outils | DISPONIBLE | Présence d’un webhook n’est pas une preuve de scénario fonctionnel. |
| MultipleChat Projects / GitHub | DISPONIBLE | Import de dépôt et Re-sync manuels documentés. API de re-sync NON CONFIRMÉE. |
| Android Halo | ANNONCÉ | Ne pas développer une dépendance avant disponibilité sur le téléphone. |
| Gemini Spark | BÊTA-PREVIEW | Accès de ce compte NON CONFIRMÉ; MCP documenté, éligibilité limitée. |
| Google ARTEMIS MCP Android | DISPONIBLE en open source | Nécessite appareil, ADB, helper et permissions; installation sur Fold non prouvée. |
| Claude / Gemini / Grok API | DISPONIBLE | NON ACCESSIBLE À NOTRE RUNTIME sans credentials vérifiés; aucune clé créée. |
| Grok Bot | BÊTA-PREVIEW | Éligibilité du compte non vérifiée. |
| Tasker / Samsung Android | DISPONIBLE | Bon exécutant déterministe; permissions et restrictions arrière-plan à vérifier sur appareil. |

## Sources officielles

- OpenAI : https://learn.chatgpt.com/docs/dots/getting-started ; https://learn.chatgpt.com/docs/pricing ; https://developers.openai.com/api/docs/guides/model-selection ; https://developers.openai.com/api/docs/guides/file-inputs
- OpenClaw : https://docs.openclaw.ai/releases/2026.9.6
- Microsoft : https://github.com/microsoft/work-iq ; https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/work-iq/api-overview ; https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/work-iq/enable-work-iq
- Make : https://help.make.com/make-ai-agent-new-app ; https://help.make.com/introduction-to-mcp
- MultipleChat : https://multiplechat.ai/help-guide ; https://multiplechat.ai/tools/ai-projects
- Google : https://blog.google/products-and-platforms/platforms/android/android-halo/ ; https://support.google.com/gemini/answer/17209137 ; https://github.com/google/artemis
- Autres : https://platform.claude.com/docs/en/api/models ; https://ai.google.dev/gemini-api/docs/models ; https://docs.x.ai/overview ; https://docs.x.ai/grok-bot/overview ; https://tasker.joaoapps.com/ ; https://tasker.joaoapps.com/userguide/en/faqs/faq-problem.html
