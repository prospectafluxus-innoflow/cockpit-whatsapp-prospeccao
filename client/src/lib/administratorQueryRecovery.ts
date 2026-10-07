export function shouldRetryAdministratorQuery(
  failureCount: number,
  error: unknown
) {
  if (failureCount >= 2) return false;
  const code =
    typeof error === "object" && error !== null && "data" in error
      ? (error as { data?: { code?: unknown } }).data?.code
      : undefined;
  // Network failures may not have a tRPC code. Never retry explicit access,
  // validation or configuration failures, nor change the user's authority.
  return (
    code === undefined ||
    [
      "INTERNAL_SERVER_ERROR",
      "TIMEOUT",
      "BAD_GATEWAY",
      "SERVICE_UNAVAILABLE",
    ].includes(String(code))
  );
}

export function administratorQueryRetryDelay(attempt: number) {
  return Math.min(500 * 2 ** attempt, 2000);
}
