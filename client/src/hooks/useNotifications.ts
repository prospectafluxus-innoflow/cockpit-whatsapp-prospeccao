/**
 * useNotifications — gerencia permissão e agendamento de notificações push
 * via Service Worker. Funciona em Android Chrome e desktop.
 */
import { useCallback, useEffect, useRef, useState } from "react";

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
  const swRegRef = useRef<ServiceWorkerRegistration | null>(null);

  // Garante que o SW está registrado e ativo
  const ensureSW = useCallback(async (): Promise<ServiceWorkerRegistration | null> => {
    if (!("serviceWorker" in navigator)) return null;
    try {
      // Tenta reutilizar registro existente
      const existing = await navigator.serviceWorker.getRegistration("/");
      if (existing?.active) {
        swRegRef.current = existing;
        setSwReady(true);
        return existing;
      }
      // Registra novo SW
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      // Aguarda o SW ficar ativo (com timeout de 5s)
      await new Promise<void>((resolve) => {
        if (reg.active) { resolve(); return; }
        const sw = reg.installing ?? reg.waiting;
        if (!sw) { resolve(); return; }
        const timeout = setTimeout(resolve, 5000);
        sw.addEventListener("statechange", function handler() {
          if (sw.state === "activated") {
            clearTimeout(timeout);
            sw.removeEventListener("statechange", handler);
            resolve();
          }
        });
      });
      swRegRef.current = reg;
      setSwReady(true);
      return reg;
    } catch (err) {
      console.warn("[SW] Falha ao registrar:", err);
      return null;
    }
  }, []);

  // Detecta suporte e permissão atual na montagem
  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as NotificationPermission);
    ensureSW();
  }, [ensureSW]);

  // Solicita permissão ao usuário
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!("Notification" in window)) return false;
    const result = await Notification.requestPermission();
    setPermission(result as NotificationPermission);
    if (result === "granted") {
      await ensureSW();
    }
    return result === "granted";
  }, [ensureSW]);

  // Agenda notificações nos horários das janelas via Service Worker
  const scheduleNotifications = useCallback(
    async (windows: ScheduleWindows): Promise<boolean> => {
      if (Notification.permission !== "granted") return false;
      const reg = swRegRef.current ?? await ensureSW();
      if (!reg?.active) return false;
      reg.active.postMessage({ type: "SCHEDULE_NOTIFICATIONS", windows });
      return true;
    },
    [ensureSW]
  );

  // Cancela todas as notificações agendadas
  const cancelNotifications = useCallback(async () => {
    const reg = swRegRef.current ?? await ensureSW();
    if (!reg?.active) return;
    reg.active.postMessage({ type: "CANCEL_NOTIFICATIONS" });
  }, [ensureSW]);

  // Envia uma notificação de teste imediata
  const testNotification = useCallback(async (): Promise<boolean> => {
    if (!("Notification" in window)) return false;
    if (Notification.permission !== "granted") return false;

    // Usa new Notification() diretamente — mais confiável para testes imediatos
    // O Service Worker é necessário apenas para notificações em background
    try {
      new Notification("ProspectaFluxus — Teste de lembrete! 🔔", {
        body: "✅ Notificações funcionando! Você receberá lembretes nos horários configurados.",
        icon: "/favicon.ico",
        tag: "prospectafluxus-test",
      });
      return true;
    } catch (err) {
      console.warn("[Notification] new Notification() falhou:", err);
    }

    // Fallback: tenta via Service Worker
    const reg = swRegRef.current ?? await ensureSW();
    if (reg) {
      try {
        await reg.showNotification("ProspectaFluxus — Teste de lembrete! 🔔", {
          body: "✅ Notificações funcionando! Você receberá lembretes nos horários configurados.",
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          tag: "prospectafluxus-test",
          requireInteraction: false,
        });
        return true;
      } catch (err) {
        console.warn("[SW] showNotification falhou:", err);
      }
    }

    return false;
  }, [ensureSW]);

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
