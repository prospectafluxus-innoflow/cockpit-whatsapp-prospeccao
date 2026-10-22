-- Ledger server-only para claims atômicos de lembretes Cloud Scheduler.
CREATE TABLE IF NOT EXISTS "reminder_dispatch_ledger" (
  "id" serial PRIMARY KEY,
  "userId" integer NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "localDate" date NOT NULL,
  "window" varchar(16) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'claimed',
  "claimedAt" timestamptz NOT NULL DEFAULT now(),
  "sentAt" timestamptz,
  "failedAt" timestamptz,
  "errorCode" varchar(64),
  "errorMessage" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "reminder_dispatch_ledger_window_check"
    CHECK ("window" IN ('morning', 'lunch', 'afternoon', 'evening')),
  CONSTRAINT "reminder_dispatch_ledger_status_check"
    CHECK ("status" IN ('claimed', 'sent', 'failed', 'not-delivered'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "reminder_dispatch_ledger_user_date_window_idx"
  ON "reminder_dispatch_ledger" ("userId", "localDate", "window");

ALTER TABLE "reminder_dispatch_ledger" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "reminder_dispatch_ledger" FROM PUBLIC;
REVOKE ALL ON SEQUENCE "reminder_dispatch_ledger_id_seq" FROM PUBLIC;

DO $$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON TABLE "reminder_dispatch_ledger" FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON SEQUENCE "reminder_dispatch_ledger_id_seq" FROM %I', role_name);
    END IF;
  END LOOP;

  -- appDB is the optional named application role; postgres is retained for
  -- the existing server connection used by this deployment.
  FOREACH role_name IN ARRAY ARRAY['appDB', 'postgres'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE "reminder_dispatch_ledger" TO %I', role_name);
      EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE "reminder_dispatch_ledger_id_seq" TO %I', role_name);
    END IF;
  END LOOP;

  -- RLS is default-deny for non-owners, so permit only the named server role.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'appDB')
     AND NOT EXISTS (
       SELECT 1 FROM pg_policies
       WHERE schemaname = current_schema()
         AND tablename = 'reminder_dispatch_ledger'
         AND policyname = 'reminder_dispatch_ledger_app_server'
     ) THEN
    CREATE POLICY "reminder_dispatch_ledger_app_server"
      ON "reminder_dispatch_ledger"
      TO "appDB"
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
