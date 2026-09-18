## Why

Las reglas de negocio y los detalles de persistencia de cada módulo se concentran hoy en `servidor/servicio.ts`, lo que dificulta reconocer las decisiones del dominio y favorece que los módulos nuevos repitan esa estructura. La separación debe hacer evidente el negocio sin introducir repositorios, puertos ni abstracciones sin un consumidor real.

## What Changes

- Extraer de Afiliación las decisiones puras que hoy están embebidas en la orquestación de `declarar` y ubicarlas en `/dominio`.
- Separar los casos de uso con efectos y las consultas de Afiliación en archivos con nombres de negocio, manteniendo `servicio.ts` como contrato y composición del servicio.
- Aplicar en Estructura sólo separaciones que hagan visible una transición o regla de negocio; conservar juntas las operaciones CRUD triviales para evitar fragmentación ceremonial.
- Mantener Drizzle, transacciones, reloj, generación de identificadores y logging bajo `/servidor` y accesibles mediante `Core`.
- Actualizar `docs/arquitectura.md` y `AGENT.md` con el criterio para módulos nuevos: decisiones puras en `/dominio`, orquestación de efectos en `/servidor` y separación por caso de uso sólo cuando aporta claridad.
- Conservar las APIs públicas y el comportamiento observable existentes.

## Capabilities

### New Capabilities

Ninguna. Es una refactorización interna y una actualización de las convenciones de arquitectura.

### Modified Capabilities

Ninguna. No cambia ningún requisito funcional ni comportamiento observable.

## Impact

Afecta la organización interna de `packages/afiliacion`, potencialmente la separación mínima de `packages/estructura`, sus imports y tests, además de `docs/arquitectura.md` y `AGENT.md`. No cambia GraphQL, las interfaces públicas de los módulos, el schema generado, las tablas ni las dependencias externas.
