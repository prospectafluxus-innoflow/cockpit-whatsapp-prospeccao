/**
 * heartbeat.ts — Stub de agendamento para deploy independente
 *
 * Em produção no Render, os cron jobs são configurados via render.yaml
 * (Render Cron Jobs) e não precisam de criação dinâmica via API.
 *
 * Este módulo mantém a interface original para compatibilidade com
 * server/routers.ts. No provider não-Google, uma ausência do Forge é erro
 * explícito: nunca simulamos um job que não foi criado.
 *
 * Para o ProspectaFluxus independente, o agendamento é feito via:
 * - Render Cron Jobs (render.yaml) para produção legada
 * - Endpoint /api/cron/send-reminder protegido por CRON_SECRET
 */

export type HeartbeatJob = {
  name: string;
  cron: string;
  path: string;
  method?: "POST" | "PUT";
  payload?: unknown;
  description?: string;
};

export type HeartbeatJobUpdate = Partial<Omit<HeartbeatJob, "name">> & {
  enable?: boolean;
};

export type HeartbeatJobInfo = {
  taskUid: string;
  name: string;
  userId: string;
  description: string;
  cronExpression: string;
  callbackPath: string;
  callbackMethod: string;
  callbackPayload: string;
  isEnable: boolean;
  createdAt?: string | null;
  lastExecutedAt?: string | null;
  nextExecutionAt?: string | null;
};

const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL ?? "";
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY ?? "";
const SERVICE = "webdevtoken.v1.WebDevService";

function isForgeAvailable(): boolean {
  return !!(FORGE_API_URL && FORGE_API_KEY);
}

function buildEndpoint(rpc: string): string {
  const baseUrl = FORGE_API_URL;
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(`${SERVICE}/${rpc}`, normalizedBase).toString();
}

async function forgeRequest(
  rpc: string,
  body: unknown,
  sessionToken: string
): Promise<unknown> {
  const res = await fetch(buildEndpoint(rpc), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${FORGE_API_KEY}`,
      "x-manus-user-session": sessionToken,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Forge RPC ${rpc} failed: ${res.status} ${text}`);
  }

  return res.json();
}

/**
 * Cria um job de heartbeat no Manus Forge.
 */
export async function createHeartbeatJob(
  job: HeartbeatJob,
  sessionToken: string
): Promise<{ taskUid: string }> {
  if (!isForgeAvailable()) {
    throw new Error("Manus Forge não está configurado para este provider de agendamento.");
  }

  try {
    const data = await forgeRequest(
      "CreateHeartbeatJob",
      {
        name: job.name,
        cronExpression: job.cron,
        callbackPath: job.path,
        callbackMethod: job.method ?? "POST",
        callbackPayload: JSON.stringify(job.payload ?? {}),
        description: job.description ?? "",
      },
      sessionToken
    ) as any;

    return { taskUid: data.taskUid ?? data.task_uid ?? `forge-${job.name}` };
  } catch (err) {
    throw new Error(
      `Falha ao criar job via Manus Forge: ${err instanceof Error ? err.message : "erro desconhecido"}`,
    );
  }
}

/**
 * Atualiza um job de heartbeat existente.
 */
export async function updateHeartbeatJob(
  taskUid: string,
  update: HeartbeatJobUpdate,
  sessionToken: string
): Promise<void> {
  if (!isForgeAvailable()) {
    throw new Error("Manus Forge não está configurado para este provider de agendamento.");
  }

  try {
    await forgeRequest(
      "UpdateHeartbeatJob",
      {
        taskUid,
        ...(update.cron ? { cronExpression: update.cron } : {}),
        ...(update.path ? { callbackPath: update.path } : {}),
        ...(update.method ? { callbackMethod: update.method } : {}),
        ...(update.payload ? { callbackPayload: JSON.stringify(update.payload) } : {}),
        ...(update.description ? { description: update.description } : {}),
        ...(update.enable !== undefined ? { isEnable: update.enable } : {}),
      },
      sessionToken
    );
  } catch (err) {
    throw new Error(
      `Falha ao atualizar job via Manus Forge: ${err instanceof Error ? err.message : "erro desconhecido"}`,
    );
  }
}

/**
 * Deleta um job de heartbeat.
 */
export async function deleteHeartbeatJob(
  taskUid: string,
  sessionToken: string
): Promise<void> {
  if (!isForgeAvailable()) {
    throw new Error("Manus Forge não está configurado para este provider de agendamento.");
  }

  try {
    await forgeRequest("DeleteHeartbeatJob", { taskUid }, sessionToken);
  } catch (err) {
    throw new Error(
      `Falha ao deletar job via Manus Forge: ${err instanceof Error ? err.message : "erro desconhecido"}`,
    );
  }
}

/**
 * Lista todos os jobs de heartbeat.
 */
export async function listHeartbeatJobs(
  sessionToken: string
): Promise<HeartbeatJobInfo[]> {
  if (!isForgeAvailable()) {
    throw new Error("Manus Forge não está configurado para este provider de agendamento.");
  }

  try {
    const data = await forgeRequest("ListHeartbeatJobs", {}, sessionToken) as any;
    return data.jobs ?? data.heartbeatJobs ?? [];
  } catch (err) {
    throw new Error(
      `Falha ao listar jobs via Manus Forge: ${err instanceof Error ? err.message : "erro desconhecido"}`,
    );
  }
}
