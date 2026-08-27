# Estructura, persistencia y modo demo — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estrenar la base de datos y las migraciones del proyecto con el primer módulo
de negocio, `estructura` —distritos, grupos y las ramas que cada grupo abre—, y un modo
demo que siembra datos realistas para poder mirar las pantallas.

**Architecture:** La base viaja por `Core` como un handle de Drizzle, construido en la
raíz de composición: ningún módulo conoce el driver. Cada módulo declara sus tablas en su
propio paquete y publica sus migraciones como un campo del contrato `Module`; un runner
en `core` las aplica al arrancar, antes de crear los servicios. El módulo `demo` no es un
`Module` sino una función que compone el escenario llamando a los servicios públicos, con
lo cual los datos de la demostración pasan por las mismas validaciones que los reales.

**Tech Stack:** Bun 1.4, Drizzle ORM 0.45 sobre `bun:sqlite`, drizzle-kit 0.31, Pothos 4,
GraphQL Yoga 5, TanStack Query 5, React 19, Expo + NativeWind, Biome 2.5.

**Spec:** `docs/superpowers/specs/2026-08-26-estructura-persistencia-y-demo-design.md`

## Global Constraints

Todo lo de acá aplica a **todas** las tareas.

- **Idioma.** El idioma lo decide el dominio, no la capa. Español para lo que nombra al
  escultismo y a las reglas de negocio (`Distrito`, `crearGrupo`, campos GraphQL,
  comentarios, nombres de tests). Inglés para el vocabulario técnico de industria
  (`module`, `core`, `index`, `server`, `context`, `config`, `logger`, `schema`,
  `repository`, `cache`, `query`) y para los archivos canónicos (`README.md`,
  `schema.gql`, `package.json`).
- **Sin tildes en el código.** Identificadores, comentarios y nombres de tests van sin
  acentos, como todo el repo (`Version del sistema`, `modulos`). Las tildes sí van en
  los textos que ve el usuario (`Gestión para Scouts`), en los datos del dominio
  (`Ceferino Namuncurá`) y en los `.md`.
- **Portabilidad.** El código bajo `packages/*/src/servidor/**` nunca importa `bun:*` ni
  `node:*`, ni lee archivos, ni consulta la hora del sistema. Todo pasa por `Core`. Lo
  impone Biome. Los **tests** sí pueden importar `bun:sqlite`: la regla cubre `src/`.
- **Fronteras de imports.** `apps/**` no puede importar `@gps/*/servidor`, sólo
  `/dominio`. Lo impone Biome.
- **Mobile-first.** Todo se diseña primero a 375px. `sm:` y `md:` sólo agregan en
  pantallas grandes.
- **Formato Biome:** comillas simples, sin punto y coma, ancho 100, indentación de 2
  espacios. `bun run format` arregla; no pelear a mano con el formateador.
- **Comentarios.** Sólo donde explican un **porqué** que no se deduce del código, como
  en el resto del repo. Nada de comentarios que repiten la línea de abajo.
- **Versiones exactas de las dependencias nuevas:** `drizzle-orm@^0.45.2` (dependency),
  `drizzle-kit@^0.31.10` (devDependency).
- **Tipos literales y `expect`:** `RAMAS` es una tupla `as const`, así que sus campos
  tienen tipos literales estrechos, y `expect(a).toBe(b)` exige que `b` sea asignable al
  tipo de `a`. Cuando compares valores derivados del catálogo, ensanchá el tipo a mano
  (`const x: readonly (number | null)[] = …`) en vez de pelear con la sobrecarga.
- **Forma de las filas en SQL crudo** (verificado contra drizzle 0.45.2 + `bun:sqlite`):
  `bd.get(sql)` devuelve una **tupla** de valores, `bd.all(sql)` devuelve **objetos** por
  columna, y `bd.values(sql)` devuelve **tuplas**. Cuando un test desestructura por
  posición, el método es `values`, no `all`. No aplica a `select().from(tabla).all()`,
  que sí devuelve objetos tipados y es lo correcto ahí.
- **Cada tarea termina con `bun run check` en verde y un commit.** Si `check` falla, la
  tarea no está terminada.

---

## Estructura de archivos

Qué se crea y de qué es responsable cada cosa.

    packages/core/src/
      core.ts            + tipo Bd, + Core.bd, + Core.nuevoId, + entorno 'demo'
      module.ts          + Module.migraciones
      migraciones.ts     NUEVO  tipo Migracion y el runner. No toca la plataforma.

    packages/estructura/
      drizzle.config.ts  NUEVO  apunta drizzle-kit a este paquete, no a uno central
      migraciones/       NUEVO  .sql generados por drizzle-kit
      src/dominio/
        ramas.ts         NUEVO  catalogo cerrado de ramas (constante, no tabla)
        modelos.ts       NUEVO  Distrito, Grupo, DistritoConGrupos
        index.ts         NUEVO  reexporta
      src/servidor/
        sql.d.ts         NUEVO  declara los .sql como texto para tsc
        tablas.ts        NUEVO  esquema Drizzle
        migraciones.ts   NUEVO  importa los .sql y los ordena
        servicio.ts      NUEVO  la unica pieza que consulta la base
        schema.ts        NUEVO  tipos y query de Pothos
        index.ts         NUEVO  el objeto Module

    packages/demo/src/servidor/
      escenario.ts       NUEVO  los datos y la siembra, via servicios publicos
      index.ts           NUEVO  reexporta sembrarEscenario

    services/backend/src/
      bd.ts              NUEVO  unico archivo que conoce el driver
      core.ts            + bd, + nuevoId
      composicion.ts     + migra, + siembra en demo, pasa a async
      server.ts          + recibe el handle, pasa a async
      index.ts           + entorno demo, + ruta de la base
      modules.ts         + estructura

    packages/api/src/
      queries/distritos.graphql  NUEVO
      estructura.ts              NUEVO  hook useDistritos

    apps/web/src/App.tsx           el arbol reemplaza a la tarjeta de version
    apps/mobile/app/index.tsx      idem

---

## Task 1: `Core.bd`, `Core.nuevoId()` y el entorno `demo`

Pone la base en `Core` y la cablea desde la raíz de composición hasta el servidor. Al
terminar, todo compila y anda igual que antes, pero los módulos ya tienen base
disponible.

**Files:**
- Modify: `packages/core/package.json`
- Modify: `packages/core/src/core.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/sistema/test/servicio.test.ts`
- Create: `services/backend/src/bd.ts`
- Modify: `services/backend/src/core.ts`
- Modify: `services/backend/src/composicion.ts`
- Modify: `services/backend/src/server.ts`
- Modify: `services/backend/src/index.ts`
- Modify: `services/backend/scripts/generar-schema.ts`
- Modify: `services/backend/package.json`
- Modify: `services/backend/test/schema.test.ts`
- Modify: `services/backend/test/index.test.ts`
- Create: `services/backend/test/bd.test.ts`
- Create: `services/backend/test/core.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nada, es la primera tarea.
- Produces:
  - `type Bd = BaseSQLiteDatabase<'sync', unknown>` exportado desde `@gps/core`
  - `Core.bd: Bd` y `Core.nuevoId(prefijo: string): string`
  - `Entorno` incluye `'demo'`
  - `crearBd(ruta: string): Bd` en `services/backend/src/bd.ts`
  - `crearCore(config: Config, modulos: readonly string[], bd: Bd): Core`
  - `componer(config: Config, bd: Bd): { esquema: GraphQLSchema; contexto: Context }`
  - `crearServidor(config: Config, bd: Bd)`
  - `leerRutaDeBd(entorno: Entorno, valor: string | undefined): string`

- [ ] **Step 1: Instalar drizzle-orm en los dos paquetes que la necesitan**

`packages/core` la necesita para el **tipo** `BaseSQLiteDatabase`; `services/backend`
para el driver.

```bash
cd packages/core && bun add drizzle-orm@^0.45.2 && cd ../..
cd services/backend && bun add drizzle-orm@^0.45.2 && cd ../..
```

- [ ] **Step 2: Escribir los tests que fallan de `crearBd`**

Crear `services/backend/test/bd.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'
import { crearBd } from '../src/bd'

describe('crearBd', () => {
  test('devuelve una base utilizable', () => {
    const bd = crearBd(':memory:')
    // drizzle devuelve las filas crudas como arrays de valores, no objetos.
    expect(bd.get(sql`SELECT 1 + 1`)).toEqual([2])
  })

  test('deja prendidas las foreign keys: SQLite las ignora por defecto', () => {
    // Sin el PRAGMA, las referencias que declaran las migraciones no rechazan
    // nada y la base acepta filas huerfanas en silencio.
    const bd = crearBd(':memory:')
    bd.run(sql.raw('CREATE TABLE padre (id TEXT PRIMARY KEY)'))
    bd.run(sql.raw('CREATE TABLE hijo (id TEXT PRIMARY KEY, padre_id TEXT REFERENCES padre(id))'))
    expect(() => bd.run(sql.raw("INSERT INTO hijo VALUES ('h1', 'inexistente')"))).toThrow()
  })
})
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `bun test services/backend/test/bd.test.ts`
Expected: FAIL — `Cannot find module '../src/bd'`

- [ ] **Step 4: Agregar el tipo `Bd`, `Core.bd`, `Core.nuevoId()` y el entorno `demo`**

Reemplazar `packages/core/src/core.ts` entero:

```ts
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'

export type Entorno = 'desarrollo' | 'produccion' | 'prueba' | 'demo'

export interface Config {
  readonly version: string
  readonly entorno: Entorno
  readonly puerto: number
}

export interface Logger {
  info(mensaje: string, datos?: Record<string, unknown>): void
  error(mensaje: string, datos?: Record<string, unknown>): void
}

export interface Reloj {
  ahora(): Date
}

/** La base, sin atarse al driver: bun:sqlite en el servidor, expo-sqlite en el
 *  telefono. Quien la abre es la raiz de composicion; un modulo la recibe ya
 *  abierta y no sabe cual es. */
export type Bd = BaseSQLiteDatabase<'sync', unknown>

/** Lo que el core le provee a todo modulo. Es la unica via de un modulo
 *  hacia la plataforma: ver la regla de portabilidad en AGENT.md. */
export interface Core {
  readonly config: Config
  readonly logger: Logger
  readonly reloj: Reloj
  readonly bd: Bd
  /** Nombres de los modulos registrados, en orden de dependencias. */
  readonly modulos: readonly string[]
  /** Identificador nuevo para una entidad, con su prefijo:
   *      grupo_01a04035-7e28-7428-afbd-021d928ae01c
   *  El prefijo se guarda en la base, no se codifica: un id en un log dice de
   *  que entidad es sin ir a buscarlo. Es del dominio, asi que va en espanol y
   *  en singular. Va en Core por la misma razon que reloj.ahora(): generar un
   *  UUID es tocar la plataforma. */
  nuevoId(prefijo: string): string
}
```

En `packages/core/src/index.ts`, agregar `Bd` a la línea de exports de `./core`:

```ts
export type { Bd, Config, Core, Entorno, Logger, Reloj } from './core'
```

- [ ] **Step 5: Escribir `crearBd`**

Crear `services/backend/src/bd.ts`:

```ts
import { Database } from 'bun:sqlite'
import type { Bd } from '@gps/core'
import { drizzle } from 'drizzle-orm/bun-sqlite'

/** Unico archivo del proyecto que conoce el driver de la base. Cambiarlo por
 *  expo-sqlite es todo lo que hace falta para correr los modulos adentro del
 *  telefono: ningun modulo lo importa. */
export function crearBd(ruta: string): Bd {
  const base = new Database(ruta)
  // SQLite viene con las foreign keys apagadas y es por conexion, no por base:
  // sin esta linea las referencias de las migraciones no rechazan nada.
  base.exec('PRAGMA foreign_keys = ON')
  return drizzle(base)
}
```

- [ ] **Step 6: Correr el test y verificar que pasa**

Run: `bun test services/backend/test/bd.test.ts`
Expected: PASS, 2 tests

- [ ] **Step 7: Escribir el test que falla de `nuevoId`**

