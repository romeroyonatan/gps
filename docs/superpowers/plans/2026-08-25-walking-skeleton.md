# GPS — Walking Skeleton, Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levantar el monorepo de GPS con un módulo `sistema` que expone la versión por GraphQL, consumida por una app web y una app mobile, con Docker, CI y documentación.

**Architecture:** Monorepo con Bun workspaces. `packages/core` define el contrato de módulo y el registro; `packages/sistema` es el primer módulo; `services/backend` es la raíz de composición que registra módulos y sirve GraphQL Yoga con Bun.serve; `packages/api` comparte el cliente GraphQL entre `apps/web` y `apps/mobile` (Expo); Bun bundlea y sirve la web desde el mismo proceso del backend. Sin base de datos: la iteración 1 no la necesita.

**Tech Stack:** Bun (runtime, gestor de paquetes y corredor de tests), TypeScript, GraphQL Yoga, Pothos, React, Tailwind CSS (4 en web, 3.4 en mobile), Expo, React Native, NativeWind, TanStack Query, Biome, Docker.

**Spec:** `docs/superpowers/specs/2026-08-24-arquitectura-y-walking-skeleton-design.md`
**Mapa de piezas:** `docs/arquitectura.md`

## Global Constraints

- **Runtime:** Bun 1.4.0, ya instalado en la máquina. Node no se usa.
- **Bun es también el bundler y el servidor de desarrollo.** No se usa Vite. `Bun.serve` con
  `routes` sirve el HTML bundleado, `/graphql` y `/health` en un solo proceso y un solo
  puerto, con HMR en desarrollo. Verificado empíricamente contra Bun 1.4.0.
- **Módulos ES en todo el repo.** `"type": "module"` en cada `package.json`.
- **Las tareas del workspace se corren con filtros por ruta**, no con `--filter '*'`: el
  paquete raíz define los mismos nombres de script y `'*'` puede recursar sobre sí mismo.
- **Los paquetes internos no se compilan.** Sin `dist/`, sin `tsc -b`, sin watchers. Los `exports` apuntan a `src/*.ts` y compila quien consume. El chequeo de tipos es `tsc --noEmit`.
- **Instalación aislada:** `bunfig.toml` con `linker = "isolated"`. Un paquete sólo importa lo que declaró en su `package.json`.
- **Idioma:** español para el dominio y las reglas de negocio; inglés para el vocabulario técnico de industria (`module`, `core`, `index`, `server`, `context`, `config`, `logger`, `schema`, `repository`, `cache`, `query`) y para los archivos canónicos (`README.md`, `schema.gql`, `package.json`, `Dockerfile`). Ver §4 de la spec.
- **Frontera de imports 1:** nada dentro de `apps/**` puede importar un subpath `*/servidor`. Impuesto por Biome.
- **Frontera de imports 2 (regla de portabilidad, §5.3):** ningún archivo bajo `packages/*/src/servidor/**` puede importar `bun:*` ni `node:*`. Todo acceso a la plataforma pasa por `Core`. Impuesto por Biome.
- **Los módulos no se importan entre sí.** Se comunican sólo por el contexto de GraphQL.
- **Mobile-first:** todo se diseña primero a 375px de ancho. `sm:` y `md:` sólo agregan en pantallas grandes.
- **`schema.gql` se versiona** en la raíz y CI falla si difiere del generado.
- **El código generado por codegen no se versiona.** Está en `.gitignore` y se regenera.
- **Nada de base de datos, auth, rate limiting ni bus de eventos** en esta iteración. Ver "Decisiones tomadas al planificar".

## Decisiones tomadas al planificar

Estas tres resuelven ambigüedades que la spec dejó abiertas o que aparecieron al bajar a código. Están acá para que el que ejecute no las vuelva a abrir.

**1. El rate limiting se difiere.** La spec §6.2 lo daba por incluido. En la iteración 1 no hay auth, no hay datos y el entregable es la imagen Docker, no un ambiente expuesto: un limitador sin nada que proteger es una pieza sin consumidor. Es recuperable — agregarlo después es un plugin de envelop, sin cambio de API pública ni migración. **Consecuencia:** `services/backend/src/envelop.ts` NO se crea en esta iteración.

**2. La regla de lint contra `bun:*` y `node:*` entra ya.** La spec §16 la dejaba para el segundo módulo. Entra ahora porque tiene un consumidor inmediato: `sistema` necesita el número de versión y lo natural sería leer el `package.json` con `Bun.file`, lo cual viola la regla de portabilidad. Con la regla activa, `sistema` se ve forzado a recibir la versión por `Core.config`, que es el patrón que todos los módulos van a copiar.

**3. El transporte HTTP usa `fetch` y `print`, no `graphql-request`.** La spec §2.7 nombraba `graphql-request`. Son quince líneas de `fetch` más `print` de `graphql`, que ya es dependencia obligatoria. Una dependencia menos, en la misma línea que sacar Vitest y Turborepo. Si se prefiere la librería, es un cambio acotado a un archivo.

**4. Tailwind CSS 3.4, no 4.** NativeWind apunta a Tailwind 3.4. Mantener la misma versión mayor en web y mobile es lo que va a permitir compartir tokens de diseño más adelante.

**5. `Core.modulos`.** El módulo `sistema` necesita los nombres de los módulos registrados para exponerlos. `Core` gana `modulos: readonly string[]`, poblado por la raíz de composición después de ordenar. Tiene consumidor desde el primer día.

## Estructura de archivos

    gps/
      package.json              scripts raíz del workspace
      bunfig.toml               linker aislado
      biome.json                lint, formato y las dos fronteras de imports
      tsconfig.base.json        config de TS que heredan todos
      schema.gql                contrato público generado y versionado
      .gitignore
      Dockerfile
      .dockerignore
      docker-compose.yml
      AGENT.md                  referencia para agentes
      CLAUDE.md                 enlace simbólico a AGENT.md
      README.md
      .github/workflows/ci.yml

      docs/
        arquitectura.md         (ya existe)
        crear-un-modulo.md      tutorial para humanos

      packages/core/
        package.json
        tsconfig.json
        src/index.ts            reexporta todo lo público
        src/core.ts             Core, Config, Logger, Reloj
        src/actor.ts            Actor, Alcance, RolConAmbito
        src/context.ts          Context (base para declaration merging)
        src/builder.ts          crearBuilder(), tipo Builder
        src/module.ts           interface Module
        src/registry.ts         ordenarModulos() con detección de ciclos
        test/registry.test.ts

      packages/sistema/
        package.json
        tsconfig.json
        src/dominio/index.ts    tipo Version
        src/servidor/index.ts   el Module
        src/servidor/servicio.ts
        src/servidor/schema.ts
        test/servicio.test.ts

      packages/api/
        package.json
        tsconfig.json
        codegen.ts
        src/index.ts
        src/transporte.ts       interface Transporte + transporteHttp
        src/proveedor.tsx       ProveedorDeApi (React context)
        src/version.ts          useVersion()
        src/queries/version.graphql
        src/generated/          NO se versiona
        test/transporte.test.ts

      services/backend/
        package.json
        tsconfig.json
        src/index.ts            arranque
        src/server.ts           Bun.serve
        src/core.ts             construye el Core concreto
        src/modules.ts          la lista de módulos registrados
        src/composicion.ts      ordena, crea servicios, compone el esquema
        src/context.ts          contexto por request
        scripts/generar-schema.ts
        test/schema.test.ts

      apps/web/
        package.json  tsconfig.json  bunfig.toml  index.html
        src/main.tsx  src/App.tsx  src/estilos.css

      apps/mobile/
        package.json  tsconfig.json  app.json
        babel.config.js  metro.config.js  tailwind.config.js
        global.css  nativewind-env.d.ts
        app/_layout.tsx  app/index.tsx

---

### Task 1: Andamiaje del monorepo y fronteras de imports

Instala Bun, crea el workspace vacío con Biome y TypeScript configurados, y deja **verificadas** las dos reglas de frontera antes de que exista código que pueda violarlas.

**Files:**
- Create: `package.json`, `bunfig.toml`, `biome.json`, `tsconfig.base.json`, `.gitignore`

**Interfaces:**
- Consumes: nada.
- Produces: los scripts `bun run verificar`, `bun run lint`, `bun run tipos`, `bun run test`. El workspace `packages/*`, `services/*`, `apps/*`. Las dos reglas de Biome que todas las tareas siguientes deben respetar.

- [ ] **Step 1: Verificar Bun**

```bash
bun --version
```

Esperado: `1.4.0` o superior. Si `bun` no está en el PATH, agregar `export PATH="$HOME/.bun/bin:$PATH"`.

- [ ] **Step 2: Crear el `package.json` raíz**

```json
{
  "name": "gps",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*", "services/*", "apps/*"],
  "scripts": {
    "verificar": "bun run lint && bun run tipos && bun test",
    "lint": "biome check .",
    "formato": "biome check --write .",
    "tipos": "bun run --filter './packages/*' --filter './services/*' --filter './apps/*' tipos",
    "schema": "bun run --filter backend schema",
    "dev": "bun run --filter backend dev"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.5.10",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 3: Crear `bunfig.toml` y `.gitignore`**

```toml
# bunfig.toml
[install]
linker = "isolated"
# babel-preset-expo resuelve sus presets y plugins (que devuelve como strings)
# desde el directorio del archivo que los declara, o sea apps/mobile, y no desde
# su propio node_modules. Con linker aislado esos paquetes no quedan alcanzables
# por la subida jerarquica desde apps/mobile. Se publican al node_modules raiz
# para que la resolucion de Babel los encuentre.
#
# NO ajustar esto a "@babel/*". El patron tiene que ser ancho porque
# babel-preset-expo tambien depende de plugins SIN scope, que sufren
# exactamente el mismo problema: babel-plugin-react-compiler,
# babel-plugin-react-native-web, babel-plugin-syntax-hermes-parser y
# babel-plugin-transform-flow-enums. Achicarlo a "@babel/*" rompe esos casos en
# silencio.
#
# El patron arrastra de paso metro-babel-transformer, que no es parte del
# problema (Metro resuelve por su cuenta, ver metro.config.js) pero es
# inofensivo. Y no toca las fronteras que el proyecto sí hace cumplir:
# @gps/*/servidor y bun:*/node:*.
publicHoistPattern = ["*babel*"]
```

Nota: la parte de `publicHoistPattern` aparece recien al agregar `apps/mobile` (tarea 7). Se
documenta aca porque es el archivo donde vive.

```gitignore
node_modules/
dist/
.expo/
*.tsbuildinfo
.DS_Store
.env
.env.local

