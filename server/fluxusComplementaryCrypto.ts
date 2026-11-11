import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import { COMPLEMENTARY_MAX_PDF_BYTES } from "../shared/fluxusComplementary";

const VERSION = "cpdf1";
function key(): Buffer {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY?.trim();
  if (!raw) throw new Error("Cofre de relatórios não configurado no servidor.");
  const master = /^[a-f0-9]{64}$/i.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");
  if (master.length !== 32)
    throw new Error("Chave do cofre de relatórios inválida.");
  return Buffer.from(
    hkdfSync(
      "sha256",
      master,
      "fluxus-complementary-v1",
      "private-pdf-vault",
      32
    )
  );
}
function aad(companyId: number, userId: number): Buffer {
  if (![companyId, userId].every(id => Number.isSafeInteger(id) && id > 0))
    throw new Error("Contexto do cofre inválido.");
  return Buffer.from(`fluxus:complementary-pdf:v1:${companyId}:${userId}`);
}
export function complementaryEncryptionConfigured(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}
export function encryptComplementaryPdf(
  companyId: number,
  userId: number,
  pdf: Buffer
): string {
  if (!pdf.length || pdf.length > COMPLEMENTARY_MAX_PDF_BYTES)
    throw new Error("PDF fora do limite permitido.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(aad(companyId, userId));
  const encrypted = Buffer.concat([cipher.update(pdf), cipher.final()]);
  return [
    VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}
export function decryptComplementaryPdf(
  companyId: number,
  userId: number,
  encoded: string
): Buffer {
  if (encoded.length > Math.ceil((COMPLEMENTARY_MAX_PDF_BYTES * 4) / 3) + 128)
    throw new Error("Conteúdo do cofre inválido.");
  const [version, ivText, tagText, payload, extra] = encoded.split(".");
  if (
    version !== VERSION ||
    !ivText ||
    !tagText ||
    !payload ||
    extra ||
    ![ivText, tagText, payload].every(part => /^[A-Za-z0-9_-]+$/.test(part))
  )
    throw new Error("Conteúdo do cofre inválido.");
  const iv = Buffer.from(ivText, "base64url"),
    tag = Buffer.from(tagText, "base64url");
  if (iv.length !== 12 || tag.length !== 16)
    throw new Error("Conteúdo do cofre inválido.");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAAD(aad(companyId, userId));
    decipher.setAuthTag(tag);
    const pdf = Buffer.concat([
      decipher.update(Buffer.from(payload, "base64url")),
      decipher.final(),
    ]);
    if (!pdf.length || pdf.length > COMPLEMENTARY_MAX_PDF_BYTES)
      throw new Error("Conteúdo inválido.");
    return pdf;
  } catch {
    throw new Error("Não foi possível abrir o PDF protegido.");
  }
}
