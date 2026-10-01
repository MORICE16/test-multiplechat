# 04 — MORICE SYNC | CORE ↔ Codex ↔ MultipleChat

Version MORICE-SYNC/1 — consolidation du 30 septembre 2026.
Ce document est le protocole commun et son journal technique public. Il n'est pas un service déployé.
La tâche quotidienne et « Va te briefer » lisent la même section ci-dessous, sans moteur applicatif supplémentaire.
02 — MORICE DEV reste l'atelier d'implémentation après validation ; CORE-SYNC demeure le suivi technique.
Les anciennes conversations et générations restent des archives ; aucun déplacement/renommage de conversation n'est attesté par cette mission.

## Protocole commun

Exécute MORICE-SYNC/1 pour CORE Maître Morice. Le déclencheur « Va te briefer » et la tâche quotidienne exécutent ce même protocole, sans modifier le code fonctionnel.

1. Collecte. Lis CORE-SYNC.md, docs/core-state.json et les références pertinentes. Vérifie Git local (HEAD, changements, dates) si accessible et GitHub MORICE16/test-multiplechat/main ; distingue copie locale, dépôt et version réellement servie. Consulte uniquement les diagnostics authentifiés en lecture seule disponibles, sans déclencher d'action externe ni lire de secrets. Pour chaque source, note identifiant/emplacement, date de collecte, date de preuve, périmètre et statut LU / PARTIEL / INACCESSIBLE / OBSOLÈTE. Un fichier de suivi n'est pas un test runtime.
2. Contexte. Recherche les décisions et travaux pertinents de 01 CORE, 04 MORICE SYNC, anciens Morice 3/4/5, 03 RADAR, Veille Morice et sessions Work/Codex accessibles. La recherche de contexte peut être partielle : n'invente ni export intégral ni lecture automatique de tous les chats. Réutilise le dernier bilan persistant et vérifie les changements depuis sa date. Les demandes récentes explicites d'Alan priment sur les propositions d'assistant ; pour les faits d'implémentation, code/version/runtime/tests datés priment sur les récits. Garde les contradictions avec leurs sources. N'efface pas l'historique.
3. RADAR intégré. Recherche les nouveautés officielles pertinentes pour OpenAI/ChatGPT/Work/Codex/dots, MultipleChat, OpenClaw, Make/MCP, Microsoft 365/Work IQ/Outlook/To Do, HubSpot dans son périmètre autorisé, Android/Samsung/ARTEMIS, Tasker, Claude, Gemini et Grok. Ne conserve que les nouveautés pouvant remplacer, simplifier ou améliorer une brique existante. Pour chacune : source officielle et dates, DISPONIBLE / BÊTA-PREVIEW / ANNONCÉ, brique concernée, gain concret, compatibilité, droits/licences requis et coûts vérifiés ou inconnus. Disponibilité publique et accès du compte sont distincts. Déduplique par annonce/version/brique ; ne répète pas une ancienne piste sans changement matériel.
4. Confrontation. Tout changement important d'hébergement, stockage/mémoire, authentification/permissions, fournisseur/routage, infrastructure ou coût récurrent crée un dossier : ID stable, commit/runtime/preuves, problème, options incluant conserver, bénéfices/risques/coûts, fichiers/extraits techniques minimaux, questions et tests/retour arrière. Vérifie la documentation d'accès automatique MultipleChat (API/MCP/CLI/webhook ou autre mécanisme fiable). Ne l'utilise qu'avec accès autorisé et preuve d'un appel récupérant plusieurs avis identifiables ; une interface interne non documentée ne suffit pas. Sans cette preuve : EN ATTENTE MULTIPLECHAT, aucun avis inventé et aucune substitution silencieuse par d'autres agents. Compare Mode avec au moins deux modèles différents convient au parcours manuel ; conserve réponses brutes, noms/modèles affichés, date, sources et référence d'échange. Si elles existent, produis une synthèse des accords/désaccords, arguments, preuves manquantes, puis confronte-la aux fichiers et connexions actuels.
5. Décisions. Classe CONSERVER / TESTER / AMÉLIORER / REMPLACER et distingue DÉCIDÉ / TESTÉ / OPÉRATIONNEL / À TESTER / BACKLOG. Chaque décision indique validation Alan (référence/date/périmètre) ou À VALIDER. Une recommandation, un avis IA ou une autorisation de lecture n'autorise pas l'implémentation. Ne transmets à 02 MORICE DEV que les travaux validés par Alan ; pour un changement architectural, confrontation préalable requise. Si le commit ou les droits changent, revalide le périmètre.
6. Persistance. Le dépôt est public : conserve uniquement le bilan technique expurgé dans la section Journal de docs/MORICE-SYNC.md, par ajout daté sans écraser les entrées précédentes. Mets à jour docs/core-state.json et régénère CORE-SYNC.md seulement pour des faits techniques prouvés, jamais pour y dupliquer la veille. Lis la version/SHA actuelle avant toute écriture, relis après ; en conflit ne force pas et conserve un résultat privé en attente. Ne publie aucun message privé, compte, secret, pièce jointe ni texte du CORE privé. Conserve le bilan privé et avis détaillés dans un fichier persistant privé versionné si un accès d'écriture est réellement disponible. Si aucun stockage n'est accessible, annonce PERSISTANCE EN ATTENTE et fournis un export récupérable : ne prétends pas avoir écrit. Pas de création automatique de tâches depuis les mails.
7. Sortie. Produis : état daté et couverture des sources, changements matériels, contradictions, RADAR filtré, dossiers MultipleChat, décisions/preuves, travaux validés pour 02 et blocages. Lors de la tâche quotidienne, notification utilisateur uniquement pour changement matériel, nouvelle décision à valider ou blocage nouveau ; sinon note « Aucun changement matériel » dans le bilan sans notification si l'outil le permet. Aucune installation, migration, achat, suppression d'historique, envoi de mail ou déploiement.

