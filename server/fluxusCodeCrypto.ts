import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const STORED_SEPARATOR = "|enc:";

function getEncryptionKey(): Buffer {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY não configurada no servidor.");
  }

  const key = /^[0-9a-f]{64}$/i.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");

  if (key.length !== 32) {
    throw new Error(
      "INTEGRATION_ENCRYPTION_KEY deve conter exatamente 32 bytes em hexadecimal ou Base64."
    );
  }

  return key;
}

function aadFor(normalizedCompanyName: string): Buffer {
  return Buffer.from(
    `prospectafluxus:fluxus-company-code:${normalizedCompanyName}`,
    "utf8"
  );
}

export function encryptFluxusCompanyCode(
  normalizedCompanyName: string,
  accessCode: string
): string {
  const code = accessCode.trim();
  if (!normalizedCompanyName || !code) {
    throw new Error("Empresa e código são obrigatórios para a criptografia.");
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  cipher.setAAD(aadFor(normalizedCompanyName));

  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(code, "utf8")),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptFluxusCompanyCode(
  normalizedCompanyName: string,
  payload: string
): string {
  const [version, ivEncoded, tagEncoded, encryptedEncoded, extra] =
    payload.split(".");
  if (
    version !== VERSION ||
    !ivEncoded ||
    !tagEncoded ||
    !encryptedEncoded ||
    extra
  ) {
    throw new Error("Código Fluxus cifrado num formato inválido.");
  }

  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      getEncryptionKey(),
      Buffer.from(ivEncoded, "base64url")
    );
    decipher.setAAD(aadFor(normalizedCompanyName));
    decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedEncoded, "base64url")),
      decipher.final(),
    ]).toString("utf8");

    if (!decrypted) throw new Error("Conteúdo vazio.");
    return decrypted;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("INTEGRATION_ENCRYPTION_KEY")
    ) {
      throw error;
    }
    throw new Error(
      "Não foi possível decifrar o código Fluxus. Verifique a chave do servidor."
    );
  }
}

export function encodeFluxusCompanyCodeStorage(
  passwordHash: string,
  encryptedCode: string
): string {
  return `${passwordHash}${STORED_SEPARATOR}${encryptedCode}`;
}

export function decodeFluxusCompanyCodeStorage(stored: string): {
  passwordHash: string;
  encryptedCode: string | null;
} {
  const separatorIndex = stored.indexOf(STORED_SEPARATOR);
  if (separatorIndex < 0) {
    return { passwordHash: stored, encryptedCode: null };
  }
  return {
    passwordHash: stored.slice(0, separatorIndex),
    encryptedCode: stored.slice(separatorIndex + STORED_SEPARATOR.length),
  };
}
