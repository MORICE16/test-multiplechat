# Passerelle locale OpenClaw en lecture seule

Préparation du futur raccordement privé de MORICE. **Ce dossier ne connecte pas le site au PC.** Aucun tunnel, service Windows, port d’écoute ou autorisation distante n’est créé à son lancement.

Deux outils seulement :

- `morice_openclaw_health` : GET fixe sur `http://127.0.0.1:18789/healthz`, sans jeton, sans redirection, délai de cinq secondes et réponse limitée à 16 Kio.
- `morice_openclaw_nodes` : commande fixe `nodes status --json` via le programme OpenClaw existant. La réponse ne conserve que l’identifiant, le nom, la plateforme, la version et les indicateurs d’appairage/connexion. Pas d’IP, position, commande disponible, conversation, configuration ou secret.

Les deux outils refusent tout argument. Aucune exécution arbitraire, aucun appel d’agent, aucune lecture de photos ou de notifications, aucun réveil ou ordre au téléphone. Un seul diagnostic à la fois, erreurs expurgées, traces techniques minimales sur stderr. Les noms d’appareils sont des données non fiables, jamais des instructions.

## Exécution locale

Prérequis : Node compatible avec l’OpenClaw installé; SDK MCP livré par cette installation (testé avec 1.30.0). Aucune nouvelle dépendance téléchargée. Trois variables de processus désignent les chemins locaux existants :

- `MORICE_OPENCLAW_CLI` : chemin absolu de `openclaw.mjs` dans l’installation à réutiliser.
- `OPENCLAW_CONFIG_PATH` : configuration OpenClaw existante.
- `OPENCLAW_STATE_DIR` : état du Gateway existant.

Lancer `node integrations/openclaw-readonly/server.mjs` depuis le dépôt. Le processus échange MCP JSON-RPC sur son entrée/sortie standard; il n’écoute aucun port. Ne jamais incorporer les clés de la configuration dans un prompt, une URL ou le code du site. stdout est réservé au protocole; stderr ne contient pas les données renvoyées par le Gateway. L’authentification du diagnostic des nœuds utilise la configuration locale déjà autorisée.

## Activation distante : encore à effectuer

L’usage par le site nécessite une liaison privée authentifiée, une organisation/connexion compatible et la validation des droits avant activation. Ne pas remplacer cette étape par un port public. Ne pas déclarer OpenClaw « connecté » dans MORICE avant un appel réel depuis le site suivi de son résultat visible. Le serveur MCP natif d’OpenClaw expose des conversations/envois : ce petit adaptateur limite volontairement cette première étape aux deux diagnostics ci-dessus.

## Vérification

`node --test tests/openclaw-bridge.test.mjs` couvre les refus d’outils et d’arguments, le filtrage des données, les erreurs expurgées, le verrou de concurrence, les bornes HTTP et la commande exécutée sans shell. Les preuves de connexion réelle doivent rester distinctes des tests simulés.

Le 18 septembre 2026, un client MCP local a effectué l’initialisation, découvert exactement deux outils, vérifié le refus d’un argument `command`, puis lu le Gateway et les nœuds réels : service sain, deux appareils appairés et aucun connecté. Le client et le processus stdio ont ensuite été fermés. Ce test ne constitue ni un raccordement au site ni une autorisation de tunnel distant.

Références : [OpenClaw nodes](https://docs.openclaw.ai/cli/nodes), [MCP stdio](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports), [tunnel privé OpenAI](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels).
