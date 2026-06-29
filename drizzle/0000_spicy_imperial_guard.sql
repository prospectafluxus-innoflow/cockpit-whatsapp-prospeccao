CREATE TYPE "public"."kanban_column" AS ENUM('Novo', 'Toque 1 Enviado', 'Toque 2 Enviado', 'Toque 3 Enviado', 'Respondeu', 'Fechado');--> statement-breakpoint
CREATE TYPE "public"."layer" AS ENUM('A', 'B', 'C');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('novo', 'toque1_enviado', 'toque2_enviado', 'toque3_enviado', 'respondeu', 'fechado', 'descartado');--> statement-breakpoint
CREATE TABLE "daily_sends" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"leadId" integer NOT NULL,
	"touchNumber" integer NOT NULL,
	"sentDate" date NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"firstName" varchar(100),
	"company" varchar(255),
	"whatsapp" varchar(30) NOT NULL,
	"score" integer DEFAULT 0,
	"layer" "layer" DEFAULT 'B' NOT NULL,
	"size" varchar(100),
	"employees" integer,
	"investment" varchar(100),
	"taxRegime" varchar(100),
	"participations" integer,
	"lastEvent" varchar(100),
	"status" "status" DEFAULT 'novo' NOT NULL,
	"kanbanColumn" "kanban_column" DEFAULT 'Novo' NOT NULL,
	"toque1SentAt" timestamp,
	"toque2SentAt" timestamp,
	"toque3SentAt" timestamp,
	"respondedAt" timestamp,
	"notes" text,
	"lastAiSuggestion" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "send_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"morningEnabled" integer DEFAULT 1 NOT NULL,
	"morningHour" integer DEFAULT 8 NOT NULL,
	"morningCount" integer DEFAULT 2 NOT NULL,
	"lunchEnabled" integer DEFAULT 1 NOT NULL,
	"lunchHour" integer DEFAULT 12 NOT NULL,
	"lunchCount" integer DEFAULT 2 NOT NULL,
	"eveningEnabled" integer DEFAULT 1 NOT NULL,
	"eveningHour" integer DEFAULT 17 NOT NULL,
	"eveningCount" integer DEFAULT 2 NOT NULL,
	"morningTaskUid" varchar(65),
	"lunchTaskUid" varchar(65),
	"eveningTaskUid" varchar(65),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "send_schedules_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64),
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "role" DEFAULT 'user' NOT NULL,
	"passwordHash" varchar(255),
	"resetToken" varchar(128),
	"resetTokenExpiresAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