## Registre des sources et limites initiales

| Source | Accès vérifié le 30/09 | Limite |
|---|---|---|
| Code local/Git | Lecture réussie, HEAD b45da39, arbre propre avant mission | PC/session requis ; pas d'écriture dans le checkout local durant cette mission |
| GitHub main | Lecture du commit b45da39 et de CORE-SYNC réussie | Une version GitHub ne prouve pas le déploiement |
| CORE-SYNC / core-state | Lectures locale et distante | Les tests qu'ils citent restent des preuves consignées, pas retestées ici |
| Référence Morice 3 | Document consolidé du 10 septembre lu | Privé ; ne pas le recopier ici |
| Morice 4/5 | Recherche ciblée effectuée, pas de contenu exploitable identifié | PARTIEL/INACCESSIBLE ; aucune décision spécifique inventée |
| 01 CORE / 04 SYNC / RADAR / Work | Recherche contextuelle partielle | Pas d'accès exhaustif aux chats ni de dernier résultat original garanti |
| Automatisations | Consignes/état/dernière exécution accessibles | L'historique complet des sorties n'a pas été récupéré |
| Runtime CORE / Microsoft / Google / OpenClaw | Routes et attestations techniques existantes | Accès authentifié/retest actuel à effectuer ; aucun diagnostic nouveau ici |
| MultipleChat | Projet et import Ready consignés ; documentation publique relue | API/MCP/CLI/webhook et collecte automatique des avis NON PROUVÉS |
| Stockage du bilan | Documentation GitHub et archive privée sauvegardables dans cette session | Écriture depuis tâche planifiée encore à prouver |

## Décisions de référence et contradictions

- S001 — VALIDÉ PAR ALAN le 30/09 : fusionner briefing/sync/RADAR dans 04 ; garder 02 séparé. Cette validation autorise documentation et automatisations, pas une refonte applicative.
- S002 — CONSERVER : Morice orchestre ; réutiliser les briques réellement testées, ne pas imposer une migration générale.
- S003 — CONSERVER : permissions sensibles imposées par le logiciel ; brouillons/validations ; crypto en lecture seule. Ne pas réactiver les demandes datées des archives.
- S004 — CONSERVER : code et preuves runtime datées priment sur les anciens récits d'implémentation ; dernières demandes explicites d'Alan priment pour les objectifs.
- C001 : « 04 n'est qu'une convention » corrigé par l'existence vérifiée de la tâche quotidienne ; cela ne prouve pas un transfert vers GitHub/MultipleChat.
- C002 : « RADAR quotidien actif » contredit par la programmation inspectée : tâche ponctuelle terminée/désactivée.
- C003 : CORE-SYNC n'interroge pas les services ; son générateur lit core-state.json. /api/core-sync produit des compteurs, pas un audit global.
- C004 : fichiers Ready dans MultipleChat et succès historiques de connexion ne prouvent pas leur lecture actuelle par plusieurs modèles.
- C005 : Morice 4/5 restent non consolidés faute de sources exploitables ; ne pas considérer leur absence comme un abandon de décisions.
- C006 : après publication documentaire, le checkout PC peut être derrière main. 02 doit contrôler la divergence avant reprise.

