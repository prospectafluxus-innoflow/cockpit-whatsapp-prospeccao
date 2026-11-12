import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";

const mocks = vi.hoisted(() => {
  const selectRows: unknown[][] = [];
  const builders: Array<Record<string, any>> = [];

  const builder = (rows: unknown[], operation: string) => {
    const chain: Record<string, any> = {
      from: vi.fn(() => chain),
      innerJoin: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn(() => chain),
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

  return {
    selectRows,
    builders,
    select,
    getFluxusDirectTeamUserIds: vi.fn(),
    recordFluxusAudit: vi.fn(),
    readExecutiveComplementarySources: vi.fn().mockResolvedValue({}),
  };
});

vi.mock("./db", () => ({
  db: { select: mocks.select },
}));
vi.mock("./fluxusOrganization", () => ({
  getFluxusDirectTeamUserIds: mocks.getFluxusDirectTeamUserIds,
}));
vi.mock("./fluxusDb", () => ({
  recordFluxusAudit: mocks.recordFluxusAudit,
}));
vi.mock("./fluxusComplementaryDb", () => ({
  readExecutiveComplementarySources: mocks.readExecutiveComplementarySources,
}));

import {
  CURRENT_FLUXUS_FORMULA_VERSION,
  CURRENT_FLUXUS_INSTRUMENT_VERSION,
} from "../shared/fluxusVersioning";
import { FLUXUS_V2_ITEMS, calculateFluxusV2Result } from "../shared/fluxusV2";
import { emptyExecutiveNotes } from "../shared/fluxusExecutive";
import { getMyExecutiveReport, previewExecutive } from "./fluxusExecutiveDb";

const COMPANY_ID = 10;
const OTHER_COMPANY_ID = 20;
const USER_ID = 501;
const OTHER_USER_ID = 502;
const ASSESSMENT_ID = 101;
const FIXED_NOW = new Date("2026-01-02T03:04:05.000Z");
const answers5 = Object.fromEntries(FLUXUS_V2_ITEMS.map(item => [item.id, 5]));
const canonicalResult = () => calculateFluxusV2Result(answers5, FIXED_NOW);

const company = (overrides: Record<string, unknown> = {}) => ({
  id: COMPANY_ID,
  name: "Acme Fluxus",
  active: 1,
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

const viewer = (id = USER_ID, overrides: Record<string, unknown> = {}) => ({
  id,
  role: "user" as const,
  accountType: "fluxus" as const,
  companyId: COMPANY_ID,
  fluxusRole: "collaborator" as const,
  ...overrides,
});

function queueSelect(...rows: unknown[][]) {
  mocks.selectRows.push(...rows);
}

function expectCode(promise: Promise<unknown>, code: TRPCError["code"]) {
  return expect(promise).rejects.toMatchObject({ code });
}

beforeEach(() => {
  mocks.selectRows.length = 0;
  mocks.builders.length = 0;
  vi.clearAllMocks();
});

describe("namespace executivo próprio", () => {
  it("retorna somente a Beta 2 canônica própria mais recente, sem notas salvas", async () => {
    const complementary = {
      [String(ASSESSMENT_ID)]: {
        pq: {
          id: 701,
          revision: 2,
          userId: USER_ID,
          assessmentId: ASSESSMENT_ID,
          kind: "pq",
          sourceDate: "2026-01-01",
          confirmedAt: "2026-01-02T10:00:00.000Z",
          values: { pq: 47, saboteurs: {}, critic: {} },
          context: null,
        },
      },
    };
    mocks.readExecutiveComplementarySources.mockResolvedValueOnce(
      complementary
    );
    queueSelect([company()], [assessment()]);

    const result = await getMyExecutiveReport(viewer());

    expect(result.data.mode).toBe("individual");
    expect(result.data.people).toHaveLength(1);
    expect(result.data.people[0]).toMatchObject({
      userId: USER_ID,
      assessmentId: ASSESSMENT_ID,
    });
    expect(result.data.people[0]?.complementary).toEqual(
      complementary[String(ASSESSMENT_ID)]
    );
    expect(result.notes).toEqual(emptyExecutiveNotes());
    expect(result.report).toBeNull();
    expect(result.canEdit).toBe(false);
    expect(mocks.builders[1]?.limit).not.toHaveBeenCalled();
    expect(mocks.getFluxusDirectTeamUserIds).not.toHaveBeenCalled();
    expect(mocks.readExecutiveComplementarySources).toHaveBeenCalledWith(
      USER_ID,
      COMPANY_ID,
      [{ userId: USER_ID, assessmentId: ASSESSMENT_ID }]
    );
    expect(mocks.recordFluxusAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: USER_ID,
        companyId: COMPANY_ID,
        action: "executive.read",
        metadata: { mode: "individual", count: 1, scope: "self" },
      })
    );
  });

  it("ignora resultados recentes inválidos e usa a primeira ficha própria canônica", async () => {
    queueSelect(
      [company()],
      [
        assessment(103, USER_ID, { result: null }),
        assessment(102, USER_ID, {
          result: { ...canonicalResult(), formulaVersion: "divergente" },
        }),
        assessment(101),
        assessment(100),
      ]
    );
    const result = await getMyExecutiveReport(viewer());
    expect(result.data.people).toHaveLength(1);
    expect(result.data.people[0]?.assessmentId).toBe(101);
    expect(mocks.readExecutiveComplementarySources).toHaveBeenCalledWith(
      USER_ID,
      COMPANY_ID,
      [{ userId: USER_ID, assessmentId: 101 }]
    );
    expect(mocks.builders[1]?.limit).not.toHaveBeenCalled();
  });

  it("não libera uma empresa inativa nem consulta avaliações próprias", async () => {
    queueSelect([company({ active: 0 })]);

    await expectCode(getMyExecutiveReport(viewer()), "NOT_FOUND");

    expect(mocks.select).toHaveBeenCalledTimes(1);
    expect(mocks.readExecutiveComplementarySources).not.toHaveBeenCalled();
    expect(mocks.recordFluxusAudit).not.toHaveBeenCalled();
  });

  it("exige vínculo Fluxus próprio e não aceita conta sem empresa ou de outro tenant", async () => {
    await expectCode(
      getMyExecutiveReport(viewer(USER_ID, { accountType: "prospecting" })),
      "NOT_FOUND"
    );
    await expectCode(
      getMyExecutiveReport(viewer(USER_ID, { companyId: null })),
      "NOT_FOUND"
    );
    expect(mocks.select).not.toHaveBeenCalled();

    queueSelect([company()], [assessment(ASSESSMENT_ID, OTHER_USER_ID)]);
    await expectCode(getMyExecutiveReport(viewer()), "NOT_FOUND");
    expect(mocks.readExecutiveComplementarySources).not.toHaveBeenCalled();
    expect(mocks.recordFluxusAudit).not.toHaveBeenCalled();

    queueSelect(
      [company({ id: OTHER_COMPANY_ID })],
      [assessment(ASSESSMENT_ID, USER_ID, { companyId: COMPANY_ID })]
    );
    await expectCode(
      getMyExecutiveReport(viewer(USER_ID, { companyId: OTHER_COMPANY_ID })),
      "NOT_FOUND"
    );
  });

  it("não transforma avaliação Beta 1, incompleta ou inexistente em relatório próprio", async () => {
    queueSelect(
      [company()],
      [
        assessment(ASSESSMENT_ID, USER_ID, {
          result: null,
          instrumentVersion: "1.0.0-beta.1",
        }),
      ]
    );

    await expectCode(getMyExecutiveReport(viewer()), "NOT_FOUND");
    expect(mocks.readExecutiveComplementarySources).not.toHaveBeenCalled();

    queueSelect([company()], []);
    await expectCode(getMyExecutiveReport(viewer()), "NOT_FOUND");
  });

  it("mantém a visão de equipe compartilhada proibida para colaborador", async () => {
    queueSelect([company()]);

    await expectCode(
      previewExecutive(viewer(), {
        companyId: COMPANY_ID,
        mode: "team",
        assessmentIds: [ASSESSMENT_ID],
      }),
      "FORBIDDEN"
    );

    expect(mocks.select).toHaveBeenCalledTimes(1);
    expect(mocks.getFluxusDirectTeamUserIds).not.toHaveBeenCalled();
    expect(mocks.recordFluxusAudit).not.toHaveBeenCalled();
  });
});
