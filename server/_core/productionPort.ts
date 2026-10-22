const PORT_PATTERN = /^[0-9]+$/;

export const PRODUCTION_HOST = "0.0.0.0";

/**
 * Cloud Run supplies PORT. Production must fail fast instead of silently
 * selecting another listener when the value is absent or malformed.
 */
export function parseProductionPort(rawPort: string | undefined = process.env.PORT): number {
  const value = rawPort?.trim();

  if (!value || !PORT_PATTERN.test(value)) {
    throw new Error("PORT must be a decimal TCP port between 1 and 65535");
  }

  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be a decimal TCP port between 1 and 65535");
  }

  return port;
}