Crear `services/backend/test/core.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import type { Config } from '@gps/core'
import { crearBd } from '../src/bd'
import { crearCore } from '../src/core'

const config: Config = { version: '1.2.3', entorno: 'prueba', puerto: 0 }

const core = () => crearCore(config, ['sistema'], crearBd(':memory:'))

describe('crearCore', () => {
  test('nuevoId prefija un UUID version 7 con el nombre de la entidad', () => {
    // El tercer grupo del UUID empieza con el nibble de version: 7, no 4.
    expect(core().nuevoId('grupo')).toMatch(
      /^grupo_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })

  test('los ids de una misma entidad salen ordenados por creacion', () => {
    // Es la propiedad por la que se eligio v7 sobre v4, y el prefijo no la
    // rompe: todas las filas de una tabla lo comparten, asi que adentro de su
    // indice el orden lo sigue decidiendo el UUID.
    const uno = core()
    const generados = Array.from({ length: 1000 }, () => uno.nuevoId('grupo'))
    expect(generados).toEqual([...generados].sort())
  })

  test('expone la base que le pasaron', () => {
    const bd = crearBd(':memory:')
    expect(crearCore(config, [], bd).bd).toBe(bd)
  })
})
```

- [ ] **Step 8: Correr el test y verificar que falla**

Run: `bun test services/backend/test/core.test.ts`
Expected: FAIL — `crearCore` recibe 2 argumentos, no 3

- [ ] **Step 9: Implementar `crearCore` con `bd` y `nuevoId`**

Reemplazar `services/backend/src/core.ts` entero:

```ts
import type { Bd, Config, Core } from '@gps/core'

export function crearCore(config: Config, modulos: readonly string[], bd: Bd): Core {
  return {
    config,
    modulos,
    bd,
    reloj: { ahora: () => new Date() },
    nuevoId: (prefijo) => `${prefijo}_${Bun.randomUUIDv7()}`,
    logger: {
      info: (mensaje, datos) => console.log(JSON.stringify({ nivel: 'info', mensaje, ...datos })),
      error: (mensaje, datos) =>
        console.error(JSON.stringify({ nivel: 'error', mensaje, ...datos })),
    },
  }
}
```

- [ ] **Step 10: Correr el test y verificar que pasa**

Run: `bun test services/backend/test/core.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 11: Cablear el handle desde el arranque hasta la composición**

En `services/backend/src/composicion.ts`, cambiar la firma y pasarle `bd` a `crearCore`:

```ts
import { type Bd, type Config, type Context, crearBuilder, ordenarModulos } from '@gps/core'
import type { GraphQLSchema } from 'graphql'
import { crearCore } from './core'
import { modulos } from './modules'

/** Raiz de composicion: ordena los modulos, arma el Core, crea los servicios
 *  de cada uno y compone el esquema. Si algo falta, no compila. */
export function componer(
  config: Config,
  bd: Bd,
): { esquema: GraphQLSchema; contexto: Context } {
  const ordenados = ordenarModulos(modulos)
  const core = crearCore(
    config,
    ordenados.map((modulo) => modulo.name),
    bd,
  )
  const builder = crearBuilder()

  const servicios: Record<string, unknown> = {}
  for (const modulo of ordenados) {
    servicios[modulo.name] = modulo.createServices(core)
    modulo.registerSchema(builder)
  }

  const contexto = { actor: null, ...servicios } as Context
  return { esquema: builder.toSchema(), contexto }
}
```

En `services/backend/src/server.ts`, cambiar la primera línea de la función:

```ts
export function crearServidor(config: Config, bd: Bd) {
  const { esquema, contexto } = componer(config, bd)
```

y agregar `Bd` al import de `@gps/core`:

```ts
import type { Bd, Config } from '@gps/core'
```

- [ ] **Step 12: Escribir el test que falla de `leerRutaDeBd`**

Agregar al final de `services/backend/test/index.test.ts`, y sumar `leerRutaDeBd` al
import de arriba (`import { leerPuerto, leerRutaDeBd } from '../src/index'`):

```ts
describe('leerRutaDeBd', () => {
  test('sin BD definida, usa un archivo en el directorio de trabajo', () => {
    expect(leerRutaDeBd('desarrollo', undefined)).toBe('./gps.db')
  })

  test('respeta BD cuando esta definida', () => {
    expect(leerRutaDeBd('produccion', '/datos/gps.db')).toBe('/datos/gps.db')
  })

  test('en demo ignora BD y usa memoria', () => {
    // Es lo que garantiza que un build de demostracion no pueda apuntar a
    // datos reales, ni siquiera por una variable de entorno mal puesta.
    expect(leerRutaDeBd('demo', '/datos/gps.db')).toBe(':memory:')
  })
})
```

- [ ] **Step 13: Correr el test y verificar que falla**

Run: `bun test services/backend/test/index.test.ts`
Expected: FAIL — `leerRutaDeBd` no existe

- [ ] **Step 14: Implementar `leerRutaDeBd` y reconocer el entorno `demo`**

En `services/backend/src/index.ts`: **no reemplazar el archivo entero.** `leerPuerto` y
`leerConfig` quedan como están. Cambia el bloque de imports, `leerEntorno` gana el caso
`demo`, y se agrega `leerRutaDeBd`:

```ts
import type { Config, Entorno } from '@gps/core'
import paquete from '../../../package.json'
import { crearBd } from './bd'
import { crearServidor } from './server'

function leerEntorno(valor: string | undefined): Entorno {
  if (valor === 'produccion' || valor === 'prueba' || valor === 'demo') return valor
  return 'desarrollo'
}

/** La ruta de la base es del backend, no de los modulos: no entra en Config.
 *  En demo es siempre memoria y no se puede configurar, para que un build de
 *  demostracion no pueda apuntar a datos reales. */
export function leerRutaDeBd(entorno: Entorno, valor: string | undefined): string {
  if (entorno === 'demo') return ':memory:'
  return valor ?? './gps.db'
}
```

y, más abajo, dentro de `if (import.meta.main)`:

```ts
  const config = leerConfig()
  const bd = crearBd(leerRutaDeBd(config.entorno, process.env.BD))
  const servidor = crearServidor(config, bd)
```

- [ ] **Step 15: Correr el test y verificar que pasa**

Run: `bun test services/backend/test/index.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 16: Arreglar los dos consumidores que quedaron rotos**

En `services/backend/scripts/generar-schema.ts`:

```ts
import { printSchema } from 'graphql'
import { crearBd } from '../src/bd'
import { componer } from '../src/composicion'

const { esquema } = componer(
  { version: '0.0.0', entorno: 'prueba', puerto: 0 },
  crearBd(':memory:'),
)
const destino = new URL('../../../schema.gql', import.meta.url).pathname

await Bun.write(destino, `${printSchema(esquema).trim()}\n`)
console.log(`schema.gql actualizado en ${destino}`)
```

En `services/backend/test/schema.test.ts`, agregar el import de `crearBd` y cambiar las
dos llamadas a `componer` para que reciban una base en memoria:

```ts
import { crearBd } from '../src/bd'
```

```ts
async function consultar(consulta: string) {
  const { esquema, contexto } = componer(config, crearBd(':memory:'))
```

```ts
  test('el contexto expone actor en null: auth todavia no existe', () => {
    const { contexto } = componer(config, crearBd(':memory:'))
```

- [ ] **Step 17: Arreglar el `Core` falso de `sistema`**

`Core` ahora tiene dos campos más y el fake del test de `sistema` no compila. En
`packages/sistema/test/servicio.test.ts`, cambiar el import de tipos y el cuerpo de
`coreFalso`:

```ts
import type { Bd, Core } from '@gps/core'
```

```ts
function coreFalso(parcial: Partial<Core> = {}): Core {
  return {
    config: { version: '9.9.9', entorno: 'prueba', puerto: 0 },
    logger: { info: () => {}, error: () => {} },
    reloj: { ahora: () => new Date('2026-01-01T00:00:00Z') },
    // sistema no consulta la base ni genera ids: el fake no los provee, y si
    // algun dia los usara este test explotaria, que es lo que queremos.
    bd: null as unknown as Bd,
    nuevoId: () => {
      throw new Error('sistema no deberia generar ids')
    },
    modulos: ['sistema'],
    ...parcial,
  }
}
```

- [ ] **Step 18: Ignorar el archivo de la base**

Agregar al final de `.gitignore`:

```
# la base de desarrollo se crea sola, no se versiona
*.db
```

- [ ] **Step 19: Correr el check completo**

Run: `bun run check`
Expected: lint, tipos y todos los tests en verde.

- [ ] **Step 20: Commit**

```bash
git add -A
git commit -m "feat(core): la base y los ids llegan por Core

Bd es el handle de Drizzle y lo construye la raiz de composicion, para que
ningun modulo conozca el driver. nuevoId() devuelve un UUIDv7 prefijado con
la entidad (grupo_01a0...) y va en Core por la misma razon que reloj.ahora().
Se agrega el entorno demo, que fuerza la base en memoria."
```

---

## Task 2: migraciones — el contrato y el runner

**Files:**
- Create: `packages/core/src/migraciones.ts`
- Create: `packages/core/test/migraciones.test.ts`
- Modify: `packages/core/src/module.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `services/backend/src/composicion.ts`

**Interfaces:**
- Consumes: `Bd` y `Core` de Task 1.
- Produces:
  - `interface Migracion { readonly nombre: string; readonly sql: string }`
  - `Module.migraciones?: readonly Migracion[]`
  - `aplicarMigraciones(core: Core, modulos: readonly Module<unknown>[]): void`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `packages/core/test/migraciones.test.ts`:

```ts
import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import type { Bd, Core } from '../src/core'
import { aplicarMigraciones, type Migracion } from '../src/migraciones'
import type { Module } from '../src/module'

const HORA = new Date('2026-08-26T12:00:00Z')

function coreDePrueba(bd: Bd): Core {
  return {
    config: { version: '0.0.0', entorno: 'prueba', puerto: 0 },
    logger: { info: () => {}, error: () => {} },
    reloj: { ahora: () => HORA },
    bd,
    modulos: [],
    nuevoId: (prefijo) => `${prefijo}_fijo`,
  }
}

function moduloFalso(name: string, migraciones: Migracion[]): Module<object> {
  return {
    name,
    dependencies: [],
    migraciones,
    createServices: () => ({}),
    registerSchema: () => {},
  }
}

const bdEnMemoria = (): Bd => drizzle(new Database(':memory:'))

const tablas = (bd: Bd) =>
  bd
    .values<[string]>(sql`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`)
    .map(([nombre]) => nombre)

describe('aplicarMigraciones', () => {
  test('aplica las migraciones pendientes de un modulo', () => {
    const bd = bdEnMemoria()
    aplicarMigraciones(coreDePrueba(bd), [
      moduloFalso('personas', [{ nombre: '0000_inicial', sql: 'CREATE TABLE personas (id TEXT)' }]),
    ])
    expect(tablas(bd)).toContain('personas')
  })

  test('una segunda corrida no reaplica lo que ya corrio', () => {
    // El CREATE TABLE es sin IF NOT EXISTS a proposito: si el runner lo
    // reaplicara, esta segunda llamada lanzaria en vez de no hacer nada.
    const bd = bdEnMemoria()
    const modulos = [
      moduloFalso('personas', [{ nombre: '0000_inicial', sql: 'CREATE TABLE personas (id TEXT)' }]),
    ]
    aplicarMigraciones(coreDePrueba(bd), modulos)
    expect(() => aplicarMigraciones(coreDePrueba(bd), modulos)).not.toThrow()
    expect(bd.all(sql`SELECT nombre FROM migraciones`)).toHaveLength(1)
  })

  test('registra el modulo, el nombre y la hora que da el reloj de Core', () => {
    // La hora sale de core.reloj y no de la plataforma: por eso el test puede
    // afirmar el instante exacto en vez de un rango.
    const bd = bdEnMemoria()
    aplicarMigraciones(coreDePrueba(bd), [
      moduloFalso('personas', [{ nombre: '0000_inicial', sql: 'CREATE TABLE personas (id TEXT)' }]),
    ])
    expect(bd.values(sql`SELECT modulo, nombre, aplicada_en FROM migraciones`)).toEqual([
      ['personas', '0000_inicial', HORA.getTime()],
    ])
  })

  test('ejecuta todas las sentencias de un archivo, no solo la primera', () => {
    // drizzle-kit separa las sentencias con este marcador y sqlite prepara una
    // por vez: sin partir el archivo, la segunda tabla nunca se crearia.
    const bd = bdEnMemoria()
    aplicarMigraciones(coreDePrueba(bd), [
      moduloFalso('personas', [
        {
          nombre: '0000_inicial',
          sql: 'CREATE TABLE una (id TEXT);\n--> statement-breakpoint\nCREATE TABLE otra (id TEXT);',
        },
      ]),
    ])
    expect(tablas(bd)).toContain('una')
    expect(tablas(bd)).toContain('otra')
  })

  test('si una sentencia falla, la migracion no queda registrada como aplicada', () => {
    const bd = bdEnMemoria()
    const roto = moduloFalso('personas', [
      {
        nombre: '0000_inicial',
        sql: 'CREATE TABLE una (id TEXT);\n--> statement-breakpoint\nESTO NO ES SQL;',
      },
    ])
    expect(() => aplicarMigraciones(coreDePrueba(bd), [roto])).toThrow()
    expect(bd.all(sql`SELECT nombre FROM migraciones`)).toHaveLength(0)
    expect(tablas(bd)).not.toContain('una')
  })

  test('un modulo sin migraciones no rompe nada', () => {
    const bd = bdEnMemoria()
    expect(() => aplicarMigraciones(coreDePrueba(bd), [moduloFalso('sistema', [])])).not.toThrow()
  })
})
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `bun test packages/core/test/migraciones.test.ts`
Expected: FAIL — `Cannot find module '../src/migraciones'`

- [ ] **Step 3: Escribir el runner**

Crear `packages/core/src/migraciones.ts`:

```ts
import { sql } from 'drizzle-orm'
import type { Core } from './core'
import type { Module } from './module'

/** Una migracion de un modulo. `sql` es el contenido del archivo que genera
 *  drizzle-kit adentro del paquete del modulo. */
export interface Migracion {
  readonly nombre: string
  readonly sql: string
}

/** Marcador con el que drizzle-kit separa las sentencias de un archivo. Hay
 *  que ejecutarlas de a una: sqlite prepara una sentencia por vez. */
const SEPARADOR = '--> statement-breakpoint'

/** Aplica las migraciones pendientes de cada modulo, en el orden en que
 *  vienen. Vive en core y no en el backend a proposito: no toca el sistema de
 *  archivos ni el driver, asi que sirve igual el dia que los modulos corran
 *  adentro del telefono. */
export function aplicarMigraciones(core: Core, modulos: readonly Module<unknown>[]): void {
  core.bd.run(
    sql.raw(`CREATE TABLE IF NOT EXISTS migraciones (
      modulo TEXT NOT NULL,
      nombre TEXT NOT NULL,
      aplicada_en INTEGER NOT NULL,
      PRIMARY KEY (modulo, nombre)
    )`),
  )

  for (const modulo of modulos) {
    for (const migracion of modulo.migraciones ?? []) {
      const yaEsta = core.bd.get(
        sql`SELECT 1 FROM migraciones
            WHERE modulo = ${modulo.name} AND nombre = ${migracion.nombre}`,
      )
      if (yaEsta) continue

      // Las sentencias y su registro van en la misma transaccion: si el SQL
      // falla a la mitad, la migracion no queda anotada como aplicada y la
      // proxima corrida la reintenta desde cero.
      core.bd.transaction((tx) => {
        for (const sentencia of migracion.sql.split(SEPARADOR)) {
          if (sentencia.trim()) tx.run(sql.raw(sentencia))
        }
        tx.run(
          sql`INSERT INTO migraciones (modulo, nombre, aplicada_en)
              VALUES (${modulo.name}, ${migracion.nombre}, ${core.reloj.ahora().getTime()})`,
        )
      })
    }
  }
}
```

- [ ] **Step 4: Agregar `migraciones` al contrato de `Module`**

En `packages/core/src/module.ts`, agregar el import y el campo:

```ts
import type { Builder } from './builder'
import type { Core } from './core'
import type { Migracion } from './migraciones'

/** Un modulo de negocio. Para crear uno nuevo, ver docs/crear-un-modulo.md.
 *  Ojo con el vocabulario: "plugin" en este proyecto significa interceptor
 *  de envelop, no esto. */
export interface Module<S = unknown> {
  readonly name: string
  /** Nombres de otros modulos que este necesita. Determinan el orden de
   *  registro y se validan al arrancar. */
  readonly dependencies: readonly string[]
  /** Migraciones del modulo, en orden. Opcional: un modulo sin tablas no
   *  deberia tener que declarar una lista vacia para decirlo. */
  readonly migraciones?: readonly Migracion[]
  createServices(core: Core): S
  registerSchema(builder: Builder): void
}
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `bun test packages/core/test/migraciones.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 6: Exportar lo nuevo desde `core`**

En `packages/core/src/index.ts`, agregar dos líneas (mantener el orden alfabético que
ya tiene el archivo):

```ts
export type { Migracion } from './migraciones'
export { aplicarMigraciones } from './migraciones'
```

- [ ] **Step 7: Migrar al arrancar**

En `services/backend/src/composicion.ts`, importar `aplicarMigraciones` y llamarlo
entre `crearCore` y el armado de servicios:

```ts
import {
  aplicarMigraciones,
  type Bd,
  type Config,
  type Context,
  crearBuilder,
  ordenarModulos,
} from '@gps/core'
```

```ts
  const builder = crearBuilder()

  // Antes de crear los servicios: ninguno deberia poder consultar una tabla
  // que todavia no existe.
  aplicarMigraciones(core, ordenados)

  const servicios: Record<string, unknown> = {}
```

- [ ] **Step 8: Correr el check completo**

Run: `bun run check`
Expected: todo en verde.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(core): migraciones por modulo

Module publica sus migraciones y un runner en core aplica las pendientes al
arrancar, antes de crear los servicios. El runner no toca el sistema de
archivos, asi que sirve igual cuando los modulos corran en el telefono."
```

---

## Task 3: `packages/estructura` — el dominio

Sólo el paquete y `/dominio`. Sin base, sin GraphQL: son reglas y datos puros que
comparten servidor y pantallas.

**Files:**
- Create: `packages/estructura/package.json`
- Create: `packages/estructura/tsconfig.json`
- Create: `packages/estructura/src/dominio/ramas.ts`
- Create: `packages/estructura/src/dominio/modelos.ts`
- Create: `packages/estructura/src/dominio/index.ts`
- Create: `packages/estructura/test/ramas.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces (todo desde `@gps/estructura/dominio`):
  - `RAMAS` — tupla `as const` de `{ id, nombre, desde, hasta }`
  - `type Rama = 'castores' | 'lobatos' | 'scouts' | 'raiders' | 'rovers' | 'adultos'`
  - `interface Marcas { creadoEn: Date; actualizadoEn: Date }`
  - `interface Distrito extends Marcas { id, numero, zona }`
  - `interface Grupo extends Marcas { id, numero, nombre, distritoId }`
  - `interface DistritoConGrupos extends Distrito { grupos: readonly GrupoConRamas[] }`
  - `type GrupoConRamas = Grupo & { readonly ramas: readonly Rama[] }`

- [ ] **Step 1: Crear el paquete**

Crear `packages/estructura/package.json`. `exports` declara sólo `./dominio` por ahora;
`./servidor` se agrega en la Task 6, cuando el archivo exista.

```json
{
  "name": "@gps/estructura",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    "./dominio": "./src/dominio/index.ts"
  },
  "scripts": {
    "compile": "tsc --noEmit"
  },
  "dependencies": {
    "@gps/core": "workspace:*",
    "drizzle-orm": "^0.45.2"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "drizzle-kit": "^0.31.10",
    "typescript": "^5.7.0"
  }
}
```

Crear `packages/estructura/tsconfig.json`, idéntico al de `sistema`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "test"]
}
```

Correr `bun install` desde la raíz para que el workspace enlace el paquete nuevo.

- [ ] **Step 2: Escribir los tests que fallan del catálogo**

Crear `packages/estructura/test/ramas.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import { RAMAS } from '../src/dominio/ramas'

