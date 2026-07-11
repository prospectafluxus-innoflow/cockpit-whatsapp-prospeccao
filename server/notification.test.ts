import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPushSubscriptionsByUser: vi.fn(),
  markPushSubscriptionUsed: vi.fn(),
  removePushSubscriptionById: vi.fn(),
  sendNotification: vi.fn(),
  setVapidDetails: vi.fn(),
}));

vi.mock("./db", () => ({
  getPushSubscriptionsByUser: mocks.getPushSubscriptionsByUser,
  markPushSubscriptionUsed: mocks.markPushSubscriptionUsed,
  removePushSubscriptionById: mocks.removePushSubscriptionById,
}));

vi.mock("web-push", () => ({
  default: {
    sendNotification: mocks.sendNotification,
    setVapidDetails: mocks.setVapidDetails,
  },
}));

const subscription = (id: number) => ({
  id,
  userId: 42,
  endpointHash: `hash-${id}`,
  endpoint: `https://push.example.test/device-${id}`,
  p256dh: `p256dh-${id}`,
  auth: `auth-${id}`,
  userAgent: "Vitest",
  expiresAt: null,
  lastUsedAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
});

describe("Web Push", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.RESEND_API_KEY;
    delete process.env.NOTIFICATION_EMAIL;
  });

  it("não consulta dispositivos nem envia quando as chaves VAPID não estão configuradas", async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;

    const { sendWebPushToUser } = await import("./_core/notification");
    const result = await sendWebPushToUser(42, {
      title: "Hora de prospectar",
      content: "Há leads na fila.",
    });

    expect(result).toEqual({
      configured: false,
      subscriptions: 0,
      delivered: 0,
      failed: 0,
      removed: 0,
    });
    expect(mocks.getPushSubscriptionsByUser).not.toHaveBeenCalled();
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it("entrega em dispositivos ativos e remove endpoints expirados", async () => {
    process.env.VAPID_PUBLIC_KEY = "public-test-key";
    process.env.VAPID_PRIVATE_KEY = "private-test-key";
    process.env.VAPID_SUBJECT = "mailto:test@example.com";

    mocks.getPushSubscriptionsByUser.mockResolvedValue([subscription(1), subscription(2)]);
    mocks.sendNotification
      .mockResolvedValueOnce({ statusCode: 201 })
      .mockRejectedValueOnce({ statusCode: 410 });
    mocks.markPushSubscriptionUsed.mockResolvedValue(undefined);
    mocks.removePushSubscriptionById.mockResolvedValue(undefined);

    const { sendWebPushToUser } = await import("./_core/notification");
    const result = await sendWebPushToUser(42, {
      title: "Hora de prospectar",
      content: "Há 2 leads na fila.",
      url: "/cockpit",
    });

    expect(mocks.setVapidDetails).toHaveBeenCalledWith(
      "mailto:test@example.com",
      "public-test-key",
      "private-test-key",
    );
    expect(mocks.sendNotification).toHaveBeenCalledTimes(2);
    expect(mocks.markPushSubscriptionUsed).toHaveBeenCalledWith(42, 1);
    expect(mocks.removePushSubscriptionById).toHaveBeenCalledWith(42, 2);
    expect(result).toEqual({
      configured: true,
      subscriptions: 2,
      delivered: 1,
      failed: 0,
      removed: 1,
    });
  });

  it("contabiliza uma falha transitória sem eliminar o dispositivo", async () => {
    process.env.VAPID_PUBLIC_KEY = "public-test-key";
    process.env.VAPID_PRIVATE_KEY = "private-test-key";

    mocks.getPushSubscriptionsByUser.mockResolvedValue([subscription(7)]);
    mocks.sendNotification.mockRejectedValue({ statusCode: 503 });

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { sendWebPushToUser } = await import("./_core/notification");
    const result = await sendWebPushToUser(42, {
      title: "Teste",
      content: "Teste de falha transitória.",
    });
    consoleError.mockRestore();

    expect(mocks.removePushSubscriptionById).not.toHaveBeenCalled();
    expect(result.failed).toBe(1);
    expect(result.removed).toBe(0);
  });
});
