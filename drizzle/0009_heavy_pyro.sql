CREATE TYPE "public"."account_type" AS ENUM('prospecting', 'fluxus');--> statement-breakpoint
CREATE TYPE "public"."fluxus_assessment_status" AS ENUM('draft', 'completed');--> statement-breakpoint
CREATE TABLE "fluxus_assessments" (
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
--> statement-breakpoint
CREATE TABLE "fluxus_companies" (
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
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "accountType" "account_type" DEFAULT 'prospecting' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "companyId" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "jobTitle" varchar(180);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "department" varchar(180);--> statement-breakpoint
CREATE INDEX "fluxus_assessments_user_idx" ON "fluxus_assessments" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "fluxus_assessments_company_idx" ON "fluxus_assessments" USING btree ("companyId","status","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "fluxus_companies_normalized_name_idx" ON "fluxus_companies" USING btree ("normalizedName");