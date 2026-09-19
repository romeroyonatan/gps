CREATE TABLE `administrador_del_sistema` (
	`singleton` integer PRIMARY KEY NOT NULL,
	`persona_id` text NOT NULL,
	`creado_en` integer NOT NULL,
	`actualizado_en` integer NOT NULL,
	CONSTRAINT "administrador_fila_unica" CHECK("administrador_del_sistema"."singleton" = 1)
);
--> statement-breakpoint
CREATE TABLE `eventos_de_seguridad` (
	`id` text PRIMARY KEY NOT NULL,
	`tipo` text NOT NULL,
	`actor_persona_id` text,
	`objetivo_persona_id` text,
	`detalles` text NOT NULL,
	`creado_en` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `identidades_externas` (
	`id` text PRIMARY KEY NOT NULL,
	`persona_id` text NOT NULL,
	`proveedor` text NOT NULL,
	`subject` text NOT NULL,
	`desactivada_en` integer,
	`creado_en` integer NOT NULL,
	`actualizado_en` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `identidades_externas_proveedor_subject_unique` ON `identidades_externas` (`proveedor`,`subject`);--> statement-breakpoint
CREATE TABLE `invitaciones` (
	`id` text PRIMARY KEY NOT NULL,
	`tipo` text NOT NULL,
	`persona_id` text NOT NULL,
	`proveedor_a_reemplazar` text,
	`hash_del_secreto` text NOT NULL,
	`emitida_por` text NOT NULL,
	`expira_en` integer NOT NULL,
	`consumida_en` integer,
	`revocada_en` integer,
	`creado_en` integer NOT NULL,
	`actualizado_en` integer NOT NULL,
	CONSTRAINT "invitacion_proveedor_valido" CHECK(("invitaciones"."tipo" = 'activacion' AND "invitaciones"."proveedor_a_reemplazar" IS NULL) OR ("invitaciones"."tipo" = 'recuperacion' AND "invitaciones"."proveedor_a_reemplazar" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitaciones_hash_del_secreto_unique` ON `invitaciones` (`hash_del_secreto`);--> statement-breakpoint
CREATE TABLE `sesiones` (
	`id` text PRIMARY KEY NOT NULL,
	`persona_id` text NOT NULL,
	`identidad_id` text NOT NULL,
	`hash_del_secreto` text NOT NULL,
	`expira_en` integer NOT NULL,
	`revocada_en` integer,
	`elevada_hasta` integer,
	`creado_en` integer NOT NULL,
	`actualizado_en` integer NOT NULL,
	FOREIGN KEY (`identidad_id`) REFERENCES `identidades_externas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sesiones_hash_del_secreto_unique` ON `sesiones` (`hash_del_secreto`);