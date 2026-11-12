import { createHash, timingSafeEqual } from "node:crypto";
import { TRPCError } from "@trpc/server";
import {
  and,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import {
  fluxusAssessments,
  fluxusAuditLogs,
  fluxusCompanies,
  users,
  type User,
} from "../drizzle/schema";
import {
  fluxusComplementaryReports,
  type FluxusComplementaryReport,
} from "../drizzle/fluxusComplementarySchema";
import {
  COMPLEMENTARY_MAX_ACTIVE,
  COMPLEMENTARY_MAX_PENDING,
  COMPLEMENTARY_TERMS_VERSION,
  CRITIC_LABELS,
  SABOTEUR_LABELS,
  complementaryConsentText,
  type ComplementaryAvailability,
  type ComplementaryDetail,
  type ComplementaryKind,
  type ComplementaryRecipient,
  type ComplementarySummary,
  type ComplementaryValues,
  type CriticKey,
  type SaboteurKey,
} from "../shared/fluxusComplementary";
import type {
  ExecutiveComplementaryBundle,
  ExecutiveComplementarySource,
} from "../shared/fluxusManagerialComplementary";
import { db } from "./db";
import {
  complementaryEncryptionConfigured,
  decryptComplementaryPdf,
  encryptComplementaryPdf,
} from "./fluxusComplementaryCrypto";
import { extractComplementaryPdf } from "./fluxusComplementaryPdf";

const MAX_BASE64_LENGTH = 7_000_000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const SABOTEUR_KEYS = Object.keys(SABOTEUR_LABELS) as SaboteurKey[];
const CRITIC_KEYS = Object.keys(CRITIC_LABELS) as CriticKey[];
const GENERIC_NOT_FOUND = "Relatório complementar não encontrado.";
const GENERIC_FORBIDDEN = "Você não tem acesso a este relatório complementar.";
const GENERIC_ACTIVE_ACCOUNT = "Esta conta não está ativa para esta empresa.";

type Executor = typeof db;
type LiveCompany = { id: number; name: string; active: number };
type LiveUser = Pick<
  User,
  | "id"
  | "name"
  | "role"
  | "accountType"
  | "companyId"
  | "fluxusRole"
  | "approvalStatus"
  | "privacyDeletedAt"
>;
type OwnerAccess = { user: LiveUser; company: LiveCompany };
type SnapshotRow = Pick<
  FluxusComplementaryReport,
  | "id"
  | "companyId"
  | "userId"
  | "assessmentId"
  | "kind"
  | "status"
  | "revision"
  | "fileHash"
  | "fileName"
  | "sourceName"
  | "sourceDate"
  | "values"
  | "warnings"
  | "context"
  | "recipientSnapshot"
  | "termsVersion"
  | "consentText"
  | "consentedAt"
  | "confirmedAt"
  | "revokedAt"
  | "createdAt"
  | "updatedAt"
> & {
  pdfCiphertext?: string | null;
  ownerName: string | null;
  ownerApprovalStatus: LiveUser["approvalStatus"];
  ownerPrivacyDeletedAt: Date | null;
  ownerAccountType: LiveUser["accountType"];
  ownerRole: LiveUser["role"];
  ownerCompanyId: number | null;
  companyActive: number;
};
type DownloadRow = SnapshotRow & { pdfCiphertext: string | null };
type ReaderAccessRow = Pick<
  SnapshotRow,
  | "userId"
  | "companyId"
  | "status"
  | "recipientSnapshot"
  | "ownerApprovalStatus"
  | "ownerPrivacyDeletedAt"
  | "ownerAccountType"
  | "ownerRole"
  | "ownerCompanyId"
  | "companyActive"
>;
type ExecutiveComplementaryRow = ReaderAccessRow &
  Pick<
    SnapshotRow,
    | "id"
    | "assessmentId"
    | "kind"
    | "revision"
    | "termsVersion"
    | "sourceDate"
    | "values"
    | "context"
    | "confirmedAt"
  >;

const EXECUTIVE_COMPLEMENTARY_MAX_PEOPLE = 200;
const EXECUTIVE_COMPLEMENTARY_MAX_SOURCES_PER_PERSON = 20;

const snapshotFields = {
  id: fluxusComplementaryReports.id,
  companyId: fluxusComplementaryReports.companyId,
  userId: fluxusComplementaryReports.userId,
  assessmentId: fluxusComplementaryReports.assessmentId,
  kind: fluxusComplementaryReports.kind,
  status: fluxusComplementaryReports.status,
  revision: fluxusComplementaryReports.revision,
  fileHash: fluxusComplementaryReports.fileHash,
  fileName: fluxusComplementaryReports.fileName,
  sourceName: fluxusComplementaryReports.sourceName,
  sourceDate: fluxusComplementaryReports.sourceDate,
  values: fluxusComplementaryReports.values,
  warnings: fluxusComplementaryReports.warnings,
  context: fluxusComplementaryReports.context,
  recipientSnapshot: fluxusComplementaryReports.recipientSnapshot,
  termsVersion: fluxusComplementaryReports.termsVersion,
  consentText: fluxusComplementaryReports.consentText,
  consentedAt: fluxusComplementaryReports.consentedAt,
  confirmedAt: fluxusComplementaryReports.confirmedAt,
  revokedAt: fluxusComplementaryReports.revokedAt,
  createdAt: fluxusComplementaryReports.createdAt,
  updatedAt: fluxusComplementaryReports.updatedAt,
  ownerName: users.name,
  ownerApprovalStatus: users.approvalStatus,
  ownerPrivacyDeletedAt: users.privacyDeletedAt,
  ownerAccountType: users.accountType,
  ownerRole: users.role,
  ownerCompanyId: users.companyId,
  companyActive: fluxusCompanies.active,
};

function badRequest(message: string): never {
  throw new TRPCError({ code: "BAD_REQUEST", message });
}
function forbidden(message = GENERIC_FORBIDDEN): never {
  throw new TRPCError({ code: "FORBIDDEN", message });
}
function notFound(): never {
  throw new TRPCError({ code: "NOT_FOUND", message: GENERIC_NOT_FOUND });
}
function conflict(): never {
  throw new TRPCError({
    code: "CONFLICT",
    message:
      "Este relatório foi alterado. Recarregue os dados antes de tentar novamente.",
  });
}
function precondition(message: string): never {
  throw new TRPCError({ code: "PRECONDITION_FAILED", message });
}
function ensurePositiveId(value: number, label = "ID") {
  if (!Number.isSafeInteger(value) || value <= 0)
    badRequest(`${label} inválido.`);
}
function iso(value: Date | string | null): string {
  if (!value) return "";
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}
function dateOnly(value: Date | string | null): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function assertOnlyKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  label: string
) {
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) badRequest(`${label} contém uma chave inválida.`);
  }
}
function readInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  label: string
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    badRequest(`${label} está fora da escala permitida.`);
  }
  return value;
}

