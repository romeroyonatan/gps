## 1. Estructura: dominio

- [x] 1.1 Sumar `unidad` a cada entrada de `RAMAS` (Colonia, Manada, Tropa scout, Tropa raider, Clan, Tropa); verificar con test del catálogo
- [x] 1.2 Agregar a `dominio/modelos.ts` el modelo `Unidad` y el tipo de sexo, y a `dominio/unidades.ts` la función `nombreDeLaUnidad`; verificar con test de composición del nombre
- [x] 1.3 Agregar `ramasDeLasUnidades` a `dominio/unidades.ts`; verificar con test del escenario "Las ramas abiertas se derivan"
- [x] 1.4 Reemplazar `GrupoConRamas` por `GrupoConUnidades` en modelos y en `publico.ts`; verificar tipos con `bun run check`

## 2. Estructura: servidor

- [x] 2.1 Reemplazar `ramas_del_grupo` por la tabla `unidades` con UNIQUE parcial sobre las abiertas y generar la migración que convierte cada rama abierta en una unidad; verificar con test que aplica la migración sobre una base con ramas abiertas
- [x] 2.2 Implementar abrir y cerrar unidad con sus validaciones; verificar con los escenarios de "Abrir una unidad" y "Cerrar una unidad"
- [x] 2.3 Exponer las unidades del grupo (rama, sexo, nombre) en el esquema GraphQL; verificar con el escenario "Las unidades del grupo" y `bun run schema`

## 3. Personas

- [x] 3.1 Reemplazar `pertenencias.rama` por `unidad_id` y generar la migración que resuelve cada rama contra la unidad de su grupo; verificar con test que conserva período y categoría
- [x] 3.2 Actualizar `dominio/validaciones.ts` (`validarIngreso`) a unidad obligatoria salvo adherente, unidad abierta y del grupo; verificar con los escenarios de "La persona pertenece a una unidad"
- [x] 3.3 Actualizar servicio y esquema GraphQL para que la rama se derive de la unidad; verificar `bun run schema` y `bun run --filter @gps/api codegen`

## 4. Demo y pantallas

- [x] 4.1 Sembrar la demo con unidades, incluido un grupo con dos tropas scout de distinto sexo; verificar en `bun run demo`
- [x] 4.2 Actualizar las pantallas web de estructura, grupo y alta de persona para elegir unidad, diseñadas a 375px; verificar navegando la demo
- [x] 4.3 Actualizar las pantallas mobile equivalentes; verificar en el simulador contra la demo

## 5. Cierre

- [x] 5.1 Actualizar `docs/arquitectura.md` y `CLAUDE.md` donde nombren ramas del grupo; verificar leyendo el diff
- [x] 5.2 `bun run check` en verde; verificar su salida
