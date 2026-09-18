ALTER TABLE `pertenencias` ADD `unidad_id` text;--> statement-breakpoint
-- Cada pertenencia pasa a apuntar a la unidad de su rama en su grupo. Es
-- deterministico porque `ramas_del_grupo` tenia clave (grupo, rama): no podia
-- haber dos unidades candidatas. Los adherentes no tienen rama y quedan en NULL.
--
-- El id se recalcula con la misma cuenta que uso la migracion 0002 de
-- estructura en vez de leer su tabla `unidades`. Leerla ataria las migraciones
-- de este modulo a que otro ya haya corrido -cierto en el backend, falso
-- corriendo personas solo- y la convencion de id alcanza para lo mismo.
UPDATE `pertenencias`
SET `unidad_id` = 'unidad_' || `grupo_id` || '_' || `rama`
WHERE `rama` IS NOT NULL;
