## 1. Reglas puras de dominio

- [x] 1.1 Extraer en Afiliación la selección y agrupación de nóminas declarables a una función pura bajo `src/dominio`, y verificar con tests directos los grupos cerrados, el grupo solicitado y las declaraciones ya existentes.
- [x] 1.2 Extraer en Estructura la regla pura de vigencia histórica de un grupo, incluido el día de cierre, y verificar sus límites con un test directo.

## 2. Casos de uso de Afiliación

- [x] 2.1 Separar las operaciones cohesivas de declaración y las consultas en archivos de servidor con nombres de negocio, dejando `servicio.ts` como contrato y composición, y verificar que los tests existentes de Afiliación pasan sin cambiar su API.
- [x] 2.2 Revisar imports y exports internos de Afiliación para evitar ampliar la interfaz pública del dominio, y verificar que TypeScript y los resolvers existentes compilan.

## 3. Convenciones de arquitectura

- [x] 3.1 Actualizar `docs/arquitectura.md` con la frontera entre reglas puras, orquestación de efectos y composición del servicio, incluyendo el criterio para evitar tanto servicios monolíticos como archivos ceremoniales.
- [x] 3.2 Actualizar `AGENT.md` para que la receta de módulos nuevos ubique decisiones puras en `/dominio` y separe casos de uso de `servicio.ts` cuando tengan complejidad real; verificar que `CLAUDE.md` siga apuntando al documento actualizado.

## 4. Verificación integral

- [x] 4.1 Ejecutar `bun run check` y corregir cualquier regresión de lint, tipos o tests.
- [x] 4.2 Ejecutar `bun run schema` y verificar que `schema.gql` no tenga cambios funcionales.
