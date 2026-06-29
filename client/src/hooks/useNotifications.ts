/**
 * useNotifications — gerencia permissão e agendamento de notificações push
 * via Service Worker. Funciona em Android Chrome e desktop.
 */
import { useCallback, useEffect, useState } from "react";

export type NotificationPermission = "default" | "granted" | "denied" | "unsupported";

export interface ScheduleWindows {
  morningEnabled: boolean;
  morningHour: number;
  morningCount: number;
  lunchEnabled: boolean;
  lunchHour: number;
  lunchCount: number;
  afternoonEnabled: boolean;
  afternoonHour: number;
  afternoonCount: number;
  eveningEnabled: boolean;
  eveningHour: number;
  eveningCount: number;
}

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [swReady, setSwReady] = useState(false);

  // Detecta suporte e permissão atual
  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as NotificationPermission);

    // Registra o Service Worker
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        setSwReady(true);
        console.log("[SW] Registrado:", reg.scope);
      })
      .catch((err) => {
        console.warn("[SW] Falha ao registrar:", err);
      });
  }, []);

  // Solicita permissão ao usuário
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!("Notification" in window)) return false;
    const result = await Notification.requestPermission();
    setPermission(result as NotificationPermission);
    return result === "granted";
  }, []);

  // Agenda notificações nos horários das janelas via Service Worker
  const scheduleNotifications = useCallback(
    async (windows: ScheduleWindows): Promise<boolean> => {
      if (!swReady || permission !== "granted") return false;
      const reg = await navigator.serviceWorker.ready;
      reg.active?.postMessage({ type: "SCHEDULE_NOTIFICATIONS", windows });
      return true;
    },
    [swReady, permission]
  );

  // Cancela todas as notificações agendadas
  const cancelNotifications = useCallback(async () => {
    if (!swReady) return;
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({ type: "CANCEL_NOTIFICATIONS" });
  }, [swReady]);

  // Envia uma notificação de teste imediata
  const testNotification = useCallback(async (): Promise<boolean> => {
    if (permission !== "granted" || !swReady) return false;
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification("ProspectaFluxus — Teste de lembrete!", {
      body: "🎉 Notificações ativadas! Você receberá lembretes nos horários configurados.",
      icon: "/favicon.ico",
      tag: "prospectafluxus-test",
    });
    return true;
  }, [permission, swReady]);

  return {
    permission,
    swReady,
    isSupported: permission !== "unsupported",
    isGranted: permission === "granted",
    requestPermission,
    scheduleNotifications,
    cancelNotifications,
    testNotification,
  };
}
