## Why

Hoy una persona se da de alta y nunca más se puede mirar ni tocar: la nómina es una lista
de sólo lectura, un DNI mal tipeado queda para siempre y un dirigente que pasa de la Manada
a la Tropa no tiene cómo moverse. Las specs de datos personales y de pertenencia
difirieron la edición "hasta tener una pantalla que la pida"; ésta es esa pantalla.

## What Changes

- Pantalla de detalle de una persona (`/grupos/:id/personas/:personaId`), en web y mobile,
  a la que se llega tocando una fila de la nómina. Muestra datos personales, pertenencia
  (unidad y desde cuándo), cargos y equipos vigentes.
- Edición de los datos personales —documento incluido— con las mismas validaciones del
  alta. Un documento que ya tiene otra persona se rechaza.
- Cambio de rama de un dirigente (categoría activo), en pantalla aparte: cierra la
  pertenencia vigente y abre otra en la unidad nueva, conservando el historial.
- Carga y remoción de cargos de grupo (con fin de mandato opcional, como en el alta) y de
  Secretaría desde el detalle.
- Arreglo: el alta deja de ofrecer y de aceptar cargos de distrito o de diócesis, que hoy
  se guardan con el grupo como ámbito.
- Las piezas repetidas entre alta, plantel y detalle se comparten (datos personales,
  bloque de cargos, selector de unidad, etiqueta removible) en vez de copiarse.

### Fuera de alcance

- Cambio de rama de beneficiarios: llega con la pantalla de Ceremonias.
- Cambio de categoría, baja, cambio de grupo, editar un cargo ya cargado.
- "En el grupo desde" calculado sobre el historial: la pantalla muestra el desde de la
  pertenencia vigente, y lo dice.

## Capabilities

### New Capabilities
- `personas`: ver y corregir los datos personales de una persona del grupo.

### Modified Capabilities
- `unidades`: un dirigente puede cambiar de unidad dentro de su grupo, con historial.
- `cargos`: el alta de una persona tampoco puede cargar cargos que no sean de grupo.

## Impact

- `packages/personas`: mutations nuevas `editarPersona` y `cambiarDeUnidad`; política
  `puedeCambiarDeRama`; `validarIngreso` rechaza cargos no grupales. Sin migración: las
  columnas `hasta` y el índice parcial de pertenencias ya existen.
- `packages/api`: hooks y codegen de las dos mutations.
- `apps/web` y `apps/mobile`: pantallas Detalle, Edición y Cambio de rama; la nómina enlaza
  al detalle; componentes extraídos del alta y del plantel.
- `schema.gql` regenerado.
