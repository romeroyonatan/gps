CREATE TABLE `cargos` (
	`id` text PRIMARY KEY NOT NULL,
	`persona_id` text NOT NULL,
	`grupo_id` text NOT NULL,
	`cargo` text NOT NULL,
	`desde` text NOT NULL,
	`hasta` text,
	`creado_en` integer NOT NULL,
	`actualizado_en` integer NOT NULL,
	FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cargos_persona_id_grupo_id_cargo_desde_unique` ON `cargos` (`persona_id`,`grupo_id`,`cargo`,`desde`);--> statement-breakpoint
CREATE TABLE `pertenencias` (
	`id` text PRIMARY KEY NOT NULL,
	`persona_id` text NOT NULL,
	`grupo_id` text NOT NULL,
	`categoria` text NOT NULL,
	`rama` text,
	`desde` text NOT NULL,
	`hasta` text,
	`creado_en` integer NOT NULL,
	`actualizado_en` integer NOT NULL,
	FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pertenencia_vigente_por_persona` ON `pertenencias` (`persona_id`) WHERE hasta is null;