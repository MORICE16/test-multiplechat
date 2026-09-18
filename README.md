# Morice — reprise fonctionnelle du 18 septembre 2026

## Travaux, recherche et lecture vocale

- `web_search` lance une vraie recherche OpenAI en arrière-plan avec l’accès serveur existant. La requête et l’identifiant fournisseur sont conservés dans D1. Aucun nouvel envoi automatique après une soumission ambiguë.
- `POST /api/jobs` récupère les réponses existantes, sans répéter la génération. Le navigateur vérifie toutes les 15 secondes lorsqu’il est visible, à sa réouverture et au retour du réseau. Une tâche jamais soumise peut être reprise; une soumission interrompue sans identifiant est bloquée après deux minutes.
- Un résultat n’est marqué terminé qu’après réponse complète, appel Web effectué et citations valides. Les sources sont cliquables. Cela prouve l’exécution de l’outil, pas l’exactitude absolue des pages externes.
- Les lectures Microsoft déclenchées dans la conversation ont aussi un journal d’exécution et un résultat durable.
- Les travaux longs nécessitent `background: true` et `store: true` chez OpenAI. Le résultat récupéré est ensuite conservé dans D1. Un résultat fournisseur expiré reste signalé, sans nouvelle dépense automatique.
- Le lecteur de réponse appelle `/api/speech` à la demande : MP3, lecture/pause, déplacement, sauts de 10 secondes et vitesses ×1/×1,5/×2. Les réponses longues sont réparties sans troncature en passages de 3 500 caractères maximum, générés au fil de la lecture. Le passage et la position sont conservés dans l’onglet, y compris après rechargement, sans reprise sonore automatique. Seule la position (clé dérivée par SHA-256, pas le texte ni l’audio) est enregistrée dans `sessionStorage`; sa fermeture peut effacer cette reprise. Après rechargement, l’audio est régénéré sur clic et la position restaurée est approximative si la durée de la nouvelle voix diffère. Trois passages audio maximum restent en mémoire par lecteur. L’API conserve sa limite de sécurité de 4 000 caractères par requête. Voix synthétique explicitement indiquée.
- Veille et améliorations rassemble les exigences et pistes du fil historique, avec état et justification. Ce catalogue versionné ne constitue pas une synchronisation automatique des futurs messages.
- Migration additive `0003_jobs.sql`; tables existantes inchangées.

### Limites à ne pas masquer

La récupération des recherches est déclenchée par l’application ouverte; il n’existe pas encore de planificateur cloud ni de notification de fin indépendante de la consultation. OpenClaw est sain sur le PC, mais le site n’y est pas relié et le Z Fold était déconnecté lors de l’audit du 18 septembre. MultipleChat Smart a été vérifié connecté; aucun écran API n’a été trouvé dans les paramètres. Aucun pont automatique vers ses modes ou vers les plugins ChatGPT n’est déclaré actif. Le classement de cinq ou six comptes mail, les rappels/alertes planifiés, la galerie et le formulaire Avisun restent à développer ou à raccorder.

