import type { Request, Response } from "express";
import {
  isWaBlastWebhookConfigured,
  verifyWaBlastWebhookSignature,
  type WaBlastWebhookEnvelope,
} from "./wablast";
import { processWaBlastWebhook } from "./wablastService";

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isWebhookEnvelope(value: unknown): value is WaBlastWebhookEnvelope {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string"
    && typeof record.type === "string"
    && typeof record.api_version === "string"
    && typeof record.created_at === "string"
    && Boolean(record.data)
    && typeof record.data === "object";
}

export async function wablastWebhookHandler(req: Request, res: Response) {
  if (!isWaBlastWebhookConfigured()) {
    res.status(503).json({ error: "Webhook WaBlast não configurado." });
    return;
  }

  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
  const verified = verifyWaBlastWebhookSignature({
    rawBody,
    webhookId: firstHeader(req.headers["webhook-id"]),
    webhookTimestamp: firstHeader(req.headers["webhook-timestamp"]),
    webhookSignature: firstHeader(req.headers["webhook-signature"]),
  });
  if (!verified) {
    res.status(401).json({ error: "Assinatura inválida." });
    return;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    res.status(400).json({ error: "JSON inválido." });
    return;
  }
  if (!isWebhookEnvelope(payload)) {
    res.status(400).json({ error: "Envelope de webhook inválido." });
    return;
  }

  try {
    const result = await processWaBlastWebhook(payload);
    res.status(200).json({ received: true, duplicate: result.duplicate });
  } catch (error) {
    console.error("[WaBlast] Falha ao processar webhook:", error instanceof Error ? error.message : error);
    res.status(500).json({ error: "Falha ao processar evento." });
  }
}
