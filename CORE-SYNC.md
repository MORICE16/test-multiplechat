# CORE-SYNC — MORICE

Généré : 2026-09-30T01:04:00.543Z
Commit source au moment de la génération : `d4a459d66dacb26abe0266e40dabf317e7c0950c`

Ce fichier est un instantané technique publiable. Il exclut les messages, fichiers privés, comptes et secrets. Le commit qui contient cet instantané peut être ultérieur au commit source indiqué.

## Décisions nouvelles

- Conserver le projet, le logo et le site privé existants.
- Conserver Graph tant que Work IQ et sa licence ne sont pas confirmés pour le compte.
- Utiliser l’import GitHub et Re-sync natifs de MultipleChat avant tout pont personnalisé.
- Analyser les pièces jointes sans exécution de leurs instructions ni action externe.

## Implémenté

- Nouvelle idée : images et PDF, aperçu, retrait, caméra Android et dépôt PC.
- Stockage R2 privé, métadonnées D1 avec propriétaire et SHA-256.
- Analyse Responses en arrière-plan, identifiant conservé et récupération sans nouvelle soumission.
- Trace du modèle, exécutant, action et résultat dans Travaux.
- Générateur versionné CORE-SYNC et export technique du journal sans données privées.

## Tests

- Preflight : 71 tests réussis et build réussi avant modification.
- Les preuves de la nouvelle version sont détaillées dans le Sync Pack; aucune simulation ne prouve une connexion réelle.

## En cours

- Vérification de la nouvelle chaîne sur le vrai site privé avec une image et un PDF synthétiques.

## À faire

- Routage de tous les modules selon capacités, difficulté et échecs, au-delà du choix limité du modèle d’analyse.
- Import du CORE privé complet avec un parcours de consentement et stockage séparé.
- Validation physique de la caméra et du microphone sur Fold.
- Preuves runtime Microsoft et diagnostic OpenClaw; mise à niveau après sauvegarde et compatibilité.

## Blocages connus

- Work IQ : aucune activation de tenant ou licence confirmée.
- MultipleChat : API publique de re-sync non confirmée; connexion actuelle du Project à vérifier.
- Accès complet au téléphone et aux autres boîtes mail non prouvé.

## Prochaines actions

- Tester les pièces jointes et l’analyse avec preuve de persistance.
- Vérifier chaque service Microsoft depuis le runtime.
- Importer le Sync Pack dans CORE et le Project MultipleChat.

## Fichiers modifiés lors de la génération

- .openai/hosting.json
- CORE-SYNC.md
- app/api/core-sync/route.ts
- app/api/files/[id]/route.ts
- app/api/files/route.ts
- app/api/ideas/route.ts
- app/api/jobs/route.ts
- app/api/microsoft/health/route.ts
- app/components/horizon-journal.tsx
- app/components/idea-composer.tsx
- app/components/jobs-panel.tsx
- app/globals.css
- app/lib/attachment-validation.ts
- app/lib/idea-analysis.ts
- app/lib/idea-result.ts
- app/lib/jobs.ts
- app/lib/microsoft-health.ts
- app/lib/microsoft.ts
- app/lib/model-router.ts
- app/lib/web-result.ts
- app/morice-app.tsx
- db/schema.ts
- docs/TECHNOLOGIES-20260930.md
- docs/core-state.json
- drizzle/0005_organic_triathlon.sql
- drizzle/meta/0005_snapshot.json
- drizzle/meta/_journal.json
- package.json
- scripts/core-sync.mjs
- tests/idea-files.test.mjs
- tests/jobs-voice.test.mjs
- worker-configuration.d.ts
- wrangler.local.jsonc

## Reprise MultipleChat

Importer le dépôt GitHub existant, branche main, puis CORE-SYNC.md. Utiliser Re-sync dans le Project. Aucune API publique de synchronisation automatique n’a été confirmée. Ne pas importer le CORE privé complet dans un dépôt public.
