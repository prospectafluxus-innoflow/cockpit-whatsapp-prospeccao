const CHUNK_RELOAD_KEY = "innoflow:chunk-reload-at";
const CHUNK_RELOAD_WINDOW_MS = 60_000;

const staleAssetPatterns = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /loading chunk [\d-]+ failed/i,
  /chunkloaderror/i,
  /unable to preload css/i,
];

function errorText(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === "string") return error;
  return "";
}

export function isStaleAssetError(error: unknown) {
  const text = errorText(error);
  return staleAssetPatterns.some(pattern => pattern.test(text));
}

export function reloadOnceAfterStaleAssetError(error: unknown) {
  if (typeof window === "undefined" || !isStaleAssetError(error)) return false;

  const lastReloadAt = Number(
    window.sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0
  );
  const now = Date.now();

  if (now - lastReloadAt < CHUNK_RELOAD_WINDOW_MS) return false;

  window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
  window.location.reload();
  return true;
}

export function clearStaleAssetReloadGuard() {
  if (typeof window === "undefined") return;

  window.setTimeout(() => {
    window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  }, CHUNK_RELOAD_WINDOW_MS);
}
