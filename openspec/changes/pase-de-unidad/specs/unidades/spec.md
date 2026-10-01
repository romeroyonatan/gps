## MODIFIED Requirements

### Requirement: La persona pertenece a una unidad
Una pertenencia de categoría beneficiario o activo SHALL indicar una unidad abierta del
grupo, y su rama SHALL derivarse de esa unidad. Una pertenencia de categoría adherente MUST
NOT indicar unidad. Quién va a qué unidad lo deciden los dirigentes: el sistema MAY proponer
una unidad a partir de la edad de la persona, pero MUST NOT rechazar una unidad a partir de
datos de la persona.

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

#### Scenario: Edad fuera del rango de la rama
- **WHEN** se da de alta a un beneficiario de 12 años en la Manada
- **THEN** el sistema acepta la operación

## ADDED Requirements

### Requirement: Pase de unidad
El sistema SHALL permitir registrar, en una misma operación, el pase de varios beneficiarios
de un grupo a otra unidad en una fecha. Cada pase SHALL cerrar la pertenencia vigente de la
persona el día anterior a la fecha del pase y abrir una nueva en el mismo grupo, en la unidad
destino, desde la fecha del pase. La operación MUST aplicar todos los pases o ninguno.

La fecha del pase MUST ser una fecha real, MUST NOT ser futura y MUST ser posterior al
comienzo de la pertenencia vigente de cada persona. Cada persona MUST tener pertenencia
vigente en el grupo, de categoría beneficiario, en la unidad de origen indicada. La unidad
destino MUST ser uno de los destinos del pase de esa unidad de origen. Lo registran la
jefatura del grupo o su Secretaría.

#### Scenario: Pase de la Manada a la Tropa
- **WHEN** se registra el pase de un lobato de la Manada a la Tropa scout "Santa Juana" el 2026-04-10
- **THEN** su pertenencia en la Manada termina el 2026-04-09, tiene una nueva en la Tropa scout "Santa Juana" desde el 2026-04-10 como beneficiario, y el grupo no cambia

#### Scenario: La historia queda
- **WHEN** se consulta en qué unidad estaba esa persona el 2026-03-01
- **THEN** la respuesta es la Manada

#### Scenario: Uno falla, no pasa ninguno
- **WHEN** se registran tres pases y uno de ellos es de una persona que ya no tiene pertenencia vigente en la unidad de origen
- **THEN** el sistema rechaza la operación y ninguna de las tres pertenencias cambia

#### Scenario: Fecha futura
- **WHEN** se registra un pase con fecha posterior a hoy
- **THEN** el sistema rechaza la operación

#### Scenario: Fecha anterior al ingreso
- **WHEN** se registra el pase de una persona con una fecha igual o anterior al comienzo de su pertenencia vigente
- **THEN** el sistema rechaza la operación

#### Scenario: Dirigente en la lista
- **WHEN** se registra el pase de una persona de categoría activo
- **THEN** el sistema rechaza la operación

#### Scenario: Destino que no corresponde
- **WHEN** se registra el pase de un lobato de la Manada al Clan
- **THEN** el sistema rechaza la operación

#### Scenario: Sin permiso
- **WHEN** alguien que no es de la jefatura ni de la Secretaría del grupo registra un pase
- **THEN** el sistema rechaza la operación

### Requirement: Destinos del pase
Los destinos del pase de una unidad SHALL ser las unidades abiertas del grupo de la rama
siguiente a la suya según el catálogo de ramas, y la persona SHALL seguir siendo
beneficiario. Desde una unidad de la rama Rovers los destinos SHALL ser, además de las
unidades de la rama Adultos como beneficiario, cualquier unidad abierta del grupo como
activo, es decir como dirigente. Una unidad de la rama Adultos MUST NOT tener destinos de
pase.

Cuando hay más de un destino posible, el sistema SHALL proponer el de una unidad del mismo
sexo que la unidad de origen si hay exactamente uno así, y ninguno en otro caso.

#### Scenario: Un solo destino
- **WHEN** un grupo tiene una Manada y una sola Tropa scout
- **THEN** el destino del pase de la Manada es esa Tropa scout, ya propuesto

#### Scenario: Dos tropas y origen masculino
- **WHEN** el grupo tiene una Manada masculina, una Tropa scout masculina y una femenina
- **THEN** los destinos de la Manada son las dos tropas y se propone la masculina

#### Scenario: Origen mixto
- **WHEN** el grupo tiene una Manada mixta, una Tropa scout masculina y una femenina
- **THEN** los destinos son las dos tropas y no se propone ninguna

#### Scenario: Del Clan
- **WHEN** el grupo tiene un Clan, una Tropa de adultos, una Manada y una Tropa scout
- **THEN** los destinos del Clan son la Tropa de adultos como beneficiario, y la Manada, la Tropa scout, el propio Clan y la Tropa de adultos como dirigente

#### Scenario: Pase a dirigente
- **WHEN** se registra el pase de un rover a dirigente en la Manada
- **THEN** su nueva pertenencia es en la Manada con categoría activo

#### Scenario: Adultos
- **WHEN** se piden los destinos de una unidad de la rama Adultos
- **THEN** no hay ninguno

### Requirement: Candidatos al pase
El sistema SHALL proponer, para cada unidad elegida y una fecha de pase, a sus beneficiarios
con pertenencia vigente en dos grupos: los que a la fecha del pase tienen una edad igual o
mayor al límite superior de su rama, propuestos para pasar, y los que llegan a ese límite
dentro de los 12 meses siguientes a la fecha del pase, ofrecidos sin proponer. Los activos y
los adherentes MUST NOT aparecer. La propuesta MUST NOT limitar el pase: quien registra
decide a quién pasar entre los candidatos.

#### Scenario: Cumple la edad
- **WHEN** en la Manada hay un lobato que tiene 10 años el día del pase
- **THEN** aparece entre los propuestos para pasar

#### Scenario: Está cerca
- **WHEN** en la Manada hay un lobato que cumple 10 años cuatro meses después del pase
- **THEN** aparece entre los cercanos, sin proponer

#### Scenario: Lejos de la edad
- **WHEN** en la Manada hay un lobato que cumple 10 años dos años después del pase
- **THEN** no aparece

#### Scenario: La edad es la del día del pase
- **WHEN** un lobato cumple 10 años entre la fecha del pase y hoy
- **THEN** aparece entre los cercanos, no entre los propuestos

#### Scenario: Dirigentes afuera
- **WHEN** la Manada tiene un dirigente de 30 años
- **THEN** no aparece entre los candidatos
