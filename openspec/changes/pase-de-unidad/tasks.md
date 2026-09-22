## 1. Dominio

- [ ] 1.1 `destinosDelPase` en `packages/personas/src/dominio/pases.ts`: rama siguiente por orden de `RAMAS`, Clan con Adultos y dirigente en cualquier unidad, Adultos sin destinos, propuesto por mismo sexo. Verificar con `packages/personas/test/pases.test.ts` cubriendo los escenarios de "Destinos del pase".
- [ ] 1.2 `candidatosAlPase` en el mismo archivo: cumplen y cercanos (12 meses) a la fecha del pase con `calcularEdad`, sólo beneficiarios. Verificar con tests de los escenarios de "Candidatos al pase", incluidos la víspera y el día del cumpleaños.
- [ ] 1.3 `validarPase` devolviendo `Problema[]`: fecha real, no futura, posterior al `desde` vigente, beneficiario, unidad de origen coincidente, destino dentro de `destinosDelPase`. Verificar con tests de cada rechazo.
- [ ] 1.4 Exportar desde `packages/personas/src/dominio/index.ts` y verificar que `bun run check` pasa, incluida la regla de portabilidad.

## 2. Servidor

- [ ] 2.1 `registrarPases(actor, grupoId, fecha, pases)` en el servicio de `personas`: política `puedeAdministrarPlantelDeGrupo`, `validarPase` contra las pertenencias vigentes y las unidades de `estructura`, y en una `core.bd.transaction` cerrar cada vigente con `hasta` = día anterior y abrir la nueva. Verificar con `servicio.test.ts`: pase feliz, historia consultable por fecha con `miembrosDelGrupo`, todo o nada, pase a dirigente con rol `dirigente` en `funcionesVigentes`, y sin permiso.
- [ ] 2.2 Mutation `registrarPases` en `packages/personas/src/servidor/schema.ts` que lanza ante problemas y devuelve las pertenencias nuevas. Verificar con un test de GraphQL o del esquema, y regenerar con `bun run schema` y commitear `schema.gql`.
- [ ] 2.3 Hook `useRegistrarPases` en `packages/api` y `bun run --filter @gps/api codegen`; verificar que compila con `bun run check`.

## 3. Web

- [ ] 3.1 Pantalla `apps/web/src/pantallas/Pases.tsx` en `/grupos/:id/pases`: fecha, unidades elegibles, bloques "Cumplen" y "Cerca" por unidad, filas de 72px con destino en `Filtros` cuando hay más de uno, botón deshabilitado con filas tildadas sin destino, `Nota` si no tiene permiso. Verificar a 375px en el navegador con datos del demo: una Manada con candidatos pasa a la Tropa y la Nómina los muestra en la unidad nueva.
- [ ] 3.2 Acceso "Ceremonia de pases" desde `Nomina.tsx`, visible sólo con `puedeAdministrarPlantelDeGrupo`. Verificar navegando desde la Nómina.

## 4. Mobile

- [ ] 4.1 Pantalla `apps/mobile/app/grupos/[id]/pases.tsx` con las piezas de `apps/mobile/src/ui.tsx` y el mismo orden de bloques, alturas y pie que la web. Verificar en Expo con el mismo caso del demo y comparar lado a lado con la web angosta.
- [ ] 4.2 Acceso desde `apps/mobile/app/grupos/[id]/nomina.tsx` con la misma política. Verificar navegando.

## 5. Cierre

- [ ] 5.1 Sembrar en `packages/demo` al menos un lobato de 10 años, uno a punto de cumplirlos y un grupo con dos tropas scout, y verificar que `bun run demo` muestra los tres casos en la ceremonia.
- [ ] 5.2 Actualizar `CLAUDE.md` (sacar el pase de la deuda implícita, mencionar `pases.ts` como ejemplo si corresponde) y `docs/arquitectura.md`; verificar `bun run check` verde.
