import type { Express } from "express";
import { userOwnsMessageTemplateAudio } from "../db";
import { storageGetSignedUrl } from "../storage";
import { sdk } from "./sdk";

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Chave de armazenamento ausente.");
      return;
    }

    try {
      const user = await sdk.authenticateRequest(req);
      const belongsToUser =
        key.startsWith(`audio/${user.id}/`) &&
        (await userOwnsMessageTemplateAudio(user.id, key));

      if (!belongsToUser) {
        res.status(404).send("Ficheiro não encontrado.");
        return;
      }

      const signedUrl = await storageGetSignedUrl(key);
      res.set("Cache-Control", "private, no-store");
      res.redirect(307, signedUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "erro desconhecido";
      const authenticationFailure = /session|cookie|unauth|forbidden/i.test(message);

      if (authenticationFailure) {
        res.status(401).send("Autenticação necessária.");
        return;
      }

      console.error("[Storage] Falha ao preparar acesso ao ficheiro:", message);
      res.status(503).send("Ficheiro temporariamente indisponível.");
    }
  });
}
