## ADDED Requirements

### Requirement: Un dirigente cambia de unidad
La jefatura y la Secretaría del grupo SHALL poder pasar a una persona de categoría activo
a otra unidad abierta de su grupo a partir de una fecha. El cambio MUST cerrar la
pertenencia vigente el día anterior a esa fecha y abrir una nueva en la unidad elegida
desde esa fecha, en una sola operación, para que quede el historial y cualquier consulta a
una fecha pasada vea la unidad de ese día. La fecha MUST NOT ser futura y MUST ser
posterior al comienzo de la pertenencia vigente. Las personas de otra categoría MUST NOT
cambiar de unidad por esta vía: el pase de los beneficiarios es una ceremonia.

#### Scenario: Pase de la Manada a la Tropa
- **WHEN** la jefa del grupo pasa a un dirigente de la Manada a la Tropa scout desde hoy
- **THEN** la nómina lo muestra en la Tropa y su pertenencia anterior queda cerrada ayer

#### Scenario: Consulta al pasado
- **WHEN** después del pase se consultan los miembros del grupo a una fecha anterior
- **THEN** el dirigente aparece en la Manada

#### Scenario: Cargos y equipos intactos
- **WHEN** cambia de unidad un dirigente que es jefe de rama e integra Secretaría
- **THEN** conserva el cargo y el equipo

#### Scenario: Beneficiario
- **WHEN** se intenta cambiar de unidad a un beneficiario
- **THEN** el sistema rechaza la operación

#### Scenario: Misma unidad
- **WHEN** se elige la unidad en la que ya está
- **THEN** el sistema rechaza la operación

#### Scenario: Fecha futura
- **WHEN** se indica una fecha posterior a hoy
- **THEN** el sistema rechaza la operación

#### Scenario: Fecha anterior a la pertenencia vigente
- **WHEN** se indica una fecha igual o anterior al comienzo de la pertenencia vigente
- **THEN** el sistema rechaza la operación

#### Scenario: Unidad cerrada o de otro grupo
- **WHEN** se elige una unidad cerrada o de otro grupo
- **THEN** el sistema rechaza la operación
