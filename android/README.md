# Morice Android 1.1.0

Reprise de l'application privée fr.alan.morice 1.0.2, avec le même identifiant et la même signature pour la mise à jour.

- Accueil clair bleu/turquoise ; logo officiel inchangé.
- Widget redimensionnable avec la tête de Morice, ajoutable depuis l'application ou la liste des widgets Android.
- Un appui ouvre la dictée Android disponible sur l'appareil. Son fournisseur dépend des réglages du téléphone.
- Le texte reconnu ouvre Morice comme brouillon, sans envoi automatique. Il est transporté dans le fragment de l'URL (pas dans la requête au serveur), puis retiré de la barre d'adresse par le site.
- Le navigateur conserve la session d'authentification existante. Première connexion éventuelle à effectuer avec le compte personnel autorisé.
- Annuler la dictée ferme le parcours sans créer de demande. Aucune écoute permanente.

## Compilation

JDK 17, Gradle 9.5, SDK Android 36 / build-tools 36.0.0. Exécuter assembleRelease et lintRelease depuis ce dossier. Configurer ANDROID_HOME et JAVA_HOME localement. Le résultat doit ensuite être signé avec la clé privée existante, hors dépôt. Aucun secret de signature n'est inclus.

## Vérification sur Z Fold

Installer la mise à jour sans désinstaller l'application précédente. Ouvrir Morice et choisir Ajouter le widget à l'accueil. Android demande de confirmer son emplacement. Toucher la tête, dicter une phrase, vérifier le brouillon et envoyer. Vérifier aussi l'annulation, les permissions micro et les écrans plié/déplié.
