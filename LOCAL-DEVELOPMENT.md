# Morice local

L’application active est à la racine. Les anciennes copies `morice/` et
`morice/morice/` sont conservées mais exclues de Git, TypeScript, ESLint et de
la recherche des classes CSS. Aucun fichier important n’a été supprimé.

Le verrouillage canonique est `pnpm-lock.yaml`, suivi par le dépôt d’origine.
`packageManager` fixe pnpm 11.19.0. Le verrou npm précédent est sauvegardé hors
du dossier applicatif ; ne pas alterner les gestionnaires.

Démarrage : `pnpm dev --port 3431`. Les migrations concernent D1 local seulement.
Le serveur est limité à la boucle locale. Cloudflare/Vinext est requis pour
les bindings des API. `vinext start` sous Node seul ne les reproduit pas.

Contrôles : `pnpm run typecheck`, `pnpm run lint`, `pnpm test`.
Types : `pnpm run cf:types`, à partir de `wrangler.types.jsonc` sans secrets.

La reconnaissance vocale exige un service navigateur disponible et une
autorisation microphone. Les tests simulés ne remplacent pas une dictée humaine.