## RADAR de cette consolidation

Vérification limitée au mécanisme de briefing, sans revue nouvelle de tous les fournisseurs.
Sources relues : https://multiplechat.ai/help-guide ; https://multiplechat.ai/tools/ai-projects ; https://tools.multiple.chat/desktop-app/docs .
- MultipleChat Projects/import GitHub/Re-sync : DISPONIBLE ; CONSERVER l'import existant ; Re-sync manuel documenté.
- Compare Mode : DISPONIBLE ; TESTER la confrontation traçable avec deux modèles et récupération des réponses.
- API/MCP/CLI/webhook MultipleChat : accès NON CONFIRMÉ ; aucune classification DISPONIBLE inventée. Le Desktop BYOK utilise les API des fournisseurs, pas une API démontrée du plan Smart.
- Les pistes historiques de docs/TECHNOLOGIES-20260930.md restent à vérifier dans la prochaine collecte RADAR ; aucune installation déduite.

## Dossier de confrontation MC-SYNC-001

Statut : EN ATTENTE MULTIPLECHAT. Avis individuels : aucun récupéré. Synthèse : non produite.
Objet : choisir le transport minimal pour consulter MultipleChat et conserver les avis sans doubler 04.
État : protocole agentique externe, GitHub technique public, CORE privé distinct, import MultipleChat existant ; appel automatique non prouvé.
Options : conserver Re-sync/interface ; tester un accès officiel si documenté ; tester un navigateur authentifié borné si nécessaire. Ne pas acheter de nouvel outil/API.
Questions : quel accès réellement disponible au compte ? comment exporter au moins deux avis distincts ? comment dédupliquer les demandes et reprendre après erreur sans rejouer ? quel coût mesuré ? quelles données doivent rester privées ?
Pièces publiques à consulter : ce fichier, CORE-SYNC.md, docs/core-state.json, scripts/core-sync.mjs, routes core-sync/connections/openclaw pertinentes au commit examiné.
Critères : deux avis identifiables conservés après réouverture, même contexte technique, divergences sourcées, aucun secret, aucune écriture applicative.
Décision proposée : TESTER ; À VALIDER PAR ALAN pour tout nouveau transport/implémentation. Aucun travail architectural transmis à 02.

## Journal

### 2026-09-30 — consolidation initiale
Couverture : fichiers/automatisations/dépôt lus ; conversations partielles ; aucun nouveau test applicatif.
Périmètre validé : consolidation documentaire et des tâches uniquement.
Anciennes consignes et horaires archivés intégralement dans automations-before.json privé ; historiques ChatGPT conservés.
Tâches mises à jour et relues le 30/09 : 04 MORICE SYNC activée (tâche existante et calendrier quotidien conservés), Veille Morice désactivée, 03 RADAR désactivée. Aucun historique supprimé.
Statut de la nouvelle exécution quotidienne : PAS ENCORE TESTÉE. Persistance quotidienne : NON PROUVÉE.
Résultat initial persistant : ce dossier de synchronisation ; état technique applicatif inchangé.

### 2026-09-30T16:01:22.641Z — essai de reprise depuis Work
- Action réelle : lancement immédiat de 04 MORICE SYNC demandé et accepté par le planificateur ; calendrier inchangé.
- Vérification : protocole, CORE-SYNC et core-state lus depuis main. Aucun nouveau résultat original du planificateur récupéré ; fin d'exécution et persistance NON CONFIRMÉES. Ne pas relancer aveuglément.
- Accès local : exécution shell indisponible dans cette session ; aucun checkout modifié ni synchronisé ici. Le dernier état local vérifié reste b45da39, à recontrôler lorsque l'accès revient.
- Contrôle du navigateur/PC : aucun runtime de contrôle disponible dans la session ; appareil Desktop Commander signalé hors ligne. Confrontation MC-SYNC-001 bloquée, aucun avis IA reçu.
- Bilan de ce test enregistré par Work dans ce journal ; cette écriture ne prouve pas la persistance de la tâche planifiée.
- Reprise : récupérer le résultat de 04 lorsqu'il devient disponible ; utiliser une session PC accessible pour lire Git local et ouvrir le Project MultipleChat existant. Aucune refonte applicative autorisée.

