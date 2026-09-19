CREATE TABLE `eventos_de_autoridad` (
	`id` text PRIMARY KEY NOT NULL,
	`tipo` text NOT NULL,
	`actor_persona_id` text NOT NULL,
	`objetivo_persona_id` text NOT NULL,
	`ambito_tipo` text NOT NULL,
	`ambito_id` text,
	`creado_en` integer NOT NULL
);
