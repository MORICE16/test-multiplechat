# Outlook — lecture par lots

Le parcours Emails peut demander les métadonnées de cent messages par lot et naviguer vers une suite fournie par Microsoft. Le périmètre Tous les dossiers n'a pas de date de début et inclut réception, envoyés, brouillons, indésirables et éléments supprimés. Le contenu intégral et les pièces jointes ne sont pas demandés.

Les liens de suite sont conservés dans les réglages serveur privés par propriétaire, compte, identité courante et périmètre. Le navigateur reçoit un UUID, le numéro de lot et des références précédent/suivant. Les liens privés expirent après trente minutes ; cent références actives maximum par propriétaire, plafond atomique sans éviction. Une référence expirée ou étrangère ne retombe jamais sur le compte ou le premier lot par défaut.

Chaque URL fournisseur est validée au stockage et à la relecture : HTTPS Graph officiel, chemin attendu, projection exacte des métadonnées, paramètres du périmètre conservés, continuation connue et aucun doublon de paramètre. Le lien fourni est réutilisé entier ; aucun offset deviné ou jeton reconstruit. Les redirections Graph sont refusées. Les lectures de chaque lot partagent un délai de vingt-cinq secondes avec le rafraîchissement OAuth.

Les valeurs `private_*` sont exclues de l'API générale des réglages et ne sont pas modifiables par celle-ci. Aucun nextLink ou jeton de continuation dans les réponses publiques, actions ou erreurs. Les propositions et messages affichés restent des données, sans exécution ni interprétation de leur contenu.

La préparation d'un classement relit le même lot et contrôle que ses messages sélectionnés y figurent. La validation existante reste limitée à dix messages, puis l'exécution relit les messages et leurs catégories. Naviguer ne classe aucun message. La sélection est effacée au changement de lot, compte ou filtre ; les réponses de lecture dépassées sont ignorées.

Le courrier peut changer entre deux pages. Aucun compteur cumulé n'établit un nombre de messages uniques ou une boîte entièrement classée. Sans suite fournie et validable, le résultat reste partiel. Un rechargement complet recommence le parcours ; ce mécanisme n'est pas un index permanent des trente mille messages.

Revue Claude MC-MAIL-PAGES-20261019 obtenue dans MultipleChat sur la description, pas le code final. Isolation, plafond atomique, protection des réglages, refus des redirections et sélection liée au lot retenus. Suggestion de reconstruire les paramètres non retenue : Microsoft demande de réutiliser l'URL complète de continuation.

Tests automatisés : URL hostile, projection modifiée, paramètres dupliqués, compte/identité/propriétaire/périmètre, expiration, plafond concurrent, fuite, page incomplète, préparation sur le bon lot et réglages privés. Les transports Graph sont substitués ; les tests ne prouvent pas la pagination d'une vraie boîte. La preuve en production est consignée séparément dans MORICE-SYNC.

Sources officielles consultées :
- https://learn.microsoft.com/en-us/graph/paging
- https://learn.microsoft.com/en-us/graph/api/user-list-messages?view=graph-rest-1.0
- https://learn.microsoft.com/en-us/graph/query-parameters
