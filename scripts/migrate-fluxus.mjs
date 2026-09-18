import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("[Fluxus Migration] DATABASE_URL não definida.");
  process.exit(1);
}

const sql = postgres(connectionString, {
  ssl: { rejectUnauthorized: false },
  max: 1,
  connect_timeout: 15,
});

try {
  await sql.begin(async tx => {
    await tx.unsafe(`
      DO $$ BEGIN
        CREATE TYPE "public"."account_type" AS ENUM ('prospecting', 'fluxus');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;

      DO $$ BEGIN
        CREATE TYPE "public"."fluxus_assessment_status" AS ENUM ('draft', 'completed');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;

      CREATE TABLE IF NOT EXISTS "fluxus_companies" (
        "id" serial PRIMARY KEY NOT NULL,
        "name" varchar(255) NOT NULL,
        "normalizedName" varchar(255) NOT NULL,
        "accessCodeHash" varchar(255) NOT NULL,
        "accessCodeHint" varchar(12),
        "active" integer DEFAULT 1 NOT NULL,
        "createdBy" integer,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      );

      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "accountType" "account_type" DEFAULT 'prospecting' NOT NULL;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "companyId" integer;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "jobTitle" varchar(180);
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "department" varchar(180);

      CREATE TABLE IF NOT EXISTS "fluxus_assessments" (
        "id" serial PRIMARY KEY NOT NULL,
        "userId" integer NOT NULL,
        "companyId" integer NOT NULL,
        "status" "fluxus_assessment_status" DEFAULT 'draft' NOT NULL,
        "instrumentVersion" varchar(40) NOT NULL,
        "formulaVersion" varchar(40) NOT NULL,
        "answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "result" jsonb,
        "startedAt" timestamp DEFAULT now() NOT NULL,
        "completedAt" timestamp,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "fluxus_companies_normalized_name_idx"
        ON "fluxus_companies" USING btree ("normalizedName");
      CREATE INDEX IF NOT EXISTS "fluxus_assessments_user_idx"
        ON "fluxus_assessments" USING btree ("userId", "createdAt");
      CREATE INDEX IF NOT EXISTS "fluxus_assessments_company_idx"
        ON "fluxus_assessments" USING btree ("companyId", "status", "createdAt");

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fluxus_assessments_userId_users_id_fk') THEN
          ALTER TABLE "fluxus_assessments"
            ADD CONSTRAINT "fluxus_assessments_userId_users_id_fk"
            FOREIGN KEY ("userId") REFERENCES "public"."users"("id")
            ON DELETE restrict ON UPDATE no action;
        END IF;
      END $$;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fluxus_assessments_companyId_fluxus_companies_id_fk') THEN
          ALTER TABLE "fluxus_assessments"
            ADD CONSTRAINT "fluxus_assessments_companyId_fluxus_companies_id_fk"
            FOREIGN KEY ("companyId") REFERENCES "public"."fluxus_companies"("id")
            ON DELETE restrict ON UPDATE no action;
        END IF;
      END $$;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_companyId_fluxus_companies_id_fk') THEN
          ALTER TABLE "users"
            ADD CONSTRAINT "users_companyId_fluxus_companies_id_fk"
            FOREIGN KEY ("companyId") REFERENCES "public"."fluxus_companies"("id")
            ON DELETE restrict ON UPDATE no action;
        END IF;
      END $$;
    `);
  });
  console.log("[Fluxus Migration] Estrutura verificada com sucesso.");
} catch (error) {
  console.error("[Fluxus Migration] Falha; nenhuma alteração parcial foi mantida.", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
