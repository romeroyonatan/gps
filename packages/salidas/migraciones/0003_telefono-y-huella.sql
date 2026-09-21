-- El DEFAULT '' no esta en el modelo: SQLite no admite agregar una columna NOT
-- NULL sin uno. Los permisos ya cargados no tienen telefono; los nuevos lo
-- exigen en el formulario.
ALTER TABLE `permisos` ADD `telefono` text DEFAULT '' NOT NULL;--> statement-breakpoint
-- Null en los ya emitidos: su huella no se puede calcular hacia atras sin
-- afirmar algo que nadie comprobo, y el PDF sabe no avisar cuando falta.
ALTER TABLE `permisos` ADD `hash_del_contenido` text;
