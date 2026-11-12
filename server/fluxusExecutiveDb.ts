import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNull, isNotNull, sql } from "drizzle-orm";
import {
  fluxusAssessments,
  fluxusCompanies,
  users,
  type User,
} from "../drizzle/schema";
import {
  fluxusExecutiveReports,
  type FluxusExecutiveReport,
} from "../drizzle/fluxusExecutiveSchema";
import {
  CURRENT_FLUXUS_FORMULA_VERSION,
  CURRENT_FLUXUS_INSTRUMENT_VERSION,
  isFluxusV2Result,
} from "../shared/fluxusVersioning";
import { canAccessFluxusIndividualReport } from "../shared/fluxusAccess";
import {
  emptyExecutiveNotes,
  executiveNotesSchema,
  executiveSelectionSchema,
  EXECUTIVE_MAX_PEOPLE,
  type ExecutiveDirectoryResponse,
  type ExecutiveDocumentData,
  type ExecutiveNotes,
  type ExecutivePerson,
  type ExecutivePreviewResponse,
  type ExecutiveSavedReport,
  type ExecutiveSelection,
} from "../shared/fluxusExecutive";
import { buildExecutiveDocument } from "../shared/fluxusExecutiveAnalysis";
import { db } from "./db";
import { readExecutiveComplementarySources } from "./fluxusComplementaryDb";
import { getFluxusDirectTeamUserIds } from "./fluxusOrganization";
import { recordFluxusAudit } from "./fluxusDb";

const GENERIC_SELECTION_MESSAGE =
  "As avaliações selecionadas não estão disponíveis para este relatório.";
const GENERIC_REPORT_MESSAGE = "Relatório executivo não encontrado.";

type ExecutiveCompany = {
  id: number;
  name: string;
  reportVisibility: string;
  beta2OrganizationAccessApprovedAt: Date | null;
  minimumAggregateSize: number;
};

type ExecutiveViewer = Pick<
  User,
  "id" | "role" | "accountType" | "companyId" | "fluxusRole"
>;

type ExecutiveAssessmentRow = {
  assessmentId: number;
  userId: number;
  companyId: number;
  cycleNumber: number;
  cycleLabel: string | null;
  instrumentVersion: string;
  formulaVersion: string;
  result: unknown;
  completedAt: Date | string | null;
  name: string | null;
  jobTitle: string | null;
  department: string | null;
};

type ExecutiveAuthorization = {
  company: ExecutiveCompany;
  managerScope: Set<number> | null;
};

function failSelection(
  code: "BAD_REQUEST" | "FORBIDDEN" = "BAD_REQUEST"
): never {
  throw new TRPCError({ code, message: GENERIC_SELECTION_MESSAGE });
}

function failReport(code: "NOT_FOUND" | "FORBIDDEN" = "NOT_FOUND"): never {
  throw new TRPCError({ code, message: GENERIC_REPORT_MESSAGE });
}

