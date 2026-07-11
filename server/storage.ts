import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

type StorageMode = "forge" | "s3";

function getStorageMode(): StorageMode {
  if (ENV.forgeApiUrl && ENV.forgeApiKey) return "forge";
  if (process.env.S3_BUCKET) return "s3";

  throw new Error(
    "Armazenamento não configurado. Defina BUILT_IN_FORGE_API_URL/BUILT_IN_FORGE_API_KEY ou S3_BUCKET e credenciais AWS/S3.",
  );
}

function normalizeKey(relKey: string): string {
  const normalized = relKey
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");

  if (!normalized) throw new Error("Chave de armazenamento inválida.");
  return normalized;
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function getForgeConfig() {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    throw new Error("Infraestrutura de armazenamento integrada não configurada.");
  }

  return {
    forgeUrl: ENV.forgeApiUrl.replace(/\/+$/, ""),
    forgeKey: ENV.forgeApiKey,
  };
}

function getS3Config() {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET não configurado.");

  const region = process.env.S3_REGION || process.env.AWS_REGION || "us-east-1";
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

  const client = new S3Client({
    region,
    ...(endpoint ? { endpoint, forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true" } : {}),
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey } }
      : {}),
  });

  return { bucket, client };
}

async function forgeStoragePut(
  key: string,
  data: Buffer | Uint8Array | string,
  contentType: string,
) {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);

  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  });

  if (!presignResp.ok) {
    const message = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Falha ao preparar upload (${presignResp.status}): ${message}`);
  }

  const { url } = (await presignResp.json()) as { url?: string };
  if (!url) throw new Error("O serviço de armazenamento não devolveu URL de upload.");

  const body = typeof data === "string" ? Buffer.from(data) : data;
  const uploadResp = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: body as BodyInit,
  });

  if (!uploadResp.ok) {
    throw new Error(`Falha no upload para o armazenamento (${uploadResp.status}).`);
  }
}

async function s3StoragePut(
  key: string,
  data: Buffer | Uint8Array | string,
  contentType: string,
) {
  const { bucket, client } = getS3Config();
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: typeof data === "string" ? Buffer.from(data) : data,
    ContentType: contentType,
    CacheControl: "private, max-age=3600",
  }));
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const mode = getStorageMode();

  if (mode === "forge") {
    await forgeStoragePut(key, data, contentType);
  } else {
    await s3StoragePut(key, data, contentType);
  }

  return { key, url: `/manus-storage/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  const mode = getStorageMode();

  if (mode === "forge") {
    const { forgeUrl, forgeKey } = getForgeConfig();
    const getUrl = new URL("v1/storage/presign/get", forgeUrl + "/");
    getUrl.searchParams.set("path", key);

    const response = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${forgeKey}` },
    });

    if (!response.ok) {
      const message = await response.text().catch(() => response.statusText);
      throw new Error(`Falha ao preparar download (${response.status}): ${message}`);
    }

    const { url } = (await response.json()) as { url?: string };
    if (!url) throw new Error("O serviço de armazenamento não devolveu URL de download.");
    return url;
  }

  const { bucket, client } = getS3Config();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 300 },
  );
}