# codegen: se regenera, no se versiona
packages/api/src/generated/
```

- [ ] **Step 4: Crear `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "Preserve",
    "moduleResolution": "bundler",
    "moduleDetection": "force",
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noEmit": true,
    "skipLibCheck": true,
    "jsx": "react-jsx",
    "types": ["bun"]
  }
}
```

- [ ] **Step 5: Crear `biome.json` con las dos fronteras**

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.10/schema.json",
  "files": {
    "includes": [
      "**",
      "!**/node_modules",
      "!**/dist",
      "!**/.expo",
      "!packages/api/src/generated"
    ]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": { "quoteStyle": "single", "semicolons": "asNeeded" }
  },
  "linter": {
    "enabled": true,
    "rules": { "preset": "recommended" }
  },
  "overrides": [
    {
      "includes": ["apps/**"],
      "linter": {
        "rules": {
          "style": {
            "noRestrictedImports": {
              "level": "error",
              "options": {
                "patterns": [
                  {
                    "group": ["@gps/*/servidor"],
                    "message": "Las apps no pueden importar codigo de servidor: usa el subpath /dominio."
                  }
                ]
              }
            }
          }
        }
      }
    },
    {
      "includes": ["packages/*/src/servidor/**"],
      "linter": {
        "rules": {
          "style": {
            "noRestrictedImports": {
              "level": "error",
              "options": {
                "patterns": [
                  {
                    "group": ["node:*", "bun", "bun:*"],
                    "message": "Regla de portabilidad: el codigo de modulo no toca la plataforma, todo pasa por Core."
                  }
                ]
              }
            }
          }
        }
      }
    }
  ]
}
```

`schema.gql` **no** se excluye: Biome soporta GraphQL y chequea tanto `.gql` como `.graphql`,
así que el contrato público y los documentos de consulta escritos a mano se formatean y
lintean con la misma herramienta que el resto del repo. Eso obliga a que el script `schema`
formatee el archivo después de generarlo (tarea 4), porque la salida cruda de `printSchema`
no coincide con el formato de Biome.

Dos trampas verificadas empíricamente durante la ejecución, que esta configuración ya evita:
los patrones de carpeta **no llevan** `/**` final (desde Biome 2.2 eso dispara
`useBiomeIgnoreFolder`), y `linter.rules` usa `"preset": "recommended"` — **nunca** lo que
genera `biome migrate --write`, que produce `"preset": "none"` y desactiva en silencio todas
las reglas, dejando un repo que lintea limpio porque no chequea nada.

Esta configuración está **verificada contra Biome 2.5.10**: las dos reglas disparan ante una
violación y no molestan a un archivo válido. Dos detalles que cambiaron respecto de Biome 1 y
que conviene no revertir: la clave es `files.includes` con patrones negados (ya no existe
`files.ignore`), y `noRestrictedImports` vive en el grupo `style` (ya no en `nursery`).

El uso de `patterns` con glob en vez de `paths` con nombres exactos es deliberado:
`@gps/*/servidor` cubre todos los módulos que se creen en el futuro sin tocar este archivo,
y `node:*` cubre todo el espacio de módulos de plataforma en vez de una lista que
inevitablemente quedaría incompleta.

- [ ] **Step 6: Instalar dependencias**

```bash
bun install
```

Esperado: crea `bun.lock` y `node_modules/`.

- [ ] **Step 7: Verificar que la frontera de apps falla cuando se la viola**

```bash
mkdir -p apps/prueba/src
cat > apps/prueba/src/violacion.ts <<'EOF'
import { algo } from '@gps/sistema/servidor'
export const x = algo
EOF
bunx biome check apps/prueba/src/violacion.ts
```

Esperado: FALLA con el mensaje "Las apps no pueden importar codigo de servidor".

- [ ] **Step 8: Verificar que la regla de portabilidad falla cuando se la viola**

```bash
mkdir -p packages/prueba/src/servidor
cat > packages/prueba/src/servidor/violacion.ts <<'EOF'
import { Database } from 'bun:sqlite'
export const db = Database
EOF
bunx biome check packages/prueba/src/servidor/violacion.ts
```

Esperado: FALLA con "Regla de portabilidad: la base llega por Core, no se importa".

- [ ] **Step 9: Borrar los archivos de prueba y confirmar que todo pasa**

```bash
rm -rf apps/prueba packages/prueba
bunx biome check .
```

Esperado: PASA sin errores.

- [ ] **Step 10: Commit**

```bash
git add package.json bunfig.toml biome.json tsconfig.base.json .gitignore bun.lock
git commit -m "chore: andamiaje del monorepo con Bun, Biome y las fronteras de imports"
```

---

### Task 2: `packages/core` — contrato de módulo y registro

El corazón: qué es un módulo, qué recibe, y en qué orden se registran.

**Files:**
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`
- Create: `packages/core/src/{index,core,actor,context,builder,module,registry}.ts`
- Test: `packages/core/test/registry.test.ts`

**Interfaces:**
- Consumes: el andamiaje de la tarea 1.
- Produces:
  - `interface Config { version: string; entorno: Entorno; puerto: number }`
  - `type Entorno = 'desarrollo' | 'produccion' | 'prueba'`
  - `interface Logger { info(m: string, d?: Record<string, unknown>): void; error(...): void }`
  - `interface Reloj { ahora(): Date }`
  - `interface Core { config: Config; logger: Logger; reloj: Reloj; modulos: readonly string[] }`
  - `interface Actor { usuarioId: string; roles: RolConAmbito[] }`
  - `interface Alcance { gruposVisibles: string[]; distritosVisibles: string[]; esAdministrador: boolean }`
  - `interface Context { actor: Actor | null }`
  - `function crearBuilder(): Builder` y `type Builder`
  - `interface Module<S> { name; dependencies; createServices(core): S; registerSchema(builder): void }`
  - `function ordenarModulos(modulos: readonly Module<any>[]): Module<any>[]`
  - `class DependenciaFaltante extends Error`, `class CicloDeDependencias extends Error`

- [ ] **Step 1: Crear `packages/core/package.json` y `tsconfig.json`**

```json
{
  "name": "@gps/core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "tipos": "tsc --noEmit" },
  "dependencies": {
    "@pothos/core": "^4.13.1",
    "graphql": "^16.9.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.7.0"
  }
}
```

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "test"]
}
```

- [ ] **Step 2: Escribir el test del registro, que es la única lógica de este paquete**

```ts
// packages/core/test/registry.test.ts
import { describe, expect, test } from 'bun:test'
import { CicloDeDependencias, DependenciaFaltante, ordenarModulos } from '../src/registry'
import type { Module } from '../src/module'

function moduloFalso(name: string, dependencies: string[] = []): Module<object> {
  return {
    name,
    dependencies,
    createServices: () => ({}),
    registerSchema: () => {},
  }
}

const nombres = (modulos: Module<object>[]) => modulos.map((m) => m.name)

describe('ordenarModulos', () => {
  test('deja intactos los modulos sin dependencias', () => {
    const orden = ordenarModulos([moduloFalso('a'), moduloFalso('b')])
    expect(nombres(orden)).toEqual(['a', 'b'])
  })

  test('pone las dependencias antes que quien las necesita', () => {
    const orden = ordenarModulos([
      moduloFalso('afiliacion', ['personas', 'estructura']),
      moduloFalso('estructura', ['personas']),
      moduloFalso('personas'),
    ])
    expect(nombres(orden)).toEqual(['personas', 'estructura', 'afiliacion'])
  })

  test('conserva el orden de entrada entre modulos sin relacion entre si', () => {
    // `b` y `c` no dependen uno del otro: ambos dependen de `a`. El orden entre
    // ellos tiene que ser el de entrada (c antes que b), no alfabetico ni por
    // orden de descubrimiento. Sin esta asercion, un desempate alfabetico
    // pasaria el test igual.
    const entrada = [moduloFalso('c', ['a']), moduloFalso('b', ['a']), moduloFalso('a')]
    expect(nombres(ordenarModulos(entrada))).toEqual(['a', 'c', 'b'])
  })

  test('falla si una dependencia no esta registrada', () => {
    expect(() => ordenarModulos([moduloFalso('afiliacion', ['personas'])])).toThrow(
      DependenciaFaltante,
    )
  })

  test('falla si hay un ciclo', () => {
    expect(() =>
      ordenarModulos([moduloFalso('a', ['b']), moduloFalso('b', ['a'])]),
    ).toThrow(CicloDeDependencias)
  })

  test('el mensaje del ciclo nombra a los modulos involucrados', () => {
    // Sin `throw` guardian dentro del try: ese throw lo atrapa su propio catch,
    // y su mensaje contendria las letras que buscamos, con lo cual el test
    // pasaria aunque ordenarModulos dejara de detectar el ciclo. Si no lanza,
    // `mensaje` queda vacio y las dos aserciones fallan, que es lo correcto.
    // Los nombres son largos y distintivos por la misma razon: 'a' y 'b'
    // aparecen en casi cualquier mensaje de error en castellano.
    let mensaje = ''
    try {
      ordenarModulos([
        moduloFalso('personas', ['estructura']),
        moduloFalso('estructura', ['personas']),
      ])
    } catch (error) {
      mensaje = (error as Error).message
    }
    expect(mensaje).toContain('personas')
    expect(mensaje).toContain('estructura')
  })
})
```

- [ ] **Step 3: Correr el test para verificar que falla**

Run: `bun test packages/core`
Esperado: FALLA, no encuentra `../src/registry`.

- [ ] **Step 4: Escribir los tipos base**

```ts
// packages/core/src/core.ts
export type Entorno = 'desarrollo' | 'produccion' | 'prueba'

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

/** Lo que el core le provee a todo modulo. Es la unica via de un modulo
 *  hacia la plataforma: ver la regla de portabilidad en AGENT.md. */
export interface Core {
  readonly config: Config
  readonly logger: Logger
  readonly reloj: Reloj
  /** Nombres de los modulos registrados, en orden de dependencias. */
  readonly modulos: readonly string[]
}
```

```ts
// packages/core/src/actor.ts
export type Rol =
  | 'dirigente'
  | 'jefeDeGrupo'
  | 'autoridadDeDistrito'
  | 'administradorDiocesano'

export interface RolConAmbito {
  readonly rol: Rol
  readonly ambito: {
    readonly tipo: 'grupo' | 'distrito' | 'diocesano'
    readonly id: string | null
  }
}

/** Quien hace el pedido. Lo resuelve el modulo auth, que todavia no existe. */
export interface Actor {
  readonly usuarioId: string
  readonly roles: readonly RolConAmbito[]
}

/** Lo que el actor puede alcanzar, ya expandido. Lo deriva el modulo
 *  estructura, que conoce la jerarquia. Los repositorios lo reciben como
 *  primer parametro obligatorio. */
export interface Alcance {
  readonly gruposVisibles: readonly string[]
  readonly distritosVisibles: readonly string[]
  readonly esAdministrador: boolean
}
```