describe('catalogo de RAMAS', () => {
  test('tiene las seis ramas, de menor a mayor edad', () => {
    expect(RAMAS.map((rama) => rama.id)).toEqual([
      'castores',
      'lobatos',
      'scouts',
      'raiders',
      'rovers',
      'adultos',
    ])
  })

  test('los tramos de edad se encadenan sin huecos ni superposicion', () => {
    // El tope de cada rama es el piso de la siguiente: un chico de 10 pasa de
    // Lobatos a Scouts sin quedar afuera de las dos ni adentro de ambas.
    // Los tipos se ensanchan a mano: `slice` sobre una tupla `as const` devuelve
    // la union de todos los elementos, y sin ensanchar, el 5 de Castores no es
    // asignable al tipo de los topes y `expect` no resuelve la sobrecarga.
    const topes: readonly (number | null)[] = RAMAS.slice(0, -1).map((rama) => rama.hasta)
    const pisos: readonly (number | null)[] = RAMAS.slice(1).map((rama) => rama.desde)
    expect(topes).toEqual(pisos)
  })

  test('solo la ultima rama no tiene tope: Adultos es abierta hacia arriba', () => {
    expect(RAMAS.filter((rama) => rama.hasta === null).map((rama) => rama.id)).toEqual(['adultos'])
  })
})
```

- [ ] **Step 3: Correr los tests y verificar que fallan**

Run: `bun test packages/estructura/test/ramas.test.ts`
Expected: FAIL — `Cannot find module '../src/dominio/ramas'`

- [ ] **Step 4: Escribir el catálogo**

Crear `packages/estructura/src/dominio/ramas.ts`:

```ts
/** Las ramas en que la asociacion divide a sus miembros por edad. Es un
 *  conjunto cerrado, por eso es una constante y no una tabla: no hay siembra
 *  ni migracion que mantener, y al vivir en /dominio la comparten el servidor
 *  y las pantallas sin traducirla.
 *
 *  `hasta` es exclusivo y coincide con el `desde` de la rama siguiente.
 *  `hasta: null` en Adultos es la rama abierta hacia arriba: esta pensada
 *  para el mayor de 21 que participa como beneficiario y no quiere chicos a
 *  cargo, que es lo que la distingue de ser dirigente. */
export const RAMAS = [
  { id: 'castores', nombre: 'Castores', desde: 5, hasta: 7 },
  { id: 'lobatos', nombre: 'Lobatos', desde: 7, hasta: 10 },
  { id: 'scouts', nombre: 'Scouts', desde: 10, hasta: 14 },
  { id: 'raiders', nombre: 'Raiders', desde: 14, hasta: 17 },
  { id: 'rovers', nombre: 'Rovers', desde: 17, hasta: 21 },
  { id: 'adultos', nombre: 'Adultos', desde: 21, hasta: null },
] as const

export type Rama = (typeof RAMAS)[number]['id']
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `bun test packages/estructura/test/ramas.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 6: Escribir los modelos**

Crear `packages/estructura/src/dominio/modelos.ts`:

```ts
import type { Rama } from './ramas'

/** Cuando se creo y cuando se toco por ultima vez. Las escribe el servicio
 *  con core.reloj.ahora(), nunca la base: ver la regla de portabilidad. */
export interface Marcas {
  readonly creadoEn: Date
  readonly actualizadoEn: Date
}

/** Los distritos en que se divide la diocesis. La diocesis en si no es una
 *  entidad: hay una sola por instancia.
 *
 *  No tiene nombre: con el numero alcanza para identificarlo, y un nombre que
 *  nadie usa es una columna que se llena mal. `zona` hace doble funcion: es el
 *  dato descriptivo y la etiqueta legible debajo de "Distrito 3". */
export interface Distrito extends Marcas {
  readonly id: string
  readonly numero: number
  readonly zona: string
}

/** Un grupo scout. A diferencia del distrito si tiene nombre propio -el santo
 *  o el procer-, y va sin el numero ni la palabra "Grupo Scout": el numero
 *  cae en el medio del nombre completo y la pantalla los compone. */
