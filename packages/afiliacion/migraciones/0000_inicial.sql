CREATE TABLE `afiliados` (
	`declaracion_id` text NOT NULL,
	`persona_id` text NOT NULL,
	`tipo_de_documento` text NOT NULL,
	`numero_de_documento` text NOT NULL,
	`nombres` text NOT NULL,
	`apellidos` text NOT NULL,
	PRIMARY KEY(`declaracion_id`, `persona_id`),
	FOREIGN KEY (`declaracion_id`) REFERENCES `declaraciones`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `afiliado_por_persona` ON `afiliados` (`persona_id`);--> statement-breakpoint
CREATE TABLE `declaraciones` (
	`id` text PRIMARY KEY NOT NULL,
	`grupo_id` text NOT NULL,
	`fecha` text NOT NULL,
	`periodo` integer NOT NULL,
	`creado_en` integer NOT NULL,
	`actualizado_en` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `declaracion_por_periodo` ON `declaraciones` (`periodo`);--> statement-breakpoint
CREATE UNIQUE INDEX `declaraciones_fecha_grupo_id_unique` ON `declaraciones` (`fecha`,`grupo_id`);