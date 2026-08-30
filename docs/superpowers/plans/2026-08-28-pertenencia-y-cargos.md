# Pertenencia y cargos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar `personas` con `estructura`: una persona pertenece a un grupo con una
categoría y una rama, puede tener cargos, y se carga desde la pantalla de su grupo.

**Architecture:** Para poder conectarlos hay que corregir primero la frontera entre
módulos: cada módulo publica una interfaz en `src/dominio/publico.ts`, `Module` pasa las
dependencias ya construidas a `createServices`, y el linter prohíbe `@gps/*/servidor` en
vez de prohibir el paquete entero. Con eso, la pertenencia y los cargos viven en
`personas` —dos tablas con historial— y el servicio valida contra `estructura.obtenerGrupo`.

**Tech Stack:** Bun, TypeScript, Drizzle sobre SQLite, Pothos + GraphQL Yoga, React +
Tailwind + wouter (web), Expo + NativeWind + expo-router (mobile), Biome, `bun test`.

**Spec:** `docs/superpowers/specs/2026-08-28-pertenencia-y-cargos-design.md`

## Global Constraints

- **Idioma.** Español para lo que nombra el escultismo y las reglas de negocio: modelos,
  campos de GraphQL, comentarios, nombres de tests. Inglés para el vocabulario técnico de
  industria (`module`, `core`, `index`, `schema`, `context`) y para los archivos canónicos.
- **Portabilidad.** Bajo `packages/*/src/**` no se importa `bun:*` ni `node:*`. Bajo
  `packages/*/src/servidor/**` además no se usa `new Date()`, `Date.now()` ni
  `crypto.randomUUID()`: el reloj es `core.reloj.ahora()` y los ids `core.nuevoId(prefijo)`.
  Lo impone Biome por dos vías (`noRestrictedImports` y `biome-plugins/portabilidad.grit`).
- **Fronteras.** `apps/**` no importa `@gps/*/servidor`. A partir de la Tarea 4, tampoco lo
  hace `packages/*/src/**`, salvo `packages/demo`. `@gps/*/dominio` sí se puede importar.
- **Relojes falsos en epoch 1970.** Todo test que necesite un `Reloj` usa
  `new Date('1970-01-01T00:00:00Z')`, para que una hora del sistema colada se distinga de
  un vistazo en vez de parecer plausible.
- **Fechas de calendario como texto `aaaa-mm-dd`**, nunca `Date`, para `fechaDeNacimiento`,
  `desde` y `hasta`.
- **Mobile-first.** Todo se diseña primero a 375px; `sm:` y `md:` sólo agregan.
- **Comentarios que explican el porqué, no el qué**, en el registro del código existente.
- **Commits en español**, con `feat(<modulo>):` / `refactor(core):` / `docs:`.
- **Verificación de cada tarea:** `bun run check` (lint + tipos + tests) tiene que quedar en
  verde antes de commitear.

---

## Estructura de archivos

**Se crean:**

    packages/core/test/builder.test.ts                 tests de enumCompartido
    packages/estructura/src/dominio/publico.ts         interface Estructura
    packages/personas/src/dominio/categorias.ts        catálogo de categorías
    packages/personas/src/dominio/cargos.ts            catálogo de tipos de cargo
    packages/personas/src/dominio/vinculos.ts          Pertenencia, Cargo, estaVigente
    packages/personas/test/vinculos.test.ts
    packages/personas/migraciones/0001_*.sql           generada por drizzle-kit
    apps/web/src/pantallas/Grupo.tsx                   pantalla del grupo
    apps/mobile/app/grupos/[id].tsx                    ídem en React Native

**Se borran:**

    apps/web/src/pantallas/Personas.tsx
    apps/mobile/app/personas.tsx

**Se modifican:** `biome.json`, `packages/core/src/{builder,module,registry,index}.ts`,
`services/backend/src/composicion.ts`, `packages/estructura/src/dominio/index.ts`,
`packages/estructura/src/servidor/{servicio,schema}.ts`,
`packages/personas/{package.json,src/dominio/*,src/servidor/*}`,
`packages/demo/src/servidor/escenario.ts`, `packages/api/src/*`,
`apps/web/src/{App.tsx,pantallas/Estructura.tsx}`, `apps/mobile/app/index.tsx`,
`schema.gql`, `CLAUDE.md`, `docs/arquitectura.md`, `docs/crear-un-modulo.md`.

---

## Task 1: `enumCompartido` en core

Pothos 4.13 no tiene `enumRef` diferido: un enum sólo se crea con `enumType` y crearlo dos
veces con el mismo nombre aborta el esquema. `Grupo.ramas` y `Persona.rama` son el mismo
enum `Rama`, declarado por dos módulos distintos.

**Files:**
- Modify: `packages/core/src/builder.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/builder.test.ts` (crear)

**Interfaces:**
- Consumes: `crearBuilder()` y `type Builder`, que ya existen en ese archivo.
- Produces: `enumCompartido(builder, nombre, valores)` y `class ValoresDistintos`. Las
  Tareas 3 y 8 lo usan para el enum `Rama`.

- [ ] **Step 1: Escribir el test que falla**

Crear `packages/core/test/builder.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import { crearBuilder, enumCompartido, ValoresDistintos } from '../src/builder'

/** El builder de core declara Mutation vacio y GraphQL exige que un tipo tenga
 *  al menos un campo, asi que sin esto toSchema() no compone. */
function conMutation(builder: ReturnType<typeof crearBuilder>) {
  builder.mutationField('nada', (t) => t.field({ type: 'Boolean', resolve: () => true }))
  return builder
}

describe('enumCompartido', () => {
  test('el segundo modulo que lo pide recibe el mismo ref', () => {
    const builder = crearBuilder()
    const uno = enumCompartido(builder, 'Rama', ['lobatos', 'scouts'])
    const otro = enumCompartido(builder, 'Rama', ['lobatos', 'scouts'])
    expect(otro).toBe(uno)
  })

  test('el esquema compone con el enum declarado dos veces', () => {
    // Es la razon de ser del helper: sin el, la segunda llamada a enumType con
    // el mismo nombre aborta al componer.
    const builder = conMutation(crearBuilder())
    const ref = enumCompartido(builder, 'Rama', ['lobatos', 'scouts'])
    enumCompartido(builder, 'Rama', ['lobatos', 'scouts'])
    builder.queryField('rama', (t) => t.field({ type: ref, resolve: () => 'lobatos' as const }))
    expect(builder.toSchema().getType('Rama')).toBeDefined()
  })

  test('falla si el segundo lo pide con valores distintos', () => {
    // Sin este chequeo la divergencia seria silenciosa: el esquema publicaria
    // los valores del que registro primero, que depende del orden de los modulos.
    const builder = crearBuilder()
    enumCompartido(builder, 'Rama', ['lobatos', 'scouts'])
    expect(() => enumCompartido(builder, 'Rama', ['lobatos', 'raiders'])).toThrow(ValoresDistintos)
  })

  test('cada builder tiene su propio registro', () => {
    // Los tests arman varios builders y no tienen por que contaminarse entre si.
    const uno = enumCompartido(crearBuilder(), 'Rama', ['lobatos'])
    const otro = enumCompartido(crearBuilder(), 'Rama', ['lobatos'])
    expect(otro).not.toBe(uno)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `bun test packages/core/test/builder.test.ts`
Expected: FAIL — `enumCompartido` no está exportado por `../src/builder`.

- [ ] **Step 3: Implementar**

Agregar al final de `packages/core/src/builder.ts`, después de `export type Builder`:

```ts
/** Los enums que ya declaro algun modulo, por builder. WeakMap y no una
 *  constante de modulo porque los tests arman varios builders y no tienen por
 *  que contaminarse entre si. */
const compartidos = new WeakMap<Builder, Map<string, { valores: readonly string[]; ref: unknown }>>()

export class ValoresDistintos extends Error {
  constructor(nombre: string, unos: readonly string[], otros: readonly string[]) {
    super(
      `Dos modulos declaran el enum "${nombre}" con valores distintos: ` +
        `[${unos.join(', ')}] y [${otros.join(', ')}].`,
    )
    this.name = 'ValoresDistintos'
  }
}

// El cast de `values` es el mismo que hacia estructura antes de este helper:
// Pothos no infiere el tipo del enum desde un readonly V[] que no sea literal.
function crearEnum<V extends string>(builder: Builder, nombre: string, valores: readonly V[]) {
  return builder.enumType(nombre, { values: valores as unknown as readonly V[] })
}

/** Un enum de GraphQL que declara mas de un modulo. El primero que lo pide lo
 *  crea; los demas reciben el mismo ref.
 *
 *  Existe porque Pothos tiene objectRef, inputRef e interfaceRef diferidos
 *  -se crean en un archivo y se implementan en otro- pero no tiene enumRef: un
 *  enum solo se crea con enumType, y crearlo dos veces con el mismo nombre
 *  aborta el esquema. Y `Rama` la necesitan estructura, que la define, y
 *  personas, que la usa en la pertenencia.
 *
 *  El catalogo NO sube a core: sigue viviendo en el /dominio del modulo que lo
 *  define, y los dos se lo pasan a este helper. Lo que vive aca es la plomeria
 *  de registrar una sola vez, que es lo que core es. */
export function enumCompartido<V extends string>(
  builder: Builder,
  nombre: string,
  valores: readonly V[],
): ReturnType<typeof crearEnum<V>> {
  const delBuilder = compartidos.get(builder) ?? new Map()
  compartidos.set(builder, delBuilder)

  const registrado = delBuilder.get(nombre)
  if (registrado) {
    const iguales =
      registrado.valores.length === valores.length &&
      registrado.valores.every((valor, indice) => valor === valores[indice])
    if (!iguales) throw new ValoresDistintos(nombre, registrado.valores, valores)
    return registrado.ref as ReturnType<typeof crearEnum<V>>
  }

  const ref = crearEnum(builder, nombre, valores)
  delBuilder.set(nombre, { valores, ref })
  return ref
}
```

En `packages/core/src/index.ts`, cambiar la línea del builder por:

```ts
export type { Builder } from './builder'
export { crearBuilder, enumCompartido, ValoresDistintos } from './builder'
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `bun test packages/core/test/builder.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: `bun run check`**

Run: `bun run check`
Expected: lint, tipos y todos los tests en verde.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/builder.ts packages/core/src/index.ts packages/core/test/builder.test.ts
git commit -m "feat(core): enumCompartido, para un enum que declaran dos modulos"
```

---

## Task 2: `Module<S, D>` y dependencias construidas

`dependencies` existía, se validaba al arrancar y ordenaba el registro, pero un módulo no
tenía forma de alcanzar a otro: `createServices` recibía sólo `Core`. Ésta es la mitad que
faltaba.

**Files:**
- Modify: `packages/core/src/module.ts`
- Modify: `packages/core/src/registry.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `services/backend/src/composicion.ts:34-38`
- Modify: `packages/demo/test/escenario.test.ts:29-34`
- Test: `packages/core/test/registry.test.ts`

**Interfaces:**
- Consumes: `ordenarModulos`, `DependenciaFaltante`, `CicloDeDependencias` (ya existen).
- Produces: `Module<S, D>` con `createServices(core, dependencias: D)` y
  `dependencies: readonly (keyof D & string)[]`; `crearServicios(core, ordenados)` que
  devuelve `Record<string, unknown>`. La Tarea 8 declara `personas` con `D`.

- [ ] **Step 1: Escribir el test que falla**

Agregar al final de `packages/core/test/registry.test.ts`:

```ts
import type { Core } from '../src/core'
import { crearServicios } from '../src/registry'

