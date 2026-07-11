// ProspectaFluxus — Service Worker de notificações Web Push
// Versão: 3.0.0

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

function safeAppPath(value) {
  try {
    const target = new URL(value || "/cockpit", self.location.origin);
    if (target.origin !== self.location.origin) return "/cockpit";
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/cockpit";
  }
}

self.addEventListener("push", event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "Há leads aguardando no cockpit." };
  }

  const title = payload.title || "ProspectaFluxus — Hora de prospectar";
  const options = {
    body: payload.body || "Há leads aguardando na sua fila. Abra o cockpit para continuar.",
    icon: payload.icon || "/icons/icon-192.png",
    badge: payload.badge || "/icons/badge-96.png",
    tag: payload.tag || "prospectafluxus-reminder",
    renotify: true,
    requireInteraction: true,
    data: { url: safeAppPath(payload.url) },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const path = safeAppPath(event.notification.data?.url);
  const targetUrl = new URL(path, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      const existing = clientList.find(client => client.url.startsWith(self.location.origin));
      if (existing) {
        return existing.navigate(targetUrl).then(() => existing.focus());
      }
      return self.clients.openWindow ? self.clients.openWindow(targetUrl) : undefined;
    }),
  );
});
