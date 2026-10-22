import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAllSchedules: vi.fn(),
  getDistributedQueueForDay: vi.fn(),
  claimReminder: vi.fn(),
  markReminderSent: vi.fn(),
  markReminderFailed: vi.fn(),
  markReminderNotDelivered: vi.fn(),
  notifyOwner: vi.fn(),
}));

vi.mock("./db", () => ({
  getAllSchedules: mocks.getAllSchedules,
  getDistributedQueueForDay: mocks.getDistributedQueueForDay,
}));
vi.mock("./reminderDb", () => ({
  claimReminder: mocks.claimReminder,
  markReminderSent: mocks.markReminderSent,
  markReminderFailed: mocks.markReminderFailed,
  markReminderNotDelivered: mocks.markReminderNotDelivered,
  sanitizeReminderError: (error: unknown) => error instanceof Error ? error.message : "error",
}));
vi.mock("./_core/notification", () => ({ notifyOwner: mocks.notifyOwner }));
vi.mock("./_core/env", () => ({ ENV: { cronSecret: "cron-test-secret" } }));

const schedule = {
  userId: 1,
  morningEnabled: 1,
  morningHour: 9,
  morningCount: 2,
  lunchEnabled: 1,
  lunchHour: 13,
  lunchCount: 2,
  afternoonEnabled: 1,
  afternoonHour: 16,
  afternoonCount: 2,
  eveningEnabled: 1,
  eveningHour: 18,
  eveningCount: 2,
} as any;

const lead = { name: "Lead de teste", company: "Empresa", layer: "A" };
const emptyQueue = { morning: [], lunch: [], afternoon: [], evening: [] };

function responseDouble() {
  const response: any = {
    statusCode: 200,
    body: undefined,
    status(statusCode: number) {
      response.statusCode = statusCode;
      return response;
    },
    json(body: unknown) {
      response.body = body;
      return response;
    },
  };
  return response;
}

function request(headers: Record<string, string>, body: unknown = {}) {
  return { headers, body } as any;
}

describe("cron reminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REMINDER_SCHEDULER_PROVIDER = "google";
    mocks.getAllSchedules.mockResolvedValue([schedule]);
    mocks.getDistributedQueueForDay.mockResolvedValue({
      ...emptyQueue,
      morning: [lead],
    });
    mocks.claimReminder.mockResolvedValue({ claimed: true, ledgerId: 9 });
    mocks.markReminderSent.mockResolvedValue(undefined);
    mocks.markReminderFailed.mockResolvedValue(undefined);
    mocks.markReminderNotDelivered.mockResolvedValue(undefined);
    mocks.notifyOwner.mockResolvedValue(true);
  });

  it("recusa bearer ausente ou incorreto", async () => {
    const { cronSendReminderHandler } = await import("./cronHandler");
    const response = responseDouble();

    await cronSendReminderHandler(request({}, {}), response);

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: "Unauthorized" });
  });

  it("valida window depois da autenticação", async () => {
    const { cronSendReminderHandler } = await import("./cronHandler");
    const response = responseDouble();

    await cronSendReminderHandler(
      request({ authorization: "Bearer cron-test-secret" }, { period: "morning" }),
      response,
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: "window deve ser morning, lunch, afternoon ou evening",
    });
  });

  it("seleciona a janela pelo horário local e usa claim antes da notificação", async () => {
    const { dispatchReminderWindows } = await import("./cronHandler");
    const stats = await dispatchReminderWindows({
      now: new Date("2026-10-22T12:00:00.000Z"),
      useLedger: true,
      requireMinuteZero: true,
    });

    expect(stats).toMatchObject({ due: 1, claimed: 1, sent: 1, noLeads: 0 });
    expect(mocks.claimReminder).toHaveBeenCalledWith(expect.objectContaining({
      userId: 1,
      localDate: "2026-10-22",
      window: "morning",
    }));
    expect(mocks.notifyOwner).toHaveBeenCalledTimes(1);
    expect(mocks.markReminderSent).toHaveBeenCalledWith(9, expect.any(Date));
  });

  it("não notifica quando outro worker venceu o claim", async () => {
    mocks.claimReminder.mockResolvedValue({ claimed: false });
    const { dispatchReminderWindows } = await import("./cronHandler");

    const stats = await dispatchReminderWindows({
      now: new Date("2026-10-22T12:00:00.000Z"),
      useLedger: true,
      requireMinuteZero: true,
    });

    expect(stats).toMatchObject({ due: 1, claimed: 0, alreadyClaimed: 1, sent: 0 });
    expect(mocks.notifyOwner).not.toHaveBeenCalled();
  });

  it("dry-run não faz claim nem entrega e retorna somente estatísticas", async () => {
    const { dispatchReminderWindows } = await import("./cronHandler");
    const stats = await dispatchReminderWindows({
      now: new Date("2026-10-22T12:00:00.000Z"),
      useLedger: true,
      dryRun: true,
      requireMinuteZero: true,
    });

    expect(stats).toMatchObject({ due: 1, wouldNotify: 1, claimed: 0, sent: 0, dryRun: true });
    expect(mocks.claimReminder).not.toHaveBeenCalled();
    expect(mocks.notifyOwner).not.toHaveBeenCalled();
  });

  it("é exclusivo do minuto zero no dispatcher", async () => {
    const { dispatchReminderWindows } = await import("./cronHandler");
    const stats = await dispatchReminderWindows({
      now: new Date("2026-10-22T12:01:00.000Z"),
      useLedger: true,
      requireMinuteZero: true,
    });

    expect(stats.skipped).toBe("minute-zero-only");
    expect(mocks.getAllSchedules).not.toHaveBeenCalled();
    expect(mocks.notifyOwner).not.toHaveBeenCalled();
  });

  it("responde 503 quando Railway não habilita o provider Google", async () => {
    process.env.REMINDER_SCHEDULER_PROVIDER = "";
    const { cronDispatchRemindersHandler } = await import("./cronHandler");
    const response = responseDouble();

    await cronDispatchRemindersHandler(request({ authorization: "Bearer cron-test-secret" }), response);

    expect(response.statusCode).toBe(503);
    expect(response.body).toEqual({ error: "Google Cloud Scheduler provider is not active" });
  });

  it("não aceita now vindo do operador HTTP", async () => {
    const { cronDispatchRemindersHandler } = await import("./cronHandler");
    const response = responseDouble();

    await cronDispatchRemindersHandler(
      request({ authorization: "Bearer cron-test-secret" }, { now: "2026-10-22T12:00:00Z" }),
      response,
    );

    expect(response.statusCode).toBe(400);
    expect(mocks.notifyOwner).not.toHaveBeenCalled();
  });
});
