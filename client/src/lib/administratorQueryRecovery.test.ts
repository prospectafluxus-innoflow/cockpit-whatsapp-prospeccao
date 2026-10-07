import { describe, expect, it } from "vitest";
import {
  administratorQueryRetryDelay,
  shouldRetryAdministratorQuery,
} from "./administratorQueryRecovery";

describe("Recuperação limitada do seletor administrativo", () => {
  it("permite até duas novas tentativas para rede ou falha interna", () => {
    expect(
      shouldRetryAdministratorQuery(0, new TypeError("Failed to fetch"))
    ).toBe(true);
    expect(
      shouldRetryAdministratorQuery(1, {
        data: { code: "INTERNAL_SERVER_ERROR" },
      })
    ).toBe(true);
    expect(
      shouldRetryAdministratorQuery(2, new TypeError("Failed to fetch"))
    ).toBe(false);
    expect(
      shouldRetryAdministratorQuery(3, { data: { code: "TIMEOUT" } })
    ).toBe(false);
  });
  it.each([
    "UNAUTHORIZED",
    "FORBIDDEN",
    "BAD_REQUEST",
    "NOT_FOUND",
    "PRECONDITION_FAILED",
    "CONFLICT",
    "PARSE_ERROR",
  ])("não repete %s", code => {
    expect(shouldRetryAdministratorQuery(0, { data: { code } })).toBe(false);
  });
  it("limita o atraso para não criar carregamento infinito", () => {
    expect(administratorQueryRetryDelay(0)).toBe(500);
    expect(administratorQueryRetryDelay(1)).toBe(1000);
    expect(administratorQueryRetryDelay(8)).toBe(2000);
  });
});