```ts
// packages/core/src/context.ts
import type { Actor } from './actor'

/** Contexto de cada request. Cada modulo lo extiende por declaration merging
 *  para publicar sus servicios: ver packages/sistema/src/servidor/index.ts. */
export interface Context {
  readonly actor: Actor | null
}
```

- [ ] **Step 5: Escribir el builder de Pothos y el contrato de módulo**

```ts
// packages/core/src/builder.ts
import SchemaBuilder from '@pothos/core'
import type { Context } from './context'

/** Crea el builder compartido. El tipo Query se declara aca una sola vez
 *  para que los modulos puedan usar queryField sin pisarse.
 *
 *  `defaultFieldNullability: false` es deliberado: GraphQL es nullable por
 *  defecto, y sin esto el contrato publico saldria con todos los campos
 *  opcionales, obligando a cada cliente a chequear null en campos que nunca
 *  lo son. Hace falta ponerlo en el parametro de tipo Y en las opciones. */
export function crearBuilder() {
  const builder = new SchemaBuilder<{
    Context: Context
    DefaultFieldNullability: false
  }>({ defaultFieldNullability: false })
  builder.queryType({})
  return builder
}

export type Builder = ReturnType<typeof crearBuilder>
```

```ts
// packages/core/src/module.ts
import type { Builder } from './builder'
import type { Core } from './core'

/** Un modulo de negocio. Para crear uno nuevo, ver docs/crear-un-modulo.md.
 *  Ojo con el vocabulario: "plugin" en este proyecto significa interceptor
 *  de envelop, no esto. */
export interface Module<S = unknown> {
  readonly name: string
  /** Nombres de otros modulos que este necesita. Determinan el orden de
   *  registro y se validan al arrancar. */
  readonly dependencies: readonly string[]
  createServices(core: Core): S
  registerSchema(builder: Builder): void
}
```

- [ ] **Step 6: Escribir el registro**

```ts
// packages/core/src/registry.ts
import type { Module } from './module'

export class DependenciaFaltante extends Error {
  constructor(modulo: string, dependencia: string) {
    super(`El modulo "${modulo}" depende de "${dependencia}", que no esta registrado.`)
    this.name = 'DependenciaFaltante'
  }
}

export class CicloDeDependencias extends Error {
  constructor(ciclo: readonly string[]) {
    super(`Ciclo de dependencias entre modulos: ${ciclo.join(' -> ')}.`)
    this.name = 'CicloDeDependencias'
  }
}

type Estado = 'pendiente' | 'visitando' | 'listo'

/** Orden topologico estable: respeta el orden de entrada entre modulos que
 *  no dependen uno del otro, para que el resultado sea reproducible. */
// biome-ignore lint/suspicious/noExplicitAny: el registro es agnostico del tipo de servicios
export function ordenarModulos(modulos: readonly Module<any>[]): Module<any>[] {
  // biome-ignore lint/suspicious/noExplicitAny: idem
  const porNombre = new Map<string, Module<any>>()
  for (const modulo of modulos) porNombre.set(modulo.name, modulo)

  const estados = new Map<string, Estado>()
  // biome-ignore lint/suspicious/noExplicitAny: idem
  const ordenados: Module<any>[] = []

  const visitar = (modulo: Module<any>, camino: readonly string[]): void => {
    const estado = estados.get(modulo.name) ?? 'pendiente'
    if (estado === 'listo') return
    if (estado === 'visitando') throw new CicloDeDependencias([...camino, modulo.name])

    estados.set(modulo.name, 'visitando')
    for (const dependencia of modulo.dependencies) {
      const siguiente = porNombre.get(dependencia)
      if (!siguiente) throw new DependenciaFaltante(modulo.name, dependencia)
      visitar(siguiente, [...camino, modulo.name])
    }
    estados.set(modulo.name, 'listo')
    ordenados.push(modulo)
  }

  for (const modulo of modulos) visitar(modulo, [])
  return ordenados
}
```

- [ ] **Step 7: Escribir el `index.ts` público**

```ts
// packages/core/src/index.ts
export type { Actor, Alcance, Rol, RolConAmbito } from './actor'
export { crearBuilder } from './builder'
export type { Builder } from './builder'
export type { Config, Core, Entorno, Logger, Reloj } from './core'
export type { Context } from './context'
export type { Module } from './module'
export { CicloDeDependencias, DependenciaFaltante, ordenarModulos } from './registry'
```

- [ ] **Step 8: Correr los tests y el chequeo de tipos**

```bash
bun install
bun test packages/core
bun run --filter @gps/core tipos
bunx biome check packages/core
```

Esperado: los seis tests PASAN; tipos y lint sin errores.

- [ ] **Step 9: Commit**

```bash
git add packages/core bun.lock
git commit -m "feat(core): contrato de modulo, registro con orden y deteccion de ciclos"
```

---

### Task 3: `packages/sistema` — el primer módulo

El módulo de referencia: es el que se copia para crear cualquier otro.

**Files:**
- Create: `packages/sistema/package.json`, `packages/sistema/tsconfig.json`
- Create: `packages/sistema/src/dominio/index.ts`
- Create: `packages/sistema/src/servidor/{index,servicio,esquema}.ts`
- Test: `packages/sistema/test/servicio.test.ts`

**Interfaces:**
- Consumes: `Core`, `Module`, `Builder`, `crearBuilder` de `@gps/core`.
- Produces:
  - `interface Version { numero: string; entorno: string; modulos: readonly string[] }` desde `@gps/sistema/dominio`
  - `interface ServicioDeSistema { obtenerVersion(): Version }`
  - `const sistema: Module<ServicioDeSistema>` desde `@gps/sistema/servidor`
  - Extiende `Context` con `sistema: ServicioDeSistema`

- [ ] **Step 1: Crear `package.json` y `tsconfig.json`**

```json
{
  "name": "@gps/sistema",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    "./dominio": "./src/dominio/index.ts",
    "./servidor": "./src/servidor/index.ts"
  },
  "scripts": { "tipos": "tsc --noEmit" },
  "dependencies": { "@gps/core": "workspace:*" },
  "devDependencies": { "@types/bun": "latest", "typescript": "^5.7.0" }
}
```

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "test"]
}
```

Nota: no hay entry point `"."`. Un módulo se consume siempre por `/dominio` o `/servidor`, nunca entero. Eso es lo que hace que la frontera de imports se pueda verificar.

- [ ] **Step 2: Escribir el test del servicio**

```ts
// packages/sistema/test/servicio.test.ts
import { describe, expect, test } from 'bun:test'
import type { Core } from '@gps/core'
import { crearServicioDeSistema } from '../src/servidor/servicio'

function coreFalso(parcial: Partial<Core> = {}): Core {
  return {
    config: { version: '9.9.9', entorno: 'prueba', puerto: 0 },
    logger: { info: () => {}, error: () => {} },
    reloj: { ahora: () => new Date('2026-01-01T00:00:00Z') },
    modulos: ['sistema'],
    ...parcial,
  }
}

describe('crearServicioDeSistema', () => {
  test('devuelve la version que le inyectaron, no una leida del disco', () => {
    const servicio = crearServicioDeSistema(coreFalso())
    expect(servicio.obtenerVersion().numero).toBe('9.9.9')
  })

  test('devuelve el entorno inyectado', () => {
    const servicio = crearServicioDeSistema(coreFalso())
    expect(servicio.obtenerVersion().entorno).toBe('prueba')
  })

  test('lista los modulos registrados', () => {
    const servicio = crearServicioDeSistema(coreFalso({ modulos: ['sistema', 'personas'] }))
    expect(servicio.obtenerVersion().modulos).toEqual(['sistema', 'personas'])
  })
})
```

- [ ] **Step 3: Correr el test para verificar que falla**

Run: `bun test packages/sistema`
Esperado: FALLA, no encuentra `../src/servidor/servicio`.

- [ ] **Step 4: Escribir el dominio**

```ts
// packages/sistema/src/dominio/index.ts

/** Version del sistema. Es la respuesta de la consulta publica `version`. */
export interface Version {
  readonly numero: string
  readonly entorno: string
  /** Nombres de los modulos registrados en esta instancia. */
  readonly modulos: readonly string[]
}
```

- [ ] **Step 5: Escribir el servicio**

```ts
// packages/sistema/src/servidor/servicio.ts
import type { Core } from '@gps/core'
import type { Version } from '../dominio/index'

export interface ServicioDeSistema {
  obtenerVersion(): Version
}

/** Todo lo que necesita llega por Core. El modulo no lee el package.json ni
 *  el entorno: eso lo resuelve la raiz de composicion. Ver la regla de
 *  portabilidad en AGENT.md. */
export function crearServicioDeSistema(core: Core): ServicioDeSistema {
  return {
    obtenerVersion: () => ({
      numero: core.config.version,
      entorno: core.config.entorno,
      modulos: core.modulos,
    }),
  }
}
```

- [ ] **Step 6: Escribir el esquema**

```ts
// packages/sistema/src/servidor/schema.ts
import type { Builder } from '@gps/core'
import type { Version } from '../dominio/index'

export function registrarSchema(builder: Builder): void {
  const VersionRef = builder.objectRef<Version>('Version').implement({
    description: 'Version del sistema y modulos registrados.',
    fields: (t) => ({
      numero: t.exposeString('numero'),
      entorno: t.exposeString('entorno'),
      modulos: t.stringList({ resolve: (version) => [...version.modulos] }),
    }),
  })

  builder.queryField('version', (t) =>
    t.field({
      type: VersionRef,
      description: 'Devuelve la version de esta instancia.',
      resolve: (_padre, _args, contexto) => contexto.sistema.obtenerVersion(),
    }),
  )
}
```

- [ ] **Step 7: Escribir el módulo y la extensión del contexto**

```ts
// packages/sistema/src/servidor/index.ts
import type { Module } from '@gps/core'
import { registrarSchema } from './esquema'
import { crearServicioDeSistema, type ServicioDeSistema } from './servicio'

// Publica los servicios de este modulo en el contexto de GraphQL.
// Asi es como un modulo alcanza a otro: ctx.<nombre>, nunca por import.
declare module '@gps/core' {
  interface Context {
    readonly sistema: ServicioDeSistema
  }
}

export const sistema: Module<ServicioDeSistema> = {
  name: 'sistema',
  dependencies: [],
  createServices: (core) => crearServicioDeSistema(core),
  registerSchema: registrarSchema,
}