### 2026-09-30 17:58 Europe/Paris — première exécution quotidienne fusionnée
Couverture : GitHub main `c1932aaa`, CORE-SYNC et core-state LU ; cinq fichiers applicatifs ciblés LU ; contexte récent Work/Claude PARTIEL ; Git local, runtime servi, diagnostics authentifiés et historique complet des chats INACCESSIBLES dans cette exécution. Dates de preuve applicative non renouvelées : les attestations de CORE-SYNC restent celles du 30/09.

Changements matériels :
- Persistance de la tâche fusionnée désormais PROUVÉE par cet ajout au journal ; cela ne prouve ni exécution du runtime Morice ni synchronisation automatique vers MultipleChat.
- MultipleChat : un fichier joint directement à un chat Claude a été lu correctement et les trois contrôles attendus ont été restitués. À l’inverse, le même fichier placé dans les fichiers du projet n’a pas été trouvé par ce chat. Cette preuve valide seulement le parcours manuel « pièce jointe directe → un modèle » ; elle ne valide ni Project Files, ni Re-sync automatique, ni API/MCP/CLI/webhook, ni collecte de plusieurs avis. `MC-SYNC-001` reste donc EN ATTENTE MULTIPLECHAT.
- Audit code au commit courant : les transitions atomiques `pending → executing` des actions et `queued → submitting` des recherches sont présentes ; les deux alertes de double exécution ont été retirées. Risque résiduel confirmé : si l’action externe réussit mais que la confirmation DB échoue, l’item peut rester `executing` et requiert une réconciliation sans renvoi automatique.
- Multi-comptes Microsoft : les requêtes de compte sont isolées par `user_id + account_id`, mais un compte secondaire n’est accepté que pour `mail_categorize`, `mail_triage` et `mail_read`. Calendrier, OneDrive, brouillons, envoi et To Do continuent d’utiliser le compte principal.
- Secrets : AES-GCM, clé 32 octets et IV aléatoire 12 octets confirmés dans `app/lib/secret-crypto.ts`. Le format stocké ne porte ni version ni identifiant de clé ; rotation/migration reste À TESTER, sans modification validée.

Contradictions : le premier audit Claude signalait deux risques de double exécution ; le code courant les contredit et Claude a retiré ces deux points après correction. Aucun autre conflit résolu.

RADAR filtré : aucun changement matériel plus récent que `docs/TECHNOLOGIES-20260930.md` retenu dans cette exécution ; ARTEMIS reste DISPONIBLE/À TESTER, sans installation, et ne remplace pas Tasker avant benchmark. Aucune licence, dépense, migration ou refonte validée.

Décisions : CONSERVER l’architecture et les garde-fous actuels ; AMÉLIORER ultérieurement la réconciliation `executing`, l’extension multi-comptes et la rotation de clé seulement après validation Alan. Aucun travail nouveau transmis à 02 ; `MC-SYNC-001` reste un TEST À VALIDER pour tout transport automatique.

### 2026-09-30 19:00 Europe/Paris — vérification de reprise Work
- Le journal de la première exécution fusionnée a été relu sur GitHub ; l’écriture du bilan par cette exécution est confirmée. Les mentions NON CONFIRMÉES des entrées précédentes décrivent leur état historique.
- Le planificateur indique 04 MORICE SYNC activée, dernière exécution le 30/09 à 18:02:55 Europe/Paris ; Veille Morice et 03 RADAR restent désactivées.
- Cette vérification ne prouve pas un accès au Git local, au runtime ou à MultipleChat. MC-SYNC-001 reste EN ATTENTE MULTIPLECHAT ; aucun nouveau travail applicatif autorisé.

### 2026-09-30 19:41 Europe/Paris — contrôle sans changement
Couverture : protocole, dernier journal, CORE-SYNC et core-state LU sur GitHub main `aa902ca` ; contexte accessible depuis le bilan de 19:00 PARTIEL ; Git local, runtime servi, diagnostics authentifiés, MultipleChat et historique exhaustif des conversations INACCESSIBLES. Aucun commit postérieur à `aa902ca` observé.