describe('crearServicios', () => {
  // crearServicios no toca el Core, solo lo pasa: un objeto vacio alcanza y
  // evita levantar una base para probar el cableado.
  const core = {} as Core

  test('le pasa a cada modulo los servicios de sus dependencias, ya construidos', () => {
    const estructura: Module<{ ramas: string[] }> = {
      name: 'estructura',
      dependencies: [],
      createServices: () => ({ ramas: ['lobatos'] }),
      registerSchema: () => {},
    }
    const personas: Module<{ vistas: string[] }, { estructura: { ramas: string[] } }> = {
      name: 'personas',
      dependencies: ['estructura'],
      createServices: (_core, deps) => ({ vistas: deps.estructura.ramas }),
      registerSchema: () => {},
    }

    const servicios = crearServicios(core, ordenarModulos([personas, estructura]))

    expect(servicios.personas).toEqual({ vistas: ['lobatos'] })
  })

  test('un modulo sin dependencias recibe un objeto vacio', () => {
    const solo: Module<{ ok: boolean }> = {
      name: 'solo',
      dependencies: [],
      createServices: (_core, deps) => ({ ok: Object.keys(deps).length === 0 }),
      registerSchema: () => {},
    }
    expect(crearServicios(core, [solo]).solo).toEqual({ ok: true })
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `bun test packages/core/test/registry.test.ts`
Expected: FAIL — `crearServicios` no está exportado, y `createServices` no acepta un
segundo parámetro.

- [ ] **Step 3: Implementar el contrato**

Reemplazar `packages/core/src/module.ts` entero:

```ts
import type { Builder } from './builder'
import type { Core } from './core'
import type { Migracion } from './migraciones'

/** Un modulo de negocio. Para crear uno nuevo, ver docs/crear-un-modulo.md.
 *  Ojo con el vocabulario: "plugin" en este proyecto significa interceptor de
 *  envelop, no esto.
 *
 *  `D` es lo que este modulo necesita de otros: un objeto con un servicio por
 *  dependencia, tipado contra la interfaz publica que cada uno declara en su
 *  /dominio/publico.ts. Por omision es vacio, y entonces `dependencies` solo
 *  admite la lista vacia, que es lo que declaran los modulos que no dependen
 *  de nadie. */
export interface Module<S = unknown, D = Record<never, never>> {
  readonly name: string
  /** Nombres de otros modulos que este necesita. Ordenan el registro, se
   *  validan al arrancar, y su tipo son las claves de D: un nombre que no este
   *  en D no compila. */
  readonly dependencies: readonly (keyof D & string)[]
  /** Migraciones del modulo, en orden. Opcional: un modulo sin tablas no
   *  deberia tener que declarar una lista vacia para decirlo. */
  readonly migraciones?: readonly Migracion[]
  createServices(core: Core, dependencias: D): S
  registerSchema(builder: Builder): void
}
```

En `packages/core/src/registry.ts`, cambiar la firma de `ordenarModulos` y las tres
anotaciones internas de `Module<any>` a `Module<any, any>`, y agregar al final del archivo:

```ts
/** Crea los servicios de cada modulo, pasandole los de sus dependencias ya
 *  construidos. Espera los modulos ya ordenados por ordenarModulos: si una
 *  dependencia viniera despues, llegaria undefined.
 *
 *  El unico `as` de todo el mecanismo vive aca, que es donde esta la busqueda
 *  por string. Del lado del modulo, createServices(core, deps) esta tipado
 *  contra su propia D y no compila si le falta una. */
// biome-ignore lint/suspicious/noExplicitAny: el registro es agnostico del tipo de servicios
export function crearServicios(core: Core, ordenados: readonly Module<any, any>[]) {
  const servicios: Record<string, unknown> = {}
  for (const modulo of ordenados) {
    const dependencias: Record<string, unknown> = {}
    for (const nombre of modulo.dependencies) dependencias[nombre] = servicios[nombre]
    servicios[modulo.name] = modulo.createServices(core, dependencias)
  }
  return servicios
}
```

Agregar `import type { Core } from './core'` arriba del archivo.

En `packages/core/src/index.ts`, sumar `crearServicios` a la línea del registro:

```ts
export { CicloDeDependencias, crearServicios, DependenciaFaltante, ordenarModulos } from './registry'
```

- [ ] **Step 4: Usarlo en la raíz de composición**

En `services/backend/src/composicion.ts`, reemplazar el bloque que construye los servicios:

```ts
  const servicios = crearServicios(core, ordenados)
  for (const modulo of ordenados) modulo.registerSchema(builder)
```

y sumar `crearServicios` al import de `@gps/core`. La variable `servicios` sigue
alimentando el `contexto` de la línea siguiente, sin cambios.

`packages/demo/test/escenario.test.ts` es el otro lugar que llama `createServices`, y con un
solo argumento. En su `montarContexto`, reemplazar el objeto que devuelve por:

```ts
  // personas depende de estructura, asi que hay que construirla primero y
  // pasarsela: es el mismo cableado que hace crearServicios en la raiz de
  // composicion, a mano porque el test arma su propio contexto.
  const servicioDeEstructura = estructura.createServices(core, {})
  return {
    actor: null,
    estructura: servicioDeEstructura,
    personas: personas.createServices(core, { estructura: servicioDeEstructura }),
  } as Context
```

Hasta la Tarea 8 `personas` no declara su dependencia, así que el segundo argumento sobra
pero no molesta; después de la 8 es obligatorio. Dejarlo puesto desde acá evita tocar el
archivo dos veces.

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `bun test packages/core packages/demo`
Expected: PASS. Los tests viejos de `ordenarModulos` siguen pasando sin tocarlos, porque
`dependencies: []` es válido con la `D` por omisión, y los módulos falsos que definen
`createServices: () => ({})` también: declarar menos parámetros de los que el contrato
permite es legal en TypeScript. Lo que rompe son las **llamadas**, y son dos: `composicion.ts`
y `escenario.test.ts`.

- [ ] **Step 6: `bun run check`**

Run: `bun run check`
Expected: verde.

- [ ] **Step 7: Commit**

```bash
git add packages/core services/backend/src/composicion.ts packages/demo/test/escenario.test.ts
git commit -m "feat(core): Module pasa las dependencias construidas a createServices"
```

---

## Task 3: La interfaz pública de `estructura` y `obtenerGrupo`

**Files:**
- Create: `packages/estructura/src/dominio/publico.ts`
- Modify: `packages/estructura/src/dominio/index.ts`
- Modify: `packages/estructura/src/servidor/servicio.ts`
- Test: `packages/estructura/test/servicio.test.ts`

**Interfaces:**
- Consumes: `GrupoConRamas` de `../dominio/modelos`, `ordenarPorCatalogo` (privada del
  servicio), tablas `grupos` y `ramasDelGrupo`.
- Produces: `interface Estructura { obtenerGrupo(grupoId: string): Promise<GrupoConRamas | null> }`,
  exportada desde `@gps/estructura/dominio`. Las Tareas 4, 7 y 8 la consumen.

- [ ] **Step 1: Escribir el test que falla**

Agregar a `packages/estructura/test/servicio.test.ts`:

```ts
describe('obtenerGrupo', () => {
  test('devuelve el grupo con sus ramas abiertas, ordenadas por catalogo', async () => {
    const { servicio } = montarConBd()
    const distrito = await servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })
    const grupo = await servicio.crearGrupo({
      numero: 42,
      nombre: 'Ceferino Namuncurá',
      distritoId: distrito.id,
    })
    // Se abren desordenadas a proposito: el orden de salida tiene que ser el
    // del catalogo, no el de insercion.
    await servicio.abrirRama(grupo.id, 'scouts')
    await servicio.abrirRama(grupo.id, 'castores')

    expect(await servicio.obtenerGrupo(grupo.id)).toEqual({
      ...grupo,
      ramas: ['castores', 'scouts'],
    })
  })

  test('devuelve null si el grupo no existe', async () => {
    expect(await montarConBd().servicio.obtenerGrupo('grupo_inexistente')).toBeNull()
  })

  test('devuelve null si el grupo esta cerrado', async () => {
    // Para los otros modulos un grupo cerrado no existe, igual que no aparece
    // en listarDistritos. Asi "no se puede inscribir a nadie en un grupo
    // cerrado" no necesita una regla aparte.
    const { servicio } = montarConBd()
    const distrito = await servicio.crearDistrito({ numero: 1, zona: 'Quilmes' })
    const grupo = await servicio.crearGrupo({
      numero: 19,
      nombre: 'San Miguel Arcángel',
      distritoId: distrito.id,
    })
    await servicio.cerrarGrupo(grupo.id)

    expect(await servicio.obtenerGrupo(grupo.id)).toBeNull()
  })

  test('un grupo sin ramas abiertas devuelve la lista vacia', async () => {
    const { servicio } = montarConBd()
    const distrito = await servicio.crearDistrito({ numero: 4, zona: 'Morón' })
    const grupo = await servicio.crearGrupo({
      numero: 88,
      nombre: 'Padre Mario Pantaleo',
      distritoId: distrito.id,
    })
    expect((await servicio.obtenerGrupo(grupo.id))?.ramas).toEqual([])
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `bun test packages/estructura/test/servicio.test.ts`
Expected: FAIL — `obtenerGrupo` no existe en `ServicioDeEstructura`.

- [ ] **Step 3: Escribir la interfaz pública**

Crear `packages/estructura/src/dominio/publico.ts`:

```ts
import type { GrupoConRamas } from './modelos'

/** Lo que estructura le publica a los otros modulos, y nada mas.
 *
 *  Es deliberadamente mas chica que ServicioDeEstructura: crear un distrito o
 *  cerrar un grupo son operaciones de este modulo y de nadie mas. La regla que
 *  esto impone -interfaz publica declarada, contenido privado- es la de los
 *  package interfaces de SAP y la del modificador `global` de Salesforce, y la
 *  mitad que importa es la segunda.
 *
 *  Vive en /dominio y no en /servidor porque /servidor es privado: son tipos
 *  puros, sin estado, que cualquiera puede leer. */
export interface Estructura {
  /** El grupo con sus ramas abiertas, o null si no existe o esta cerrado.
   *
   *  Un grupo cerrado devuelve null igual que no aparece en listarDistritos:
   *  para los otros modulos no existe. Asi "no se puede inscribir a nadie en un
   *  grupo cerrado" sale gratis, sin una regla aparte. El dia que alguien
   *  necesite leer un grupo cerrado -el historial de quien estuvo ahi- se
   *  agrega el metodo que lo diga, con su consumidor. */
  obtenerGrupo(grupoId: string): Promise<GrupoConRamas | null>
}
```

En `packages/estructura/src/dominio/index.ts`, agregar:

```ts
export type { Estructura } from './publico'
```

- [ ] **Step 4: Implementarla en el servicio**

En `packages/estructura/src/servidor/servicio.ts`:

1. Sumar `and` al import de `drizzle-orm`: `import { and, eq, isNull } from 'drizzle-orm'`.
2. Importar la interfaz: `import type { Estructura } from '../dominio/publico'`.
3. Hacer que la interfaz interna la extienda:

```ts
/** Lo que este modulo hace, que es mas que lo que publica: ver Estructura en
 *  /dominio/publico.ts. `extends` es lo que hace que la implementacion no pueda
 *  quedar corta sin que TypeScript se entere. */
export interface ServicioDeEstructura extends Estructura {
  crearDistrito(datos: { numero: number; zona: string }): Promise<Distrito>
  crearGrupo(datos: { numero: number; nombre: string; distritoId: string }): Promise<Grupo>
  abrirRama(grupoId: string, rama: Rama): Promise<void>
  cerrarGrupo(grupoId: string): Promise<void>
  listarDistritos(): Promise<readonly DistritoConGrupos[]>
}
```

4. Agregar el método al objeto que devuelve `crearServicioDeEstructura`, después de
   `cerrarGrupo`:

```ts
    async obtenerGrupo(grupoId) {
      const grupo = core.bd
        .select()
        .from(grupos)
        .where(and(eq(grupos.id, grupoId), isNull(grupos.cerradoEn)))
        .get()
      if (!grupo) return null

      const filas = core.bd
        .select()
        .from(ramasDelGrupo)
        .where(eq(ramasDelGrupo.grupoId, grupoId))
        .all()
      return { ...grupo, ramas: ordenarPorCatalogo(filas.map((fila) => fila.rama)) }
    },
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `bun test packages/estructura`
Expected: PASS, incluidos los cuatro nuevos.

- [ ] **Step 6: `bun run check`**

Run: `bun run check`
Expected: verde.

- [ ] **Step 7: Commit**

```bash
git add packages/estructura
git commit -m "feat(estructura): interfaz publica en dominio/publico.ts y obtenerGrupo"
```

---

## Task 4: La frontera nueva y el dominio de los vínculos

Ésta es la tarea que abre la frontera: cambia la regla del linter, agrega la dependencia de
paquete, y escribe lo primero que la usa —los modelos de `personas` que nombran `Rama`.

**Files:**
- Modify: `biome.json:52-76`
- Modify: `packages/personas/package.json`
- Create: `packages/personas/src/dominio/categorias.ts`
- Create: `packages/personas/src/dominio/cargos.ts`
- Create: `packages/personas/src/dominio/vinculos.ts`
- Modify: `packages/personas/src/dominio/index.ts`
- Test: `packages/personas/test/vinculos.test.ts` (crear)

**Interfaces:**
- Consumes: `Marcas` de `@gps/core`; `Rama` de `@gps/estructura/dominio`; `Persona` de
  `./modelos`.
- Produces: `CATEGORIAS`/`Categoria`/`nombreDeLaCategoria`,
  `TIPOS_DE_CARGO`/`TipoDeCargo`/`nombreDelCargo`, `Pertenencia`, `Cargo`,
  `PersonaConVinculos`, `DatosDeCargo`, `DatosDeIngreso`, `aFechaDeCalendario(instante)`,
  `estaVigente(vinculo, hoy)`. Las Tareas 5 a 12 los consumen.

- [ ] **Step 1: Abrir la frontera en el linter**

En `biome.json`, en el override cuyo `includes` es `["packages/*/src/**", "!packages/demo/**"]`,
reemplazar el segundo patrón (el de `@gps/**`) por:

```json
                  {
                    "group": ["@gps/*/servidor"],
                    "message": "El servidor de un modulo es privado: tiene estado y es la implementacion. Se llega por el contexto (ctx.<modulo>) o por las dependencias de createServices. El /dominio si se puede importar: es la interfaz publica del modulo."
                  }
```

El patrón de `node:*`, `bun` y `bun:*` no se toca. El override de `apps/**` tampoco: ya
decía exactamente esto.

- [ ] **Step 2: Declarar la dependencia de paquete**

En `packages/personas/package.json`, agregar a `dependencies`, en orden alfabético:

```json
    "@gps/estructura": "workspace:*",
```

Run: `bun install`
Expected: enlaza `@gps/estructura` dentro de `packages/personas/node_modules`.

- [ ] **Step 3: Escribir el test que falla**

Crear `packages/personas/test/vinculos.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import { aFechaDeCalendario, estaVigente } from '../src/dominio/vinculos'

/** Un mediodia, no una medianoche: a las 00:00 UTC-3 el dia local y el UTC son
 *  distintos, y eso es lo que este test tiene que poder distinguir. */
const mediodia = (texto: string) => new Date(`${texto}T12:00:00`)

describe('aFechaDeCalendario', () => {
  test('usa los componentes locales, no UTC', () => {
    // toISOString() daria el dia siguiente para una hora nocturna en UTC-3: la
    // fecha de un vinculo es de calendario, no un instante.
    expect(aFechaDeCalendario(new Date(2026, 4, 1, 22, 30))).toBe('2026-05-01')
  })

  test('rellena mes y dia con cero', () => {
    expect(aFechaDeCalendario(new Date(2026, 0, 9))).toBe('2026-01-09')
  })
})

describe('estaVigente', () => {
  const cargo = { desde: '2026-03-01', hasta: '2030-03-01' }

  test('el dia que empieza ya esta vigente', () => {
    expect(estaVigente(cargo, mediodia('2026-03-01'))).toBe(true)
  })

  test('la vispera todavia no', () => {
    expect(estaVigente(cargo, mediodia('2026-02-28'))).toBe(false)
  })

  test('el dia que termina sigue vigente', () => {
    // El `hasta` es inclusivo: un mandato "hasta el 1 de marzo de 2030" incluye
    // ese dia.
    expect(estaVigente(cargo, mediodia('2030-03-01'))).toBe(true)
  })

  test('el dia siguiente al fin ya no', () => {
    expect(estaVigente(cargo, mediodia('2030-03-02'))).toBe(false)
  })

  test('sin hasta, sigue vigente para siempre', () => {
    expect(estaVigente({ desde: '2026-03-01', hasta: null }, mediodia('2099-01-01'))).toBe(true)
  })
})
```

- [ ] **Step 4: Correr el test y verificar que falla**

Run: `bun test packages/personas/test/vinculos.test.ts`
Expected: FAIL — no existe `../src/dominio/vinculos`.

- [ ] **Step 5: Escribir los catálogos**

Crear `packages/personas/src/dominio/categorias.ts`:

```ts
/** Las tres categorias de miembro de un grupo scout. Conjunto cerrado, por eso
 *  es una constante y no una tabla: no hay siembra ni migracion que mantener, y
 *  al vivir en /dominio la comparten el servidor y las pantallas sin traducirla.
 *
 *  Beneficiarios son los que pertenecen a una rama: los chicos, y tambien los
 *  adultos de la rama Adultos, que participan como beneficiarios y no tienen
 *  chicos a cargo -que es justo lo que los distingue de ser dirigentes-.
 *  Activos son los dirigentes, que estan a cargo de las ramas y tambien
 *  pertenecen a una. Adherentes son los adultos a cargo de otras tareas -el
 *  cocinero, el capellan, el director-: no tienen chicos a cargo y no
 *  pertenecen a ninguna rama.
 *
 *  Agregar una entrada es cambio solo de codigo. Sacar o renombrar una NO lo
 *  es: la tabla pertenencias sigue guardando el id viejo. */
export const CATEGORIAS = [
  { id: 'beneficiario', nombre: 'Beneficiario' },
  { id: 'activo', nombre: 'Activo' },
  { id: 'adherente', nombre: 'Adherente' },
] as const

export type Categoria = (typeof CATEGORIAS)[number]['id']

/** Como la pantalla nombra la categoria. Vive en el dominio y no en cada
 *  pantalla por la misma razon que nombreDelTipo y etiquetaDeEdades: es
 *  presentacion del dominio, y dos copias divergen sin que nadie se entere. */
export function nombreDeLaCategoria(categoria: Categoria): string {
  return CATEGORIAS.find((candidata) => candidata.id === categoria)?.nombre ?? categoria
}
```

Crear `packages/personas/src/dominio/cargos.ts`:

```ts
/** Los cargos de un grupo scout. Mismo patron que CATEGORIAS y que RAMAS.
 *
 *  Es un catalogo y no una tabla a proposito, y la razon no es cuantos hay sino
 *  quien crea uno. Si fuera una fila, TipoDeCargo no podria ser un enum de
 *  GraphQL -se fijan al componer el esquema-, el <select> necesitaria su propia
 *  query, y sobre todo cualquier codigo que nombre un cargo necesitaria un id
 *  estable. Y los va a nombrar: el director firma los permisos de acampe, y
 *  Alcance va a mapear cargos a roles. Un cargo con id de core.nuevoId() el
 *  codigo no lo puede nombrar.
 *
 *  Lo que si es abierto son los equipos -tesoreria, formacion-: a esos los crea
 *  alguien y ningun codigo los nombra de a uno. Eso va a ser una tabla, en la
 *  iteracion que los traiga.
 *
 *  Solo los del grupo. Los distritales, diocesanos y de equipo llegan con el
 *  ambito que los necesita.
 *
 *  `director` es el sacerdote a cargo del grupo. No se valida contra la
 *  categoria: en la practica es adherente y el jefe de grupo es activo, pero
 *  eso es un hecho del mundo, no una regla que el sistema imponga. */
export const TIPOS_DE_CARGO = [
  { id: 'jefeDeGrupo', nombre: 'Jefe/Jefa de grupo' },
  { id: 'subjefeDeGrupo', nombre: 'Subjefe/Subjefa de grupo' },
  { id: 'jefeDeRama', nombre: 'Jefe/Jefa de rama' },
  { id: 'capellan', nombre: 'Capellán' },
  { id: 'director', nombre: 'Director' },
] as const

export type TipoDeCargo = (typeof TIPOS_DE_CARGO)[number]['id']

export function nombreDelCargo(cargo: TipoDeCargo): string {
  return TIPOS_DE_CARGO.find((candidato) => candidato.id === cargo)?.nombre ?? cargo
}
```

- [ ] **Step 6: Escribir los vínculos**

Crear `packages/personas/src/dominio/vinculos.ts`:

```ts
import type { Marcas } from '@gps/core'
import type { Rama } from '@gps/estructura/dominio'
import type { TipoDeCargo } from './cargos'
import type { Categoria } from './categorias'
import type { Persona } from './modelos'

/** La pertenencia de una persona a un grupo. Es un hecho propio y continuo, con
 *  alta y baja en cualquier momento: no se deriva de la afiliacion, que es
 *  anual (spec base §13.6). */
export interface Pertenencia extends Marcas {
  readonly id: string
  readonly personaId: string
  readonly grupoId: string
  readonly categoria: Categoria
  /** null si y solo si la categoria es adherente: el adherente es el que no
   *  esta en ninguna rama, y es justo lo que lo define. */
  readonly rama: Rama | null
  /** aaaa-mm-dd. Texto y no Date por la misma razon que fechaDeNacimiento: se
   *  ingresa a un grupo un dia del almanaque, no en un instante con zona
   *  horaria. Ver el comentario en modelos.ts. */
  readonly desde: string
  /** aaaa-mm-dd, null si sigue vigente.
   *
   *  Una pertenencia no tiene mandato: el hasta se escribe el dia de la baja y
   *  nunca esta en el futuro. Es la diferencia con Cargo, y es la que hace que
   *  el indice parcial de la tabla pueda decir "una persona, un grupo". */
  readonly hasta: string | null
}

/** Un cargo de una persona en un grupo, con su periodo. */
export interface Cargo extends Marcas {
  readonly id: string
  readonly personaId: string
  /** El grupo del cargo, propio y no derivado de la pertenencia vigente: con
   *  historial, quien se muda tiene dos pertenencias y el cargo pertenece a una
   *  de las dos. Sin esta columna, cerrar una pertenencia cambiaria
   *  retroactivamente el ambito de todos sus cargos. */
  readonly grupoId: string
  readonly cargo: TipoDeCargo
  readonly desde: string
  /** aaaa-mm-dd, null si no tiene fin previsto. A diferencia del de una
   *  Pertenencia, este puede estar en el futuro: un mandato dura cuatro anios y
   *  su fin se conoce el dia que empieza. */
  readonly hasta: string | null
}

/** Una persona con sus vinculos vigentes: lo que devuelve el servicio y lo que
 *  consume la pantalla del grupo. */
export interface PersonaConVinculos extends Persona {
  readonly pertenencia: Pertenencia
  readonly cargos: readonly Cargo[]
}

/** Lo propio de un cargo en el alta. No lleva `desde`: el del cargo es el de la
 *  pertenencia, asi el formulario no pide la misma fecha cinco veces. */
export type DatosDeCargo = Omit<Cargo, 'id' | 'personaId' | 'grupoId' | 'desde' | keyof Marcas>

/** Lo que entra por el alta ademas de los datos personales. Derivado de
 *  Pertenencia por la misma razon que DatosDePersona sale de Persona: agregar un
 *  campo mas adelante no se olvida en la mitad de los lugares. */
export interface DatosDeIngreso
  extends Omit<Pertenencia, 'id' | 'personaId' | 'hasta' | keyof Marcas> {
  readonly cargos: readonly DatosDeCargo[]
}

/** La fecha de calendario de un instante, segun el almanaque de quien lo mira.
 *
 *  Componentes locales y no toISOString por lo mismo que calcularEdad: en UTC-3
 *  el 1 de mayo a las 22:00 seria el 2 de mayo en UTC. */
export function aFechaDeCalendario(instante: Date): string {
  const mes = `${instante.getMonth() + 1}`.padStart(2, '0')
  const dia = `${instante.getDate()}`.padStart(2, '0')
  return `${instante.getFullYear()}-${mes}-${dia}`
}

/** Si el vinculo esta vigente el dia `hoy`, con las dos puntas incluidas.
 *
 *  `hoy` entra por parametro y no se lee del reloj. Ademas de la regla de
 *  portabilidad: el "hoy" correcto es el de quien mira la pantalla, no el del
 *  servidor. Por eso el servidor no filtra por vigencia y manda las filas con
 *  sus fechas, igual que no expone `edad` y la calcula el cliente.
 *
 *  Compara texto contra texto: aaaa-mm-dd ordena igual lexicografica que
 *  cronologicamente, asi que no hay nada que parsear. */
export function estaVigente(vinculo: { desde: string; hasta: string | null }, hoy: Date): boolean {
  const dia = aFechaDeCalendario(hoy)
  return vinculo.desde <= dia && (vinculo.hasta === null || dia <= vinculo.hasta)
}
```

- [ ] **Step 7: Exportarlos desde el índice**

En `packages/personas/src/dominio/index.ts`, agregar las líneas nuevas manteniendo el orden
alfabético por módulo que ya tiene el archivo:

```ts
export type { TipoDeCargo } from './cargos'
export { nombreDelCargo, TIPOS_DE_CARGO } from './cargos'
export type { Categoria } from './categorias'
export { CATEGORIAS, nombreDeLaCategoria } from './categorias'
export type {
  Cargo,
  DatosDeCargo,
  DatosDeIngreso,
  Pertenencia,
  PersonaConVinculos,
} from './vinculos'
export { aFechaDeCalendario, estaVigente } from './vinculos'
```

- [ ] **Step 8: Correr los tests y verificar que pasan**

Run: `bun test packages/personas/test/vinculos.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 9: Verificar que la regla nueva sigue prohibiendo lo que tiene que prohibir**

Agregar temporalmente `import '@gps/estructura/servidor'` al principio de
`packages/personas/src/dominio/vinculos.ts` y correr:

Run: `bun run lint`
Expected: error de `noRestrictedImports` con el mensaje nuevo. **Sacar la línea después de
verificarlo.**

- [ ] **Step 10: `bun run check`**

Run: `bun run check`
Expected: verde.

- [ ] **Step 11: Commit**

```bash
git add biome.json bun.lock packages/personas
git commit -m "feat(personas): catalogos y modelos de pertenencia y cargos

La frontera pasa a prohibir @gps/*/servidor en vez del paquete entero: el
servidor de un modulo es privado, el /dominio es su interfaz publica."
```

---

## Task 5: `validarIngreso`

**Files:**
- Modify: `packages/personas/src/dominio/validaciones.ts`
- Modify: `packages/personas/src/dominio/index.ts`
- Test: `packages/personas/test/validaciones.test.ts`

**Interfaces:**
- Consumes: `DatosDeIngreso`, `aFechaDeCalendario` de `./vinculos`; `nombreDelCargo` de
  `./cargos`; `Rama` de `@gps/estructura/dominio`; `esFechaDeCalendario`, privada del
  mismo archivo.
- Produces: `validarIngreso(ingreso, ramasAbiertas, hoy): readonly Problema[]`, y el tipo
  `Problema` con la unión de campos ampliada. Las Tareas 7, 11 y 12 lo consumen.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar a `packages/personas/test/validaciones.test.ts`:

```ts
import { validarIngreso } from '../src/dominio/validaciones'
import type { DatosDeIngreso } from '../src/dominio/vinculos'

// El reloj de los tests esta en 1970, asi que un ingreso valido tiene que ser
// anterior. Es incomodo y es a proposito: obliga a que se note si alguien se
// cuelga la hora real.
const HOY = new Date(1970, 0, 1, 12)

const ingreso: DatosDeIngreso = {
  grupoId: 'grupo_1',
  categoria: 'beneficiario',
  rama: 'lobatos',
  desde: '1969-03-01',
  cargos: [],
}

const ABIERTAS = ['lobatos', 'scouts'] as const

const campos = (problemas: readonly { campo: string }[]) => problemas.map((p) => p.campo)

describe('validarIngreso', () => {
  test('un ingreso completo no tiene problemas', () => {
    expect(validarIngreso(ingreso, ABIERTAS, HOY)).toEqual([])
  })

  test('un beneficiario sin rama es un dato incompleto', () => {
    expect(campos(validarIngreso({ ...ingreso, rama: null }, ABIERTAS, HOY))).toEqual(['rama'])
  })

  test('un activo sin rama tambien: hasta el jefe de grupo da en alguna', () => {
    const activo = { ...ingreso, categoria: 'activo' as const, rama: null }
    expect(campos(validarIngreso(activo, ABIERTAS, HOY))).toEqual(['rama'])
  })

  test('un adherente con rama es una contradiccion', () => {
    const adherente = { ...ingreso, categoria: 'adherente' as const }
    expect(campos(validarIngreso(adherente, ABIERTAS, HOY))).toEqual(['rama'])
  })

  test('un adherente sin rama esta bien', () => {
    const adherente = { ...ingreso, categoria: 'adherente' as const, rama: null }
    expect(validarIngreso(adherente, ABIERTAS, HOY)).toEqual([])
  })

  test('la rama tiene que estar abierta en ese grupo', () => {
    // Es la regla que el servidor no podia verificar antes de que un modulo
    // pudiera alcanzar al otro.
    expect(campos(validarIngreso({ ...ingreso, rama: 'castores' }, ABIERTAS, HOY))).toEqual([
      'rama',
    ])
  })

  test('la fecha de ingreso tiene que ser del almanaque', () => {
    expect(campos(validarIngreso({ ...ingreso, desde: '1969-02-30' }, ABIERTAS, HOY))).toEqual([
      'desde',
    ])
  })

  test('la fecha de ingreso no puede ser futura', () => {
    expect(campos(validarIngreso({ ...ingreso, desde: '1971-01-01' }, ABIERTAS, HOY))).toEqual([
      'desde',
    ])
  })

  test('el mismo cargo no puede ir dos veces', () => {
    const cargos = [
      { cargo: 'jefeDeRama' as const, hasta: null },
      { cargo: 'jefeDeRama' as const, hasta: null },
    ]
    expect(campos(validarIngreso({ ...ingreso, cargos }, ABIERTAS, HOY))).toEqual(['cargos'])
  })

  test('un cargo puede terminar en el futuro: un mandato dura cuatro anios', () => {
    const cargos = [{ cargo: 'jefeDeGrupo' as const, hasta: '1973-03-01' }]
    expect(validarIngreso({ ...ingreso, cargos }, ABIERTAS, HOY)).toEqual([])
  })

  test('un cargo no puede terminar antes de empezar', () => {
    const cargos = [{ cargo: 'jefeDeGrupo' as const, hasta: '1968-01-01' }]
    expect(campos(validarIngreso({ ...ingreso, cargos }, ABIERTAS, HOY))).toEqual(['cargos'])
  })

  test('acumula: no corta en el primer problema', () => {
    const roto = { ...ingreso, rama: 'castores' as const, desde: '1971-01-01' }
    expect(campos(validarIngreso(roto, ABIERTAS, HOY))).toEqual(['rama', 'desde'])
  })
})
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `bun test packages/personas/test/validaciones.test.ts`
Expected: FAIL — `validarIngreso` no está exportado.

- [ ] **Step 3: Ampliar `Problema` y escribir la función**

En `packages/personas/src/dominio/validaciones.ts`, reemplazar la interfaz `Problema`:

```ts
/** Un problema de validacion, atado a su campo. Por campo y no una lista de
 *  strings sueltos porque el formulario tiene que marcar el input que falla: un
 *  cartel generico arriba obliga a leer y adivinar cual era.
 *
 *  Ni tipoDeDocumento ni categoria estan en la union: no pueden fallar, lo
 *  garantizan sus tipos del lado de TypeScript y sus enums del lado de GraphQL. */
export interface Problema {
  readonly campo:
    | 'numeroDeDocumento'
    | 'nombres'
    | 'apellidos'
    | 'fechaDeNacimiento'
    | 'rama'
    | 'desde'
    | 'cargos'
  readonly mensaje: string
}
```

Sumar los imports que faltan arriba del archivo:

```ts
import type { Rama } from '@gps/estructura/dominio'
import { nombreDelCargo, type TipoDeCargo } from './cargos'
import { aFechaDeCalendario, type DatosDeIngreso } from './vinculos'
```

Y agregar al final del archivo:

```ts
/** Las reglas que tiene que cumplir el ingreso de una persona a un grupo.
 *  Devuelve la lista de problemas, vacia si esta todo bien. Acumula: no corta
 *  en el primero.
 *
 *  `ramasAbiertas` entra por parametro y no se consulta: del lado del servidor
 *  sale de estructura.obtenerGrupo(grupoId), y del lado del formulario del
 *  arbol que la pantalla ya tiene. Es lo que hace que la regla corra en los dos
 *  lados con una sola implementacion, igual que validarPersona. */
export function validarIngreso(
  ingreso: DatosDeIngreso,
  ramasAbiertas: readonly Rama[],
  hoy: Date,
): readonly Problema[] {
  const problemas: Problema[] = []
  const esAdherente = ingreso.categoria === 'adherente'

  if (esAdherente && ingreso.rama !== null) {
    problemas.push({
      campo: 'rama',
      mensaje: 'Un adherente no pertenece a ninguna rama.',
    })
  } else if (!esAdherente && ingreso.rama === null) {
    problemas.push({ campo: 'rama', mensaje: 'Elegí la rama a la que pertenece.' })
  } else if (ingreso.rama !== null && !ramasAbiertas.includes(ingreso.rama)) {
    problemas.push({ campo: 'rama', mensaje: 'El grupo no tiene abierta esa rama.' })
  }

  if (!esFechaDeCalendario(ingreso.desde)) {
    problemas.push({
      campo: 'desde',
      mensaje: 'La fecha de ingreso tiene que ser una fecha real, con formato aaaa-mm-dd.',
    })
  } else if (ingreso.desde > aFechaDeCalendario(hoy)) {
    problemas.push({ campo: 'desde', mensaje: 'La fecha de ingreso no puede ser futura.' })
  }

  const vistos = new Set<TipoDeCargo>()
  for (const cargo of ingreso.cargos) {
    const nombre = nombreDelCargo(cargo.cargo)
    if (vistos.has(cargo.cargo)) {
      problemas.push({ campo: 'cargos', mensaje: `${nombre} está cargado dos veces.` })
    }
    vistos.add(cargo.cargo)

    if (cargo.hasta === null) continue
    if (!esFechaDeCalendario(cargo.hasta)) {
      problemas.push({
        campo: 'cargos',
        mensaje: `La fecha de fin de ${nombre} tiene que ser una fecha real, con formato aaaa-mm-dd.`,
      })
    } else if (cargo.hasta <= ingreso.desde) {
      // No se exige que este en el futuro: cargar un mandato ya vencido es
      // valido, es historial.
      problemas.push({ campo: 'cargos', mensaje: `${nombre} no puede terminar antes de empezar.` })
    }
  }

  return problemas
}
```

En `packages/personas/src/dominio/index.ts`, sumar `validarIngreso` a la línea que ya
exporta `validarPersona`.

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `bun test packages/personas`
Expected: PASS, incluidos los 12 nuevos y los viejos de `validarPersona` sin tocar.

- [ ] **Step 5: `bun run check`**

Run: `bun run check`
Expected: verde.

- [ ] **Step 6: Commit**

```bash
git add packages/personas
git commit -m "feat(personas): validarIngreso, con la rama abierta del grupo"
```

---

## Task 6: Las tablas y la migración

**Files:**
- Modify: `packages/personas/src/servidor/tablas.ts`
- Create: `packages/personas/migraciones/0001_pertenencias_y_cargos.sql` (drizzle-kit)
- Modify: `packages/personas/src/servidor/migraciones.ts`
- Test: `packages/personas/test/migraciones.test.ts`

**Interfaces:**
- Consumes: `Categoria`, `TipoDeCargo` de `/dominio`; `Rama` de `@gps/estructura/dominio`;
  la tabla `personas` que ya existe en el mismo archivo.
- Produces: las tablas `pertenencias` y `cargos` de Drizzle. La Tarea 7 las consume.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar a `packages/personas/test/migraciones.test.ts`:

```ts
const insertarPertenencia = (id: string, personaId: string, hasta: string | null) =>
  bd.run(
    sql`INSERT INTO pertenencias
        VALUES (${id}, ${personaId}, 'grupo_1', 'beneficiario', 'lobatos', '2026-03-01', ${hasta}, 0, 0)`,
  )

describe('pertenencias y cargos', () => {
  test('crea las tablas del modulo', () => {
    const nombres = bd
      .values<[string]>(sql`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`)
      .map(([nombre]) => nombre)
    expect(nombres).toEqual(['cargos', 'migraciones', 'personas', 'pertenencias'])
  })

  test('una persona no puede tener dos pertenencias vigentes', () => {
    // Es "una persona, un grupo" puesto en la base, no en una regla que haya
    // que acordarse de escribir.
    insertar('p1', 'dni', '30111222')
    insertarPertenencia('pe1', 'p1', null)
    expect(() => insertarPertenencia('pe2', 'p1', null)).toThrow()
  })

  test('pero si muchas cerradas, que es el historial', () => {
    // El indice es parcial: solo mira las filas con hasta IS NULL.
    insertar('p1', 'dni', '30111222')
    insertarPertenencia('pe1', 'p1', '2020-12-31')
    insertarPertenencia('pe2', 'p1', '2023-12-31')
    expect(() => insertarPertenencia('pe3', 'p1', null)).not.toThrow()
  })

  test('el mismo cargo no se puede cargar dos veces con la misma fecha', () => {
    // Lo que ataja es el doble click en Guardar. El solapamiento de periodos
    // SQLite no lo puede expresar sin un trigger; ver §7.3 de la spec.
    insertar('p1', 'dni', '30111222')
    const insertarCargo = (id: string) =>
      bd.run(
        sql`INSERT INTO cargos
            VALUES (${id}, 'p1', 'grupo_1', 'jefeDeGrupo', '2026-03-01', NULL, 0, 0)`,
      )
    insertarCargo('c1')
    expect(() => insertarCargo('c2')).toThrow()
  })

  test('las fechas de los vinculos son texto, no enteros', () => {
    // Es la decision de dominio que mas facil se pierde en una migracion
    // regenerada sin mirar: si vuelven a ser integer, vuelven a ser instantes
    // y con ellos la zona horaria.
    const columnas = bd.all<{ name: string; type: string }>(sql`PRAGMA table_info(pertenencias)`)
    expect(columnas.find((columna) => columna.name === 'desde')?.type).toBe('TEXT')
    expect(columnas.find((columna) => columna.name === 'hasta')?.type).toBe('TEXT')
  })

  test('aplica las dos migraciones del modulo', () => {
    const aplicadas = bd
      .values<[string]>(sql`SELECT nombre FROM migraciones ORDER BY nombre`)
      .map(([nombre]) => nombre)
    expect(aplicadas).toEqual(['0000_inicial', '0001_pertenencias_y_cargos'])
  })
})
```

En el test que ya existe, `'crea la tabla del modulo'`, ajustar la aserción: ahora hay
cuatro tablas. Reemplazarlo por el `'crea las tablas del modulo'` de arriba y borrar el
viejo. Lo mismo con `'aplica la migracion del modulo'`, que esperaba una sola.

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `bun test packages/personas/test/migraciones.test.ts`
Expected: FAIL — las tablas no existen.

- [ ] **Step 3: Declarar las tablas**

En `packages/personas/src/servidor/tablas.ts`, sumar a los imports:

```ts
import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text, unique, uniqueIndex } from 'drizzle-orm/sqlite-core'
import type { Rama } from '@gps/estructura/dominio'
import type { TipoDeCargo } from '../dominio/cargos'
import type { Categoria } from '../dominio/categorias'
```

Y agregar al final:

```ts
/** La pertenencia de una persona a un grupo, con su periodo.
 *
 *  `grupo_id` va sin foreign key: la tabla `grupos` es de estructura y
 *  declararla exigiria importar su tablas.ts, que es privado. La integridad la
 *  da obtenerGrupo en el alta. Es una perdida real y consciente; ver §7.4 de la
 *  spec. Contra `personas`, en cambio, la foreign key va: es del mismo modulo.
 *
 *  El indice parcial es "una persona pertenece a un solo grupo" puesto en la
 *  base. Funciona porque una pertenencia no tiene mandato: su `hasta` se
 *  escribe el dia de la baja y nunca esta en el futuro, asi que `hasta IS NULL`
 *  y "vigente" son lo mismo. Y sigue permitiendo todas las pertenencias
 *  cerradas que haga falta, que es el historial. */
export const pertenencias = sqliteTable(
  'pertenencias',
  {
    id: text('id').primaryKey(),
    personaId: text('persona_id')
      .notNull()
      .references(() => personas.id),
    grupoId: text('grupo_id').notNull(),
    categoria: text('categoria').$type<Categoria>().notNull(),
    rama: text('rama').$type<Rama>(),
    desde: text('desde').notNull(),
    hasta: text('hasta'),
    ...marcas,
  },
  (tabla) => [
    uniqueIndex('pertenencia_vigente_por_persona')
      .on(tabla.personaId)
      .where(sql`hasta is null`),
  ],
)

/** Los cargos de una persona en un grupo, con su periodo.
 *
 *  A diferencia de `pertenencias`, el UNIQUE es completo y no parcial: un cargo
 *  puede nacer con su `hasta` puesto cuatro anios adelante -un mandato-, asi
 *  que `WHERE hasta IS NULL` no seleccionaria los vigentes y un indice parcial
 *  no impediria nada. Lo que este ataja es el duplicado exacto, que es el
 *  error que de verdad ocurre: el doble click en Guardar. */
export const cargos = sqliteTable(
  'cargos',
  {
    id: text('id').primaryKey(),
    personaId: text('persona_id')
      .notNull()
      .references(() => personas.id),
    grupoId: text('grupo_id').notNull(),
    cargo: text('cargo').$type<TipoDeCargo>().notNull(),
    desde: text('desde').notNull(),
    hasta: text('hasta'),
    ...marcas,
  },
  (tabla) => [unique().on(tabla.personaId, tabla.grupoId, tabla.cargo, tabla.desde)],
)
```

- [ ] **Step 4: Generar la migración**

Run: `cd packages/personas && bunx drizzle-kit generate --name pertenencias_y_cargos && cd ../..`
Expected: crea `packages/personas/migraciones/0001_pertenencias_y_cargos.sql` y actualiza
`meta/_journal.json` y `meta/0001_snapshot.json`.

Abrir el `.sql` generado y verificar tres cosas: que sean dos `CREATE TABLE` y dos índices
(sin ningún `DROP` ni recreación de `personas`), que `desde` y `hasta` sean `text`, y que el
índice de `pertenencias` lleve su `where "hasta" is null`.

- [ ] **Step 5: Sumarla a la lista**

En `packages/personas/src/servidor/migraciones.ts`:

```ts
import inicial from '../../migraciones/0000_inicial.sql' with { type: 'text' }
import pertenenciasYCargos from '../../migraciones/0001_pertenencias_y_cargos.sql' with { type: 'text' }
```

```ts
export const migraciones: readonly Migracion[] = [
  { nombre: '0000_inicial', sql: inicial },
  { nombre: '0001_pertenencias_y_cargos', sql: pertenenciasYCargos },
]
```

- [ ] **Step 6: Correr los tests y verificar que pasan**

Run: `bun test packages/personas/test/migraciones.test.ts`
Expected: PASS. Si el índice parcial no se generó, el test
`'pero si muchas cerradas, que es el historial'` falla: revisar el `.where()` de la Tarea 6
Step 3 y regenerar.

- [ ] **Step 7: `bun run check`**

Run: `bun run check`
Expected: verde.

- [ ] **Step 8: Commit**

```bash
git add packages/personas
git commit -m "feat(personas): tablas pertenencias y cargos, con historial"
```

---

## Task 7: El servicio

**Files:**
- Modify: `packages/personas/src/servidor/servicio.ts`
- Test: `packages/personas/test/servicio.test.ts`

**Interfaces:**
- Consumes: `Estructura` de `@gps/estructura/dominio`; `DatosDeIngreso`, `Pertenencia`,
  `Cargo`, `PersonaConVinculos` de `../dominio/vinculos`; `validarIngreso`; las tablas de
  la Tarea 6.
- Produces: `crearServicioDePersonas(core, estructura)`, `ServicioDePersonas` con
  `crearPersona(datos, ingreso): Promise<PersonaConVinculos>` y
  `listarPersonas(grupoId): Promise<readonly PersonaConVinculos[]>`, y
  `class GrupoInexistente`. Las Tareas 8, 9 y 13 los consumen.

- [ ] **Step 1: Escribir los tests que fallan**

Reemplazar el helper `montar` de `packages/personas/test/servicio.test.ts` por uno que
recibe la estructura falsa, y agregar los casos nuevos:

```ts
import type { Estructura, GrupoConRamas } from '@gps/estructura/dominio'
import type { DatosDeIngreso } from '../src/dominio/vinculos'
import { GrupoInexistente } from '../src/servidor/servicio'

const GRUPO: GrupoConRamas = {
  id: 'grupo_1',
  numero: 42,
  nombre: 'Ceferino Namuncurá',
  distritoId: 'distrito_1',
  cerradoEn: null,
  creadoEn: HORA,
  actualizadoEn: HORA,
  ramas: ['lobatos', 'scouts'],
}

/** Una estructura falsa: el servicio la recibe por el constructor, no por el
 *  contexto, asi que el test no necesita levantar el otro modulo. Es lo que
 *  hace testeable la dependencia entre modulos. */
function estructuraFalsa(grupos: readonly GrupoConRamas[] = [GRUPO]): Estructura {
  return { obtenerGrupo: async (id) => grupos.find((grupo) => grupo.id === id) ?? null }
}

function montar(
  reloj: Reloj = { ahora: () => HORA },
  estructura: Estructura = estructuraFalsa(),
): ServicioDePersonas {
  const base = new Database(':memory:')
  base.exec('PRAGMA foreign_keys = ON')
  const bd: Bd = drizzle(base)

  let contador = 0
  const core: Core = {
    config: { version: '0.0.0', entorno: 'prueba', puerto: 0 },
    logger: { info: () => {}, error: () => {} },
    reloj,
    bd,
    modulos: ['estructura', 'personas'],
    nuevoId: (prefijo) => `${prefijo}_${++contador}`,
  }

  const modulo: Module<object> = {
    name: 'personas',
    dependencies: [],
    migraciones,
    createServices: () => ({}),
    registerSchema: () => {},
  }
  aplicarMigraciones(core, [modulo])
  return crearServicioDePersonas(core, estructura)
}

const ingreso: DatosDeIngreso = {
  grupoId: 'grupo_1',
  categoria: 'beneficiario',
  rama: 'lobatos',
  desde: '1969-03-01',
  cargos: [],
}

describe('crearPersona con ingreso', () => {
  test('devuelve la persona con su pertenencia y sus cargos', async () => {
    const servicio = montar()
    const persona = await servicio.crearPersona(valida, {
      ...ingreso,
      cargos: [{ cargo: 'jefeDeRama', hasta: '1973-03-01' }],
    })

    expect(persona.pertenencia).toEqual({
      id: 'pertenencia_2',
      personaId: 'persona_1',
      grupoId: 'grupo_1',
      categoria: 'beneficiario',
      rama: 'lobatos',
      desde: '1969-03-01',
      hasta: null,
      creadoEn: HORA,
      actualizadoEn: HORA,
    })
    expect(persona.cargos).toEqual([
      {
        id: 'cargo_3',
        personaId: 'persona_1',
        grupoId: 'grupo_1',
        cargo: 'jefeDeRama',
        // El desde del cargo es el de la pertenencia: el formulario no pide la
        // misma fecha dos veces.
        desde: '1969-03-01',
        hasta: '1973-03-01',
        creadoEn: HORA,
        actualizadoEn: HORA,
      },
    ])
  })

  test('falla si el grupo no existe', async () => {
    const servicio = montar(undefined, estructuraFalsa([]))
    // `await` obligatorio: sin el, la asercion no se espera, el test pasa aunque
    // la promesa se resuelva bien, y ademas queda un rechazo sin manejar.
    await expect(servicio.crearPersona(valida, ingreso)).rejects.toThrow(GrupoInexistente)
  })

  test('falla si la rama no esta abierta en ese grupo', async () => {
    // La regla que el servidor no podia verificar antes de que un modulo
    // pudiera alcanzar al otro.
    const servicio = montar()
    await expect(servicio.crearPersona(valida, { ...ingreso, rama: 'castores' })).rejects.toThrow(
      DatosInvalidos,
    )
  })

  test('un ingreso invalido no deja la persona escrita a medias', async () => {
    // Las tres escrituras van en una transaccion: una persona sin pertenencia
    // no aparece en ninguna pantalla, porque la unica query filtra por grupo.
    const servicio = montar()
    await expect(servicio.crearPersona(valida, { ...ingreso, rama: 'castores' })).rejects.toThrow()
    expect(await servicio.listarPersonas('grupo_1')).toEqual([])
  })
})

describe('listarPersonas', () => {
  test('devuelve solo las del grupo pedido', async () => {
    const otroGrupo: GrupoConRamas = { ...GRUPO, id: 'grupo_2', numero: 7, ramas: ['lobatos'] }
    const servicio = montar(undefined, estructuraFalsa([GRUPO, otroGrupo]))
    await servicio.crearPersona(valida, ingreso)
    await servicio.crearPersona(
      { ...valida, numeroDeDocumento: '30111223' },
      { ...ingreso, grupoId: 'grupo_2' },
    )

    const delPrimero = await servicio.listarPersonas('grupo_1')
    expect(delPrimero.map((persona) => persona.numeroDeDocumento)).toEqual(['30111222'])
  })

  test('ordena por apellido con el alfabeto castellano', async () => {
    const servicio = montar()
    await servicio.crearPersona({ ...valida, apellidos: 'Zaballa' }, ingreso)
    await servicio.crearPersona(
      { ...valida, numeroDeDocumento: '30111223', apellidos: 'Ávila' },
      ingreso,
    )
    // Con un ORDER BY de SQLite, que compara bytes, "Ávila" caeria despues de
    // "Zaballa".
    expect((await servicio.listarPersonas('grupo_1')).map((p) => p.apellidos)).toEqual([
      'Ávila',
      'Zaballa',
    ])
  })

  test('trae los cargos de cada persona, tambien los vencidos', async () => {
    // El servidor no filtra por vigencia: manda las filas con sus fechas y la
    // pantalla aplica su propio almanaque con estaVigente.
    const servicio = montar()
    await servicio.crearPersona(valida, {
      ...ingreso,
      cargos: [
        { cargo: 'jefeDeGrupo', hasta: '1969-12-31' },
        { cargo: 'jefeDeRama', hasta: null },
      ],
    })
    const [persona] = await servicio.listarPersonas('grupo_1')
    expect(persona?.cargos.map((cargo) => cargo.cargo)).toEqual(['jefeDeGrupo', 'jefeDeRama'])
  })

  test('un grupo sin nadie devuelve la lista vacia', async () => {
    expect(await montar().listarPersonas('grupo_1')).toEqual([])
  })
})
```

Los tests viejos de `crearPersona` que llamaban con un solo argumento hay que actualizarlos:
pasarles `ingreso` como segundo parámetro. Sus aserciones sobre el documento duplicado y las
validaciones de datos personales no cambian.

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `bun test packages/personas/test/servicio.test.ts`
Expected: FAIL — `crearServicioDePersonas` recibe un solo argumento y `GrupoInexistente` no
existe.

- [ ] **Step 3: Implementar**

En `packages/personas/src/servidor/servicio.ts`, sumar a los imports:

```ts
import type { Estructura } from '@gps/estructura/dominio'
import { and, eq, isNull } from 'drizzle-orm'
import type { Cargo, DatosDeIngreso, Pertenencia, PersonaConVinculos } from '../dominio/vinculos'
import { type Problema, validarIngreso, validarPersona } from '../dominio/validaciones'
import { cargos as tablaDeCargos, pertenencias, personas } from './tablas'
```

Agregar el error nuevo, al lado de los dos que ya están:

```ts
/** El grupo del ingreso no existe, o esta cerrado. */
export class GrupoInexistente extends Error {
  constructor(grupoId: string) {
    super('El grupo al que se quiere inscribir no existe o está cerrado.')
    this.name = 'GrupoInexistente'
    this.grupoId = grupoId
  }
  readonly grupoId: string
}
```

Cambiar la interfaz y la firma de la fábrica:

```ts
export interface ServicioDePersonas {
  crearPersona(datos: DatosDePersona, ingreso: DatosDeIngreso): Promise<PersonaConVinculos>
  /** Las personas con pertenencia vigente en ese grupo, ordenadas por apellido. */
  listarPersonas(grupoId: string): Promise<readonly PersonaConVinculos[]>
}

/** `estructura` entra por el constructor y no por el contexto: es una
 *  dependencia declarada del modulo, que la raiz de composicion le pasa ya
 *  construida (ver Module<S, D> en core). Asi el servicio la puede usar sin
 *  saber si hay un request encima, que es lo que le permite correr dentro del
 *  telefono. */
export function crearServicioDePersonas(core: Core, estructura: Estructura): ServicioDePersonas {
```

Reemplazar el cuerpo de `crearPersona`:

```ts
    async crearPersona(datos, ingreso) {
      // Primero el grupo: sin el no se pueden validar ni la rama ni la
      // existencia del destino, y no tiene sentido validar lo demas.
      const grupo = await estructura.obtenerGrupo(ingreso.grupoId)
      if (!grupo) throw new GrupoInexistente(ingreso.grupoId)

      const hoy = core.reloj.ahora()
      const problemas: readonly Problema[] = [
        ...validarPersona(datos, hoy),
        ...validarIngreso(ingreso, grupo.ramas, hoy),
      ]
      if (problemas.length > 0) throw new DatosInvalidos(problemas)

      const numeroDeDocumento = normalizarNumero(datos.numeroDeDocumento)

      // Este SELECT no es la garantia -dos altas simultaneas lo pasan las dos- y
      // no hace falta que lo sea: el UNIQUE de la tabla es el que garantiza.
      // Existe solo para el mensaje.
      const yaEsta = core.bd
        .select({ id: personas.id })
        .from(personas)
        .where(
          and(
            eq(personas.tipoDeDocumento, datos.tipoDeDocumento),
            eq(personas.numeroDeDocumento, numeroDeDocumento),
          ),
        )
        .get()
      if (yaEsta) throw new DocumentoDuplicado(datos.tipoDeDocumento, numeroDeDocumento)

      const ahora = core.reloj.ahora()
      const persona = {
        ...datos,
        id: core.nuevoId('persona'),
        numeroDeDocumento,
        nombres: datos.nombres.trim(),
        apellidos: datos.apellidos.trim(),
        creadoEn: ahora,
        actualizadoEn: ahora,
      }
      const pertenencia: Pertenencia = {
        id: core.nuevoId('pertenencia'),
        personaId: persona.id,
        grupoId: ingreso.grupoId,
        categoria: ingreso.categoria,
        rama: ingreso.rama,
        desde: ingreso.desde,
        hasta: null,
        creadoEn: ahora,
        actualizadoEn: ahora,
      }
      const cargosDeLaPersona: Cargo[] = ingreso.cargos.map((datosDelCargo) => ({
        id: core.nuevoId('cargo'),
        personaId: persona.id,
        grupoId: ingreso.grupoId,
        cargo: datosDelCargo.cargo,
        // El desde del cargo es el de la pertenencia: sin edicion todavia, y
        // pedir la misma fecha una vez por cargo no le sirve a nadie.
        desde: ingreso.desde,
        hasta: datosDelCargo.hasta,
        creadoEn: ahora,
        actualizadoEn: ahora,
      }))

      // Las tres escrituras en una transaccion: una persona sin pertenencia no
      // aparece en ninguna pantalla, porque la unica query filtra por grupo.
      core.bd.transaction((tx) => {
        tx.insert(personas).values(persona).run()
        tx.insert(pertenencias).values(pertenencia).run()
        if (cargosDeLaPersona.length > 0) {
          tx.insert(tablaDeCargos).values(cargosDeLaPersona).run()
        }
      })

      return { ...persona, pertenencia, cargos: cargosDeLaPersona }
    },
```

Y reemplazar `listarPersonas`:

```ts
    async listarPersonas(grupoId) {
      // Dos consultas y el armado en memoria, el mismo criterio que
      // listarDistritos: con la cantidad de personas de un grupo alcanza de
      // sobra, y si algun dia deja de alcanzar se arregla en un solo lugar.
      const filas = core.bd
        .select()
        .from(pertenencias)
        .innerJoin(personas, eq(personas.id, pertenencias.personaId))
        .where(and(eq(pertenencias.grupoId, grupoId), isNull(pertenencias.hasta)))
        .all()

      const filasDeCargos = core.bd
        .select()
        .from(tablaDeCargos)
        .where(eq(tablaDeCargos.grupoId, grupoId))
        .all()

      const cargosPorPersona = new Map<string, Cargo[]>()
      for (const cargo of filasDeCargos) {
        const suyos = cargosPorPersona.get(cargo.personaId) ?? []
        suyos.push(cargo)
        cargosPorPersona.set(cargo.personaId, suyos)
      }

      return filas
        .map((fila) => ({
          ...fila.personas,
          pertenencia: fila.pertenencias,
          cargos: cargosPorPersona.get(fila.personas.id) ?? [],
        }))
        .sort(
          (una, otra) =>
            alfabeto.compare(una.apellidos, otra.apellidos) ||
            alfabeto.compare(una.nombres, otra.nombres),
        )
    },
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `bun test packages/personas`
Expected: PASS.

- [ ] **Step 5: `bun run check`**

Run: `bun run check`
Expected: verde. Va a fallar el tipo en `services/backend` y `packages/demo` hasta la Tarea
8 y la 9: si `bun run compile` se queja ahí, seguir y arreglarlo en esas tareas.

- [ ] **Step 6: Commit**

```bash
git add packages/personas
git commit -m "feat(personas): el alta inscribe en un grupo y valida contra estructura"
```

---

## Task 8: El esquema de GraphQL y el módulo con dependencias

**Files:**
- Modify: `packages/estructura/src/servidor/schema.ts:5-14`
- Modify: `packages/personas/src/servidor/schema.ts`
- Modify: `packages/personas/src/servidor/index.ts`
- Modify: `schema.gql` (regenerado)

**Interfaces:**
- Consumes: `enumCompartido` (Tarea 1), `Module<S, D>` (Tarea 2), `Estructura` (Tarea 3),
  los catálogos y modelos (Tarea 4), el servicio (Tarea 7).
- Produces: los tipos `Pertenencia`, `Cargo`, los enums `Categoria` y `TipoDeCargo`, los
  inputs `DatosDeCargo` y `DatosDeIngreso`, la query `personas(grupoId: ID!)` y la mutation
  `crearPersona(datos, ingreso)`. La Tarea 10 genera los hooks contra esto.

- [ ] **Step 1: Compartir el enum `Rama` desde estructura**

En `packages/estructura/src/servidor/schema.ts`, reemplazar el bloque `builder.enumType`
por:

```ts
import { type Builder, enumCompartido } from '@gps/core'
```

```ts
  // enumCompartido y no builder.enumType porque personas declara el mismo enum
  // para la rama de la pertenencia, y Pothos aborta si un nombre se registra dos
  // veces. Los valores son los ids del dominio, en minuscula y no gritados como
  // manda la convencion de GraphQL: asi lo que viaja por la red es el id, y la
  // pantalla saca nombre y rango etario de RAMAS sin tabla de traduccion.
  const RamaRef = enumCompartido(
    builder,
    'Rama',
    RAMAS.map((rama) => rama.id),
  )
```

- [ ] **Step 2: Escribir el esquema de personas**

En `packages/personas/src/servidor/schema.ts`, sumar a los imports:

```ts
import { type Builder, enumCompartido } from '@gps/core'
import { RAMAS } from '@gps/estructura/dominio'
import { TIPOS_DE_CARGO, type TipoDeCargo } from '../dominio/cargos'
import { CATEGORIAS, type Categoria } from '../dominio/categorias'
import type {
  Cargo,
  DatosDeCargo,
  DatosDeIngreso,
  Pertenencia,
  PersonaConVinculos,
} from '../dominio/vinculos'
import { DatosInvalidos, DocumentoDuplicado, GrupoInexistente } from './servicio'
```

Dentro de `registrarSchema`, después del enum de tipos de documento, agregar:

```ts
  const RamaRef = enumCompartido(
    builder,
    'Rama',
    RAMAS.map((rama) => rama.id),
  )

  const CategoriaRef = builder.enumType('Categoria', {
    description: 'Como pertenece una persona a su grupo.',
    values: CATEGORIAS.map((categoria) => categoria.id) as unknown as readonly Categoria[],
  })

  const TipoDeCargoRef = builder.enumType('TipoDeCargo', {
    description: 'Los cargos de un grupo scout.',
    values: TIPOS_DE_CARGO.map((cargo) => cargo.id) as unknown as readonly TipoDeCargo[],
  })

  // No expone grupoId: la query ya filtra por grupo, y devolverlo en cada fila
  // seria repetir el argumento de la consulta.
  const PertenenciaRef = builder.objectRef<Pertenencia>('Pertenencia').implement({
    description: 'Como y desde cuando una persona pertenece a su grupo.',
    fields: (t) => ({
      categoria: t.field({ type: CategoriaRef, resolve: (p) => p.categoria }),
      rama: t.field({
        type: RamaRef,
        nullable: true,
        description: 'Vacía si y sólo si la categoría es adherente.',
        resolve: (pertenencia) => pertenencia.rama,
      }),
      desde: t.exposeString('desde', {
        description: 'Fecha de calendario en formato aaaa-mm-dd, sin hora ni zona horaria.',
      }),
    }),
  })

  // Devuelve las fechas y no un booleano `vigente`: calcularlo exige un "hoy",
  // y el hoy correcto es el de quien mira la pantalla, no el del servidor. El
  // cliente lo resuelve con estaVigente, que ya tiene desde /dominio. Es la
  // misma decision que la de no exponer `edad`.
  const CargoRef = builder.objectRef<Cargo>('Cargo').implement({
    description: 'Un cargo de una persona en su grupo, con su periodo.',
    fields: (t) => ({
      cargo: t.field({ type: TipoDeCargoRef, resolve: (fila) => fila.cargo }),
      desde: t.exposeString('desde'),
      hasta: t.exposeString('hasta', {
        nullable: true,
        description: 'Vacía si no tiene fin previsto. Puede estar en el futuro: un mandato dura cuatro años.',
      }),
    }),
  })
```

Cambiar `PersonaRef` para que su fuente sea `PersonaConVinculos` y sumarle los dos campos:

```ts
  const PersonaRef = builder.objectRef<PersonaConVinculos>('Persona').implement({
    description: 'Un miembro de la asociacion, con sus vinculos vigentes en su grupo.',
    fields: (t) => ({
      // ...los campos personales que ya estan, sin cambios...
      pertenencia: t.field({ type: PertenenciaRef, resolve: (persona) => persona.pertenencia }),
      cargos: t.field({
        type: [CargoRef],
        description: 'Todos, también los vencidos: la vigencia la decide el cliente.',
        resolve: (persona) => [...persona.cargos],
      }),
    }),
  })
```

Agregar los inputs, después de `DatosDePersonaRef`:

```ts
  const DatosDeCargoRef = builder.inputRef<DatosDeCargo>('DatosDeCargo').implement({
    description: 'Un cargo en el alta. Su `desde` es el de la pertenencia.',
    fields: (t) => ({
      cargo: t.field({ type: TipoDeCargoRef, required: true }),
      hasta: t.string({ required: false }),
    }),
  })

  const DatosDeIngresoRef = builder.inputRef<DatosDeIngreso>('DatosDeIngreso').implement({
    description: 'El grupo al que ingresa la persona, y como.',
    fields: (t) => ({
      grupoId: t.id({ required: true }),
      categoria: t.field({ type: CategoriaRef, required: true }),
      rama: t.field({ type: RamaRef, required: false }),
      desde: t.string({ required: true }),
      cargos: t.field({ type: [DatosDeCargoRef], required: true }),
    }),
  })
```

Reemplazar la query y la mutation:

```ts
  builder.queryField('personas', (t) =>
    t.field({
      type: [PersonaRef],
      description: 'Las personas de un grupo, ordenadas por apellido.',
      args: { grupoId: t.arg.id({ required: true }) },
      resolve: async (_padre, args, contexto) => [
        ...(await contexto.personas.listarPersonas(String(args.grupoId))),
      ],
    }),
  )

  builder.mutationField('crearPersona', (t) =>
    t.field({
      type: PersonaRef,
      description: 'Da de alta una persona y la inscribe en un grupo.',
      args: {
        datos: t.arg({ type: DatosDePersonaRef, required: true }),
        ingreso: t.arg({ type: DatosDeIngresoRef, required: true }),
      },
      resolve: async (_padre, args, contexto) => {
        try {
          return await contexto.personas.crearPersona(args.datos, args.ingreso)
        } catch (error) {
          // Yoga enmascara todo lo que no sea un GraphQLError: sin esta
          // traduccion, el formulario recibe "Unexpected error." en vez del
          // motivo. Traducir en el resolver y no en el servicio es lo que
          // mantiene al servicio sin conocer el framework.
          if (error instanceof DatosInvalidos) {
            throw new GraphQLError(error.message, {
              extensions: { code: 'DATOS_INVALIDOS', problemas: error.problemas },
            })
          }
          if (error instanceof DocumentoDuplicado) {
            throw new GraphQLError(error.message, { extensions: { code: 'DOCUMENTO_DUPLICADO' } })
          }
          if (error instanceof GrupoInexistente) {
            throw new GraphQLError(error.message, { extensions: { code: 'GRUPO_INEXISTENTE' } })
          }
          throw error
        }
      },
    }),
  )
```

Si el tipo de `args.ingreso` no coincide exactamente con `DatosDeIngreso` —Pothos entrega
`readonly` distinto para las listas de inputs—, adaptarlo en el resolver construyendo el
objeto campo por campo, nunca con un `as` sobre el argumento entero.

- [ ] **Step 3: Declarar el módulo con su dependencia**

En `packages/personas/src/servidor/index.ts`:

```ts
import type { Estructura } from '@gps/estructura/dominio'
import type { Module } from '@gps/core'

export const personas: Module<ServicioDePersonas, { estructura: Estructura }> = {
  name: 'personas',
  // Personas depende de Estructura, al reves de lo que suponia la spec base:
  // los cargos viven aca, asi que la flecha va en esta direccion.
  dependencies: ['estructura'],
  migraciones,
  createServices: (core, dependencias) =>
    crearServicioDePersonas(core, dependencias.estructura),
  registerSchema: registrarSchema,
}
```

y sumar `GrupoInexistente` a la línea de re-exports de errores.

- [ ] **Step 4: Regenerar el esquema y los tipos del cliente**

Run: `bun run schema`
Expected: `schema.gql` con `type Pertenencia`, `type Cargo`, `enum Categoria`,
`enum TipoDeCargo`, `input DatosDeIngreso`, y `personas(grupoId: ID!)`. Verificar a ojo que
`enum Rama` aparezca **una sola vez**.

Run: `bun run --filter @gps/api codegen`
Expected: `packages/api/src/generated/graphql.ts` actualizado.

- [ ] **Step 5: Verificar de punta a punta**

Run: `bun run demo`
Expected: arranca sin errores. La siembra todavía no asigna grupos —eso es la Tarea 9—, así
que va a fallar ahí: si el error es de `crearPersona` pidiendo un ingreso, es lo esperado y
la Tarea 9 lo arregla. Cualquier otro error hay que resolverlo acá.

- [ ] **Step 6: Commit**

```bash
git add packages schema.gql
git commit -m "feat(personas): pertenencia y cargos en el esquema, y el modulo declara su dependencia"
```

---

## Task 9: El demo

**Files:**
- Modify: `packages/demo/src/servidor/escenario.ts`
- Test: `packages/demo/test/escenario.test.ts`

**Interfaces:**
- Consumes: `ctx.estructura.crearGrupo`, `ctx.personas.crearPersona(datos, ingreso)`.
- Produces: nada que otra tarea consuma. Es el escenario que recorren las pantallas.

- [ ] **Step 1: Escribir el test que falla**

En `packages/demo/test/escenario.test.ts`, agregar:

El archivo ya tiene `montarContexto()` y `sembrarEscenario(contexto)`: los tests nuevos usan
esos dos, no un helper nuevo.

```ts
test('reparte las personas en grupos, con un grupo lleno y uno vacio', async () => {
  const ctx = montarContexto()
  await sembrarEscenario(ctx)
  const distritos = await ctx.estructura.listarDistritos()
  const grupo42 = distritos.flatMap((d) => d.grupos).find((g) => g.numero === 42)
  const grupo88 = distritos.flatMap((d) => d.grupos).find((g) => g.numero === 88)

  // El 42 tiene las seis ramas abiertas: es el que ejercita la pantalla llena.
  expect((await ctx.personas.listarPersonas(grupo42?.id ?? '')).length).toBeGreaterThan(8)
  // El 88 no abrio ninguna rama: la pantalla tiene que resolver "no hay ramas"
  // y "no hay personas" a la vez.
  expect(await ctx.personas.listarPersonas(grupo88?.id ?? '')).toEqual([])
})

test('siembra un cargo vigente y uno vencido', async () => {
  const ctx = montarContexto()
  await sembrarEscenario(ctx)
  const distritos = await ctx.estructura.listarDistritos()
  const grupo42 = distritos.flatMap((d) => d.grupos).find((g) => g.numero === 42)
  const cargos = (await ctx.personas.listarPersonas(grupo42?.id ?? '')).flatMap((p) => p.cargos)

  // Los dos casos, para que estaVigente tenga con que trabajar en pantalla.
  expect(cargos.some((cargo) => cargo.hasta === null)).toBe(true)
  expect(cargos.some((cargo) => cargo.hasta !== null)).toBe(true)
})
```

El `montarContexto` de ese archivo fija el reloj en `2026-08-27` a propósito —el demo siembra
fechas de nacimiento reales, así que con un reloj en 1970 nacer en 2020 sería nacer en el
futuro—. Las fechas de la constante nueva tienen que respetarlo: los `desde` anteriores a esa
fecha, y el `hasta` de `2028-03-01` posterior, que es lo que lo hace vigente.

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `bun test packages/demo`
Expected: FAIL — las personas se siembran sin grupo.

- [ ] **Step 3: Reescribir la lista de personas del escenario**

En `packages/demo/src/servidor/escenario.ts`, sumar a los imports:

```ts
import type { Categoria, DatosDePersona, TipoDeCargo } from '@gps/personas/dominio'
```

y reemplazar la constante `PERSONAS` y el bucle que la recorre. La lista pasa a llevar el
grupo y el ingreso:

```ts
/** Las personas de la demostracion, con su grupo. Los criterios son los mismos
 *  que los de los grupos, y por la misma razon: un demo donde todas las filas
 *  son iguales no muestra si la pantalla aguanta los casos que se rompen.
 *
 *  Edades repartidas de castores a adulto mayor, un pasaporte entre los DNI,
 *  apellidos con acento y con enie -que son los que exponen el orden
 *  alfabetico-, un apellido compuesto y un nombre compuesto -que son los que
 *  exponen partir un nombre completo con heuristicas-, las tres categorias, un
 *  adherente sin ningun cargo, y un cargo con mandato al futuro junto a uno ya
 *  vencido, para que estaVigente tenga los dos casos en pantalla.
 *
 *  El grueso va al grupo 42, que tiene las seis ramas abiertas: es el que
 *  ejercita la pantalla llena. El 88 queda sin nadie a proposito. */
const PERSONAS: readonly {
  datos: DatosDePersona
  numeroDeGrupo: number
  categoria: Categoria
  rama: Rama | null
  desde: string
  cargos?: readonly { cargo: TipoDeCargo; hasta: string | null }[]
}[] = [
  // El grueso en el 42, que tiene las seis ramas abiertas, con una persona por
  // rama de castores a adultos: es el que ejercita la pantalla llena.
  {
    datos: {
      tipoDeDocumento: 'dni',
      numeroDeDocumento: '55.402.118',
      nombres: 'Ámbar',
      apellidos: 'Ávila',
      fechaDeNacimiento: '2020-03-14',
    },
    numeroDeGrupo: 42,
    categoria: 'beneficiario',
    rama: 'castores',
    desde: '2025-03-01',
  },
  {
    datos: {
      tipoDeDocumento: 'dni',
      numeroDeDocumento: '53.119.847',
      nombres: 'Joaquín',
      apellidos: 'Bustos',
      fechaDeNacimiento: '2018-07-02',
    },
    numeroDeGrupo: 42,
    categoria: 'beneficiario',
    rama: 'lobatos',
    desde: '2024-03-02',
  },
  {
    datos: {
      tipoDeDocumento: 'dni',
      numeroDeDocumento: '49.877.210',
      nombres: 'María Luz',
      apellidos: 'Del Águila',
      fechaDeNacimiento: '2015-11-23',
    },
    numeroDeGrupo: 42,
    categoria: 'beneficiario',
    rama: 'scouts',
    desde: '2023-03-04',
  },
  {
    // El unico pasaporte entre los DNI.
    datos: {
      tipoDeDocumento: 'pasaporte',
      numeroDeDocumento: 'AB1234567',
      nombres: 'Piotr',
      apellidos: 'Kowalski',
      fechaDeNacimiento: '2013-08-21',
    },
    numeroDeGrupo: 42,
    categoria: 'beneficiario',
    rama: 'scouts',
    desde: '2024-03-02',
  },
  {
    datos: {
      tipoDeDocumento: 'dni',
      numeroDeDocumento: '46.210.553',
      nombres: 'Tomás',
      apellidos: 'Ibáñez',
      fechaDeNacimiento: '2011-01-09',
    },
    numeroDeGrupo: 42,
    categoria: 'beneficiario',
    rama: 'raiders',
    desde: '2022-03-05',
  },
  {
    datos: {
      tipoDeDocumento: 'dni',
      numeroDeDocumento: '43.998.104',
      nombres: 'Milagros',
      apellidos: 'Núñez',
      fechaDeNacimiento: '2008-05-30',
    },
    numeroDeGrupo: 42,
    categoria: 'beneficiario',
    rama: 'rovers',
    desde: '2019-03-02',
  },
  {
    // Beneficiario adulto: participa en la rama Adultos y no tiene chicos a
    // cargo, que es lo que lo distingue de ser dirigente.
    datos: {
      tipoDeDocumento: 'dni',
      numeroDeDocumento: '40.522.967',
      nombres: 'Bruno',
      apellidos: 'Ochoa',
      fechaDeNacimiento: '2004-09-17',
    },
    numeroDeGrupo: 42,
    categoria: 'beneficiario',
    rama: 'adultos',
    desde: '2025-03-01',
  },
  {
    // Dirigente de lobatos, jefa de rama sin fin previsto.
    datos: {
      tipoDeDocumento: 'dni',
      numeroDeDocumento: '36.114.780',
      nombres: 'Sofía',
      apellidos: 'Peña',
      fechaDeNacimiento: '1998-02-11',
    },
    numeroDeGrupo: 42,
    categoria: 'activo',
    rama: 'lobatos',
    desde: '2018-03-03',
    cargos: [{ cargo: 'jefeDeRama', hasta: null }],
  },
  {
    // Jefe de grupo con mandato al futuro: el caso que hace que `hasta` no
    // pueda significar "cerrado".
    datos: {
      tipoDeDocumento: 'dni',
      numeroDeDocumento: '33.207.415',
      nombres: 'Ignacio',
      apellidos: 'Quiroga',
      fechaDeNacimiento: '1993-06-25',
    },
    numeroDeGrupo: 42,
    categoria: 'activo',
    rama: 'scouts',
    desde: '2012-03-03',
    cargos: [{ cargo: 'jefeDeGrupo', hasta: '2028-03-01' }],
  },
  {
    // Dos cargos a la vez, que es lo que pasa en un grupo real.
    datos: {
      tipoDeDocumento: 'dni',
      numeroDeDocumento: '28.904.331',
      nombres: 'Ana Clara',
      apellidos: 'Sánchez Elía',
      fechaDeNacimiento: '1985-10-08',
    },
    numeroDeGrupo: 42,
    categoria: 'activo',
    rama: 'raiders',
    desde: '2006-03-04',
    cargos: [
      { cargo: 'subjefeDeGrupo', hasta: '2028-03-01' },
      { cargo: 'jefeDeRama', hasta: null },
    ],
  },
  {
    // El sacerdote a cargo del grupo: adherente, sin rama, con cargo.
    datos: {
      tipoDeDocumento: 'dni',
      numeroDeDocumento: '25.011.628',
      nombres: 'Ezequiel',
      apellidos: 'Vera',
      fechaDeNacimiento: '1978-04-19',
    },
    numeroDeGrupo: 42,
    categoria: 'adherente',
    rama: null,
    desde: '2015-03-07',
    cargos: [{ cargo: 'director', hasta: null }],
  },
  {
    // La cocinera: adherente, sin rama y sin ningun cargo del catalogo. Es el
    // caso que muestra que categoria y cargo son cosas distintas.
    datos: {
      tipoDeDocumento: 'dni',
      numeroDeDocumento: '20.447.195',
      nombres: 'Rosario',
      apellidos: 'Zaballa',
      fechaDeNacimiento: '1968-12-03',
    },
    numeroDeGrupo: 42,
    categoria: 'adherente',
    rama: null,
    desde: '2010-03-06',
  },
  // El 61 tiene una sola rama abierta: el <select> del formulario tiene que
  // ofrecer una sola opcion.
  {
    datos: {
      tipoDeDocumento: 'dni',
      numeroDeDocumento: '47.330.912',
      nombres: 'Lucía',
      apellidos: 'Ferreyra',
      fechaDeNacimiento: '2012-02-20',
    },
    numeroDeGrupo: 61,
    categoria: 'beneficiario',
    rama: 'scouts',
    desde: '2023-03-04',
  },
  {
    // Cargo ya vencido: el otro lado de estaVigente. En pantalla no tiene que
    // aparecer como etiqueta.
    datos: {
      tipoDeDocumento: 'dni',
      numeroDeDocumento: '35.208.774',
      nombres: 'Martín',
      apellidos: 'Godoy',
      fechaDeNacimiento: '1990-09-05',
    },
    numeroDeGrupo: 61,
    categoria: 'activo',
    rama: 'scouts',
    desde: '2011-03-05',
    cargos: [{ cargo: 'jefeDeRama', hasta: '2024-12-31' }],
  },
]
```

Tres cosas de esta lista son a propósito y conviene no perderlas al tocarla: **el 88 queda
sin nadie** —la pantalla tiene que resolver "no hay ramas" y "no hay personas" a la vez—,
**el 19 tampoco tiene a nadie** porque está cerrado y `obtenerGrupo` devolvería `null`, y
**cada rama elegida está abierta en su grupo**, que la constante `DIOCESIS` del mismo archivo
dice cuáles son. Las edades son coherentes con la rama aunque el sistema todavía no lo
valide (§2 de la spec).

Y el bucle de siembra:

```ts
  const gruposPorNumero = new Map(
    (await ctx.estructura.listarDistritos())
      .flatMap((distrito) => distrito.grupos)
      .map((grupo) => [grupo.numero, grupo.id]),
  )

  for (const persona of PERSONAS) {
    const grupoId = gruposPorNumero.get(persona.numeroDeGrupo)
    if (!grupoId) throw new Error(`El escenario no tiene el grupo ${persona.numeroDeGrupo}.`)
    await ctx.personas.crearPersona(persona.datos, {
      grupoId,
      categoria: persona.categoria,
      rama: persona.rama,
      desde: persona.desde,
      cargos: persona.cargos ?? [],
    })
  }
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `bun test packages/demo`
Expected: PASS.

- [ ] **Step 5: Verificar el demo entero**

Run: `bun run demo`
Expected: arranca sin errores y siembra las personas. Probar en el navegador:

```
curl -s localhost:3000/graphql -H 'content-type: application/json' \
  -d '{"query":"{ distritos { grupos { id numero } } }"}'
```

y después la query de personas con uno de esos ids.

- [ ] **Step 6: `bun run check`**

Run: `bun run check`
Expected: verde.

- [ ] **Step 7: Commit**

```bash
git add packages/demo
git commit -m "feat(demo): personas repartidas en grupos, con categorias, ramas y cargos"
```

---

## Task 10: Las queries y los hooks

**Files:**
- Modify: `packages/api/src/queries/personas.graphql`
- Modify: `packages/api/src/queries/crearPersona.graphql`
- Modify: `packages/api/src/personas.ts`
- Modify: `packages/api/src/index.ts`

**Interfaces:**
- Consumes: el esquema de la Tarea 8.
- Produces: `usePersonasDelGrupo(grupoId)`, `useCrearPersona()`, y el tipo
  `PersonasQuery`. Las Tareas 11 y 12 los consumen.

- [ ] **Step 1: Reescribir las queries**

`packages/api/src/queries/personas.graphql`:

```graphql
query Personas($grupoId: ID!) {
  personas(grupoId: $grupoId) {
    id
    tipoDeDocumento
    numeroDeDocumento
    nombres
    apellidos
    fechaDeNacimiento
    pertenencia {
      categoria
      rama
      desde
    }
    cargos {
      cargo
      desde
      hasta
    }
  }
}
```

`packages/api/src/queries/crearPersona.graphql`:

```graphql
mutation CrearPersona($datos: DatosDePersona!, $ingreso: DatosDeIngreso!) {
  crearPersona(datos: $datos, ingreso: $ingreso) {
    id
  }
}
```

- [ ] **Step 2: Regenerar los tipos**

Run: `bun run --filter @gps/api codegen`
Expected: `PersonasQueryVariables` con `grupoId`, y `CrearPersonaMutationVariables` con
`datos` e `ingreso`.

- [ ] **Step 3: Reescribir los hooks**

`packages/api/src/personas.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CrearPersonaDocument,
  type CrearPersonaMutationVariables,
  PersonasDocument,
} from './generated/graphql'
import { useTransporte } from './proveedor'

/** Las personas de un grupo. No hay lista global: a una persona se llega por su
 *  grupo, que es como esta pensada la pantalla. */
export function usePersonasDelGrupo(grupoId: string) {
  const transporte = useTransporte()
  return useQuery({
    // El grupoId va en la clave: sin el, dos grupos compartirian la misma
    // entrada de cache y el segundo mostraria las personas del primero.
    queryKey: ['personas', grupoId],
    queryFn: () => transporte.ejecutar(PersonasDocument, { grupoId }),
  })
}

/** Al alta exitosa invalida ['personas'] entero -no solo el grupo- porque una
 *  persona nueva puede cambiar lo que se ve en mas de una pantalla el dia que
 *  exista el cambio de grupo. Es lo unico que la pantalla no tiene que
 *  acordarse de hacer. */
export function useCrearPersona() {
  const transporte = useTransporte()
  const clienteDeQueries = useQueryClient()
  return useMutation({
    mutationFn: (variables: CrearPersonaMutationVariables) =>
      transporte.ejecutar(CrearPersonaDocument, variables),
    onSuccess: () => clienteDeQueries.invalidateQueries({ queryKey: ['personas'] }),
  })
}
```

En `packages/api/src/index.ts`, reemplazar `usePersonas` por `usePersonasDelGrupo` en la
línea de exports de personas.

- [ ] **Step 4: Verificar tipos**

Run: `bun run compile`
Expected: falla sólo en `apps/web` y `apps/mobile`, que todavía usan `usePersonas`. Es lo
esperado; las Tareas 11 y 12 lo arreglan.

- [ ] **Step 5: Commit**

```bash
git add packages/api
git commit -m "feat(api): la lista de personas es por grupo, y el alta lleva el ingreso"
```

---

## Task 11: La pantalla del grupo en la web

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/pantallas/Estructura.tsx`
- Create: `apps/web/src/pantallas/Grupo.tsx`
- Create: `apps/web/src/pantallas/AltaDePersona.tsx`
- Delete: `apps/web/src/pantallas/Personas.tsx`

**Interfaces:**
- Consumes: `useDistritos`, `usePersonasDelGrupo`, `useCrearPersona`, `ErrorDeApi` de
  `@gps/api`; `RAMAS`, `etiquetaDeEdades`, `Rama` de `@gps/estructura/dominio`; los
  catálogos, `validarPersona`, `validarIngreso`, `estaVigente`, `aFechaDeCalendario`,
  `calcularEdad`, `nombreCompleto`, `nombreDelCargo` de `@gps/personas/dominio`.
- Produces: la ruta `/grupos/:id`. La Tarea 12 la replica en React Native.

- [ ] **Step 1: Hacer clickeables los grupos del árbol**

En `apps/web/src/pantallas/Estructura.tsx`, envolver el contenido del `<li>` del componente
`Grupo` en un `<Link>` de wouter, y sumarle el id a las props:

```tsx
import { Link } from 'wouter'

function Grupo(props: { id: string; numero: number; nombre: string; ramas: readonly Rama[] }) {
  return (
    <li>
      <Link
        href={`/grupos/${props.id}`}
        className="block px-4 py-3 hover:bg-slate-50 active:bg-slate-100"
      >
        {/* el mismo contenido que ya tenia */}
      </Link>
    </li>
  )
}
```

Y en el `map` que lo usa, pasarle `id={grupo.id}`.

- [ ] **Step 2: Escribir el formulario**

Crear `apps/web/src/pantallas/AltaDePersona.tsx`. Es el formulario de `Personas.tsx` con
tres campos nuevos —categoría, rama y cargos— y el `desde`:

```tsx
import { ErrorDeApi, useCrearPersona } from '@gps/api'
import { etiquetaDeEdades, RAMAS, type Rama } from '@gps/estructura/dominio'
import {
  aFechaDeCalendario,
  CATEGORIAS,
  type Categoria,
  type DatosDePersona,
  type DatosDeIngreso,
  type Problema,
  TIPOS_DE_CARGO,
  type TipoDeCargo,
  TIPOS_DE_DOCUMENTO,
  type TipoDeDocumento,
  validarIngreso,
  validarPersona,
} from '@gps/personas/dominio'
import { type FormEvent, type ReactNode, useState } from 'react'

const RAMA_POR_ID = new Map(RAMAS.map((rama) => [rama.id, rama]))

const VACIO: DatosDePersona = {
  tipoDeDocumento: 'dni',
  numeroDeDocumento: '',
  nombres: '',
  apellidos: '',
  fechaDeNacimiento: '',
}

const CLASE_DE_INPUT =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm ' +
  'focus:border-slate-900 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400'

function Campo(props: { etiqueta: string; problema?: string; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: children es generico, biome no ve el control adentro
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{props.etiqueta}</span>
      <div className="mt-1">{props.children}</div>
      {props.problema && <p className="mt-1 text-xs text-red-700">{props.problema}</p>}
    </label>
  )
}

export function AltaDePersona(props: { grupoId: string; ramasAbiertas: readonly Rama[] }) {
  const alta = useCrearPersona()
  const hoy = new Date()
  const vacio = (): DatosDeIngreso => ({
    grupoId: props.grupoId,
    categoria: 'beneficiario',
    // La primera rama abierta del grupo, no una fija: el <select> sólo ofrece
    // las que el grupo tiene abiertas, así que un default que no esté ahí sería
    // un formulario que arranca inválido.
    rama: props.ramasAbiertas[0] ?? null,
    desde: aFechaDeCalendario(hoy),
    cargos: [],
  })

  const [datos, setDatos] = useState<DatosDePersona>(VACIO)
  const [ingreso, setIngreso] = useState<DatosDeIngreso>(vacio)
  const [problemas, setProblemas] = useState<readonly Problema[]>([])

  const problemaDe = (campo: Problema['campo']) =>
    problemas.find((problema) => problema.campo === campo)?.mensaje

  const cargoElegido = (cargo: TipoDeCargo) =>
    ingreso.cargos.find((elegido) => elegido.cargo === cargo)

  function alternarCargo(cargo: TipoDeCargo) {
    setIngreso({
      ...ingreso,
      cargos: cargoElegido(cargo)
        ? ingreso.cargos.filter((elegido) => elegido.cargo !== cargo)
        : [...ingreso.cargos, { cargo, hasta: null }],
    })
  }

  function cambiarHasta(cargo: TipoDeCargo, hasta: string) {
    setIngreso({
      ...ingreso,
      cargos: ingreso.cargos.map((elegido) =>
        elegido.cargo === cargo ? { ...elegido, hasta: hasta || null } : elegido,
      ),
    })
  }

  function cambiarCategoria(categoria: Categoria) {
    // Un adherente no pertenece a ninguna rama: limpiarla al cambiar evita que
    // el formulario quede en un estado que el dominio rechaza sin que se vea.
    setIngreso({
      ...ingreso,
      categoria,
      rama: categoria === 'adherente' ? null : (ingreso.rama ?? props.ramasAbiertas[0] ?? null),
    })
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    // Las mismas funciones puras que corre el servicio. Validar acá es la
    // experiencia de uso; que el servidor las corra igual es la garantía.
    const encontrados = [
      ...validarPersona(datos, hoy),
      ...validarIngreso(ingreso, props.ramasAbiertas, hoy),
    ]
    setProblemas(encontrados)
    if (encontrados.length > 0) return
    alta.mutate(
      { datos, ingreso },
      {
        onSuccess: () => {
          setDatos(VACIO)
          setIngreso(vacio())
        },
      },
    )
  }

  return (
    <form onSubmit={enviar} className="mt-8 space-y-3 rounded-lg bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Agregar una persona</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Tipo de documento">
          <select
            className={CLASE_DE_INPUT}
            value={datos.tipoDeDocumento}
            onChange={(evento) =>
              setDatos({ ...datos, tipoDeDocumento: evento.target.value as TipoDeDocumento })
            }
          >
            {TIPOS_DE_DOCUMENTO.map((tipo) => (
              <option key={tipo.id} value={tipo.id}>
                {tipo.nombre}
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Número" problema={problemaDe('numeroDeDocumento')}>
          <input
            className={CLASE_DE_INPUT}
            value={datos.numeroDeDocumento}
            onChange={(evento) => setDatos({ ...datos, numeroDeDocumento: evento.target.value })}
            inputMode="text"
          />
        </Campo>

        <Campo etiqueta="Apellidos" problema={problemaDe('apellidos')}>
          <input
            className={CLASE_DE_INPUT}
            value={datos.apellidos}
            onChange={(evento) => setDatos({ ...datos, apellidos: evento.target.value })}
          />
        </Campo>

        <Campo etiqueta="Nombres" problema={problemaDe('nombres')}>
          <input
            className={CLASE_DE_INPUT}
            value={datos.nombres}
            onChange={(evento) => setDatos({ ...datos, nombres: evento.target.value })}
          />
        </Campo>

        <Campo etiqueta="Fecha de nacimiento" problema={problemaDe('fechaDeNacimiento')}>
          {/* type="date" es nativo: trae el calendario del sistema, es accesible
              sin trabajo, y emite exactamente el aaaa-mm-dd que espera el
              dominio. Ninguna dependencia hace falta. */}
          <input
            type="date"
            className={CLASE_DE_INPUT}
            value={datos.fechaDeNacimiento}
            onChange={(evento) => setDatos({ ...datos, fechaDeNacimiento: evento.target.value })}
          />
        </Campo>

        <Campo etiqueta="Categoría">
          <select
            className={CLASE_DE_INPUT}
            value={ingreso.categoria}
            onChange={(evento) => cambiarCategoria(evento.target.value as Categoria)}
          >
            {CATEGORIAS.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nombre}
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Rama" problema={problemaDe('rama')}>
          <select
            className={CLASE_DE_INPUT}
            // Un adherente es, por definición, el que no está en ninguna rama.
            disabled={ingreso.categoria === 'adherente'}
            value={ingreso.rama ?? ''}
            onChange={(evento) =>
              setIngreso({ ...ingreso, rama: (evento.target.value || null) as Rama | null })
            }
          >
            <option value="">—</option>
            {/* Sólo las ramas abiertas del grupo. Es la misma regla que corre el
                servidor con estructura.obtenerGrupo, no una versión aparte. */}
            {props.ramasAbiertas.map((rama) => {
              const catalogo = RAMA_POR_ID.get(rama)
              return (
                <option key={rama} value={rama}>
                  {catalogo ? `${catalogo.nombre} (${etiquetaDeEdades(catalogo)})` : rama}
                </option>
              )
            })}
          </select>
        </Campo>

        <Campo etiqueta="Ingresó el" problema={problemaDe('desde')}>
          {/* Se propone en hoy y se puede corregir: a alguien lo cargás en
              agosto y es jefa de rama desde marzo. */}
          <input
            type="date"
            className={CLASE_DE_INPUT}
            value={ingreso.desde}
            onChange={(evento) => setIngreso({ ...ingreso, desde: evento.target.value })}
          />
        </Campo>
      </div>

      <fieldset>
        <legend className="text-xs font-medium text-slate-600">Cargos</legend>
        <div className="mt-1 space-y-2">
          {TIPOS_DE_CARGO.map((tipo) => {
            const elegido = cargoElegido(tipo.id)
            return (
              <div key={tipo.id} className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(elegido)}
                    onChange={() => alternarCargo(tipo.id)}
                  />
                  {tipo.nombre}
                </label>
                {elegido && (
                  <label className="flex items-center gap-1 text-xs text-slate-500">
                    hasta
                    <input
                      type="date"
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                      value={elegido.hasta ?? ''}
                      onChange={(evento) => cambiarHasta(tipo.id, evento.target.value)}
                    />
                  </label>
                )}
              </div>
            )
          })}
        </div>
        {problemaDe('cargos') && <p className="mt-1 text-xs text-red-700">{problemaDe('cargos')}</p>}
      </fieldset>

      {alta.isError && (
        <p className="rounded-lg bg-red-50 p-3 text-sm break-words text-red-800">
          {alta.error instanceof ErrorDeApi ? alta.error.errores.join(' ') : alta.error.message}
        </p>
      )}

      <button
        type="submit"
        disabled={alta.isPending}
        className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 sm:w-auto"
      >
        {alta.isPending ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  )
}
```

Los cinco campos personales son los mismos que tiene hoy `Personas.tsx`, que se borra en el
Step 4 de esta tarea: no cambia ninguno, sólo se mudan.

- [ ] **Step 3: Escribir la pantalla**

Crear `apps/web/src/pantallas/Grupo.tsx`:

```tsx
import { useDistritos, usePersonasDelGrupo } from '@gps/api'
import { etiquetaDeEdades, RAMAS, type Rama } from '@gps/estructura/dominio'
import {
  calcularEdad,
  estaVigente,
  nombreCompleto,
  nombreDelCargo,
  nombreDelTipo,
} from '@gps/personas/dominio'
import { Link } from 'wouter'
import { AltaDePersona } from './AltaDePersona'

type Persona = NonNullable<ReturnType<typeof usePersonasDelGrupo>['data']>['personas'][number]

function FilaDePersona(props: { persona: Persona; hoy: Date }) {
  const vigentes = props.persona.cargos.filter((cargo) => estaVigente(cargo, props.hoy))
  return (
    <li className="px-4 py-3">
      <p className="text-sm font-medium text-slate-900">{nombreCompleto(props.persona)}</p>
      <p className="mt-0.5 text-xs text-slate-500">
        {nombreDelTipo(props.persona.tipoDeDocumento)} {props.persona.numeroDeDocumento}
        <span className="text-slate-400">
          {' · '}
          {calcularEdad(props.persona.fechaDeNacimiento, props.hoy)} años
        </span>
      </p>
      {vigentes.length > 0 && (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {vigentes.map((cargo) => (
            <li
              key={cargo.cargo}
              className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
            >
              {nombreDelCargo(cargo.cargo)}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function Seccion(props: { titulo: string; detalle?: string; personas: readonly Persona[]; hoy: Date }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-900">
        {props.titulo}
        {props.detalle && <span className="ml-1 font-normal text-slate-400">{props.detalle}</span>}
      </h3>
      {props.personas.length === 0 ? (
        <p className="mt-1 text-xs text-slate-400">Todavía no hay nadie</p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-200 rounded-lg bg-white shadow-sm">
          {props.personas.map((persona) => (
            <FilaDePersona key={persona.id} persona={persona} hoy={props.hoy} />
          ))}
        </ul>
      )}
    </section>
  )
}

export function Grupo(props: { id: string }) {
  const arbol = useDistritos()
  const lista = usePersonasDelGrupo(props.id)
  const hoy = new Date()

  // Reusa la query del arbol en vez de estrenar grupo(id): TanStack Query ya la
  // tiene en cache porque venis de ahi, y de paso trae el distrito para el
  // encabezado. Son quince grupos; el dia que deje de entrar en una query se
  // agrega grupo(id) y se arregla en un solo lugar.
  const distrito = arbol.data?.distritos.find((candidato) =>
    candidato.grupos.some((grupo) => grupo.id === props.id),
  )
  const grupo = distrito?.grupos.find((candidato) => candidato.id === props.id)

  if (arbol.isPending || lista.isPending) {
    return <p className="mt-8 text-sm text-slate-500">Consultando el grupo…</p>
  }

  const error = arbol.error ?? lista.error
  if (error) {
    return (
      <p className="mt-8 rounded-lg bg-red-50 p-4 text-sm break-words text-red-800">
        No se pudo consultar el grupo: {error.message}
      </p>
    )
  }

  if (!grupo) {
    return (
      <p className="mt-8 rounded-lg bg-white p-4 text-sm text-slate-500 shadow-sm">
        No hay ningún grupo abierto con esa dirección.
      </p>
    )
  }

  const personas = lista.data?.personas ?? []
  const adherentes = personas.filter((persona) => persona.pertenencia.categoria === 'adherente')

  return (
    <>
      <Link href="/" className="mt-6 inline-block text-sm text-slate-500 hover:text-slate-900">
        ← Distrito {distrito?.numero}
      </Link>
      <h2 className="mt-1 text-lg font-semibold text-slate-900">
        <span className="text-slate-400">Grupo Scout Nº{grupo.numero} -</span> {grupo.nombre}
      </h2>

      <div className="mt-6 space-y-6">
        {/* En el orden del catalogo, de menor a mayor edad: el mismo criterio
            que ordenarPorCatalogo en el servidor. Una rama abierta sin nadie se
            muestra vacia y no se esconde, porque es informacion. */}
        {RAMAS.filter((rama) => grupo.ramas.includes(rama.id)).map((rama) => {
          const suyas = personas.filter((persona) => persona.pertenencia.rama === rama.id)
          // Primero los dirigentes: son los que uno busca cuando abre la rama.
          const activos = suyas.filter((p) => p.pertenencia.categoria === 'activo')
          const beneficiarios = suyas.filter((p) => p.pertenencia.categoria === 'beneficiario')
          return (
            <Seccion
              key={rama.id}
              titulo={rama.nombre}
              detalle={etiquetaDeEdades(rama)}
              personas={[...activos, ...beneficiarios]}
              hoy={hoy}
            />
          )
        })}

        {grupo.ramas.length === 0 && (
          <p className="rounded-lg bg-white p-4 text-sm text-slate-500 shadow-sm">
            El grupo todavía no abrió ninguna rama.
          </p>
        )}

        <Seccion titulo="Adherentes" personas={adherentes} hoy={hoy} />
      </div>

      <AltaDePersona grupoId={props.id} ramasAbiertas={grupo.ramas as readonly Rama[]} />
    </>
  )
}
```

- [ ] **Step 4: Cablear la ruta y borrar la lista global**

En `apps/web/src/App.tsx`: borrar el componente `Solapa`, el `<nav>` entero y la ruta
`/personas`; sumar la ruta del grupo. Con una sola solapa, el nav de solapas no tiene razón
de ser.

```tsx
import { Route, Switch } from 'wouter'
import { Estructura } from './pantallas/Estructura'
import { Grupo } from './pantallas/Grupo'
```

```tsx
        <Switch>
          <Route path="/" component={Estructura} />
          <Route path="/grupos/:id">{(params) => <Grupo id={params.id} />}</Route>
          <Route>
            <p className="mt-8 text-sm text-slate-500">No hay nada en esta dirección.</p>
          </Route>
        </Switch>
```

Run: `rm apps/web/src/pantallas/Personas.tsx`

- [ ] **Step 5: Probarlo a mano**

Run: `bun run demo`

En `http://localhost:3000`, verificar a 375px de ancho (las devtools con el viewport
angosto, que es como se diseña):

1. El árbol se ve igual y cada grupo es clickeable.
2. El grupo 42 muestra sus ramas en orden de edad, con dirigentes antes que beneficiarios, y
   los adherentes al final.
3. Los cargos vigentes aparecen como etiquetas; el vencido del escenario **no**.
4. El grupo 88 dice que no abrió ninguna rama y que no hay adherentes.
5. El `<select>` de rama del formulario ofrece sólo las ramas de ese grupo.
6. Elegir "Adherente" deshabilita la rama.
7. Marcar un cargo muestra su campo "hasta".
8. Un alta válida agrega la persona a la lista sin recargar.
9. Un alta con un DNI ya cargado muestra el mensaje del duplicado.

- [ ] **Step 6: `bun run check`**

Run: `bun run check`
Expected: verde.

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat(web): pantalla del grupo con sus personas y el alta adentro"
```

---

## Task 12: La pantalla del grupo en mobile

**Files:**
- Modify: `apps/mobile/app/index.tsx`
- Create: `apps/mobile/componentes/AltaDePersona.tsx`
- Create: `apps/mobile/app/grupos/[id].tsx`
- Delete: `apps/mobile/app/personas.tsx`

**Interfaces:**
- Consumes: los mismos hooks y funciones de dominio que la Tarea 11.
- Produces: la ruta `/grupos/[id]` de expo-router.

- [ ] **Step 1: Hacer clickeables los grupos**

En `apps/mobile/app/index.tsx`: borrar el `<Link href="/personas">Ver personas</Link>`, sumar
`id` a las props del componente `Grupo` y envolver su contenido en
`<Link href={`/grupos/${props.id}`} asChild><Pressable>…</Pressable></Link>`, importando
`Pressable` de react-native.

- [ ] **Step 2: Escribir la pantalla**

El formulario va **fuera de `app/`**: expo-router convierte en ruta todo lo que hay adentro,
así que un componente auxiliar ahí sería una pantalla `/grupos/AltaDePersona`.

Crear `apps/mobile/componentes/AltaDePersona.tsx`:

```tsx
import { ErrorDeApi, useCrearPersona } from '@gps/api'
import { etiquetaDeEdades, RAMAS, type Rama } from '@gps/estructura/dominio'
import {
  aFechaDeCalendario,
  CATEGORIAS,
  type Categoria,
  type DatosDeIngreso,
  type DatosDePersona,
  type Problema,
  TIPOS_DE_CARGO,
  TIPOS_DE_DOCUMENTO,
  type TipoDeCargo,
  type TipoDeDocumento,
  validarIngreso,
  validarPersona,
} from '@gps/personas/dominio'
import { type ReactNode, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'

const VACIO: DatosDePersona = {
  tipoDeDocumento: 'dni',
  numeroDeDocumento: '',
  nombres: '',
  apellidos: '',
  fechaDeNacimiento: '',
}

const CLASE_DE_INPUT = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm'

function Campo(props: { etiqueta: string; problema?: string; children: ReactNode }) {
  return (
    <View>
      <Text className="text-xs font-medium text-slate-600">{props.etiqueta}</Text>
      <View className="mt-1">{props.children}</View>
      {props.problema && <Text className="mt-1 text-xs text-red-700">{props.problema}</Text>}
    </View>
  )
}

/** No hay <select> ni <checkbox> en React Native. Una fila de Pressable que
 *  alternan estilo es el patron que ya usaba la pantalla de personas para el
 *  tipo de documento; esto lo generaliza para los cuatro catalogos. */
function Opciones<T extends string>(props: {
  opciones: readonly { id: T; nombre: string }[]
  elegida: T | null
  onElegir: (id: T) => void
  deshabilitado?: boolean
}) {
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {props.opciones.map((opcion) => {
        const activa = opcion.id === props.elegida
        return (
          <Pressable
            key={opcion.id}
            disabled={props.deshabilitado}
            onPress={() => props.onElegir(opcion.id)}
            className={`rounded-full px-3 py-1.5 ${activa ? 'bg-slate-900' : 'bg-slate-100'} ${
              props.deshabilitado ? 'opacity-40' : ''
            }`}
          >
            <Text className={`text-xs ${activa ? 'text-white' : 'text-slate-700'}`}>
              {opcion.nombre}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export function AltaDePersona(props: { grupoId: string; ramasAbiertas: readonly Rama[] }) {
  const alta = useCrearPersona()
  const hoy = new Date()
  const vacio = (): DatosDeIngreso => ({
    grupoId: props.grupoId,
    categoria: 'beneficiario',
    rama: props.ramasAbiertas[0] ?? null,
    desde: aFechaDeCalendario(hoy),
    cargos: [],
  })

  const [datos, setDatos] = useState<DatosDePersona>(VACIO)
  const [ingreso, setIngreso] = useState<DatosDeIngreso>(vacio)
  const [problemas, setProblemas] = useState<readonly Problema[]>([])

  const problemaDe = (campo: Problema['campo']) =>
    problemas.find((problema) => problema.campo === campo)?.mensaje

  const cargoElegido = (cargo: TipoDeCargo) =>
    ingreso.cargos.find((elegido) => elegido.cargo === cargo)

  function alternarCargo(cargo: TipoDeCargo) {
    setIngreso({
      ...ingreso,
      cargos: cargoElegido(cargo)
        ? ingreso.cargos.filter((elegido) => elegido.cargo !== cargo)
        : [...ingreso.cargos, { cargo, hasta: null }],
    })
  }

  function cambiarCategoria(categoria: Categoria) {
    // Un adherente no pertenece a ninguna rama: limpiarla al cambiar evita que
    // el formulario quede en un estado que el dominio rechaza sin que se vea.
    setIngreso({
      ...ingreso,
      categoria,
      rama: categoria === 'adherente' ? null : (ingreso.rama ?? props.ramasAbiertas[0] ?? null),
    })
  }

  function enviar() {
    // Las mismas funciones puras que corre el servicio, y las mismas que corre
    // la web: una sola implementacion, que es el pago de que /dominio sea
    // isomorfo.
    const encontrados = [
      ...validarPersona(datos, hoy),
      ...validarIngreso(ingreso, props.ramasAbiertas, hoy),
    ]
    setProblemas(encontrados)
    if (encontrados.length > 0) return
    alta.mutate(
      { datos, ingreso },
      {
        onSuccess: () => {
          setDatos(VACIO)
          setIngreso(vacio())
        },
      },
    )
  }

  const ramasComoOpciones = props.ramasAbiertas.map((rama) => {
    const catalogo = RAMAS.find((candidata) => candidata.id === rama)
    return {
      id: rama,
      nombre: catalogo ? `${catalogo.nombre} ${etiquetaDeEdades(catalogo)}` : rama,
    }
  })

  return (
    <View className="mt-8 gap-3 rounded-lg bg-white p-4">
      <Text className="text-sm font-semibold text-slate-900">Agregar una persona</Text>

      <Campo etiqueta="Tipo de documento">
        <Opciones
          opciones={TIPOS_DE_DOCUMENTO}
          elegida={datos.tipoDeDocumento}
          onElegir={(tipo: TipoDeDocumento) => setDatos({ ...datos, tipoDeDocumento: tipo })}
        />
      </Campo>

      <Campo etiqueta="Número" problema={problemaDe('numeroDeDocumento')}>
        <TextInput
          className={CLASE_DE_INPUT}
          value={datos.numeroDeDocumento}
          onChangeText={(texto) => setDatos({ ...datos, numeroDeDocumento: texto })}
        />
      </Campo>

      <Campo etiqueta="Apellidos" problema={problemaDe('apellidos')}>
        <TextInput
          className={CLASE_DE_INPUT}
          value={datos.apellidos}
          onChangeText={(texto) => setDatos({ ...datos, apellidos: texto })}
        />
      </Campo>

      <Campo etiqueta="Nombres" problema={problemaDe('nombres')}>
        <TextInput
          className={CLASE_DE_INPUT}
          value={datos.nombres}
          onChangeText={(texto) => setDatos({ ...datos, nombres: texto })}
        />
      </Campo>

      {/* No hay <input type="date"> en React Native. El texto crudo alcanza
          porque validarPersona y validarIngreso rechazan lo que no sea una
          fecha real del almanaque: cambia la comodidad, no la garantia. */}
      <Campo etiqueta="Fecha de nacimiento" problema={problemaDe('fechaDeNacimiento')}>
        <TextInput
          className={CLASE_DE_INPUT}
          placeholder="aaaa-mm-dd"
          keyboardType="numbers-and-punctuation"
          value={datos.fechaDeNacimiento}
          onChangeText={(texto) => setDatos({ ...datos, fechaDeNacimiento: texto })}
        />
      </Campo>

      <Campo etiqueta="Categoría">
        <Opciones opciones={CATEGORIAS} elegida={ingreso.categoria} onElegir={cambiarCategoria} />
      </Campo>

      <Campo etiqueta="Rama" problema={problemaDe('rama')}>
        {/* Solo las ramas abiertas del grupo, y ninguna si es adherente: la
            misma regla que corre el servidor con estructura.obtenerGrupo. */}
        <Opciones
          opciones={ramasComoOpciones}
          elegida={ingreso.rama}
          deshabilitado={ingreso.categoria === 'adherente'}
          onElegir={(rama: Rama) => setIngreso({ ...ingreso, rama })}
        />
      </Campo>

      <Campo etiqueta="Ingresó el" problema={problemaDe('desde')}>
        <TextInput
          className={CLASE_DE_INPUT}
          placeholder="aaaa-mm-dd"
          keyboardType="numbers-and-punctuation"
          value={ingreso.desde}
          onChangeText={(texto) => setIngreso({ ...ingreso, desde: texto })}
        />
      </Campo>

      <Campo etiqueta="Cargos" problema={problemaDe('cargos')}>
        <View className="gap-2">
          {TIPOS_DE_CARGO.map((tipo) => {
            const elegido = cargoElegido(tipo.id)
            return (
              <View key={tipo.id} className="gap-1">
                <Pressable
                  onPress={() => alternarCargo(tipo.id)}
                  className={`self-start rounded-full px-3 py-1.5 ${
                    elegido ? 'bg-slate-900' : 'bg-slate-100'
                  }`}
                >
                  <Text className={`text-xs ${elegido ? 'text-white' : 'text-slate-700'}`}>
                    {tipo.nombre}
                  </Text>
                </Pressable>
                {elegido && (
                  <TextInput
                    className={CLASE_DE_INPUT}
                    placeholder="hasta (aaaa-mm-dd), vacío si no tiene fin"
                    keyboardType="numbers-and-punctuation"
                    value={elegido.hasta ?? ''}
                    onChangeText={(texto) =>
                      setIngreso({
                        ...ingreso,
                        cargos: ingreso.cargos.map((otro) =>
                          otro.cargo === tipo.id ? { ...otro, hasta: texto || null } : otro,
                        ),
                      })
                    }
                  />
                )}
              </View>
            )
          })}
        </View>
      </Campo>

      {alta.isError && (
        <View className="rounded-lg bg-red-50 p-3">
          <Text className="text-sm text-red-800">
            {alta.error instanceof ErrorDeApi ? alta.error.errores.join(' ') : alta.error.message}
          </Text>
        </View>
      )}

      <Pressable
        onPress={enviar}
        disabled={alta.isPending}
        className={`rounded-lg bg-slate-900 px-4 py-2 ${alta.isPending ? 'opacity-50' : ''}`}
      >
        <Text className="text-center text-sm font-medium text-white">
          {alta.isPending ? 'Guardando…' : 'Guardar'}
        </Text>
      </Pressable>
    </View>
  )
}
```

Crear `apps/mobile/app/grupos/[id].tsx`:

```tsx
import { useDistritos, usePersonasDelGrupo } from '@gps/api'
import { etiquetaDeEdades, RAMAS, type Rama } from '@gps/estructura/dominio'
import {
  calcularEdad,
  estaVigente,
  nombreCompleto,
  nombreDelCargo,
  nombreDelTipo,
} from '@gps/personas/dominio'
import { Link, useLocalSearchParams } from 'expo-router'
import { SafeAreaView, ScrollView, Text, View } from 'react-native'
import { AltaDePersona } from '../../componentes/AltaDePersona'

type Persona = NonNullable<ReturnType<typeof usePersonasDelGrupo>['data']>['personas'][number]

function FilaDePersona(props: { persona: Persona; hoy: Date }) {
  const vigentes = props.persona.cargos.filter((cargo) => estaVigente(cargo, props.hoy))
  return (
    <View className="border-b border-slate-200 px-4 py-3">
      <Text className="text-sm font-medium text-slate-900">{nombreCompleto(props.persona)}</Text>
      <Text className="mt-0.5 text-xs text-slate-500">
        {nombreDelTipo(props.persona.tipoDeDocumento)} {props.persona.numeroDeDocumento}
        <Text className="text-slate-400">
          {' · '}
          {calcularEdad(props.persona.fechaDeNacimiento, props.hoy)} años
        </Text>
      </Text>
      {vigentes.length > 0 && (
        <View className="mt-1.5 flex-row flex-wrap gap-1.5">
          {vigentes.map((cargo) => (
            <View key={cargo.cargo} className="rounded-full bg-slate-100 px-2.5 py-1">
              <Text className="text-xs text-slate-700">{nombreDelCargo(cargo.cargo)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

function Seccion(props: {
  titulo: string
  detalle?: string
  personas: readonly Persona[]
  hoy: Date
}) {
  return (
    <View className="mt-6">
      <Text className="text-sm font-semibold text-slate-900">
        {props.titulo}
        {props.detalle && <Text className="font-normal text-slate-400"> {props.detalle}</Text>}
      </Text>
      {props.personas.length === 0 ? (
        <Text className="mt-1 text-xs text-slate-400">Todavía no hay nadie</Text>
      ) : (
        <View className="mt-2 overflow-hidden rounded-lg bg-white">
          {props.personas.map((persona) => (
            <FilaDePersona key={persona.id} persona={persona} hoy={props.hoy} />
          ))}
        </View>
      )}
    </View>
  )
}

export default function Pantalla() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const arbol = useDistritos()
  const lista = usePersonasDelGrupo(id)
  const hoy = new Date()

  // Reusa la query del arbol en vez de estrenar grupo(id): ya esta en cache
  // porque venis de ahi, y de paso trae el distrito para el encabezado.
  const distrito = arbol.data?.distritos.find((candidato) =>
    candidato.grupos.some((grupo) => grupo.id === id),
  )
  const grupo = distrito?.grupos.find((candidato) => candidato.id === id)
  const personas = lista.data?.personas ?? []

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView contentContainerClassName="px-4 py-10">
        <Link href="/" className="text-sm text-slate-500">
          ← Distrito {distrito?.numero}
        </Link>

        {(arbol.isPending || lista.isPending) && (
          <Text className="mt-8 text-sm text-slate-500">Consultando el grupo…</Text>
        )}

        {(arbol.error ?? lista.error) && (
          <View className="mt-8 rounded-lg bg-red-50 p-4">
            <Text className="text-sm text-red-800">
              No se pudo consultar el grupo: {(arbol.error ?? lista.error)?.message}
            </Text>
          </View>
        )}

        {grupo && (
          <>
            <Text className="mt-1 text-lg font-semibold text-slate-900">
              <Text className="text-slate-400">Grupo Scout Nº{grupo.numero} -</Text> {grupo.nombre}
            </Text>

            {/* En el orden del catalogo, de menor a mayor edad, y con los
                dirigentes antes que los beneficiarios: son los que uno busca
                cuando abre la rama. Una rama abierta sin nadie se muestra
                vacia, porque es informacion. */}
            {RAMAS.filter((rama) => grupo.ramas.includes(rama.id)).map((rama) => {
              const suyas = personas.filter((persona) => persona.pertenencia.rama === rama.id)
              return (
                <Seccion
                  key={rama.id}
                  titulo={rama.nombre}
                  detalle={etiquetaDeEdades(rama)}
                  personas={[
                    ...suyas.filter((p) => p.pertenencia.categoria === 'activo'),
                    ...suyas.filter((p) => p.pertenencia.categoria === 'beneficiario'),
                  ]}
                  hoy={hoy}
                />
              )
            })}

            {grupo.ramas.length === 0 && (
              <View className="mt-6 rounded-lg bg-white p-4">
                <Text className="text-sm text-slate-500">
                  El grupo todavía no abrió ninguna rama.
                </Text>
              </View>
            )}

            <Seccion
              titulo="Adherentes"
              personas={personas.filter((p) => p.pertenencia.categoria === 'adherente')}
              hoy={hoy}
            />

            <AltaDePersona grupoId={id} ramasAbiertas={grupo.ramas as readonly Rama[]} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
```

**No duplicar ninguna regla:** todo lo que decide algo —qué se valida, qué pasa al elegir
adherente, qué ramas se ofrecen, qué cargos están vigentes— sale de `@gps/personas/dominio` y
es exactamente lo que usa la web. Si algo hace falta y no está en `/dominio`, va ahí.

Run: `rm apps/mobile/app/personas.tsx`

- [ ] **Step 3: Probarlo a mano**

Run: `bun run demo` en una terminal y `bun run --filter mobile dev` en otra.
Expected: en el simulador, recorrer los mismos nueve puntos de la Tarea 11 Step 5.

- [ ] **Step 4: `bun run check`**

Run: `bun run check`
Expected: verde.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): pantalla del grupo con sus personas y el alta adentro"
```

---

## Task 13: La documentación

Las reglas de `CLAUDE.md` y el mapa de `docs/arquitectura.md` afirman cosas que esta
iteración cambió. Un documento que miente es peor que uno que falta.

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/arquitectura.md`
- Modify: `docs/crear-un-modulo.md`

- [ ] **Step 1: `CLAUDE.md`**

Reemplazar el párrafo **Fronteras de imports** entero por:

> **Fronteras de imports.** `apps/**` no puede importar `*/servidor`. Los módulos tampoco:
> el `/servidor` de un módulo es privado —tiene estado y es la implementación— y se llega a
> él por el contexto (`ctx.sistema`, `ctx.personas`) o por las dependencias que
> `createServices` recibe ya construidas. El `/dominio`, en cambio, **sí** se puede importar
> entre módulos: es puro, isomorfo y sin estado, y las apps ya lo importan de todos. Lo que
> un módulo le ofrece a los demás se declara en `src/dominio/publico.ts`, y es
> deliberadamente más chico que su servicio: es la idea de los *package interfaces* de SAP y
> del modificador `global` de Salesforce, y la mitad que importa es que el resto queda
> privado. Lo impone Biome, con dos aclaraciones: `@gps/core` es la plomería y no un módulo,
> y `packages/demo` está exceptuado incluso para `/servidor`, porque conocer a los otros
> módulos para sembrarlos es literalmente su razón de ser.

En **Cómo crear un módulo nuevo**, agregar entre los pasos 4 y 5:

> 5. Si otro módulo va a necesitar algo de éste, declararlo en `src/dominio/publico.ts` —
>    sólo eso, no la interfaz entera del servicio.

y renumerar los que siguen. En el paso de las dependencias, aclarar que `dependencies` va
tipado contra la `D` del `Module` y que los servicios llegan por el segundo parámetro de
`createServices`, no por el contexto.

En **Qué NO existe todavía**, agregar a la lista: no hay baja ni edición de personas, ni
cargos fuera del ámbito del grupo, ni equipos.

- [ ] **Step 2: `docs/arquitectura.md`**

En **§4 Anatomía de un módulo**, actualizar el diagrama y el bloque de prohibiciones:

```
    apps/**            ---X--->  packages/*/servidor
    packages/<a>/src   ---X--->  @gps/<b>/servidor
    packages/<a>/src   ------->  @gps/<b>/dominio     (la interfaz publica)
```

y agregar `publico.ts` a la lista de lo que vive en `/dominio`.

En **§3 Arranque**, reflejar que `createServices` recibe las dependencias:

```
       +--> servicios = modulo.createServices(core, dependencias)
       |         las dependencias son los servicios de modulo.dependencies,
       |         ya construidos, tipados contra su /dominio/publico.ts
```

En **§6 Autorización (futuro)**, anotar que quién ocupa cada cargo lo dice ahora `personas`,
no `estructura`.

- [ ] **Step 3: `docs/crear-un-modulo.md`**

Agregar la sección de la interfaz pública: cuándo hace falta `publico.ts`, por qué se
declara ahí y no en `/servidor`, y cómo se declara la dependencia en el `Module`. Usar
`Estructura` y `personas` como el ejemplo real.

- [ ] **Step 4: Verificar que los documentos no mientan**

Releer los tres buscando afirmaciones que la iteración volvió falsas: cualquier frase que
diga que los módulos no se importan entre sí, que una persona no pertenece a nada, o que
`personas` no tiene dependencias.

- [ ] **Step 5: `bun run check`**

Run: `bun run check`
Expected: verde.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md docs
git commit -m "docs: la frontera entre modulos, la interfaz publica y las dependencias tipadas"
```

---

## Verificación final

Con las trece tareas hechas:

- [ ] `bun run check` en verde.
- [ ] `bun run schema` no produce cambios (el `schema.gql` commiteado está al día).
- [ ] `bun run demo` y recorrer: el árbol, un grupo lleno, un grupo sin ramas, un alta
      válida, un alta con documento duplicado, y un alta con una rama que el grupo no abrió.
- [ ] `git log --oneline` muestra un commit por tarea, todos en español.
