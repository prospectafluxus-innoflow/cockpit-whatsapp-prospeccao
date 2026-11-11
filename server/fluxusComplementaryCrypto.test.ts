import { afterEach, describe, expect, it, vi } from "vitest";
import {
  complementaryEncryptionConfigured,
  decryptComplementaryPdf,
  encryptComplementaryPdf,
} from "./fluxusComplementaryCrypto";
import { COMPLEMENTARY_MAX_PDF_BYTES } from "../shared/fluxusComplementary";

afterEach(() => vi.unstubAllEnvs());
const pdf = Buffer.from("%PDF-1.7\nexemplo fictício de teste\n%%EOF");
function configure() {
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", "ab".repeat(32));
}
describe("cofre privado dos relatórios complementares", () => {
  it("fica indisponível sem chave válida", () => {
    vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", "");
    expect(complementaryEncryptionConfigured()).toBe(false);
    vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", "invalid");
    expect(complementaryEncryptionConfigured()).toBe(false);
  });
  it("cifra e recupera apenas no mesmo contexto", () => {
    configure();
    const encrypted = encryptComplementaryPdf(1, 2, pdf);
    expect(complementaryEncryptionConfigured()).toBe(true);
    expect(encrypted).not.toContain("exemplo");
    expect(encrypted).not.toContain("%PDF");
    expect(decryptComplementaryPdf(1, 2, encrypted)).toEqual(pdf);
    expect(() => decryptComplementaryPdf(2, 2, encrypted)).toThrow();
    expect(() => decryptComplementaryPdf(1, 3, encrypted)).toThrow();
  });
  it("usa nonce diferente em cada gravação", () => {
    configure();
    expect(encryptComplementaryPdf(1, 2, pdf)).not.toBe(
      encryptComplementaryPdf(1, 2, pdf)
    );
  });
  it("rejeita arquivo alterado ou chave diferente", () => {
    configure();
    const encrypted = encryptComplementaryPdf(1, 2, pdf);
    const parts = encrypted.split(".");
    const data = Buffer.from(parts[3], "base64url");
    data[0] ^= 1;
    parts[3] = data.toString("base64url");
    expect(() => decryptComplementaryPdf(1, 2, parts.join("."))).toThrow();
    vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", "cd".repeat(32));
    expect(() => decryptComplementaryPdf(1, 2, encrypted)).toThrow();
  });
  it("rejeita contexto, formato e tamanho inválidos", () => {
    configure();
    expect(() => encryptComplementaryPdf(0, 2, pdf)).toThrow();
    expect(() => encryptComplementaryPdf(1, 2, Buffer.alloc(0))).toThrow();
    expect(() =>
      encryptComplementaryPdf(
        1,
        2,
        Buffer.alloc(COMPLEMENTARY_MAX_PDF_BYTES + 1)
      )
    ).toThrow();
    expect(() => decryptComplementaryPdf(1, 2, "v1.invalid")).toThrow();
    expect(() =>
      decryptComplementaryPdf(1, 2, "cpdf1.bad.bad.bad.extra")
    ).toThrow();
  });
  it("aceita chave master em Base64 sem mudar outra integração", () => {
    vi.stubEnv(
      "INTEGRATION_ENCRYPTION_KEY",
      Buffer.alloc(32, 3).toString("base64")
    );
    expect(
      decryptComplementaryPdf(1, 2, encryptComplementaryPdf(1, 2, pdf))
    ).toEqual(pdf);
  });
});
