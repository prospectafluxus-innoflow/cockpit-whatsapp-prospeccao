-- Snapshot auditável dos estados anteriores, inclusive liberação, visualização, ciência e manifestação.
ALTER TABLE "fluxus_feedback_revisions"
  ADD COLUMN IF NOT EXISTS "previousMetadata" jsonb NOT NULL DEFAULT '{}'::jsonb;
