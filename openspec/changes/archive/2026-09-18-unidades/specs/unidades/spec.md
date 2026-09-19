## Purpose

Las unidades en que se subdivide un grupo scout —la Manada, las dos Tropas, el Clan—, cada
una de una rama y con su sexo y su nombre, y la pertenencia de las personas a ellas.

## ADDED Requirements

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

### Requirement: Las ramas abiertas existentes se conservan
Cada rama abierta antes de este cambio SHALL pasar a ser una unidad de esa rama en su grupo,
y cada pertenencia con rama SHALL pasar a apuntar a la unidad de su rama en su grupo, sin
perder su período ni su categoría.

#### Scenario: Migración
- **WHEN** se aplica la migración sobre una base con grupos con ramas abiertas y personas con pertenencia
- **THEN** cada rama abierta es una unidad y cada pertenencia apunta a la unidad de su rama en su grupo