export type { ServicioDeSistema } from './servicio'
```

- [ ] **Step 8: Correr tests, tipos y lint**

```bash
bun install
bun test packages/sistema
bun run --filter @gps/sistema tipos
bunx biome check packages/sistema
```

Esperado: los tres tests PASAN; tipos y lint sin errores. Si lint se queja de un import de `bun:*` o `node:*`, la regla de portabilidad está haciendo su trabajo: la solución es pasar el dato por `Core`, nunca desactivar la regla.

- [ ] **Step 9: Commit**

```bash
git add packages/sistema bun.lock
git commit -m "feat(sistema): primer modulo, expone la version por GraphQL"
```

---

### Task 4: `services/backend` — composición y servidor

**Files:**
- Create: `services/backend/package.json`, `services/backend/tsconfig.json`
- Create: `services/backend/src/{index,server,core,modules,composicion,context}.ts`
- Create: `services/backend/scripts/generar-schema.ts`
- Create: `schema.gql` (generado)
- Test: `services/backend/test/schema.test.ts`

**Interfaces:**
- Consumes: `ordenarModulos`, `crearBuilder`, `Core`, `Config`, `Context` de `@gps/core`; `sistema` de `@gps/sistema/servidor`.
- Produces:
  - `function componer(config: Config): { esquema: GraphQLSchema; contexto: Context }`
  - `function leerConfig(): Config`
  - `function crearServidor(config: Config)` que devuelve el server de Bun
  - `schema.gql` en la raíz del repo

- [ ] **Step 1: Crear `package.json` y `tsconfig.json`**

```json
{
  "name": "backend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "start": "bun src/index.ts",
    "schema": "bun scripts/generar-schema.ts && bunx biome format --write ../../schema.gql",
    "tipos": "tsc --noEmit"
  },
  "dependencies": {
    "@gps/core": "workspace:*",
    "@gps/sistema": "workspace:*",
    "graphql": "^16.9.0",
    "graphql-yoga": "^5.22.0"
  },
  "devDependencies": { "@types/bun": "latest", "typescript": "^5.7.0" }
}
```

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "test", "scripts"]
}
```

- [ ] **Step 2: Escribir el test de integración del esquema compuesto**

```ts
// services/backend/test/schema.test.ts
import { describe, expect, test } from 'bun:test'
import { execute, parse } from 'graphql'
import type { Config } from '@gps/core'
import { componer } from '../src/composicion'

const config: Config = { version: '1.2.3', entorno: 'prueba', puerto: 0 }

async function consultar(consulta: string) {
  const { esquema, contexto } = componer(config)
  return execute({
    schema: esquema,
    document: parse(consulta),
    contextValue: contexto,
  })
}

describe('esquema compuesto', () => {
  test('responde la version con los datos de la configuracion', async () => {
    const resultado = await consultar('{ version { numero entorno } }')
    expect(resultado.errors).toBeUndefined()
    expect(resultado.data).toEqual({
      version: { numero: '1.2.3', entorno: 'prueba' },
    })
  })

  test('lista los modulos efectivamente registrados', async () => {
    const resultado = await consultar('{ version { modulos } }')
    expect(resultado.data).toEqual({ version: { modulos: ['sistema'] } })
  })

  test('el contexto expone actor en null: auth todavia no existe', () => {
    const { contexto } = componer(config)
    expect(contexto.actor).toBeNull()
  })
})
```

- [ ] **Step 3: Correr el test para verificar que falla**

Run: `bun test services/backend`
Esperado: FALLA, no encuentra `../src/composicion`.

- [ ] **Step 4: Escribir la raíz de composición**

```ts
// services/backend/src/modules.ts
import { sistema } from '@gps/sistema/servidor'

/** La lista de modulos registrados. Agregar un modulo nuevo es agregarlo aca
 *  y nada mas: el orden lo resuelve ordenarModulos por dependencias. */
export const modulos = [sistema]
```

```ts
// services/backend/src/core.ts
import type { Config, Core } from '@gps/core'

export function crearCore(config: Config, modulos: readonly string[]): Core {
  return {
    config,
    modulos,
    reloj: { ahora: () => new Date() },
    logger: {
      info: (mensaje, datos) => console.log(JSON.stringify({ nivel: 'info', mensaje, ...datos })),
      error: (mensaje, datos) => console.error(JSON.stringify({ nivel: 'error', mensaje, ...datos })),
    },
  }
}
```

```ts
// services/backend/src/composicion.ts
import { crearBuilder, ordenarModulos, type Config, type Context } from '@gps/core'
import type { GraphQLSchema } from 'graphql'
import { crearCore } from './core'
import { modulos } from './modules'

/** Raiz de composicion: ordena los modulos, arma el Core, crea los servicios
 *  de cada uno y compone el esquema. Si algo falta, no compila. */
export function componer(config: Config): { esquema: GraphQLSchema; contexto: Context } {
  const ordenados = ordenarModulos(modulos)
  const core = crearCore(config, ordenados.map((modulo) => modulo.name))
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

```ts
// services/backend/src/context.ts
import type { Context } from '@gps/core'

/** Contexto por request. Hoy es constante; cuando exista auth, aca se
 *  resuelve el actor a partir del token del pedido. */
export function crearContexto(base: Context): () => Context {
  return () => base
}
```

- [ ] **Step 5: Escribir la configuración y el servidor**

```ts
// services/backend/src/server.ts
import { createYoga } from 'graphql-yoga'
import type { Config } from '@gps/core'
import { componer } from './composicion'
import { crearContexto } from './context'

export function crearServidor(config: Config) {
  const { esquema, contexto } = componer(config)

  const yoga = createYoga({
    schema: esquema,
    context: crearContexto(contexto),
    graphqlEndpoint: '/graphql',
    landingPage: false,
  })

  return Bun.serve({
    port: config.puerto,
    development: config.entorno === 'desarrollo',
    routes: {
      '/graphql': (pedido) => yoga.fetch(pedido),
      '/health': () => Response.json({ estado: 'ok', version: config.version }),
    },
  })
}
```

**Todavía no sirve la web.** `apps/web` no existe hasta la tarea 6, así que el servidor
arranca con dos rutas y nada más. La tarea 6 le agrega la ruta que sirve la aplicación,
importando su `index.html`: Bun lo bundlea y lo sirve desde este mismo proceso, con HMR en
desarrollo. Por eso no hay build estático intermedio ni una segunda terminal.

```ts
// services/backend/src/index.ts
import type { Config, Entorno } from '@gps/core'
import paquete from '../../../package.json'
import { crearServidor } from './server'

function leerEntorno(valor: string | undefined): Entorno {
  if (valor === 'produccion' || valor === 'prueba') return valor
  return 'desarrollo'
}

function leerPuerto(valor: string | undefined): number {
  if (valor === undefined) return 3000
  const puerto = Number(valor)
  // Sin esto, PUERTO=abc queda en NaN y Bun.serve elige un puerto al azar sin avisar.
  if (!Number.isInteger(puerto) || puerto < 0 || puerto > 65535) {
    throw new Error(`PUERTO invalido: "${valor}". Tiene que ser un entero entre 0 y 65535.`)
  }
  return puerto
}

export function leerConfig(): Config {
  return {
    version: paquete.version,
    entorno: leerEntorno(process.env.ENTORNO),
    puerto: leerPuerto(process.env.PUERTO),
  }
}

const config = leerConfig()
const servidor = crearServidor(config)
console.log(
  JSON.stringify({
    nivel: 'info',
    mensaje: 'GPS escuchando',
    url: `http://localhost:${servidor.port}`,
    version: config.version,
    entorno: config.entorno,
  }),
)
```

- [ ] **Step 6: Correr el test y verificar que pasa**

```bash
bun install
bun test services/backend
```

Esperado: los tres tests PASAN.

- [ ] **Step 7: Escribir el generador de `schema.gql`**

```ts
// services/backend/scripts/generar-schema.ts
import { printSchema } from 'graphql'
import { componer } from '../src/composicion'

const { esquema } = componer({ version: '0.0.0', entorno: 'prueba', puerto: 0 })
const destino = new URL('../../../schema.gql', import.meta.url).pathname

await Bun.write(destino, `${printSchema(esquema).trim()}\n`)
console.log(`schema.gql actualizado en ${destino}`)
```

- [ ] **Step 8: Generar `schema.gql`, formatearlo y revisarlo**

`schema.gql` está incluido en el chequeo de Biome, así que el script `schema` lo formatea
después de generarlo. Esto es necesario, no cosmético: la salida cruda de `printSchema` no
coincide con el formato de Biome —las descripciones de una línea se expanden a tres— y sin
formatear, `bunx biome check .` fallaría y el chequeo de CI que regenera y compara sería
inestable.

```bash
bun run schema
cat schema.gql
bunx biome check schema.gql
```

Esperado: contiene `type Version` con `numero`, `entorno` y `modulos`, y `type Query` con
`version: Version!`. `biome check` pasa limpio.

- [ ] **Step 8b: Verificar que generar dos veces da el mismo archivo**

```bash
bun run schema && cp schema.gql /tmp/uno.gql
bun run schema && diff /tmp/uno.gql schema.gql && echo ESTABLE
```

Esperado: imprime `ESTABLE`. Si no, el chequeo de CI de la tarea 9 fallaría de forma
intermitente.

- [ ] **Step 9: Probar el servidor a mano**

```bash
PUERTO=3000 bun services/backend/src/index.ts &
sleep 1
curl -s localhost:3000/health
curl -s localhost:3000/graphql -H 'content-type: application/json' \
  -d '{"query":"{ version { numero entorno modulos } }"}'