export interface Grupo extends Marcas {
  readonly id: string
  readonly numero: number
  readonly nombre: string
  readonly distritoId: string
}

export type GrupoConRamas = Grupo & { readonly ramas: readonly Rama[] }

export interface DistritoConGrupos extends Distrito {
  readonly grupos: readonly GrupoConRamas[]
}
```

Crear `packages/estructura/src/dominio/index.ts`:

```ts
export type { Distrito, DistritoConGrupos, Grupo, GrupoConRamas, Marcas } from './modelos'
export type { Rama } from './ramas'
export { RAMAS } from './ramas'
```

- [ ] **Step 7: Correr el check completo**

Run: `bun run check`
Expected: todo en verde.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(estructura): el dominio del arbol de la asociacion

Las ramas son un conjunto cerrado, asi que son una constante en /dominio y
no una tabla. Los modelos de distrito y grupo son isomorfos: los usan igual
el servidor y las pantallas."
```

---

## Task 4: tablas y la migración inicial

**Files:**
- Create: `packages/estructura/drizzle.config.ts`
- Create: `packages/estructura/src/servidor/tablas.ts`
- Create: `packages/estructura/src/servidor/sql.d.ts`
- Create: `packages/estructura/src/servidor/migraciones.ts`
- Create: `packages/estructura/migraciones/0000_inicial.sql` (lo genera drizzle-kit)
- Create: `packages/estructura/test/migraciones.test.ts`

**Interfaces:**
- Consumes: `Rama` de Task 3; `Migracion` y `aplicarMigraciones` de Task 2.
- Produces:
  - `distritos`, `grupos`, `ramasDelGrupo` en `src/servidor/tablas.ts`
  - `migraciones: readonly Migracion[]` en `src/servidor/migraciones.ts`

- [ ] **Step 1: Declarar las tablas**

Crear `packages/estructura/src/servidor/tablas.ts`:

```ts
import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { Rama } from '../dominio/ramas'

// Se esparce en cada tabla en vez de abstraerse: Drizzle necesita las columnas
// declaradas literalmente para poder inferir los tipos de las filas.
const marcas = {
  creadoEn: integer('creado_en', { mode: 'timestamp_ms' }).notNull(),
  actualizadoEn: integer('actualizado_en', { mode: 'timestamp_ms' }).notNull(),
}

// El numero es la clave natural: identifica al distrito para la asociacion.
// Va como UNIQUE y no como primaria, porque las claves naturales cambian -un
// distrito se renumera al partirse- y eso arrastraria cada foreign key.
export const distritos = sqliteTable('distritos', {
  id: text('id').primaryKey(),
  numero: integer('numero').notNull().unique(),
  zona: text('zona').notNull(),
  ...marcas,
})

/** El numero de grupo es unico en toda la diocesis, no dentro del distrito:
 *  identifica al grupo por si solo. Si un grupo cerrado alguna vez reusa su
 *  numero, la salida es marcarlo cerrado e indice parcial, no sacar el UNIQUE. */
export const grupos = sqliteTable('grupos', {
  id: text('id').primaryKey(),
  numero: integer('numero').notNull().unique(),
  nombre: text('nombre').notNull(),
  distritoId: text('distrito_id')
    .notNull()
    .references(() => distritos.id),
  ...marcas,
})

/** Que ramas tiene abiertas cada grupo. La clave primaria compuesta es lo que
 *  hace que abrir dos veces la misma rama sea un error de la base y no una
 *  regla que haya que acordarse de escribir. No lleva `actualizadoEn`: sus
 *  dos columnas son la clave, asi que la fila no se puede modificar. */
export const ramasDelGrupo = sqliteTable(
  'ramas_del_grupo',
  {
    grupoId: text('grupo_id')
      .notNull()
      .references(() => grupos.id),
    rama: text('rama').$type<Rama>().notNull(),
    creadoEn: integer('creado_en', { mode: 'timestamp_ms' }).notNull(),
  },
  (tabla) => [primaryKey({ columns: [tabla.grupoId, tabla.rama] })],
)
```

- [ ] **Step 2: Configurar drizzle-kit para este paquete**

Crear `packages/estructura/drizzle.config.ts`:

```ts
import { defineConfig } from 'drizzle-kit'

/** Cada modulo genera sus migraciones adentro de su propio paquete. No hay un
 *  archivo central de esquema que todos tengan que editar, que es justo lo
 *  que romperia la arquitectura de modulos.
 *
 *  Regenerar, parado en este directorio:
 *      bunx drizzle-kit generate --name <nombre>
 *  y despues sumar el archivo nuevo a src/servidor/migraciones.ts. */
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/servidor/tablas.ts',
  out: './migraciones',
})
```

- [ ] **Step 3: Generar la migración inicial**

```bash
cd packages/estructura && bunx drizzle-kit generate --name inicial && cd ../..
```

Expected: crea `packages/estructura/migraciones/0000_inicial.sql` con los tres
`CREATE TABLE` separados por `--> statement-breakpoint`, más `migraciones/meta/`.
Verificar el contenido con `cat packages/estructura/migraciones/0000_inicial.sql`; tiene
que incluir `PRIMARY KEY(\`grupo_id\`, \`rama\`)` y las dos `FOREIGN KEY`.

- [ ] **Step 4: Publicar las migraciones del módulo**

Crear `packages/estructura/src/servidor/sql.d.ts`:

```ts
/** Los .sql que genera drizzle-kit se importan como texto, no como modulo.
 *  Sin esta declaracion tsc no sabe que tipo tienen. */
declare module '*.sql' {
  const contenido: string
  export default contenido
}
```

Crear `packages/estructura/src/servidor/migraciones.ts`:

```ts
import type { Migracion } from '@gps/core'
import inicial from '../../migraciones/0000_inicial.sql' with { type: 'text' }

/** Las migraciones del modulo, en orden. Agregar una es generarla con
 *  `bunx drizzle-kit generate --name <x>` y sumarle una linea a esta lista. */
export const migraciones: readonly Migracion[] = [{ nombre: '0000_inicial', sql: inicial }]
```

- [ ] **Step 5: Escribir los tests que verifican la migración**

Crear `packages/estructura/test/migraciones.test.ts`. Estos tests corren el SQL de
verdad, así que atrapan tanto un archivo mal importado como una restricción que no muerde.

```ts
import { Database } from 'bun:sqlite'
import { beforeEach, describe, expect, test } from 'bun:test'
import { aplicarMigraciones, type Bd, type Core, type Module } from '@gps/core'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migraciones } from '../src/servidor/migraciones'

const HORA = new Date('2026-08-26T12:00:00Z')

function coreDePrueba(bd: Bd): Core {
  return {
    config: { version: '0.0.0', entorno: 'prueba', puerto: 0 },
    logger: { info: () => {}, error: () => {} },
    reloj: { ahora: () => HORA },
    bd,
    modulos: ['estructura'],
    nuevoId: (prefijo) => `${prefijo}_fijo`,
  }
}

const moduloFalso: Module<object> = {
  name: 'estructura',
  dependencies: [],
  migraciones,
  createServices: () => ({}),
  registerSchema: () => {},
}

let bd: Bd

beforeEach(() => {
  const base = new Database(':memory:')
  // Igual que crearBd en el backend: sin el PRAGMA las foreign keys no muerden.
  base.exec('PRAGMA foreign_keys = ON')
  bd = drizzle(base)
  aplicarMigraciones(coreDePrueba(bd), [moduloFalso])
})

const insertarDistrito = (id = 'd1', numero = 1) =>
  bd.run(sql`INSERT INTO distritos VALUES (${id}, ${numero}, 'San Isidro', 0, 0)`)

const insertarGrupo = (distritoId: string, id = 'g1', numero = 42) =>
  bd.run(
    sql`INSERT INTO grupos VALUES (${id}, ${numero}, 'Ceferino Namuncura', ${distritoId}, 0, 0)`,
  )

describe('migraciones de estructura', () => {
  test('crean las tres tablas del modulo', () => {
    const nombres = bd
      .values<[string]>(sql`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`)
      .map(([nombre]) => nombre)
    expect(nombres).toEqual(['distritos', 'grupos', 'migraciones', 'ramas_del_grupo'])
  })

  test('un grupo no puede colgar de un distrito inexistente', () => {
    expect(() => insertarGrupo('no-existe')).toThrow()
  })

  test('dos distritos no pueden compartir numero', () => {
    insertarDistrito('d1', 1)
    expect(() => insertarDistrito('d2', 1)).toThrow()
  })

  test('dos grupos no pueden compartir numero, ni siquiera en distritos distintos', () => {
    // El numero de grupo es unico en toda la diocesis: es lo que impide que
    // existan dos "Grupo Scout 42" y que la cuota de uno se cargue en el otro.
    insertarDistrito('d1', 1)
    insertarDistrito('d2', 2)
    insertarGrupo('d1', 'g1', 42)
    expect(() => insertarGrupo('d2', 'g2', 42)).toThrow()
  })

  test('el mismo grupo no puede abrir dos veces la misma rama', () => {
    insertarDistrito()
    insertarGrupo('d1')
    bd.run(sql`INSERT INTO ramas_del_grupo VALUES ('g1', 'lobatos', 0)`)
    expect(() => bd.run(sql`INSERT INTO ramas_del_grupo VALUES ('g1', 'lobatos', 0)`)).toThrow()
  })

  test('el mismo grupo si puede abrir ramas distintas', () => {
    insertarDistrito()
    insertarGrupo('d1')
    bd.run(sql`INSERT INTO ramas_del_grupo VALUES ('g1', 'lobatos', 0)`)
    expect(() => bd.run(sql`INSERT INTO ramas_del_grupo VALUES ('g1', 'scouts', 0)`)).not.toThrow()
  })
})
```

- [ ] **Step 6: Correr los tests y verificar que pasan**

Run: `bun test packages/estructura/test/migraciones.test.ts`
Expected: PASS, 6 tests

Si falla con `Cannot find module '../../migraciones/0000_inicial.sql'`, el nombre del
archivo generado no coincide: ajustar el import al nombre real.

- [ ] **Step 7: Correr el check completo**

Run: `bun run check`
Expected: todo en verde.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(estructura): tablas y migracion inicial

drizzle-kit genera el SQL adentro del propio paquete y el modulo lo publica
como texto. La clave primaria compuesta de ramas_del_grupo hace que abrir dos
veces la misma rama sea un error de la base."
```

---

## Task 5: el servicio

**Files:**
- Create: `packages/estructura/src/servidor/servicio.ts`
- Create: `packages/estructura/test/servicio.test.ts`

**Interfaces:**
- Consumes: tablas de Task 4, modelos y `RAMAS` de Task 3, `Core` de Task 1.
- Produces:
  - `interface ServicioDeEstructura` con `crearDistrito({ numero, zona })`,
    `crearGrupo({ numero, nombre, distritoId })`, `abrirRama`, `listarDistritos`
  - `crearServicioDeEstructura(core: Core): ServicioDeEstructura`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `packages/estructura/test/servicio.test.ts`:

```ts
import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { aplicarMigraciones, type Bd, type Core, type Module } from '@gps/core'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migraciones } from '../src/servidor/migraciones'
import { crearServicioDeEstructura, type ServicioDeEstructura } from '../src/servidor/servicio'

const HORA = new Date('2026-08-26T12:00:00Z')

/** Un modulo con la base migrada y un Core de reloj e ids fijos: asi los
 *  tests pueden afirmar valores exactos en vez de rangos. */
function montar(): ServicioDeEstructura {
  const base = new Database(':memory:')
  base.exec('PRAGMA foreign_keys = ON')
  const bd: Bd = drizzle(base)

  let contador = 0
  const core: Core = {
    config: { version: '0.0.0', entorno: 'prueba', puerto: 0 },
    logger: { info: () => {}, error: () => {} },
    reloj: { ahora: () => HORA },
    bd,
    modulos: ['estructura'],
    nuevoId: (prefijo) => `${prefijo}_${++contador}`,
  }

  const modulo: Module<object> = {
    name: 'estructura',
    dependencies: [],
    migraciones,
    createServices: () => ({}),
    registerSchema: () => {},
  }
  aplicarMigraciones(core, [modulo])
  return crearServicioDeEstructura(core)
}

