import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const selectRows: unknown[][] = [];
  const insertRows: unknown[][] = [];
  const builders: Array<Record<string, any>> = [];

  const builder = (rows: unknown[], operation: string) => {
    const chain: Record<string, any> = {
      from: vi.fn(() => chain),
      innerJoin: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      for: vi.fn(() => chain),
      values: vi.fn(() => chain),
      then: (
        resolve: (value: unknown[]) => unknown,
        reject?: (reason: unknown) => unknown
      ) => Promise.resolve(rows).then(resolve, reject),
    };
    chain.operation = operation;
    builders.push(chain);
    return chain;
  };

  const select = vi.fn((...args: unknown[]) => {
    const rows = selectRows.shift();
    if (!rows) throw new Error("select queue exhausted");
    const query = builder(rows, "select");
    query.selectArgs = args;
    return query;
  });
  const insert = vi.fn(() => {
    const rows = insertRows.shift() ?? [];
    return builder(rows, "insert");
  });
  const transaction = vi.fn(async (callback: (tx: unknown) => unknown) =>
    callback({ select, insert })
  );

  return { selectRows, insertRows, builders, select, insert, transaction };
});

vi.mock("./db", () => ({
  db: {
    transaction: mocks.transaction,
  },
}));

import { COMPLEMENTARY_TERMS_VERSION } from "../shared/fluxusComplementary";
import { readExecutiveComplementarySources } from "./fluxusComplementaryDb";

const viewer = {
  id: 900,
  name: "Gestor Atual",
  role: "user",
  accountType: "fluxus",
  companyId: 10,
  fluxusRole: "manager",
  approvalStatus: "approved",
  privacyDeletedAt: null,
};

function source(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: 1,
    companyId: 10,
    userId: 501,
    assessmentId: 101,
    kind: "pq",
    status: "confirmed",
    revision: 2,
    termsVersion: COMPLEMENTARY_TERMS_VERSION,
    sourceDate: "2026-11-11",
    values: { pq: 47, saboteurs: {}, critic: {} },
    context: "Contexto informado pelo titular",
    recipientSnapshot: [
      { id: viewer.id, name: viewer.name, roleLabel: "Gestor" },
    ],
    confirmedAt: new Date("2026-11-12T10:00:00.000Z"),
    ownerApprovalStatus: "approved",
    ownerPrivacyDeletedAt: null,
    ownerAccountType: "fluxus",
    ownerRole: "user",
    ownerCompanyId: 10,
    companyActive: 1,
    ...overrides,
  };
}

function queueViewer() {
  mocks.selectRows.push([viewer]);
}

beforeEach(() => {
  mocks.selectRows.length = 0;
  mocks.insertRows.length = 0;
  mocks.builders.length = 0;
  vi.clearAllMocks();
});

describe("leitura complementar da visão executiva", () => {
  it("não amplia retroativamente a finalidade de um consentimento antigo", async () => {
    mocks.selectRows.push([source({ termsVersion: "2026-11-11.v1" })]);
    expect(
      await readExecutiveComplementarySources(900, 10, [
        { userId: 501, assessmentId: 101 },
      ])
    ).toEqual({});
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("escolhe uma fonte por tipo, ignora valores inválidos e não busca conteúdo do PDF", async () => {
    mocks.selectRows.push([
      source({
        id: 3,
        sourceDate: "2026-12-01",
        values: { pq: "não é número", saboteurs: {}, critic: {} },
      }),
      source({ id: 2, sourceDate: "2026-11-01" }),
      source({
        id: 4,
        kind: "saboteurs",
        sourceDate: "2026-10-01",
        values: {
          pq: null,
          saboteurs: {
            stickler: 1,
            pleaser: 2,
            hyperVigilant: 3,
            restless: 4,
            controller: 5,
            avoider: 6,
            hyperAchiever: 7,
            victim: 8,
            hyperRational: 9,
          },
          critic: {},
        },
      }),
    ]);
    queueViewer();
    queueViewer();
    queueViewer();

    const result = await readExecutiveComplementarySources(900, 10, [
      { userId: 501, assessmentId: 101 },
    ]);

    expect(result["101"]?.pq).toMatchObject({
      id: 2,
      sourceDate: "2026-11-01",
    });
    expect(result["101"]?.saboteurs).toMatchObject({ id: 4 });
    expect(result["101"]?.pq?.values.pq).toBe(47);
    expect(result["101"]?.pq?.values.pq).not.toBe(0);
    expect(Object.keys(mocks.select.mock.calls[0]![0] as object)).not.toEqual(
      expect.arrayContaining(["pdfCiphertext", "fileName", "sourceName"])
    );
    expect(mocks.builders[0]?.for).toHaveBeenCalledWith("share");
    expect(mocks.insert).toHaveBeenCalledTimes(2);
  });

  it("não permite que titular sem consentimento nominativo apareça no painel", async () => {
    mocks.selectRows.push([source({ recipientSnapshot: [] })]);
    queueViewer();

    await expect(
      readExecutiveComplementarySources(900, 10, [
        { userId: 501, assessmentId: 101 },
      ])
    ).resolves.toEqual({});
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("limita a seleção a duzentas pessoas antes de abrir transação", async () => {
    const people = Array.from({ length: 201 }, (_, index) => ({
      userId: index + 1,
      assessmentId: index + 1000,
    }));

    await expect(
      readExecutiveComplementarySources(900, 10, people)
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
