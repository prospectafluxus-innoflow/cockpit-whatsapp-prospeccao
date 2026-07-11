ALTER TABLE "message_templates" ADD COLUMN "audioKey" text;--> statement-breakpoint
ALTER TABLE "message_templates" ADD COLUMN "audioUrl" text;--> statement-breakpoint
ALTER TABLE "message_templates" ADD COLUMN "audioFileName" varchar(255);--> statement-breakpoint
ALTER TABLE "message_templates" ADD COLUMN "audioMimeType" varchar(100);--> statement-breakpoint
ALTER TABLE "message_templates" ADD COLUMN "audioSize" integer;