Sources techniques : [recherche Web](https://developers.openai.com/api/docs/guides/tools-web-search), [exécution en arrière-plan](https://developers.openai.com/api/docs/guides/background), [voix](https://developers.openai.com/api/docs/guides/text-to-speech), [limites des Workers](https://developers.cloudflare.com/workers/platform/limits/).

## Fiabilité et continuité de conversation

- Les échanges réussis sont sauvegardés dans D1 et restaurés après rechargement
  sur les appareils du même compte. L’interface charge les 40 derniers messages ;
  le modèle reçoit au plus 16 messages récents et 30 tâches/mémoires (16 000 caractères).
- Les mémoires enregistrées servent de contexte, pas d’autorisation d’exécution.
  Les tâches et actions restent pilotées par les contrôles côté serveur.
- Une perte de réponse externe classe l’action « Résultat à vérifier » et bloque
  sa relance. Seul un échec certain avant envoi ou un refus HTTP explicite peut
  rendre une action à nouveau validable. Une confirmation perdue en base laisse
  l’action verrouillée et visible, sans relance automatique.
- Les validations affichent les paramètres exacts et le résultat enregistré.
  Outlook/Make peuvent accepter une demande sans avoir terminé son traitement ;
  l’interface distingue cette acceptation du résultat final.
- Connexions permet de vérifier la lecture Microsoft directement, sans dépendre
  de l’analyse IA. Cette vérification ne crée aucun objet externe.
- Emails et Agenda affichent les données Microsoft réelles avec la date de
  vérification et un bouton Actualiser. Les messages restent dans leur état lu/non lu.
- La migration additive `0002_conversation_history.sql` crée seulement l’historique.
  Les deux migrations déployées précédemment restent inchangées.
- Les tests backend utilisent les vraies routes et une base SQLite, avec des
  réponses fournisseurs simulées : concurrence, isolation, panne réseau,
  confirmation perdue, historique et absence d’action sur erreur IA.

Références d’implémentation : [Responses et historique](https://developers.openai.com/api/docs/guides/text),
[acceptation Outlook](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0),
[API OpenClaw](https://docs.openclaw.ai/gateway/openresponses-http-api).

Les tests historiques ci-dessous décrivent la campagne du 10 septembre.

Projet applicatif réel : `C:\Users\alan_\Documents\morice`. React 19, TypeScript,
Vinext/Vite, Tailwind et Cloudflare Workers/D1. L’interface conserve le logo
rottweiler original et l’identité sombre et orange.

## Développement

Node.js 22.13 ou supérieur et **pnpm 11.19.0**. Le dépôt d’origine suit
`pnpm-lock.yaml` et `pnpm-workspace.yaml` ; `packageManager` fixe cette version.
Le verrou npm de l’installation précédente est sauvegardé hors du projet actif.
Les dépendances applicatives n’ont pas été changées par cette révision.

```sh
pnpm install --frozen-lockfile
pnpm dev --port 3431
```

Le démarrage applique les migrations à D1 **localement**. Le serveur est limité
à la boucle locale et conserve son état dans `.wrangler/`. Le moteur Cloudflare
de développement est nécessaire ; un serveur Node sans bindings ne suffit pas.
Les anciennes copies `morice/` et `morice/morice/` restent sur disque, exclues
de Git, TypeScript, ESLint et de la détection des classes CSS.

```sh
pnpm run cf:types
pnpm run typecheck
pnpm run lint
pnpm test
```

`pnpm test` compile puis exécute les tests ; `pnpm run test:unit` lance seulement
les tests. Les types Cloudflare sont générés dans `worker-configuration.d.ts`
depuis `wrangler.types.jsonc`, une configuration sans variables applicatives.

## Interface et dictée

Accueil, conversation, messages, navigation ordinateur/mobile et bouton
Dicter/Arrêter ont été repris. L’historique de conversation affiché vit dans
la session de la page ; ce n’est pas une mémoire conversationnelle persistante.

La dictée utilise `SpeechRecognition`/`webkitSpeechRecognition`, avec résultats
provisoires et définitifs. Elle n’utilise pas `MediaRecorder` et ne téléverse pas
d’enregistrement vers les routes Morice. Le service vocal du navigateur peut
néanmoins dépendre de son fournisseur et d’une connexion Internet.

- Un clic démarre ; l’arrêt manuel attend les derniers résultats du navigateur.
- Une fin automatique relance l’écoute. Des sessions silencieuses répétées
  espacent progressivement les reprises de 0,5 à 8 secondes.
- Un onglet masqué ou un passage hors ligne suspend la session. Le retour au
  premier plan avec réseau reprend une écoute demandée, sauf après arrêt manuel.
- Les résultats utiles déjà reçus sont conservés après erreur ou interruption.
  Une session sans démarrage expire après 15 secondes ; trois échecs réseau
  consécutifs affichent une erreur explicite et demandent de relancer.
- Les clics répétés et callbacks d’anciennes sessions ne créent pas de sessions
  concurrentes. Les permissions refusées sont signalées près du microphone.

## Identité et hébergement

L’hébergement existant est Sites, identifié par `.openai/hosting.json`. Son
contrôle d’accès privé est conservé. Les en-têtes d’identité sont ceux de cette
passerelle authentifiée ; ils ne constituent pas une authentification autonome
sur un autre hébergement.

Le middleware refuse les API sans identité avec HTTP 401. Le secours `alan`
existe uniquement en développement, pour une URL et un hôte de boucle locale,
sans transfert externe (l’en-tête local ajouté par Vinext doit correspondre
exactement à l’hôte). Il est interdit en production. Chaque identité
authentifiée conserve son propre espace de données. `app/chatgpt-auth.ts`
conserve ses redirections de connexion limitées aux chemins du site.

La connexion Microsoft demande les mêmes permissions que la version déjà
hébergée : `Mail.Send` et `Calendars.ReadWrite` ont été retirées de la copie
locale avant publication ; `Calendars.Read` est conservée. L’envoi de mails et
la création de rendez-vous ne sont donc pas validés par cette livraison.

Les fichiers privés `.env*`, `.dev.vars*`, jetons, bases locales et clés restent
exclus de Git et de la publication. Ils ne doivent pas être copiés dans `public/`
ni dans les variables publiques du navigateur. Cette révision ne lit ni ne
modifie leurs valeurs. Changer d’hébergeur exige une passerelle d’authentification
adaptée, avant toute exposition de données.

## Vérifications du 10 septembre 2026

Les tests automatisés couvrent les résultats vocaux simulés, la reprise, l’arrêt,
les erreurs, les clics rapides, la pause et l’isolation de l’identité. Ils ne
constituent pas une dictée humaine. Le test de sources contrôle aussi les PNG
du logo et la présence des routes ; il ne prouve pas la connexion aux services.

Lors de l’essai réel dans le navigateur intégré, le microphone a atteint
« Écoute en cours » et l’arrêt manuel a répondu. Le service vocal a aussi renvoyé
des erreurs réseau ; un nouvel essai n’a pas démarré et a affiché son erreur
après 15 secondes en conservant le texte. **Aucun essai vocal humain prolongé
réussi n’est attesté.**
La transcription effective, les silences et la dernière phrase restent à
essayer en parlant dans Chrome ou Edge sur le poste et sur le téléphone.

Aucune action Microsoft, Make ou OpenAI réelle n’est déclenchée par cette
campagne. Les menus existants ne prouvent pas que les connecteurs sont reliés.
Les résultats exacts de compilation, tests, types, contrôle visuel et routes
ont été vérifiés : compilation réussie, TypeScript sans erreur, 15 tests réussis
sur 15, ESLint sans erreur avec 5 avertissements sur les balises `img`. Vinext
signale également la convention `middleware` dépréciée, encore prise en charge.
Accueil et API locales `state`/`connections` répondent HTTP 200 ; une requête
avec transfert externe est refusée HTTP 401. Le site privé refuse également
HTTP 401 les accès anonymes et les en-têtes d’identité forgés. Contrôle visuel
effectué à 1440 et 390 pixels, sans débordement horizontal ; six PNG du logo
comparés par SHA-256, aucun changement.

Références : [écoute continue](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/continuous),
[fin d’une session](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/end_event),
[types Cloudflare](https://developers.cloudflare.com/workers/languages/typescript/).
