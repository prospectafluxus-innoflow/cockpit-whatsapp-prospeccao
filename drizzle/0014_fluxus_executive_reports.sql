-- Relatórios executivos guardam somente referências imutáveis às avaliações e notas consultivas.
CREATE TABLE IF NOT EXISTS "fluxus_executive_reports" (
  "id" serial PRIMARY KEY,
  "companyId" integer NOT NULL REFERENCES "fluxus_companies"("id") ON DELETE RESTRICT,
  "createdBy" integer NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "mode" varchar(16) NOT NULL,
  "assessmentIds" integer[] NOT NULL,
  "notes" jsonb NOT NULL,
  "revision" integer NOT NULL DEFAULT 1,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "fluxus_executive_reports_mode_check"
    CHECK ("mode" IN ('individual', 'team')),
  CONSTRAINT "fluxus_executive_reports_revision_check"
    CHECK ("revision" > 0),
  CONSTRAINT "fluxus_executive_reports_assessment_ids_check"
    CHECK (cardinality("assessmentIds") BETWEEN 1 AND 200),
  CONSTRAINT "fluxus_executive_reports_individual_size_check"
    CHECK ("mode" <> 'individual' OR cardinality("assessmentIds") = 1)
);
CREATE INDEX IF NOT EXISTS "fluxus_executive_reports_company_updated_idx"
  ON "fluxus_executive_reports" ("companyId", "updatedAt");
ALTER TABLE "fluxus_executive_reports" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "fluxus_executive_reports" FROM PUBLIC;
REVOKE ALL ON SEQUENCE "fluxus_executive_reports_id_seq" FROM PUBLIC;
DO $$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON TABLE "fluxus_executive_reports" FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON SEQUENCE "fluxus_executive_reports_id_seq" FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
