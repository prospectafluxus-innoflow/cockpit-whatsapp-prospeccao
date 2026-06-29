CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TABLE "send_schedules" ADD COLUMN "afternoonEnabled" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "send_schedules" ADD COLUMN "afternoonHour" integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "send_schedules" ADD COLUMN "afternoonCount" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "send_schedules" ADD COLUMN "afternoonTaskUid" varchar(65);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "approvalStatus" "approval_status" DEFAULT 'pending' NOT NULL;