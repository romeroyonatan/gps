## Purpose

Ver y corregir los datos personales de una persona del padrón de un grupo: documento,
nombres, apellidos, fecha de nacimiento, domicilio y teléfono de contacto.

## ADDED Requirements

### Requirement: Ver a una persona del grupo
El sistema SHALL mostrar, para una persona con pertenencia vigente a un grupo, sus datos
personales, su categoría, su unidad y la fecha desde la que está en ella, y sus cargos y
equipos vigentes. Sólo SHALL poder verla quien puede ver el padrón de ese grupo.

#### Scenario: Jefatura mira a una persona
- **WHEN** la jefa del grupo abre a una persona desde la nómina
- **THEN** ve su documento, su fecha de nacimiento con la edad, su domicilio, su teléfono, su unidad, sus cargos y sus equipos

#### Scenario: Adherente
- **WHEN** se abre a un adherente
- **THEN** la pertenencia no muestra unidad

#### Scenario: Comisionado
- **WHEN** el comisionado del distrito intenta ver a una persona de un grupo de su distrito
- **THEN** el sistema no la devuelve

### Requirement: Corregir los datos personales
La jefatura y la Secretaría del grupo SHALL poder corregir los datos personales de una
persona de su grupo, documento incluido. Los datos corregidos MUST cumplir las mismas
reglas que en el alta. Un tipo y número de documento que ya tiene otra persona MUST
rechazarse. Corregir los datos MUST NOT cambiar la pertenencia, los cargos ni los equipos.

#### Scenario: DNI mal tipeado
- **WHEN** la Secretaría corrige el número de DNI de una persona por uno que nadie tiene
- **THEN** la persona queda con el número nuevo y conserva su pertenencia y sus cargos

#### Scenario: Documento de otra persona
- **WHEN** se corrige el documento de una persona por el tipo y número de otra
- **THEN** el sistema rechaza la operación y dice que ya hay una persona con ese documento

#### Scenario: Mismo documento
- **WHEN** se corrige el domicilio de una persona sin tocar su documento
- **THEN** la operación se acepta

#### Scenario: Datos inválidos
- **WHEN** se deja vacío el apellido o se pone una fecha de nacimiento futura
- **THEN** el sistema rechaza la operación indicando el campo

#### Scenario: Persona de otro grupo
- **WHEN** la jefa de un grupo intenta corregir a una persona de otro grupo
- **THEN** el sistema deniega la operación