kill %1
```

Esperado: `/health` devuelve `{"estado":"ok",...}`; la consulta devuelve `{"data":{"version":{"numero":"0.1.0","entorno":"desarrollo","modulos":["sistema"]}}}`.

- [ ] **Step 10: Commit**

```bash
git add services/backend schema.gql bun.lock
git commit -m "feat(backend): composicion de modulos, GraphQL Yoga y schema.gql versionado"
```

---

### Task 5: `packages/api` — cliente GraphQL compartido

Lo que web y mobile comparten. El `Transporte` es la costura que después habilita el modo local.

**Files:**
- Create: `packages/api/package.json`, `packages/api/tsconfig.json`, `packages/api/codegen.ts`
- Create: `packages/api/src/{index,transporte,proveedor,version}.ts(x)`
- Create: `packages/api/src/queries/version.graphql`
- Test: `packages/api/test/transporte.test.ts`

**Interfaces:**
- Consumes: `schema.gql` de la tarea 4.
- Produces:
  - `interface Transporte { ejecutar<R, V>(documento: TypedDocumentNode<R, V>, variables?: V): Promise<R> }`
  - `function transporteHttp(url: string, hacerPedido?: typeof fetch): Transporte`
  - `class ErrorDeApi extends Error { readonly errores: readonly string[] }`
  - `function crearQueryClient(): QueryClient`
  - `function ProveedorDeApi(props: { transporte; queryClient; persister; children }): JSX.Element`
  - `function useVersion(): UseQueryResult<VersionQuery>`
  - Tipo generado `VersionQuery` con forma `{ version: { numero: string; entorno: string; modulos: string[] } }`

- [ ] **Step 1: Crear `package.json`, `tsconfig.json` y `codegen.ts`**

```json
{
  "name": "@gps/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "codegen": "graphql-codegen --config codegen.ts",
    "tipos": "bun run codegen && tsc --noEmit"
  },
  "dependencies": {
    "@graphql-typed-document-node/core": "^3.2.0",
    "@tanstack/react-query": "^5.102.4",
    "@tanstack/react-query-persist-client": "^5.102.4",
    "graphql": "^16.9.0"
  },
  "peerDependencies": { "react": ">=18" },
  "devDependencies": {
    "@graphql-codegen/cli": "^5.0.3",
    "@graphql-codegen/typed-document-node": "^5.0.12",
    "@graphql-codegen/typescript": "^4.1.2",
    "@graphql-codegen/typescript-operations": "^4.4.0",
    "@types/bun": "latest",
    "@types/react": "^19.2.0",
    "react": "^19.2.0",
    "typescript": "^5.7.0"
  }
}
```

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "test"]
}
```

```ts
// packages/api/codegen.ts
import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  schema: '../../schema.gql',
  documents: ['src/queries/**/*.graphql'],
  generates: {
    './src/generated/graphql.ts': {
      plugins: ['typescript', 'typescript-operations', 'typed-document-node'],
      // Obligatorio: el repo usa verbatimModuleSyntax, y sin esto el archivo
      // generado importa TypedDocumentNode sin `type` y tsc falla con TS1484.
      config: { useTypeImports: true },
    },
  },
}

export default config
```

- [ ] **Step 2: Escribir el test del transporte**

```ts
// packages/api/test/transporte.test.ts
import { describe, expect, test } from 'bun:test'
import { parse } from 'graphql'
import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { ErrorDeApi, transporteHttp } from '../src/transporte'

const DOCUMENTO = parse('{ version { numero } }') as TypedDocumentNode<
  { version: { numero: string } },
  Record<string, never>
>

function fetchFalso(cuerpo: unknown, estado = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(cuerpo), {
      status: estado,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch
}

describe('transporteHttp', () => {
  test('devuelve los datos cuando la respuesta es correcta', async () => {
    const transporte = transporteHttp(
      'http://x/graphql',
      fetchFalso({ data: { version: { numero: '1.0.0' } } }),
    )
    expect(await transporte.ejecutar(DOCUMENTO)).toEqual({ version: { numero: '1.0.0' } })
  })

  test('lanza ErrorDeApi cuando GraphQL devuelve errores', async () => {
    const transporte = transporteHttp(
      'http://x/graphql',
      fetchFalso({ errors: [{ message: 'sin permiso' }] }),
    )
    expect(transporte.ejecutar(DOCUMENTO)).rejects.toThrow(ErrorDeApi)
  })

  test('el ErrorDeApi conserva los mensajes del servidor', async () => {
    const transporte = transporteHttp(
      'http://x/graphql',
      fetchFalso({ errors: [{ message: 'sin permiso' }] }),
    )
    // Sin `throw` guardian dentro del try: ese throw lo atrapa su propio catch
    // y la asercion terminaria corriendo sobre el error equivocado. Acumulando
    // en una variable, si no se lanza nada queda undefined y el test falla.
    let errores: readonly string[] | undefined
    try {
      await transporte.ejecutar(DOCUMENTO)
    } catch (error) {
      errores = (error as ErrorDeApi).errores
    }
    expect(errores).toEqual(['sin permiso'])
  })

  test('lanza si el transporte responde con un codigo de error HTTP', async () => {
    const transporte = transporteHttp('http://x/graphql', fetchFalso({}, 500))
    expect(transporte.ejecutar(DOCUMENTO)).rejects.toThrow()
  })
})
```

- [ ] **Step 3: Correr el test para verificar que falla**

Run: `bun test packages/api`
Esperado: FALLA, no encuentra `../src/transporte`.

- [ ] **Step 4: Escribir el transporte**

```ts
// packages/api/src/transporte.ts
import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { print } from 'graphql'

export class ErrorDeApi extends Error {
  readonly errores: readonly string[]

  constructor(errores: readonly string[]) {
    super(`La API devolvio errores: ${errores.join('; ')}`)
    this.name = 'ErrorDeApi'
    this.errores = errores
  }
}

/** Como se ejecuta una consulta. La implementacion HTTP es la unica que
 *  existe hoy; el modo local va a aportar otra que ejecuta en proceso, sin
 *  que las pantallas cambien. */
export interface Transporte {
  ejecutar<Resultado, Variables>(
    documento: TypedDocumentNode<Resultado, Variables>,
    variables?: Variables,
  ): Promise<Resultado>
}

export function transporteHttp(url: string, hacerPedido: typeof fetch = fetch): Transporte {
  return {
    async ejecutar(documento, variables) {
      const respuesta = await hacerPedido(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: print(documento), variables }),
      })

      if (!respuesta.ok) {
        throw new Error(`La API respondio ${respuesta.status} ${respuesta.statusText}`)
      }

      const cuerpo = (await respuesta.json()) as {
        data?: unknown
        errors?: Array<{ message: string }>
      }

      if (cuerpo.errors?.length) {
        throw new ErrorDeApi(cuerpo.errors.map((error) => error.message))
      }

      return cuerpo.data as never
    },
  }
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `bun test packages/api`
Esperado: los cuatro tests PASAN.

- [ ] **Step 6: Escribir la consulta y generar los tipos**

```graphql
# packages/api/src/queries/version.graphql
query Version {
  version {
    numero
    entorno
    modulos
  }
}
```

```bash
bun install
bun run --filter @gps/api codegen
cat packages/api/src/generated/graphql.ts | head -40
```

Esperado: existe `export const VersionDocument: DocumentNode<VersionQuery, VersionQueryVariables>`.

- [ ] **Step 7: Escribir el proveedor de React y el hook**

```tsx
// packages/api/src/proveedor.tsx
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import type { Persister } from '@tanstack/react-query-persist-client'
import { createContext, useContext, type ReactNode } from 'react'
import type { Transporte } from './transporte'

const ContextoDeTransporte = createContext<Transporte | null>(null)

export function useTransporte(): Transporte {
  const transporte = useContext(ContextoDeTransporte)
  if (!transporte) throw new Error('Falta envolver la app en ProveedorDeApi.')
  return transporte
}

/** Un mes de cache en disco: alcanza para que la app abra sin conexion. */
const UN_MES = 1000 * 60 * 60 * 24 * 30

export function crearQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { gcTime: UN_MES, staleTime: 1000 * 60, retry: 1 },
    },
  })
}

export function ProveedorDeApi(props: {
  transporte: Transporte
  queryClient: QueryClient
  persister: Persister
  children: ReactNode
}) {
  return (
    <PersistQueryClientProvider
      client={props.queryClient}
      persistOptions={{ persister: props.persister, maxAge: UN_MES }}
    >
      <ContextoDeTransporte.Provider value={props.transporte}>
        {props.children}
      </ContextoDeTransporte.Provider>
    </PersistQueryClientProvider>
  )
}
```

```ts
// packages/api/src/version.ts
import { useQuery } from '@tanstack/react-query'
import { VersionDocument } from './generated/graphql'
import { useTransporte } from './proveedor'

export function useVersion() {
  const transporte = useTransporte()
  return useQuery({
    queryKey: ['version'],
    queryFn: () => transporte.ejecutar(VersionDocument),
  })
}
```

```ts
// packages/api/src/index.ts
export { crearQueryClient, ProveedorDeApi, useTransporte } from './proveedor'
export { ErrorDeApi, transporteHttp } from './transporte'
export type { Transporte } from './transporte'
export { useVersion } from './version'
export type { VersionQuery } from './generated/graphql'
```

- [ ] **Step 8: Verificar tipos y lint**

```bash
bun run --filter @gps/api tipos
bunx biome check packages/api
```

Esperado: sin errores.

- [ ] **Step 9: Commit**

```bash
git add packages/api bun.lock
git commit -m "feat(api): transporte, cliente con cache persistido y codegen tipado"
```

---

### Task 6: `apps/web`

**Files:**
- Create: `apps/web/{package.json,tsconfig.json,index.html}`
- Create: `services/backend/bunfig.toml`
- Modify: `bunfig.toml` (raíz)
- Create: `apps/web/src/{main.tsx,App.tsx,estilos.css}`
- Modify: `services/backend/src/server.ts` (agregar la ruta que sirve la aplicación)

**Interfaces:**
- Consumes: `ProveedorDeApi`, `crearQueryClient`, `transporteHttp`, `useVersion` de `@gps/api`.
- Produces: la aplicación servida por `services/backend` en la raíz del sitio.

**Sin Vite.** Bun bundlea el `index.html` —JSX, TypeScript y CSS incluidos— y lo sirve desde
el mismo `Bun.serve` del backend. Eso elimina el proxy de `/graphql`, la segunda terminal y la
diferencia entre desarrollo y producción. Verificado contra Bun 1.4.0 antes de escribir esto.

- [ ] **Step 1: Crear `package.json`, `tsconfig.json` y `bunfig.toml`**

```json
{
  "name": "web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "tipos": "tsc --noEmit"
  },
  "dependencies": {
    "@gps/api": "workspace:*",
    "@tanstack/query-async-storage-persister": "^5.102.4",
    "idb-keyval": "^6.2.1",
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "@types/bun": "latest",
    "bun-plugin-tailwind": "^0.1.2",
    "tailwindcss": "^4.3.3",
    "typescript": "^5.7.0"
  }
}
```

`@types/bun` es obligatorio aunque parezca de servidor: `tsconfig.base.json` fuerza
`"types": ["bun"]`, y bajo el linker aislado no se resuelve si el paquete no lo declara. Además
es lo que aporta la declaración ambiente de `*.html` que hace type-checkear el import del
`index.html` en el backend.

No hay script `dev` ni `build`: la aplicación la sirve `services/backend`, que la bundlea. No
hay `vite.config.ts`, ni `postcss.config.js`, ni `tailwind.config.ts` — Tailwind 4 se configura
desde el propio CSS.

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

**Dónde va la config del plugin de Tailwind, y por qué no en `apps/web`.** Bun lee
`bunfig.toml` **estrictamente desde el directorio de trabajo del proceso**: no busca hacia
arriba ni fusiona configuraciones. Como quien bundlea es `services/backend`, un
`apps/web/bunfig.toml` no lo leería nadie —Tailwind no correría y la página serviría
`@tailwind utilities;` crudo, sin estilos y sin error alguno.

Hay dos formas reales de arrancar el servidor, con dos directorios de trabajo distintos, así
que la configuración va en los dos:

```toml
# services/backend/bunfig.toml  (cwd cuando se corre `bun run dev`)
# Bun lee bunfig.toml solo desde el cwd del proceso, sin buscar hacia arriba ni
# fusionar. Este archivo cubre `bun run dev`; el de la raiz cubre la invocacion
# directa `bun services/backend/src/index.ts`. Si editas uno, edita el otro.
[serve.static]
plugins = ["bun-plugin-tailwind"]
```

Y el mismo bloque, con la nota equivalente, en el `bunfig.toml` de la raíz, que ya existe desde
la tarea 1 y sólo hay que ampliar.

**No crear `apps/web/bunfig.toml`.**

- [ ] **Step 2: Crear `index.html` y los estilos**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>GPS — Gestión para Scouts</title>
    <link rel="stylesheet" href="./src/estilos.css" />
  </head>
  <body>
    <div id="raiz"></div>
    <script type="module" src="./src/main.tsx"></script>
  </body>
</html>
```

