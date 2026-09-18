## Context

Motivación en `proposal.md`; comportamiento en `specs/unidades/spec.md`. Estado actual:

- `estructura/dominio/ramas.ts`: `RAMAS` es un catálogo cerrado en código (id, nombre, desde,
  hasta) con `etiquetaDeEdades` y `ramaDelCatalogo`.
- `ramas_del_grupo` tiene clave primaria `(grupo_id, rama)`: dos unidades de la misma rama
  son imposibles por diseño.
- `pertenencias` guarda `rama` (nullable, null en adherentes) y un índice parcial que deja
  una sola pertenencia vigente por persona.
- `validarIngreso(ingreso, ramasAbiertas, hoy)` valida rama obligatoria salvo adherente y
  rama abierta en el grupo.
- `Estructura.obtenerGrupo` devuelve `GrupoConRamas`, que usan `personas` y las pantallas.
- No hay datos reales: la migración puede elegir valores por defecto sin pedir permiso.

## Goals / Non-Goals

**Goals:**
- Que un grupo pueda tener N unidades de la misma rama.
- Que el nombre para mostrar se componga en un solo lugar del dominio.

**Non-Goals:**
- Sexo en `Persona`: dato sensible sin consumidor. Ver Decisión 4.
- Un dirigente a cargo de dos unidades: la pertenencia sigue siendo una sola (ver Preguntas
  abiertas).
- Mover personas entre unidades como operación propia: hoy se cierra la pertenencia y se
  abre otra, como ya funciona.

## Decisions

### 1. La rama sigue siendo catálogo; la unidad es tabla

```
 RAMAS (codigo)                     unidades (tabla, de estructura)
 lobatos -> Manada                  id | grupo_id | rama | sexo | nombre | cerrada_en
 scouts  -> Tropa scout             u1 | g12      | scouts | femenina | Santa Juana | null
 raiders -> Tropa raider            u2 | g12      | scouts | masculina| San Jorge   | null
 rovers  -> Clan                    u3 | g12      | lobatos| mixta    | Seeonee     | null
 castores-> Colonia
 adultos -> Tropa
```

Misma separación que ya hay entre cargos (catálogo, los nombra el código) y equipos (tabla,
los crea alguien). La rama la nombra el código —`validarIngreso`, `salidas`, los tramos de
edad—; la unidad no la nombra nadie de a una.

`RAMAS` suma `unidad: string` por entrada. Alternativa descartada: una tabla de tipos de
unidad. Son seis, cerrados, y se derivan de la rama.

### 2. `unidades` reemplaza a `ramas_del_grupo`

`cerrada_en` en vez de borrar, igual que `grupos` y `distritos`. El UNIQUE es parcial sobre
las abiertas —`(grupo_id, rama, nombre) WHERE cerrada_en IS NULL`—, mismo recurso que el
índice parcial de `pertenencias`, para poder reabrir una unidad con un nombre ya usado.

`Estructura.obtenerGrupo` pasa a devolver `GrupoConUnidades`. Las ramas abiertas se derivan
de las unidades (`specs`: "Las ramas abiertas se derivan"), así que `validarIngreso` puede
seguir recibiendo ramas donde hoy las recibe; lo que cambia es que además valida la unidad.

### 3. `pertenencias.rama` pasa a `unidad_id`

La rama de una persona se deriva de su unidad: guardarla también sería un dato duplicado que
puede contradecirse. `unidad_id` es nullable (null en adherentes) igual que `rama` hoy.

`personas` no puede hacer un JOIN contra `unidades`: es de otro módulo y su `/servidor` es
privado. Pide a `Estructura` (`publico.ts`) el método para resolver unidades por id, como ya
hace con `obtenerGrupo`.

`ponytail:` esto agrega un ida y vuelta al servicio de estructura donde antes había una
columna. Si pesa, `personas` desnormaliza `rama` junto a `unidad_id` con un test que las
compara.

### 4. Sin sexo en `Persona`

La unidad guarda su sexo porque es un dato del grupo y sirve para nombrarla. `Persona` no,
porque es dato sensible, abre la discusión entre sexo registral e identidad de género, y no
tiene consumidor. Consecuencia deliberada: el sistema no valida ni sugiere en qué unidad va
cada quien. Lo deciden los dirigentes, igual que hoy el director no se valida contra su
categoría.

