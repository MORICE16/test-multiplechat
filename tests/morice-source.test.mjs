import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Morice exposes the persistent application and notification routes", async () => {
  const [page, assistantRoute, serviceWorker, manifest, migration] = await Promise.all([
    readFile(new URL("app/morice-app.tsx", root), "utf8"),
    readFile(new URL("app/api/assistant/route.ts", root), "utf8"),
    readFile(new URL("public/sw.js", root), "utf8"),
    readFile(new URL("public/manifest.webmanifest", root), "utf8"),
    readFile(new URL("drizzle/0000_morice.sql", root), "utf8"),
  ]);

  assert.match(page, /Activer et tester/);
  assert.match(page, /PushManager/);
  assert.match(page, /beforeinstallprompt/);
  assert.match(page, /Aucun rechargement de la page n’est nécessaire/);
  assert.match(page, /Exécuter avec Morice/);
  assert.match(assistantRoute, /detectKind/);
  assert.match(assistantRoute, /Validation demandée/);
  assert.match(serviceWorker, /showNotification\("Morice"/);
  assert.match(serviceWorker, /addEventListener\("fetch"/);
  assert.equal(JSON.parse(manifest).display, "standalone");
  assert.equal(JSON.parse(manifest).id, "/");
  assert.ok(JSON.parse(manifest).icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "maskable"));
  assert.match(migration, /CREATE TABLE `morice_push_subscriptions`/);
});
