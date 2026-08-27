CREATE TABLE `distritos` (
	`id` text PRIMARY KEY NOT NULL,
	`numero` integer NOT NULL,
	`zona` text NOT NULL,
	`creado_en` integer NOT NULL,
	`actualizado_en` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `distritos_numero_unique` ON `distritos` (`numero`);--> statement-breakpoint
CREATE TABLE `grupos` (
	`id` text PRIMARY KEY NOT NULL,
	`numero` integer NOT NULL,
	`nombre` text NOT NULL,
	`distrito_id` text NOT NULL,
	`creado_en` integer NOT NULL,
	`actualizado_en` integer NOT NULL,
	FOREIGN KEY (`distrito_id`) REFERENCES `distritos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `grupos_numero_unique` ON `grupos` (`numero`);--> statement-breakpoint
CREATE TABLE `ramas_del_grupo` (
	`grupo_id` text NOT NULL,
	`rama` text NOT NULL,
	`creado_en` integer NOT NULL,
	PRIMARY KEY(`grupo_id`, `rama`),
	FOREIGN KEY (`grupo_id`) REFERENCES `grupos`(`id`) ON UPDATE no action ON DELETE no action
);
