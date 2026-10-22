import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    insert: vi.fn(),
    update: vi.fn(),
  },
  insertChain: {
    values: vi.fn(),
    onConflictDoNothing: vi.fn(),
    returning: vi.fn(),
  },
  updateChain: {
    set: vi.fn(),
    where: vi.fn(),
  },
}));

vi.mock("./db", () => ({ db: mocks.db }));

describe("reminderDb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insertChain.values.mockReturnValue(mocks.insertChain);
    mocks.insertChain.onConflictDoNothing.mockReturnValue(mocks.insertChain);
    mocks.db.insert.mockReturnValue(mocks.insertChain);
    mocks.updateChain.set.mockReturnValue(mocks.updateChain);
    mocks.updateChain.where.mockResolvedValue(undefined);
    mocks.db.update.mockReturnValue(mocks.updateChain);
  });

  it("faz claim com insert atômico e retorna o id somente quando inseriu", async () => {
    mocks.insertChain.returning.mockResolvedValue([{ id: 17 }]);
    const { claimReminder } = await import("./reminderDb");

    const result = await claimReminder({
      userId: 4,
      localDate: "2026-10-22",
      window: "lunch",
      claimedAt: new Date("2026-10-22T15:00:00Z"),
    });

    expect(result).toEqual({ claimed: true, ledgerId: 17 });
    expect(mocks.insertChain.onConflictDoNothing).toHaveBeenCalledWith({
      target: expect.any(Array),
    });
    expect(mocks.insertChain.returning).toHaveBeenCalledTimes(1);
  });

  it("trata conflito único como slot já reivindicado sem nova entrega", async () => {
    mocks.insertChain.returning.mockResolvedValue([]);
    const { claimReminder } = await import("./reminderDb");

    await expect(claimReminder({
      userId: 1,
      localDate: "2026-10-22",
      window: "morning",
    })).resolves.toEqual({ claimed: false });
  });

  it("marca estados terminais sem permitir transição de outro estado", async () => {
    const { markReminderSent, markReminderFailed, markReminderNotDelivered } =
      await import("./reminderDb");

    await markReminderSent(17);
    await markReminderFailed(18, new Error("token https://secret.example/a\nemail a@example.com"));
    await markReminderNotDelivered(19);

    expect(mocks.db.update).toHaveBeenCalledTimes(3);
    for (const call of mocks.updateChain.where.mock.calls) {
      expect(call).toHaveLength(1);
    }
  });

  it("sanitiza erro antes de persistir", async () => {
    const { sanitizeReminderError } = await import("./reminderDb");
    const result = sanitizeReminderError(new Error("falha\nhttps://secret.test/x\na@b.test"));

    expect(result).not.toContain("secret.test");
    expect(result).not.toContain("a@b.test");
    expect(result).not.toMatch(/[\r\n\t]/);
  });
});
