## Context

`pertenencias` (en `personas`) guarda persona, grupo, categoría, unidad, `desde` y `hasta`,
con un índice parcial que garantiza una sola vigente por persona (`hasta IS NULL`).

`cambiarDeUnidad` ya mueve de unidad a un **dirigente**: en una transacción cierra la
pertenencia vigente con `laVispera(desde)` —primero, porque el índice parcial no admite dos
abiertas— y abre otra con la misma categoría. `validarCambioDeUnidad` exige fecha real, no
futura y posterior al `desde` vigente, y `puedeCambiarDeUnidad` pide categoría activo: los
beneficiarios están excluidos a propósito, porque su cambio es la ceremonia. La pantalla
`CambioDeRama` (`/grupos/:id/personas/:personaId/rama`) es su entrada.

Los consumidores —`miembrosActivos`,
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
- Publicar un evento del pase: `PasesRegistrados` lo agrega el change `trayectoria`, que es
  el primero que lo escucha, para cerrar la patrulla de quien pasa.

## Decisions

**El pase reusa el tramo de `cambiarDeUnidad`, no inventa otro.** Cerrar la vigente con
`laVispera(fecha)` y abrir otra desde la fecha del pase es lo que esa operación ya hace y lo
que su comentario ya explica: el orden importa por el índice parcial, y la víspera evita que
`estaVigente` —que incluye las dos puntas— vea dos el mismo día. Pisar `unidadId` haría
mentir a `miembrosDelGrupo(grupo, fecha)` para cualquier fecha anterior al pase, y perdería
justo la historia que `trayectoria` va a necesitar. Como el `hasta` del tramo cerrado queda
en el pasado, se conserva el invariante "una pertenencia nunca tiene `hasta` futuro", y por
eso la fecha del pase no puede ser futura.

**El pase puede cambiar la categoría; `cambiarDeUnidad` no.** Aquél conserva la del
dirigente que se muda de unidad. El rover que pasa a dirigente arranca una pertenencia
`activo`, así que la categoría es parte del pase y viaja por fila. Es la diferencia que
justifica una operación aparte en vez de aflojar `puedeCambiarDeUnidad`, que seguiría
diciendo "sólo los dirigentes cambian de unidad por acá" —y es cierto: los beneficiarios
cambian por la ceremonia—.

Consecuencia aceptada: la fecha de ingreso al grupo deja de ser el `desde` de la vigente y
pasa a ser el del primer tramo de la racha en ese grupo. Hoy ninguna pantalla muestra
"ingresó el"; si alguna lo necesita, se deriva.

**Las reglas son funciones puras en `personas/dominio/pases.ts`:**
- `destinosDelPase(unidadDeOrigen, unidadesDelGrupo)` devuelve `{ unidadId, categoria }[]`
  y el propuesto (mismo sexo, si hay exactamente uno).
- `candidatosAlPase(miembros, unidadesElegidas, fecha)` devuelve por unidad los que cumplen
  y los cercanos (12 meses).
- `validarPase(...)` devuelve `Problema[]`, hermana de `validarCambioDeUnidad`: comparten las
  tres reglas de fecha, y se diferencian en que ésta pide beneficiario y destino del
  catálogo. Lo compartido se extrae; la regla de categoría no, que es lo que las distingue.

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
cerrar lo que haya. La transacción es una sola para todo el lote, no una llamada a
`cambiarDeUnidad` por persona: ésa abre la suya y dejaría medio pase hecho si la tercera
falla. La política es `puedeAdministrarPlantelDeGrupo`, la misma que `cambiarDeUnidad` y que
el alta. Devuelve las pertenencias nuevas.

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
