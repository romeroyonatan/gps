## Purpose

Administrar la deuda y los pagos externos de cada grupo mediante una cuenta corriente auditable, alimentada por las declaraciones de Afiliación.

## ADDED Requirements

### Requirement: Cuota por período de afiliación
El sistema SHALL permitir definir un único importe de afiliación, expresado en pesos enteros positivos, para cada período de afiliación. SHALL conservar los importes de períodos anteriores y SHALL impedir que cambiar una cuota altere cargos ya generados.

#### Scenario: Configurar la cuota de un período nuevo
- **WHEN** Tesorería abre la pantalla específica de configuración
- **THEN** el sistema ofrece únicamente el período actual, el siguiente y períodos de declaraciones pendientes que todavía puedan configurarse
- **WHEN** Tesorería define una cuota de 20000 pesos para uno de esos períodos
- **THEN** el sistema conserva 20000 como la cuota aplicable a las declaraciones de ese período

#### Scenario: Rechazar un período arbitrario
- **WHEN** se intenta definir una cuota para un período que no pertenece a las opciones configurables
- **THEN** el sistema rechaza la operación aunque se invoque directamente mediante la API

#### Scenario: Consultar cuotas históricas
- **WHEN** existen cuotas para varios períodos
- **THEN** el sistema muestra cada período con el importe que le corresponde

#### Scenario: Proteger una cuota ya utilizada
- **WHEN** Tesorería intenta modificar la cuota de un período que ya tiene cargos
- **THEN** el sistema rechaza la modificación y mantiene intactos los cargos existentes

### Requirement: Cargo por declaración de afiliación
Por cada declaración, el sistema SHALL generar como máximo un cargo para el grupo por la cantidad de afiliados cobrables multiplicada por la cuota de su período. El cargo SHALL conservar la declaración de origen, la cantidad, la cuota aplicada y el total.

#### Scenario: Generar un cargo automáticamente
- **WHEN** Afiliación declara 10 personas cobrables y el período tiene una cuota de 20000 pesos
- **THEN** Tesorería registra un único cargo de 200000 pesos para el grupo
- **THEN** el cargo conserva la cantidad 10 y la cuota aplicada de 20000 pesos

#### Scenario: No duplicar el cargo
- **WHEN** Tesorería recibe nuevamente la misma declaración
- **THEN** conserva un solo cargo vinculado con esa declaración

#### Scenario: Declaración sin deuda
- **WHEN** una declaración no contiene afiliados cobrables
- **THEN** Tesorería no registra un movimiento de importe cero
- **THEN** la declaración se considera procesada y no queda pendiente

#### Scenario: Declaración sin cuota configurada
- **WHEN** Afiliación guarda una declaración cuyo período no tiene cuota configurada
- **THEN** la declaración permanece guardada
- **THEN** Tesorería no genera un cargo incorrecto y deja la declaración pendiente de reconciliación

#### Scenario: Fallo de Tesorería durante una declaración
- **WHEN** Tesorería no puede procesar una declaración recién guardada
- **THEN** Afiliación conserva la declaración
- **THEN** la declaración puede recuperarse posteriormente mediante la reconciliación

### Requirement: Reconciliación de deudas pendientes
El sistema SHALL detectar declaraciones con afiliados cobrables que no tengan cargo y SHALL ofrecer una reconciliación manual e idempotente. Las declaraciones sin afiliados cobrables SHALL considerarse procesadas sin crear movimientos de importe cero. La acción de reconciliación SHALL mostrarse únicamente mientras existan declaraciones con deuda sin cargo.

#### Scenario: No hay declaraciones pendientes
- **WHEN** todas las declaraciones tienen su cargo
- **THEN** la pantalla de Tesorería no muestra la acción de generar deudas pendientes

#### Scenario: Reconciliar declaraciones pendientes
- **WHEN** existen declaraciones sin cargo y sus períodos tienen cuota configurada
- **THEN** la pantalla muestra cuántas deudas están pendientes
- **WHEN** Tesorería ejecuta la reconciliación
- **THEN** el sistema genera cada cargo faltante una sola vez e informa cuántos creó

