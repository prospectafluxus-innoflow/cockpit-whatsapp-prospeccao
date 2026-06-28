/**
 * migrate.mjs — Script de migração do banco de dados
 *
 * Cria as tabelas no Supabase PostgreSQL a partir do schema Drizzle.
 * Execute antes do primeiro deploy:
 *
 *   DATABASE_URL="postgresql://postgres:SENHA@db.xxx.supabase.co:5432/postgres" node scripts/migrate.mjs
 *
 * Ou defina DATABASE_URL no .env e execute:
 *   node scripts/migrate.mjs
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL não definida. Defina a variável de ambiente.");
  process.exit(1);
}

console.log("🔌 Conectando ao banco de dados...");

const client = postgres(DATABASE_URL, {
  ssl: { rejectUnauthorized: false },
  max: 1,
});

const db = drizzle(client);

// SQL de criação das tabelas
const SQL = `
-- Enums
DO $$ BEGIN
  CREATE TYPE "role" AS ENUM ('user', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "layer" AS ENUM ('A', 'B', 'C');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "status" AS ENUM (
    'novo', 'toque1_enviado', 'toque2_enviado', 'toque3_enviado',
    'respondeu', 'fechado', 'descartado'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "kanban_column" AS ENUM (
    'Novo', 'Toque 1 Enviado', 'Toque 2 Enviado', 'Toque 3 Enviado',
    'Respondeu', 'Fechado'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS "users" (
  "id" SERIAL PRIMARY KEY,
  "openId" VARCHAR(64) UNIQUE,
  "name" TEXT,
  "email" VARCHAR(320) UNIQUE,
  "loginMethod" VARCHAR(64),
  "role" "role" NOT NULL DEFAULT 'user',
  "passwordHash" VARCHAR(255),
  "resetToken" VARCHAR(128),
  "resetTokenExpiresAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "lastSignedIn" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tabela de leads
CREATE TABLE IF NOT EXISTS "leads" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "firstName" VARCHAR(100),
  "company" VARCHAR(255),
  "whatsapp" VARCHAR(30) NOT NULL,
  "score" INTEGER DEFAULT 0,
  "layer" "layer" NOT NULL DEFAULT 'B',
  "size" VARCHAR(100),
  "employees" INTEGER,
  "investment" VARCHAR(100),
  "taxRegime" VARCHAR(100),
  "participations" INTEGER,
  "lastEvent" VARCHAR(100),
  "status" "status" NOT NULL DEFAULT 'novo',
  "kanbanColumn" "kanban_column" NOT NULL DEFAULT 'Novo',
  "toque1SentAt" TIMESTAMP,
  "toque2SentAt" TIMESTAMP,
  "toque3SentAt" TIMESTAMP,
  "respondedAt" TIMESTAMP,
  "notes" TEXT,
  "lastAiSuggestion" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tabela de envios diários
CREATE TABLE IF NOT EXISTS "daily_sends" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "leadId" INTEGER NOT NULL,
  "touchNumber" INTEGER NOT NULL,
  "sentDate" DATE NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tabela de configuração de agendamento
CREATE TABLE IF NOT EXISTS "send_schedules" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL UNIQUE,
  "morningEnabled" INTEGER NOT NULL DEFAULT 1,
  "morningHour" INTEGER NOT NULL DEFAULT 8,
  "morningCount" INTEGER NOT NULL DEFAULT 2,
  "lunchEnabled" INTEGER NOT NULL DEFAULT 1,
  "lunchHour" INTEGER NOT NULL DEFAULT 12,
  "lunchCount" INTEGER NOT NULL DEFAULT 2,
  "eveningEnabled" INTEGER NOT NULL DEFAULT 1,
  "eveningHour" INTEGER NOT NULL DEFAULT 17,
  "eveningCount" INTEGER NOT NULL DEFAULT 2,
  "morningTaskUid" VARCHAR(65),
  "lunchTaskUid" VARCHAR(65),
  "eveningTaskUid" VARCHAR(65),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS "leads_userId_idx" ON "leads" ("userId");
CREATE INDEX IF NOT EXISTS "leads_status_idx" ON "leads" ("status");
CREATE INDEX IF NOT EXISTS "daily_sends_userId_date_idx" ON "daily_sends" ("userId", "sentDate");
`;

async function migrate() {
  try {
    console.log("📦 Criando tabelas...");
    await client.unsafe(SQL);
    console.log("✅ Migração concluída com sucesso!");
    console.log("\n📋 Tabelas criadas:");
    console.log("   - users");
    console.log("   - leads");
    console.log("   - daily_sends");
    console.log("   - send_schedules");
    console.log("\n🎉 Banco de dados pronto para uso!");
  } catch (err) {
    console.error("❌ Erro na migração:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
