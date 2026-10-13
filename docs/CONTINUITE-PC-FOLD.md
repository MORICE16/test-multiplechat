# Continuité Morice — PC et réparation du Fold

## État vérifié le 14 octobre 2026

- Le site privé existant conserve son identité et ses données serveur. Les lectures Outlook/agenda et la mémoire ont été vérifiées depuis le runtime dans le lot précédent, après reconnexion et rechargement.
- Le téléphone n'est pas détecté par ADB au contrôle de ce lot. Aucun inventaire ni sauvegarde du Fold n'est donc confirmé.
- Le code du projet a une sauvegarde Git locale privée; elle ne sauvegarde ni le téléphone, ni ses photos, ni ses moyens d'authentification, ni la base de données hébergée.
- Les réponses IA générales restent indisponibles sans transport officiel autorisé. Aucune activation d'API payante prévue.

## Avant toute remise à zéro — validation humaine nécessaire

1. Vérifier une connexion Microsoft, Google et OpenAI depuis le PC avec un moyen indépendant du Fold. Une session déjà ouverte ne prouve pas la récupération après déconnexion; ne pas fermer la seule session fonctionnelle avant d'avoir établi le secours.
2. Dans Microsoft Authenticator sur le Fold : Paramètres → Sauvegarde cloud. Vérifier le compte de récupération et la sauvegarde. Les comptes professionnels et la connexion sans mot de passe peuvent demander un nouvel enregistrement après restauration; cette sauvegarde seule ne suffit pas.
3. Conserver les codes de secours Google en privé, hors du téléphone à réinitialiser. Ne les transmettre ni à Morice, ni à un dépôt, ni dans un rapport.
4. Utiliser Samsung Smart Switch sur PC : connecter et déverrouiller le téléphone, autoriser le transfert, choisir Sauvegarder et vérifier le bilan terminé. Contrôler spécialement photos/documents nécessaires au travail; ne pas supposer que toutes les données d'applications sont transférées.
5. Conserver l'ancienne configuration Tasker/OpenClaw et l'application privée, si présentes et exportables, dans un emplacement privé. Aucun export automatique réalisé dans ce lot.

## Pendant la réparation

Ouvrir le même site Morice sur le PC avec le même compte propriétaire. Les droits Microsoft/Google conservés côté serveur peuvent continuer tant que leurs jetons restent valides; une demande de reconnexion reste possible. Les fonctions qui nécessitent Android restent indisponibles. Ne pas révoquer arbitrairement les connexions serveur.

## Après restauration

Rétablir les moyens d'authentification, ouvrir le site avec le même compte, puis vérifier mémoire, messages et pièces jointes serveur. Réinstaller le widget/application si nécessaire. Refaire l'appairage Android/OpenClaw avec confirmation humaine; ne pas annoncer le contrôle du téléphone avant une action inoffensive vérifiée.

## Sources officielles

- Samsung : https://www.samsung.com/fr/support/mobile-devices/sauvegarder-les-donnees-de-mon-smartphone-sur-pc-ou-mac/
- Microsoft : https://support.microsoft.com/fr-fr/authenticator/back-up-your-accounts-in-microsoft-authenticator
- Google : https://support.google.com/accounts/answer/1187538?hl=fr
