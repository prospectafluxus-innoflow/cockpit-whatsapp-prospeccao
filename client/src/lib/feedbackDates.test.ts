import { describe, expect, it } from "vitest";
import { formatFeedbackDate } from "./feedbackDates";

describe("datas de calendário do Feedback", () => {
  it("preserva início e fim exatamente como cadastrados", () => {
    expect(formatFeedbackDate("2026-10-01")).toBe("01/10/2026");
    expect(formatFeedbackDate("2026-12-31")).toBe("31/12/2026");
  });
  it("aceita datas bissextas sem normalizar datas inválidas", () => {
    expect(formatFeedbackDate("2024-02-29")).toBe("29/02/2024");
    expect(formatFeedbackDate("2026-02-30")).toBe("—");
    expect(formatFeedbackDate("2026-13-01")).toBe("—");
  });
  it("mantém timestamps locais e ausência de valor", () => {
    const date = new Date("2026-10-07T12:00:00Z");
    expect(formatFeedbackDate(date)).toBe(date.toLocaleDateString("pt-BR"));
    expect(formatFeedbackDate(undefined)).toBe("—");
    expect(formatFeedbackDate("inválido")).toBe("—");
  });
});
