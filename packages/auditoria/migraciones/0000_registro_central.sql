CREATE TABLE `eventos_de_auditoria` (
  `id` text PRIMARY KEY NOT NULL,
  `ocurrido_en` integer NOT NULL,
  `actor_persona_id` text,
  `origen_interno` text,
  `modulo` text NOT NULL,
  `accion` text NOT NULL,
  `resultado` text NOT NULL CHECK (`resultado` IN ('exitoso', 'rechazado')),
  `elevado` integer NOT NULL,
  `grupo_id` text,
  `entidad_tipo` text,
  `entidad_id` text,
  `objetivo_persona_id` text,
  `resumen` text NOT NULL,
  `cambios` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auditoria_por_fecha` ON `eventos_de_auditoria` (`ocurrido_en`,`id`);
--> statement-breakpoint
CREATE INDEX `auditoria_por_grupo` ON `eventos_de_auditoria` (`grupo_id`,`ocurrido_en`);
--> statement-breakpoint
CREATE INDEX `auditoria_por_actor` ON `eventos_de_auditoria` (`actor_persona_id`,`ocurrido_en`);
--> statement-breakpoint
CREATE INDEX `auditoria_por_accion` ON `eventos_de_auditoria` (`modulo`,`accion`,`ocurrido_en`);
--> statement-breakpoint
INSERT OR IGNORE INTO `eventos_de_auditoria`
  (`id`, `ocurrido_en`, `actor_persona_id`, `modulo`, `accion`, `resultado`, `elevado`, `grupo_id`, `objetivo_persona_id`, `resumen`, `cambios`)
SELECT `id`, `creado_en`, `actor_persona_id`, 'personas', `tipo`, 'exitoso', 0,
       CASE WHEN `ambito_tipo` = 'grupo' THEN `ambito_id` ELSE NULL END,
       `objetivo_persona_id`,
       json_object('ambitoTipo', `ambito_tipo`, 'ambitoId', `ambito_id`), '[]'
FROM `eventos_de_autoridad`;
--> statement-breakpoint
INSERT OR IGNORE INTO `eventos_de_auditoria`
  (`id`, `ocurrido_en`, `actor_persona_id`, `modulo`, `accion`, `resultado`, `elevado`, `objetivo_persona_id`, `resumen`, `cambios`)
SELECT `id`, `creado_en`, `actor_persona_id`, 'auth', `tipo`, 'exitoso',
       CASE WHEN `tipo` = 'sudo.escritura' THEN 1 ELSE 0 END,
       `objetivo_persona_id`, `detalles`, '[]'
FROM `eventos_de_seguridad`;