```css
/* apps/web/src/estilos.css */
@import "tailwindcss";
```

Tailwind 4 se importa desde el CSS y no lleva archivo de configuración. Mobile se queda en
Tailwind 3.4 porque NativeWind estable apunta a ese modelo; es una diferencia conocida y
aceptada, anotada en la sección de decisiones.

- [ ] **Step 3: Escribir el punto de entrada con el cache persistido en IndexedDB**

```tsx
// apps/web/src/main.tsx
import { crearQueryClient, ProveedorDeApi, transporteHttp } from '@gps/api'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { del, get, set } from 'idb-keyval'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

// IndexedDB, no localStorage: el cache va a crecer cuando lleguen los modulos reales.
const persister = createAsyncStoragePersister({
  storage: {
    getItem: async (clave) => (await get(clave)) ?? null,
    setItem: async (clave, valor) => {
      await set(clave, valor)
    },
    removeItem: async (clave) => {
      await del(clave)
    },
  },
  key: 'gps-cache',
})

const raiz = document.getElementById('raiz')
if (!raiz) throw new Error('Falta el elemento #raiz en index.html')

createRoot(raiz).render(
  <StrictMode>
    <ProveedorDeApi
      transporte={transporteHttp('/graphql')}
      queryClient={crearQueryClient()}
      persister={persister}
    >
      <App />
    </ProveedorDeApi>
  </StrictMode>,
)
```

El CSS no se importa desde el TSX: lo enlaza el `index.html`, que es la entrada que Bun
bundlea.

- [ ] **Step 4: Escribir la pantalla, diseñada primero a 375px**

```tsx
// apps/web/src/App.tsx
import { useVersion } from '@gps/api'

export function App() {
  const { data, isPending, error } = useVersion()

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto w-full max-w-md sm:max-w-lg">
        <h1 className="text-2xl font-semibold">GPS</h1>
        <p className="mt-1 text-sm text-slate-500">Gestión para Scouts</p>

        {isPending && <p className="mt-8 text-sm text-slate-500">Consultando la versión…</p>}

        {error && (
          <p className="mt-8 rounded-lg bg-red-50 p-4 text-sm text-red-800">
            No se pudo consultar la versión: {error.message}
          </p>
        )}

        {data && (
          <dl className="mt-8 divide-y divide-slate-200 rounded-lg bg-white shadow-sm">
            <div className="flex justify-between px-4 py-3">
              <dt className="text-sm text-slate-500">Versión</dt>
              <dd className="text-sm font-medium">{data.version.numero}</dd>
            </div>
            <div className="flex justify-between px-4 py-3">
              <dt className="text-sm text-slate-500">Entorno</dt>
              <dd className="text-sm font-medium">{data.version.entorno}</dd>
            </div>
            <div className="flex justify-between px-4 py-3">
              <dt className="text-sm text-slate-500">Módulos</dt>
              <dd className="text-sm font-medium">{data.version.modulos.join(', ')}</dd>
            </div>
          </dl>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 5: Que el backend sirva la aplicación**

Modificar `services/backend/src/server.ts`, agregando el import y la ruta comodín. El resto
del archivo no cambia.

```ts
import inicio from '../../../apps/web/index.html'

// ...dentro de Bun.serve:
    routes: {
      '/graphql': (pedido) => yoga.fetch(pedido),
      '/health': () => Response.json({ estado: 'ok', version: config.version }),
      '/*': inicio,
    },
```

Agregar también `bun-plugin-tailwind` a las `devDependencies` de `services/backend`, porque es
el proceso que bundlea el CSS.

La ruta comodín va última y cubre el enrutado del lado del cliente: cualquier ruta desconocida
devuelve la aplicación.

- [ ] **Step 6: Verificar que corre, con recarga en caliente**

```bash
bun install
ENTORNO=desarrollo PUERTO=3000 bun run dev
```

Abrir `http://localhost:3000`. Esperado: se ven versión, entorno y `sistema` como módulo, con
los estilos de Tailwind aplicados. **Un solo proceso y un solo puerto** — no hay segunda
terminal ni proxy.

Con el servidor corriendo, cambiar el texto de `<h1>` en `App.tsx` y guardar. Esperado: el
navegador se actualiza solo.

- [ ] **Step 7: Verificar la lectura sin conexión**

Con la página ya cargada: abrir las herramientas de desarrollo, pestaña Red, activar "Sin
conexión", recargar.
Esperado: la página sigue mostrando la versión desde el cache en IndexedDB, no un error. Ésta
es la prueba de aceptación de §7.5 de la spec.

- [ ] **Step 8: Verificar que el bundling no emite warnings**

La línea base del repo es cero warnings. Al probar esta configuración se vieron warnings
`invalid @ rule encountered: '@theme'` y `'@tailwind'` al bundlear CSS de Tailwind 4.

```bash
ENTORNO=produccion PUERTO=3001 bun services/backend/src/index.ts 2>&1 | head -20
```

Esperado: el arranque bundlea la aplicación sin emitir warnings. **Si aparecen**, investigar si
se deben a que el plugin de Tailwind no está activo en ese proceso (revisar que
`bun-plugin-tailwind` esté instalado en `services/backend` y que el `bunfig.toml` correcto se
esté leyendo). Si no se pueden eliminar, reportar DONE_WITH_CONCERNS con la evidencia en vez de
silenciarlos: son la señal de que Bun no está interpretando el CSS de Tailwind como
corresponde.

- [ ] **Step 9: Tipos y lint**

```bash
bun run --filter './apps/web' tipos
bunx biome check .
```

Esperado: sin errores y sin warnings, en todo el repo. En particular, la regla de frontera no
debe dispararse: `apps/web` sólo importa `@gps/api`.

- [ ] **Step 10: Commit**

```bash
git add apps/web services/backend bun.lock
git commit -m "feat(web): pantalla de version servida y bundleada por el propio backend"
```

---

### Task 7: `apps/mobile`

La pieza con más superficie de configuración propia. El punto delicado es Metro en un monorepo con instalación aislada.

**Files:**
- Create: `apps/mobile/{package.json,tsconfig.json,app.json,babel.config.js,metro.config.js,tailwind.config.js,global.css,nativewind-env.d.ts}`
- Create: `apps/mobile/app/{_layout.tsx,index.tsx}`

**Interfaces:**
- Consumes: `ProveedorDeApi`, `crearQueryClient`, `transporteHttp`, `useVersion` de `@gps/api`.
- Produces: nada que otras tareas consuman.

- [ ] **Step 1: Generar el proyecto con la CLI de Expo, no a mano**

Expo mantiene una matriz de versiones compatibles entre `expo`, `react-native`,
`react-native-screens` y demás. Fijarlas a mano en un `package.json` es la forma más rápida
de terminar con un proyecto que no compila. Se deja que la CLI las resuelva.

```bash
cd apps
bunx create-expo-app@latest mobile --template tabs --no-install
cd mobile
```

Después ajustar el `package.json` generado: cambiar `"name"` a `"mobile"`, agregar
`"private": true` y reemplazar los scripts por:

```json
{
  "scripts": {
    "dev": "expo start",
    "tipos": "tsc --noEmit"
  }
}
```

Borrar las pantallas de ejemplo de la plantilla:

```bash
rm -rf app components constants hooks scripts assets/images/react-logo*
mkdir app
```

- [ ] **Step 1b: Agregar las dependencias con `expo install`**

`expo install` elige la versión compatible con el SDK instalado; `bun add` no.

```bash
bunx expo install @react-native-async-storage/async-storage expo-constants expo-router \
  react-native-safe-area-context react-native-screens
bun add @gps/api@workspace:* @tanstack/query-async-storage-persister nativewind
bun add -d tailwindcss
```

Verificar que la matriz quedó consistente:

```bash
bunx expo install --check
```

Esperado: no reporta incompatibilidades. Si reporta, correr `bunx expo install --fix`.

- [ ] **Step 2: Crear la configuración de Expo, Babel y Tailwind**

El `app.json` ya existe: la plantilla lo generó. Editarlo para que quede así, conservando
lo que la CLI haya puesto en `ios`, `android` y `plugins`:

```json
{
  "expo": {
    "name": "GPS",
    "slug": "gps",
    "scheme": "gps",
    "version": "0.1.0",
    "orientation": "portrait",
    "userInterfaceStyle": "automatic",
    "plugins": ["expo-router"],
    "extra": { "apiUrl": "http://localhost:3000/graphql" }
  }
}
```

```js
// apps/mobile/babel.config.js
module.exports = (api) => {
  api.cache(true)
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  }
}
```

```js
// apps/mobile/tailwind.config.js
module.exports = {
  content: ['./app/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: { extend: {} },
  plugins: [],
}
```

```css
/* apps/mobile/global.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

```ts
// apps/mobile/nativewind-env.d.ts
/// <reference types="nativewind/types" />
```

Reemplazar el `tsconfig.json` que generó la plantilla por:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "jsx": "react-jsx", "types": ["react", "nativewind/types"] },
  "include": ["app", "*.ts", "*.tsx", "nativewind-env.d.ts"]
}
```

Nota: se extiende el `tsconfig.base.json` del monorepo y no el `expo/tsconfig.base`, para
que las reglas de tipos sean las mismas en todo el repo.

