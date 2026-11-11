DO $$ BEGIN
  CREATE TYPE "public"."fluxus_complementary_kind" AS ENUM ('pq', 'saboteurs');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."fluxus_complementary_status" AS ENUM ('pending', 'confirmed', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fluxus_complementary_reports" (
  "id" serial PRIMARY KEY NOT NULL,
  "companyId" integer NOT NULL,
  "userId" integer NOT NULL,
  "assessmentId" integer NOT NULL,
  "kind" "fluxus_complementary_kind" NOT NULL,
  "status" "fluxus_complementary_status" NOT NULL DEFAULT 'pending',
  "revision" integer NOT NULL DEFAULT 1,
  "fileHash" varchar(64),
  "fileName" varchar(255),
  "pdfCiphertext" text,
  "sourceName" varchar(255),
  "sourceDate" date,
  "values" jsonb,
  "warnings" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "context" text,
  "recipientSnapshot" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "termsVersion" varchar(80) NOT NULL,
  "consentText" text NOT NULL,
  "consentedAt" timestamptz NOT NULL DEFAULT now(),
  "confirmedAt" timestamptz,
  "revokedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "fluxus_complementary_company_fk"
    FOREIGN KEY ("companyId") REFERENCES "public"."fluxus_companies"("id") ON DELETE RESTRICT,
  CONSTRAINT "fluxus_complementary_user_fk"
    FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT,
  CONSTRAINT "fluxus_complementary_assessment_fk"
    FOREIGN KEY ("assessmentId") REFERENCES "public"."fluxus_assessments"("id") ON DELETE RESTRICT,
  CONSTRAINT "fluxus_complementary_owner_tenant_fk"
    FOREIGN KEY ("companyId", "userId") REFERENCES "public"."users"("companyId", "id") ON DELETE RESTRICT,
  CONSTRAINT "fluxus_complementary_assessment_owner_tenant_fk"
    FOREIGN KEY ("companyId", "userId", "assessmentId")
    REFERENCES "public"."fluxus_assessments"("companyId", "userId", "id") ON DELETE RESTRICT,
  CONSTRAINT "fluxus_complementary_revision_check"
    CHECK ("revision" > 0),
  CONSTRAINT "fluxus_complementary_state_payload_check"
    CHECK (
      (
        "status" = 'pending'
        AND "pdfCiphertext" IS NOT NULL
        AND "fileHash" IS NOT NULL
        AND "fileName" IS NOT NULL
        AND "values" IS NULL
        AND "confirmedAt" IS NULL
        AND "revokedAt" IS NULL
      ) OR (
        "status" = 'confirmed'
        AND "pdfCiphertext" IS NOT NULL
        AND "fileHash" IS NOT NULL
        AND "fileName" IS NOT NULL
        AND "values" IS NOT NULL
        AND "confirmedAt" IS NOT NULL
        AND "revokedAt" IS NULL
      ) OR (
        "status" = 'revoked'
        AND "pdfCiphertext" IS NULL
        AND "fileHash" IS NULL
        AND "fileName" IS NULL
        AND "sourceName" IS NULL
        AND "sourceDate" IS NULL
        AND "values" IS NULL
        AND "warnings" = '[]'::jsonb
        AND "context" IS NULL
        AND "confirmedAt" IS NULL
        AND "revokedAt" IS NOT NULL
      )
    )
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fluxus_complementary_owner_created_idx"
  ON "fluxus_complementary_reports" USING btree ("userId", "createdAt", "id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fluxus_complementary_company_status_idx"
  ON "fluxus_complementary_reports" USING btree ("companyId", "status", "createdAt", "id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fluxus_complementary_owner_hash_active_idx"
  ON "fluxus_complementary_reports" USING btree ("userId", "fileHash")
  WHERE "fileHash" IS NOT NULL AND "status" <> 'revoked';
--> statement-breakpoint
ALTER TABLE "fluxus_complementary_reports" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE "fluxus_complementary_reports" FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON SEQUENCE "fluxus_complementary_reports_id_seq" FROM PUBLIC;
--> statement-breakpoint
DO $$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'appDB'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON TABLE "fluxus_complementary_reports" FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON SEQUENCE "fluxus_complementary_reports_id_seq" FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