function asIso(value: Date | string | null): string {
  if (!value) return new Date(0).toISOString();
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function minimumRespondents(company: ExecutiveCompany): number {
  return Math.max(5, company.minimumAggregateSize);
}

async function getExecutiveCompany(
  companyId: number
): Promise<ExecutiveCompany | null> {
  const rows = await db
    .select({
      id: fluxusCompanies.id,
      name: fluxusCompanies.name,
      reportVisibility: fluxusCompanies.reportVisibility,
      beta2OrganizationAccessApprovedAt:
        fluxusCompanies.beta2OrganizationAccessApprovedAt,
      minimumAggregateSize: fluxusCompanies.minimumAggregateSize,
    })
    .from(fluxusCompanies)
    .where(eq(fluxusCompanies.id, companyId))
    .limit(1);
  return rows[0] ?? null;
}

async function authorizeCompany(
  viewer: ExecutiveViewer,
  companyId: number,
  subjectUserIds?: ReadonlySet<number>
): Promise<ExecutiveAuthorization> {
  const company = await getExecutiveCompany(companyId);
  if (!company) failReport();

  const isPlatformAdmin = viewer.role === "admin";
  if (
    !isPlatformAdmin &&
    !canAccessFluxusIndividualReport(
      viewer,
      company.reportVisibility,
      company.id,
      {
        beta2Context: true,
        beta2Approved: Boolean(company.beta2OrganizationAccessApprovedAt),
      }
    )
  ) {
    failSelection("FORBIDDEN");
  }

  let managerScope: Set<number> | null = null;
  if (!isPlatformAdmin && viewer.fluxusRole === "manager") {
    managerScope = await getFluxusDirectTeamUserIds(viewer.id, company.id);
    if (
      subjectUserIds &&
      Array.from(subjectUserIds).some(userId => !managerScope!.has(userId))
    ) {
      failSelection("FORBIDDEN");
    }
  }

  return { company, managerScope };
}

function canonicalResult(result: unknown) {
  return (
    typeof result === "object" &&
    result !== null &&
    isFluxusV2Result(result as never) &&
    (result as ExecutivePerson["result"]).instrumentVersion ===
      CURRENT_FLUXUS_INSTRUMENT_VERSION &&
    (result as ExecutivePerson["result"]).formulaVersion ===
      CURRENT_FLUXUS_FORMULA_VERSION
  );
}

async function loadCanonicalAssessments(
  companyId: number,
  assessmentIds?: readonly number[]
): Promise<ExecutiveAssessmentRow[]> {
  const conditions = [
    eq(fluxusAssessments.companyId, companyId),
    eq(users.companyId, companyId),
    eq(users.accountType, "fluxus"),
    eq(users.approvalStatus, "approved"),
    isNull(users.privacyDeletedAt),
    eq(fluxusAssessments.status, "completed"),
    eq(fluxusAssessments.instrumentVersion, CURRENT_FLUXUS_INSTRUMENT_VERSION),
    eq(fluxusAssessments.formulaVersion, CURRENT_FLUXUS_FORMULA_VERSION),
    isNotNull(fluxusAssessments.completedAt),
  ];
  if (assessmentIds) {
    conditions.push(inArray(fluxusAssessments.id, [...assessmentIds]));
  }

  const rows = await db
    .select({
      assessmentId: fluxusAssessments.id,
      userId: fluxusAssessments.userId,
      companyId: fluxusAssessments.companyId,
      cycleNumber: fluxusAssessments.cycleNumber,
      cycleLabel: fluxusAssessments.cycleLabel,
      instrumentVersion: fluxusAssessments.instrumentVersion,
      formulaVersion: fluxusAssessments.formulaVersion,
      result: fluxusAssessments.result,
      completedAt: fluxusAssessments.completedAt,
      name: users.name,
      jobTitle: users.jobTitle,
      department: users.department,
    })
    .from(fluxusAssessments)
    .innerJoin(users, eq(users.id, fluxusAssessments.userId))
    .where(and(...conditions))
    .orderBy(desc(fluxusAssessments.completedAt), desc(fluxusAssessments.id));

  return rows.filter(row => canonicalResult(row.result));
}

function rowToPerson(row: ExecutiveAssessmentRow): ExecutivePerson {
  return {
    userId: row.userId,
    name: row.name,
    jobTitle: row.jobTitle,
    department: row.department,
    assessmentId: row.assessmentId,
    cycleNumber: row.cycleNumber,
    cycleLabel: row.cycleLabel,
    completedAt: asIso(row.completedAt),
    result: row.result as ExecutivePerson["result"],
  };
}

function validateNotesScope(
  notes: ExecutiveNotes,
  assessmentIds: readonly number[]
) {
  const selected = new Set(assessmentIds);
  const outOfScope = Object.keys(notes.individuals).some(key => {
    const id = Number(key);
    return !Number.isSafeInteger(id) || !selected.has(id);
  });
  if (outOfScope) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "As fichas individuais devem pertencer às avaliações selecionadas.",
    });
  }
}

function normalizeSelection(selection: ExecutiveSelection, companyId: number) {
  const parsed = executiveSelectionSchema.parse(selection);
  if (parsed.companyId !== undefined && parsed.companyId !== companyId) {
    failSelection();
  }
  return { ...parsed, companyId } satisfies ExecutiveSelection;
}

async function resolvePreviewCompany(
  viewer: ExecutiveViewer,
  selection: ExecutiveSelection
): Promise<number> {
  if (viewer.role !== "admin") {
    if (!viewer.companyId) failSelection("FORBIDDEN");
    if (
      selection.companyId !== undefined &&
      selection.companyId !== viewer.companyId
    ) {
      failSelection("FORBIDDEN");
    }
    return viewer.companyId;
  }
  if (selection.companyId !== undefined) return selection.companyId;

  const rows = await db
    .select({ companyId: fluxusAssessments.companyId })
    .from(fluxusAssessments)
    .where(inArray(fluxusAssessments.id, selection.assessmentIds));
  const companies = new Set(rows.map(row => row.companyId));
  if (rows.length !== selection.assessmentIds.length || companies.size !== 1) {
    failSelection();
  }
  return Array.from(companies)[0]!;
}

