// ProspectaFluxus — Service Worker para lembretes de envio
// Versão: 2.0.0

const CACHE_NAME = "prospectafluxus-v2";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

// Armazena os timeouts ativos e a última configuração de janelas
const scheduledTimers = [];
let lastWindows = null;

// Recebe mensagem do frontend para agendar notificações
self.addEventListener("message", (event) => {
  if (event.data?.type === "SCHEDULE_NOTIFICATIONS") {
    lastWindows = event.data.windows;
    scheduleNotifications(event.data.windows);
  }
  if (event.data?.type === "CANCEL_NOTIFICATIONS") {
    lastWindows = null;
    cancelAllNotifications();
  }
});

function cancelAllNotifications() {
  scheduledTimers.forEach((id) => clearTimeout(id));
  scheduledTimers.length = 0;
}

function scheduleNotifications(windows) {
  cancelAllNotifications();

  const now = new Date();
  const windowConfigs = [
    { key: "morning",   label: "Manhã",         emoji: "🌅", hour: windows.morningHour,   count: windows.morningCount,   enabled: windows.morningEnabled },
    { key: "lunch",     label: "Almoço",         emoji: "☕", hour: windows.lunchHour,     count: windows.lunchCount,     enabled: windows.lunchEnabled },
    { key: "afternoon", label: "Meio da tarde",  emoji: "⛅", hour: windows.afternoonHour, count: windows.afternoonCount, enabled: windows.afternoonEnabled },
    { key: "evening",   label: "Fim do dia",     emoji: "🌇", hour: windows.eveningHour,   count: windows.eveningCount,   enabled: windows.eveningEnabled },
  ];

  for (const win of windowConfigs) {
    if (!win.enabled || !win.count) continue;

    const target = new Date(now);
    target.setHours(win.hour, 0, 0, 0);

    // Se já passou hoje, agenda para amanhã
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }

    const delay = target.getTime() - now.getTime();

    const timerId = setTimeout(() => {
      self.registration.showNotification("ProspectaFluxus — Hora de prospectar! 🔔", {
        body: `${win.emoji} ${win.label}: ${win.count} lead${win.count > 1 ? "s" : ""} aguardando na sua fila. Clique para abrir o cockpit.`,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: `prospectafluxus-${win.key}`,
        renotify: true,
        requireInteraction: true,
        data: { url: "/cockpit" },
      });

      // Reagenda automaticamente para o próximo dia
      const nextTimerId = setTimeout(() => {
        if (lastWindows) scheduleNotifications(lastWindows);
      }, 60_000); // 1 minuto após disparar, reagenda tudo para o dia seguinte
      scheduledTimers.push(nextTimerId);

    }, delay);

    scheduledTimers.push(timerId);
  }
}

// Ao clicar na notificação, abre o cockpit
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/cockpit";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
