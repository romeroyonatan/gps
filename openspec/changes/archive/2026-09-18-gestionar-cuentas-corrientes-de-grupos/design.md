## Context

Afiliación ya conserva declaraciones y nóminas como fotografías inmutables, y `listarACobrar` determina qué personas todavía no fueron cobradas en el período. No existe infraestructura de eventos ni un módulo de Tesorería. `Core` concentra base, reloj e ids; los módulos se construyen en orden de dependencias y sólo comparten las interfaces públicas declaradas en `/dominio`.

La declaración no puede depender de que Tesorería esté configurada o disponible. A diferencia del diseño transaccional anticipado en la arquitectura, una falla al crear el cargo debe dejar la declaración confirmada y recuperable.

## Goals / Non-Goals

**Goals:**

- Mantener movimientos financieros inmutables y una regla de saldo fácil de auditar.
- Crear cargos nuevos automáticamente sin acoplar Afiliación con Tesorería.
- Recuperar de forma explícita e idempotente cualquier cargo faltante.
- Conservar el cálculo de cada cargo aunque luego cambien datos de referencia.
- Mantener el módulo portable entre SQLite de Bun y el futuro SQLite del teléfono.

**Non-Goals:**

- Contabilidad de partida doble, imputación de pagos o facturación.
- Pasarela de pagos, cuentas bancarias o archivos de comprobantes.
- Vencimientos, intereses, recargos o ajustes generales.
- Introducir colas, brokers, bandeja de salida o reintentos automáticos.

## Decisions

### 1. Tesorería será un módulo que depende de las interfaces públicas de Afiliación y Estructura

`packages/tesoreria` seguirá la estructura de los módulos existentes. Afiliación publicará una interfaz mínima para listar todas las declaraciones y obtener los afiliados cobrables de una declaración. Estructura publicará la lectura mínima de todos los grupos necesaria para mostrar incluso cuentas sin movimientos.

Tesorería no importará implementaciones `/servidor` ni tablas ajenas. La alternativa de consultar directamente las tablas de Afiliación o Estructura violaría sus fronteras privadas y duplicaría sus reglas.

### 2. Un bus tipado y en proceso notificará las declaraciones después de confirmarlas

`Core` incorporará un registro mínimo de eventos con `suscribir` y `publicar`; el mapa de eventos será ampliable por declaración de tipos. Afiliación publicará `AfiliacionDeclarada` por cada declaración una vez confirmada su transacción. Tesorería se suscribirá al construir su servicio.

La publicación se ejecutará en proceso, sin serialización ni infraestructura externa. Afiliación capturará y registrará los fallos de publicación sin revertir ni ocultar la declaración ya guardada. Esto satisface la decisión explícita de que Tesorería nunca frene Afiliación; la reconciliación es la garantía de recuperación.

Se descarta invocar `ctx.tesoreria` desde resolvers o desde el barrido del backend: hay varios puntos que generan declaraciones y esa coordinación sería fácil de omitir. También se descarta una cola persistente porque el escaneo de declaraciones sin cargo ya provee la recuperación requerida con menos infraestructura.

### 3. Una tabla de cuotas y una tabla de movimientos bastan

`cuotas_de_afiliacion` tendrá `periodo` como clave primaria e `importe` entero positivo. Una cuota podrá corregirse mientras no haya sido usada; después quedará bloqueada. Cada período conserva así su valor histórico sin rangos de fechas redundantes.

`movimientos_de_tesoreria` almacenará una unión discriminada por tipo:

- `cargo_afiliacion`: importe positivo, `declaracion_id` único, cantidad y cuota aplicada.
- `pago`: importe negativo, medio, referencia y observación.
- `anulacion_pago`: importe positivo y referencia única al pago anulado.

Todos tendrán id, grupo, fecha efectiva y marcas de creación. Las restricciones de base cubrirán unicidad e importes; el dominio validará la combinación de campos propia de cada tipo. Una sola tabla permite calcular saldos con `SUM(importe)` y ordenar un extracto sin ensamblar varias fuentes.

