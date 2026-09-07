# Morice — sources

Export du projet local MoriceOnline du 7 septembre 2026, y compris les modifications
locales non commitées. Ce ZIP n'est pas une sauvegarde des données de production et
ne garantit pas que chaque fichier correspond à la dernière version publiée.

L'application utilise React 19, TypeScript, Vinext/Vite, Tailwind et les API
Cloudflare Workers avec une base D1. Ce n'est pas une simple application React
statique : son serveur et ses migrations sont inclus.

## Démarrage local

Prérequis : Node.js 22.13 ou supérieur (le contrôle des sources a utilisé Node.js 24),
npm, et un accès Internet pour télécharger les dépendances. Décompresser le ZIP,
puis ouvrir un terminal dans le dossier `morice`, qui contient `package.json`.

```bash
npm install
npm run dev
```

Le script `predev` applique automatiquement les migrations SQL à la base D1
**locale**, puis lance Vinext. Ouvrir l'adresse Local affichée dans le terminal
(généralement `http://localhost:5173`). Arrêter avec Ctrl+C.

Aucun compte Cloudflare ni aucune clé API n'est nécessaire pour ouvrir l'interface
et utiliser son stockage local. Les services externes restent non configurés sans
vos propres identifiants. La base locale est conservée dans `.wrangler/` ; elle est
neuve et ne contient aucun e-mail, jeton OAuth ou historique du site en ligne.

Le projet original emploie pnpm : son `pnpm-lock.yaml` et sa configuration sont
conservés. Un `package-lock.json`, s'il est présent, correspond à la résolution npm
testée pour cet export. Éviter d'alterner les gestionnaires dans la même installation.

## Variables d'environnement — facultatif

Le modèle `.env.example` contient uniquement les noms des variables, des valeurs
publiques de configuration et des champs vides. Pour le serveur Cloudflare local,
copier ce fichier vers `.dev.vars`, puis renseigner uniquement les services souhaités.

PowerShell :

```powershell
Copy-Item .env.example .dev.vars
```

macOS / Linux :

```bash
cp .env.example .dev.vars
```

Redémarrer le serveur après modification. Ne jamais mettre ces secrets dans les
composants React, le dossier `public`, ou des variables `VITE_*` / `NEXT_PUBLIC_*`.
`.dev.vars` et les fichiers `.env` privés sont ignorés par Git.

| Variable | Usage |
| --- | --- |
| `OPENAI_API_KEY` | Appels serveur à l'API OpenAI. |
| `OPENAI_MODEL` | Modèle demandé par le code actuel ; à adapter aux modèles accessibles à votre compte. |
| `MORICE_ENCRYPTION_KEY` | Clé AES-GCM de 32 octets en base64 pour chiffrer les jetons Microsoft en base. |
| `MICROSOFT_CLIENT_ID` | Identifiant de votre propre application Microsoft. |
| `MICROSOFT_CLIENT_SECRET` | Secret serveur de cette application. |
| `MICROSOFT_TENANT_ID` | `common` par défaut dans les sources. |
| `MAKE_WEBHOOK_URL` | Webhook Make facultatif ; à traiter comme un secret. |

Pour Microsoft, configurer dans votre application Entra l'URI de retour exacte
`http://localhost:PORT/api/microsoft/callback`, avec le port réellement utilisé.
Les autorisations OAuth et les comptes ne sont pas transférés par ce ZIP.
Ne jamais remplacer une clé de chiffrement existante sans plan de migration des
jetons qu'elle protège.

## Commandes complémentaires

```bash
npm run build
npm test
npm run lint
npm run db:migrate:local
```

`npm test` compile l'application puis lance les tests de sources existants. Ces
tests ne prouvent pas à eux seuls une connexion réelle à Microsoft, OpenAI,
OpenClaw, Make ou au téléphone. `npm run start` est le script original de lancement
après compilation ; le parcours de développement prévu est `npm run dev`.

## Contenu

- `app/` : pages, composant principal, styles, utilitaires et routes API.
- `public/` : logos et icônes, manifeste PWA et service worker.
- `worker/`, `build/`, `vite.config.ts` : serveur et compilation Cloudflare/Vinext.
- `db/`, `drizzle/` : schéma et migrations SQL, sans données de production.
- `tests/` : tests existants.
- `.openai/hosting.json` : métadonnées d'origine Sites et binding `DB` ; aucun secret.
- `wrangler.local.jsonc` : configuration de migration D1 exclusivement locale.

L'identifiant Sites conservé est une métadonnée, pas un identifiant de connexion.
Cet export n'autorise ni ne déclenche aucune republication du site d'origine.

## Sécurité et limites

Le site hébergé repose sur son environnement d'authentification Sites. Les sources
emploient des en-têtes d'identité fournis par cet environnement et un utilisateur
de secours local. **Ne pas exposer directement ce serveur de développement sur
Internet ou sur un réseau non fiable.** Un hébergement différent nécessite une
authentification et une vérification d'accès adaptées avant toute utilisation réelle.

Les menus et routes présents ne signifient pas que tous les connecteurs fonctionnent.
L'accès hébergé à OpenClaw, les intégrations Android et les connexions aux comptes
nécessitent leur configuration et des tests dédiés ; rien n'a été raccordé par cet export.

Exclus du ZIP : `.git/`, `node_modules/`, `.env.local`, autres fichiers de secrets,
état `.wrangler/`, bases de données locales, journaux, caches et sorties compilées.
Le contrôle de l'export recherche les formats usuels de clés/jetons, les mots de
passe littéraux et les valeurs secrètes présentes dans les fichiers d'environnement
locaux. Aucun secret détecté n'est accepté dans l'archive ; ce contrôle n'est pas
un audit de sécurité exhaustif de l'application.

Les ajouts de cet export concernent uniquement ce README, le modèle d'environnement,
la règle d'exclusion `.dev.vars`, la commande d'initialisation D1 locale et sa
configuration. Les fichiers applicatifs et les assets sont conservés sans modification.

## Vérifications effectuées sur cet export

- Contrôle des secrets : aucun résultat détecté dans les fichiers exportés.
- Comparaison avec les fichiers applicatifs locaux d'origine : identiques.
- `node --test tests/morice-source.test.mjs` : 1 test réussi, 0 échec.
- `npm install` : non validé, accès au registre npm refusé par l'environnement
  d'export (`EACCES`). Le téléchargement a été arrêté ; aucune dépendance partielle
  ni aucun dossier `node_modules` n'est inclus.
- Compilation, migrations locales et `npm run dev` : non validés dans cet
  environnement ; les dépendances locales de secours n'étaient pas utilisables.

Les commandes ci-dessus constituent les instructions de démarrage, pas une preuve
d'installation déjà réussie. Aucune connexion externe n'a été testée ou modifiée.
