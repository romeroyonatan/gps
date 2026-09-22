-- Las re-emisiones duplicadas anteriores quedan como borradores independientes;
-- se conserva el vínculo de la primera sin borrar trabajo cargado en las demás.
UPDATE `permisos`
SET `reemplaza_a` = NULL
WHERE `reemplaza_a` IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM `permisos` AS `primero`
    WHERE `primero`.`reemplaza_a` = `permisos`.`reemplaza_a`
      AND (
        `primero`.`creado_en` < `permisos`.`creado_en`
        OR (`primero`.`creado_en` = `permisos`.`creado_en` AND `primero`.`id` < `permisos`.`id`)
      )
  );--> statement-breakpoint
CREATE UNIQUE INDEX `permisos_reemplaza_a_unique` ON `permisos` (`reemplaza_a`);