function readFiniteScore(
  value: unknown,
  minimum: number,
  maximum: number,
  label: string
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  ) {
    badRequest(`${label} está fora da escala permitida.`);
  }
  return value;
}

/** Valida e normaliza valores humanos; ausência nunca é transformada em zero. */
export function normalizeComplementaryValues(
  input: unknown,
  kind: ComplementaryKind
): ComplementaryValues {
  if (!isPlainRecord(input)) badRequest("Informe os valores da avaliação.");
  assertOnlyKeys(input, ["pq", "saboteurs", "critic"], "Valores");
  const pq = input.pq;
  const saboteurs = input.saboteurs;
  const critic = input.critic;
  if (!isPlainRecord(saboteurs) || !isPlainRecord(critic)) {
    badRequest("As escalas da avaliação estão inválidas.");
  }
  assertOnlyKeys(saboteurs, SABOTEUR_KEYS, "Sabotadores");
  assertOnlyKeys(critic, CRITIC_KEYS, "Crítica");

  if (kind === "pq") {
    if (pq === null || pq === undefined) {
      badRequest("Informe a pontuação QP para confirmar o relatório.");
    }
    const cleanPq = readInteger(pq, 0, 100, "QP");
    const irrelevantSaboteurValues = Object.values(saboteurs);
    const irrelevantCriticValues = Object.values(critic);
    if (
      irrelevantSaboteurValues.some(
        value => value !== null && value !== undefined
      ) ||
      irrelevantCriticValues.some(
        value => value !== null && value !== undefined
      )
    ) {
      badRequest("Este relatório QP não aceita valores de outras escalas.");
    }
    return { pq: cleanPq, saboteurs: {}, critic: {} };
  }

  if (pq !== null) badRequest("A pontuação QP não pertence a este relatório.");
  if (Object.keys(saboteurs).length !== SABOTEUR_KEYS.length) {
    badRequest("Informe os nove Sabotadores para confirmar o relatório.");
  }
  const cleanSaboteurs: Partial<Record<SaboteurKey, number | null>> = {};
  for (const key of SABOTEUR_KEYS) {
    const value = saboteurs[key];
    if (value === null || value === undefined) {
      badRequest("Informe os nove Sabotadores para confirmar o relatório.");
    }
    cleanSaboteurs[key] = readFiniteScore(value, 0, 10, `Sabotador ${key}`);
  }
  const cleanCritic: Partial<Record<CriticKey, number | null>> = {};
  for (const key of Object.keys(critic) as CriticKey[]) {
    const value = critic[key];
    cleanCritic[key] =
      value === null ? null : readInteger(value, 1, 15, `Crítica ${key}`);
  }
  return { pq: null, saboteurs: cleanSaboteurs, critic: cleanCritic };
}

export function validateSourceDate(
  value: unknown,
  allowNull = true
): string | null {
  if (value === null && allowNull) return null;
  if (typeof value !== "string" || !DATE_ONLY.test(value)) {
    badRequest("A data do relatório deve estar no formato AAAA-MM-DD.");
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    badRequest("A data do relatório não é válida.");
  }
  const today = new Date();
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  );
  if (date.getTime() > todayUtc) {
    badRequest("A data do relatório não pode estar no futuro.");
  }
  return value;
}

function nameTokens(value: string): string[] {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}
function compatibleToken(a: string, b: string): boolean {
  return (
    a === b ||
    (a.length === 1 && b.startsWith(a)) ||
    (b.length === 1 && a.startsWith(b))
  );
}
/** Aceita nome igual ou prefixo com ao menos dois tokens compatíveis/abreviados. */
export function namesCorrelate(ownerName: string, sourceName: string): boolean {
  const owner = nameTokens(ownerName);
  const source = nameTokens(sourceName);
  if (!owner.length || !source.length) return false;
  if (owner[0] !== source[0]) return false;
  if (owner.join(" ") === source.join(" ")) return true;
  const shorter = owner.length <= source.length ? owner : source;
  const longer = owner.length <= source.length ? source : owner;
  if (shorter.length < 2 || shorter.length > longer.length) return false;
  return shorter.every((token, index) =>
    compatibleToken(token, longer[index]!)
  );
}

export function decodeCanonicalPdf(pdfBase64: string): Buffer {
  if (
    typeof pdfBase64 !== "string" ||
    pdfBase64.length === 0 ||
    pdfBase64.length > MAX_BASE64_LENGTH ||
    /\s/.test(pdfBase64) ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      pdfBase64
    )
  ) {
    badRequest("O PDF deve ser Base64 canônico e válido.");
  }
  const pdf = Buffer.from(pdfBase64, "base64");
  if (
    !pdf.length ||
    pdf.length > 5 * 1024 * 1024 ||
    pdf.toString("base64") !== pdfBase64 ||
    pdf.subarray(0, 5).toString("ascii") !== "%PDF-"
  ) {
    badRequest("O arquivo enviado não é um PDF plausível.");
  }
  const tail = pdf.subarray(Math.max(0, pdf.length - 4096)).toString("ascii");
  if (!/%EOF\s*$/.test(tail)) badRequest("O arquivo PDF parece incompleto.");
  return pdf;
}

export function validateFileName(fileName: string): string {
  const value = fileName.trim();
  if (
    !value ||
    value.length > 255 ||
    !/\.pdf$/i.test(value) ||
    /[\u0000-\u001f\u007f\\/]/.test(value)
  ) {
    badRequest("Informe um nome de arquivo PDF válido.");
  }
  return value;
}

function safeWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map(item =>
      item
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .trim()
        .slice(0, 240)
    )
    .filter(Boolean)
    .slice(0, 20);
}
function safeSourceName(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string")
    badRequest("O nome extraído do relatório é inválido.");
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (!clean || clean.length > 255)
    badRequest("O nome extraído do relatório é inválido.");
  return clean;
}
function roleLabel(
  user: Pick<LiveUser, "role" | "fluxusRole" | "companyId">
): string {
  if (user.role === "admin") return "Administrador da plataforma";
  if (user.fluxusRole === "manager") return "Gestor";
  return "Recursos Humanos";
}
function isCandidateForCompany(
  user: Pick<
    LiveUser,
    | "role"
    | "accountType"
    | "companyId"
    | "fluxusRole"
    | "approvalStatus"
    | "privacyDeletedAt"
  >,
  companyId: number
): boolean {
  if (user.approvalStatus !== "approved" || user.privacyDeletedAt !== null)
    return false;
  if (user.role === "admin") return true;
  if (user.companyId !== companyId) return false;
  return (
    user.accountType === "fluxus" &&
    (user.fluxusRole === "manager" || user.fluxusRole === "hr")
  );
}

