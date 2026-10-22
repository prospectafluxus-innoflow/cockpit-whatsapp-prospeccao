import { describe, expect, it } from "vitest";
import { parseProductionPort, PRODUCTION_HOST } from "./productionPort";

describe("configuração de listener de produção", () => {
  it("usa o host explícito de Cloud Run", () => {
    expect(PRODUCTION_HOST).toBe("0.0.0.0");
  });

  it("aceita somente portas decimais válidas", () => {
    expect(parseProductionPort("8080")).toBe(8080);
    expect(parseProductionPort(" 443 ")).toBe(443);
  });

  it.each([undefined, "", " ", "abc", "8080x", "0", "65536", "-1"])(
    "falha rápido para PORT inválida (%s)",
    value => {
      expect(() => parseProductionPort(value)).toThrow(
        "PORT must be a decimal TCP port between 1 and 65535"
      );
    }
  );
});
