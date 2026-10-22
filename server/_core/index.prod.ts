import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic } from "./static";
import { sendReminderHandler } from "../scheduleHandler";
import { cronSendReminderHandler } from "../cronHandler";
import { wablastWebhookHandler } from "../wablastWebhook";
import { parseProductionPort, PRODUCTION_HOST } from "./productionPort";

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.set("trust proxy", 1);
  // Health is intentionally generic and does not read or disclose secrets.
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  // A assinatura Standard Webhooks exige os bytes exatos antes de JSON.parse.
  app.post("/api/webhooks/wablast", express.raw({ type: "application/json", limit: "1mb" }), wablastWebhookHandler);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // Heartbeat scheduled endpoints (Manus)
  app.post("/api/scheduled/send-reminder", sendReminderHandler);
  // Railway Cron Jobs endpoint (independente)
  app.post("/api/cron/send-reminder", cronSendReminderHandler);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Production mode: serve static files from dist/public
  serveStatic(app);

  const port = parseProductionPort(process.env.PORT);

  server.listen(port, PRODUCTION_HOST, () => {
    console.log(`Server running on http://${PRODUCTION_HOST}:${port}/`);
  });
}

startServer().catch(error => {
  console.error("[production] startup failed:", error);
  process.exitCode = 1;
});
