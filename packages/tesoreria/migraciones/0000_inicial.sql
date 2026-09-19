CREATE TABLE `cuotas_de_afiliacion` (
	`periodo` integer PRIMARY KEY NOT NULL,
	`importe` integer NOT NULL,
	`creado_en` integer NOT NULL,
	`actualizado_en` integer NOT NULL,
	CONSTRAINT "cuota_importe_positivo" CHECK("cuotas_de_afiliacion"."importe" > 0)
);
--> statement-breakpoint
CREATE TABLE `movimientos_de_tesoreria` (
	`id` text PRIMARY KEY NOT NULL,
	`grupo_id` text NOT NULL,
	`fecha` text NOT NULL,
	`tipo` text NOT NULL,
	`importe` integer NOT NULL,
	`periodo` integer,
	`declaracion_id` text,
	`cantidad` integer,
	`cuota` integer,
	`medio_de_pago` text,
	`referencia` text,
	`observacion` text,
	`anula_a` text,
	`creado_en` integer NOT NULL,
	`actualizado_en` integer NOT NULL,
	FOREIGN KEY (`anula_a`) REFERENCES `movimientos_de_tesoreria`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "movimiento_campos_por_tipo" CHECK((
        "movimientos_de_tesoreria"."tipo" = 'cargo_afiliacion' AND "movimientos_de_tesoreria"."importe" > 0
          AND "movimientos_de_tesoreria"."declaracion_id" IS NOT NULL AND "movimientos_de_tesoreria"."periodo" IS NOT NULL
          AND "movimientos_de_tesoreria"."cantidad" > 0 AND "movimientos_de_tesoreria"."cuota" > 0
          AND "movimientos_de_tesoreria"."medio_de_pago" IS NULL AND "movimientos_de_tesoreria"."anula_a" IS NULL
      ) OR (
        "movimientos_de_tesoreria"."tipo" = 'pago' AND "movimientos_de_tesoreria"."importe" < 0
          AND "movimientos_de_tesoreria"."declaracion_id" IS NULL AND "movimientos_de_tesoreria"."periodo" IS NULL
          AND "movimientos_de_tesoreria"."cantidad" IS NULL AND "movimientos_de_tesoreria"."cuota" IS NULL
          AND "movimientos_de_tesoreria"."medio_de_pago" IN ('transferencia', 'efectivo', 'otro')
          AND "movimientos_de_tesoreria"."anula_a" IS NULL
      ) OR (
        "movimientos_de_tesoreria"."tipo" = 'anulacion_pago' AND "movimientos_de_tesoreria"."importe" > 0
          AND "movimientos_de_tesoreria"."declaracion_id" IS NULL AND "movimientos_de_tesoreria"."periodo" IS NULL
          AND "movimientos_de_tesoreria"."cantidad" IS NULL AND "movimientos_de_tesoreria"."cuota" IS NULL
          AND "movimientos_de_tesoreria"."medio_de_pago" IS NULL AND "movimientos_de_tesoreria"."anula_a" IS NOT NULL
      ))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cargo_por_declaracion` ON `movimientos_de_tesoreria` (`declaracion_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `anulacion_por_pago` ON `movimientos_de_tesoreria` (`anula_a`);--> statement-breakpoint
CREATE INDEX `movimientos_por_grupo` ON `movimientos_de_tesoreria` (`grupo_id`,`fecha`);--> statement-breakpoint
CREATE INDEX `cargos_por_periodo` ON `movimientos_de_tesoreria` (`periodo`);