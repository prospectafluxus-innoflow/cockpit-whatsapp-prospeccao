CREATE TABLE `daily_sends` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`leadId` int NOT NULL,
	`touchNumber` int NOT NULL,
	`sentDate` date NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `daily_sends_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`firstName` varchar(100),
	`company` varchar(255),
	`whatsapp` varchar(30) NOT NULL,
	`score` int DEFAULT 0,
	`layer` enum('A','B','C') NOT NULL DEFAULT 'B',
	`size` varchar(100),
	`employees` int,
	`investment` varchar(100),
	`taxRegime` varchar(100),
	`participations` int,
	`lastEvent` varchar(100),
	`status` enum('novo','toque1_enviado','toque2_enviado','toque3_enviado','respondeu','fechado','descartado') NOT NULL DEFAULT 'novo',
	`kanbanColumn` enum('Novo','Toque 1 Enviado','Toque 2 Enviado','Toque 3 Enviado','Respondeu','Fechado') NOT NULL DEFAULT 'Novo',
	`toque1SentAt` timestamp,
	`toque2SentAt` timestamp,
	`toque3SentAt` timestamp,
	`respondedAt` timestamp,
	`notes` text,
	`lastAiSuggestion` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