async function loadLiveUser(
  executor: Executor,
  userId: number,
  lockForRead = false
): Promise<LiveUser | null> {
  const query = executor
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      accountType: users.accountType,
      companyId: users.companyId,
      fluxusRole: users.fluxusRole,
      approvalStatus: users.approvalStatus,
      privacyDeletedAt: users.privacyDeletedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const rows = lockForRead ? await query.for("share") : await query;
  return rows[0] ?? null;
}
async function loadCompany(
  executor: Executor,
  companyId: number
): Promise<LiveCompany | null> {
  const rows = await executor
    .select({
      id: fluxusCompanies.id,
      name: fluxusCompanies.name,
      active: fluxusCompanies.active,
    })
    .from(fluxusCompanies)
    .where(eq(fluxusCompanies.id, companyId))
    .limit(1);
  return rows[0] ?? null;
}
function activeUser(user: LiveUser | null): user is LiveUser {
  return Boolean(
    user && user.approvalStatus === "approved" && user.privacyDeletedAt === null
  );
}
async function requireOwnerAccess(
  executor: Executor,
  userId: number,
  requireFluxus = false
): Promise<OwnerAccess> {
  const user = await loadLiveUser(executor, userId);
  if (!activeUser(user) || !user.companyId) forbidden(GENERIC_ACTIVE_ACCOUNT);
  if (requireFluxus && user.role !== "admin" && user.accountType !== "fluxus") {
    forbidden(GENERIC_FORBIDDEN);
  }
  const company = await loadCompany(executor, user.companyId);
  if (!company || company.active !== 1) forbidden(GENERIC_ACTIVE_ACCOUNT);
  return { user, company };
}
async function latestCompletedAssessment(
  executor: Executor,
  userId: number,
  companyId: number
): Promise<{ id: number } | null> {
  const rows = await executor
    .select({ id: fluxusAssessments.id })
    .from(fluxusAssessments)
    .where(
      and(
        eq(fluxusAssessments.userId, userId),
        eq(fluxusAssessments.companyId, companyId),
        eq(fluxusAssessments.status, "completed"),
        isNotNull(fluxusAssessments.completedAt)
      )
    )
    .orderBy(
      sql`${fluxusAssessments.completedAt} DESC NULLS LAST`,
      desc(fluxusAssessments.createdAt),
      desc(fluxusAssessments.id)
    )
    .limit(1);
  return rows[0] ?? null;
}
async function requireEligibleOwner(
  executor: Executor,
  userId: number
): Promise<OwnerAccess & { assessmentId: number }> {
  const access = await requireOwnerAccess(executor, userId, true);
  const assessment = await latestCompletedAssessment(
    executor,
    userId,
    access.company.id
  );
  if (!assessment)
    forbidden(
      "Conclua ao menos uma avaliação Persona antes de importar um relatório."
    );
  if (!access.user.name?.trim())
    forbidden("O cadastro precisa ter um nome para importar o relatório.");
  return { ...access, assessmentId: assessment.id };
}

async function loadCandidates(
  executor: Executor,
  companyId: number,
  ids?: readonly number[]
): Promise<ComplementaryRecipient[]> {
  const where = ids
    ? and(
        inArray(users.id, [...ids]),
        isNull(users.privacyDeletedAt),
        eq(users.approvalStatus, "approved")
      )
    : or(
        and(
          eq(users.role, "admin"),
          eq(users.approvalStatus, "approved"),
          isNull(users.privacyDeletedAt)
        ),
        and(
          eq(users.companyId, companyId),
          eq(users.approvalStatus, "approved"),
          isNull(users.privacyDeletedAt)
        )
      );
  const rows = await executor
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      accountType: users.accountType,
      companyId: users.companyId,
      fluxusRole: users.fluxusRole,
      approvalStatus: users.approvalStatus,
      privacyDeletedAt: users.privacyDeletedAt,
    })
    .from(users)
    .where(where)
    .limit(ids ? Math.max(ids.length, 1) : 1000);
  return rows
    .filter(
      row => isCandidateForCompany(row, companyId) && Boolean(row.name?.trim())
    )
    .map(row => ({
      id: row.id,
      name: row.name!.trim(),
      roleLabel: roleLabel(row),
    }));
}
async function resolveRecipientSnapshot(
  executor: Executor,
  ownerId: number,
  companyId: number,
  recipientUserIds: readonly number[]
): Promise<ComplementaryRecipient[]> {
  const ids = Array.from(new Set(recipientUserIds));
  if (ids.length > 10) badRequest("Você pode escolher no máximo dez leitores.");
  if (ids.some(id => !Number.isSafeInteger(id) || id <= 0 || id === ownerId)) {
    badRequest("Há um leitor inválido ou igual ao titular.");
  }
  if (!ids.length) return [];
  const candidates = await loadCandidates(executor, companyId, ids);
  const byId = new Map(candidates.map(candidate => [candidate.id, candidate]));
  if (ids.some(id => !byId.has(id))) {
    badRequest("Um dos leitores escolhidos não está elegível nesta empresa.");
  }
  return ids.map(id => byId.get(id)!);
}
function recipientIds(snapshot: readonly ComplementaryRecipient[]): number[] {
  return Array.from(new Set(snapshot.map(recipient => recipient.id)));
}

async function loadReportWithOwner(
  executor: Executor,
  reportId: number,
  includeCiphertext = false,
  lockForRead = false
): Promise<SnapshotRow | DownloadRow | null> {
  const selection = includeCiphertext
    ? {
        ...snapshotFields,
        pdfCiphertext: fluxusComplementaryReports.pdfCiphertext,
      }
    : snapshotFields;
  const query = executor
    .select(selection)
    .from(fluxusComplementaryReports)
    .innerJoin(users, eq(users.id, fluxusComplementaryReports.userId))
    .innerJoin(
      fluxusCompanies,
      eq(fluxusCompanies.id, fluxusComplementaryReports.companyId)
    )
    .where(eq(fluxusComplementaryReports.id, reportId))
    .limit(1);
  const rows = lockForRead ? await query.for("share") : await query;
  return rows[0] ?? null;
}
function rowOwnerIsLive(row: ReaderAccessRow): boolean {
  return (
    row.companyActive === 1 &&
    row.ownerApprovalStatus === "approved" &&
    row.ownerPrivacyDeletedAt === null &&
    row.ownerCompanyId === row.companyId &&
    (row.ownerRole === "admin" || row.ownerAccountType === "fluxus")
  );
}
async function requireReaderAccess(
  executor: Executor,
  viewerId: number,
  row: ReaderAccessRow,
  ownerOnly = false
): Promise<{ viewer: LiveUser; isOwner: boolean }> {
  const viewer = await loadLiveUser(executor, viewerId, true);
  if (!activeUser(viewer)) forbidden(GENERIC_ACTIVE_ACCOUNT);
  const isOwner = row.userId === viewer.id;
  if (isOwner) {
    if (!rowOwnerIsLive(row) || viewer.companyId !== row.companyId)
      forbidden(GENERIC_ACTIVE_ACCOUNT);
    return { viewer, isOwner: true };
  }
  if (ownerOnly || row.status !== "confirmed" || !rowOwnerIsLive(row))
    notFound();
  if (!isCandidateForCompany(viewer, row.companyId)) notFound();
  if (!row.recipientSnapshot.some(recipient => recipient.id === viewer.id))
    notFound();
  return { viewer, isOwner: false };
}

