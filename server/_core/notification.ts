import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import {
  getPushSubscriptionsByUser,
  markPushSubscriptionUsed,
  removePushSubscriptionById,
} from "../db";

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL ?? "";
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:admin@prospectafluxus.com.br";

export const isWebPushConfigured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (isWebPushConfigured) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

type NotificationInput = {
  title: string;
  content: string;
  url?: string;
  tag?: string;
};

export type PushDeliveryResult = {
  configured: boolean;
  subscriptions: number;
  delivered: number;
  failed: number;
  removed: number;
};

export function getVapidPublicKey(): string | null {
  return VAPID_PUBLIC_KEY || null;
}

function statusCodeFromError(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("statusCode" in error)) return undefined;
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === "number" ? statusCode : undefined;
}

export async function sendWebPushToUser(
  userId: number,
  { title, content, url = "/cockpit", tag = "prospectafluxus-reminder" }: NotificationInput,
): Promise<PushDeliveryResult> {
  if (!isWebPushConfigured) {
    return { configured: false, subscriptions: 0, delivered: 0, failed: 0, removed: 0 };
  }

  const subscriptions = await getPushSubscriptionsByUser(userId);
  const payload = JSON.stringify({
    title,
    body: content,
    url,
    tag,
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
  });

  let delivered = 0;
  let failed = 0;
  let removed = 0;

  await Promise.all(
    subscriptions.map(async subscription => {
      const target: WebPushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      };

      try {
        await webpush.sendNotification(target, payload, {
          TTL: 60 * 60,
          urgency: "high",
        });
        delivered += 1;
        await markPushSubscriptionUsed(userId, subscription.id);
      } catch (error) {
        const statusCode = statusCodeFromError(error);
        if (statusCode === 404 || statusCode === 410) {
          await removePushSubscriptionById(userId, subscription.id);
          removed += 1;
          return;
        }

        failed += 1;
        console.error(
          `[WebPush] Falha no dispositivo ${subscription.id}:`,
          statusCode ?? (error instanceof Error ? error.message : "erro desconhecido"),
        );
      }
    }),
  );

  return {
    configured: true,
    subscriptions: subscriptions.length,
    delivered,
    failed,
    removed,
  };
}

async function sendOptionalEmail(title: string, content: string): Promise<boolean> {
  if (!RESEND_API_KEY || !NOTIFICATION_EMAIL) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ProspectaFluxus <noreply@prospectafluxus.com.br>",
        to: NOTIFICATION_EMAIL,
        subject: title,
        text: content,
      }),
    });

    if (!response.ok) {
      console.error("[Notificação] Falha ao enviar email via Resend:", await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("[Notificação] Erro ao enviar email:", error);
    return false;
  }
}

export async function notifyOwner({
  userId,
  title,
  content,
}: NotificationInput & { userId: number }): Promise<boolean> {
  console.log(`[Notificação] user=${userId} ${title}\n${content}`);

  const [pushResult, emailDelivered] = await Promise.all([
    sendWebPushToUser(userId, { title, content }),
    sendOptionalEmail(title, content),
  ]);

  if (pushResult.configured) {
    console.log(
      `[WebPush] user=${userId} dispositivos=${pushResult.subscriptions} entregues=${pushResult.delivered} falhas=${pushResult.failed} removidos=${pushResult.removed}`,
    );
  }

  return pushResult.delivered > 0 || emailDelivered;
}