### 5. Nombre para mostrar, en el dominio

`nombreDeLaUnidad(unidad)` en `estructura/dominio`, junto a `etiquetaDeEdades` y por la misma
razón: cuatro pantallas componiéndolo cada una a su manera divergen y nadie se entera.
Formato: `"Tropa scout Santa Juana · femenina"`.

### 6. Migración

Dos migraciones, una por módulo, cada una en su paquete:

1. `estructura`: crear `unidades`; por cada fila de `ramas_del_grupo`, una unidad con
   `sexo = 'mixta'`, `nombre = ` el tipo de unidad de la rama ("Tropa scout"), `cerrada_en`
   null; borrar `ramas_del_grupo`.
2. `personas`: recrear `pertenencias` con `unidad_id`, resolviendo cada `rama` contra la
   única unidad de esa rama en su grupo. Es determinista porque hoy no puede haber dos.

La migración de `personas` **no lee** la tabla `unidades`: recalcula el id con la misma
cuenta que usó la de `estructura` (`'unidad_' || grupo_id || '_' || rama`). Leerla ataría las
migraciones de `personas` a que otro módulo ya hubiera corrido —cierto en el backend por
`ordenarModulos`, falso corriendo el módulo solo, que es como corren sus tests—, y la
convención de id alcanza para lo mismo. Por eso el id de las unidades migradas se deriva y
no sale de `core.nuevoId`.

`nombre` = el tipo de unidad deja nombres como "Tropa scout" a secas, que los dirigentes
corrigen después. Como no hay datos reales, no hay a quién molestar.

### 7. El conteo de integrantes no sale de `estructura`

`estructura` no sabe de personas —la dependencia va `personas -> estructura`— así que una
unidad no puede traer cuánta gente tiene sin invertir el grafo. Tampoco hace falta: la
pantalla del grupo ya pide la nómina entera con `usePersonasDelGrupo` y la agrupa en
memoria, igual que hoy la agrupa por rama. El conteo sale de ahí.

Se descartó que `personas` extienda el tipo GraphQL `Unidad` con un campo `integrantes`:
obliga a compartir el `objectRef` entre módulos, que es la misma fricción que el proyecto ya
documentó con los enums de Pothos, y todo para un número que ya viaja en otra respuesta.

### 8. Dónde vive cada cosa

`estructura` es chico y no se parte: abrir y cerrar unidades son altas y bajas sin decisión
separable, y quedan en su `servicio.ts`. Lo puro va a `/dominio`, aunque hoy sólo lo llame
el servidor:

```
 estructura/src/dominio/
   ramas.ts      el catalogo, ahora con el tipo de unidad de cada rama
   unidades.ts   nombreDeLaUnidad(unidad) y ramasDeLasUnidades(unidades)
   modelos.ts    Unidad, sexo, GrupoConUnidades
```

En `personas`, `validarIngreso` ya vive en `/dominio` y ahí se queda: sólo cambia de recibir
las ramas abiertas a recibir las unidades abiertas.

## Risks / Trade-offs

- [Dos BREAKING de API en el mismo change] → Aceptado: no hay clientes fuera del repo y las
  apps se actualizan en el mismo commit.
- [Las dos migraciones comparten la convención de id de unidad] → Es acoplamiento, pero más
  débil que leer la tabla del otro módulo: cada suite corre sola y el test de `personas`
  afirma el id exacto que produce `estructura`.
- [Nombres por defecto feos tras migrar] → Sólo afecta a demo y desarrollo; la demo se
  siembra de nuevo con nombres de verdad.
- [Resolver unidades vía el servicio de estructura agrega llamadas] → Ver `ponytail:` en
  Decisión 3.

## Migration Plan

1. Migración de `estructura` y después la de `personas`, al arrancar, como las demás.
2. Sembrar de nuevo la demo (un grupo con dos tropas scout, para que el caso se vea).
3. Rollback: no hay datos reales; se restaura la base anterior.

## Open Questions

- Si `jefeDeRama` pasa a llamarse `jefeDeUnidad`. Hoy el cargo no dice de qué rama es: se
  deriva de la pertenencia, y eso sigue funcionando con unidades.
- Si un dirigente puede estar a cargo de dos unidades. Hoy la pertenencia vigente es una
  sola por persona, así que no. Llega con quien lo necesite.
