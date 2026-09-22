## 1. Dominio de personas

- [x] 1.1 `validarIngreso` rechaza cargos cuyo `ambitoDelCargo` no sea `grupo`; caso nuevo en `test/validaciones.test.ts` (alta con comisionado de distrito → problema en `cargos`)
- [x] 1.2 `puedeCambiarDeUnidad(pertenencia)` y `validarCambioDeUnidad(pertenencia, unidadId, desde, unidadesAbiertas, hoy)` en `/dominio`, con tests de cada rechazo del spec `unidades` (beneficiario, misma unidad, cerrada/ajena, futura, no posterior al desde vigente)

## 2. Servidor de personas

- [x] 2.1 `editarPersona` en el servicio: autoriza con `puedeAdministrarPlantelDeGrupo` sobre el grupo vigente, corre `validarPersona`, normaliza el número y traduce el UNIQUE a `DocumentoDuplicado`; tests en `test/servicio.test.ts` para DNI corregido, documento de otra persona, mismo documento y otro grupo
- [x] 2.2 `cambiarDeUnidad` en el servicio: valida con la función de 1.2 contra `obtenerGrupo`, cierra la vigente con `hasta = desde - 1` y abre la nueva en una transacción; tests para el pase, la consulta `miembrosDelGrupo` a una fecha pasada y cargos/equipos intactos
- [x] 2.3 Mutations `editarPersona` y `cambiarDeUnidad` en `schema.ts`, con `DocumentoDuplicado` y `DatosInvalidos` traducidos como en `crearPersona`; `bun run schema` y el `schema.gql` resultante commiteado
- [x] 2.4 Hooks `useEditarPersona` y `useCambiarDeUnidad` en `@gps/api`, invalidando `personas(grupoId)`; `bun run --filter @gps/api codegen` sin diferencias pendientes

## 3. Piezas compartidas (web y mobile)

- [x] 3.1 `Etiqueta` (Chip con ×) del plantel pasa a `ui.tsx` en las dos apps; el plantel la importa y se ve igual; filas nuevas en la tabla de CLAUDE.md y en `apps/mobile/README.md`
- [x] 3.2 Extraer `DatosPersonales` del alta, en las dos apps; el alta sigue funcionando igual (cargar una persona en `bun run demo`)
- [x] 3.3 Extraer `Unidades` y `Cargos` del alta, en las dos apps; `Cargos` filtra por ámbito grupo; el alta ya no ofrece comisionado ni jefe scout diocesano

## 4. Pantallas

- [x] 4.1 Detalle en web y mobile (`/grupos/:id/personas/:personaId`): datos personales con edad, pertenencia con "en la unidad desde", cargos y equipos; los botones de edición sólo aparecen si `puedeAdministrarPlantelDeGrupo`; verificado en el demo
- [x] 4.2 Las filas de la nómina enlazan al detalle con `CHEVRON`, en las dos apps
- [x] 4.3 Edición de datos personales (`…/editar`) con `DatosPersonales` precargado; un DNI de otra persona muestra el error de `DocumentoDuplicado`; al guardar vuelve al detalle
- [x] 4.4 Cambio de rama (`…/rama`) con `Unidades` y fecha `desde` que arranca en hoy; el botón sólo se muestra a activos; al guardar, el detalle y la nómina muestran la unidad nueva
- [x] 4.5 Cargos y equipos en el detalle: × revoca, "+ Agregar cargo" abre `Cargos` sin los ya vigentes más Secretaría, "Guardar cargos" asigna cada uno y nombra el que falló

## 5. Cierre

- [x] 5.1 Paridad: detalle, edición y cambio de rama abiertos lado a lado a 375px en web y mobile, con el mismo orden de bloques, alturas y píldoras
- [x] 5.2 CLAUDE.md: sacar "no hay edición de personas" de "Qué NO existe todavía" y anotar el pase de dirigentes con historial
- [x] 5.3 `bun run check` pasa
