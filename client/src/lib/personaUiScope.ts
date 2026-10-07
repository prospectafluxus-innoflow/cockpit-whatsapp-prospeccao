export function isPersonaRoute(location: string): boolean {
  const pathname = location.split(/[?#]/, 1)[0];
  return pathname === "/fluxus" || pathname.startsWith("/fluxus/");
}