- [ ] **Step 3: Crear `metro.config.js`**

Éste es el archivo que hace que Expo funcione dentro del workspace, y lo importante es lo que
**no** lleva.

```js
// apps/mobile/metro.config.js
const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

// NOTA: no se fija watchFolders / resolver.nodeModulesPaths /
// disableHierarchicalLookup a mano. Esa es la receta "antes de SDK 52" de la
// guia de monorepos de Expo. Desde SDK 52, getDefaultConfig detecta el monorepo
// y calcula esos mismos valores solo. Peor todavia: forzar
// disableHierarchicalLookup = true rompe la resolucion de dependencias que
// quedan anidadas mas adentro del store aislado de Bun.
const config = getDefaultConfig(__dirname)

module.exports = withNativeWind(config, { input: './global.css' })
```

Verificado en este proyecto: con `disableHierarchicalLookup = true`, `whatwg-fetch` —una
dependencia transitiva de `@expo/metro-runtime`— deja de resolverse. Con el valor por defecto
todo resuelve, incluido `@gps/api`, que Metro encuentra porque es un paquete del workspace.

Si aparece **`Unable to resolve @gps/api`**, el problema no es este archivo: revisar que el
paquete esté declarado en las dependencias de `apps/mobile`. Si aparece **`Invalid hook
call`**, hay dos copias de React — es un problema de resolución disfrazado de bug en la
pantalla.

- [ ] **Step 4: Escribir el layout con el proveedor**

```tsx
// apps/mobile/app/_layout.tsx
import AsyncStorage from '@react-native-async-storage/async-storage'
import { crearQueryClient, ProveedorDeApi, transporteHttp } from '@gps/api'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import Constants from 'expo-constants'
import { Stack } from 'expo-router'
import '../global.css'

const urlDeLaApi =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  process.env.EXPO_PUBLIC_API_URL ??
  'http://localhost:3000/graphql'

const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'gps-cache' })

export default function Layout() {
  return (
    <ProveedorDeApi
      transporte={transporteHttp(urlDeLaApi)}
      queryClient={crearQueryClient()}
      persister={persister}
    >
      <Stack screenOptions={{ headerShown: false }} />
    </ProveedorDeApi>
  )
}
```

- [ ] **Step 5: Escribir la pantalla**

```tsx
// apps/mobile/app/index.tsx
import { useVersion } from '@gps/api'
import { SafeAreaView, Text, View } from 'react-native'

function Fila(props: { etiqueta: string; valor: string }) {
  return (
    <View className="flex-row justify-between border-b border-slate-200 px-4 py-3">
      <Text className="text-sm text-slate-500">{props.etiqueta}</Text>
      <Text className="text-sm font-medium text-slate-900">{props.valor}</Text>
    </View>
  )
}

export default function Pantalla() {
  const { data, isPending, error } = useVersion()

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="px-4 py-10">
        <Text className="text-2xl font-semibold text-slate-900">GPS</Text>
        <Text className="mt-1 text-sm text-slate-500">Gestión para Scouts</Text>

        {isPending && <Text className="mt-8 text-sm text-slate-500">Consultando la versión…</Text>}

        {error && (
          <View className="mt-8 rounded-lg bg-red-50 p-4">
            <Text className="text-sm text-red-800">
              No se pudo consultar la versión: {error.message}
            </Text>
          </View>
        )}

        {data && (
          <View className="mt-8 rounded-lg bg-white">
            <Fila etiqueta="Versión" valor={data.version.numero} />
            <Fila etiqueta="Entorno" valor={data.version.entorno} />
            <Fila etiqueta="Módulos" valor={data.version.modulos.join(', ')} />
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}
```

- [ ] **Step 6: Levantar la app**

```bash
bun install
PUERTO=3000 bun services/backend/src/index.ts &
bun run --filter mobile dev
```

Abrir en Expo Go o en un simulador. Esperado: se ven versión, entorno y módulos.

Si al abrir aparece "Unable to resolve @gps/api": revisar `metro.config.js`, en particular `watchFolders` y `disableHierarchicalLookup`. Es el punto de falla más probable de toda la iteración.

Si el dispositivo es físico, `localhost` apunta al teléfono: reemplazar `apiUrl` en `app.json` por la IP de la máquina (`http://192.168.x.x:3000/graphql`).

- [ ] **Step 7: Verificar la lectura sin conexión**

Con la pantalla ya cargada: poner el dispositivo en modo avión, cerrar la app por completo y volver a abrirla.
Esperado: sigue mostrando la versión desde el cache en AsyncStorage. Ésta es la otra mitad de la prueba de aceptación de §7.5.

- [ ] **Step 8: Tipos y lint**

```bash
kill %1
bun run --filter mobile tipos
bunx biome check apps/mobile
```

Esperado: sin errores.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile bun.lock
git commit -m "feat(mobile): pantalla de version en Expo con cache persistido"
```

---

### Task 8: Docker y Docker Compose

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `docker-compose.yml`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: una imagen que sirve la API y la web en el puerto 3000.

- [ ] **Step 1: Crear `.dockerignore`**

```
node_modules
**/node_modules
**/dist
**/.expo
.git
docs
apps/mobile/*
!apps/mobile/package.json
```

El código de `apps/mobile` se excluye a propósito: la imagen sirve la API y la web, y la
app mobile se distribuye por las tiendas. Pero su `package.json` **sí** entra: `bun install
--frozen-lockfile` resuelve todos los miembros del workspace que figuran en `bun.lock`, y
si falta ese archivo la instalación falla dentro de la imagen.

- [ ] **Step 2: Crear el `Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1

FROM oven/bun:1 AS dependencias
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY packages/core/package.json packages/core/
COPY packages/sistema/package.json packages/sistema/
COPY packages/api/package.json packages/api/
COPY services/backend/package.json services/backend/
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
RUN bun install --frozen-lockfile

FROM dependencias AS construccion
COPY . .
RUN bun run --filter @gps/api codegen

FROM oven/bun:1-slim AS produccion
WORKDIR /app
ENV ENTORNO=produccion
ENV PUERTO=3000
COPY --from=construccion /app/node_modules ./node_modules
COPY --from=construccion /app/package.json ./package.json
# bunfig.toml es obligatorio en la etapa final, no solo en la de dependencias:
# el CMD corre con cwd /app y Bun lee bunfig.toml SOLO desde el cwd. Sin este
# archivo no se carga bun-plugin-tailwind y la imagen sirve la pagina sin
# estilos, reportando salud perfecta.
COPY --from=construccion /app/bunfig.toml ./bunfig.toml
COPY --from=construccion /app/packages ./packages
COPY --from=construccion /app/services ./services
COPY --from=construccion /app/apps/web ./apps/web
EXPOSE 3000
CMD ["bun", "services/backend/src/index.ts"]
```

- [ ] **Step 3: Crear `docker-compose.yml`**

```yaml
services:
  gps:
    build: .
    ports:
      - "3000:3000"
    environment:
      ENTORNO: produccion
    healthcheck:
      test: ["CMD", "bun", "-e", "await fetch('http://localhost:3000/health')"]
      interval: 30s
      timeout: 5s
      retries: 3
```

Sin volumen: todavía no hay base de datos. Entra junto con SQLite.

**Sin build intermedio de la web.** El backend bundlea `apps/web/index.html` al arrancar, así
que la imagen lleva el código fuente de la web en vez de un `dist/`. Cuesta unos cien
milisegundos de arranque y elimina un paso de build, un artefacto intermedio y la posibilidad
de que la imagen quede con un `dist/` viejo.

- [ ] **Step 4: Construir y levantar**

```bash
docker compose build
docker compose up -d
sleep 5
curl -s localhost:3000/health
curl -s localhost:3000/graphql -H 'content-type: application/json' \
  -d '{"query":"{ version { numero entorno modulos } }"}'
curl -s localhost:3000/ | head -3
docker compose down
```

Esperado: `/health` responde `ok`; la consulta devuelve `entorno: "produccion"`; la raíz devuelve el HTML de la web.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile .dockerignore docker-compose.yml
git commit -m "chore: imagen Docker que sirve la API y la web en un solo puerto"
```

---

### Task 9: Integración continua

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: los scripts de la tarea 1 y el `schema.gql` de la tarea 4.
- Produces: la verificación que sostiene el contrato público.

- [ ] **Step 1: Crear el workflow**

```yaml
name: CI

on:
  push:
    branches: ["**"]
  pull_request:

jobs:
  verificar:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Instalar dependencias
        run: bun install --frozen-lockfile

      - name: Lint y formato
        run: bunx biome check .

      - name: Generar tipos del cliente
        run: bun run --filter @gps/api codegen

      - name: Chequeo de tipos
        run: bun run tipos

      - name: Tests
        run: bun test

      - name: Verificar que schema.gql esta al dia
        run: |
          bun run schema
          if ! git diff --exit-code schema.gql; then
            echo "::error::schema.gql quedo desactualizado. Corre 'bun run schema' y commitea el resultado."
            exit 1
          fi

      - name: Verificar que el servidor arranca y sirve la aplicación
        run: |
          ENTORNO=produccion PUERTO=3000 bun services/backend/src/index.ts &
          for i in $(seq 1 30); do
            curl -sf http://localhost:3000/health > /dev/null && break
            sleep 1
          done
          curl -sf http://localhost:3000/health
          curl -sf http://localhost:3000/graphql -H 'content-type: application/json' \
            -d '{"query":"{ version { numero modulos } }"}'
          curl -sf http://localhost:3000/ | grep -q '<div id="raiz">'

      - name: Construir la imagen Docker
        run: docker build -t gps:ci .
```

- [ ] **Step 2: Verificar el workflow localmente, paso por paso**

```bash
bun install --frozen-lockfile
bunx biome check .
bun run --filter @gps/api codegen
bun run tipos
bun test
bun run schema && git diff --exit-code schema.gql
ENTORNO=produccion PUERTO=3000 bun services/backend/src/index.ts &
sleep 3 && curl -sf localhost:3000/ | grep -q '<div id="raiz">' && echo "sirve la app"
kill %1
docker build -t gps:ci .
```

Esperado: todos los pasos PASAN. Si `git diff` marca cambios en `schema.gql`, commitear el archivo regenerado.

- [ ] **Step 3: Verificar que el chequeo del esquema detecta una desviación**

```bash
printf '\n# desviacion deliberada\n' >> schema.gql
bun run schema
git diff --exit-code schema.gql || echo "DETECTADO correctamente"
git checkout schema.gql
```

Esperado: imprime "DETECTADO correctamente". Éste es el paso que impide cambiar la API pública sin que aparezca en el diff.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: lint, tipos, tests, verificacion de schema.gql y build de imagen"
```

---

### Task 10: Documentación

Se escribe ahora, con el patrón fresco y un solo módulo de ejemplo, que es cuando sale bien.

**Files:**
- Create: `AGENT.md`, `README.md`, `docs/crear-un-modulo.md`
- Create: `CLAUDE.md` (enlace simbólico)
- Modify: `docs/arquitectura.md` (marcar como diferido lo que no entró)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: la referencia que hace que el módulo 2 lo pueda escribir otra persona o un agente.

- [ ] **Step 1: Escribir `AGENT.md`**

```markdown
# GPS — Referencia para agentes

CRM para gestionar los scouts de la asociación. Diseño completo en
`docs/superpowers/specs/2026-08-24-arquitectura-y-walking-skeleton-design.md`.
Mapa de piezas en `docs/arquitectura.md`. Tutorial en prosa en `docs/crear-un-modulo.md`.

## Vocabulario: módulo ≠ plugin

- **Módulo**: una unidad de negocio nuestra (Personas, Afiliación, `sistema`).
  Interfaz `Module`, registrados en `services/backend/src/modules.ts`.
- **Plugin**: reservado para los interceptores del pipeline de GraphQL de envelop.
  Todavía no hay ninguno.

## Comandos

    bun install                 instalar
    bun run dev                 la app entera en :3000 — web y API en un solo
                                proceso, con recarga en caliente
    bun run --filter mobile dev Expo
    bun run verificar           lint + tipos + tests
    bun run schema             regenerar schema.gql
    bun run --filter @gps/api codegen   regenerar tipos del cliente
    docker compose up           todo junto en :3000

## Cómo crear un módulo nuevo

1. Copiar `packages/sistema/` a `packages/<nombre>/`.
2. Cambiar `name` en el `package.json` a `@gps/<nombre>`.
3. Escribir el dominio en `src/dominio/`: modelos, validaciones, reglas puras.
4. Escribir el servicio, el esquema y el módulo en `src/servidor/`.
5. Declarar las dependencias en `dependencies` del objeto `Module`.
6. Agregarlo a la lista de `services/backend/src/modules.ts`.
7. `bun run schema` y commitear el `schema.gql` resultante.

No hay ningún otro archivo central que tocar.

## Reglas obligatorias

**Idioma.** El idioma lo decide el dominio, no la capa. Español para lo que nombra
el escultismo y las reglas de negocio (`Persona`, `calcularCuotaDelGrupo`, campos
GraphQL, comentarios, nombres de tests). Inglés para el vocabulario técnico de
industria (`module`, `core`, `index`, `server`, `context`, `config`, `logger`,
`schema`, `repository`, `cache`, `query`) y para los archivos canónicos
(`README.md`, `schema.gql`, `package.json`, `Dockerfile`).

**Portabilidad.** El código bajo `src/servidor/` de un módulo nunca importa `bun:*`
ni `node:*`, ni lee archivos, ni consulta la hora del sistema. Todo pasa por `Core`.
Lo impone Biome. Si la regla molesta, la solución es pasar el dato por `Core`, nunca
desactivarla. Es lo que va a permitir correr los módulos dentro del teléfono.

**Fronteras de imports.** `apps/**` no puede importar `*/servidor`. Los módulos no se
importan entre sí: se comunican por el contexto (`ctx.personas`). Lo impone Biome.

**Mobile-first.** Todo se diseña primero a 375px. `sm:` y `md:` sólo agregan en
pantallas grandes, nunca arreglan lo que se rompió en chicas.

**Autorización** (cuando exista `auth`). Tres capas: acceso al módulo declarado en
`accesoAlModulo`, filtrado por `Alcance` como **primer parámetro obligatorio** de todo
método de repositorio, y políticas por campo en `src/dominio/politicas.ts`. Las
políticas son funciones puras y las usan el servidor y las pantallas.

## Qué NO existe todavía

Base de datos, migraciones, auth, rate limiting, bus de eventos, auditoría, archivos,
modo demo. Cada uno tiene su diseño en la spec y llega con su primer consumidor real.
No agregarlos por adelantado.
```

