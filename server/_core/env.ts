export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "dev-secret-change-in-production",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  // Manus Forge (legado — não usado em produção independente)
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Google Gemini (IA independente — Google AI Studio)
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  // OpenRouter (alternativa de IA)
  openRouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  // Render Cron secret (para proteger endpoint /api/cron/*)
  cronSecret: process.env.CRON_SECRET ?? "",
};
