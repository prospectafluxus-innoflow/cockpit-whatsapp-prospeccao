import { describe, expect, it, beforeEach, vi } from "vitest";
import { TRPCError } from "@trpc/server";

const mocks = vi.hoisted(() => {
  const selectRows: unknown[][] = [];
  const updateRows: unknown[][] = [];
  const insertRows: unknown[][] = [];
  const dbOps: Array<{ operation: string; args: unknown[] }> = [];

  const builder = (rows: unknown[], operation: string) => {
    const chain: Record<string, any> = {
      from: vi.fn(() => chain),
      innerJoin: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      set: vi.fn((...args: unknown[]) => {
        dbOps.push({ operation: `${operation}.set`, args });
        return chain;
      }),
      values: vi.fn((...args: unknown[]) => {
        dbOps.push({ operation: `${operation}.values`, args });
        return chain;
      }),
      returning: vi.fn((...args: unknown[]) => {
        dbOps.push({ operation: `${operation}.returning`, args });
        return chain;
      }),
      then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve(rows).then(resolve, reject),
    };
    return chain;
  };

  const select = vi.fn((...args: unknown[]) => {
    dbOps.push({ operation: "select", args });
    if (!selectRows.length) throw new Error("select queue exhausted");
    return builder(selectRows.shift()!, "select");
  });
  const update = vi.fn((...args: unknown[]) => {
    dbOps.push({ operation: "update", args });
    if (!updateRows.length) throw new Error("update queue exhausted");
    return builder(updateRows.shift()!, "update");
  });
  const insert = vi.fn((...args: unknown[]) => {
    dbOps.push({ operation: "insert", args });
    if (!insertRows.length) throw new Error("insert queue exhausted");
    return builder(insertRows.shift()!, "insert");
  });

  return {
    selectRows,
    updateRows,
    insertRows,
    dbOps,
    select,
    update,
    insert,
    getFluxusDirectTeamUserIds: vi.fn(),
    recordFluxusAudit: vi.fn(),
  };
});

vi.mock("./db", () => ({
  db: {
    select: mocks.select,
    update: mocks.update,
    insert: mocks.insert,
  },
}));
vi.mock("./fluxusOrganization", () => ({
  getFluxusDirectTeamUserIds: mocks.getFluxusDirectTeamUserIds,
}));
vi.mock("./fluxusDb", () => ({
  recordFluxusAudit: mocks.recordFluxusAudit,
}));

import {
  CURRENT_FLUXUS_FORMULA_VERSION,
  CURRENT_FLUXUS_INSTRUMENT_VERSION,
} from "../shared/fluxusVersioning";
import { FLUXUS_V2_ITEMS, calculateFluxusV2Result } from "../shared/fluxusV2";
import { emptyExecutiveNotes, type ExecutiveNotes } from "../shared/fluxusExecutive";
import {
  getExecutiveDirectory,
  getExecutivePreview,
  listExecutiveReports,
  previewExecutive,
  saveExecutiveReport,
} from "./fluxusExecutiveDb";

const COMPANY_ID = 10;
const OTHER_COMPANY_ID = 20;
const ASSESSMENT_ID = 101;
const USER_ID = 501;
const OTHER_USER_ID = 502;
const FIXED_NOW = new Date("2026-01-02T03:04:05.000Z");
const answers5 = Object.fromEntries(FLUXUS_V2_ITEMS.map(item => [item.id, 5]));
const canonicalResult = () => calculateFluxusV2Result(answers5, FIXED_NOW);

const company = (overrides: Record<string, unknown> = {}) => ({
  id: COMPANY_ID,
  name: "Acme Fluxus",
  reportVisibility: "participant_manager_hr",
  beta2OrganizationAccessApprovedAt: FIXED_NOW,
  minimumAggregateSize: 5,
  ...overrides,
});

