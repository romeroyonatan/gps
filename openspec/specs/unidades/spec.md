# unidades

## Purpose

Las unidades en que se subdivide un grupo scout —la Manada, las dos Tropas, el Clan—, cada
una de una rama y con su sexo y su nombre, y la pertenencia de las personas a ellas.

## Requirements

### Requirement: Cómo se llama la unidad de cada rama
Cada rama SHALL declarar el nombre del tipo de unidad que le corresponde: Castores es
Colonia, Lobatos es Manada, Scouts es Tropa scout, Raiders es Tropa raider, Rovers es Clan y
Adultos es Tropa.

#### Scenario: Nombre del tipo
- **WHEN** se pide el tipo de unidad de la rama Scouts
- **THEN** es "Tropa scout"

### Requirement: Abrir una unidad
El sistema SHALL permitir abrir una unidad en un grupo abierto, indicando su rama, su sexo
—masculina, femenina o mixta— y su nombre. El nombre MUST estar presente y no ser sólo
espacios. Dos unidades abiertas del mismo grupo MUST NOT tener la misma rama y el mismo
nombre.

#### Scenario: Dos tropas scout
- **WHEN** se abren en un grupo dos unidades de rama Scouts, una femenina llamada "Santa Juana" y una masculina llamada "San Jorge"
- **THEN** las dos quedan abiertas en ese grupo

#### Scenario: Dos unidades iguales
- **WHEN** se abre una unidad de rama Scouts con un nombre que ya tiene otra unidad abierta de rama Scouts en el mismo grupo
- **THEN** el sistema rechaza la operación

#### Scenario: Mismo nombre en otra rama
- **WHEN** se abre una Tropa raider "San Jorge" en un grupo que ya tiene una Tropa scout "San Jorge"
- **THEN** las dos quedan abiertas

#### Scenario: Sin nombre
- **WHEN** se abre una unidad con el nombre vacío o en blanco
- **THEN** el sistema rechaza la operación

#### Scenario: Grupo cerrado
- **WHEN** se abre una unidad en un grupo cerrado o inexistente
- **THEN** el sistema rechaza la operación

### Requirement: Nombre para mostrar
El sistema SHALL componer el nombre para mostrar de una unidad con el tipo de unidad de su
rama, su nombre propio y su sexo, y SHALL exponerlo para que las pantallas no lo compongan
cada una a su manera.

#### Scenario: Composición
- **WHEN** se muestra una unidad de rama Scouts, femenina, llamada "Santa Juana"
- **THEN** se lee "Tropa scout Santa Juana · femenina"

### Requirement: Cerrar una unidad
El sistema SHALL permitir cerrar una unidad abierta. Una unidad cerrada MUST NOT admitir
pertenencias nuevas y MUST NOT aparecer entre las unidades del grupo, y su rama y su nombre
SHALL quedar libres para abrir otra unidad igual.

#### Scenario: Cierre
- **WHEN** se cierra una unidad abierta
- **THEN** deja de aparecer entre las unidades del grupo

#### Scenario: Reabrir con el mismo nombre
- **WHEN** se abre una unidad con la misma rama y el mismo nombre que una unidad ya cerrada del grupo
- **THEN** la operación se acepta

#### Scenario: Ingreso a una unidad cerrada
- **WHEN** se da de alta a una persona en una unidad cerrada
- **THEN** el sistema rechaza la operación

### Requirement: La persona pertenece a una unidad
Una pertenencia de categoría beneficiario o activo SHALL indicar una unidad abierta del
grupo, y su rama SHALL derivarse de esa unidad. Una pertenencia de categoría adherente MUST
NOT indicar unidad. Quién va a qué unidad lo deciden los dirigentes: el sistema MUST NOT
rechazar ni sugerir una unidad a partir de datos de la persona.

#### Scenario: Alta en una unidad
- **WHEN** se da de alta a un beneficiario en la Tropa scout "Santa Juana"
- **THEN** su pertenencia queda en esa unidad y su rama es Scouts

#### Scenario: Beneficiario sin unidad
- **WHEN** se da de alta a un beneficiario sin indicar unidad
- **THEN** el sistema rechaza la operación

#### Scenario: Adherente con unidad
- **WHEN** se da de alta a un adherente indicando una unidad
- **THEN** el sistema rechaza la operación

#### Scenario: Unidad de otro grupo
- **WHEN** se da de alta a una persona en una unidad que no es del grupo al que ingresa
- **THEN** el sistema rechaza la operación

#### Scenario: Cualquiera en cualquier unidad
- **WHEN** se da de alta a una persona en una unidad masculina y en otra ocasión en una femenina
- **THEN** el sistema acepta las dos sin objetar nada sobre la persona

### Requirement: Las unidades del grupo
El sistema SHALL devolver, para un grupo, sus unidades abiertas con su rama, su sexo y su
nombre. Cuánta gente tiene cada una no se devuelve acá: quien pregunta por las unidades no
conoce a las personas, y las pantallas ya reciben la nómina del grupo y agrupan por unidad.

#### Scenario: Listado
- **WHEN** se consulta un grupo con una Manada y dos Tropas scout
- **THEN** se devuelven las tres con su rama, su sexo y su nombre

### Requirement: Las ramas abiertas se derivan
Las ramas abiertas de un grupo SHALL ser las ramas de sus unidades abiertas, sin repetir.

#### Scenario: Dos unidades de la misma rama
- **WHEN** un grupo tiene dos Tropas scout y una Manada
- **THEN** sus ramas abiertas son Scouts y Lobatos

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
