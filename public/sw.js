const MORICE_VERSION = "morice-v4-logo-20260823";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

// Chrome vérifie que l'application possède un service actif avant de proposer
// une véritable installation. Morice reste volontairement en accès réseau
// pour ne jamais mettre en cache les données privées d'Alan.
self.addEventListener("fetch", event => {
  if (event.request.method === "GET") event.respondWith(fetch(event.request));
});

self.addEventListener("push", event => {
  event.waitUntil(self.registration.showNotification("Morice", {
    body: "Notification Morice reçue. Les alertes sont correctement activées.",
    icon: "/icon-192.png?v=morice-logo-44fce869-20260823",
    badge: "/icon-192.png?v=morice-logo-44fce869-20260823",
    tag: MORICE_VERSION,
    data: { url: "/" }
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => list[0] ? list[0].focus() : clients.openWindow(event.notification.data?.url || "/")));
});
