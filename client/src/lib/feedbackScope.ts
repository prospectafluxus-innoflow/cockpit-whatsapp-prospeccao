export type FeedbackHierarchyPerson = {
  id: number;
  isCompanyAdmin?: boolean;
  managerEligible: boolean;
  managerUserId: number | null;
  departmentId: number | null;
  assignmentId: number | null;
  jobTitle: string | null;
};

export type FeedbackAssignmentSnapshot = {
  id: number;
  userId: number;
  departmentId: number | null;
  managerUserId: number | null;
  jobTitle: string | null;
};

export type RefreshCallback = () => void | Promise<unknown>;

/** A query result with no hierarchy fields must never be treated as an empty assignment. */
export function hasHierarchySnapshot(
  person: Partial<FeedbackHierarchyPerson> | undefined
): person is FeedbackHierarchyPerson {
  return Boolean(
    person &&
      typeof person.managerEligible === "boolean" &&
      (typeof person.managerUserId === "number" ||
        person.managerUserId === null) &&
      (typeof person.departmentId === "number" ||
        person.departmentId === null) &&
      (typeof person.assignmentId === "number" ||
        person.assignmentId === null) &&
      (typeof person.jobTitle === "string" || person.jobTitle === null)
  );
}

export function managerCandidates(
  people: readonly Partial<FeedbackHierarchyPerson>[],
  targetUserId: number
): FeedbackHierarchyPerson[] {
  return people.filter(
    (person): person is FeedbackHierarchyPerson =>
      person.id !== targetUserId && person.managerEligible === true
  );
}

export function assignmentForUser(
  assignments: readonly FeedbackAssignmentSnapshot[],
  userId: number
): FeedbackAssignmentSnapshot | undefined {
  return assignments.find(assignment => assignment.userId === userId);
}

export function returnedRecordName(
  record: { id?: number | null; name?: string | null } | null | undefined,
  fallback: string
): string {
  const name = record?.name?.trim();
  if (name) return name;
  if (record?.id !== undefined && record.id !== null) {
    return `${fallback} #${record.id}`;
  }
  return fallback;
}

/**
 * A mutation is already committed when this helper is called. It never retries
 * the mutation and turns a failed refetch/invalidation into a stable false value.
 */
export async function refreshAfterMutation(
  refresh: RefreshCallback
): Promise<boolean> {
  try {
    const result = await refresh();
    if (
      result &&
      typeof result === "object" &&
      "isError" in result &&
      result.isError === true
    )
      return false;
    return true;
  } catch {
    return false;
  }
}

export function sameAssignmentSnapshot(
  person: Partial<FeedbackHierarchyPerson> | undefined,
  expectedAssignmentId: number | null,
  expectedManagerUserId: number | null
): boolean {
  return Boolean(
    hasHierarchySnapshot(person) &&
      person.assignmentId === expectedAssignmentId &&
      person.managerUserId === expectedManagerUserId
  );
}

export function fullAssignmentSnapshotMatches(
  expected: FeedbackAssignmentSnapshot | null,
  current: FeedbackAssignmentSnapshot | undefined
): boolean {
  if (!expected || !current) return expected === null && current === undefined;
  return (
    expected.id === current.id &&
    expected.userId === current.userId &&
    expected.departmentId === current.departmentId &&
    expected.managerUserId === current.managerUserId &&
    expected.jobTitle === current.jobTitle
  );
}
