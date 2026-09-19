# autorizacion-organizativa

## Purpose

Derivar el acceso efectivo de cargos y equipos vigentes, aplicándolo por función y ámbito sin mantener permisos manuales por persona.

## Requirements

### Requirement: Denegación por defecto y autorización en capas
Cada módulo MUST negar el acceso que no declare expresamente y MUST aplicar autorización al acceso al módulo, a los registros del ámbito, a los campos sensibles y a cada operación de escritura.

#### Scenario: Módulo sin política aplicable
- **WHEN** una persona intenta acceder a un módulo sin una función expresamente permitida
- **THEN** el sistema deniega el acceso antes de devolver datos

#### Scenario: Registro fuera del ámbito
- **WHEN** una función habilitada intenta leer o modificar un registro fuera de su ámbito
- **THEN** el sistema no devuelve ni modifica ese registro, salvo el directorio de la asociación

#### Scenario: Campo denegado dentro de una consulta permitida
- **WHEN** una consulta pide en el mismo pedido un campo permitido y otro denegado para quien pregunta
- **THEN** el sistema devuelve el permitido y vacía únicamente el denegado, sin anular la respuesta entera

### Requirement: El directorio de la asociación es común
El sistema SHALL mostrar a cualquier persona autenticada qué distritos y qué grupos
existen, y quién conduce cada grupo. Saber que un grupo existe y quién lo dirige no es un
dato de ese grupo: es lo que permite ubicarse en la asociación y saber a quién dirigirse.
Los datos de un grupo —su gente, su cuenta corriente, sus salidas— MUST seguir limitados
al ámbito de quien pregunta.

#### Scenario: Jefatura de un grupo mirando la diócesis
- **WHEN** un jefe de grupo consulta el árbol de distritos
- **THEN** ve todos los distritos y todos los grupos abiertos, con el nombre de sus jefes

#### Scenario: Detalle de un grupo ajeno
- **WHEN** esa misma persona pide las personas, la cuenta corriente o las salidas de otro grupo
- **THEN** el sistema no devuelve ninguno de esos datos

### Requirement: Acceso derivado de hechos vigentes
El sistema MUST derivar los roles y ámbitos efectivos en cada request a partir de cargos, pertenencias a equipos y pertenencias de grupo vigentes, sin asignar permisos manuales a cada persona.

#### Scenario: Cargo finalizado
- **WHEN** finaliza un cargo que concedía acceso
- **THEN** la persona pierde ese acceso en su siguiente request

#### Scenario: Persona con varias funciones
- **WHEN** una persona tiene varias funciones vigentes
- **THEN** el alcance efectivo reúne los ámbitos y capacidades concedidos por todas ellas

### Requirement: Secretaría pertenece a un único grupo y admite varios integrantes
El sistema SHALL permitir varios integrantes simultáneos en Secretaría de un grupo, pero cada integrante MUST tener pertenencia vigente a ese mismo grupo y su función MUST limitarse a él.

#### Scenario: Varios secretarios
- **WHEN** dos o más personas del grupo integran Secretaría simultáneamente
- **THEN** todas obtienen las capacidades de Secretaría sobre ese grupo

#### Scenario: Fin de pertenencia al grupo
- **WHEN** termina la pertenencia al grupo de una integrante de Secretaría
- **THEN** pierde inmediatamente el acceso derivado de Secretaría aunque se conserve el historial del equipo

#### Scenario: Secretaría en grupo ajeno
- **WHEN** se intenta incorporar a Secretaría una persona que no pertenece al grupo
- **THEN** el sistema rechaza la operación

### Requirement: Administración del plantel de grupo
Un jefe de grupo SHALL poder modificar el plantel de su grupo, incluida Secretaría y otras jefaturas. Cada integrante de Secretaría SHALL poder nombrar o remover jefes de su grupo de manera individual. El sistema SHALL permitir que el grupo quede temporalmente sin jefe.

#### Scenario: Jefe nombra otro jefe
- **WHEN** un jefe vigente nombra a otra persona elegible como jefe de su grupo
- **THEN** el nuevo cargo concede acceso en ese grupo

#### Scenario: Secretaría cubre una vacancia
- **WHEN** un integrante vigente de Secretaría nombra un jefe en un grupo sin jefatura
- **THEN** el nuevo jefe obtiene las capacidades correspondientes

#### Scenario: Remoción del último jefe
- **WHEN** una autoridad habilitada remueve al último jefe del grupo
- **THEN** el sistema conserva el grupo sin jefatura y Secretaría puede nombrar al siguiente