const assessment = (
  id = ASSESSMENT_ID,
  userId = USER_ID,
  overrides: Record<string, unknown> = {}
) => ({
  assessmentId: id,
  userId,
  companyId: COMPANY_ID,
  cycleNumber: 1,
  cycleLabel: "Ciclo 1",
  instrumentVersion: CURRENT_FLUXUS_INSTRUMENT_VERSION,
  formulaVersion: CURRENT_FLUXUS_FORMULA_VERSION,
  result: canonicalResult(),
  completedAt: FIXED_NOW,
  name: `Pessoa ${userId}`,
  jobTitle: "Analista",
  department: "Produto",
  ...overrides,
});

const viewer = (
  id: number,
  overrides: Partial<{
    role: "user" | "admin";
    accountType: "prospecting" | "fluxus";
    companyId: number | null;
    fluxusRole: "collaborator" | "manager" | "hr";
  }> = {}
) => ({
  id,
  role: "user" as const,
  accountType: "fluxus" as const,
  companyId: COMPANY_ID,
  fluxusRole: "hr" as const,
  ...overrides,
});

const savedReport = (overrides: Record<string, unknown> = {}) => ({
  id: 900,
  companyId: COMPANY_ID,
  createdBy: 999,
  mode: "team" as const,
  assessmentIds: [ASSESSMENT_ID],
  notes: emptyExecutiveNotes(),
  revision: 1,
  createdAt: FIXED_NOW,
  updatedAt: FIXED_NOW,
  ...overrides,
});

const notesWithIndividual = (assessmentId: number): ExecutiveNotes => ({
  ...emptyExecutiveNotes(),
  individuals: {
    [assessmentId]: { summary: "Conversa", context: "", recommendations: "" },
  },
});

function queueSelect(...rows: unknown[][]) {
  mocks.selectRows.push(...rows);
}

function queueUpdate(...rows: unknown[][]) {
  mocks.updateRows.push(...rows);
}

function queueInsert(...rows: unknown[][]) {
  mocks.insertRows.push(...rows);
}

function expectCode(promise: Promise<unknown>, code: TRPCError["code"]) {
  return expect(promise).rejects.toMatchObject({ code });
}

beforeEach(() => {
  mocks.selectRows.length = 0;
  mocks.updateRows.length = 0;
  mocks.insertRows.length = 0;
  mocks.dbOps.length = 0;
  vi.clearAllMocks();
  mocks.getFluxusDirectTeamUserIds.mockResolvedValue(new Set([USER_ID, OTHER_USER_ID]));
});

