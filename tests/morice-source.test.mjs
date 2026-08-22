import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Morice exposes the persistent application, connected actions and notification routes", async () => {
  const [page, assistantRoute, actionRoute, microsoftRoute, connectionsRoute, serviceWorker, manifest, migration, connectedMigration, portrait, logo] = await Promise.all([
    readFile(new URL("app/morice-app.tsx", root), "utf8"),
    readFile(new URL("app/api/assistant/route.ts", root), "utf8"),
    readFile(new URL("app/api/actions/execute/route.ts", root), "utf8"),
    readFile(new URL("app/lib/microsoft.ts", root), "utf8"),
    readFile(new URL("app/api/connections/route.ts", root), "utf8"),
    readFile(new URL("public/sw.js", root), "utf8"),
    readFile(new URL("public/manifest.webmanifest", root), "utf8"),
    readFile(new URL("drizzle/0000_morice.sql", root), "utf8"),
    readFile(new URL("drizzle/0001_connections_actions.sql", root), "utf8"),
    readFile(new URL("public/morice-3d.png", root)),
    readFile(new URL("public/morice-logo.png", root)),
  ]);

  assert.match(page, /Activer et tester/);
  assert.match(page, /PushManager/);
  assert.match(page, /beforeinstallprompt/);
  assert.match(page, /Aucun rechargement de la page n’est nécessaire/);
  assert.match(page, /"Envoyer"/);
  assert.match(page, /"Enregistrer"/);
  assert.match(page, /recognition\.continuous = true/);
  assert.match(page, /recognition\.interimResults = true/);
  assert.match(page, /function pauseDictation/);
  assert.match(page, /function stopDictation/);
  assert.match(page, /L’envoi reste toujours manuel/);
  assert.match(page, /\/morice-3d\.png/);
  assert.equal(createHash("sha256").update(portrait).digest("hex"), "44fce86945cff412c4e7206eeef44c81647d49cc8668e3aa389e753b88099c4a");
  assert.deepEqual(logo, portrait);
  assert.match(assistantRoute, /api\.openai\.com\/v1\/responses/);
  assert.match(assistantRoute, /json_schema/);
  assert.match(assistantRoute, /Validation demandée/);
  assert.match(actionRoute, /runMicrosoftAction/);
  assert.match(actionRoute, /runMakeAction/);
  assert.match(microsoftRoute, /graph\.microsoft\.com\/v1\.0/);
  assert.match(microsoftRoute, /Morice Online/);
  assert.match(assistantRoute, /makeHandlesTodo/);
  assert.match(assistantRoute, /Aucune tâche ni action n’a été créée/);
  assert.doesNotMatch(assistantRoute, /catch \{\s*plan = localPlan/);
  assert.match(connectionsRoute, /hubspot: \{ configured: false, disabled: true/);
  assert.match(page, /Valider et exécuter/);
  assert.match(page, /function moduleView/);
  assert.match(page, /setView\(moduleView\(module\.id\)\)/);
  assert.match(page, /HubSpot indisponible/);
  assert.match(await readFile(new URL("app/api/state/route.ts", root), "utf8"), /`\$\{uid\}:\$\{id\}`/);
  assert.match(serviceWorker, /showNotification\("Morice"/);
  assert.match(serviceWorker, /addEventListener\("fetch"/);
  assert.equal(JSON.parse(manifest).display, "standalone");
  assert.equal(JSON.parse(manifest).id, "/");
  assert.ok(JSON.parse(manifest).icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "maskable" && icon.src.includes("maurice-3d")));
  assert.match(migration, /CREATE TABLE `morice_push_subscriptions`/);
  assert.match(connectedMigration, /CREATE TABLE `morice_connections`/);
  assert.match(connectedMigration, /CREATE TABLE `morice_action_payloads`/);
});
