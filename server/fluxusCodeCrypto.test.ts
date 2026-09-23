import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  decodeFluxusCompanyCodeStorage,
  decryptFluxusCompanyCode,
  encodeFluxusCompanyCodeStorage,
  encryptFluxusCompanyCode,
} from "./fluxusCodeCrypto";

const TEST_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("cifragem do código de empresa Fluxus", () => {
  const previousKey = process.env.INTEGRATION_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.INTEGRATION_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    if (previousKey === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY;
    else process.env.INTEGRATION_ENCRYPTION_KEY = previousKey;
  });

  it("cifra e recupera o código sem expor o texto no banco", () => {
    const encrypted = encryptFluxusCompanyCode("empresa exemplo", "CODIGO-123");

    expect(encrypted).toMatch(/^v1\./);
    expect(encrypted).not.toContain("CODIGO-123");
    expect(decryptFluxusCompanyCode("empresa exemplo", encrypted)).toBe(
      "CODIGO-123"
    );
  });

  it("impede que o código seja movido para outra empresa", () => {
    const encrypted = encryptFluxusCompanyCode("empresa a", "CODIGO-123");

    expect(() => decryptFluxusCompanyCode("empresa b", encrypted)).toThrow(
      /Não foi possível decifrar/
    );
  });

  it("detecta adulteração no conteúdo cifrado", () => {
    const encrypted = encryptFluxusCompanyCode("empresa exemplo", "CODIGO-123");
    const parts = encrypted.split(".");
    const ciphertext = parts.at(-1)!;
    const position = Math.floor(ciphertext.length / 2);
    const replacement = ciphertext[position] === "A" ? "B" : "A";
    parts[parts.length - 1] = `${ciphertext.slice(0, position)}${replacement}${ciphertext.slice(position + 1)}`;

    expect(() =>
      decryptFluxusCompanyCode("empresa exemplo", parts.join("."))
    ).toThrow(/Não foi possível decifrar/);
  });

  it("mantém hashes antigos válidos e reconhece o novo formato", () => {
    const legacyHash = "$2b$12$hash-legado";
    expect(decodeFluxusCompanyCodeStorage(legacyHash)).toEqual({
      passwordHash: legacyHash,
      encryptedCode: null,
    });

    const encrypted = encryptFluxusCompanyCode("empresa exemplo", "CODIGO-123");
    expect(
      decodeFluxusCompanyCodeStorage(
        encodeFluxusCompanyCodeStorage(legacyHash, encrypted)
      )
    ).toEqual({ passwordHash: legacyHash, encryptedCode: encrypted });
  });

  it("cabe no campo legado mesmo com o código máximo de 64 caracteres", () => {
    const bcryptHash = `$2b$12$${"x".repeat(53)}`;
    const encrypted = encryptFluxusCompanyCode(
      "empresa exemplo",
      "C".repeat(64)
    );

    expect(
      encodeFluxusCompanyCodeStorage(bcryptHash, encrypted).length
    ).toBeLessThanOrEqual(255);
  });
});