- [ ] **Step 2: Crear el enlace simbólico y verificarlo**

```bash
ln -s AGENT.md CLAUDE.md
cat CLAUDE.md | head -3
git add CLAUDE.md
```

Esperado: `cat` muestra el contenido de `AGENT.md`.

- [ ] **Step 3: Escribir `README.md`**

```markdown
# GPS

_Gestión para Scouts._ CRM para gestionar los scouts de la asociación.

**Estado: prototipo.** No opera con datos reales. Los cinco requisitos para que eso
cambie están en §1 de la spec de arquitectura.

## Levantarlo

Requiere [Bun](https://bun.sh).

    curl -fsSL https://bun.sh/install | bash
    bun install
    bun run dev                  # todo en http://localhost:3000

O todo junto en un contenedor:

    docker compose up            # http://localhost:3000

Para la app mobile hace falta Expo Go o un simulador:

    bun run --filter mobile dev

## Verificar

    bun run verificar            # lint, tipos y tests

## Documentación

- `docs/arquitectura.md` — el mapa de las piezas y cómo se comunican. Empezá por acá.
- `docs/crear-un-modulo.md` — tutorial para agregar un módulo.
- `AGENT.md` — referencia densa de reglas y comandos.
- `docs/superpowers/specs/` — el diseño y por qué cada decisión es como es.
```

- [ ] **Step 4: Escribir `docs/crear-un-modulo.md`**

Tutorial en prosa para humanos, con `sistema` como ejemplo trabajado de punta a punta.
`AGENT.md` dice **qué** hacer; este documento explica **por qué** cada pieza está donde está.

Usar exactamente estos ocho títulos, en este orden, y en cada uno pegar el código real del
archivo indicado —copiado, no referenciado, porque quien lee el tutorial no tiene el repo
abierto al lado:

| Título de la sección | Código a copiar | Qué tiene que explicar |
|---|---|---|
| `## Un módulo es un paquete` | el `package.json` de `packages/sistema` | por qué hay dos entry points y no uno; qué pasaría si `apps/web` pudiera importar `/servidor` |
| `## El dominio: lo que se comparte con las apps` | `src/dominio/index.ts` | por qué el tipo `Version` vive acá y no en el servidor; qué significa "isomorfo" |
| `## El servicio: la lógica` | `src/servidor/servicio.ts` | por qué recibe `Core` en vez de leer el `package.json`; que la regla de portabilidad es lo que va a permitir correr el módulo dentro del teléfono |
| `## El esquema: la API pública` | `src/servidor/schema.ts` | cómo `queryField` deja que ocho módulos escriban sobre el mismo `Query` sin pisarse; por qué los campos van en español |
| `## El módulo: atar los cabos` | `src/servidor/index.ts` | qué hace `declare module '@gps/core'` y por qué ésa es la única vía para que otro módulo lo alcance |
| `## Registrarlo` | `services/backend/src/modules.ts` | que es la única línea a agregar; qué hace `ordenarModulos` con `dependencies` y qué error tira si falta una o hay un ciclo |
| `## Testearlo aislado` | `packages/sistema/test/servicio.test.ts` completo | que `coreFalso` es todo lo que hace falta para testear un módulo; por qué el reloj se inyecta |
| `## Qué se rompe si ignorás las reglas` | ninguno | importar `bun:sqlite` rompe el modo local y el offline; importar otro módulo hace imposible darlo de baja; olvidar `bun run schema` hace fallar CI; olvidar `Alcance` en un repositorio filtra datos de otros grupos |

- [ ] **Step 5: Actualizar `docs/arquitectura.md`**

`docs/arquitectura.md` se escribió antes de dos cambios de diseño y quedó desactualizado en
cuatro puntos. Corregirlos todos.

**a) Vite ya no existe.** El diagrama de la sección 1 dice `Vite + React` para `apps/web`;
ahora es React + Tailwind bundleado por Bun. Y en la sección 2, el texto "En desarrollo Vite
corre aparte y proxea `/graphql`" es directamente falso: hay un solo proceso y un solo puerto,
en desarrollo y en producción, con recarga en caliente servida por el mismo `Bun.serve`.
Reescribir los dos.

**b) Falta la ruta que sirve la web.** En el diagrama de la sección 2, agregar `/*` como
tercera ruta, después de `/graphql` y `/health`, sirviendo la aplicación bundleada.

**c) `envelop.ts` no existe**: esta iteración decidió no crearlo (ver "Decisiones tomadas al
planificar", punto 1). Dentro del diagrama de la sección 2, reemplazar:

    |     |                   +-- envelop.ts                         |
    |     |                         auditoria (futuro)               |
    |     |                         rate limiting                    |
    |     |                         cache de respuestas              |
    |     |                         enmascarado de errores           |

por:

    |     |                   +-- envelop.ts            (futuro)     |
    |     |                         auditoria                        |
    |     |                         rate limiting                    |
    |     |                         cache de respuestas              |

**d)** Y en la sección 4, agregar `politicas.ts` como `(futuro)` a la lista de `/dominio`, para que
el diagrama no prometa un archivo que la iteración 1 no crea.

```bash
grep -n "envelop.ts\|politicas.ts" docs/arquitectura.md
```

Esperado tras editar: ninguna pieza del diagrama existe sin estar marcada, y ninguna marcada
como presente falta en el repo.

- [ ] **Step 6: Verificar que todo el repo pasa**

```bash
bun run verificar
```

Esperado: PASA.

- [ ] **Step 7: Commit**

```bash
git add AGENT.md CLAUDE.md README.md docs/
git commit -m "docs: AGENT.md, tutorial de modulos, README y ajustes del mapa"
```

---

## Verificación final de la iteración

Con las diez tareas terminadas, esta secuencia demuestra el walking skeleton completo:

- [ ] `bun run verificar` pasa
- [ ] `bun run dev` levanta **un solo proceso** que sirve la web y `/graphql` en el 3000
- [ ] `docker compose up` levanta y `curl localhost:3000/health` responde `ok`
- [ ] `curl` a `/graphql` devuelve `{ version { numero entorno modulos } }` con `modulos: ["sistema"]`
- [ ] La web muestra la versión, y la sigue mostrando con la red cortada
- [ ] La app mobile muestra la versión, y la sigue mostrando en modo avión
- [ ] Agregar una línea suelta a `schema.gql` hace fallar la verificación
- [ ] Un import de `bun:sqlite` dentro de `packages/*/src/servidor/` hace fallar el lint
- [ ] Un import de `@gps/sistema/servidor` dentro de `apps/**` hace fallar el lint

Los últimos tres son los que importan a largo plazo: son las tres reglas que sostienen la arquitectura cuando el repo tenga ocho módulos.
