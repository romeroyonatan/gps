## Purpose

Controlar la activación y la recuperación de identidades externas mediante enlaces secretos de un solo uso emitidos por autoridades del ámbito de una persona.

## ADDED Requirements

### Requirement: Invitación para una persona existente
El sistema SHALL crear invitaciones únicamente para una `Persona` existente y MUST asociar cada invitación con esa persona antes de generar el enlace.

#### Scenario: Activación inicial
- **WHEN** una autoridad crea una invitación para una persona sin identidades y ésta completa Google o Apple desde el enlace
- **THEN** el sistema vincula la identidad externa con la persona indicada y crea su sesión

#### Scenario: Persona inexistente
- **WHEN** se intenta crear una invitación sin una persona existente
- **THEN** el sistema rechaza la operación

### Requirement: Enlaces manuales secretos
El sistema SHALL entregar al emisor un enlace apto para compartir manualmente, sin enviar correo, y el enlace MUST ser impredecible, revocable, de un solo uso y con vencimiento limitado.

#### Scenario: Uso único
- **WHEN** una invitación vigente se consume correctamente
- **THEN** cualquier intento posterior con el mismo enlace es rechazado

#### Scenario: Invitación inválida
- **WHEN** el enlace no existe, venció o fue revocado
- **THEN** el sistema no vincula ni reemplaza ninguna identidad

### Requirement: Emisión limitada por ámbito
El sistema MUST autorizar la emisión de invitaciones según la función vigente del emisor y el ámbito de la persona destinataria.

#### Scenario: Invitación de grupo autorizada
- **WHEN** un jefe o integrante de Secretaría invita a una persona que pertenece a su mismo grupo
- **THEN** el sistema crea la invitación

#### Scenario: Invitación diocesana autorizada
- **WHEN** el jefe scout diocesano o un integrante de Administración diocesana invita a una persona para una función diocesana
- **THEN** el sistema crea la invitación

#### Scenario: Invitación fuera del ámbito
- **WHEN** una autoridad intenta invitar a una persona fuera de su ámbito
- **THEN** el sistema rechaza la operación

#### Scenario: Invitación administrativa
- **WHEN** el administrador con elevación vigente invita a cualquier persona existente
- **THEN** el sistema crea la invitación sin restricción de ámbito

### Requirement: Recuperación asistida de un proveedor perdido
El sistema SHALL emitir una invitación de recuperación que identifique de antemano a la persona y al proveedor que será reemplazado. Al consumirla MUST desactivar la identidad anterior de ese proveedor, vincular la nueva y revocar todas las sesiones de la persona en una única operación.

#### Scenario: Reemplazo de Google
- **WHEN** María consume una recuperación de Google autenticándose con una nueva cuenta de Google
- **THEN** la nueva cuenta queda vinculada a María, la anterior deja de iniciar sesión y todas las sesiones previas de María quedan revocadas

#### Scenario: Falla durante el reemplazo
- **WHEN** alguna parte del reemplazo de identidad no puede completarse
- **THEN** la identidad anterior y las sesiones conservan su estado previo y la nueva identidad no queda vinculada

### Requirement: La recuperación conserva otros proveedores y los hechos del negocio
La recuperación MUST reemplazar sólo el proveedor indicado y MUST conservar las demás identidades, los cargos, los equipos y el historial de la persona.

#### Scenario: Google perdido con Apple vigente
- **WHEN** una persona con Google y Apple vinculados recupera Google
- **THEN** Apple permanece vinculado y sus hechos organizativos no cambian

#### Scenario: Recuperación autónoma mediante otro proveedor
- **WHEN** una persona puede iniciar sesión con Apple aunque perdió Google
- **THEN** puede reemplazar Google desde su sesión sin una invitación asistida

### Requirement: Autoridad para recuperar identidades
El sistema MUST aplicar a las recuperaciones asistidas las mismas fronteras organizativas de las invitaciones y MUST permitir que jefatura y Secretaría recuperen personas de su grupo, que jefatura scout y Administración diocesanas recuperen personas de su ámbito, y que el administrador elevado recupere cualquier persona.

#### Scenario: Secretaría recupera una persona de su grupo
- **WHEN** una integrante vigente de Secretaría emite una recuperación para una persona de su grupo
- **THEN** el sistema permite crear el enlace

#### Scenario: Recuperación fuera del ámbito
- **WHEN** una autoridad intenta recuperar una persona fuera de su ámbito
- **THEN** el sistema rechaza la operación

### Requirement: Trazabilidad de identidades e invitaciones
El sistema MUST conservar el historial de identidades desactivadas y registrar quién emitió, revocó o consumió una invitación o recuperación y cuándo ocurrió.

#### Scenario: Identidad reemplazada
- **WHEN** una recuperación termina correctamente
- **THEN** la identidad anterior permanece desactivada y trazable sin poder volver a autenticarse
