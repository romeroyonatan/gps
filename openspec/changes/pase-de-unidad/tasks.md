## 1. Dominio

- [x] 1.1 `destinosDelPase` en `packages/personas/src/dominio/pases.ts`: rama siguiente por orden de `RAMAS`, Clan con Adultos y dirigente en cualquier unidad, Adultos sin destinos, propuesto por mismo sexo. Verificar con `packages/personas/test/pases.test.ts` cubriendo los escenarios de "Destinos del pase".
- [x] 1.2 `candidatosAlPase` en el mismo archivo: cumplen y cercanos (12 meses) a la fecha del pase con `calcularEdad`, sólo beneficiarios. Verificar con tests de los escenarios de "Candidatos al pase", incluidos la víspera y el día del cumpleaños.
- [x] 1.3 `validarPase` devolviendo `Problema[]`, hermana de `validarCambioDeUnidad`: extraer las tres reglas de fecha que comparten, y sumar beneficiario, unidad de origen coincidente y destino dentro de `destinosDelPase`. Verificar con tests de cada rechazo y con `vinculos.test.ts` verde.
- [x] 1.4 Exportar desde `packages/personas/src/dominio/index.ts` y verificar que `bun run check` pasa, incluida la regla de portabilidad.

## 2. Servidor

- [x] 2.1 `registrarPases(alcance, grupoId, fecha, pases)` en el servicio de `personas`, al lado de `cambiarDeUnidad` y con su mismo patrón: política `puedeAdministrarPlantelDeGrupo`, `validarPase` contra las pertenencias vigentes y las unidades de `estructura`, y una sola `core.bd.transaction` para todo el lote que cierra cada vigente con `laVispera(fecha)` y abre la nueva con la categoría del pase. Verificar con `servicio.test.ts`: pase feliz, historia consultable por fecha con `miembrosDelGrupo`, todo o nada, pase a dirigente con rol `dirigente` en `funcionesVigentes`, y sin permiso.
- [x] 2.2 Mutation `registrarPases` en `packages/personas/src/servidor/schema.ts` que lanza ante problemas y devuelve las pertenencias nuevas. Verificar con un test de GraphQL o del esquema, y regenerar con `bun run schema` y commitear `schema.gql`.
- [x] 2.3 Hook `useRegistrarPases` en `packages/api` y `bun run --filter @gps/api codegen`; verificar que compila con `bun run check`.

## 3. Web

- [x] 3.1 Pantalla `apps/web/src/pantallas/Pases.tsx` en `/grupos/:id/pases`: fecha, unidades elegibles, bloques "Cumplen" y "Cerca" por unidad, filas de 72px con destino en `Filtros` cuando hay más de uno, botón deshabilitado con filas tildadas sin destino, `Nota` si no tiene permiso. Verificar a 375px en el navegador con datos del demo: una Manada con candidatos pasa a la Tropa y la Nómina los muestra en la unidad nueva.
- [x] 3.2 Acceso "Ceremonia de pases" desde `Nomina.tsx`, visible sólo con `puedeAdministrarPlantelDeGrupo`. Verificar navegando desde la Nómina.
- [x] 3.3 Revisar que la ficha de persona (`Persona.tsx`) siga ofreciendo el cambio de unidad sólo a los dirigentes y que el beneficiario apunte a la ceremonia. Verificar abriendo la ficha de un lobato y la de un dirigente.

## 4. Mobile

- [x] 4.1 Pantalla `apps/mobile/app/grupos/[id]/pases.tsx` con las piezas de `apps/mobile/src/ui.tsx` y el mismo orden de bloques, alturas y pie que la web. Verificar en Expo con el mismo caso del demo y comparar lado a lado con la web angosta.
- [x] 4.2 Acceso desde `apps/mobile/app/grupos/[id]/nomina.tsx` con la misma política. Verificar navegando.

## 5. Cierre

- [x] 5.1 Sembrar en `packages/demo` al menos un lobato de 10 años, uno a punto de cumplirlos y un grupo con dos tropas scout, y verificar que `bun run demo` muestra los tres casos en la ceremonia.
- [x] 5.2 Actualizar `CLAUDE.md` (sacar el pase de la deuda implícita, mencionar `pases.ts` como ejemplo si corresponde) y `docs/arquitectura.md`; verificar `bun run check` verde.
