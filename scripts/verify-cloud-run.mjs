#!/usr/bin/env node

const DEFAULT_BASE_URL =
  "https://prospectafluxus-664809259352.us-west1.run.app";
const baseInput =
  process.env.CLOUD_RUN_URL ?? process.argv[2] ?? DEFAULT_BASE_URL;

function normalizeBaseUrl(raw) {
  const url = new URL(raw);
  if (url.protocol !== "https:") {
    throw new Error("CLOUD_RUN_URL must use HTTPS");
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url;
}

let baseUrl;
try {
  baseUrl = normalizeBaseUrl(baseInput);
} catch {
  console.error("smoke base URL is invalid");
  process.exitCode = 1;
}

if (!baseUrl) {
  process.exit(1);
}

const feedbackWorkspaceInput = encodeURIComponent(JSON.stringify({ json: {} }));
const checks = [
  { name: "root", path: "/", statuses: new Set([200]) },
  { name: "health", path: "/api/health", statuses: new Set([200]) },
  { name: "fluxus-login", path: "/fluxus/login", statuses: new Set([200]) },
  {
    name: "feedback-cycle-page",
    path: "/fluxus/feedback/ciclo/1",
    statuses: new Set([200]),
  },
  {
    name: "feedback-workspace-noauth",
    path: `/api/trpc/feedback.workspace?input=${feedbackWorkspaceInput}`,
    statuses: new Set([401, 403]),
  },
];

async function checkRoute(check) {
  let response;
  try {
    response = await fetch(new URL(check.path, baseUrl), {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    console.error(`smoke ${check.name}: request failed`);
    return false;
  }

  const passed = check.statuses.has(response.status);
  console.log(`smoke ${check.name}: ${response.status}`);
  if (!passed) {
    console.error(`smoke ${check.name}: unexpected status`);
  }
  return passed;
}

const results = await Promise.all(checks.map(checkRoute));
if (results.some(result => !result)) {
  process.exitCode = 1;
}
