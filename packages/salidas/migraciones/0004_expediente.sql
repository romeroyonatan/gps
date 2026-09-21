ALTER TABLE `permisos` ADD `anio_de_expediente` integer;--> statement-breakpoint
ALTER TABLE `permisos` ADD `numero_de_expediente` integer;--> statement-breakpoint
-- Los ya emitidos entran a la serie antes de que exista el UNIQUE: se numeran
-- por orden de creacion, con el anio de su salida -no hay fecha de emision
-- guardada, y es lo mas cercano-. Los borradores quedan sin numero, que es lo
-- que corresponde: todavia no son expedientes.
UPDATE `permisos`
SET
  `anio_de_expediente` = CAST(substr(`desde`, 1, 4) AS INTEGER),
  `numero_de_expediente` = (
    SELECT COUNT(*)
    FROM `permisos` AS `anteriores`
    WHERE `anteriores`.`estado` <> 'borrador'
      AND substr(`anteriores`.`desde`, 1, 4) = substr(`permisos`.`desde`, 1, 4)
      AND (
        `anteriores`.`creado_en` < `permisos`.`creado_en`
        OR (`anteriores`.`creado_en` = `permisos`.`creado_en` AND `anteriores`.`id` <= `permisos`.`id`)
      )
  )
WHERE `estado` <> 'borrador';--> statement-breakpoint
CREATE UNIQUE INDEX `permisos_anio_de_expediente_numero_de_expediente_unique` ON `permisos` (`anio_de_expediente`,`numero_de_expediente`);