Aucun changement matériel. Aucune contradiction nouvelle, aucune nouveauté RADAR dédupliquée à retenir, aucune décision à valider et aucun nouveau travail transmis à 02. `MC-SYNC-001` reste EN ATTENTE MULTIPLECHAT. Aucun code fonctionnel modifié.


### 2026-09-30 21:03 Europe/Paris — clôture de consolidation et reprise DEV
- Contrôle direct du planificateur : 04 MORICE SYNC activée avec récurrence quotidienne ; Veille Morice et 03 RADAR désactivées. Le prompt de 04 lit le protocole commun et son dernier journal dans ce fichier.
- Le bilan persistant de 17:58 et les contrôles ultérieurs sont présents dans main. La consolidation documentaire et des automatisations est terminée ; cela ne constitue pas une connexion applicative directe RADAR vers CORE ni une API MultipleChat.
- Les anciennes mentions de persistance non prouvée dans CORE-SYNC/core-state sont historiques ; le statut courant est corrigé dans leur nouvelle section de reprise.
- Reprise DEV : lire automatiquement ce journal et CORE-SYNC au début du travail ; reprendre les vérifications et raccordements déjà prévus dans le périmètre validé. MC-SYNC-001 reste une dépendance pour les changements architecturaux concernés, pas un blocage global des lectures, diagnostics ou travaux existants autorisés.
- Ne pas déléguer à l’utilisateur le copier-coller des dossiers ou la collecte d’avis MultipleChat. En l’absence d’accès, conserver EN ATTENTE MULTIPLECHAT et poursuivre les tâches indépendantes accessibles.
- Limite recontrôlée : une commande shell en lecture seule échoue avec sandbox provisioning failed ; aucun contrôle Git local, navigateur ou diagnostic runtime réussi dans cette session. Aucun changement de conversation dans l’interface ni raccordement runtime revendiqué.

### 2026-10-01 19:57 Europe/Paris — reprise DEV confirmée et nouveau modèle à tester
Couverture : protocole, dernier journal, CORE-SYNC, core-state et TECHNOLOGIES LU sur GitHub main `ec804762` ; comparaison GitHub `58265006…ec804762` LU ; contexte Work récent PARTIEL ; Git local, version réellement servie, diagnostics authentifiés actuels, MultipleChat et historique exhaustif des conversations INACCESSIBLES dans cette exécution.

Changements matériels depuis le dernier bilan quotidien :
- La consolidation briefing/RADAR/synchronisation est terminée et 02 MORICE DEV a repris les travaux indépendants déjà validés. Alan a explicitement demandé de ne plus lui déléguer les copies ou manipulations intermédiaires ; cette consigne est déjà intégrée au passage DEV.
- Le dépôt a avancé d’un commit Sites jusqu’à `ec804762`. La comparaison prouve trois fichiers modifiés : `app/horizon.css`, `CORE-SYNC.md` et ce journal. Le compagnon secondaire a été agrandi ; l’ancien logo officiel est conservé. Les preuves consignées indiquent TypeScript, 83 tests et build réussis, mais la vérification visuelle PC/Fold n’a pas été renouvelée.
- Diagnostic OpenClaw consigné après reprise : version 2026.8.1, nœud Android connecté et `device.status ok=true`; aucune commande téléphone exécutée.
- Runtime : des routes récentes ont répondu HTTP 200, mais les lectures directes via le mécanisme disponible ont répondu HTTP 401. Ne pas transformer ces statuts en preuve de lecture complète des boîtes. Ce blocage reste à diagnostiquer dans 02.
- `MC-SYNC-001` reste EN ATTENTE MULTIPLECHAT et ne bloque pas les travaux indépendants déjà autorisés.