async function validateSelection(
  viewer: ExecutiveViewer,
  selection: ExecutiveSelection,
  authorization: ExecutiveAuthorization
): Promise<ExecutivePerson[]> {
  const rows = await loadCanonicalAssessments(
    authorization.company.id,
    selection.assessmentIds
  );
  if (rows.length !== selection.assessmentIds.length) failSelection();

  const byAssessment = new Map(rows.map(row => [row.assessmentId, row]));
  const people: ExecutivePerson[] = [];
  const selectedUsers = new Set<number>();
  for (const assessmentId of selection.assessmentIds) {
    const row = byAssessment.get(assessmentId);
    if (!row || selectedUsers.has(row.userId)) {
      if (row && selectedUsers.has(row.userId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Selecione no máximo uma avaliação por pessoa.",
        });
      }
      failSelection();
    }
    if (
      authorization.managerScope &&
      !authorization.managerScope.has(row.userId)
    ) {
      failSelection("FORBIDDEN");
    }
    selectedUsers.add(row.userId);
    people.push(rowToPerson(row));
  }
  return people;
}

function reportSelection(report: FluxusExecutiveReport): ExecutiveSelection {
  try {
    return executiveSelectionSchema.parse({
      companyId: report.companyId,
      mode: report.mode,
      assessmentIds: report.assessmentIds,
    });
  } catch {
    failReport();
  }
}

function sameSelection(a: ExecutiveSelection, b: ExecutiveSelection): boolean {
  return (
    a.mode === b.mode &&
    a.companyId === b.companyId &&
    a.assessmentIds.length === b.assessmentIds.length &&
    a.assessmentIds.every((id, index) => id === b.assessmentIds[index])
  );
}

function reportNotes(report: FluxusExecutiveReport): ExecutiveNotes {
  return executiveNotesSchema.parse(report.notes);
}

function toSavedReport(report: FluxusExecutiveReport): ExecutiveSavedReport {
  return {
    id: report.id,
    companyId: report.companyId,
    mode: report.mode,
    assessmentIds: [...report.assessmentIds],
    notes: reportNotes(report),
    revision: report.revision,
    createdAt: asIso(report.createdAt),
    updatedAt: asIso(report.updatedAt),
  };
}

async function getExecutiveReport(reportId: number) {
  const rows = await db
    .select({
      id: fluxusExecutiveReports.id,
      companyId: fluxusExecutiveReports.companyId,
      createdBy: fluxusExecutiveReports.createdBy,
      mode: fluxusExecutiveReports.mode,
      assessmentIds: fluxusExecutiveReports.assessmentIds,
      notes: fluxusExecutiveReports.notes,
      revision: fluxusExecutiveReports.revision,
      createdAt: fluxusExecutiveReports.createdAt,
      updatedAt: fluxusExecutiveReports.updatedAt,
    })
    .from(fluxusExecutiveReports)
    .where(eq(fluxusExecutiveReports.id, reportId))
    .limit(1);
  return rows[0] ?? null;
}

function canEditReport(
  viewer: ExecutiveViewer,
  report: Pick<FluxusExecutiveReport, "createdBy" | "companyId">
): boolean {
  return (
    viewer.role === "admin" ||
    (viewer.accountType === "fluxus" &&
      viewer.companyId === report.companyId &&
      viewer.fluxusRole === "hr") ||
    viewer.id === report.createdBy
  );
}

async function makeDocument(
  viewerId: number,
  company: ExecutiveCompany,
  selection: ExecutiveSelection,
  people: ExecutivePerson[]
): Promise<ExecutiveDocumentData> {
  const complementary = await readExecutiveComplementarySources(
    viewerId,
    company.id,
    people.map(({ userId, assessmentId }) => ({ userId, assessmentId }))
  );
  const enrichedPeople = people.map(person => {
    const sources = complementary[String(person.assessmentId)];
    return sources ? { ...person, complementary: sources } : person;
  });
  return buildExecutiveDocument(
    { id: company.id, name: company.name },
    selection.mode,
    enrichedPeople,
    minimumRespondents(company)
  );
}

