## ADDED Requirements

### Requirement: Cómo se llama la subunidad de cada rama
Cada rama SHALL declarar el nombre del tipo de subunidad en que se divide su unidad:
Lobatos es Seisena, Scouts, Raiders y Adultos son Patrulla, y Rovers es Equipo. Castores
MUST NOT declarar ninguno mientras no se confirme el suyo, y una unidad de una rama sin tipo
de subunidad MUST NOT admitir subunidades.

#### Scenario: Nombre del tipo
- **WHEN** se pide el tipo de subunidad de la rama Scouts
- **THEN** es "Patrulla"

#### Scenario: Rama sin subunidad
- **WHEN** se abre una subunidad en una unidad de la rama Castores
- **THEN** el sistema rechaza la operación

### Requirement: Abrir y cerrar una subunidad
El sistema SHALL permitir abrir una subunidad en una unidad abierta, indicando su nombre. El
nombre MUST estar presente y no ser sólo espacios. Dos subunidades abiertas de la misma
unidad MUST NOT tener el mismo nombre. El sistema SHALL permitir cerrar una subunidad
abierta; la cerrada MUST NOT aparecer entre las subunidades de la unidad y su nombre SHALL
quedar libre. Las abren y las cierran la jefatura del grupo y su Secretaría.

#### Scenario: Dos patrullas
- **WHEN** se abren en una Tropa scout las patrullas "Águila" y "Jaguar"
- **THEN** las dos quedan abiertas en esa unidad

#### Scenario: Dos patrullas iguales
- **WHEN** se abre una patrulla con el nombre de otra abierta de la misma unidad
- **THEN** el sistema rechaza la operación

#### Scenario: Mismo nombre en otra unidad
- **WHEN** se abre una patrulla "Águila" en una Tropa scout y otra "Águila" en la otra Tropa scout del grupo
- **THEN** las dos quedan abiertas

#### Scenario: Reabrir con el mismo nombre
- **WHEN** se abre una patrulla con el nombre de una ya cerrada de esa unidad
- **THEN** la operación se acepta

#### Scenario: Unidad cerrada
- **WHEN** se abre una subunidad en una unidad cerrada
- **THEN** el sistema rechaza la operación

#### Scenario: Sin permiso
- **WHEN** alguien que no es de la jefatura ni de la Secretaría del grupo abre o cierra una subunidad
- **THEN** el sistema rechaza la operación

### Requirement: Las subunidades de una unidad
El sistema SHALL devolver, para una unidad, sus subunidades abiertas con su nombre. Quiénes
están en cada una no se devuelve acá: la estructura no conoce a las personas.

#### Scenario: Listado
- **WHEN** se consulta una Tropa scout con dos patrullas abiertas y una cerrada
- **THEN** se devuelven las dos abiertas con su nombre
