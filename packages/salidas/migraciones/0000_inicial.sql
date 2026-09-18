CREATE TABLE `adjuntos` (
	`id` text PRIMARY KEY NOT NULL,
	`permiso_id` text NOT NULL,
	`archivo_id` text NOT NULL,
	`creado_en` integer NOT NULL,
	`actualizado_en` integer NOT NULL,
	FOREIGN KEY (`permiso_id`) REFERENCES `permisos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `adjuntos_permiso_id_archivo_id_unique` ON `adjuntos` (`permiso_id`,`archivo_id`);--> statement-breakpoint
CREATE TABLE `firmas` (
	`id` text PRIMARY KEY NOT NULL,
	`permiso_id` text NOT NULL,
	`cargo` text NOT NULL,
	`modo` text NOT NULL,
	`persona_id` text NOT NULL,
	`nombres` text NOT NULL,
	`apellidos` text NOT NULL,
	`fecha` text NOT NULL,
	`trazos` text,
	`sello` text,
	`clave_de_sello` text,
	`escaneo_id` text,
	`creado_en` integer NOT NULL,
	`actualizado_en` integer NOT NULL,
	FOREIGN KEY (`permiso_id`) REFERENCES `permisos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `firmas_permiso_id_cargo_unique` ON `firmas` (`permiso_id`,`cargo`);--> statement-breakpoint
CREATE TABLE `participantes` (
	`permiso_id` text NOT NULL,
	`persona_id` text NOT NULL,
	`marca` text NOT NULL,
	`creado_en` integer NOT NULL,
	PRIMARY KEY(`permiso_id`, `persona_id`),
	FOREIGN KEY (`permiso_id`) REFERENCES `permisos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `participantes_emitidos` (
	`permiso_id` text NOT NULL,
	`persona_id` text NOT NULL,
	`marca` text NOT NULL,
	`tipo_de_documento` text NOT NULL,
	`numero_de_documento` text NOT NULL,
	`nombres` text NOT NULL,
	`apellidos` text NOT NULL,
	`unidad` text NOT NULL,
	`creado_en` integer NOT NULL,
	PRIMARY KEY(`permiso_id`, `persona_id`),
	FOREIGN KEY (`permiso_id`) REFERENCES `permisos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `permisos` (
	`id` text PRIMARY KEY NOT NULL,
	`grupo_id` text NOT NULL,
	`estado` text NOT NULL,
	`lugar` text NOT NULL,
	`desde` text NOT NULL,
	`hasta` text NOT NULL,
	`como_se_viaja` text,
	`pdf_id` text,
	`hash_del_pdf` text,
	`reemplaza_a` text,
	`creado_en` integer NOT NULL,
	`actualizado_en` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `unidades_del_permiso` (
	`permiso_id` text NOT NULL,
	`unidad_id` text NOT NULL,
	`creado_en` integer NOT NULL,
	PRIMARY KEY(`permiso_id`, `unidad_id`),
	FOREIGN KEY (`permiso_id`) REFERENCES `permisos`(`id`) ON UPDATE no action ON DELETE no action
);