RADAR filtré :
- OpenAI a annoncé GPT-6.1 Sol le 29 septembre 2026, DISPONIBLE dans ChatGPT Work et Codex pour Plus, Pro, Business, Enterprise et Edu, ainsi que par API sous `gpt-6.1-sol`; il n’est pas encore disponible dans Chat. Prix API officiels : 2 $/million de jetons en entrée, 0,10 $ en entrée mise en cache et 10 $ en sortie. Source : https://openai.com/index/introducing-gpt-6-1-sol/
- Gain potentiel Morice : meilleur compromis capacité/coût pour développement, audits et workflows complexes, sans consommer automatiquement les quotas MultipleChat. Disponibilité publique et accès du runtime Morice restent distincts.
- Work IQ reste en preview avec déploiement commencé le 30 septembre et poursuivi en octobre ; aucune licence/activation du compte Morice n’est prouvée. Conserver Microsoft Graph. Source : https://www.microsoft.com/en-us/dynamics-365/blog/it-professional/2026/09/25/work-iq-business-and-workplace-intelligence-in-the-flow-of-work/
- Aucun changement officiel matériel retenu pour MultipleChat, ARTEMIS, Tasker, Make, Claude, Gemini ou Grok.

Dossier `OAI-ROUTE-001` — statut TESTER / À VALIDER :
Problème : choisir si GPT-6.1 Sol doit compléter le routage actuel pour les tâches complexes. Options : conserver les modèles actuels ; tester GPT-6.1 Sol sur un petit corpus DEV/audit ; le remplacer globalement. Recommandation : test borné uniquement, avec qualité, coût réel, latence, disponibilité du catalogue du compte et retour arrière vers la route actuelle. Aucun remplacement global, achat ou changement de fournisseur autorisé par cette veille.

Contradictions : les mentions historiques « persistance non prouvée » sont dépassées par les écritures vérifiées ultérieures ; elles restent conservées comme historique. Aucune autre contradiction nouvelle.

Transmission 02 : poursuivre les diagnostics et raccordements existants, notamment le HTTP 401 et la vérification visuelle/Fold. Aucun nouveau travail architectural transmis tant que `OAI-ROUTE-001` n’est pas validé par Alan. Aucun code fonctionnel modifié par 04.

## Reprise 02 — MORICE DEV

1. Lire ce protocole et CORE-SYNC ; vérifier HEAD local/main et les changements non commités avant toute mise à jour du checkout.
2. Exécuter « Va te briefer » selon la section Protocole commun ; compléter les sources manquantes, sans réécrire l'historique.
3. Le premier bilan de la tâche fusionnée et son écriture dans ce journal sont confirmés ; vérifier les changements depuis cette preuve et les sources encore inaccessibles. Les droits/outils du planificateur peuvent différer de Work.
4. L’agent traite MC-SYNC-001 lorsque son accès MultipleChat est opérationnel et conserve les avis réels. Sans accès, laisser ce dossier en attente et poursuivre les diagnostics/raccordements indépendants déjà autorisés ; ne pas demander à l’utilisateur de copier-coller le dossier.
5. Aucune refonte ni installation applicative n'est validée. Demander une décision uniquement après dossier concret et confrontation pour les changements importants.

### 2026-09-30 — reprise DEV, compagnon agrandi et accès réels
- Main distant 582650060e8de238d2b10def2716929feb5bb0c9 lu; copie de travail auparavant b45da39 mise à jour en fast-forward, sans changements locaux perdus.
- docs/MORICE-SYNC.md et CORE-SYNC.md lus avant modification. MC-SYNC-001 reste en attente uniquement pour les changements architecturaux concernés.
- Modification explicitement demandée : compagnon secondaire nettement agrandi, ligne dédiée à l’accueil et doublement en conversation; logo principal conservé. Aucune migration ni nouvelle permission.
- Accès code/GitHub/Sites owner privé confirmé. Contrôle du navigateur échoue après relance; vérification visuelle PC/Fold non renouvelée dans cette reprise.
- Logs runtime récents : assistant, calendrier Microsoft, connexions et travaux HTTP 200. Ces statuts ne prouvent pas la lecture complète de toutes les boîtes.
- Lectures directes authentifiées par le mécanisme Sites disponible : API applicative HTTP 401; aucun contenu privé ni secret affiché, aucun droit élargi. Tests des boîtes non renouvelés.
- Briefing quotidien : conserver la tâche fusionnée 04 existante; aucune seconde veille créée, aucun déclenchement répété.
- Ledger différée par Alan. Aucun achat, envoi, tri massif ou commande téléphone effectué.
- Diagnostic local OpenClaw 2026.8.1 renouvelé : nœud Android connecté, device.status ok=true. Lecture seule; aucun ordre application, micro ou message.
- Validation de la correction : TypeScript, 83 tests et build réussis. Vérification visuelle actuelle non disponible, navigateur de contrôle en erreur.