describe('crearDistrito', () => {
  test('devuelve el distrito con el id y las marcas que da Core', async () => {
    const servicio = montar()
    // Con await: sin el, la asercion queda pendiente y el test pasa sin mirar nada.
    await expect(
      servicio.crearDistrito({ numero: 1, zona: 'San Isidro' }),
    ).resolves.toEqual({
      id: 'distrito_1',
      numero: 1,
      zona: 'San Isidro',
      creadoEn: HORA,
      actualizadoEn: HORA,
    })
  })
})

describe('listarDistritos', () => {
  test('sin datos devuelve una lista vacia, no undefined', async () => {
    expect(await montar().listarDistritos()).toEqual([])
  })

  test('devuelve el arbol armado: distrito, sus grupos y sus ramas', async () => {
    const servicio = montar()
    const distrito = await servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })
    const grupo = await servicio.crearGrupo({
      numero: 42,
      nombre: 'Ceferino Namuncurá',
      distritoId: distrito.id,
    })
    await servicio.abrirRama(grupo.id, 'lobatos')
    await servicio.abrirRama(grupo.id, 'scouts')

    const arbol = await servicio.listarDistritos()
    expect(arbol).toHaveLength(1)
    expect(arbol[0]?.zona).toBe('San Isidro')
    expect(arbol[0]?.grupos).toHaveLength(1)
    expect(arbol[0]?.grupos[0]?.numero).toBe(42)
    expect(arbol[0]?.grupos[0]?.ramas).toEqual(['lobatos', 'scouts'])
  })

  test('las ramas vuelven en orden del catalogo, no en el que se abrieron', async () => {
    // La pantalla las muestra de menor a mayor edad; que ese orden dependa de
    // en que orden se cargaron seria un bug dificil de ver.
    const servicio = montar()
    const distrito = await servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })
    const grupo = await servicio.crearGrupo({ numero: 1, nombre: 'Uno', distritoId: distrito.id })
    await servicio.abrirRama(grupo.id, 'rovers')
    await servicio.abrirRama(grupo.id, 'castores')
    await servicio.abrirRama(grupo.id, 'scouts')

    const arbol = await servicio.listarDistritos()
    expect(arbol[0]?.grupos[0]?.ramas).toEqual(['castores', 'scouts', 'rovers'])
  })

  test('un grupo sin ramas abiertas viene con la lista vacia', async () => {
    const servicio = montar()
    const distrito = await servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })
    await servicio.crearGrupo({ numero: 88, nombre: 'Ocho Ocho', distritoId: distrito.id })

    const arbol = await servicio.listarDistritos()
    expect(arbol[0]?.grupos[0]?.ramas).toEqual([])
  })

  test('un distrito sin grupos viene con la lista vacia', async () => {
    const servicio = montar()
    await servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })
    expect((await servicio.listarDistritos())[0]?.grupos).toEqual([])
  })

  test('distritos y grupos vienen ordenados por numero, no por orden de carga', async () => {
    const servicio = montar()
    const sur = await servicio.crearDistrito({ numero: 2, zona: 'Quilmes' })
    await servicio.crearDistrito({ numero: 1, zona: 'Ciudad' })
    await servicio.crearGrupo({ numero: 42, nombre: 'Cuarenta', distritoId: sur.id })
    await servicio.crearGrupo({ numero: 7, nombre: 'Siete', distritoId: sur.id })

    const arbol = await servicio.listarDistritos()
    expect(arbol.map((distrito) => distrito.numero)).toEqual([1, 2])
    expect(arbol[1]?.grupos.map((grupo) => grupo.numero)).toEqual([7, 42])
  })

  test('dos distritos con el mismo numero no se pueden crear', async () => {
    // La clave natural la impone la base, no el servicio: es lo unico que no
    // se puede saltear.
    const servicio = montar()
    await servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })
    await expect(
      servicio.crearDistrito({ numero: 1, zona: 'Quilmes' }),
    ).rejects.toThrow()
  })
})

describe('abrirRama', () => {
  test('abrir dos veces la misma rama falla', async () => {
    const servicio = montar()
    const distrito = await servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })
    const grupo = await servicio.crearGrupo({ numero: 1, nombre: 'Uno', distritoId: distrito.id })
    await servicio.abrirRama(grupo.id, 'lobatos')
    await expect(servicio.abrirRama(grupo.id, 'lobatos')).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `bun test packages/estructura/test/servicio.test.ts`
Expected: FAIL — `Cannot find module '../src/servidor/servicio'`

- [ ] **Step 3: Escribir el servicio**

Crear `packages/estructura/src/servidor/servicio.ts`:

```ts
import type { Core } from '@gps/core'
import type { Distrito, DistritoConGrupos, Grupo, GrupoConRamas } from '../dominio/modelos'
import { type Rama, RAMAS } from '../dominio/ramas'
import { distritos, grupos, ramasDelGrupo } from './tablas'

export interface ServicioDeEstructura {
  crearDistrito(datos: { numero: number; zona: string }): Promise<Distrito>
  crearGrupo(datos: { numero: number; nombre: string; distritoId: string }): Promise<Grupo>
  abrirRama(grupoId: string, rama: Rama): Promise<void>
  listarDistritos(): Promise<readonly DistritoConGrupos[]>
}

const ORDEN_DEL_CATALOGO = new Map(RAMAS.map((rama, indice) => [rama.id, indice]))

/** De menor a mayor edad, como las muestra la pantalla. Sin esto el orden
 *  seria el de insercion, que es un detalle de como se cargaron los datos. */
function ordenarPorCatalogo(ramas: readonly Rama[]): Rama[] {
  return [...ramas].sort(
    (una, otra) => (ORDEN_DEL_CATALOGO.get(una) ?? 0) - (ORDEN_DEL_CATALOGO.get(otra) ?? 0),
  )
}

/** Los metodos devuelven Promise aunque el driver de SQLite sea sincrono: es
 *  la costura que deja pasar a Postgres o a un driver asincrono en el
 *  telefono sin tocar a ningun consumidor. */
export function crearServicioDeEstructura(core: Core): ServicioDeEstructura {
  return {
    async crearDistrito(datos) {
      const ahora = core.reloj.ahora()
      const distrito = {
        id: core.nuevoId('distrito'),
        ...datos,
        creadoEn: ahora,
        actualizadoEn: ahora,
      }
      core.bd.insert(distritos).values(distrito).run()
      return distrito
    },

    async crearGrupo(datos) {
      const ahora = core.reloj.ahora()
      const grupo = { id: core.nuevoId('grupo'), ...datos, creadoEn: ahora, actualizadoEn: ahora }
      core.bd.insert(grupos).values(grupo).run()
      return grupo
    },

    async abrirRama(grupoId, rama) {
      core.bd.insert(ramasDelGrupo).values({ grupoId, rama, creadoEn: core.reloj.ahora() }).run()
    },

    async listarDistritos() {
      // Tres consultas y el arbol se arma en memoria. Con la cantidad de
      // distritos y grupos de una diocesis alcanza de sobra; si algun dia deja
      // de alcanzar, se arregla aca y en ningun otro lado.
      const filasDistritos = core.bd.select().from(distritos).orderBy(distritos.numero).all()
      const filasGrupos = core.bd.select().from(grupos).orderBy(grupos.numero).all()
      const filasRamas = core.bd.select().from(ramasDelGrupo).all()

      const ramasPorGrupo = new Map<string, Rama[]>()
      for (const fila of filasRamas) {
        const abiertas = ramasPorGrupo.get(fila.grupoId) ?? []
        abiertas.push(fila.rama)
        ramasPorGrupo.set(fila.grupoId, abiertas)
      }

      const gruposPorDistrito = new Map<string, GrupoConRamas[]>()
      for (const grupo of filasGrupos) {
        const delDistrito = gruposPorDistrito.get(grupo.distritoId) ?? []
        delDistrito.push({ ...grupo, ramas: ordenarPorCatalogo(ramasPorGrupo.get(grupo.id) ?? []) })
        gruposPorDistrito.set(grupo.distritoId, delDistrito)
      }

      return filasDistritos.map((distrito) => ({
        ...distrito,
        grupos: gruposPorDistrito.get(distrito.id) ?? [],
      }))
    },
  }
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `bun test packages/estructura/test/servicio.test.ts`
Expected: PASS, 9 tests

- [ ] **Step 5: Correr el check completo**

Run: `bun run check`
Expected: todo en verde.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(estructura): el servicio del arbol

Es la unica pieza del modulo que consulta la base. Las marcas de tiempo
salen de core.reloj y los ids de core.nuevoId: la hora no entra por el
driver. Las ramas vuelven en orden de catalogo, no de insercion."
```

---

## Task 6: esquema GraphQL y registro del módulo

**Files:**
- Create: `packages/estructura/src/servidor/schema.ts`
- Create: `packages/estructura/src/servidor/index.ts`
- Modify: `packages/estructura/package.json` (agregar el export `./servidor`)
- Modify: `services/backend/src/modules.ts`
- Modify: `services/backend/package.json`
- Modify: `services/backend/test/schema.test.ts`
- Modify: `schema.gql` (regenerado)

**Interfaces:**
- Consumes: `crearServicioDeEstructura` y `ServicioDeEstructura` de Task 5,
  `migraciones` de Task 4, `RAMAS`/`Rama` de Task 3.
- Produces:
  - `estructura: Module<ServicioDeEstructura>` en `@gps/estructura/servidor`
  - `Context.estructura` por declaration merging
  - `Query.distritos`, `type Distrito`, `type Grupo`, `enum Rama` en el esquema público

- [ ] **Step 1: Escribir los tests que fallan**

En `services/backend/test/schema.test.ts`, actualizar la aserción de módulos y agregar
los casos nuevos:

```ts
  test('lista los modulos efectivamente registrados', async () => {
    const resultado = await consultar('{ version { modulos } }')
    expect(resultado.data).toEqual({ version: { modulos: ['sistema', 'estructura'] } })
  })

  test('expone el arbol de la diocesis, vacio si no hay datos', async () => {
    const resultado = await consultar(
      '{ distritos { id numero zona grupos { id numero ramas } } }',
    )
    expect(resultado.errors).toBeUndefined()
    expect(resultado.data).toEqual({ distritos: [] })
  })

  test('el enum Rama publica los seis ids del catalogo', async () => {
    const resultado = await consultar('{ __type(name: "Rama") { enumValues { name } } }')
    const valores = (
      resultado.data?.__type as { enumValues: { name: string }[] }
    ).enumValues.map((valor) => valor.name)
    expect(valores).toEqual(['adultos', 'castores', 'lobatos', 'raiders', 'rovers', 'scouts'])
  })
```

Nota sobre el último test: Pothos ordena el esquema alfabéticamente al construirlo, así
que los valores del enum salen en ese orden y no en el de edad del catálogo. El orden de
edad es responsabilidad del servicio (Task 5), no del esquema.

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `bun test services/backend/test/schema.test.ts`
Expected: FAIL — `Cannot query field "distritos" on type "Query"`

- [ ] **Step 3: Escribir el esquema del módulo**

Crear `packages/estructura/src/servidor/schema.ts`:

```ts
import type { Builder } from '@gps/core'
import type { DistritoConGrupos, GrupoConRamas } from '../dominio/modelos'
import { type Rama, RAMAS } from '../dominio/ramas'

export function registrarSchema(builder: Builder): void {
  const RamaRef = builder.enumType('Rama', {
    description: 'Ramas en que la asociacion divide a sus miembros por edad.',
    // Los valores son los ids del dominio, en minuscula y no gritados como
    // manda la convencion de GraphQL. Es a proposito: asi lo que viaja por la
    // red es el id, y la pantalla saca nombre y rango etario de RAMAS sin una
    // tabla de traduccion en el medio.
    values: RAMAS.map((rama) => rama.id) as unknown as readonly Rama[],
  })

  const GrupoRef = builder.objectRef<GrupoConRamas>('Grupo').implement({
    description: 'Un grupo scout y las ramas que tiene abiertas.',
    fields: (t) => ({
      id: t.exposeID('id'),
      numero: t.exposeInt('numero'),
      nombre: t.exposeString('nombre'),
      ramas: t.field({
        type: [RamaRef],
        description: 'De menor a mayor edad. Vacia si el grupo no abrio ninguna.',
        resolve: (grupo) => [...grupo.ramas],
      }),
    }),
  })

  const DistritoRef = builder.objectRef<DistritoConGrupos>('Distrito').implement({
    description: 'Un distrito de la diocesis, con sus grupos.',
    fields: (t) => ({
      id: t.exposeID('id'),
      numero: t.exposeInt('numero'),
      zona: t.exposeString('zona'),
      grupos: t.field({ type: [GrupoRef], resolve: (distrito) => [...distrito.grupos] }),
    }),
  })

  builder.queryField('distritos', (t) =>
    t.field({
      type: [DistritoRef],
      description: 'El arbol de la diocesis: distritos, sus grupos y sus ramas.',
      resolve: async (_padre, _args, contexto) => [
        ...(await contexto.estructura.listarDistritos()),
      ],
    }),
  )
}
```

- [ ] **Step 4: Escribir el objeto `Module`**

Crear `packages/estructura/src/servidor/index.ts`:

```ts
import type { Module } from '@gps/core'
import { migraciones } from './migraciones'
import { registrarSchema } from './schema'
import { crearServicioDeEstructura, type ServicioDeEstructura } from './servicio'

// Publica los servicios de este modulo en el contexto de GraphQL.
// Asi es como un modulo alcanza a otro: ctx.<nombre>, nunca por import.
declare module '@gps/core' {
  interface Context {
    readonly estructura: ServicioDeEstructura
  }
}

export const estructura: Module<ServicioDeEstructura> = {
  name: 'estructura',
  dependencies: [],
  migraciones,
  createServices: (core) => crearServicioDeEstructura(core),
  registerSchema: registrarSchema,
}

export type { ServicioDeEstructura } from './servicio'
```

Agregar el subpath a `packages/estructura/package.json`:

```json
  "exports": {
    "./dominio": "./src/dominio/index.ts",
    "./servidor": "./src/servidor/index.ts"
  },
```

- [ ] **Step 5: Registrar el módulo en el backend**

Agregar la dependencia en `services/backend/package.json`, junto a `@gps/sistema`:

```json
    "@gps/estructura": "workspace:*",
```

Correr `bun install` desde la raíz.

Reemplazar `services/backend/src/modules.ts`:

```ts
import { estructura } from '@gps/estructura/servidor'
import { sistema } from '@gps/sistema/servidor'

/** La lista de modulos registrados. Agregar un modulo nuevo es agregarlo aca
 *  y nada mas: el orden lo resuelve ordenarModulos por dependencias. */
export const modulos = [sistema, estructura]
```

- [ ] **Step 6: Correr los tests y verificar que pasan**

Run: `bun test services/backend/test/schema.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 7: Regenerar el esquema público**

Run: `bun run schema`
Expected: `schema.gql` ahora incluye `enum Rama`, `type Grupo`, `type Distrito` y el
campo `distritos: [Distrito!]!` en `Query`.

- [ ] **Step 8: Correr el check completo**

Run: `bun run check`
Expected: todo en verde.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(estructura): la query distritos en el esquema publico

El enum Rama se construye desde el catalogo del dominio, con los valores en
minuscula: lo que viaja por la red es el id, asi la pantalla no necesita una
tabla de traduccion."
```

---

## Task 7: el módulo `demo`

**Files:**
- Create: `packages/demo/package.json`
- Create: `packages/demo/tsconfig.json`
- Create: `packages/demo/src/servidor/escenario.ts`
- Create: `packages/demo/src/servidor/index.ts`
- Create: `packages/demo/test/escenario.test.ts`
- Modify: `services/backend/src/composicion.ts`
- Modify: `services/backend/src/server.ts`
- Modify: `services/backend/src/index.ts`
- Modify: `services/backend/scripts/generar-schema.ts`
- Modify: `services/backend/test/schema.test.ts`
- Modify: `services/backend/package.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: `Context.estructura` de Task 6.
- Produces:
  - `sembrarEscenario(ctx: Context): Promise<void>` en `@gps/demo/servidor`
  - `componer` y `crearServidor` pasan a ser `async`

- [ ] **Step 1: Crear el paquete**

Crear `packages/demo/package.json`:

```json
{
  "name": "@gps/demo",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    "./servidor": "./src/servidor/index.ts"
  },
  "scripts": {
    "compile": "tsc --noEmit"
  },
  "dependencies": {
    "@gps/core": "workspace:*",
    "@gps/estructura": "workspace:*"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "drizzle-orm": "^0.45.2",
    "typescript": "^5.7.0"
  }
}
```

`drizzle-orm` va como devDependency porque sólo la usa el test, para montar una base en
memoria.

Crear `packages/demo/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "test"]
}
```

Correr `bun install` desde la raíz.

- [ ] **Step 2: Escribir el test que falla**

Crear `packages/demo/test/escenario.test.ts`:

```ts
import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { aplicarMigraciones, type Bd, type Context, type Core } from '@gps/core'
import { estructura } from '@gps/estructura/servidor'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { sembrarEscenario } from '../src/servidor/escenario'

