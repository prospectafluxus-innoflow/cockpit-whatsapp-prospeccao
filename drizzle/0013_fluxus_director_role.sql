ALTER TYPE "fluxus_access_role" ADD VALUE IF NOT EXISTS 'director';

ALTER TABLE "fluxus_feedback_memberships"
  DROP CONSTRAINT IF EXISTS "feedback_membership_role";

ALTER TABLE "fluxus_feedback_memberships"
  ADD CONSTRAINT "feedback_membership_role"
  CHECK ("role" IN ('collaborator','manager','supermanager','hr','director','company_admin'));
