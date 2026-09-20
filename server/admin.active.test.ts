import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { adminProcedure, router } from "./_core/trpc";

const testRouter = router({
  secret: adminProcedure.query(() => "allowed"),
});

function context(overrides: Record<string, unknown> = {}): TrpcContext {
  return {
    user: {
      id: 1,
      role: "admin",
      approvalStatus: "approved",
      privacyDeletedAt: null,
      ...overrides,
    } as NonNullable<TrpcContext["user"]>,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("adminProcedure", () => {
  it("allows an active approved administrator", async () => {
    await expect(testRouter.createCaller(context()).secret()).resolves.toBe("allowed");
  });

  it("denies a rejected administrator even with an existing session", async () => {
    await expect(
      testRouter.createCaller(context({ approvalStatus: "rejected" })).secret()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("denies an administrator marked as privacy-deleted", async () => {
    await expect(
      testRouter
        .createCaller(context({ privacyDeletedAt: new Date() }))
        .secret()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