function detailFromRow(
  row: SnapshotRow,
  isOwner: boolean
): ComplementaryDetail {
  const recipients = Array.isArray(row.recipientSnapshot)
    ? row.recipientSnapshot
    : [];
  return {
    id: row.id,
    revision: row.revision,
    kind: row.kind,
    status: row.status,
    ownerName: row.ownerName ?? "",
    sourceDate: dateOnly(row.sourceDate),
    createdAt: iso(row.createdAt),
    confirmedAt: iso(row.confirmedAt) || null,
    recipientNames: recipients.map(recipient => recipient.name),
    assessmentId: row.assessmentId,
    sourceName: row.sourceName,
    fileName: row.fileName,
    values: row.values,
    warnings: Array.isArray(row.warnings) ? row.warnings : [],
    context: row.context,
    recipients,
    termsVersion: row.termsVersion,
    consentText: row.consentText,
    isOwner,
  };
}
function assertPdfIntegrity(row: { fileHash: string | null }, pdf: Buffer) {
  if (!row.fileHash) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "O PDF protegido falhou na verificação de integridade.",
    });
  }
  const actualHash = createHash("sha256").update(pdf).digest("hex");
  const expected = Buffer.from(row.fileHash, "utf8");
  const actual = Buffer.from(actualHash, "utf8");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "O PDF protegido falhou na verificação de integridade.",
    });
  }
}
async function enrichPendingOwnerDetail(
  row: SnapshotRow,
  detail: ComplementaryDetail
): Promise<ComplementaryDetail> {
  if (
    row.status !== "pending" ||
    !row.pdfCiphertext ||
    !complementaryEncryptionConfigured()
  ) {
    return detail;
  }
  try {
    const pdf = decryptComplementaryPdf(
      row.companyId,
      row.userId,
      row.pdfCiphertext
    );
    assertPdfIntegrity(row, pdf);
    const parsed = await extractComplementaryPdf(pdf, row.kind);
    const warnings = Array.from(
      new Set([...detail.warnings, ...safeWarnings(parsed.warnings)])
    );
    return {
      ...detail,
      sourceDate: detail.sourceDate ?? parsed.sourceDate,
      values: parsed.values,
      warnings,
    };
  } catch (error) {
    if (error instanceof TRPCError && error.code === "INTERNAL_SERVER_ERROR")
      throw error;
    return detail;
  }
}
function summaryFromRow(row: SnapshotRow): ComplementarySummary {
  const recipients = Array.isArray(row.recipientSnapshot)
    ? row.recipientSnapshot
    : [];
  return {
    id: row.id,
    revision: row.revision,
    kind: row.kind,
    status: row.status,
    ownerName: row.ownerName ?? "",
    sourceDate: dateOnly(row.sourceDate),
    createdAt: iso(row.createdAt),
    confirmedAt: iso(row.confirmedAt) || null,
    recipientNames: recipients.map(recipient => recipient.name),
  };
}
async function insertAudit(
  executor: Executor,
  values: {
    actorUserId: number;
    subjectUserId: number;
    companyId: number;
    action: string;
    reportId: number;
    status?: string | null;
    revision?: number | null;
    scope?: "owner" | "recipient" | null;
  }
) {
  await executor.insert(fluxusAuditLogs).values({
    actorUserId: values.actorUserId,
    subjectUserId: values.subjectUserId,
    companyId: values.companyId,
    action: values.action,
    resourceType: "complementary_report",
    metadata: {
      reportId: values.reportId,
      ...(values.status ? { status: values.status } : {}),
      ...(values.revision !== undefined && values.revision !== null
        ? { revision: values.revision }
        : {}),
      ...(values.scope ? { scope: values.scope } : {}),
    },
  });
}
function ownerLockKey(userId: number, companyId: number): number {
  const mixed = (userId * 73856093) ^ (companyId * 19349663);
  return (mixed >>> 0) & 0x7fffffff;
}
async function acquireOwnerTransactionLock(
  tx: Executor,
  userId: number,
  companyId: number
) {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(${ownerLockKey(userId, companyId)})`
  );
}
function uniqueViolation(error: unknown): boolean {
  let current = error;
  for (let level = 0; level < 4; level++) {
    if (!current || typeof current !== "object") return false;
    if ("code" in current && current.code === "23505") return true;
    current = "cause" in current ? current.cause : null;
  }
  return false;
}

export function complementaryEnabled(): boolean {
  return process.env.FLUXUS_COMPLEMENTARY_ENABLED === "true";
}
export function currentCandidateRoleLabel(
  user: Pick<LiveUser, "role" | "fluxusRole" | "companyId">
): string {
  return roleLabel(user);
}
export function candidateIsEligible(
  user: Pick<
    LiveUser,
    | "role"
    | "accountType"
    | "companyId"
    | "fluxusRole"
    | "approvalStatus"
    | "privacyDeletedAt"
  >,
  companyId: number
): boolean {
  return isCandidateForCompany(user, companyId);
}

function safeExecutiveSourceDate(value: Date | string | null): string | null {
  const normalized = dateOnly(value);
  if (!normalized || !DATE_ONLY.test(normalized)) return null;
  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return normalized;
}

function safeExecutiveConfirmedAt(value: Date | string | null): string | null {
  if (!value) return null;
  try {
    const normalized = iso(value);
    return Number.isNaN(Date.parse(normalized)) ? null : normalized;
  } catch {
    return null;
  }
}

function safeExecutiveValues(
  value: unknown,
  kind: ComplementaryKind
): ComplementaryValues | null {
  if (value === null || value === undefined) return null;
  try {
    return normalizeComplementaryValues(value, kind);
  } catch {
    // Dados inválidos no armazenamento não são convertidos em zero nem expostos.
    return null;
  }
}

function executiveSourceFromRow(
  row: ExecutiveComplementaryRow
): ExecutiveComplementarySource | null {
  const sourceDate = safeExecutiveSourceDate(row.sourceDate);
  const confirmedAt = safeExecutiveConfirmedAt(row.confirmedAt);
  const values = safeExecutiveValues(row.values, row.kind);
  if (!sourceDate || !confirmedAt || !values) return null;
  return {
    id: row.id,
    revision: row.revision,
    userId: row.userId,
    assessmentId: row.assessmentId,
    kind: row.kind,
    sourceDate,
    confirmedAt,
    values,
    context: row.context,
  };
}

/**
 * Lê somente os complementos que o leitor recebeu nominalmente para a mesma
 * avaliação Persona. A consulta não projeta PDF, nome de arquivo ou nome
 * extraído; cada fonte selecionada é protegida por row lock compartilhado
 * contra uma retirada concorrente.
 */
export async function readExecutiveComplementarySources(
  viewerId: number,
  companyId: number,
  people: readonly { userId: number; assessmentId: number }[]
): Promise<Record<string, ExecutiveComplementaryBundle>> {
  ensurePositiveId(viewerId, "Leitor");
  ensurePositiveId(companyId, "Empresa");
  if (people.length > EXECUTIVE_COMPLEMENTARY_MAX_PEOPLE) {
    badRequest("A leitura executiva excede o limite de duzentas pessoas.");
  }

  const uniquePeople = Array.from(
    new Map(
      people.map(person => {
        ensurePositiveId(person.userId, "Colaborador");
        ensurePositiveId(person.assessmentId, "Avaliação");
        return [`${person.userId}:${person.assessmentId}`, person] as const;
      })
    ).values()
  );
  if (!uniquePeople.length) return {};

  return db.transaction(async rawTx => {
    const tx = rawTx as unknown as Executor;
    const result: Record<string, ExecutiveComplementaryBundle> = {};

    for (const person of uniquePeople) {
      // A autorização nominativa e o estado vivo do titular/empresa entram no
      // filtro antes da ordenação: uma fonte privada não pode deslocar a última
      // fonte que o leitor realmente pode ver.
      const recipientMatch = sql`${fluxusComplementaryReports.recipientSnapshot} @> ${JSON.stringify([{ id: viewerId }])}::jsonb`;
      const rows = (await tx
        .select({
          id: fluxusComplementaryReports.id,
          companyId: fluxusComplementaryReports.companyId,
          userId: fluxusComplementaryReports.userId,
          assessmentId: fluxusComplementaryReports.assessmentId,
          kind: fluxusComplementaryReports.kind,
          status: fluxusComplementaryReports.status,
          revision: fluxusComplementaryReports.revision,
          termsVersion: fluxusComplementaryReports.termsVersion,
          sourceDate: fluxusComplementaryReports.sourceDate,
          values: fluxusComplementaryReports.values,
          context: fluxusComplementaryReports.context,
          recipientSnapshot: fluxusComplementaryReports.recipientSnapshot,
          confirmedAt: fluxusComplementaryReports.confirmedAt,
          ownerApprovalStatus: users.approvalStatus,
          ownerPrivacyDeletedAt: users.privacyDeletedAt,
          ownerAccountType: users.accountType,
          ownerRole: users.role,
          ownerCompanyId: users.companyId,
          companyActive: fluxusCompanies.active,
        })
        .from(fluxusComplementaryReports)
        .innerJoin(users, eq(users.id, fluxusComplementaryReports.userId))
        .innerJoin(
          fluxusCompanies,
          eq(fluxusCompanies.id, fluxusComplementaryReports.companyId)
        )
        .where(
          and(
            eq(fluxusComplementaryReports.companyId, companyId),
            eq(fluxusComplementaryReports.userId, person.userId),
            eq(fluxusComplementaryReports.assessmentId, person.assessmentId),
            eq(fluxusComplementaryReports.status, "confirmed"),
            eq(
              fluxusComplementaryReports.termsVersion,
              COMPLEMENTARY_TERMS_VERSION
            ),
            isNotNull(fluxusComplementaryReports.sourceDate),
            isNotNull(fluxusComplementaryReports.confirmedAt),
            isNotNull(fluxusComplementaryReports.values),
            or(eq(fluxusComplementaryReports.userId, viewerId), recipientMatch),
            eq(users.companyId, companyId),
            eq(users.approvalStatus, "approved"),
            isNull(users.privacyDeletedAt),
            or(eq(users.role, "admin"), eq(users.accountType, "fluxus")),
            eq(fluxusCompanies.active, 1)
          )
        )
        .orderBy(
          sql`${fluxusComplementaryReports.sourceDate} DESC NULLS LAST`,
          desc(fluxusComplementaryReports.confirmedAt),
          desc(fluxusComplementaryReports.id)
        )
        .limit(EXECUTIVE_COMPLEMENTARY_MAX_SOURCES_PER_PERSON)
        .for("share")) as ExecutiveComplementaryRow[];

      const bundle: ExecutiveComplementaryBundle = {};
      for (const row of rows) {
        if (row.termsVersion !== COMPLEMENTARY_TERMS_VERSION) continue;
        if (row.kind === "pq" && bundle.pq) continue;
        if (row.kind === "saboteurs" && bundle.saboteurs) continue;
        try {
          await requireReaderAccess(tx, viewerId, row);
        } catch (error) {
          // Uma retirada/cadastro inválido concorrente remove a fonte deste
          // painel, sem transformar a leitura executiva em um oracle privado.
          if (error instanceof TRPCError && error.code === "NOT_FOUND") {
            continue;
          }
          throw error;
        }
        const source = executiveSourceFromRow(row);
        if (!source) continue;
        if (source.kind === "pq") bundle.pq = source;
        else bundle.saboteurs = source;
        if (bundle.pq && bundle.saboteurs) break;
      }

      if (!bundle.pq && !bundle.saboteurs) continue;
      result[String(person.assessmentId)] = bundle;
      for (const source of [bundle.pq, bundle.saboteurs]) {
        if (!source) continue;
        await insertAudit(tx, {
          actorUserId: viewerId,
          subjectUserId: source.userId,
          companyId,
          action: "complementary.view",
          reportId: source.id,
          status: "confirmed",
          revision: source.revision,
          scope: viewerId === source.userId ? "owner" : "recipient",
        });
      }
    }
    return result;
  });
}

export async function getComplementaryAvailability(
  userId: number
): Promise<ComplementaryAvailability> {
  const user = await loadLiveUser(db, userId);
  if (!activeUser(user)) forbidden(GENERIC_ACTIVE_ACCOUNT);
  const base = {
    enabled: complementaryEnabled(),
    termsVersion: COMPLEMENTARY_TERMS_VERSION,
    user: { id: user.id, name: user.name ?? "", companyId: user.companyId },
    recipients: [] as ComplementaryRecipient[],
  };
  if (!user.companyId) {
    return { ...base, eligible: false, reason: "company_required" };
  }
  const company = await loadCompany(db, user.companyId);
  if (!company || company.active !== 1) {
    return { ...base, eligible: false, reason: "company_inactive" };
  }
  const recipients = await loadCandidates(db, company.id);
  const assessment = await latestCompletedAssessment(db, user.id, company.id);
  const eligible = Boolean(
    assessment &&
      user.name?.trim() &&
      (user.role === "admin" || user.accountType === "fluxus")
  );
  return {
    ...base,
    recipients: recipients.filter(recipient => recipient.id !== user.id),
    eligible,
    reason: eligible ? null : "assessment_required",
  };
}

export async function uploadComplementaryReport(input: {
  userId: number;
  kind: ComplementaryKind;
  fileName: string;
  pdfBase64: string;
  recipientUserIds: number[];
  context?: string | null;
  termsVersion: string;
  consentText: string;
  consentAccepted: true;
}): Promise<ComplementaryDetail> {
  if (!complementaryEnabled())
    precondition(
      "A importação complementar está temporariamente indisponível."
    );
  if (!complementaryEncryptionConfigured())
    precondition("O cofre de relatórios ainda não está configurado.");
  if (
    input.consentAccepted !== true ||
    input.termsVersion !== COMPLEMENTARY_TERMS_VERSION
  ) {
    badRequest("Aceite o termo vigente de importação complementar.");
  }
  const access = await requireEligibleOwner(db, input.userId);
  const fileName = validateFileName(input.fileName);
  const context = input.context?.trim() ? input.context.trim() : null;
  if (context && context.length > 1000)
    badRequest("O contexto excede o limite permitido.");
  const recipients = await resolveRecipientSnapshot(
    db,
    access.user.id,
    access.company.id,
    input.recipientUserIds
  );
  const consentText = complementaryConsentText(recipients);
  if (input.consentText !== consentText)
    badRequest(
      "Os leitores ou o termo mudaram. Revise e aceite novamente antes de enviar."
    );
  const pdf = decodeCanonicalPdf(input.pdfBase64);

  let parsed: Awaited<ReturnType<typeof extractComplementaryPdf>>;
  try {
    parsed = await extractComplementaryPdf(pdf, input.kind);
  } catch {
    badRequest("Não foi possível validar o PDF do relatório complementar.");
  }
  const sourceName = safeSourceName(parsed.sourceName);
  if (!sourceName)
    badRequest("O nome do titular não foi encontrado no relatório.");
  if (!namesCorrelate(access.user.name!, sourceName)) {
    badRequest(
      "O titular identificado no PDF não corresponde ao usuário autenticado."
    );
  }
  const sourceDate =
    parsed.sourceDate === null
      ? null
      : validateSourceDate(parsed.sourceDate, false);
  const warnings = safeWarnings(parsed.warnings);
  const fileHash = createHash("sha256").update(pdf).digest("hex");
  let ciphertext: string;
  try {
    ciphertext = encryptComplementaryPdf(
      access.company.id,
      access.user.id,
      pdf
    );
  } catch {
    precondition("O cofre de relatórios ainda não está configurado.");
  }

  try {
    return await db.transaction(async rawTx => {
      const tx = rawTx as unknown as Executor;
      await acquireOwnerTransactionLock(tx, access.user.id, access.company.id);
      const fresh = await requireEligibleOwner(tx, access.user.id);
      if (fresh.company.id !== access.company.id) conflict();
      const freshRecipients = await resolveRecipientSnapshot(
        tx,
        fresh.user.id,
        fresh.company.id,
        recipients.map(recipient => recipient.id)
      );
      if (JSON.stringify(freshRecipients) !== JSON.stringify(recipients)) {
        badRequest(
          "Um dos leitores escolhidos mudou enquanto o PDF era processado."
        );
      }
      if (!namesCorrelate(fresh.user.name!, sourceName)) {
        badRequest(
          "O titular identificado no PDF não corresponde ao usuário autenticado."
        );
      }
      const activeRows = await tx
        .select({
          id: fluxusComplementaryReports.id,
          status: fluxusComplementaryReports.status,
          fileHash: fluxusComplementaryReports.fileHash,
        })
        .from(fluxusComplementaryReports)
        .where(
          and(
            eq(fluxusComplementaryReports.userId, fresh.user.id),
            isNotNull(fluxusComplementaryReports.fileHash),
            ne(fluxusComplementaryReports.status, "revoked")
          )
        )
        .limit(COMPLEMENTARY_MAX_ACTIVE + 1)
        .for("update");
      if (activeRows.length >= COMPLEMENTARY_MAX_ACTIVE) {
        badRequest("Você atingiu o limite de vinte importações ativas.");
      }
      if (activeRows.some(row => row.fileHash === fileHash)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Este PDF já foi importado em uma importação ativa.",
        });
      }
      if (
        activeRows.filter(row => row.status === "pending").length >=
        COMPLEMENTARY_MAX_PENDING
      ) {
        badRequest("Você atingiu o limite de quatro importações pendentes.");
      }
      const inserted = await tx
        .insert(fluxusComplementaryReports)
        .values({
          companyId: fresh.company.id,
          userId: fresh.user.id,
          assessmentId: fresh.assessmentId,
          kind: input.kind,
          status: "pending",
          revision: 1,
          fileHash,
          fileName,
          pdfCiphertext: ciphertext,
          sourceName,
          sourceDate,
          values: null,
          warnings,
          context,
          recipientSnapshot: recipients,
          termsVersion: COMPLEMENTARY_TERMS_VERSION,
          consentText,
          consentedAt: new Date(),
        })
        .returning({
          id: fluxusComplementaryReports.id,
          status: fluxusComplementaryReports.status,
          revision: fluxusComplementaryReports.revision,
        });
      const report = inserted[0];
      if (!report)
        throw new Error("Não foi possível guardar o relatório complementar.");
      await insertAudit(tx, {
        actorUserId: fresh.user.id,
        subjectUserId: fresh.user.id,
        companyId: fresh.company.id,
        action: "complementary.import",
        reportId: report.id,
        status: report.status,
        revision: report.revision,
      });
      const row = await loadReportWithOwner(tx, report.id, false);
      if (!row)
        throw new Error("Relatório complementar não encontrado após gravação.");
      const detail = detailFromRow(row, true);
      return {
        ...detail,
        values: parsed.values,
        warnings: safeWarnings(parsed.warnings),
        sourceDate: parsed.sourceDate ?? detail.sourceDate,
      };
    });
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    if (uniqueViolation(error)) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Este PDF já foi importado em uma importação ativa.",
      });
    }
    throw error;
  }
}

export async function listMine(
  userId: number,
  offset = 0,
  limit = 10
): Promise<{ reports: ComplementarySummary[]; hasMore: boolean }> {
  const access = await requireOwnerAccess(db, userId);
  const safeOffset = Math.max(0, Math.trunc(offset));
  const safeLimit = Math.min(20, Math.max(1, Math.trunc(limit)));
  const rows = await db
    .select(snapshotFields)
    .from(fluxusComplementaryReports)
    .innerJoin(users, eq(users.id, fluxusComplementaryReports.userId))
    .innerJoin(
      fluxusCompanies,
      eq(fluxusCompanies.id, fluxusComplementaryReports.companyId)
    )
    .where(
      and(
        eq(fluxusComplementaryReports.userId, access.user.id),
        eq(fluxusComplementaryReports.companyId, access.company.id),
        eq(users.approvalStatus, "approved"),
        isNull(users.privacyDeletedAt),
        eq(fluxusCompanies.active, 1)
      )
    )
    .orderBy(
      desc(fluxusComplementaryReports.createdAt),
      desc(fluxusComplementaryReports.id)
    )
    .limit(safeLimit + 1)
    .offset(safeOffset);
  const hasMore = rows.length > safeLimit;
  const reports = rows.slice(0, safeLimit).map(summaryFromRow);
  if (rows.length) {
    await insertAudit(db, {
      actorUserId: access.user.id,
      subjectUserId: rows[0]!.userId,
      companyId: rows[0]!.companyId,
      action: "complementary.view",
      reportId: rows[0]!.id,
      scope: "owner",
    });
  }
  return { reports, hasMore };
}

export async function listSharedWithMe(
  userId: number,
  offset = 0,
  limit = 10
): Promise<{ reports: ComplementarySummary[]; hasMore: boolean }> {
  const viewer = await loadLiveUser(db, userId);
  if (!activeUser(viewer)) forbidden(GENERIC_ACTIVE_ACCOUNT);
  if (!viewer.companyId && viewer.role !== "admin")
    forbidden(GENERIC_FORBIDDEN);
  const candidates =
    viewer.role === "admin" ||
    (viewer.companyId !== null &&
      isCandidateForCompany(viewer, viewer.companyId));
  if (!candidates) forbidden(GENERIC_FORBIDDEN);
  const safeOffset = Math.max(0, Math.trunc(offset));
  const safeLimit = Math.min(20, Math.max(1, Math.trunc(limit)));
  const recipientMatch = sql`${fluxusComplementaryReports.recipientSnapshot} @> ${JSON.stringify([{ id: userId }])}::jsonb`;
  const conditions = [
    eq(fluxusComplementaryReports.status, "confirmed" as const),
    recipientMatch,
    eq(users.approvalStatus, "approved" as const),
    isNull(users.privacyDeletedAt),
    eq(fluxusCompanies.active, 1),
  ];
  if (viewer.role !== "admin" && viewer.companyId) {
    conditions.push(eq(fluxusComplementaryReports.companyId, viewer.companyId));
  }
  const rows = await db
    .select(snapshotFields)
    .from(fluxusComplementaryReports)
    .innerJoin(users, eq(users.id, fluxusComplementaryReports.userId))
    .innerJoin(
      fluxusCompanies,
      eq(fluxusCompanies.id, fluxusComplementaryReports.companyId)
    )
    .where(and(...conditions))
    .orderBy(
      desc(fluxusComplementaryReports.confirmedAt),
      desc(fluxusComplementaryReports.id)
    )
    .limit(safeLimit + 1)
    .offset(safeOffset);
  const visible = rows.filter(
    row =>
      rowOwnerIsLive(row) &&
      row.recipientSnapshot.some(recipient => recipient.id === userId)
  );
  const hasMore = rows.length > safeLimit;
  const reports = visible.slice(0, safeLimit).map(summaryFromRow);
  if (rows.length) {
    await insertAudit(db, {
      actorUserId: userId,
      subjectUserId: rows[0]!.userId,
      companyId: rows[0]!.companyId,
      action: "complementary.view",
      reportId: rows[0]!.id,
      scope: "recipient",
    });
  }
  return { reports, hasMore };
}

export async function getComplementaryDetail(
  viewerId: number,
  reportId: number
): Promise<ComplementaryDetail> {
  ensurePositiveId(reportId, "Relatório");
  return db.transaction(async rawTx => {
    const tx = rawTx as unknown as Executor;
    const row = await loadReportWithOwner(tx, reportId, false, true);
    if (!row) notFound();
    const access = await requireReaderAccess(tx, viewerId, row);
    await insertAudit(tx, {
      actorUserId: viewerId,
      subjectUserId: row.userId,
      companyId: row.companyId,
      action: "complementary.view",
      reportId: row.id,
      status: row.status,
      revision: row.revision,
      scope: access.isOwner ? "owner" : "recipient",
    });
    const detail = detailFromRow(row, access.isOwner);
    if (access.isOwner && row.status === "pending") {
      // Buscar o arquivo somente depois da autorização, para a conferência do titular.
      const stored = await loadReportWithOwner(tx, reportId, true);
      if (
        !stored ||
        stored.status !== "pending" ||
        stored.revision !== row.revision
      )
        conflict();
      return enrichPendingOwnerDetail(stored, detail);
    }
    return detail;
  });
}

export async function confirmComplementaryReport(input: {
  userId: number;
  reportId: number;
  expectedRevision: number;
  sourceDate: string;
  values: unknown;
  identityConfirmed: true;
}): Promise<ComplementaryDetail> {
  if (!complementaryEnabled())
    precondition(
      "A confirmação complementar está temporariamente indisponível."
    );
  if (!complementaryEncryptionConfigured())
    precondition("O cofre de relatórios ainda não está configurado.");
  if (input.identityConfirmed !== true)
    badRequest("Confirme a identidade do titular.");
  ensurePositiveId(input.reportId, "Relatório");
  if (
    !Number.isSafeInteger(input.expectedRevision) ||
    input.expectedRevision < 1
  )
    badRequest("Revisão inválida.");
  const sourceDate = validateSourceDate(input.sourceDate, false);
  return db.transaction(async rawTx => {
    const tx = rawTx as unknown as Executor;
    const initial = await loadReportWithOwner(tx, input.reportId, false);
    if (!initial || initial.userId !== input.userId) notFound();
    await acquireOwnerTransactionLock(tx, input.userId, initial.companyId);
    const access = await requireEligibleOwner(tx, input.userId);
    const locked = await tx
      .select({
        ...snapshotFields,
        pdfCiphertext: fluxusComplementaryReports.pdfCiphertext,
      })
      .from(fluxusComplementaryReports)
      .innerJoin(users, eq(users.id, fluxusComplementaryReports.userId))
      .innerJoin(
        fluxusCompanies,
        eq(fluxusCompanies.id, fluxusComplementaryReports.companyId)
      )
      .where(
        and(
          eq(fluxusComplementaryReports.id, input.reportId),
          eq(fluxusComplementaryReports.userId, input.userId),
          eq(fluxusComplementaryReports.companyId, access.company.id)
        )
      )
      .limit(1)
      .for("update");
    const row = locked[0];
    if (!row) notFound();
    if (row.revision !== input.expectedRevision) conflict();
    if (row.status !== "pending")
      badRequest("Somente um relatório pendente pode ser confirmado.");
    if (!row.pdfCiphertext)
      badRequest("O PDF protegido não está disponível para confirmar.");
    let verifiedPdf: Buffer;
    try {
      verifiedPdf = decryptComplementaryPdf(
        row.companyId,
        row.userId,
        row.pdfCiphertext
      );
    } catch {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Não foi possível validar a integridade do PDF protegido.",
      });
    }
    assertPdfIntegrity(row, verifiedPdf);
    const snapshot = Array.isArray(row.recipientSnapshot)
      ? row.recipientSnapshot
      : [];
    await resolveRecipientSnapshot(
      tx,
      input.userId,
      access.company.id,
      recipientIds(snapshot)
    );
    const values = normalizeComplementaryValues(input.values, row.kind);
    const updated = await tx
      .update(fluxusComplementaryReports)
      .set({
        sourceDate,
        values,
        status: "confirmed",
        revision: sql`${fluxusComplementaryReports.revision} + 1`,
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(fluxusComplementaryReports.id, row.id),
          eq(fluxusComplementaryReports.userId, input.userId),
          eq(fluxusComplementaryReports.revision, input.expectedRevision),
          eq(fluxusComplementaryReports.status, "pending")
        )
      )
      .returning({
        id: fluxusComplementaryReports.id,
        status: fluxusComplementaryReports.status,
        revision: fluxusComplementaryReports.revision,
      });
    const report = updated[0];
    if (!report) conflict();
    await insertAudit(tx, {
      actorUserId: input.userId,
      subjectUserId: input.userId,
      companyId: access.company.id,
      action: "complementary.confirm",
      reportId: report.id,
      status: report.status,
      revision: report.revision,
    });
    const finalRow = await loadReportWithOwner(tx, report.id, false);
    if (!finalRow) notFound();
    return detailFromRow(finalRow, true);
  });
}

export async function revokeComplementaryReport(input: {
  userId: number;
  reportId: number;
  expectedRevision: number;
}): Promise<{ success: true }> {
  ensurePositiveId(input.reportId, "Relatório");
  if (
    !Number.isSafeInteger(input.expectedRevision) ||
    input.expectedRevision < 1
  )
    badRequest("Revisão inválida.");
  return db.transaction(async rawTx => {
    const tx = rawTx as unknown as Executor;
    const initial = await loadReportWithOwner(tx, input.reportId, false);
    if (!initial || initial.userId !== input.userId) notFound();
    await acquireOwnerTransactionLock(tx, input.userId, initial.companyId);
    const access = await requireOwnerAccess(tx, input.userId);
    if (access.company.id !== initial.companyId) notFound();
    const locked = await tx
      .select({
        id: fluxusComplementaryReports.id,
        companyId: fluxusComplementaryReports.companyId,
        userId: fluxusComplementaryReports.userId,
        status: fluxusComplementaryReports.status,
        revision: fluxusComplementaryReports.revision,
      })
      .from(fluxusComplementaryReports)
      .where(
        and(
          eq(fluxusComplementaryReports.id, input.reportId),
          eq(fluxusComplementaryReports.userId, input.userId)
        )
      )
      .limit(1)
      .for("update");
    const row = locked[0];
    if (!row) notFound();
    if (row.revision !== input.expectedRevision) conflict();
    if (row.status === "revoked") badRequest("Este relatório já foi retirado.");
    const updated = await tx
      .update(fluxusComplementaryReports)
      .set({
        status: "revoked",
        revision: sql`${fluxusComplementaryReports.revision} + 1`,
        fileHash: null,
        fileName: null,
        pdfCiphertext: null,
        sourceName: null,
        sourceDate: null,
        values: null,
        warnings: [],
        context: null,
        confirmedAt: null,
        revokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(fluxusComplementaryReports.id, input.reportId),
          eq(fluxusComplementaryReports.userId, input.userId),
          eq(fluxusComplementaryReports.revision, input.expectedRevision),
          ne(fluxusComplementaryReports.status, "revoked")
        )
      )
      .returning({
        id: fluxusComplementaryReports.id,
        revision: fluxusComplementaryReports.revision,
      });
    const report = updated[0];
    if (!report) conflict();
    await insertAudit(tx, {
      actorUserId: input.userId,
      subjectUserId: input.userId,
      companyId: access.company.id,
      action: "complementary.revoke",
      reportId: report.id,
      status: "revoked",
      revision: report.revision,
    });
    return { success: true } as const;
  });
}

export async function downloadComplementaryReport(
  viewerId: number,
  reportId: number
): Promise<{ base64: string; fileName: string }> {
  ensurePositiveId(reportId, "Relatório");
  if (!complementaryEncryptionConfigured())
    precondition("O cofre de relatórios ainda não está configurado.");
  return db.transaction(async rawTx => {
    const tx = rawTx as unknown as Executor;
    const raw = await loadReportWithOwner(tx, reportId, true, true);
    if (!raw) notFound();
    const row = raw as DownloadRow;
    const access = await requireReaderAccess(tx, viewerId, row);
    if (
      row.status !== "confirmed" ||
      !row.pdfCiphertext ||
      !row.fileHash ||
      !row.fileName
    )
      notFound();
    let pdf: Buffer;
    try {
      pdf = decryptComplementaryPdf(
        row.companyId,
        row.userId,
        row.pdfCiphertext
      );
    } catch {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Não foi possível abrir o PDF protegido.",
      });
    }
    assertPdfIntegrity(row, pdf);
    await insertAudit(tx, {
      actorUserId: viewerId,
      subjectUserId: row.userId,
      companyId: row.companyId,
      action: "complementary.download",
      reportId: row.id,
      status: row.status,
      revision: row.revision,
      scope: access.isOwner ? "owner" : "recipient",
    });
    return { base64: pdf.toString("base64"), fileName: row.fileName };
  });
}
