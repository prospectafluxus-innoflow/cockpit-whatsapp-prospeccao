import { describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  getAllSchedules: vi.fn(),
  getDistributedQueueForDay: vi.fn(),
}));
vi.mock("./_core/notification", () => ({ notifyOwner: vi.fn() }));
vi.mock("./_core/env", () => ({ ENV: { cronSecret: "cron-test-secret" } }));

import { cronSendReminderHandler } from "./cronHandler";

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

describe("contrato do cron Cloud Run", () => {
  it("recusa bearer ausente ou incorreto", async () => {
    const response = responseDouble();

    await cronSendReminderHandler({ headers: {}, body: {} } as any, response);

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: "Unauthorized" });
  });

  it("valida window depois da autenticação", async () => {
    const response = responseDouble();

    await cronSendReminderHandler(
      {
        headers: { authorization: "Bearer cron-test-secret" },
        body: { period: "morning" },
      } as any,
      response
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: "window deve ser morning, lunch, afternoon ou evening",
    });
  });
});
