## 1. Comunicación y fronteras entre módulos

- [x] 1.1 Agregar a `@gps/core` el bus de eventos en proceso, sincrónico y tipado, incorporarlo a `Core` y verificar publicación, múltiples suscriptores y propagación de errores con tests de core.
- [x] 1.2 Declarar `AfiliacionDeclarada`, publicarlo después de confirmar cada declaración y verificar con tests que un suscriptor fallido se registra pero no revierte ni hace fallar la declaración.
- [x] 1.3 Crear la interfaz pública mínima de Afiliación para listar declaraciones y sus afiliados cobrables, ampliar la interfaz pública de Estructura para listar todos los grupos conocidos y verificar ambas lecturas con sus tests de servicio.

## 2. Dominio y persistencia de Tesorería

- [x] 2.1 Crear `packages/tesoreria` con modelos y reglas puras para cuotas, medios de pago, movimientos y saldos; verificar con tests pagos parciales, totales, saldo a favor e importes inválidos.
- [x] 2.2 Declarar las tablas de cuotas y movimientos con restricciones de importes, orígenes y anulaciones, generar la migración Drizzle y verificar con tests que la base rechaza cargos duplicados y anulaciones duplicadas.
- [x] 2.3 Implementar la configuración y consulta histórica de cuotas, bloqueando cambios después de su primer cargo, y verificar los casos permitidos y rechazados con tests del servicio.

## 3. Cargos, pagos y cuentas corrientes

- [x] 3.1 Implementar el caso de uso idempotente que genera un cargo desde una declaración y verificar cantidad por cuota, ausencia de cuota y repetición de la misma declaración con tests del servicio.
- [x] 3.2 Suscribir Tesorería a `AfiliacionDeclarada` y verificar con un test de integración que una declaración genera su cargo cuando hay cuota y queda reconciliable cuando no la hay.
- [x] 3.3 Implementar el resumen y la reconciliación manual de declaraciones sin cargo, reutilizando la generación idempotente, y verificar cargos creados y períodos sin cuota con tests.
- [x] 3.4 Implementar registro y anulación de pagos, impidiendo importes inválidos y anulaciones repetidas, y verificar que sólo se agregan movimientos y nunca se reescribe el original.
- [x] 3.5 Implementar detalle cronológico, saldo por grupo y resumen de todos los grupos con cero, deuda o saldo a favor; verificar sumas, orden y grupos sin movimientos con tests.

## 4. Esquema y cliente compartido

- [x] 4.1 Registrar el módulo en `services/backend/src/modules.ts`, exponer cuotas, cuentas, pendientes, definición de cuota, pagos, anulaciones y reconciliación en GraphQL, y verificar errores de negocio y composición con tests de schema.
- [x] 4.2 Agregar documentos y hooks de Tesorería en `packages/api`, regenerar el cliente y verificar compilación e invalidación de las queries afectadas después de cada mutation.
- [x] 4.3 Regenerar y commitear `schema.gql`, verificando que sus tipos y operaciones reflejen el contrato de Tesorería.

## 5. Pantallas mobile-first

- [x] 5.1 Crear la pantalla web de Tesorería con todos los grupos, filtros rápidos, cuotas y el botón condicional de deudas pendientes; verificar a 375 px que el botón sólo aparece cuando el resumen informa pendientes.
- [x] 5.2 Crear el detalle web de cuenta con movimientos, saldo, registro y anulación de pagos; verificar manualmente pagos parciales, saldo a favor y anulación usando el backend demo.
- [x] 5.3 Crear las pantallas equivalentes en mobile y agregar navegación directa a Tesorería en ambas aplicaciones; verificar a 375 px los mismos estados vacíos, de carga y error que en web.

## 6. Demo y verificación final

- [x] 6.1 Extender el escenario demo con una cuota, cargos automáticos, un pago parcial y un saldo a favor, y verificar que la siembra use únicamente servicios públicos.
- [x] 6.2 Actualizar `docs/arquitectura.md` para reflejar el bus y Tesorería ya implementados, eliminando las notas que los describen como futuros, y verificar que el diagrama coincida con las dependencias registradas.
- [x] 6.3 Ejecutar `bun run check` y `openspec validate gestionar-cuentas-corrientes-de-grupos --strict`, corrigiendo cualquier fallo antes de dar la implementación por terminada.

## 7. Corrección de configuración de cuotas

- [x] 7.1 Exponer y validar en el servicio los períodos configurables —actual, siguiente y pendientes— y verificar que un período arbitrario sea rechazado.
- [x] 7.2 Mover cuotas a una pantalla de configuración web con selector de períodos y verificar que Tesorería sólo conserve el acceso a esa pantalla.
- [x] 7.3 Crear la pantalla equivalente en mobile y ejecutar `bun run check` y la validación estricta de OpenSpec.
