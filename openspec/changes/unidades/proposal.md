## Why

Un grupo puede tener más de una unidad de la misma rama: dos tropas scout, una femenina y
una masculina, o dos manadas porque son muchos chicos. Hoy `estructura` no lo permite: la
tabla `ramas_del_grupo` tiene clave primaria `(grupo, rama)`, así que la rama abierta es una
sola y una persona pertenece "a la rama", no a una unidad concreta. Es un hecho corriente de
la asociación que el modelo no puede representar, y aparece apenas se quiere decir qué
unidades van a una salida.

## What Changes

- `estructura`: tabla `unidades` (grupo, rama, sexo, nombre, cerrada) en reemplazo de
  `ramas_del_grupo`. Abrir y cerrar unidades en vez de abrir ramas. **BREAKING** para la
  tabla y para la API GraphQL de grupos.
- El catálogo `RAMAS` suma cómo se llama la unidad de cada rama: Colonia, Manada, Tropa
  scout, Tropa raider, Clan, Tropa.
- Cada unidad declara su sexo (masculina, femenina o mixta) y su nombre propio, obligatorio.
  El nombre para mostrar los compone: "Tropa scout San Jorge · femenina".
- `personas`: la pertenencia apunta a una unidad en vez de a una rama; la rama se deriva de
  la unidad. **BREAKING** para la tabla `pertenencias` y para la API GraphQL de personas.
- Quién va a qué unidad lo deciden los dirigentes: el sistema no infiere ni valida nada a
  partir del sexo de la unidad, y `Persona` sigue sin guardar sexo.

## Capabilities

### New Capabilities

- `unidades`: las unidades de un grupo —su rama, su sexo, su nombre y su apertura o
  cierre— y la pertenencia de las personas a ellas.

### Modified Capabilities

(ninguna: no hay specs previas en `openspec/specs/`)

## Impact

- `packages/estructura`: catálogo `RAMAS`, modelos, `publico.ts`, tablas, migración,
  servicio y esquema GraphQL.
- `packages/personas`: tabla `pertenencias`, validaciones de ingreso, servicio y esquema.
- `packages/demo`: siembra con unidades, alguna con dos de la misma rama.
- `apps/web` y `apps/mobile`: pantallas de grupo, de estructura y de alta de persona.
- `schema.gql` y `docs/arquitectura.md`.
- Habilita el change `modulo-salidas`, que elige participantes por unidad.
