## Why

Los chicos crecen y cambian de rama todos los años, pero hoy la unidad de una persona no se
puede cambiar: `pertenencia.unidadId` se fija en el alta y no hay operación que la mueva. Un
lobato que pasó a la tropa sigue figurando en la Manada, y la nómina de una salida de la
tropa no lo ofrece. Es lo más frecuente que le pasa al padrón y el sistema no lo puede
registrar.

## What Changes

- **Ceremonia de pases**: una pantalla nueva a la que se entra desde la Nómina del grupo. Se
  elige la fecha y las unidades que pasan, y el sistema carga solo a los beneficiarios que
  cumplen la edad de pasar según `RAMAS` —tildados— y a los que la cumplen dentro de los 12
  meses —sin tildar—. El dirigente destilda a los que no pasaron y suma a los cercanos que sí.
- Cada fila tildada tiene un destino. Se propone la unidad de la rama siguiente; si hay más
  de una posible (dos tropas, o Adultos y dirigente desde el Clan) se elige por fila, con la
  del mismo sexo que la unidad de origen propuesta cuando existe.
- Desde el Clan se puede pasar a la Tropa de adultos (sigue beneficiario) o a dirigente en
  cualquier unidad abierta del grupo (pasa a activo).
- El pase cierra la pertenencia vigente el día anterior al pase y abre otra en la unidad
  destino, con la categoría que corresponda, desde el día del pase. Todos los pases de la
  ceremonia se confirman juntos o ninguno.
- La ceremonia no se guarda: lo que queda son las pertenencias nuevas.
- La regla de la spec `unidades` que prohibía sugerir una unidad a partir de datos de la
  persona pasa a decir que el sistema propone y los dirigentes deciden, sin rechazar nunca
  por edad. Es lo que ya hace el alta en web.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `unidades`: la pertenencia a una unidad admite que el sistema proponga por edad; se suman
  el pase de unidad en lote, sus candidatos y sus destinos.

## Impact

- `packages/personas`: dominio (candidatos y destinos del pase, validación), servicio
  (operación en una transacción), esquema GraphQL (mutation nueva).
- `packages/api`: hook y codegen de la mutation.
- `apps/web` y `apps/mobile`: pantalla de ceremonia de pases y su acceso desde la Nómina.
- `schema.gql`.
- Consumidores de pertenencias (`afiliacion`, `salidas`, `auth` vía roles) no cambian:
  ya preguntan por la pertenencia vigente en una fecha.
- Habilita el change posterior `trayectoria` (subunidades, progresiones), que cuelga la
  historia de patrullas de la historia de unidades que este change empieza a escribir.
