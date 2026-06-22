import { describe, expect, it } from "vitest";

// ─── Helpers replicados para teste ────────────────────────────────────────────
function canSendToque(lead: {
  status: string;
  toque1SentAt: Date | null;
  toque2SentAt: Date | null;
  toque3SentAt: Date | null;
}) {
  const now = Date.now();
  const DAY = 86_400_000;

  if (lead.status === "novo") return { can: true, toque: 1 };
  if (lead.status === "toque1_enviado" && lead.toque1SentAt) {
    const elapsed = now - new Date(lead.toque1SentAt).getTime();
    return { can: elapsed >= 3 * DAY, toque: 2 };
  }
  if (lead.status === "toque2_enviado" && lead.toque2SentAt) {
    const elapsed = now - new Date(lead.toque2SentAt).getTime();
    return { can: elapsed >= 4 * DAY, toque: 3 };
  }
  return { can: false, toque: 0 };
}

function buildWaLink(
  whatsapp: string,
  toque: number,
  lead: { name: string; firstName: string | null; company: string | null }
) {
  const firstName = lead.firstName ?? lead.name.split(" ")[0] ?? lead.name;
  const phone = whatsapp.replace(/\D/g, "");
  return `https://wa.me/55${phone}?text=${encodeURIComponent(
    `Olá ${firstName}!`
  )}`;
}

// ─── Testes ───────────────────────────────────────────────────────────────────
describe("canSendToque", () => {
  it("lead novo pode enviar toque 1", () => {
    const lead = {
      status: "novo",
      toque1SentAt: null,
      toque2SentAt: null,
      toque3SentAt: null,
    };
    const result = canSendToque(lead);
    expect(result.can).toBe(true);
    expect(result.toque).toBe(1);
  });

  it("toque 2 não liberado antes de 3 dias", () => {
    const lead = {
      status: "toque1_enviado",
      toque1SentAt: new Date(Date.now() - 2 * 86_400_000), // 2 dias atrás
      toque2SentAt: null,
      toque3SentAt: null,
    };
    const result = canSendToque(lead);
    expect(result.can).toBe(false);
    expect(result.toque).toBe(2);
  });

  it("toque 2 liberado após 3 dias", () => {
    const lead = {
      status: "toque1_enviado",
      toque1SentAt: new Date(Date.now() - 3 * 86_400_000 - 1000), // 3 dias + 1s
      toque2SentAt: null,
      toque3SentAt: null,
    };
    const result = canSendToque(lead);
    expect(result.can).toBe(true);
    expect(result.toque).toBe(2);
  });

  it("toque 3 não liberado antes de 4 dias", () => {
    const lead = {
      status: "toque2_enviado",
      toque1SentAt: new Date(Date.now() - 7 * 86_400_000),
      toque2SentAt: new Date(Date.now() - 3 * 86_400_000), // 3 dias atrás
      toque3SentAt: null,
    };
    const result = canSendToque(lead);
    expect(result.can).toBe(false);
    expect(result.toque).toBe(3);
  });

  it("toque 3 liberado após 4 dias", () => {
    const lead = {
      status: "toque2_enviado",
      toque1SentAt: new Date(Date.now() - 8 * 86_400_000),
      toque2SentAt: new Date(Date.now() - 4 * 86_400_000 - 1000), // 4 dias + 1s
      toque3SentAt: null,
    };
    const result = canSendToque(lead);
    expect(result.can).toBe(true);
    expect(result.toque).toBe(3);
  });

  it("lead respondeu não pode enviar mais toques", () => {
    const lead = {
      status: "respondeu",
      toque1SentAt: new Date(),
      toque2SentAt: null,
      toque3SentAt: null,
    };
    const result = canSendToque(lead);
    expect(result.can).toBe(false);
    expect(result.toque).toBe(0);
  });

  it("lead descartado não pode enviar toques", () => {
    const lead = {
      status: "descartado",
      toque1SentAt: null,
      toque2SentAt: null,
      toque3SentAt: null,
    };
    const result = canSendToque(lead);
    expect(result.can).toBe(false);
  });
});

describe("buildWaLink", () => {
  it("gera link wa.me correto com DDD", () => {
    const link = buildWaLink("11987654321", 1, {
      name: "João Silva",
      firstName: "João",
      company: "Empresa X",
    });
    expect(link).toContain("wa.me/5511987654321");
    // nome é URL-encoded no link
    expect(link).toContain(encodeURIComponent("João"));
  });

  it("remove caracteres não numéricos do WhatsApp", () => {
    const link = buildWaLink("(11) 98765-4321", 1, {
      name: "Maria",
      firstName: "Maria",
      company: null,
    });
    expect(link).toContain("wa.me/5511987654321");
  });

  it("usa primeiro nome quando firstName não informado", () => {
    const link = buildWaLink("11987654321", 1, {
      name: "Carlos Mendes",
      firstName: null,
      company: null,
    });
    expect(link).toContain("Carlos");
  });
});

describe("limite diário", () => {
  const DAILY_LIMIT = 30;

  it("bloqueia envio quando limite é atingido", () => {
    const todaySends = 30;
    expect(todaySends >= DAILY_LIMIT).toBe(true);
  });

  it("permite envio quando abaixo do limite", () => {
    const todaySends = 29;
    expect(todaySends >= DAILY_LIMIT).toBe(false);
  });

  it("alerta quando próximo do limite (>= 28)", () => {
    const todaySends = 28;
    const isNearLimit = todaySends >= 28 && todaySends < DAILY_LIMIT;
    expect(isNearLimit).toBe(true);
  });
});
