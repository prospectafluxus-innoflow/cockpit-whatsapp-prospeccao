CREATE TYPE "public"."wablast_message_direction" AS ENUM('outbound', 'inbound');--> statement-breakpoint
CREATE TYPE "public"."wablast_message_status" AS ENUM('sending', 'sent', 'delivered', 'read', 'failed', 'received');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_opt_in_status" AS ENUM('unknown', 'opted_in', 'opted_out');--> statement-breakpoint
CREATE TABLE "wablast_consent_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"leadId" integer NOT NULL,
	"actorUserId" integer,
	"status" "whatsapp_opt_in_status" NOT NULL,
	"sourceType" varchar(64) NOT NULL,
	"evidenceReference" text,
	"providerEventId" varchar(160),
	"eventAt" timestamp NOT NULL,
	"applied" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wablast_consent_events_valid_state" CHECK (
      (
        "wablast_consent_events"."status" = 'opted_in'
        AND nullif(trim("wablast_consent_events"."evidenceReference"), '') IS NOT NULL
        AND "wablast_consent_events"."sourceType" <> 'admin_block'
      ) OR "wablast_consent_events"."status" = 'opted_out'
    )
);
--> statement-breakpoint
CREATE TABLE "wablast_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"leadId" integer,
	"accountId" varchar(128) NOT NULL,
	"direction" "wablast_message_direction" NOT NULL,
	"messageType" varchar(32) NOT NULL,
	"status" "wablast_message_status" NOT NULL,
	"phone" varchar(30) NOT NULL,
	"touchNumber" integer,
	"templateName" varchar(512),
	"templateLanguage" varchar(20),
	"bodyPreview" text,
	"wablastMessageId" varchar(160),
	"metaMessageId" text,
	"intentKey" varchar(160),
	"idempotencyKey" varchar(160),
	"errorCode" varchar(128),
	"errorMessage" text,
	"providerData" jsonb,
	"sentAt" timestamp,
	"deliveredAt" timestamp,
	"readAt" timestamp,
	"failedAt" timestamp,
	"receivedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wablast_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"enabled" integer DEFAULT 0 NOT NULL,
	"queuePaused" integer DEFAULT 1 NOT NULL,
	"accountId" varchar(128),
	"wabaId" varchar(128),
	"accountName" varchar(255),
	"phoneNumber" varchar(30),
	"templateName" varchar(512),
	"templateLanguage" varchar(20) DEFAULT 'pt_BR' NOT NULL,
	"dailyLimit" integer DEFAULT 20 NOT NULL,
	"minIntervalSeconds" integer DEFAULT 90 NOT NULL,
	"lastConnectionCheckAt" timestamp,
	"lastError" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wablast_settings_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "wablast_webhook_events" (
	"eventId" varchar(160) PRIMARY KEY NOT NULL,
	"eventType" varchar(100) NOT NULL,
	"accountId" varchar(128),
	"payload" jsonb NOT NULL,
	"processingStatus" varchar(16) DEFAULT 'processing' NOT NULL,
	"processingToken" varchar(64) NOT NULL,
	"processingStartedAt" timestamp DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"processedAt" timestamp,
	"processingError" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "whatsappOptInStatus" "whatsapp_opt_in_status" DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "whatsappOptInAt" timestamp;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "whatsappOptInSource" varchar(255);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "whatsappOptOutAt" timestamp;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "whatsappConsentUpdatedAt" timestamp;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "whatsappLastInboundAt" timestamp;--> statement-breakpoint
CREATE INDEX "wablast_consent_events_lead_idx" ON "wablast_consent_events" USING btree ("userId","leadId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "wablast_consent_events_provider_event_idx" ON "wablast_consent_events" USING btree ("providerEventId");--> statement-breakpoint
CREATE INDEX "wablast_messages_user_created_idx" ON "wablast_messages" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "wablast_messages_lead_idx" ON "wablast_messages" USING btree ("leadId");--> statement-breakpoint
CREATE UNIQUE INDEX "wablast_messages_provider_id_idx" ON "wablast_messages" USING btree ("accountId","wablastMessageId");--> statement-breakpoint
CREATE UNIQUE INDEX "wablast_messages_meta_id_idx" ON "wablast_messages" USING btree ("accountId","metaMessageId");--> statement-breakpoint
CREATE UNIQUE INDEX "wablast_messages_intent_idx" ON "wablast_messages" USING btree ("intentKey");--> statement-breakpoint
CREATE UNIQUE INDEX "wablast_messages_idempotency_idx" ON "wablast_messages" USING btree ("idempotencyKey");--> statement-breakpoint
CREATE UNIQUE INDEX "wablast_settings_account_id_idx" ON "wablast_settings" USING btree ("accountId");--> statement-breakpoint
CREATE UNIQUE INDEX "wablast_settings_waba_id_idx" ON "wablast_settings" USING btree ("wabaId");--> statement-breakpoint
CREATE INDEX "wablast_webhook_events_type_idx" ON "wablast_webhook_events" USING btree ("eventType");--> statement-breakpoint
CREATE UNIQUE INDEX "leads_wablast_opted_in_phone_idx" ON "leads" USING btree ("userId",right(regexp_replace("whatsapp", '[^0-9]', '', 'g'), 11)) WHERE "leads"."whatsappOptInStatus" = 'opted_in';--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_whatsapp_consent_consistency" CHECK (
    (
      "leads"."whatsappOptInStatus" = 'unknown'
      AND "leads"."whatsappOptInAt" IS NULL
      AND "leads"."whatsappOptInSource" IS NULL
      AND "leads"."whatsappOptOutAt" IS NULL
      AND "leads"."whatsappConsentUpdatedAt" IS NULL
    ) OR (
      "leads"."whatsappOptInStatus" = 'opted_in'
      AND "leads"."whatsappOptInAt" IS NOT NULL
      AND nullif(trim("leads"."whatsappOptInSource"), '') IS NOT NULL
      AND "leads"."whatsappOptOutAt" IS NULL
      AND "leads"."whatsappConsentUpdatedAt" IS NOT NULL
    ) OR (
      "leads"."whatsappOptInStatus" = 'opted_out'
      AND "leads"."whatsappOptInAt" IS NULL
      AND "leads"."whatsappOptInSource" IS NULL
      AND "leads"."whatsappOptOutAt" IS NOT NULL
      AND "leads"."whatsappConsentUpdatedAt" IS NOT NULL
    )
  );