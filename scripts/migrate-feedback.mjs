import postgres from "postgres";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const args = new Set(process.argv.slice(2));
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL não configurada.");
const target = new URL(databaseUrl);
const local = ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname);
const hostArg = process.argv
  .find(arg => arg.startsWith("--confirm-host="))
  ?.slice("--confirm-host=".length);
if (local) {
  if (
    !args.has("--local-test") ||
    !target.pathname.startsWith("/persona_phase2_test")
  ) {
    throw new Error(
      "Para teste local use --local-test e um banco persona_phase2_test descartável."
    );
  }
} else if (!args.has("--backup-confirmed") || hostArg !== target.hostname) {
  throw new Error(
    "Migração remota exige backup confirmado e --confirm-host igual ao host da conexão. Não execute sem revisão do destino."
  );
}
const names = [
  "0011_fluxus_feedback_eec",
  "0012_fluxus_feedback_revision_metadata",
];
const migrations = await Promise.all(
  names.map(async name => {
    const text = await readFile(
      new URL(`../drizzle/${name}.sql`, import.meta.url),
      "utf8"
    );
    return {
      name,
      text,
      checksum: createHash("sha256").update(text).digest("hex"),
    };
  })
);
const client = postgres(databaseUrl, {
  ssl: local ? false : { rejectUnauthorized: true },
  max: 1,
  prepare: false,
  onnotice: () => {},
});
try {
  await client.begin(async tx => {
    await tx`SELECT pg_advisory_xact_lock(2026100602)`;
    await tx`CREATE TABLE IF NOT EXISTS fluxus_feedback_schema_migrations (name varchar(100) PRIMARY KEY, checksum varchar(64) NOT NULL, "appliedAt" timestamptz NOT NULL DEFAULT now())`;
    for (const migration of migrations) {
      const [previous] =
        await tx`SELECT name, checksum FROM fluxus_feedback_schema_migrations WHERE name = ${migration.name} LIMIT 1`;
      if (previous) {
        if (previous.checksum !== migration.checksum)
          throw new Error(
            "Checksum diferente da migração aplicada. Crie outra migração; não altere o histórico."
          );
        console.log(
          `${migration.name}: já aplicada; nenhuma alteração necessária.`
        );
        continue;
      }
      await tx.unsafe(migration.text);
      await tx`INSERT INTO fluxus_feedback_schema_migrations (name, checksum) VALUES (${migration.name}, ${migration.checksum})`;
      console.log(
        `${migration.name}: aplicada. Nenhum papel ou acesso individual foi concedido.`
      );
    }
  });
} finally {
  await client.end({ timeout: 5 });
}