#### Scenario: Reconciliar sin una cuota necesaria
- **WHEN** una declaración pendiente pertenece a un período sin cuota configurada
- **THEN** la acción permanece disponible
- **THEN** el sistema informa qué período debe configurarse y no genera un cargo para esa declaración

### Requirement: Registro de pagos externos
El sistema SHALL permitir registrar para un grupo un pago externo con fecha efectiva, importe positivo en pesos enteros, medio de pago, referencia opcional y observación opcional. Los medios iniciales SHALL ser transferencia, efectivo y otro.

#### Scenario: Pago parcial
- **WHEN** un grupo debe 200000 pesos y Tesorería registra un pago de 50000 pesos
- **THEN** la cuenta registra el pago y muestra un saldo deudor de 150000 pesos

#### Scenario: Pago total
- **WHEN** el pago registrado equivale al saldo deudor
- **THEN** la cuenta queda con saldo cero

#### Scenario: Pago superior a la deuda
- **WHEN** el pago registrado supera el saldo deudor
- **THEN** el sistema acepta el pago y muestra la diferencia como saldo a favor

#### Scenario: Importe inválido
- **WHEN** se intenta registrar un pago con importe cero, negativo o fraccionario
- **THEN** el sistema rechaza el pago sin agregar movimientos

### Requirement: Anulación inmutable de pagos
El sistema SHALL permitir anular un pago mediante un contramovimiento por su importe completo. SHALL conservar tanto el pago original como su anulación y SHALL impedir anular el mismo pago más de una vez.

#### Scenario: Anular un pago
- **WHEN** Tesorería anula un pago vigente de 50000 pesos
- **THEN** el sistema agrega un contramovimiento de 50000 pesos vinculado al pago
- **THEN** conserva el pago original y recalcula el saldo

#### Scenario: Evitar una segunda anulación
- **WHEN** Tesorería intenta anular un pago que ya fue anulado
- **THEN** el sistema rechaza la operación sin agregar otro movimiento

### Requirement: Cuenta corriente por grupo
El sistema SHALL calcular el saldo de cada grupo desde sus movimientos inmutables: los cargos y anulaciones aumentan la deuda, y los pagos la reducen. SHALL permitir saldo deudor, saldo cero y saldo a favor sin imputar pagos a cargos concretos.

#### Scenario: Consultar el detalle de una cuenta
- **WHEN** Tesorería abre la cuenta de un grupo
- **THEN** el sistema muestra sus cargos, pagos y anulaciones en orden cronológico
- **THEN** muestra el saldo resultante

#### Scenario: Cargo posterior a un saldo a favor
- **WHEN** un grupo con 10000 pesos a favor recibe un cargo de 30000 pesos
- **THEN** la cuenta muestra un saldo deudor de 20000 pesos sin realizar una imputación explícita

### Requirement: Resumen de cuentas de grupos
El sistema SHALL mostrar todos los grupos conocidos con su saldo corriente y SHALL ofrecer filtros rápidos para grupos con deuda, con saldo a favor y con saldo cero.

#### Scenario: Ver todos los grupos
- **WHEN** Tesorería abre su pantalla principal sin seleccionar un filtro
- **THEN** el sistema muestra todos los grupos, incluidos aquellos sin movimientos, con su saldo correspondiente

#### Scenario: Filtrar grupos con deuda
- **WHEN** Tesorería selecciona el filtro de grupos con deuda
- **THEN** el sistema muestra únicamente grupos cuyo saldo es deudor

#### Scenario: Filtrar grupos con saldo a favor
- **WHEN** Tesorería selecciona el filtro de saldo a favor
- **THEN** el sistema muestra únicamente grupos cuyo saldo favorece al grupo

#### Scenario: Filtrar grupos con saldo cero
- **WHEN** Tesorería selecciona el filtro de saldo cero
- **THEN** el sistema muestra únicamente grupos sin deuda ni crédito