Se descartan una columna mutable de saldo, porque puede desincronizarse, y tablas separadas por tipo, porque agregan uniones sin aportar comportamiento para estos tres movimientos.

### 4. El cargo congela su cálculo y su origen

Al procesar una declaración, Tesorería usa `listarACobrar`, toma la cuota de su período y guarda cantidad, cuota e importe total. El índice único sobre `declaracion_id` vuelve idempotentes tanto el evento como la reconciliación. Los cambios posteriores de nombres, pertenencias o cuotas no reescriben el cargo.

Si una declaración no tiene afiliados cobrables, se considera procesada sin guardar un movimiento de importe cero. Si tiene cobrables pero falta la cuota, tampoco se crea un movimiento: la declaración permanece visible como pendiente. La cuota faltante es un estado recuperable, no un error de Afiliación.

### 5. El saldo usa una única convención de signo

Un saldo positivo representa deuda del grupo, cero representa cuenta cancelada y uno negativo representa saldo a favor. Cargos y anulaciones suman; pagos restan. Los pagos no se vinculan con cargos y los cargos futuros consumen naturalmente cualquier saldo a favor.

Los importes públicos se presentan como pesos enteros positivos junto con el tipo de movimiento; el signo es una convención interna del libro y no se solicita al usuario.

### 6. La reconciliación compara declaraciones con orígenes ya registrados

La consulta de pendientes toma las declaraciones de Afiliación sin `declaracion_id` presente en cargos y conserva sólo aquellas que tienen afiliados cobrables. La operación recorre ese conjunto y reutiliza exactamente el mismo caso de uso que atiende el evento. Devuelve cargos creados y períodos sin cuota; las declaraciones de deuda cero no quedan pendientes.

La pantalla consulta primero el resumen de pendientes. Renderiza `Generar N deudas pendientes` sólo cuando el total es mayor que cero; después de reconciliar invalida resumen, cuentas y detalle. No habrá barrido periódico: el evento cubre el camino normal y el botón cubre el troubleshooting solicitado.

### 7. GraphQL y las aplicaciones expondrán operaciones del negocio

El esquema agregará consultas para cuotas, cuentas, detalle y resumen de pendientes; y mutations para definir cuota, registrar pago, anular pago y reconciliar. `packages/api` contendrá los documentos generados y hooks compartidos.

Web y mobile tendrán una pantalla principal de Tesorería, filtros locales sobre la lista recibida, una pantalla de cuenta de grupo y una pantalla separada para configurar cuotas. El período no será texto libre: el servicio expondrá los períodos configurables calculados desde el reloj, las declaraciones y los cargos, y las aplicaciones sólo permitirán elegir entre ellos. Los formularios usarán controles nativos, importes numéricos enteros y diseños válidos primero a 375 px. La navegación principal agregará un acceso a Tesorería sin introducir un sistema general de menús.

## Risks / Trade-offs

- [El evento puede perderse si el proceso falla después de guardar la declaración] → La consulta de pendientes y la reconciliación idempotente reparan el estado.
- [Una cuota sin configurar deja deudas pendientes] → La pantalla mantiene visible la acción y enumera los períodos faltantes.
- [Calcular saldos con `SUM` recorre movimientos] → El volumen esperado es bajo; agregar saldos materializados sólo si una medición lo exige.
- [Una tabla discriminada admite columnas nulas] → Restricciones de base y constructores de dominio limitan combinaciones inválidas sin introducir tres tablas y uniones.
- [Listar todos los grupos incluye cuentas sin actividad] → Los filtros rápidos mantienen útil la operación diaria y cumplen la necesidad de localizar cualquier grupo.

## Migration Plan

1. Desplegar el bus, las interfaces públicas ampliadas y las migraciones de Tesorería.
2. Registrar el módulo después de sus dependencias mediante el ordenamiento existente.
3. Configurar la cuota de cada período relevante.
4. Usar la reconciliación para generar cargos de declaraciones preexistentes; no se realizará un backfill dentro de la migración porque requiere una decisión de cuota.
5. Para rollback, retirar pantallas y módulo conservando sus tablas; los datos financieros no se eliminan automáticamente.
