CREATE TABLE `unidades` (
	`id` text PRIMARY KEY NOT NULL,
	`grupo_id` text NOT NULL,
	`rama` text NOT NULL,
	`sexo` text NOT NULL,
	`nombre` text NOT NULL,
	`cerrada_en` integer,
	`creado_en` integer NOT NULL,
	`actualizado_en` integer NOT NULL,
	FOREIGN KEY (`grupo_id`) REFERENCES `grupos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unidad_abierta_por_grupo_rama_nombre` ON `unidades` (`grupo_id`,`rama`,`nombre`) WHERE cerrada_en is null;
--> statement-breakpoint
-- Cada rama abierta pasa a ser una unidad. El nombre por defecto es el tipo de
-- unidad de la rama, que los dirigentes corrigen despues; el sexo es mixta,
-- porque el dato no existia. El id se deriva del grupo y la rama en vez de
-- salir de core.nuevoId: una migracion no tiene Core, y la pertenencia resuelve
-- su unidad con esta misma cuenta.
INSERT INTO `unidades` (`id`, `grupo_id`, `rama`, `sexo`, `nombre`, `cerrada_en`, `creado_en`, `actualizado_en`)
SELECT
	'unidad_' || `grupo_id` || '_' || `rama`,
	`grupo_id`,
	`rama`,
	'mixta',
	CASE `rama`
		WHEN 'castores' THEN 'Colonia'
		WHEN 'lobatos' THEN 'Manada'
		WHEN 'scouts' THEN 'Tropa scout'
		WHEN 'raiders' THEN 'Tropa raider'
		WHEN 'rovers' THEN 'Clan'
		WHEN 'adultos' THEN 'Tropa'
		ELSE `rama`
	END,
	NULL,
	`creado_en`,
	`creado_en`
FROM `ramas_del_grupo`;
