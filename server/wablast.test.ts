import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  listWaBlastAccounts,
  normalizeE164Brazil,
  sendWaBlastTemplate,
  verifyWaBlastWebhookSignature,
} from "./wablast";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("WaBlast API client", () => {
  beforeEach(() => {
    vi.stubEnv("WABLAST_API_KEY", "wak_test_secret");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("normaliza números brasileiros para E.164", () => {
    expect(normalizeE164Brazil("(11) 99999-0000")).toBe("+5511999990000");
    expect(normalizeE164Brazil("+55 11 99999-0000")).toBe("+5511999990000");
    expect(() => normalizeE164Brazil("123")).toThrow(/inválido/i);
  });

  it("envia a chave somente no header de autorização", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse([{
      id: "ckv_1",
      name: "InnoFlow",
      phone_number: "+5511999990000",
      is_default: true,
      waba_id: "waba_1",
    }]));

    await expect(listWaBlastAccounts()).resolves.toHaveLength(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toBe("https://api.wablastmessage.com/v1/accounts");
    expect(String(url)).not.toContain("wak_test_secret");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer wak_test_secret");
  });

  it("envia template com parâmetros e chave de idempotência", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({
      id: "msg_1",
      meta_message_id: "wamid.1",
      to: "+5511999990000",
      status: "sent",
    }, 201));

    await sendWaBlastTemplate({
      to: "11999990000",
      accountId: "ckv_1",
      templateName: "convite_workshop",
      language: "pt_BR",
      bodyParameters: ["Ana"],
      idempotencyKey: "idem-1",
    });

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    const headers = new Headers(init?.headers);
    const body = JSON.parse(String(init?.body));
    expect(headers.get("Idempotency-Key")).toBe("idem-1");
    expect(body).toMatchObject({
      to: "+5511999990000",
      type: "template",
      account_id: "ckv_1",
      template: {
        name: "convite_workshop",
        language: "pt_BR",
        components: [{
          type: "body",
          parameters: [{ type: "text", text: "Ana" }],
        }],
      },
    });
  });
});

describe("WaBlast webhook signature", () => {
  const secretBytes = Buffer.from("0123456789abcdefghijklmn", "utf8");
  const secret = `whsec_${secretBytes.toString("base64")}`;
  const rawBody = Buffer.from(JSON.stringify({ id: "evt_1", type: "endpoint.test" }));
  const timestamp = 1_800_000_000;
  const webhookId = "evt_1";
  const signature = createHmac("sha256", secretBytes)
    .update(Buffer.concat([Buffer.from(`${webhookId}.${timestamp}.`), rawBody]))
    .digest("base64");

  it("aceita uma assinatura válida dentro da tolerância", () => {
    expect(verifyWaBlastWebhookSignature({
      rawBody,
      webhookId,
      webhookTimestamp: String(timestamp),
      webhookSignature: `v1,${signature}`,
      secret,
      nowMs: timestamp * 1000,
    })).toBe(true);
  });

  it("rejeita assinatura inválida ou timestamp antigo", () => {
    expect(verifyWaBlastWebhookSignature({
      rawBody,
      webhookId,
      webhookTimestamp: String(timestamp),
      webhookSignature: "v1,ZmFrZQ==",
      secret,
      nowMs: timestamp * 1000,
    })).toBe(false);
    expect(verifyWaBlastWebhookSignature({
      rawBody,
      webhookId,
      webhookTimestamp: String(timestamp),
      webhookSignature: `v1,${signature}`,
      secret,
      nowMs: (timestamp + 301) * 1000,
    })).toBe(false);
  });
});
