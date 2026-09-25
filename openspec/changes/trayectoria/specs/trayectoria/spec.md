## Purpose

La historia de una persona en el escultismo: en qué subunidades estuvo y desde cuándo, qué
hitos de progresión tomó y qué insignias ganó. Es un registro opcional que la jefatura del
grupo carga, no una restricción sobre el padrón.

## ADDED Requirements

### Requirement: Fechas de precisión parcial
Las fechas de la trayectoria SHALL admitirse con año (`aaaa`), año y mes (`aaaa-mm`) o día
completo (`aaaa-mm-dd`), y SHALL conservarse con la precisión con que se cargaron. La
historia vieja se reconstruye de los libros y de la memoria, y una fecha inventada al día
sería peor que una imprecisa.

#### Scenario: Sólo el año
- **WHEN** se carga un tramo que empieza en "2019"
- **THEN** el sistema lo acepta y lo devuelve como "2019", sin completar mes ni día

#### Scenario: Fecha imposible
- **WHEN** se carga una fecha como "2019-13" o "2019-02-31"
- **THEN** el sistema rechaza la operación

### Requirement: Tramos en una subunidad
El sistema SHALL permitir registrar que una persona estuvo en una unidad, opcionalmente en
una de sus subunidades, entre dos fechas. La unidad MUST existir, aunque esté cerrada, y la
subunidad MUST ser de esa unidad. `hasta` MAY quedar vacío, y significa que sigue ahí.
Cuando las dos fechas tienen día completo, `hasta` MUST NOT ser anterior a `desde`.

El tramo MUST NOT validarse contra las pertenencias de la persona: puede haber tramos de
antes de que el grupo usara el sistema, huecos, y tramos que se solapan con lo que dice el
padrón. Es un registro, no una restricción.

#### Scenario: Patrulla con período abierto
- **WHEN** se registra que una persona está en la Patrulla Jaguar desde el 2025-08-04, sin `hasta`
- **THEN** ese es su tramo vigente

#### Scenario: Unidad sin subunidad
- **WHEN** se registra que una persona estuvo en la Manada entre "2019" y "2022", sin indicar subunidad
- **THEN** el sistema lo acepta

#### Scenario: Unidad cerrada
- **WHEN** se registra un tramo en una unidad que el grupo ya cerró
- **THEN** el sistema lo acepta

#### Scenario: Subunidad de otra unidad
- **WHEN** se registra un tramo indicando una unidad y una subunidad que no es suya
- **THEN** el sistema rechaza la operación

#### Scenario: Antes de la pertenencia
- **WHEN** se registra un tramo anterior a la pertenencia vigente de la persona
- **THEN** el sistema lo acepta

#### Scenario: Vuelta al revés
- **WHEN** se registra un tramo del 2025-08-04 al 2023-04-10
- **THEN** el sistema rechaza la operación

### Requirement: La patrulla se cierra con el pase
Cuando una persona pasa de unidad, el sistema SHALL cerrar sus tramos abiertos con la
víspera de la fecha del pase: la patrulla es de la unidad, y quien pasa a otra unidad deja
de estar en ella. Si el cierre falla, el pase MUST quedar igualmente registrado y la falla
SHALL quedar en el log.

#### Scenario: Pase de la Manada a la Tropa
- **WHEN** una persona con un tramo abierto en la Seisena blanca pasa a la Tropa scout el 2026-04-10
- **THEN** ese tramo queda cerrado el 2026-04-09 y la persona no tiene tramo vigente

#### Scenario: El pase no depende del cierre
- **WHEN** el cierre del tramo falla
- **THEN** el pase queda registrado igual

### Requirement: Quién está en una subunidad
El sistema SHALL devolver, para una unidad, quiénes tienen un tramo vigente en cada una de
sus subunidades.

#### Scenario: Armado de las patrullas
- **WHEN** se consulta una Tropa scout con dos patrullas
- **THEN** se devuelve quiénes están hoy en cada una

### Requirement: Hitos de progresión
El sistema SHALL declarar un catálogo de hitos de progresión, cada uno con las ramas en que
se puede tomar, y SHALL permitir registrar que una persona tomó un hito en una fecha. Una
persona MUST NOT tener el mismo hito dos veces: un hito se toma una sola vez en la vida.

El hito MUST pertenecer al catálogo. El sistema MUST NOT exigir que los hitos se tomen en
orden ni que la persona esté en una rama donde ese hito se toma: la historia vieja llega
incompleta y quien la carga sabe más que el sistema.

#### Scenario: Promesa de lobato
- **WHEN** se registra que una persona tomó la promesa de lobato el 2019-12-10
- **THEN** queda en su trayectoria con esa fecha

#### Scenario: La promesa scout es una sola
- **WHEN** una persona que ya tiene la promesa scout la vuelve a tomar como raider
- **THEN** el sistema rechaza la operación

#### Scenario: Promesa scout tomada de grande
- **WHEN** se registra la promesa scout de alguien que entró al grupo como rover y nunca fue scout
- **THEN** el sistema lo acepta

#### Scenario: Promesas de ramas distintas
- **WHEN** una persona tiene la promesa de castor y la promesa de lobato
- **THEN** las dos conviven

#### Scenario: Fuera de orden
- **WHEN** se registra la segunda clase de alguien que no tiene registrada la tercera
- **THEN** el sistema lo acepta

#### Scenario: Hito inventado
- **WHEN** se registra un hito que no está en el catálogo
- **THEN** el sistema rechaza la operación

### Requirement: Insignias
El sistema SHALL permitir registrar las insignias de una persona —aptitudes, especialidades
y jalones—, cada una con su tipo, su nombre y su fecha. Una persona MAY tener ninguna o
muchas. El nombre es libre mientras no haya catálogo, y MUST estar presente y no ser sólo
espacios.

#### Scenario: Especialidad
- **WHEN** se registra la especialidad "Primeros auxilios" el 2024-11-02
- **THEN** queda en la trayectoria de la persona

#### Scenario: Sin nombre
- **WHEN** se registra una insignia con el nombre vacío o en blanco
- **THEN** el sistema rechaza la operación

#### Scenario: Varias
- **WHEN** una persona tiene cinco especialidades
- **THEN** las cinco se devuelven

### Requirement: Corregir lo cargado
El sistema SHALL permitir borrar un tramo, un hito o una insignia. Lo que se carga de
memoria se carga mal, y sin forma de corregirlo la historia queda peor que vacía.

#### Scenario: Borrar un hito
- **WHEN** se borra un hito cargado con la fecha equivocada
- **THEN** deja de estar en la trayectoria y el hito se puede volver a cargar

### Requirement: Quién carga y quién lee la trayectoria
La trayectoria de una persona la SHALL cargar la jefatura del grupo al que pertenece hoy, y
su Secretaría. La SHALL leer quien puede ver a las personas de ese grupo. La trayectoria es
de la persona y no del grupo: quien la lee ve también lo que pasó en otros grupos, porque
una promesa tomada en otro lado sigue siendo la misma promesa.

#### Scenario: Carga la Secretaría
- **WHEN** la Secretaría del grupo carga un hito de una persona del grupo
- **THEN** la operación se acepta

#### Scenario: Otro grupo
- **WHEN** la jefatura de un grupo carga la trayectoria de una persona que no es de su grupo
- **THEN** el sistema rechaza la operación

#### Scenario: Historia de antes
- **WHEN** se lee la trayectoria de alguien que se mudó de grupo
- **THEN** se devuelve también lo que cargó su grupo anterior
