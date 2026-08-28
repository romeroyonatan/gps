CREATE TABLE `personas` (
	`id` text PRIMARY KEY NOT NULL,
	`tipo_de_documento` text NOT NULL,
	`numero_de_documento` text NOT NULL,
	`nombres` text NOT NULL,
	`apellidos` text NOT NULL,
	`fecha_de_nacimiento` text NOT NULL,
	`creado_en` integer NOT NULL,
	`actualizado_en` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `personas_tipo_de_documento_numero_de_documento_unique` ON `personas` (`tipo_de_documento`,`numero_de_documento`);