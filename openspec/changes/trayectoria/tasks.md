## 1. Subunidades en estructura

- [ ] 1.1 `RAMAS` suma `subunidad` (Seisena, Patrulla, Equipo, `null` en Castores) y su lookup en `dominio/unidades.ts`. Verificar con `estructura/test/ramas.test.ts`.
- [ ] 1.2 Tabla `subunidades` en `servidor/tablas.ts` con UNIQUE parcial por unidad y nombre entre las abiertas, migración con `bunx drizzle-kit generate --name subunidades` y alta en `migraciones.ts`. Verificar con el test de migraciones.
- [ ] 1.3 `abrirSubunidad`, `cerrarSubunidad` y `subunidadesDeLaUnidad` en el servicio, con `politicas.ts` nueva (jefatura y Secretaría sobre `tieneRol`). Verificar con tests del servicio que cubran los escenarios de "Abrir y cerrar una subunidad", incluida la rama sin subunidad y la unidad cerrada.
- [ ] 1.4 Mutations y campo `subunidades` en el esquema de `estructura`, `bun run schema` y `bun run --filter @gps/api codegen`. Verificar `bun run check` y el `schema.gql` commiteado.

## 2. Módulo trayectoria

- [ ] 2.1 Crear `packages/trayectoria` copiando `packages/sistema`, con su `package.json`, su `Module` y `accesoAlModulo`. Verificar que `bun run check` pasa con el módulo vacío registrado en `services/backend/src/modules.ts`.
- [ ] 2.2 `dominio/fechas.ts`: validar y comparar fechas de precisión parcial. Verificar con tests de "2019", "2019-13", "2019-02-31" y del orden entre precisiones distintas.
- [ ] 2.3 `dominio/hitos.ts`: catálogo con las ramas de cada hito (Lobatos y Scouts completos; Raiders con uniforme, promesa e investidura; Rovers con uniforme y promesa; Castores y Adultos vacíos) y `dominio/insignias.ts` con el tipo de insignia por rama. Verificar con tests del catálogo.
- [ ] 2.4 `dominio/politicas.ts` con quién carga y quién lee, y las validaciones puras de tramo, hito e insignia. Verificar con tests de cada rechazo de las specs.
- [ ] 2.5 Tablas `tramos`, `hitos` —con `UNIQUE (persona, hito)`— e `insignias`, migración y `migraciones.ts`. Verificar con el test de migraciones.
- [ ] 2.6 Servicio: registrar y borrar tramo, hito e insignia; `trayectoriaDe(persona)`; `subunidadesConGente(unidad)`. Verificar con tests del servicio que cubran la promesa repetida, la promesa scout tomada de rover, el tramo sin subunidad y el tramo con subunidad ajena.
- [ ] 2.7 Esquema GraphQL del módulo, `bun run schema` y codegen. Verificar `bun run check`.

## 3. El pase cierra la patrulla

- [ ] 3.1 Declarar `PasesRegistrados` en `personas/dominio/publico.ts` y publicarlo después del commit de `registrarPases`, con el error al log. Verificar con un test que afirme que se publica una vez por lote.
- [ ] 3.2 Suscriptor en `trayectoria` que cierra los tramos abiertos con la víspera del pase. Verificar con un test de integración: pase de un chico con patrulla abierta y tramo cerrado el día anterior.

## 4. Web

- [ ] 4.1 Pantalla `/grupos/:id/personas/:personaId/trayectoria`: línea de tiempo de tramos, hitos, insignias y pertenencias, con el origen de cada fila, y los formularios de carga y borrado. Verificar a 375px con el demo, cargando un hito y un tramo con fecha de sólo año.
- [ ] 4.2 Dos `Seccion` de resumen en `Persona.tsx` que entran a esa pantalla. Verificar navegando desde la ficha.
- [ ] 4.3 Pantalla `/grupos/:id/unidades/:unidadId` con patrullas, quién está en cada una, y abrir y cerrar patrulla; sección nueva "Unidades" en `Grupo.tsx`. Verificar a 375px repartiendo dos chicos en dos patrullas.

## 5. Mobile

- [ ] 5.1 Gemela de la trayectoria en `apps/mobile/app/grupos/[id]/personas/[personaId]/trayectoria.tsx`, con las piezas de `apps/mobile/src/ui.tsx`. Verificar en Expo y comparando lado a lado con la web angosta.
- [ ] 5.2 Gemela de la pantalla de unidad y su acceso desde la pantalla del grupo. Verificar igual que la anterior.

## 6. Cierre

- [ ] 6.1 Sembrar en `packages/demo` patrullas y una trayectoria completa —tramos con fecha de sólo año, promesas de dos ramas e insignias—. Verificar con `bun run demo` que la ficha y la línea de tiempo muestran el caso del chico de seis años en el grupo.
- [ ] 6.2 Actualizar `docs/arquitectura.md` y `CLAUDE.md` (módulo nuevo, subunidades, evento del pase). Verificar `bun run check` verde.
