## Why

GPS registra algunos cambios de autoridad y seguridad en tablas separadas, pero no deja un rastro uniforme de las demás escrituras. Esto impide reconstruir quién cambió un dato, entender ediciones en conflicto y consultar la actividad de un grupo desde un único lugar.

## What Changes

- Incorporar un módulo de auditoría con un registro permanente y de sólo agregado para las escrituras realizadas por personas.
- Registrar actor, instante, módulo, acción, uso de elevación, grupo y entidad afectada; las ediciones conservan los valores anteriores y nuevos, mientras altas, anulaciones, firmas y otras acciones discretas guardan un resumen estructurado.
- Registrar intentos fallidos únicamente para acciones sensibles, como elevación, recuperación, reasignación administrativa y escrituras elevadas rechazadas.
- Unificar en la consulta de auditoría los cambios de negocio con los eventos existentes de autoridad y seguridad, sin copiar argumentos GraphQL completos, secretos ni trazos de firma.
- Permitir a Jefatura y Secretaría consultar la auditoría de sus grupos, y al administrador con elevación vigente consultar toda la diócesis.
- Exponer filtros por fecha, grupo, actor, módulo y acción.
- Mantener cinco destinos en la navegación angosta: Principal, Nómina, Salidas, Tesorería y Más. La pantalla Más contiene Plantel y Auditoría; en escritorio ambos destinos permanecen visibles directamente.

## Capabilities

### New Capabilities
- `auditoria`: Registro, consulta, autorización y presentación de acciones auditables.

### Modified Capabilities
- `autenticacion-federada`: Ampliar la auditoría de seguridad para incluir intentos sensibles rechazados y hacer consultables los eventos de elevación y recuperación en el registro unificado.

## Impact

Afecta la composición de módulos y GraphQL, las escrituras de los módulos actuales, los eventos existentes de `auth` y `personas`, el cliente API generado y las navegaciones y pantallas de web y mobile. Agrega tablas y migraciones SQLite del módulo de auditoría, sin servicios externos ni dependencias nuevas.
