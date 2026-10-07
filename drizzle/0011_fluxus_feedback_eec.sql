-- Fase 2: migração explícita e aditiva. Não atribui papéis, copia resultados ou altera cálculos Persona.
-- Executar somente após backup e validação do destino. O runner aplica tudo em uma transação.
CREATE UNIQUE INDEX IF NOT EXISTS "feedback_users_company_id_key" ON "users" ("companyId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "feedback_persona_company_user_id_key" ON "fluxus_assessments" ("companyId", "userId", "id");

CREATE TABLE IF NOT EXISTS "fluxus_feedback_memberships" (
  "id" serial PRIMARY KEY, "companyId" integer NOT NULL REFERENCES "fluxus_companies"("id"),
  "userId" integer NOT NULL REFERENCES "users"("id"), "role" varchar(24) NOT NULL,
  "canReadFeedback" boolean NOT NULL DEFAULT false,
  "startsAt" timestamptz NOT NULL DEFAULT now(), "endsAt" timestamptz,
  "createdBy" integer NOT NULL REFERENCES "users"("id"),
  CONSTRAINT "feedback_membership_role" CHECK ("role" IN ('collaborator','manager','supermanager','hr','company_admin')),
  CONSTRAINT "feedback_membership_period" CHECK ("endsAt" IS NULL OR "endsAt" > "startsAt"),
  FOREIGN KEY ("companyId","userId") REFERENCES "users"("companyId","id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "feedback_memberships_current_idx" ON "fluxus_feedback_memberships" ("companyId","userId") WHERE "endsAt" IS NULL;

CREATE TABLE IF NOT EXISTS "fluxus_feedback_departments" (
  "id" serial PRIMARY KEY, "companyId" integer NOT NULL REFERENCES "fluxus_companies"("id"),
  "parentId" integer REFERENCES "fluxus_feedback_departments"("id"), "name" varchar(180) NOT NULL,
  "active" boolean NOT NULL DEFAULT true, "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "feedback_department_not_self" CHECK ("parentId" IS NULL OR "parentId" <> "id"),
  UNIQUE ("companyId","id"),
  FOREIGN KEY ("companyId","parentId") REFERENCES "fluxus_feedback_departments"("companyId","id")
);
CREATE INDEX IF NOT EXISTS "feedback_departments_company_idx" ON "fluxus_feedback_departments" ("companyId");

CREATE TABLE IF NOT EXISTS "fluxus_feedback_assignments" (
  "id" serial PRIMARY KEY, "companyId" integer NOT NULL REFERENCES "fluxus_companies"("id"),
  "userId" integer NOT NULL REFERENCES "users"("id"),
  "departmentId" integer REFERENCES "fluxus_feedback_departments"("id"),
  "managerUserId" integer REFERENCES "users"("id"), "jobTitle" varchar(180),
  "startsAt" timestamptz NOT NULL DEFAULT now(), "endsAt" timestamptz,
  "createdBy" integer NOT NULL REFERENCES "users"("id"),
  UNIQUE ("companyId","id"),
  CONSTRAINT "feedback_assignment_period" CHECK ("endsAt" IS NULL OR "endsAt" > "startsAt"),
  CONSTRAINT "feedback_assignment_not_self" CHECK ("managerUserId" IS NULL OR "managerUserId" <> "userId"),
  FOREIGN KEY ("companyId","userId") REFERENCES "users"("companyId","id"),
  FOREIGN KEY ("companyId","managerUserId") REFERENCES "users"("companyId","id"),
  FOREIGN KEY ("companyId","departmentId") REFERENCES "fluxus_feedback_departments"("companyId","id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "feedback_assignments_current_idx" ON "fluxus_feedback_assignments" ("companyId","userId") WHERE "endsAt" IS NULL;

CREATE TABLE IF NOT EXISTS "fluxus_feedback_management_scopes" (
  "id" serial PRIMARY KEY, "companyId" integer NOT NULL REFERENCES "fluxus_companies"("id"),
  "userId" integer NOT NULL REFERENCES "users"("id"),
  "departmentId" integer NOT NULL REFERENCES "fluxus_feedback_departments"("id"),
  "includeDescendants" boolean NOT NULL DEFAULT true, "startsAt" timestamptz NOT NULL DEFAULT now(), "endsAt" timestamptz,
  "createdBy" integer NOT NULL REFERENCES "users"("id"),
  CONSTRAINT "feedback_scope_period" CHECK ("endsAt" IS NULL OR "endsAt" > "startsAt"),
  FOREIGN KEY ("companyId","userId") REFERENCES "users"("companyId","id"),
  FOREIGN KEY ("companyId","departmentId") REFERENCES "fluxus_feedback_departments"("companyId","id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "feedback_scopes_current_idx" ON "fluxus_feedback_management_scopes" ("companyId","userId","departmentId") WHERE "endsAt" IS NULL;

CREATE TABLE IF NOT EXISTS "fluxus_feedback_settings" (
  "companyId" integer PRIMARY KEY REFERENCES "fluxus_companies"("id"), "competencyIds" jsonb NOT NULL,
  "version" integer NOT NULL DEFAULT 1 CHECK ("version" > 0),
  "updatedBy" integer NOT NULL REFERENCES "users"("id"), "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof("competencyIds") = 'array' AND jsonb_array_length("competencyIds") BETWEEN 1 AND 10)
);
CREATE TABLE IF NOT EXISTS "fluxus_development_cycles" (
  "id" serial PRIMARY KEY, "companyId" integer NOT NULL REFERENCES "fluxus_companies"("id"),
  "name" varchar(120) NOT NULL, "year" integer NOT NULL,
  "startsOn" date NOT NULL, "endsOn" date NOT NULL, "status" varchar(16) NOT NULL DEFAULT 'planned',
  "templateVersion" integer NOT NULL CHECK ("templateVersion" > 0), "methodVersion" varchar(40) NOT NULL,
  "competencySnapshot" jsonb NOT NULL,
  "createdBy" integer NOT NULL REFERENCES "users"("id"), "createdAt" timestamptz NOT NULL DEFAULT now(),
  "activatedAt" timestamptz, "closedAt" timestamptz,
  UNIQUE ("companyId","id"),
  CONSTRAINT "development_cycle_dates" CHECK ("endsOn" >= "startsOn"),
  CONSTRAINT "development_cycle_status" CHECK ("status" IN ('planned','active','closed','cancelled')),
  CHECK ("year" = EXTRACT(YEAR FROM "startsOn")),
  CHECK (jsonb_typeof("competencySnapshot") = 'array' AND jsonb_array_length("competencySnapshot") BETWEEN 1 AND 10)
);
CREATE INDEX IF NOT EXISTS "development_cycles_company_year_idx" ON "fluxus_development_cycles" ("companyId","year");
CREATE UNIQUE INDEX IF NOT EXISTS "development_cycles_company_name_idx" ON "fluxus_development_cycles" ("companyId","year","name");

CREATE TABLE IF NOT EXISTS "fluxus_feedback_evaluations" (
  "id" serial PRIMARY KEY, "companyId" integer NOT NULL REFERENCES "fluxus_companies"("id"),
  "cycleId" integer NOT NULL REFERENCES "fluxus_development_cycles"("id"),
  "participantUserId" integer NOT NULL REFERENCES "users"("id"), "evaluatorUserId" integer NOT NULL REFERENCES "users"("id"),
  "personaAssessmentId" integer NOT NULL REFERENCES "fluxus_assessments"("id"),
  "assignmentId" integer NOT NULL REFERENCES "fluxus_feedback_assignments"("id"),
  "departmentId" integer REFERENCES "fluxus_feedback_departments"("id"),
  "status" varchar(20) NOT NULL DEFAULT 'draft', "items" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "revision" integer NOT NULL DEFAULT 0 CHECK ("revision" >= 0),
  "completedAt" timestamptz, "debriefedAt" timestamptz, "releasedAt" timestamptz, "firstViewedAt" timestamptz,
  "acknowledgedAt" timestamptz, "closedAt" timestamptz,
  "participantComment" text, "commentedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("companyId","id"),
  CONSTRAINT "feedback_evaluation_status" CHECK ("status" IN ('draft','completed','debriefed','released','acknowledged','closed')),
  CONSTRAINT "feedback_evaluator_not_self" CHECK ("participantUserId" <> "evaluatorUserId"),
  CHECK (jsonb_typeof("items") = 'array' AND jsonb_array_length("items") <= 10),
  FOREIGN KEY ("companyId","cycleId") REFERENCES "fluxus_development_cycles"("companyId","id"),
  FOREIGN KEY ("companyId","participantUserId") REFERENCES "users"("companyId","id"),
  FOREIGN KEY ("companyId","evaluatorUserId") REFERENCES "users"("companyId","id"),
  FOREIGN KEY ("companyId","participantUserId","personaAssessmentId") REFERENCES "fluxus_assessments"("companyId","userId","id"),
  FOREIGN KEY ("companyId","assignmentId") REFERENCES "fluxus_feedback_assignments"("companyId","id"),
  FOREIGN KEY ("companyId","departmentId") REFERENCES "fluxus_feedback_departments"("companyId","id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "feedback_evaluations_participant_cycle_idx" ON "fluxus_feedback_evaluations" ("cycleId","participantUserId");
CREATE INDEX IF NOT EXISTS "feedback_evaluations_company_idx" ON "fluxus_feedback_evaluations" ("companyId","cycleId");
CREATE TABLE IF NOT EXISTS "fluxus_feedback_revisions" (
  "id" serial PRIMARY KEY, "feedbackId" integer NOT NULL REFERENCES "fluxus_feedback_evaluations"("id"),
  "companyId" integer NOT NULL REFERENCES "fluxus_companies"("id"),
  "previousRevision" integer NOT NULL, "previousItems" jsonb NOT NULL, "previousStatus" varchar(20) NOT NULL,
  "reason" text NOT NULL CHECK (length(trim("reason")) > 0), "actorUserId" integer NOT NULL REFERENCES "users"("id"),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY ("companyId","feedbackId") REFERENCES "fluxus_feedback_evaluations"("companyId","id")
);
CREATE INDEX IF NOT EXISTS "feedback_revisions_feedback_idx" ON "fluxus_feedback_revisions" ("companyId","feedbackId");

-- A aplicação usa sessão de servidor privilegiada e autorização tRPC; acesso REST direto não é concedido.
DO $$
DECLARE table_name text; role_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['fluxus_feedback_memberships','fluxus_feedback_departments','fluxus_feedback_assignments','fluxus_feedback_management_scopes','fluxus_feedback_settings','fluxus_development_cycles','fluxus_feedback_evaluations','fluxus_feedback_revisions'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC', table_name);
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
        EXECUTE format('REVOKE ALL ON TABLE %I FROM %I', table_name, role_name);
      END IF;
    END LOOP;
  END LOOP;
END $$;
