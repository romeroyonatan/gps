CREATE TABLE `equipos` (
	`id` text PRIMARY KEY NOT NULL,
	`tipo` text NOT NULL,
	`ambito_tipo` text NOT NULL,
	`ambito_id` text,
	`creado_en` integer NOT NULL,
	`actualizado_en` integer NOT NULL,
	CONSTRAINT "equipo_ambito_valido" CHECK(("equipos"."ambito_tipo" = 'grupo' AND "equipos"."ambito_id" IS NOT NULL) OR ("equipos"."ambito_tipo" = 'diocesis' AND "equipos"."ambito_id" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `equipo_de_grupo_unico` ON `equipos` (`tipo`,`ambito_id`) WHERE "equipos"."ambito_tipo" = 'grupo';--> statement-breakpoint
CREATE UNIQUE INDEX `equipo_diocesano_unico` ON `equipos` (`tipo`) WHERE "equipos"."ambito_tipo" = 'diocesis';--> statement-breakpoint
CREATE TABLE `integrantes_de_equipo` (
	`id` text PRIMARY KEY NOT NULL,
	`equipo_id` text NOT NULL,
	`persona_id` text NOT NULL,
	`desde` text NOT NULL,
	`hasta` text,
	`revocado_en` integer,
	`creado_en` integer NOT NULL,
	`actualizado_en` integer NOT NULL,
	FOREIGN KEY (`equipo_id`) REFERENCES `equipos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `integrantes_de_equipo_equipo_id_persona_id_desde_unique` ON `integrantes_de_equipo` (`equipo_id`,`persona_id`,`desde`);--> statement-breakpoint
ALTER TABLE `cargos` ADD `revocado_en` integer;