describe("segurança da visão executiva Fluxus", () => {
  it("nega colaborador mesmo com empresa Beta 2 aprovada", async () => {
    queueSelect([company()]);

    await expectCode(
      getExecutiveDirectory(viewer(1, { fluxusRole: "collaborator" })),
      "FORBIDDEN"
    );
    expect(mocks.select).toHaveBeenCalledTimes(1);
    expect(mocks.recordFluxusAudit).not.toHaveBeenCalled();
  });

  it("nega account prospecting e mantém o override somente para admin da plataforma", async () => {
    queueSelect([company()]);
    await expectCode(
      getExecutiveDirectory(
        viewer(2, { accountType: "prospecting", companyId: COMPANY_ID })
      ),
      "FORBIDDEN"
    );

    queueSelect([company()], [assessment()]);
    const result = await getExecutiveDirectory(
      viewer(3, {
        role: "admin",
        accountType: "prospecting",
        companyId: null,
      }),
      COMPANY_ID
    );
    expect(result.people).toHaveLength(1);
    expect(mocks.recordFluxusAudit).toHaveBeenCalledTimes(1);
  });

  it("nega viewer de outro tenant antes de carregar avaliações", async () => {
    queueSelect([company()]);

    await expectCode(
      getExecutiveDirectory(
        viewer(4, { companyId: OTHER_COMPANY_ID, fluxusRole: "hr" }),
        COMPANY_ID
      ),
      "FORBIDDEN"
    );
    expect(mocks.select).toHaveBeenCalledTimes(1);
    expect(mocks.recordFluxusAudit).not.toHaveBeenCalled();
  });

  it("nega HR quando o consentimento organizacional Beta 2 não foi aprovado", async () => {
    queueSelect([company({ beta2OrganizationAccessApprovedAt: null })]);

    await expectCode(getExecutiveDirectory(viewer(5)), "FORBIDDEN");
    expect(mocks.recordFluxusAudit).not.toHaveBeenCalled();
  });

  it("não usa fallback de empresa para manager com escopo vazio e retorna diretório vazio", async () => {
    mocks.getFluxusDirectTeamUserIds.mockResolvedValue(new Set());
    queueSelect([company()], [assessment()]);

    const result = await getExecutiveDirectory(viewer(6, { fluxusRole: "manager" }));

    expect(result.people).toEqual([]);
    expect(mocks.recordFluxusAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "executive.directory",
        metadata: { returned: 0, truncated: false },
      })
    );
  });

  it("nega preview de manager fora do escopo, inclusive sem fallback para a empresa", async () => {
    mocks.getFluxusDirectTeamUserIds.mockResolvedValue(new Set());
    queueSelect([company()], [assessment()]);

    await expectCode(
      previewExecutive(viewer(7, { fluxusRole: "manager" }), {
        companyId: COMPANY_ID,
        mode: "individual",
        assessmentIds: [ASSESSMENT_ID],
      }),
      "FORBIDDEN"
    );
    expect(mocks.recordFluxusAudit).not.toHaveBeenCalled();
  });

  it("nega manager que tenta ler usuário que não pertence ao seu escopo direto", async () => {
    mocks.getFluxusDirectTeamUserIds.mockResolvedValue(new Set([OTHER_USER_ID]));
    queueSelect([company()], [assessment(ASSESSMENT_ID, USER_ID)]);

    await expectCode(
      previewExecutive(viewer(8, { fluxusRole: "manager" }), {
        companyId: COMPANY_ID,
        mode: "individual",
        assessmentIds: [ASSESSMENT_ID],
      }),
      "FORBIDDEN"
    );
    expect(mocks.recordFluxusAudit).not.toHaveBeenCalled();
  });

  it("rejeita seleção mista inválida atomicamente, sem insert nem auditoria", async () => {
    queueSelect([company()], [assessment(ASSESSMENT_ID, USER_ID)]);

    await expectCode(
      saveExecutiveReport(viewer(9), {
        selection: {
          companyId: COMPANY_ID,
          mode: "team",
          assessmentIds: [ASSESSMENT_ID, 999],
        },
        notes: emptyExecutiveNotes(),
      }),
      "BAD_REQUEST"
    );
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.recordFluxusAudit).not.toHaveBeenCalled();
  });

  it("rejeita duas avaliações da mesma pessoa antes de inserir o relatório", async () => {
    queueSelect(
      [company()],
      [assessment(ASSESSMENT_ID, USER_ID), assessment(102, USER_ID)]
    );

    await expectCode(
      saveExecutiveReport(viewer(10), {
        selection: {
          companyId: COMPANY_ID,
          mode: "team",
          assessmentIds: [ASSESSMENT_ID, 102],
        },
        notes: emptyExecutiveNotes(),
      }),
      "BAD_REQUEST"
    );
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.recordFluxusAudit).not.toHaveBeenCalled();
  });

  it("rejeita resultado cuja fórmula interna diverge do metadata da avaliação", async () => {
    const mismatchedResult = {
      ...canonicalResult(),
      formulaVersion: "2.0.0-beta.1",
    };
    queueSelect(
      [company()],
      [
        assessment(ASSESSMENT_ID, USER_ID, {
          result: mismatchedResult,
          formulaVersion: CURRENT_FLUXUS_FORMULA_VERSION,
        }),
      ]
    );

    await expectCode(
      previewExecutive(viewer(11), {
        companyId: COMPANY_ID,
        mode: "individual",
        assessmentIds: [ASSESSMENT_ID],
      }),
      "BAD_REQUEST"
    );
    expect(mocks.recordFluxusAudit).not.toHaveBeenCalled();
  });

  it("permite leitura salva a manager autorizada que não é a criadora, mas mantém read-only", async () => {
    const report = savedReport({ createdBy: 999 });
    queueSelect([report], [company()], [assessment()]);

    const result = await getExecutivePreview(
      viewer(12, { fluxusRole: "manager" }),
      report.id
    );

    expect(result.report).toMatchObject({ id: report.id, revision: 1 });
    expect(result.canEdit).toBe(false);
    expect(result.data.people[0]?.assessmentId).toBe(ASSESSMENT_ID);
    expect(mocks.recordFluxusAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "executive.read", resourceType: "executive_report" })
    );
  });

  it("nega get e oculta da listagem o relatório quando o escopo do manager foi revogado", async () => {
    const report = savedReport();
    mocks.getFluxusDirectTeamUserIds.mockResolvedValue(new Set());
    queueSelect([report], [company()], [assessment()]);

    await expectCode(
      getExecutivePreview(viewer(13, { fluxusRole: "manager" }), report.id),
      "FORBIDDEN"
    );
    expect(mocks.recordFluxusAudit).not.toHaveBeenCalled();

    queueSelect([company()], [report], [assessment()]);
    const listed = await listExecutiveReports(
      viewer(13, { fluxusRole: "manager" }),
      COMPANY_ID
    );
    expect(listed).toEqual([]);
  });

  it("retorna CONFLICT quando update otimista não encontra a revisão esperada", async () => {
    const report = savedReport({ createdBy: 14 });
    queueSelect([report], [company()], [assessment()]);
    queueUpdate([]);

    await expectCode(
      saveExecutiveReport(viewer(14), {
        reportId: report.id,
        expectedRevision: report.revision,
        selection: {
          companyId: COMPANY_ID,
          mode: "team",
          assessmentIds: [ASSESSMENT_ID],
        },
        notes: emptyExecutiveNotes(),
      }),
      "CONFLICT"
    );
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.dbOps.map(({ operation }) => operation)).toEqual([
      "select",
      "select",
      "select",
      "update",
      "update.set",
      "update.returning",
    ]);
    expect(mocks.recordFluxusAudit).not.toHaveBeenCalled();
  });

  it("não permite mutar os assessmentIds do snapshot salvo", async () => {
    const report = savedReport({ assessmentIds: [ASSESSMENT_ID] });
    queueSelect([report]);

    await expectCode(
      saveExecutiveReport(viewer(15), {
        reportId: report.id,
        expectedRevision: report.revision,
        selection: {
          companyId: COMPANY_ID,
          mode: "team",
          assessmentIds: [102],
        },
        notes: emptyExecutiveNotes(),
      }),
      "BAD_REQUEST"
    );
    expect(mocks.select).toHaveBeenCalledTimes(1);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.recordFluxusAudit).not.toHaveBeenCalled();
  });

  it("rejeita ficha individual fora da seleção sem inserir nem auditar", async () => {
    queueSelect([company()], [assessment()]);

    await expectCode(
      saveExecutiveReport(viewer(16), {
        selection: {
          companyId: COMPANY_ID,
          mode: "individual",
          assessmentIds: [ASSESSMENT_ID],
        },
        notes: notesWithIndividual(999),
      }),
      "BAD_REQUEST"
    );
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.recordFluxusAudit).not.toHaveBeenCalled();
  });

  it("salva snapshot válido e audita somente depois do insert", async () => {
    const inserted = savedReport({ id: 901, createdBy: 17, revision: 1 });
    queueSelect([company()], [assessment()]);
    queueInsert([inserted]);

    const result = await saveExecutiveReport(viewer(17), {
      selection: {
        companyId: COMPANY_ID,
        mode: "individual",
        assessmentIds: [ASSESSMENT_ID],
      },
      notes: emptyExecutiveNotes(),
    });

    expect(result).toMatchObject({ id: 901, companyId: COMPANY_ID, revision: 1 });
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.dbOps.map(({ operation }) => operation)).toEqual([
      "select",
      "select",
      "insert",
      "insert.values",
      "insert.returning",
    ]);
    expect(mocks.dbOps.find(({ operation }) => operation === "insert.values")?.args[0]).toMatchObject({
      companyId: COMPANY_ID,
      createdBy: 17,
      mode: "individual",
      assessmentIds: [ASSESSMENT_ID],
      revision: 1,
    });
    expect(mocks.recordFluxusAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "executive.save", resourceType: "executive_report" })
    );
  });
});
