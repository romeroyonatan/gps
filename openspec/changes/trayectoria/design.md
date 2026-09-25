## Context

Ver proposal.md — Why. Lo que condiciona el diseño:

- `estructura` tiene `Grupo > Unidad`, con `RAMAS` declarando el tipo de unidad de cada rama
  (`unidad: 'Manada'`). No conoce a `personas`; `personas` sí depende de él.
- `personas` guarda la pertenencia con su unidad, y con `pase-de-unidad` cada cambio deja un
  tramo cerrado: la historia de unidades ya existe ahí, con fecha exacta.
- El bus de eventos de `Core` es en proceso y sincrónico, y ya hay un precedente con esta
  forma: `afiliacion` publica `AfiliacionDeclarada` después del commit y `tesoreria`
  reacciona sin bloquear la declaración (`declaraciones.ts:139`).
- La ficha de persona existe (`/grupos/:id/personas/:personaId`), con secciones de datos,
  pertenencia y cargos, y ya abre pantallas propias para editar y para el cambio de rama.

## Goals / Non-Goals

**Goals:**
- Poder reconstruir la historia de un chico que está hace años en el grupo, con los datos
  incompletos que hay.
- Que la promesa tomada una vez no se pueda volver a tomar, ni siquiera en otro grupo.

**Non-Goals:**
- Carga en lote de hitos (la ceremonia de promesas). Llega después.
- Que los dirigentes de la rama carguen la progresión de su unidad: por ahora, jefatura y
  Secretaría.
- Catálogos completos de Castores, Raiders, Rovers y Adultos, y catálogo de insignias: se
  cargan cuando lleguen los reglamentos.
- Validar la trayectoria contra el padrón, o deducir una de la otra.

## Decisions

**Las subunidades van en `estructura`, no en `trayectoria`.** El tipo está reglamentado
—Seisena, Patrulla, Equipo—, así que es estructura de la asociación y no un dato del legajo.
`RAMAS` suma `subunidad: string | null`, junto a `unidad`, y Castores queda en `null` hasta
que se confirme. La alternativa era un catálogo propio en `trayectoria`, que partía un mismo
concepto en dos módulos.

`estructura` sigue sin conocer a las personas: sabe que la Patrulla Jaguar existe, y quién
está adentro lo sabe `trayectoria`.

**La política de subunidades se escribe en `estructura/dominio/politicas.ts`.** No puede
importar `puedeAdministrarPlantelDeGrupo` de `personas`: `personas` ya depende de
`estructura` y sería un ciclo entre paquetes. Es la misma línea sobre `tieneRol` de
`@gps/core/roles`, escrita dos veces, cada una en su módulo dueño. Duplicar una línea es
más barato que invertir la dependencia.

**Las fechas parciales son texto `aaaa`, `aaaa-mm` o `aaaa-mm-dd`.** Siguen ordenando
lexicográfica igual que cronológicamente para el mismo prefijo, así que la línea de tiempo
ordena sin parsear nada. La validación y la comparación son funciones puras en
`trayectoria/dominio/fechas.ts`; no van a `@gps/core/fechas` porque hoy tienen un solo
consumidor. `esFechaDeCalendario` de core sigue siendo la exacta, para lo operativo.

**La trayectoria no valida contra el padrón.** Ni solapamientos, ni que la unidad del tramo
sea la de la pertenencia, ni que el hito corresponda a la rama en que la persona estaba. Lo
que se carga es memoria de los libros. La pantalla puede mostrar una diferencia con un
`Aviso`; el servidor no rechaza.

**Un hito se toma una vez en la vida, y eso es un `UNIQUE (persona, hito)`.** El catálogo
dice en qué ramas se puede tomar cada uno: `promesa-scout` en Scouts, Raiders, Rovers y
Adultos; `promesa-lobato` sólo en Lobatos. Así la regla que pediste —el scout no vuelve a
tomar la promesa como raider, salvo que nunca la haya tomado— sale del modelo y no de un
caso especial. El catálogo guarda además la rama en que se tomó, que es dato histórico y no
clave.

**La patrulla la cierra un evento, no una consulta derivada.** `personas` publica
`PasesRegistrados` después del commit, con las personas y la fecha, y `trayectoria` cierra
sus tramos abiertos con la víspera. Derivar la vigencia —"vale sólo si la subunidad es de la
unidad actual"— evitaba la escritura, pero dejaba tramos abiertos para siempre en la base y
una regla implícita en cada consulta. Si el handler falla, el pase ya está guardado y la
falla va al log, igual que en tesorería; el tramo abierto en una unidad que ya no es la suya
se ve en la pantalla y se corrige a mano.

**Una pantalla de trayectoria, no todo en la ficha.** La ficha suma dos `Seccion` con su
contador —la unidad y patrulla de hoy, y el último hito con cuántas insignias— que entran a
`/grupos/:id/personas/:personaId/trayectoria`. Ahí va la línea de tiempo completa, de lo más
nuevo a lo más viejo, mezclando tramos, hitos, insignias y las pertenencias de `personas`,
cada uno marcado con lo que es. Meter todo en la ficha la volvía larguísima a 375px y
empujaba los cargos abajo de veinte filas de historia.

**Una pantalla de unidad, `/grupos/:id/unidades/:unidadId`**, con las patrullas y quién está
en cada una, a la que se entra desde una sección nueva en la pantalla del grupo. Repartir
chicos en patrullas es un acto de lote, y de a uno desde cada ficha sería inusable. Es
además donde van a caer abrir y cerrar unidades, que hoy existen sólo en el servicio.

## Risks / Trade-offs

- [Dos historias de unidades: la de las pertenencias, exacta, y la de los tramos, cargada a
  mano] → la línea de tiempo las muestra juntas y marca el origen de cada una. No se
  fusionan ni se deducen.
- [El handler del pase falla y queda una patrulla abierta en otra unidad] → la pantalla lo
  muestra con un `Aviso` y se cierra a mano. Mismo proceso y misma base, así que es raro.
- [Catálogos incompletos] → los hitos que faltan no se pueden cargar todavía. Se declara el
  hueco en el catálogo en vez de aceptar texto libre, que sería imposible de consolidar
  después.
- [Nombre libre en las insignias] → van a convivir "Primeros auxilios" y "primeros
  auxilios". Se asume hasta que haya catálogo; consolidar después es una migración de datos.

## Migration Plan

Migraciones nuevas en `estructura` (tabla `subunidades`) y en `trayectoria` (tramos, hitos,
insignias), aplicadas al arrancar como el resto. Nada que migrar hacia atrás: las tablas
nacen vacías y el módulo es opcional. `modules.ts` suma `trayectoria`.
