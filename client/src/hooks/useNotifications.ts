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

  // Garante que o SW está registrado e ativo, reutilizando se já existir
  const ensureSW = useCallback(async (): Promise<ServiceWorkerRegistration | null> => {
    if (!("serviceWorker" in navigator)) return null;
    try {
      // Reutiliza registro existente se já estiver ativo
      const existing = await navigator.serviceWorker.getRegistration("/");
      if (existing?.active) {
        swRegRef.current = existing;
        setSwReady(true);
        return existing;
      }
      // Registra novo SW
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      // Aguarda o SW ficar ativo
      await new Promise<void>((resolve) => {
        if (reg.active) { resolve(); return; }
        const sw = reg.installing ?? reg.waiting;
        if (!sw) { resolve(); return; }
        sw.addEventListener("statechange", function handler() {
          if (sw.state === "activated") {
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
    // Registra o SW se já tiver permissão ou se já existir
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
      if (permission !== "granted") return false;
      const reg = swRegRef.current ?? await ensureSW();
      if (!reg) return false;
      reg.active?.postMessage({ type: "SCHEDULE_NOTIFICATIONS", windows });
      return true;
    },
    [ensureSW, permission]
  );

  // Cancela todas as notificações agendadas
  const cancelNotifications = useCallback(async () => {
    const reg = swRegRef.current ?? await ensureSW();
    if (!reg) return;
    reg.active?.postMessage({ type: "CANCEL_NOTIFICATIONS" });
  }, [ensureSW]);

  // Envia uma notificação de teste imediata — robusto após desativar/reativar
  const testNotification = useCallback(async (): Promise<boolean> => {
    if (!("Notification" in window)) return false;
    if (Notification.permission !== "granted") return false;
    // Garante SW ativo (re-registra se necessário)
    const reg = swRegRef.current ?? await ensureSW();
    if (reg) {
      try {
        await reg.showNotification("ProspectaFluxus — Teste de lembrete!", {
          body: "🎉 Notificações ativadas! Você receberá lembretes nos horários configurados.",
          icon: "/favicon.ico",
          tag: "prospectafluxus-test",
        });
        return true;
      } catch (err) {
        console.warn("[SW] showNotification falhou, tentando fallback:", err);
      }
    }
    // Fallback: Notification direta sem SW
    try {
      new Notification("ProspectaFluxus — Teste de lembrete!", {
        body: "🎉 Notificações ativadas! Você receberá lembretes nos horários configurados.",
        icon: "/favicon.ico",
      });
      return true;
    } catch {
      return false;
    }
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
