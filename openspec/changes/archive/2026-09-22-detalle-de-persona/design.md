## Context

Ver proposal.md para el porqué. Lo que ya existe y condiciona el cómo:

- La única consulta de personas es `personas(grupoId)`, y ya devuelve todo lo que el
  detalle muestra: datos, pertenencia vigente, cargos y equipos.
- Las pertenencias tienen historial desde el principio: `hasta`, e índice parcial
  `pertenencia_vigente_por_persona` sobre `hasta IS NULL`. `listarPersonas` lee la
  vigente con `hasta IS NULL`. `miembrosDelGrupo`, `grupoVigenteDe` y `miembrosActivos`
  filtran "vigente al día X" por `desde`/`hasta`.
- Los cargos guardan su `ambitoId` propio (el grupo), no la pertenencia: cerrar una
  pertenencia no los toca (`vinculos.ts`).
- Las mutations de cargos y equipos (`asignarCargo`, `revocarCargo`, `integrarEquipo`,
  `revocarIntegranteDeEquipo`) ya existen, con autorización y auditoría.
- `DocumentoDuplicado` ya existe y el esquema ya lo traduce en el alta.
- `crearPersona` guarda cada cargo del alta con `ambitoId: ingreso.grupoId`, y el
  formulario ofrece `TIPOS_DE_CARGO` entero. Resultado: un "comisionado de distrito" con
  un grupo como ámbito.

## Goals / Non-Goals

**Goals:**
- Una pantalla de detalle idéntica a 375px en web y mobile, armada con las piezas de
  `ui.tsx` (`Volver`, `Titulo`, `Seccion`, `FILA`, `Chip`, `ChipDeRama`, `Campo`, `CAMPO`,
  `BOTON_PRINCIPAL`, `BOTON_SECUNDARIO`).
- Cada forma que ya existe una vez y ahora aparece por segunda vez se extrae en lugar de
  copiarse.

**Non-Goals:**
- Una consulta `persona(id)`. Llega cuando haya búsqueda sin grupo.
- Calcular "en el grupo desde" sobre el historial.

## Decisions

### El detalle lee de `personas(grupoId)`
La ruta lleva el grupo (`/grupos/:id/personas/:personaId`) y la pantalla busca a la persona
en la lista, que ya está en caché cuando se viene de la nómina. Si no está, es `Vacio`.
*Alternativa:* `persona(id)` en el esquema. Descartada: sería código de servidor sin un
dato nuevo que traer.

### `editarPersona(personaId, datos: DatosDePersona)`
El servicio busca el grupo vigente de la persona (`grupoVigenteDe`), autoriza con
`puedeAdministrarPlantelDeGrupo` —es el mismo conjunto: jefatura, Secretaría o
elevación— y corre `validarPersona`. El `UPDATE` normaliza el número igual que el alta y
traduce la violación del `UNIQUE (tipo, numero)` a `DocumentoDuplicado`, como hace
`crearPersona`. Guardar sin cambiar el documento no choca consigo misma, porque es un
`UPDATE` sobre la misma fila. *Alternativa:* una política nueva `puedeEditarPersona`.
Descartada: hoy decidiría lo mismo que la existente, y la regla de las piezas vale también
para las políticas.

### `cambiarDeUnidad(personaId, unidadId, desde)`: cerrar y abrir
En una transacción: `UPDATE pertenencias SET hasta = desde - 1 día` sobre la vigente, y
después `INSERT` de la nueva con la misma categoría y el mismo grupo. El orden importa: el
índice parcial no admite dos filas con `hasta IS NULL`. Que `hasta` sea el día anterior y
no el mismo día evita que `estaVigente`, que incluye las dos puntas, vea dos pertenencias
ese día.

La regla va pura en `/dominio`, como `validarIngreso`:
`validarCambioDeUnidad(pertenencia, unidadId, desde, unidadesAbiertas, hoy)`. Rechaza una
categoría distinta de activo, la misma unidad, una unidad fuera de las abiertas del grupo,
una fecha futura y una fecha menor o igual al `desde` vigente. La pantalla usa una
función `puedeCambiarDeUnidad(pertenencia)` (categoría activo) para mostrar u ocultar el
botón, y la validación la llama también.
*Alternativa:* `UPDATE unidad_id` en el lugar. Descartada por el usuario: se pierde qué
unidad tenía la persona en una fecha pasada, y Ceremonias lo va a necesitar.

### El alta y el detalle sólo ofrecen cargos de grupo
`validarIngreso` rechaza un cargo cuyo `ambitoDelCargo` no sea `grupo`. El bloque de
cargos compartido filtra el catálogo por el mismo criterio. En el detalle, Secretaría se
agrega sin fecha de fin porque `integrarEquipo` no la recibe. Los cargos llevan
`desde = hoy`. Guardar llama a una mutation por cada elección, y si una falla la pantalla
nombra cuál. *Alternativa:* una mutation en lote. Descartada: con uno o dos cargos por vez
es una transacción que nadie necesita.

### Piezas que se extraen (en web y en mobile, con el mismo nombre)
| Pieza | Hoy | Segundo consumidor | Destino |
| --- | --- | --- | --- |
| `DatosPersonales` (apellidos, nombres, nacimiento, documento, domicilio, teléfono) | alta | edición | web: `pantallas/DatosPersonales.tsx`; mobile: `componentes/DatosPersonales.tsx` |
| `Unidades` (selector con píldoras de rama) | alta | cambio de rama | junto a `DatosPersonales` o en su propio archivo en `pantallas/`/`componentes/` |
| `Cargos` (checkbox + hasta) | alta | detalle | ídem |
| `Etiqueta` (Chip con ×) | plantel | detalle | `ui.tsx` de cada app, y la tabla de CLAUDE.md y `apps/mobile/README.md` |

`DatosPersonales` recibe el valor y un `onCambiar`, más los problemas. La fecha de
nacimiento se inicializa desde `fechaDeNacimiento` al editar.

### Rutas
Web: `/grupos/:id/personas/:personaId`, `…/editar` y `…/rama`. Mobile, con la misma forma
en expo-router: `app/grupos/[id]/personas/[personaId]/index.tsx`, `editar.tsx` y
`rama.tsx`. Las filas de la nómina pasan a ser enlaces con `CHEVRON` en las dos apps.
Guardar vuelve al detalle, que es la confirmación.

## Risks / Trade-offs

- [Un pase con fecha pasada cambia lo que devuelven las consultas a fechas entre la fecha
  del pase y hoy] → Es lo que se busca. Las declaraciones de afiliación ya emitidas son una
  foto y no se recalculan.
- [Cargar varios cargos no es atómico] → Cada uno es independiente y se puede revocar, y
  la pantalla dice cuál falló.
- [Tras un pase, el detalle muestra "en la unidad desde" y no "en el grupo desde"] → La
  etiqueta dice lo que muestra. El cálculo sobre el historial llega con su primera pantalla.
- [Paridad web y mobile a mano] → Una tarea explícita compara las dos a 375px.