export async function getExecutiveDirectory(
  viewer: ExecutiveViewer,
  companyId?: number
): Promise<ExecutiveDirectoryResponse> {
  const resolvedCompanyId = companyId ?? viewer.companyId;
  if (!resolvedCompanyId || (viewer.role === "admin" && !companyId)) {
    failSelection("FORBIDDEN");
  }
  const authorization = await authorizeCompany(viewer, resolvedCompanyId);
  const rows = await loadCanonicalAssessments(authorization.company.id);
  const latestByUser = new Map<number, ExecutiveAssessmentRow>();
  for (const row of rows) {
    if (
      (!authorization.managerScope ||
        authorization.managerScope.has(row.userId)) &&
      !latestByUser.has(row.userId)
    ) {
      latestByUser.set(row.userId, row);
    }
  }
  const allPeople = Array.from(latestByUser.values())
    .sort((a, b) =>
      (a.name ?? "").localeCompare(b.name ?? "", "pt-BR", {
        sensitivity: "base",
      })
    )
    .map(rowToPerson);
  const people = allPeople
    .slice(0, EXECUTIVE_MAX_PEOPLE)
    .map(({ result: _result, ...entry }) => entry);
  await recordFluxusAudit({
    actorUserId: viewer.id,
    companyId: authorization.company.id,
    action: "executive.directory",
    resourceType: "executive_directory",
    metadata: {
      returned: people.length,
      truncated: allPeople.length > EXECUTIVE_MAX_PEOPLE,
    },
  });
  return {
    company: { id: authorization.company.id, name: authorization.company.name },
    people,
    minimumRespondents: minimumRespondents(authorization.company),
    limit: EXECUTIVE_MAX_PEOPLE,
    truncated: allPeople.length > EXECUTIVE_MAX_PEOPLE,
  };
}

export async function previewExecutive(
  viewer: ExecutiveViewer,
  rawSelection: ExecutiveSelection
): Promise<ExecutivePreviewResponse> {
  const selection = executiveSelectionSchema.parse(rawSelection);
  const companyId = await resolvePreviewCompany(viewer, selection);
  const authorization = await authorizeCompany(viewer, companyId);
  const normalized = normalizeSelection(selection, companyId);
  const people = await validateSelection(viewer, normalized, authorization);
  const data = await makeDocument(
    viewer.id,
    authorization.company,
    normalized,
    people
  );
  await recordFluxusAudit({
    actorUserId: viewer.id,
    companyId,
    action: "executive.preview",
    resourceType: "executive_report",
    metadata: { mode: normalized.mode, count: normalized.assessmentIds.length },
  });
  return {
    data,
    notes: emptyExecutiveNotes(),
    report: null,
    canEdit: true,
  };
}

