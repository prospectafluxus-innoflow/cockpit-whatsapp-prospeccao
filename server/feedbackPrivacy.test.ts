import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  enabled: vi.fn(() => false),
}));
vi.mock("./db", () => ({ db: { select: mocks.select } }));
vi.mock("./feedbackDb", () => ({ isFeedbackEnabled: mocks.enabled }));
import { exportReleasedFeedbackData } from "./feedbackPrivacy";

describe("exportação pessoal durante rollout", () => {
  it("não consulta tabelas de feedback quando o módulo está desativado", async () => {
    expect(await exportReleasedFeedbackData(1, 1)).toEqual([]);
    expect(mocks.select).not.toHaveBeenCalled();
  });
});
