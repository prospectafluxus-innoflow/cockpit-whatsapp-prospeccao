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

      DO $$ BEGIN
        CREATE TYPE "public"."fluxus_access_role" AS ENUM ('collaborator', 'manager', 'hr');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;

      DO $$ BEGIN
        CREATE TYPE "public"."fluxus_privacy_request_type" AS ENUM ('access', 'correction', 'deletion', 'revocation');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;

      DO $$ BEGIN
        CREATE TYPE "public"."fluxus_privacy_request_status" AS ENUM ('submitted', 'in_review', 'completed', 'rejected');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;

      DO $$ BEGIN
        CREATE TYPE "public"."fluxus_debrief_status" AS ENUM ('not_started', 'in_progress', 'completed');
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

      ALTER TABLE "fluxus_companies" ADD COLUMN IF NOT EXISTS "reportVisibility" varchar(24) DEFAULT 'participant_only' NOT NULL;
      ALTER TABLE "fluxus_companies" ALTER COLUMN "reportVisibility" SET DEFAULT 'participant_only';
      ALTER TABLE "fluxus_companies" ADD COLUMN IF NOT EXISTS "beta2OrganizationAccessApprovedAt" timestamp;
      ALTER TABLE "fluxus_companies" ADD COLUMN IF NOT EXISTS "beta2OrganizationAccessPurpose" text;
      ALTER TABLE "fluxus_companies" ADD COLUMN IF NOT EXISTS "minimumAggregateSize" integer DEFAULT 5 NOT NULL;
      UPDATE "fluxus_companies" SET "minimumAggregateSize" = 5 WHERE "minimumAggregateSize" < 5;
      ALTER TABLE "fluxus_companies" ADD COLUMN IF NOT EXISTS "retentionMonths" integer DEFAULT 60 NOT NULL;
      ALTER TABLE "fluxus_companies" ADD COLUMN IF NOT EXISTS "processingPurpose" text DEFAULT 'Autoconhecimento, devolutiva e desenvolvimento profissional, sem decisão automatizada.' NOT NULL;

      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "accountType" "account_type" DEFAULT 'prospecting' NOT NULL;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "fluxusRole" "fluxus_access_role" DEFAULT 'collaborator' NOT NULL;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "companyId" integer;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "jobTitle" varchar(180);
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "department" varchar(180);
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "privacyDeletedAt" timestamp;

      CREATE TABLE IF NOT EXISTS "fluxus_assessments" (
        "id" serial PRIMARY KEY NOT NULL,
        "userId" integer NOT NULL,
        "companyId" integer NOT NULL,
        "status" "fluxus_assessment_status" DEFAULT 'draft' NOT NULL,
        "cycleNumber" integer DEFAULT 1 NOT NULL,
        "cycleLabel" varchar(120),
        "prefilledFromAssessmentId" integer,
        "revision" integer DEFAULT 0 NOT NULL,
        "instrumentVersion" varchar(40) NOT NULL,
        "formulaVersion" varchar(40) NOT NULL,
        "answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "result" jsonb,
        "startedAt" timestamp DEFAULT now() NOT NULL,
        "completedAt" timestamp,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      );

      ALTER TABLE "fluxus_assessments" ADD COLUMN IF NOT EXISTS "cycleNumber" integer DEFAULT 1 NOT NULL;
      ALTER TABLE "fluxus_assessments" ADD COLUMN IF NOT EXISTS "cycleLabel" varchar(120);
      ALTER TABLE "fluxus_assessments" ADD COLUMN IF NOT EXISTS "prefilledFromAssessmentId" integer;
      ALTER TABLE "fluxus_assessments" ADD COLUMN IF NOT EXISTS "revision" integer DEFAULT 0 NOT NULL;

      CREATE TABLE IF NOT EXISTS "fluxus_migration_markers" (
        "name" varchar(120) PRIMARY KEY NOT NULL,
        "appliedAt" timestamp DEFAULT now() NOT NULL
      );

      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM "fluxus_migration_markers"
          WHERE "name" = '2026-09-cycle-number-backfill-v1'
        ) THEN
          WITH numbered AS (
            SELECT "id", row_number() OVER (PARTITION BY "userId", "companyId" ORDER BY "createdAt", "id") AS cycle
            FROM "fluxus_assessments"
          )
          UPDATE "fluxus_assessments" AS assessment
          SET "cycleNumber" = numbered.cycle
          FROM numbered
          WHERE assessment."id" = numbered."id";

          INSERT INTO "fluxus_migration_markers" ("name")
          VALUES ('2026-09-cycle-number-backfill-v1');
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS "fluxus_consents" (
        "id" serial PRIMARY KEY NOT NULL,
        "userId" integer NOT NULL,
        "companyId" integer NOT NULL,
        "noticeVersion" varchar(40) NOT NULL,
        "purpose" text NOT NULL,
        "acceptedAt" timestamp DEFAULT now() NOT NULL,
        "revokedAt" timestamp,
        "source" varchar(40) DEFAULT 'registration' NOT NULL,
        "ipHash" varchar(64),
        "userAgent" text
      );

      CREATE TABLE IF NOT EXISTS "fluxus_privacy_requests" (
        "id" serial PRIMARY KEY NOT NULL,
        "userId" integer NOT NULL,
        "companyId" integer NOT NULL,
        "type" "fluxus_privacy_request_type" NOT NULL,
        "status" "fluxus_privacy_request_status" DEFAULT 'submitted' NOT NULL,
        "details" text,
        "resolutionNote" text,
        "resolvedBy" integer,
        "resolvedAt" timestamp,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "fluxus_audit_logs" (
        "id" serial PRIMARY KEY NOT NULL,
        "actorUserId" integer,
        "subjectUserId" integer,
        "companyId" integer,
        "assessmentId" integer,
        "action" varchar(80) NOT NULL,
        "resourceType" varchar(60) NOT NULL,
        "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "ipHash" varchar(64),
        "createdAt" timestamp DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "fluxus_debriefs" (
        "id" serial PRIMARY KEY NOT NULL,
        "assessmentId" integer NOT NULL,
        "participantUserId" integer NOT NULL,
        "facilitatorUserId" integer NOT NULL,
        "status" "fluxus_debrief_status" DEFAULT 'not_started' NOT NULL,
        "evidenceExamples" text,
        "hypothesesTested" text,
        "agreedActions" text,
        "managerSupport" text,
        "followUpDate" date,
        "participantNotes" text,
        "startedAt" timestamp,
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
      DROP INDEX IF EXISTS "fluxus_assessments_user_cycle_idx";
      CREATE UNIQUE INDEX IF NOT EXISTS "fluxus_assessments_user_company_cycle_idx"
        ON "fluxus_assessments" USING btree ("userId", "companyId", "cycleNumber");
      CREATE INDEX IF NOT EXISTS "fluxus_consents_user_idx" ON "fluxus_consents" USING btree ("userId", "acceptedAt");
      CREATE INDEX IF NOT EXISTS "fluxus_privacy_requests_user_idx" ON "fluxus_privacy_requests" USING btree ("userId", "createdAt");
      CREATE INDEX IF NOT EXISTS "fluxus_privacy_requests_company_idx" ON "fluxus_privacy_requests" USING btree ("companyId", "status", "createdAt");
      CREATE INDEX IF NOT EXISTS "fluxus_audit_company_idx" ON "fluxus_audit_logs" USING btree ("companyId", "createdAt");
      CREATE INDEX IF NOT EXISTS "fluxus_audit_subject_idx" ON "fluxus_audit_logs" USING btree ("subjectUserId", "createdAt");
      CREATE UNIQUE INDEX IF NOT EXISTS "fluxus_debriefs_assessment_idx" ON "fluxus_debriefs" USING btree ("assessmentId");
      CREATE INDEX IF NOT EXISTS "fluxus_debriefs_company_user_idx" ON "fluxus_debriefs" USING btree ("participantUserId", "updatedAt");

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

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fluxus_consents_userId_users_id_fk') THEN
          ALTER TABLE "fluxus_consents" ADD CONSTRAINT "fluxus_consents_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fluxus_consents_companyId_fluxus_companies_id_fk') THEN
          ALTER TABLE "fluxus_consents" ADD CONSTRAINT "fluxus_consents_companyId_fluxus_companies_id_fk" FOREIGN KEY ("companyId") REFERENCES "public"."fluxus_companies"("id") ON DELETE restrict ON UPDATE no action;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fluxus_privacy_requests_userId_users_id_fk') THEN
          ALTER TABLE "fluxus_privacy_requests" ADD CONSTRAINT "fluxus_privacy_requests_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fluxus_privacy_requests_companyId_fluxus_companies_id_fk') THEN
          ALTER TABLE "fluxus_privacy_requests" ADD CONSTRAINT "fluxus_privacy_requests_companyId_fluxus_companies_id_fk" FOREIGN KEY ("companyId") REFERENCES "public"."fluxus_companies"("id") ON DELETE restrict ON UPDATE no action;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fluxus_debriefs_assessmentId_fluxus_assessments_id_fk') THEN
          ALTER TABLE "fluxus_debriefs" ADD CONSTRAINT "fluxus_debriefs_assessmentId_fluxus_assessments_id_fk" FOREIGN KEY ("assessmentId") REFERENCES "public"."fluxus_assessments"("id") ON DELETE restrict ON UPDATE no action;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fluxus_debriefs_participantUserId_users_id_fk') THEN
          ALTER TABLE "fluxus_debriefs" ADD CONSTRAINT "fluxus_debriefs_participantUserId_users_id_fk" FOREIGN KEY ("participantUserId") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fluxus_debriefs_facilitatorUserId_users_id_fk') THEN
          ALTER TABLE "fluxus_debriefs" ADD CONSTRAINT "fluxus_debriefs_facilitatorUserId_users_id_fk" FOREIGN KEY ("facilitatorUserId") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
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
