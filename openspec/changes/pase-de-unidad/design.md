## Context

`pertenencias` (en `personas`) guarda persona, grupo, categoría, unidad, `desde` y `hasta`,
con un índice parcial que garantiza una sola vigente por persona (`hasta IS NULL`). No hay
ninguna operación que la modifique después del alta. Los consumidores —`miembrosActivos`,
`miembrosDelGrupo`, `grupoVigenteDe`, `funcionesVigentes`— ya preguntan por la pertenencia
vigente en una fecha, y nada guarda una referencia al id de una pertenencia: los cargos
apuntan al grupo por `ambitoId`, y salidas y afiliación guardan fotografías.

`RAMAS` (en `estructura/dominio`) tiene los rangos de edad con `hasta` exclusivo, y
`calcularEdad(fechaDeNacimiento, hoy)` vive en `personas/dominio`. `salidas` ya resuelve una
selección parecida con `candidatos(personas, unidadesElegidas)` en su `/dominio`, usado por
las pantallas y el servidor.

## Goals / Non-Goals

**Goals:**
- Que el pase deje historia: saber en qué unidad estaba alguien en una fecha pasada.
- Que la propuesta de candidatos y destinos sea la misma en web, mobile y servidor.

**Non-Goals:**
- Guardar la ceremonia como entidad (borrador, fecha, lista). Si hace falta prepararla con
  anticipación o colgarle promesas, llega con `trayectoria`.
- Pasar dirigentes o adherentes, cambiar de grupo, o dar de baja.
- Subunidades, patrullas y progresiones: change `trayectoria`.
- Cargar la historia anterior al sistema: las pertenencias previas no se inventan.

## Decisions

**El pase es un tramo, no una edición.** Cerrar la vigente (`hasta` = día anterior al pase)
y abrir otra desde el día del pase, en vez de pisar `unidadId`. Pisar es más corto, pero haría
mentir a `miembrosDelGrupo(grupo, fecha)` para cualquier fecha anterior al pase, y perdería
justo la historia que `trayectoria` va a necesitar. El índice parcial sigue valiendo sin
tocar: en la transacción, primero se cierra y después se abre. El `hasta` del tramo cerrado
queda en el pasado, así que "una pertenencia nunca tiene `hasta` futuro" se conserva, y por
eso la fecha del pase no puede ser futura.

Consecuencia aceptada: la fecha de ingreso al grupo deja de ser el `desde` de la vigente y
pasa a ser el del primer tramo de la racha en ese grupo. Hoy ninguna pantalla muestra
"ingresó el"; si alguna lo necesita, se deriva.

**Las reglas son funciones puras en `personas/dominio/pases.ts`:**
- `destinosDelPase(unidadDeOrigen, unidadesDelGrupo)` devuelve `{ unidadId, categoria }[]`
  y el propuesto (mismo sexo, si hay exactamente uno).
- `candidatosAlPase(miembros, unidadesElegidas, fecha)` devuelve por unidad los que cumplen
  y los cercanos (12 meses).
- `validarPase(...)` devuelve `Problema[]`, igual que `validarIngreso`.

Van en `personas` y no en `estructura` porque necesitan personas y edades; `estructura` no
conoce a `personas`. La rama siguiente sale del orden de `RAMAS`, que ya es el de edad; no
se agrega campo al catálogo. La edad a una fecha usa `calcularEdad` con la fecha del pase
convertida a `Date` local, así la regla del cumpleaños es la misma del alta.

**El servidor valida el destino con la misma `destinosDelPase`.** Así el Clan puede pasar a
dirigente y una Manada no puede saltar al Clan, sin una segunda copia de la regla. No valida
edad: la spec dice que se propone y no se rechaza.

**Una mutation, una transacción.** `registrarPases(grupoId, fecha, pases: [{ personaId,
unidadDeOrigenId, unidadDestinoId, categoria }])`. Se manda la unidad de origen para
detectar la pantalla desactualizada (alguien ya lo pasó desde otro teléfono) en vez de
cerrar lo que haya. Todo en `core.bd.transaction`, como `crearPersona`. La política es
`puedeAdministrarPlantelDeGrupo`, la misma que el alta. Devuelve las pertenencias nuevas.

**Pasar a dirigente da acceso.** La nueva pertenencia `activo` hace que `funcionesVigentes`
devuelva el rol `dirigente` en el pedido siguiente. Es el mismo efecto que el alta de un
activo, que ya está bajo la misma política, así que no abre nada nuevo. Se deja escrito para
que no sorprenda.

**Pantalla: `/grupos/:id/pases`, entrada desde la Nómina.** Estructura de `Salida`: fecha,
"¿Qué unidades pasan?" con las unidades del grupo, y un bloque por unidad elegida con dos
secciones (cumplen, tildados; cerca, sin tildar). Filas de 72px: nombre y edad a la fecha
del pase arriba; si la fila está tildada y hay más de un destino, las opciones debajo como
`Filtros`, que existe en las dos apps. Una fila destildada no muestra destino. "Confirmar N
pases" queda deshabilitado mientras haya una fila tildada sin destino. Sin radio nuevo:
React Native no tiene uno nativo y `Filtros` ya es elegir de a uno.

## Risks / Trade-offs

- [Dos personas cargan la misma ceremonia desde dos dispositivos] → la segunda falla
  entera porque la unidad de origen ya no coincide; recarga y ve el estado real.
- [Pase cargado con la fecha equivocada] → no hay edición ni deshacer. Corregirlo sería
  borrar el tramo nuevo y reabrir el anterior. Se deja fuera hasta que pase; el aviso de la
  pantalla muestra la fecha en el botón de confirmar.
- [Clan con muchas unidades] → las opciones de dirigente pueden ser seis o más; las
  píldoras de `Filtros` bajan de línea, que a 375px se lee bien.
- [Un rover pasa a dirigente en su propio Clan] → válido, es un destino más.

## Migration Plan

Sin migración de datos ni de tablas: se usan las columnas que ya existen. Rollback es
revertir el código; los tramos ya escritos siguen siendo pertenencias válidas.
