import express, { type RequestHandler } from "express";

/** Limites por processo; o serviço mantém a autorização e os limites por titular. */
export function complementaryRequestLimits(maxConcurrent = 8): RequestHandler {
  const json = express.json({ limit: "8mb" });
  let active = 0;
  return (req, res, next) => {
    let path = req.path;
    try {
      path = decodeURIComponent(path);
    } catch {
      return next();
    }
    if (
      !path.startsWith("/api/trpc/") ||
      !path.includes("fluxusComplementary.")
    )
      return next();
    if (active >= maxConcurrent) {
      res
        .status(429)
        .json({
          error:
            "Há operações de relatórios em andamento. Aguarde e tente novamente.",
        });
      return;
    }
    active++;
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        active--;
      }
    };
    res.once("finish", release);
    res.once("close", release);
    json(req, res, error => {
      if (error) {
        res
          .status(413)
          .json({
            error:
              "A requisição excede o limite da importação. Envie um PDF por vez, de até 5 MiB.",
          });
        return;
      }
      next();
    });
  };
}
