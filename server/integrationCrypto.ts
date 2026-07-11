import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type TrelloCredentials = {
  apiKey: string;
  token: string;
};

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY não configurada no servidor.");
  }

  const key = /^[0-9a-f]{64}$/i.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");

  if (key.length !== 32) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY deve conter exatamente 32 bytes em hexadecimal ou Base64.");
  }

  return key;
}

function aadFor(userId: number): Buffer {
  return Buffer.from(`prospectafluxus:${userId}:trello`, "utf8");
}

export function isIntegrationEncryptionConfigured(): boolean {
  try {
    getEncryptionKey();
    return true;
  } catch {
    return false;
  }
}

export function encryptTrelloCredentials(userId: number, credentials: TrelloCredentials): string {
  const apiKey = credentials.apiKey.trim();
  const token = credentials.token.trim();
  if (!apiKey || !token) {
    throw new Error("Informe a API key e o token do Trello.");
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  cipher.setAAD(aadFor(userId));

  const plaintext = Buffer.from(JSON.stringify({ apiKey, token }), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptTrelloCredentials(userId: number, payload: string): TrelloCredentials {
  const [version, ivEncoded, tagEncoded, encryptedEncoded, extra] = payload.split(".");
  if (version !== VERSION || !ivEncoded || !tagEncoded || !encryptedEncoded || extra) {
    throw new Error("Credenciais Trello cifradas num formato inválido.");
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(ivEncoded, "base64url"));
    decipher.setAAD(aadFor(userId));
    decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedEncoded, "base64url")),
      decipher.final(),
    ]);
    const parsed = JSON.parse(decrypted.toString("utf8")) as Partial<TrelloCredentials>;

    if (typeof parsed.apiKey !== "string" || !parsed.apiKey || typeof parsed.token !== "string" || !parsed.token) {
      throw new Error("Conteúdo inválido.");
    }

    return { apiKey: parsed.apiKey, token: parsed.token };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("INTEGRATION_ENCRYPTION_KEY")) {
      throw error;
    }
    throw new Error("Não foi possível decifrar as credenciais Trello. Verifique a chave do servidor.");
  }
}
