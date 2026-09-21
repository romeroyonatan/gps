-- El DEFAULT '' no esta en el modelo: SQLite no admite agregar una columna NOT
-- NULL sin uno, y los permisos ya cargados no tienen direccion. Se completa a
-- mano; los nuevos la exigen en el formulario.
ALTER TABLE `permisos` ADD `direccion` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `permisos` ADD `localidad` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `permisos` ADD `provincia` text DEFAULT '' NOT NULL;
