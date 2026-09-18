PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_cargos` (
	`id` text PRIMARY KEY NOT NULL,
	`persona_id` text NOT NULL,
	`grupo_id` text,
	`ambito_id` text,
	`cargo` text NOT NULL,
	`desde` text NOT NULL,
	`hasta` text,
	`creado_en` integer NOT NULL,
	`actualizado_en` integer NOT NULL,
	FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_cargos`("id", "persona_id", "grupo_id", "ambito_id", "cargo", "desde", "hasta", "creado_en", "actualizado_en") SELECT "id", "persona_id", "grupo_id", NULL, "cargo", "desde", "hasta", "creado_en", "actualizado_en" FROM `cargos`;--> statement-breakpoint
DROP TABLE `cargos`;--> statement-breakpoint
ALTER TABLE `__new_cargos` RENAME TO `cargos`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `cargos_persona_id_grupo_id_cargo_desde_unique` ON `cargos` (`persona_id`,`grupo_id`,`cargo`,`desde`);--> statement-breakpoint
-- Todos los cargos que existian son de grupo: el catalogo no tenia otros. El
-- ambito no se copia porque no se guarda: sale de `cargo` via ambitoDelCargo.
UPDATE `cargos` SET `ambito_id` = `grupo_id`;
