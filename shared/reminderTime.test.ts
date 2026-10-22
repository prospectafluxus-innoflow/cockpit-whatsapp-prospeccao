import { describe, expect, it } from "vitest";
import {
  getSaoPauloDateKey,
  getSaoPauloLocalParts,
  isSaoPauloMinuteZero,
  REMINDER_TIME_ZONE,
} from "./reminderTime";

describe("reminderTime", () => {
  it("usa America/Sao_Paulo para data e hora locais", () => {
    expect(REMINDER_TIME_ZONE).toBe("America/Sao_Paulo");
    expect(getSaoPauloLocalParts(new Date("2026-10-22T12:00:00.000Z"))).toEqual({
      localDate: "2026-10-22",
      hour: 9,
      minute: 0,
    });
    expect(getSaoPauloDateKey(new Date("2026-10-23T02:30:00.000Z"))).toBe("2026-10-22");
  });

  it("aceita apenas o minuto zero para o scheduler horário", () => {
    expect(isSaoPauloMinuteZero(new Date("2026-10-22T12:00:00.000Z"))).toBe(true);
    expect(isSaoPauloMinuteZero(new Date("2026-10-22T12:01:00.000Z"))).toBe(false);
  });
});
