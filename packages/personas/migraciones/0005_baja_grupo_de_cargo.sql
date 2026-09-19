DROP INDEX `cargos_persona_id_grupo_id_cargo_desde_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `cargos_persona_id_ambito_id_cargo_desde_unique` ON `cargos` (`persona_id`,`ambito_id`,`cargo`,`desde`);--> statement-breakpoint
ALTER TABLE `cargos` DROP COLUMN `grupo_id`;