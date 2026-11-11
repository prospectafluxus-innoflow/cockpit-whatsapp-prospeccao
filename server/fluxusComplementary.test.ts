import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ db: {} }));
vi.mock("./fluxusComplementaryCrypto", () => ({
  complementaryEncryptionConfigured: vi.fn(() => false),
  decryptComplementaryPdf: vi.fn(),
  encryptComplementaryPdf: vi.fn(),
}));
vi.mock("./fluxusComplementaryPdf", () => ({
  extractComplementaryPdf: vi.fn(),
}));

import {
  candidateIsEligible,
  complementaryEnabled,
  decodeCanonicalPdf,
  namesCorrelate,
  normalizeComplementaryValues,
} from "./fluxusComplementaryDb";
import { SABOTEUR_LABELS } from "../shared/fluxusComplementary";

afterEach(() => vi.unstubAllEnvs());

const baseUser = {
  role: "user" as const,
  accountType: "fluxus" as const,
  companyId: 10,
  fluxusRole: "manager" as const,
  approvalStatus: "approved" as const,
  privacyDeletedAt: null,
};

function fakePdf(): Buffer {
  return Buffer.from("%PDF-1.7\nconteúdo fictício de teste\n%%EOF", "ascii");
}

function saboteurValues() {
  return Object.fromEntries(Object.keys(SABOTEUR_LABELS).map(key => [key, 5]));
}

describe("validações puras da importação complementar", () => {
  it("mantém o flag desligado por padrão e só habilita com true explícito", () => {
    vi.stubEnv("FLUXUS_COMPLEMENTARY_ENABLED", "");
    expect(complementaryEnabled()).toBe(false);
    vi.stubEnv("FLUXUS_COMPLEMENTARY_ENABLED", "false");
    expect(complementaryEnabled()).toBe(false);
    vi.stubEnv("FLUXUS_COMPLEMENTARY_ENABLED", "true");
    expect(complementaryEnabled()).toBe(true);
  });

  it("correlaciona acentos, nomes iguais e abreviação com dois tokens", () => {
    expect(namesCorrelate("João da Silva", "Joao da Silva")).toBe(true);
    expect(namesCorrelate("Ana Beatriz Silva", "Ana B. Silva")).toBe(true);
    expect(namesCorrelate("Ana Beatriz Silva", "Ana Silva")).toBe(false);
    expect(namesCorrelate("Ana Beatriz Silva", "Bruna Beatriz Silva")).toBe(
      false
    );
    expect(namesCorrelate("Ana Beatriz Silva", "Ana")).toBe(false);
    expect(namesCorrelate("Ana Beatriz", "Anabela Beatriz")).toBe(false);
    expect(namesCorrelate("Ana Beatriz Silva", "Ana Bea Silva")).toBe(false);
  });

  it("aceita admin global em qualquer tenant, mas restringe gestor/RH ao próprio tenant", () => {
    const globalAdmin = {
      ...baseUser,
      role: "admin" as const,
      accountType: "prospecting" as const,
      companyId: 99,
      fluxusRole: "collaborator" as const,
    };
    expect(candidateIsEligible(globalAdmin, 10)).toBe(true);
    expect(candidateIsEligible(baseUser, 10)).toBe(true);
    expect(candidateIsEligible(baseUser, 99)).toBe(false);
    expect(
      candidateIsEligible({ ...baseUser, privacyDeletedAt: new Date() }, 10)
    ).toBe(false);
    expect(
      candidateIsEligible({ ...baseUser, approvalStatus: "pending" }, 10)
    ).toBe(false);
  });

  it("exige PDF Base64 canônico, header PDF e trailer plausível", () => {
    const encoded = fakePdf().toString("base64");
    expect(decodeCanonicalPdf(encoded)).toEqual(fakePdf());
    expect(() => decodeCanonicalPdf(`${encoded}\n`)).toThrow();
    expect(() =>
      decodeCanonicalPdf(
        Buffer.from("texto\n%%EOF", "ascii").toString("base64")
      )
    ).toThrow();
    expect(() =>
      decodeCanonicalPdf(
        Buffer.from("%PDF-1.7\nsem trailer", "ascii").toString("base64")
      )
    ).toThrow();
  });

  it("separa QP, Sabotadores e Crítica sem inventar zero para nulos", () => {
    expect(
      normalizeComplementaryValues({ pq: 47, saboteurs: {}, critic: {} }, "pq")
    ).toEqual({ pq: 47, saboteurs: {}, critic: {} });
    expect(
      normalizeComplementaryValues(
        { pq: 47, saboteurs: { stickler: null }, critic: { self: null } },
        "pq"
      )
    ).toEqual({ pq: 47, saboteurs: {}, critic: {} });
    expect(
      normalizeComplementaryValues(
        { pq: null, saboteurs: saboteurValues(), critic: { self: null } },
        "saboteurs"
      )
    ).toMatchObject({ pq: null, critic: { self: null } });
    expect(() =>
      normalizeComplementaryValues(
        { pq: null, saboteurs: {}, critic: {} },
        "saboteurs"
      )
    ).toThrow();
    expect(() =>
      normalizeComplementaryValues(
        { pq: 47, saboteurs: { stickler: 1 }, critic: {} },
        "pq"
      )
    ).toThrow();
    expect(() =>
      normalizeComplementaryValues(
        { pq: null, saboteurs: saboteurValues(), critic: { self: 0 } },
        "saboteurs"
      )
    ).toThrow();
    expect(() =>
      normalizeComplementaryValues(
        { pq: 47, saboteurs: {}, critic: {}, extra: 1 },
        "pq"
      )
    ).toThrow();
  });

  it("preserva pontuações decimais dos Sabotadores e rejeita valores não finitos", () => {
    const saboteurs = {
      ...saboteurValues(),
      hyperVigilant: 6.5,
      restless: 5.5,
      victim: 3.5,
    };
    expect(
      normalizeComplementaryValues(
        { pq: null, saboteurs, critic: {} },
        "saboteurs"
      ).saboteurs
    ).toEqual(saboteurs);
    for (const bad of [NaN, Infinity, -0.5, 10.5]) {
      expect(() =>
        normalizeComplementaryValues(
          { pq: null, saboteurs: { ...saboteurs, stickler: bad }, critic: {} },
          "saboteurs"
        )
      ).toThrow();
    }
  });
});