### Requirement: Capacidades de jefatura y Secretaría
Jefatura y Secretaría SHALL poder gestionar personas, datos, plantel, cargos y afiliación de su propio grupo. MUST NOT obtener por esas funciones acceso equivalente sobre otro grupo.

#### Scenario: Administración del propio grupo
- **WHEN** un jefe o integrante de Secretaría modifica datos de su grupo
- **THEN** el sistema permite la operación si la política específica del módulo la contempla

#### Scenario: Administración de otro grupo
- **WHEN** intenta realizar la misma operación sobre otro grupo
- **THEN** el sistema la deniega

### Requirement: Separación entre lectura y escritura de Tesorería
Jefatura y Secretaría SHALL poder ver el saldo, la cuenta corriente y el registro de pagos de su grupo, pero MUST NOT crear, editar ni eliminar registros de pago. Sólo Tesorería diocesana SHALL registrar pagos.

#### Scenario: Secretaría consulta la cuenta corriente
- **WHEN** Secretaría consulta la cuenta de su grupo
- **THEN** el sistema devuelve el saldo y el registro de pagos

#### Scenario: Secretaría intenta registrar un pago
- **WHEN** Jefatura o Secretaría intenta crear un registro de pago
- **THEN** el sistema deniega la operación

#### Scenario: Tesorería registra un pago
- **WHEN** un integrante vigente de Tesorería diocesana registra un pago de cualquier grupo de la diócesis
- **THEN** el sistema permite la operación

### Requirement: Administración de equipos diocesanos
El jefe scout diocesano, Administración diocesana y el administrador elevado SHALL poder nombrar o remover integrantes de Tesorería diocesana. El jefe scout diocesano y Administración diocesana SHALL poder gestionar entre sí sus transiciones, y el administrador elevado SHALL actuar como recuperación final.

#### Scenario: Administración incorpora a Tesorería
- **WHEN** una integrante vigente de Administración diocesana incorpora una persona a Tesorería diocesana
- **THEN** la persona obtiene capacidad para consultar y registrar pagos de todos los grupos

#### Scenario: Transición de autoridad diocesana
- **WHEN** el jefe scout diocesano o Administración diocesana nombra o remueve una autoridad diocesana permitida
- **THEN** el acceso cambia según la nueva vigencia

#### Scenario: Recuperación administrativa
- **WHEN** no queda autoridad diocesana capaz de restaurar el equipo
- **THEN** el administrador elevado puede nombrar las nuevas autoridades

### Requirement: Autorización de salidas y sus archivos
Jefatura y Secretaría SHALL poder crear, editar, emitir, anular, ver y descargar los permisos de salida y sus PDF únicamente para su grupo. Una firma en la app MUST ser registrada por la persona que ocupa el cargo firmante vigente en el ámbito del permiso; el jefe de grupo, el director y el comisionado distrital SHALL poder ver el permiso y PDF que necesitan firmar. Jefatura y Secretaría SHALL poder registrar las firmas recibidas en papel. Los archivos y rutas de descarga MUST aplicar el mismo alcance que las operaciones GraphQL.

#### Scenario: Secretaría descarga un permiso de su grupo
- **WHEN** una integrante vigente de Secretaría solicita el PDF de un permiso de su grupo
- **THEN** el sistema permite verlo y descargarlo

#### Scenario: Firma del ocupante vigente
- **WHEN** la persona autenticada ocupa el cargo requerido en el ámbito del permiso y registra su firma en la app
- **THEN** el sistema acepta la firma para ese cargo

#### Scenario: Firma con identidad ajena
- **WHEN** una persona intenta firmar en la app por un cargo que no ocupa
- **THEN** el sistema rechaza la firma aunque el cargo tenga otro ocupante vigente

#### Scenario: Salida de otro ámbito
- **WHEN** una persona intenta consultar, modificar, firmar o descargar archivos de una salida fuera de su ámbito
- **THEN** el sistema deniega la operación sin revelar los datos del permiso

### Requirement: Auditoría de cambios de autoridad
El sistema MUST registrar quién, cuándo y sobre quién realizó todo nombramiento o remoción de jefaturas, Secretaría, autoridades diocesanas y equipos con acceso.

#### Scenario: Nombramiento de jefe
- **WHEN** una autoridad nombra un jefe de grupo
- **THEN** la auditoría identifica al actor, la persona nombrada, el grupo y el instante
