import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";

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

function supportsWebPush(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

function applicationServerKey(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes;
}

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [swReady, setSwReady] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const swRegRef = useRef<ServiceWorkerRegistration | null>(null);

  const statusQuery = trpc.notifications.status.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
  });
  const subscribeMutation = trpc.notifications.subscribe.useMutation();
  const unsubscribeMutation = trpc.notifications.unsubscribe.useMutation();
  const testMutation = trpc.notifications.test.useMutation();

  const ensureSW = useCallback(async (): Promise<ServiceWorkerRegistration | null> => {
    if (!supportsWebPush()) return null;

    try {
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const ready = await navigator.serviceWorker.ready;
      swRegRef.current = ready ?? registration;
      setSwReady(true);
      return swRegRef.current;
    } catch (error) {
      console.warn("[WebPush] Falha ao registar o service worker:", error);
      setSwReady(false);
      return null;
    }
  }, []);

  const syncSubscriptionState = useCallback(async () => {
    const registration = swRegRef.current ?? await ensureSW();
    if (!registration) {
      setIsSubscribed(false);
      return null;
    }

    const subscription = await registration.pushManager.getSubscription();
    setIsSubscribed(Boolean(subscription));
    return subscription;
  }, [ensureSW]);

  useEffect(() => {
    if (!supportsWebPush()) {
      setPermission("unsupported");
      return;
    }

    setPermission(Notification.permission as NotificationPermission);
    void ensureSW().then(() => syncSubscriptionState());
  }, [ensureSW, syncSubscriptionState]);

  const subscribeCurrentDevice = useCallback(async (): Promise<boolean> => {
    if (!supportsWebPush() || Notification.permission !== "granted") return false;

    const registration = swRegRef.current ?? await ensureSW();
    if (!registration) return false;

    const status = statusQuery.data ?? (await statusQuery.refetch()).data;
    if (!status?.configured || !status.publicKey) {
      throw new Error("Os alertas ainda não estão configurados no servidor.");
    }

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey(status.publicKey),
      });
    }

    const serialized = subscription.toJSON();
    if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys.auth) {
      throw new Error("O navegador devolveu uma subscrição Web Push incompleta.");
    }

    await subscribeMutation.mutateAsync({
      endpoint: serialized.endpoint,
      expirationTime: serialized.expirationTime ?? null,
      keys: {
        p256dh: serialized.keys.p256dh,
        auth: serialized.keys.auth,
      },
    });

    setIsSubscribed(true);
    await statusQuery.refetch();
    return true;
  }, [ensureSW, statusQuery, subscribeMutation]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!supportsWebPush()) {
      setPermission("unsupported");
      return false;
    }

    const result = await Notification.requestPermission();
    setPermission(result as NotificationPermission);
    if (result !== "granted") return false;
    return subscribeCurrentDevice();
  }, [subscribeCurrentDevice]);

  const scheduleNotifications = useCallback(
    async (_windows: ScheduleWindows): Promise<boolean> => {
      if (Notification.permission !== "granted") return false;
      try {
        return await subscribeCurrentDevice();
      } catch (error) {
        console.warn(
          "[WebPush] Não foi possível renovar automaticamente a subscrição:",
          error instanceof Error ? error.message : "erro desconhecido",
        );
        return false;
      }
    },
    [subscribeCurrentDevice],
  );

  const cancelNotifications = useCallback(async (): Promise<void> => {
    const registration = swRegRef.current ?? await ensureSW();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) {
      setIsSubscribed(false);
      return;
    }

    await unsubscribeMutation.mutateAsync({ endpoint: subscription.endpoint });
    await subscription.unsubscribe();
    setIsSubscribed(false);
    await statusQuery.refetch();
  }, [ensureSW, statusQuery, unsubscribeMutation]);

  const testNotification = useCallback(async (): Promise<boolean> => {
    if (Notification.permission !== "granted") return false;
    if (!isSubscribed && !(await subscribeCurrentDevice())) return false;
    const result = await testMutation.mutateAsync();
    return result.delivered > 0;
  }, [isSubscribed, subscribeCurrentDevice, testMutation]);

  return {
    permission,
    swReady,
    isSupported: permission !== "unsupported",
    isGranted: permission === "granted",
    isSubscribed,
    isConfigured: statusQuery.data?.configured ?? false,
    deviceCount: statusQuery.data?.devices ?? 0,
    isWorking:
      subscribeMutation.isPending ||
      unsubscribeMutation.isPending ||
      testMutation.isPending,
    requestPermission,
    scheduleNotifications,
    cancelNotifications,
    testNotification,
  };
}
