import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
assert(databaseUrl, "DATABASE_URL local não configurada.");
const target = new URL(databaseUrl);
assert(
  ["127.0.0.1", "localhost"].includes(target.hostname) &&
    target.pathname.startsWith("/persona_phase2_test"),
  "Este comando só prepara um banco PostgreSQL local descartável persona_phase2_test. Nunca use produção."
);
const client = postgres(databaseUrl, {
  ssl: false,
  max: 1,
  prepare: false,
  onnotice: () => {},
});
try {
  const exists =
    await client`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='users' LIMIT 1`;
  if (!exists.length) {
    const initial = await readFile(
      new URL("../drizzle/0000_spicy_imperial_guard.sql", import.meta.url),
      "utf8"
    );
    await client.begin(async tx => {
      await tx.unsafe(initial);
      await tx.unsafe(`CREATE TYPE approval_status AS ENUM ('pending','approved','rejected');
        ALTER TABLE users ADD COLUMN "approvalStatus" approval_status NOT NULL DEFAULT 'pending';
        ALTER TABLE users ADD COLUMN "whatsappOwn" varchar(30);`);
    });
  }
} finally {
  await client.end({ timeout: 5 });
}
for (const [script, args] of [
  ["migrate-fluxus.mjs", []],
  ["migrate-feedback.mjs", ["--local-test"]],
]) {
  const file = new URL(script, import.meta.url);
  const result = spawnSync(process.execPath, [file.pathname, ...args], {
    env: process.env,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(
  "Base descartável preparada. A migração existente Fluxus requer um PostgreSQL local com SSL disponível, como o padrão Ubuntu usado na validação."
);