export async function saveExecutiveReport(
  viewer: ExecutiveViewer,
  input: {
    selection: ExecutiveSelection;
    notes: ExecutiveNotes;
    reportId?: number;
    expectedRevision?: number;
  }
): Promise<ExecutiveSavedReport> {
  const selection = executiveSelectionSchema.parse(input.selection);
  const notes = executiveNotesSchema.parse(input.notes);
  let saved: FluxusExecutiveReport;
  let companyId: number;

  if (input.reportId !== undefined) {
    const existing = await getExecutiveReport(input.reportId);
    if (!existing) failReport();
    companyId = existing.companyId;
    if (input.expectedRevision === undefined) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "expectedRevision é obrigatório ao editar um relatório.",
      });
    }
    const normalized = normalizeSelection(selection, companyId);
    const fixed = reportSelection(existing);
    if (!sameSelection(normalized, fixed)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "A seleção de um relatório salvo não pode ser alterada.",
      });
    }
    const authorization = await authorizeCompany(viewer, companyId);
    await validateSelection(viewer, fixed, authorization);
    if (!canEditReport(viewer, existing)) {
      failSelection("FORBIDDEN");
    }
    validateNotesScope(notes, existing.assessmentIds);
    const updated = await db
      .update(fluxusExecutiveReports)
      .set({
        notes,
        revision: sql`${fluxusExecutiveReports.revision} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(fluxusExecutiveReports.id, existing.id),
          eq(fluxusExecutiveReports.companyId, companyId),
          eq(fluxusExecutiveReports.revision, input.expectedRevision)
        )
      )
      .returning({
        id: fluxusExecutiveReports.id,
        companyId: fluxusExecutiveReports.companyId,
        createdBy: fluxusExecutiveReports.createdBy,
        mode: fluxusExecutiveReports.mode,
        assessmentIds: fluxusExecutiveReports.assessmentIds,
        notes: fluxusExecutiveReports.notes,
        revision: fluxusExecutiveReports.revision,
        createdAt: fluxusExecutiveReports.createdAt,
        updatedAt: fluxusExecutiveReports.updatedAt,
      });
    if (!updated[0]) {
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "O relatório foi atualizado. Recarregue antes de salvar novamente.",
      });
    }
    saved = updated[0];
  } else {
    companyId = await resolvePreviewCompany(viewer, selection);
    const authorization = await authorizeCompany(viewer, companyId);
    const normalized = normalizeSelection(selection, companyId);
    await validateSelection(viewer, normalized, authorization);
    validateNotesScope(notes, normalized.assessmentIds);
    const inserted = await db
      .insert(fluxusExecutiveReports)
      .values({
        companyId,
        createdBy: viewer.id,
        mode: normalized.mode,
        assessmentIds: normalized.assessmentIds,
        notes,
        revision: 1,
      })
      .returning({
        id: fluxusExecutiveReports.id,
        companyId: fluxusExecutiveReports.companyId,
        createdBy: fluxusExecutiveReports.createdBy,
        mode: fluxusExecutiveReports.mode,
        assessmentIds: fluxusExecutiveReports.assessmentIds,
        notes: fluxusExecutiveReports.notes,
        revision: fluxusExecutiveReports.revision,
        createdAt: fluxusExecutiveReports.createdAt,
        updatedAt: fluxusExecutiveReports.updatedAt,
      });
    if (!inserted[0])
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Não foi possível salvar o relatório executivo.",
      });
    saved = inserted[0];
  }

  const result = toSavedReport(saved);
  await recordFluxusAudit({
    actorUserId: viewer.id,
    companyId,
    action: "executive.save",
    resourceType: "executive_report",
    metadata: {
      reportId: result.id,
      revision: result.revision,
      mode: result.mode,
    },
  });
  return result;
}

export async function getExecutivePreview(
  viewer: ExecutiveViewer,
  reportId: number
): Promise<ExecutivePreviewResponse> {
  const report = await getExecutiveReport(reportId);
  if (!report) failReport();
  const selection = reportSelection(report);
  const authorization = await authorizeCompany(viewer, report.companyId);
  const people = await validateSelection(viewer, selection, authorization);
  const data = await makeDocument(
    viewer.id,
    authorization.company,
    selection,
    people
  );
  const saved = toSavedReport(report);
  await recordFluxusAudit({
    actorUserId: viewer.id,
    companyId: report.companyId,
    action: "executive.read",
    resourceType: "executive_report",
    metadata: { reportId: report.id, mode: report.mode },
  });
  return {
    data,
    notes: saved.notes,
    report: saved,
    canEdit: canEditReport(viewer, report),
  };
}

export async function listExecutiveReports(
  viewer: ExecutiveViewer,
  companyId?: number
): Promise<
  Array<
    Pick<ExecutiveSavedReport, "id" | "mode" | "revision" | "updatedAt"> & {
      title: string;
    }
  >
> {
  const resolvedCompanyId = companyId ?? viewer.companyId;
  if (!resolvedCompanyId || (viewer.role === "admin" && !companyId)) {
    failSelection("FORBIDDEN");
  }
  const authorization = await authorizeCompany(viewer, resolvedCompanyId);
  const reports = await db
    .select({
      id: fluxusExecutiveReports.id,
      companyId: fluxusExecutiveReports.companyId,
      createdBy: fluxusExecutiveReports.createdBy,
      mode: fluxusExecutiveReports.mode,
      assessmentIds: fluxusExecutiveReports.assessmentIds,
      notes: fluxusExecutiveReports.notes,
      revision: fluxusExecutiveReports.revision,
      createdAt: fluxusExecutiveReports.createdAt,
      updatedAt: fluxusExecutiveReports.updatedAt,
    })
    .from(fluxusExecutiveReports)
    .where(eq(fluxusExecutiveReports.companyId, authorization.company.id))
    .orderBy(
      desc(fluxusExecutiveReports.updatedAt),
      desc(fluxusExecutiveReports.id)
    )
    .limit(50);

  const result: Array<
    Pick<ExecutiveSavedReport, "id" | "mode" | "revision" | "updatedAt"> & {
      title: string;
    }
  > = [];
  for (const report of reports) {
    try {
      const selection = reportSelection(report);
      await validateSelection(viewer, selection, authorization);
      const notes = reportNotes(report);
      result.push({
        id: report.id,
        mode: report.mode,
        title:
          notes.title ||
          (report.mode === "individual"
            ? "Relatório individual"
            : "Relatório da equipe"),
        revision: report.revision,
        updatedAt: asIso(report.updatedAt),
      });
    } catch (error) {
      if (error instanceof TRPCError && error.code === "BAD_REQUEST") continue;
      if (error instanceof TRPCError && error.code === "FORBIDDEN") continue;
      continue;
    }
  }
  return result;
}

export { validateNotesScope };