function montarContexto(): Context {
  const base = new Database(':memory:')
  base.exec('PRAGMA foreign_keys = ON')
  const bd: Bd = drizzle(base)

  let contador = 0
  const core: Core = {
    config: { version: '0.0.0', entorno: 'demo', puerto: 0 },
    logger: { info: () => {}, error: () => {} },
    reloj: { ahora: () => new Date('2026-08-26T12:00:00Z') },
    bd,
    modulos: ['estructura'],
    nuevoId: (prefijo) => `${prefijo}_${++contador}`,
  }

  aplicarMigraciones(core, [estructura])
  return { actor: null, estructura: estructura.createServices(core) } as Context
}

describe('sembrarEscenario', () => {
  test('siembra la diocesis entera pasando por los servicios publicos', async () => {
    // Que pase por los servicios y no por SQL es la propiedad que importa: los
    // datos del demo cruzan las mismas reglas que los reales, asi que es
    // imposible sembrar algo que el sistema consideraria invalido.
    const contexto = montarContexto()
    await sembrarEscenario(contexto)

    const arbol = await contexto.estructura.listarDistritos()
    expect(arbol).toHaveLength(4)
    expect(arbol.flatMap((distrito) => distrito.grupos)).toHaveLength(12)
  })

  test('deja al menos un grupo con las seis ramas y otro sin ninguna', async () => {
    // El demo existe para mirar pantallas: si todos los grupos fueran iguales
    // no mostraria ni el caso lleno ni el vacio, que son los que se rompen.
    const contexto = montarContexto()
    await sembrarEscenario(contexto)

    const todos = (await contexto.estructura.listarDistritos()).flatMap((d) => d.grupos)
    expect(todos.some((grupo) => grupo.ramas.length === 6)).toBe(true)
    expect(todos.some((grupo) => grupo.ramas.length === 0)).toBe(true)
  })
})
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `bun test packages/demo/test/escenario.test.ts`
Expected: FAIL — `Cannot find module '../src/servidor/escenario'`

- [ ] **Step 4: Escribir el escenario**

Crear `packages/demo/src/servidor/escenario.ts`:

```ts
// Import con efecto, no de tipos: ademas de cargar el modulo trae la
// ampliacion de Context que declara estructura. Sin el, ctx.estructura no
// existe al compilar este paquete solo. Es el unico modulo autorizado a
// conocer a los otros: es literalmente su razon de ser (spec 6.1).
import '@gps/estructura/servidor'
import type { Context } from '@gps/core'
import type { Rama } from '@gps/estructura/dominio'

/** La diocesis de la demostracion. Los grupos abren conjuntos distintos de
 *  ramas a proposito: uno completo, varios parciales y uno todavia sin
 *  ninguna. Un demo donde todos los grupos son iguales no muestra si la
 *  pantalla aguanta el caso lleno ni el vacio, que son los que se rompen. */
const DIOCESIS: readonly {
  numero: number
  zona: string
  grupos: readonly { numero: number; nombre: string; ramas: readonly Rama[] }[]
}[] = [
  {
    numero: 1,
    zona: 'San Isidro',
    grupos: [
      {
        numero: 7,
        nombre: 'San Jorge',
        ramas: ['lobatos', 'scouts'],
      },
      {
        numero: 15,
        nombre: 'Nuestra Señora de Luján',
        ramas: ['castores', 'lobatos', 'scouts', 'raiders'],
      },
      {
        numero: 42,
        nombre: 'Ceferino Namuncurá',
        ramas: ['castores', 'lobatos', 'scouts', 'raiders', 'rovers', 'adultos'],
      },
      { numero: 61, nombre: 'San Francisco de Asís', ramas: ['scouts'] },
    ],
  },
  {
    numero: 2,
    zona: 'Quilmes',
    grupos: [
      {
        numero: 3,
        nombre: 'Santa María de los Ángeles',
        ramas: ['lobatos', 'scouts', 'raiders', 'rovers'],
      },
      { numero: 28, nombre: 'Beato Artémides Zatti', ramas: ['lobatos', 'scouts'] },
      { numero: 54, nombre: 'Don Bosco', ramas: ['castores', 'lobatos', 'scouts'] },
    ],
  },
  {
    numero: 3,
    zona: 'Ciudad',
    grupos: [
      { numero: 9, nombre: 'Cristo Rey', ramas: ['lobatos', 'scouts', 'raiders'] },
      {
        numero: 33,
        nombre: 'María Auxiliadora',
        ramas: ['castores', 'lobatos', 'scouts', 'raiders', 'rovers'],
      },
      { numero: 77, nombre: 'San Ignacio de Loyola', ramas: ['rovers'] },
    ],
  },
  {
    numero: 4,
    zona: 'Morón',
    grupos: [
      { numero: 12, nombre: 'Santa Teresita', ramas: ['lobatos', 'scouts'] },
      // Recien fundado: todavia no abrio ninguna rama.
      { numero: 88, nombre: 'Padre Mario Pantaleo', ramas: [] },
    ],
  },
]

/** Siembra el escenario llamando a los servicios publicos de cada modulo, no
 *  escribiendo SQL. Es la propiedad que decide el diseño: los datos del demo
 *  pasan por las mismas validaciones y reglas de dominio que los reales.
 *
 *  Este archivo conoce a todos los modulos que quiera representar, que es lo
 *  que el resto de la arquitectura evita. La diferencia es que agregar un
 *  modulo no obliga a tocarlo: el sistema funciona igual sin que lo mencione. */
export async function sembrarEscenario(ctx: Context): Promise<void> {
  for (const datos of DIOCESIS) {
    const distrito = await ctx.estructura.crearDistrito({
      numero: datos.numero,
      zona: datos.zona,
    })

    for (const datosDelGrupo of datos.grupos) {
      const grupo = await ctx.estructura.crearGrupo({
        numero: datosDelGrupo.numero,
        nombre: datosDelGrupo.nombre,
        distritoId: distrito.id,
      })

      for (const rama of datosDelGrupo.ramas) {
        await ctx.estructura.abrirRama(grupo.id, rama)
      }
    }
  }
}
```

Crear `packages/demo/src/servidor/index.ts`:

```ts
export { sembrarEscenario } from './escenario'
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `bun test packages/demo/test/escenario.test.ts`
Expected: PASS, 2 tests

- [ ] **Step 6: Sembrar al arrancar en el entorno demo**

Agregar la dependencia en `services/backend/package.json`:

```json
    "@gps/demo": "workspace:*",
