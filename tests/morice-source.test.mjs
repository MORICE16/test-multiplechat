import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Morice exposes the persistent application, connected actions and notification routes", async () => {
  const [page, layout, assistantRoute, actionRoute, microsoftRoute, connectionsRoute, serviceWorker, manifest, migration, connectedMigration, portrait, logo, socialPreview] = await Promise.all([
    readFile(new URL("app/morice-app.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
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
    readFile(new URL("public/og.png", root)),
  ]);

  assert.match(page, /Activer et tester/);
  assert.match(page, /PushManager/);
  assert.match(page, /beforeinstallprompt/);
  assert.match(page, /Aucun rechargement de la page n’est nécessaire/);
  assert.match(page, /"Envoyer"/);
  assert.match(page, /Un clic démarre l’écoute\. Aucun maintien appuyé/);
  assert.match(page, /recognition\.continuous = false/);
  assert.match(page, /function mergeSpeechSegments/);
  assert.match(page, /recognition\.interimResults = true/);
  assert.match(page, /function stopDictation/);
  assert.match(page, /function toggleDictation/);
  assert.match(page, /Transcription…/);
  assert.match(page, /Morice réfléchit…/);
  assert.match(page, /Aucune donnée inventée/);
  assert.match(page, /Passerelle à relier au site/);
  assert.match(page, /\/morice-3d\.png\?v=morice-logo-44fce869-20260823/);
  assert.equal(createHash("sha256").update(portrait).digest("hex"), "44fce86945cff412c4e7206eeef44c81647d49cc8668e3aa389e753b88099c4a");
  assert.deepEqual(logo, portrait);
  assert.deepEqual(socialPreview, portrait);
  assert.match(layout, /og\.png\?v=morice-logo-44fce869-20260823/);
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
  assert.match(page, /MORICE — ESPACE PRIVÉ D’ALAN/);
  assert.match(page, /B-MAC Conseil/);
  assert.match(page, /Maison & Maurice/);
  assert.match(page, /HubSpot indisponible/);
  for (const asset of ["hubspot.svg", "outlook.svg", "todo.svg", "samsung-notes.png", "bitcoin.svg"]) {
    assert.ok((await readFile(new URL(`public/brand-icons/${asset}`, root))).byteLength > 500, `${asset} doit être un vrai visuel local`);
    assert.match(page, new RegExp(`/brand-icons/${asset.replace(".", "\\.")}`));
  }
  assert.match(await readFile(new URL("app/api/state/route.ts", root), "utf8"), /`\$\{uid\}:\$\{id\}`/);
  assert.match(serviceWorker, /showNotification\("Morice"/);
  assert.match(serviceWorker, /addEventListener\("fetch"/);
  assert.equal(JSON.parse(manifest).display, "standalone");
  assert.equal(JSON.parse(manifest).id, "/");
  assert.ok(JSON.parse(manifest).icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "maskable" && icon.src.includes("morice-logo-44fce869-20260823")));
  assert.match(serviceWorker, /morice-logo-44fce869-20260823/);
  assert.match(migration, /CREATE TABLE `morice_push_subscriptions`/);
  assert.match(connectedMigration, /CREATE TABLE `morice_connections`/);
  assert.match(connectedMigration, /CREATE TABLE `morice_action_payloads`/);
});
