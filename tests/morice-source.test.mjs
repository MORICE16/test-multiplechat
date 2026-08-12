import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Morice exposes the persistent application and notification routes", async () => {
  const [page, serviceWorker, manifest, migration] = await Promise.all([
    readFile(new URL("app/morice-app.tsx", root), "utf8"),
    readFile(new URL("public/sw.js", root), "utf8"),
    readFile(new URL("public/manifest.webmanifest", root), "utf8"),
    readFile(new URL("drizzle/0000_morice.sql", root), "utf8"),
  ]);

  assert.match(page, /Activer et tester/);
  assert.match(page, /PushManager/);
  assert.match(serviceWorker, /showNotification\("Morice"/);
  assert.match(manifest, /"name"\s*:\s*"Morice"/);
  assert.match(migration, /CREATE TABLE `morice_push_subscriptions`/);
});