```

Correr `bun install` desde la raíz.

En `services/backend/src/composicion.ts`, importar el escenario, volver la función
`async` y sembrar al final:

```ts
import { sembrarEscenario } from '@gps/demo/servidor'
```

```ts
export async function componer(
  config: Config,
  bd: Bd,
): Promise<{ esquema: GraphQLSchema; contexto: Context }> {
```

```ts
  const contexto = { actor: null, ...servicios } as Context

  // La base del demo es siempre nueva y en memoria (ver leerRutaDeBd), asi que
  // no hace falta que la siembra sea idempotente.
  if (config.entorno === 'demo') await sembrarEscenario(contexto)

  return { esquema: builder.toSchema(), contexto }
```

- [ ] **Step 7: Propagar el `async` a los tres consumidores**

`services/backend/src/server.ts`:

```ts
export async function crearServidor(config: Config, bd: Bd) {
  const { esquema, contexto } = await componer(config, bd)
```

`services/backend/src/index.ts`, dentro de `if (import.meta.main)`:

```ts
  const servidor = await crearServidor(config, bd)
```

`services/backend/scripts/generar-schema.ts`:

```ts
const { esquema } = await componer(
  { version: '0.0.0', entorno: 'prueba', puerto: 0 },
  crearBd(':memory:'),
)
```

`services/backend/test/schema.test.ts`, en las dos llamadas:

```ts
async function consultar(consulta: string) {
  const { esquema, contexto } = await componer(config, crearBd(':memory:'))
```

```ts
  test('el contexto expone actor en null: auth todavia no existe', async () => {
    const { contexto } = await componer(config, crearBd(':memory:'))
```

- [ ] **Step 8: Agregar el comando `bun run demo`**

En `services/backend/package.json`, junto a `dev`:

```json
    "demo": "ENTORNO=demo bun --watch src/index.ts",
```

En el `package.json` de la raíz, junto a `dev`:

```json
    "demo": "bun run --filter backend demo",
```

- [ ] **Step 9: Verificar el demo a mano**

Run: `bun run demo`
Expected: arranca en `:3000`; `curl -s localhost:3000/graphql -H 'content-type: application/json' -d '{"query":"{ distritos { numero zona grupos { numero nombre ramas } } }"}'`
devuelve los cuatro distritos con sus doce grupos. Cortar con Ctrl-C.

Verificar también que el arranque normal sigue funcionando: `bun run dev` crea `gps.db`
y responde `{ distritos: [] }`. Borrar el `gps.db` que quedó.

- [ ] **Step 10: Correr el check completo**

Run: `bun run check`
Expected: todo en verde.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(demo): escenario sembrado con la diocesis de ejemplo

demo es una funcion y no un Module: no tiene esquema ni servicios propios.
Siembra por los servicios publicos, asi que los datos pasan por las mismas
reglas que los reales. ENTORNO=demo fuerza la base en memoria."
```

---

## Task 8: el hook y las pantallas

**Files:**
- Modify: `packages/api/codegen.ts`
- Create: `packages/api/src/queries/distritos.graphql`
- Create: `packages/api/src/estructura.ts`
- Modify: `packages/api/src/index.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/package.json`
- Modify: `apps/mobile/app/index.tsx`
- Modify: `apps/mobile/package.json`

**Interfaces:**
- Consumes: `Query.distritos` de Task 6; `RAMAS` y `Rama` de `@gps/estructura/dominio`.
- Produces: `useDistritos()` exportado desde `@gps/api`.

- [ ] **Step 1: Pedir el enum como unión de literales**

En `packages/api/codegen.ts`, agregar `enumsAsTypes` a la config:

```ts
      config: { useTypeImports: true, enumsAsTypes: true },
```

Sin esto el codegen genera un `enum` de TypeScript y el valor que vuelve de la API deja
de ser asignable al tipo `Rama` del dominio, que es una unión de literales.

- [ ] **Step 2: Escribir la consulta**

Crear `packages/api/src/queries/distritos.graphql`:

```graphql
query Distritos {
  distritos {
    id
    numero
    zona
    grupos {
      id
      numero
      nombre
      ramas
    }
  }
}
```

- [ ] **Step 3: Generar los tipos**

Run: `bun run --filter @gps/api codegen`
Expected: `packages/api/src/generated/graphql.ts` ahora exporta `DistritosDocument` y
`DistritosQuery`.

- [ ] **Step 4: Escribir el hook**

Crear `packages/api/src/estructura.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { DistritosDocument } from './generated/graphql'
import { useTransporte } from './proveedor'

export function useDistritos() {
  const transporte = useTransporte()
  return useQuery({
    queryKey: ['distritos'],
    queryFn: () => transporte.ejecutar(DistritosDocument),
  })
}
```

En `packages/api/src/index.ts`, agregar las dos líneas (respetando el orden alfabético
que ya tiene el archivo):

```ts
export type { DistritosQuery } from './generated/graphql'
export { useDistritos } from './estructura'
```

- [ ] **Step 5: Escribir la pantalla web**

Agregar la dependencia en `apps/web/package.json`, junto a `@gps/api`:

```json
    "@gps/estructura": "workspace:*",
```

Correr `bun install` desde la raíz.

Reemplazar `apps/web/src/App.tsx` entero:

```tsx
// apps/web/src/App.tsx
import { useDistritos, useVersion } from '@gps/api'
import { type Rama, RAMAS } from '@gps/estructura/dominio'

const RAMA_POR_ID = new Map(RAMAS.map((rama) => [rama.id, rama]))

function EtiquetaDeRama(props: { rama: Rama }) {
  const rama = RAMA_POR_ID.get(props.rama)
  if (!rama) return null
  const edades = rama.hasta === null ? `${rama.desde}+` : `${rama.desde}–${rama.hasta}`
  return (
    <li className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
      {rama.nombre} <span className="text-slate-400">{edades}</span>
    </li>
  )
}

function Grupo(props: { numero: number; nombre: string; ramas: readonly Rama[] }) {
  return (
    <li className="px-4 py-3">
      <p className="text-sm font-medium text-slate-900">
        <span className="text-slate-400">Grupo Scout {props.numero}</span> {props.nombre}
      </p>
      {props.ramas.length === 0 ? (
        <p className="mt-1.5 text-xs text-slate-400">Todavía no abrió ninguna rama</p>
      ) : (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {props.ramas.map((rama) => (
            <EtiquetaDeRama key={rama} rama={rama} />
          ))}
        </ul>
      )}
    </li>
  )
}

export function App() {
  const { data, isPending, error } = useDistritos()
  const version = useVersion()

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto w-full max-w-md sm:max-w-2xl">
        <h1 className="text-2xl font-semibold">GPS</h1>
        <p className="mt-1 text-sm text-slate-500">Gestión para Scouts</p>

        {isPending && <p className="mt-8 text-sm text-slate-500">Consultando la estructura…</p>}

        {error && (
          <p className="mt-8 rounded-lg bg-red-50 p-4 text-sm text-red-800">
            No se pudo consultar la estructura: {error.message}
          </p>
        )}

        {data?.distritos.length === 0 && (
          <p className="mt-8 rounded-lg bg-white p-4 text-sm text-slate-500 shadow-sm">
            No hay distritos cargados todavía.
          </p>
        )}

        <div className="mt-8 space-y-6">
          {data?.distritos.map((distrito) => (
            <section key={distrito.id}>
              <h2 className="text-sm font-semibold text-slate-900">
                Distrito {distrito.numero}
              </h2>
              <p className="text-xs text-slate-500">{distrito.zona}</p>
              <ul className="mt-2 divide-y divide-slate-200 rounded-lg bg-white shadow-sm">
                {distrito.grupos.map((grupo) => (
                  <Grupo
                    key={grupo.id}
                    numero={grupo.numero}
                    nombre={grupo.nombre}
                    ramas={grupo.ramas}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>

        {version.data && (
          <p className="mt-10 text-xs text-slate-400">
            v{version.data.version.numero} · {version.data.version.entorno} ·{' '}
            {version.data.version.modulos.join(', ')}
          </p>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 6: Verificar la pantalla web**

Run: `bun run demo`
Expected: en `http://localhost:3000` se ven los cuatro distritos con sus grupos y las
etiquetas de rama; el Grupo Scout 88 muestra «Todavía no abrió ninguna rama»; el pie
dice `demo` y lista `sistema, estructura`. Revisar a 375px con las herramientas del
navegador: nada se desborda horizontalmente. Cortar con Ctrl-C.

- [ ] **Step 7: Escribir la pantalla mobile**

Agregar la dependencia en `apps/mobile/package.json`, junto a `@gps/api`:

```json
    "@gps/estructura": "workspace:*",
```

Correr `bun install` desde la raíz.

Reemplazar `apps/mobile/app/index.tsx` entero:

```tsx
import { useDistritos, useVersion } from '@gps/api'
import { type Rama, RAMAS } from '@gps/estructura/dominio'
import { SafeAreaView, ScrollView, Text, View } from 'react-native'

const RAMA_POR_ID = new Map(RAMAS.map((rama) => [rama.id, rama]))

function EtiquetaDeRama(props: { rama: Rama }) {
  const rama = RAMA_POR_ID.get(props.rama)
  if (!rama) return null
  const edades = rama.hasta === null ? `${rama.desde}+` : `${rama.desde}–${rama.hasta}`
  return (
    <View className="rounded-full bg-slate-100 px-2.5 py-1">
      <Text className="text-xs text-slate-700">
        {rama.nombre} <Text className="text-slate-400">{edades}</Text>
      </Text>
    </View>
  )
}

function Grupo(props: { numero: number; nombre: string; ramas: readonly Rama[] }) {
  return (
    <View className="border-b border-slate-200 px-4 py-3">
      <Text className="text-sm font-medium text-slate-900">
        <Text className="text-slate-400">Grupo Scout {props.numero}</Text> {props.nombre}
      </Text>
      {props.ramas.length === 0 ? (
        <Text className="mt-1.5 text-xs text-slate-400">Todavía no abrió ninguna rama</Text>
      ) : (
        <View className="mt-1.5 flex-row flex-wrap gap-1.5">
          {props.ramas.map((rama) => (
            <EtiquetaDeRama key={rama} rama={rama} />
          ))}
        </View>
      )}
    </View>
  )
}

export default function Pantalla() {
  const { data, isPending, error } = useDistritos()
  const version = useVersion()

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView contentContainerClassName="px-4 py-10">
        <Text className="text-2xl font-semibold text-slate-900">GPS</Text>
        <Text className="mt-1 text-sm text-slate-500">Gestión para Scouts</Text>

        {isPending && (
          <Text className="mt-8 text-sm text-slate-500">Consultando la estructura…</Text>
        )}

        {error && (
          <View className="mt-8 rounded-lg bg-red-50 p-4">
            <Text className="text-sm text-red-800">
              No se pudo consultar la estructura: {error.message}
            </Text>
          </View>
        )}

        {data?.distritos.length === 0 && (
          <View className="mt-8 rounded-lg bg-white p-4">
            <Text className="text-sm text-slate-500">No hay distritos cargados todavía.</Text>
          </View>
        )}

        {data?.distritos.map((distrito) => (
          <View key={distrito.id} className="mt-6">
            <Text className="text-sm font-semibold text-slate-900">
              Distrito {distrito.numero}
            </Text>
            <Text className="text-xs text-slate-500">{distrito.zona}</Text>
            <View className="mt-2 rounded-lg bg-white">
              {distrito.grupos.map((grupo) => (
                <Grupo
                  key={grupo.id}
                  numero={grupo.numero}
                  nombre={grupo.nombre}
                  ramas={grupo.ramas}
                />
              ))}
            </View>
          </View>
        ))}

        {version.data && (
          <Text className="mt-10 text-xs text-slate-400">
            v{version.data.version.numero} · {version.data.version.entorno} ·{' '}
            {version.data.version.modulos.join(', ')}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
```

- [ ] **Step 8: Correr el check completo**

Run: `bun run check`
Expected: todo en verde.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(apps): las pantallas muestran el arbol de la diocesis

Las dos apps sacan el nombre y el rango etario de cada rama del catalogo de
/dominio, que es isomorfo: lo que viaja por la red es solo el id."
```

---

## Task 9: documentación

**Files:**
- Modify: `AGENT.md` (`CLAUDE.md` es un symlink a este archivo: se edita uno solo)
- Modify: `docs/arquitectura.md`
- Modify: `docs/crear-un-modulo.md`

- [ ] **Step 1: Actualizar `AGENT.md`**

En la sección **Comandos**, agregar la línea del demo debajo de `bun run dev`:

```
    bun run demo                la app con datos de ejemplo, base en memoria
```

En **Cómo crear un módulo nuevo**, insertar un paso entre el 5 y el 6 actual:

```
6. Si el módulo tiene tablas: declararlas en `src/servidor/tablas.ts`, generar la
   migración con `bunx drizzle-kit generate --name <nombre>` parado en el paquete, y
   sumarla a `src/servidor/migraciones.ts`.
```

y renumerar los que siguen.

En **Qué NO existe todavía**, sacar «Base de datos, migraciones» de la lista, que pasa a
empezar en «auth». Agregar debajo:

```
La base es SQLite por Drizzle y llega a los módulos por `Core.bd`; las migraciones las
declara cada módulo y las aplica `aplicarMigraciones` al arrancar. Sigue sin haber
Postgres, ni pool, ni réplicas.
```

En **Vocabulario**, actualizar la lista de módulos: ahora son `sistema` y `estructura`.

- [ ] **Step 2: Actualizar `docs/arquitectura.md`**

- En §3 («Arranque»), sacar el `(futuro)` de la línea «corre sus migraciones
  pendientes» y moverla arriba de `createServices`, que es donde ocurre de verdad.
- En §5 («El recorrido de una consulta»), sacar el `(futuro)` de la línea
  `repositorio -> base` y aclarar que `estructura` sí llega hasta ahí, `sistema` no.
- En §7 («Dependencias entre módulos»), marcar `estructura` como hecho junto a
  `sistema`, y aclarar que hoy `estructura` no depende de `personas` porque todavía no
  modela cargos.
- En §8 («Modo demo y offline»), aclarar que la mitad izquierda del dibujo —el backend
  contra SQLite con datos sembrados— ya existe, y que lo que sigue siendo futuro es la
  derecha: `packages/local` y la base en el dispositivo.

- [ ] **Step 3: Actualizar `docs/crear-un-modulo.md`**

Agregar una sección corta sobre migraciones, con el mismo contenido del paso nuevo de
`AGENT.md` pero en prosa: dónde vive `drizzle.config.ts`, por qué las migraciones son
del paquete y no de un directorio central, y cómo se suma una nueva a la lista.

- [ ] **Step 4: Verificar que la documentación no miente**

Leer los cuatro archivos y contrastar cada afirmación con el código. En particular: los
comandos existen en los `package.json`, los nombres de archivo son los reales, y no
queda ningún `(futuro)` sobre algo que ya se construyó.

- [ ] **Step 5: Correr el check completo**

Run: `bun run check`
Expected: todo en verde.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs: la base de datos y el demo ya no son futuro"
```

---

## Notas para quien ejecute

**Lo que este plan deliberadamente NO hace**, y no es un olvido: no modela cargos,
autoridades ni equipos (jefe de grupo, comisionado de distrito, auxiliares, Edifor,
Tesorería). Todos apuntan a una persona y el módulo `personas` no existe. Están
diseñados en la §10 de la spec como trabajo aditivo. Tampoco hay mutations, ni `Alcance`
en el servicio, ni `packages/local`. Si al ejecutar una tarea aparece la tentación de
agregar alguna de esas piezas «ya que estamos», no.

**Si una tarea se topa con algo que el plan no previó**, pararse y decirlo en vez de
improvisar: el plan se corrige y se sigue. Un desvío silencioso en la Task 4 le llega a
la Task 8 convertido en tres archivos que no compilan.
---

### Task 10: cierre de distritos y grupos

Un grupo puede cerrarse y quedar inactivo. Se modela con `cerradoEn`, no con un booleano:
`cerradoEn === null` significa activo, así que el booleano sale gratis y además queda
registrado **cuándo** cerró — dato que Afiliación y Tesorería van a necesitar para saber
hasta qué período se le cobra a un grupo.

**Decisiones tomadas (no las revisites):**
- El número de un grupo cerrado **queda quemado**: no se reasigna. Por eso el
  `UNIQUE(numero)` global se queda **como está**, sin índice parcial.
- Las pantallas **no muestran** lo cerrado. `listarDistritos` filtra.
- No se expone `cerradoEn` en GraphQL: ninguna pantalla lo muestra, y publicar el campo
  obligaría a introducir un escalar `DateTime` sin consumidor.

Es además la **segunda migración** del proyecto, con lo cual ejercita de verdad el runner
que hasta ahora sólo había aplicado una.

**Files:**
- Modify: `packages/estructura/src/dominio/modelos.ts`
- Modify: `packages/estructura/src/servidor/tablas.ts`
- Create: `packages/estructura/migraciones/0001_cierre.sql` (lo genera drizzle-kit)
- Modify: `packages/estructura/src/servidor/migraciones.ts`
- Modify: `packages/estructura/src/servidor/servicio.ts`
- Modify: `packages/estructura/test/servicio.test.ts`
- Modify: `packages/estructura/test/migraciones.test.ts`
- Modify: `packages/demo/src/servidor/escenario.ts`
- Modify: `packages/demo/test/escenario.test.ts`

**Interfaces:**
- Consumes: todo lo de las tareas 3 a 7.
- Produces: `Distrito.cerradoEn`, `Grupo.cerradoEn`, y
  `cerrarGrupo(grupoId: string): Promise<void>` en `ServicioDeEstructura`.

- [ ] **Paso 1: los modelos**
En `packages/estructura/src/dominio/modelos.ts`, agregar el campo a `Distrito` y a `Grupo`:

```ts
  /** Cuando dejo de estar activo. `null` es activo. Se guarda la fecha y no un
   *  booleano porque el booleano sale de ella, y al reves se pierde el dato:
   *  Afiliacion necesita saber hasta que periodo existio el grupo. */
  readonly cerradoEn: Date | null
```

- [ ] **Paso 2: las tablas**
En `packages/estructura/src/servidor/tablas.ts`, agregar a `distritos` y a `grupos`:

```ts
  cerradoEn: integer('cerrado_en', { mode: 'timestamp_ms' }),
```

Sin `.notNull()`: `null` es el estado normal. **El `.unique()` de `numero` se queda como
está**, sin índice parcial: el número de un grupo cerrado no se reasigna.

- [ ] **Paso 3: generar la segunda migración**
```bash
cd packages/estructura && bunx drizzle-kit generate --name cierre && cd ../..
```

Tiene que producir `migraciones/0001_cierre.sql` con dos `ALTER TABLE ... ADD COLUMN`.
Agregarla a la lista en `src/servidor/migraciones.ts`:

```ts
export const migraciones: readonly Migracion[] = [
  { nombre: '0000_inicial', sql: inicial },
  { nombre: '0001_cierre', sql: cierre },
]
```

con su import de texto arriba.

- [ ] **Paso 4: el servicio**
Agregar a la interfaz y a la implementación:

```ts
  cerrarGrupo(grupoId: string): Promise<void>
```

```ts
    async cerrarGrupo(grupoId) {
      // Primera operacion del proyecto que refresca `actualizadoEn`: hasta ahora
      // todo era alta y las dos marcas coincidian.
      const ahora = core.reloj.ahora()
      core.bd
        .update(grupos)
        .set({ cerradoEn: ahora, actualizadoEn: ahora })
        .where(eq(grupos.id, grupoId))
        .run()
    },
```

Y en `listarDistritos`, filtrar las dos consultas de filas:

```ts
      const filasDistritos = core.bd
        .select()
        .from(distritos)
        .where(isNull(distritos.cerradoEn))
        .orderBy(distritos.numero)
        .all()
      const filasGrupos = core.bd
        .select()
        .from(grupos)
        .where(isNull(grupos.cerradoEn))
        .orderBy(grupos.numero)
        .all()
```

`isNull` y `eq` se importan de `drizzle-orm`.

- [ ] **Paso 5: los tests del servicio**
Agregar a `packages/estructura/test/servicio.test.ts`:

```ts
describe('cerrarGrupo', () => {
  test('un grupo nace activo', async () => {
    const servicio = montar()
    const distrito = await servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })
    const grupo = await servicio.crearGrupo({ numero: 1, nombre: 'Uno', distritoId: distrito.id })
    expect(grupo.cerradoEn).toBeNull()
  })

  test('un grupo cerrado desaparece del arbol', async () => {
    const servicio = montar()
    const distrito = await servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })
    const uno = await servicio.crearGrupo({ numero: 1, nombre: 'Uno', distritoId: distrito.id })
    await servicio.crearGrupo({ numero: 2, nombre: 'Dos', distritoId: distrito.id })
    await servicio.cerrarGrupo(uno.id)

    const arbol = await servicio.listarDistritos()
    expect(arbol[0]?.grupos.map((grupo) => grupo.numero)).toEqual([2])
  })

  test('un distrito sin grupos activos sigue apareciendo, con la lista vacia', async () => {
    // El distrito no cerro: cerraron sus grupos. La pantalla tiene que poder
    // decir "este distrito no tiene grupos activos" en vez de esconderlo.
    const servicio = montar()
    const distrito = await servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })
    const uno = await servicio.crearGrupo({ numero: 1, nombre: 'Uno', distritoId: distrito.id })
    await servicio.cerrarGrupo(uno.id)

    const arbol = await servicio.listarDistritos()
    expect(arbol).toHaveLength(1)
    expect(arbol[0]?.grupos).toEqual([])
  })

  test('cerrar refresca actualizadoEn con el reloj de Core y no toca creadoEn', async () => {
    // Es la primera operacion que actualiza una fila: hasta ahora las dos marcas
    // coincidian siempre y nada verificaba que `actualizadoEn` se moviera.
    const servicio = montar()
    const distrito = await servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })
    const grupo = await servicio.crearGrupo({ numero: 1, nombre: 'Uno', distritoId: distrito.id })
    await servicio.cerrarGrupo(grupo.id)

    const filas = await servicio.listarDistritos()
    expect(filas[0]?.grupos).toEqual([])
    // El grupo ya no esta en el arbol, asi que las marcas se leen de la base.
  })

  test('el numero de un grupo cerrado queda quemado, no se reasigna', async () => {
    // Decision del diseno: el UNIQUE de numero es global y no parcial. Si algun
    // dia los numeros se reutilizan, este test es el que va a avisar.
    const servicio = montar()
    const distrito = await servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })
    const grupo = await servicio.crearGrupo({ numero: 42, nombre: 'Uno', distritoId: distrito.id })
    await servicio.cerrarGrupo(grupo.id)

    await expect(
      servicio.crearGrupo({ numero: 42, nombre: 'Otro', distritoId: distrito.id }),
    ).rejects.toThrow()
  })
})
```

El cuarto test necesita leer la fila cerrada, que ya no aparece en el árbol. Resolvelo
consultando la tabla directamente desde el test (el test sí puede usar SQL crudo);
acordate de que `bd.values(sql)` devuelve tuplas y `bd.all(sql)` devuelve objetos.

- [ ] **Paso 6: el test de migraciones**
En `packages/estructura/test/migraciones.test.ts`, agregar que las dos columnas existen
después de migrar, y que el runner aplicó **las dos** migraciones:

```ts
  test('aplica las dos migraciones del modulo', () => {
    const aplicadas = bd
      .values<[string]>(sql`SELECT nombre FROM migraciones ORDER BY nombre`)
      .map(([nombre]) => nombre)
    expect(aplicadas).toEqual(['0000_inicial', '0001_cierre'])
  })
```

- [ ] **Paso 7: el demo**
En `packages/demo/src/servidor/escenario.ts`, agregar `cerrado?: boolean` al tipo de los
grupos, un grupo cerrado a los datos, y la llamada a `cerrarGrupo` en la siembra. Ponerlo
en el Distrito 2:

```ts
      // Cerrado: no tiene que aparecer en pantalla. Es lo que ejercita el filtro.
      { numero: 19, nombre: 'San Miguel Arcángel', ramas: ['lobatos'], cerrado: true },
```

En `packages/demo/test/escenario.test.ts`, la cuenta de grupos visibles **sigue siendo
12**, y agregar un test de que el grupo cerrado no aparece.

- [ ] **Paso 8: check y commit**
`bun run check` en verde y un commit:

```
feat(estructura): los grupos se pueden cerrar

cerradoEn en vez de un booleano: el booleano sale de la fecha y al reves se
pierde el dato de cuando cerro, que Afiliacion va a necesitar. El UNIQUE de
numero se queda global: el numero de un grupo cerrado no se reasigna.
Segunda migracion del proyecto, que estrena de verdad el runner.
```
