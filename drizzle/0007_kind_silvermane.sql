CREATE TABLE "user_integrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"provider" varchar(32) DEFAULT 'trello' NOT NULL,
	"enabled" integer DEFAULT 0 NOT NULL,
	"credentialsEncrypted" text NOT NULL,
	"listId" varchar(64) NOT NULL,
	"listName" varchar(255),
	"lastError" text,
	"lastTestedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "trelloCardId" varchar(64);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "trelloCardUrl" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "trelloSyncedAt" timestamp;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "trelloSyncError" text;--> statement-breakpoint
CREATE UNIQUE INDEX "user_integrations_user_provider_idx" ON "user_integrations" USING btree ("userId","provider");