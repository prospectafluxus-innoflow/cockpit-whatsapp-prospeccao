import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  decryptTrelloCredentials,
  encryptTrelloCredentials,
  isIntegrationEncryptionConfigured,
} from "./integrationCrypto";

const TEST_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("cifragem das credenciais Trello", () => {
  const previousKey = process.env.INTEGRATION_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.INTEGRATION_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    if (previousKey === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY;
    else process.env.INTEGRATION_ENCRYPTION_KEY = previousKey;
  });

  it("cifra e decifra as credenciais sem as expor no payload", () => {
    const credentials = { apiKey: "abc123", token: "token456" };
    const encrypted = encryptTrelloCredentials(42, credentials);

    expect(encrypted).toMatch(/^v1\./);
    expect(encrypted).not.toContain(credentials.apiKey);
    expect(encrypted).not.toContain(credentials.token);
    expect(decryptTrelloCredentials(42, encrypted)).toEqual(credentials);
  });

  it("impede que outra conta decifre as mesmas credenciais", () => {
    const encrypted = encryptTrelloCredentials(42, { apiKey: "abc123", token: "token456" });
    expect(() => decryptTrelloCredentials(43, encrypted)).toThrow(/Não foi possível decifrar/);
  });

  it("deteta adulteração no conteúdo cifrado", () => {
    const encrypted = encryptTrelloCredentials(42, { apiKey: "abc123", token: "token456" });
    const replacement = encrypted.endsWith("A") ? "B" : "A";
    const tampered = `${encrypted.slice(0, -1)}${replacement}`;
    expect(() => decryptTrelloCredentials(42, tampered)).toThrow(/Não foi possível decifrar/);
  });

  it("indica configuração ausente sem aceitar uma chave inválida", () => {
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
    expect(isIntegrationEncryptionConfigured()).toBe(false);
    expect(() => encryptTrelloCredentials(42, { apiKey: "abc123", token: "token456" })).toThrow(
      /não configurada/
    );
  });
});
