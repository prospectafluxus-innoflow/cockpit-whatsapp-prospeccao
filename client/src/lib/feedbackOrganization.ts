import type { FeedbackRole } from "@shared/feedback";

export type OrganizationDepartment = {
  id: number;
  name: string;
  parentId: number | null;
  active: boolean;
};

export type FeedbackAccessPerson = {
  id: number;
  membershipRole?: FeedbackRole | null;
  feedbackCanRead?: boolean;
  hasFeedbackAccess?: boolean;
  membershipId?: number | null;
};

export type FeedbackMembershipForm = {
  role: FeedbackRole;
  canReadFeedback: boolean;
  hasFeedbackAccess: boolean;
};

/** Returns every descendant of a department, without trusting a tree-shaped API response. */
export function departmentDescendantIds(
  departments: readonly Pick<OrganizationDepartment, "id" | "parentId">[],
  departmentId: number
): Set<number> {
  const children = new Map<number, number[]>();
  for (const department of departments) {
    if (department.parentId === null) continue;
    const siblings = children.get(department.parentId) ?? [];
    siblings.push(department.id);
    children.set(department.parentId, siblings);
  }

  const descendants = new Set<number>();
  const queue = [...(children.get(departmentId) ?? [])];
  while (queue.length > 0) {
    const childId = queue.shift()!;
    if (descendants.has(childId) || childId === departmentId) continue;
    descendants.add(childId);
    queue.push(...(children.get(childId) ?? []));
  }
  return descendants;
}

/** Parent choices are active, sorted by name, and cannot create self/cyclic trees. */
export function departmentParentOptions(
  departments: readonly OrganizationDepartment[],
  editingDepartmentId?: number | null
): OrganizationDepartment[] {
  const excluded = new Set<number>();
  if (editingDepartmentId !== undefined && editingDepartmentId !== null) {
    excluded.add(editingDepartmentId);
    departmentDescendantIds(departments, editingDepartmentId).forEach(
      descendant => excluded.add(descendant)
    );
  }
  return departments
    .filter(department => department.active && !excluded.has(department.id))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function departmentName(
  departments: readonly Pick<OrganizationDepartment, "id" | "name">[],
  departmentId: number | null | undefined,
  fallback = "Sem departamento"
): string {
  if (departmentId === null || departmentId === undefined) return fallback;
  return (
    departments.find(department => department.id === departmentId)?.name ??
    "Departamento arquivado"
  );
}

/** The role and read flag come from the selected person's DTO; role never grants read implicitly. */
export function hydrateFeedbackMembership(
  person: FeedbackAccessPerson | null | undefined
): FeedbackMembershipForm {
  return {
    role: person?.membershipRole ?? "collaborator",
    canReadFeedback: person?.feedbackCanRead === true,
    hasFeedbackAccess: person?.hasFeedbackAccess === true,
  };
}

export function feedbackMembershipFingerprint(
  person: FeedbackAccessPerson | null | undefined
): string {
  if (!person) return "missing";
  return [
    person.id,
    person.membershipId ?? "unknown",
    person.membershipRole ?? "none",
    person.feedbackCanRead === true ? "read" : "no-read",
    person.hasFeedbackAccess === true ? "access" : "no-access",
  ].join(":");
}

export function isMembershipFormCurrent(input: {
  selectedUserId: number | null;
  snapshotUserId: number | null;
  snapshotFingerprint: string | null;
  person: FeedbackAccessPerson | null | undefined;
}): boolean {
  return Boolean(
    hasKnownFeedbackMembership(input.person) &&
      input.selectedUserId !== null &&
      input.selectedUserId === input.snapshotUserId &&
      input.snapshotFingerprint !== null &&
      input.snapshotFingerprint === feedbackMembershipFingerprint(input.person)
  );
}

export function hasKnownFeedbackMembership(
  person: FeedbackAccessPerson | null | undefined
): boolean {
  if (
    !person ||
    typeof person.hasFeedbackAccess !== "boolean" ||
    typeof person.feedbackCanRead !== "boolean" ||
    !("membershipRole" in person)
  )
    return false;
  if (!person.hasFeedbackAccess)
    return (
      person.membershipRole === null &&
      person.feedbackCanRead === false &&
      person.membershipId === null
    );
  return (
    typeof person.membershipId === "number" &&
    person.membershipId > 0 &&
    person.membershipRole !== null &&
    person.membershipRole !== undefined &&
    ["collaborator", "manager", "supermanager", "hr", "company_admin"].includes(
      person.membershipRole
    )
  );
}

export function feedbackRoleReach(
  role: FeedbackRole,
  scopedDepartments: readonly string[]
): string {
  if (role === "company_admin" || role === "hr") return "empresa inteira";
  if (role === "manager") return "equipe direta";
  if (role === "supermanager")
    return scopedDepartments.length
      ? scopedDepartments.join(", ")
      : "nenhum departamento atribuído — configure Gestão de áreas";
  return "próprias devolutivas";
}

export function canConfirmFeedbackMembership(input: {
  current: boolean;
  queryBusy: boolean;
  companyId: number | null;
  membershipCompanyId: number | null;
  membershipRole: FeedbackRole | null;
}): boolean {
  return (
    input.current &&
    !input.queryBusy &&
    input.companyId !== null &&
    input.companyId === input.membershipCompanyId &&
    input.membershipRole === "company_admin"
  );
}

function positiveId(value: string | null): number | undefined {
  if (!value || !/^[1-9]\d*$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export type OrganizationRouteIntent = {
  section: "organization";
  accessUserId?: number;
  returnCycleId?: number;
};

/** URL options only select an already authorized UI state; they never grant access. */
export function parseOrganizationRouteIntent(
  search: string,
  currentUserCanConfigure: boolean
): OrganizationRouteIntent | null {
  if (!currentUserCanConfigure) return null;
  const params = new URLSearchParams(search.split("#", 1)[0]);
  if (params.get("section") !== "organization") return null;
  const accessUserId = positiveId(params.get("accessUserId"));
  const returnCycleId = positiveId(params.get("returnCycleId"));
  return {
    section: "organization",
    ...(accessUserId === undefined ? {} : { accessUserId }),
    ...(returnCycleId === undefined ? {} : { returnCycleId }),
  };
}

export function scopeLabel(
  includeDescendants: boolean,
  department: string
): string {
  return `${department}${includeDescendants ? " e descendentes" : ""}`;
}
