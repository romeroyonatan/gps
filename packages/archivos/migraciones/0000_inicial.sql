CREATE TABLE `archivos` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`tipo` text NOT NULL,
	`tamano` integer NOT NULL,
	`sha256` text NOT NULL,
	`modulo` text NOT NULL,
	`recurso_id` text NOT NULL,
	`confirmado` integer NOT NULL,
	`creado_en` integer NOT NULL,
	`actualizado_en` integer NOT NULL
);
