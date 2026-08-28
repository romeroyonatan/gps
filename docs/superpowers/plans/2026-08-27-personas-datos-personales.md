# Personas: datos personales — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar el módulo `personas` con los datos personales (tipo y número de documento, nombres, apellidos, fecha de nacimiento), la primera mutation del proyecto y las pantallas de lista y alta en web y mobile.

**Architecture:** Un paquete `packages/personas` con la forma que ya tiene `packages/estructura`: `/dominio` con el catálogo de documentos, el modelo y las validaciones puras; `/servidor` con la tabla, las migraciones, el servicio y el esquema de GraphQL. Las validaciones se comparten entre el formulario y el servicio, que es lo que evita dos implementaciones que se desincronizan. La fecha de nacimiento es texto `aaaa-mm-dd`, no un instante.

**Tech Stack:** Bun, TypeScript, Drizzle sobre SQLite, Pothos + GraphQL Yoga, TanStack Query, React 19, Tailwind 4, wouter (nuevo), Expo Router + NativeWind, Biome.

**Spec:** `docs/superpowers/specs/2026-08-27-personas-datos-personales-design.md`

## Global Constraints

Todo lo de `AGENT.md` (`CLAUDE.md` es un symlink al mismo archivo) aplica a cada tarea. Lo que más se toca acá:

- **Idioma.** Español para lo que nombra el escultismo y las reglas de negocio: modelos, campos de GraphQL, nombres de tests, comentarios. Inglés para el vocabulario técnico de industria (`module`, `index`, `schema`, `context`, `config`) y para los archivos canónicos (`package.json`, `schema.gql`, `tsconfig.json`).
- **Los comentarios del código van sin tildes.** Es el estilo del repo: `// Cada modulo genera sus migraciones`, no `// módulo`. Los textos que ve el usuario (mensajes de error, JSX, docs markdown) sí llevan tildes.
- **Portabilidad.** Nada de `bun:*` ni `node:*` bajo `packages/*/src/**` (los tests sí pueden: están fuera de `src/`). Bajo `packages/*/src/servidor/**` además están prohibidos `new Date()` sin argumentos, `Date.now()` y `crypto.randomUUID()`, por `biome-plugins/portabilidad.grit`. El reloj es `core.reloj.ahora()` y los ids son `core.nuevoId(prefijo)`. `new Date(valoresExplicitos)` **sí** está permitido: no consulta el reloj.
- **Fronteras de imports.** `apps/**` no puede importar `@gps/*/servidor`. Los módulos no se importan entre sí; `@gps/core` sí se puede importar desde cualquiera. `packages/demo` está exceptuado de la segunda regla.
- **Mobile-first.** Todo se diseña primero a 375px. `sm:` y `md:` sólo agregan en pantallas grandes.
- **Formato de Biome:** comillas simples, sin punto y coma, ancho de línea 100, indentación de 2 espacios. `bun run format` lo arregla solo.
- **Tests con `bun:test`**, en `test/` al lado de `src/`. Los relojes falsos se fijan en epoch 1970 (`new Date('1970-01-01T00:00:00Z')`) para que una hora del sistema colada se distinga de un vistazo. Los ids falsos son `(prefijo) => \`${prefijo}_${++contador}\``.
- **Verificación:** `bun run check` corre lint + tipos + tests. Es lo que corre CI.

## File Structure

Nuevos:

    packages/core/src/marcas.ts                    el tipo Marcas, que hoy declara estructura
    packages/personas/package.json                 el paquete
    packages/personas/tsconfig.json
    packages/personas/drizzle.config.ts            apunta a src/servidor/tablas.ts
    packages/personas/src/dominio/documentos.ts    catalogo de tipos + normalizarNumero
    packages/personas/src/dominio/modelos.ts       Persona, DatosDePersona, nombreCompleto, calcularEdad
    packages/personas/src/dominio/validaciones.ts  Problema, validarPersona
    packages/personas/src/dominio/index.ts         el entry point publico de /dominio
    packages/personas/src/servidor/tablas.ts       la tabla personas
    packages/personas/src/servidor/sql.d.ts        declaracion para importar .sql como texto
    packages/personas/src/servidor/migraciones.ts  la lista de migraciones del modulo
    packages/personas/src/servidor/servicio.ts     ServicioDePersonas + los errores de dominio
    packages/personas/src/servidor/schema.ts       enum, tipo, input, query y mutation
    packages/personas/src/servidor/index.ts        el objeto Module
    packages/personas/migraciones/0000_inicial.sql generado por drizzle-kit
    packages/api/src/personas.ts                   usePersonas, useCrearPersona
    packages/api/src/queries/personas.graphql
    packages/api/src/queries/crearPersona.graphql
    apps/web/src/pantallas/Estructura.tsx          lo que hoy vive en App.tsx
    apps/web/src/pantallas/Personas.tsx            lista + formulario
    apps/mobile/app/personas.tsx                   la segunda ruta

Modificados:

    packages/core/src/index.ts                     exporta Marcas
    packages/core/src/builder.ts                   suma mutationType
    packages/estructura/src/dominio/modelos.ts     importa Marcas de core en vez de declararla
    packages/estructura/src/dominio/index.ts       deja de re-exportar Marcas
    services/backend/src/modules.ts                registra personas
    services/backend/package.json                  dependencia de @gps/personas
    packages/demo/package.json                     dependencia de @gps/personas
    packages/demo/src/servidor/escenario.ts        siembra personas
    packages/demo/test/escenario.test.ts           monta tambien el modulo personas
    packages/api/src/index.ts                      exporta los hooks nuevos
    apps/web/package.json                          wouter y @gps/personas
    apps/web/src/App.tsx                           pasa a ser el layout con navegacion
    apps/mobile/package.json                       @gps/personas
    apps/mobile/app/index.tsx                      link a personas
    schema.gql                                     regenerado

---

### Task 1: `Marcas` sube a `packages/core`

`personas` necesita `Marcas` y no puede tomarla de `estructura`: los módulos no se importan entre sí. Sube a `core`, que es la excepción explícita de esa regla.

**Files:**
- Create: `packages/core/src/marcas.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/estructura/src/dominio/modelos.ts:1-9`
- Modify: `packages/estructura/src/dominio/index.ts:1`

**Interfaces:**
- Consumes: nada.
- Produces: `import type { Marcas } from '@gps/core'` con `{ readonly creadoEn: Date; readonly actualizadoEn: Date }`. Lo usan las tareas 3 y 5.

Esta tarea no lleva test propio: es un movimiento de un tipo, sin comportamiento en runtime. Lo que verifica que salió bien es el compilador (`bun run compile`) más los 68 tests que ya existen, que tienen que seguir pasando sin tocarlos.

- [ ] **Step 1: Crear el archivo en core**

`packages/core/src/marcas.ts`:

```ts
/** Cuando se creo y cuando se toco por ultima vez. Las escribe el servicio de
 *  cada modulo con core.reloj.ahora(), nunca la base: ver la regla de
 *  portabilidad en AGENT.md.
 *
 *  Vive en core y no en un modulo porque la necesitan todos, y los modulos no
 *  se pueden importar entre si. Es la forma del dato, que cruza hasta las
 *  pantallas; como se guarda -las columnas de Drizzle- sigue siendo decision de
 *  cada modulo, en su propio tablas.ts. */
export interface Marcas {
  readonly creadoEn: Date
  readonly actualizadoEn: Date
}
```

- [ ] **Step 2: Exportarla desde el índice de core**

En `packages/core/src/index.ts`, agregar la línea en su lugar alfabético (Biome ordena los exports):

```ts
export type { Marcas } from './marcas'
```

El archivo queda así:

```ts
export type { Actor, Alcance, Rol, RolConAmbito } from './actor'
export type { Builder } from './builder'
export { crearBuilder } from './builder'
export type { Context } from './context'
export type { Bd, Config, Core, Entorno, Logger, Reloj } from './core'
export type { Marcas } from './marcas'
export type { Migracion } from './migraciones'
export { aplicarMigraciones } from './migraciones'
export type { Module } from './module'
export { CicloDeDependencias, DependenciaFaltante, ordenarModulos } from './registry'
```

- [ ] **Step 3: Que estructura la importe en vez de declararla**

En `packages/estructura/src/dominio/modelos.ts`, borrar el bloque de `Marcas` (las líneas 1-9, desde `import type { Rama }` hasta el cierre de la interfaz) y dejar arriba:

```ts
import type { Marcas } from '@gps/core'
import type { Rama } from './ramas'
```

El resto del archivo (`Distrito extends Marcas`, `Grupo extends Marcas`, `GrupoConRamas`, `DistritoConGrupos`) no cambia.

- [ ] **Step 4: Sacarla del entry point de estructura**

`packages/estructura/src/dominio/index.ts` línea 1, sacar `Marcas` de la lista:

```ts
export type { Distrito, DistritoConGrupos, Grupo, GrupoConRamas } from './modelos'
```

Nadie fuera del módulo la importaba, así que no rompe a ningún consumidor. Verificalo antes de seguir:

```bash
grep -rn "Marcas" packages apps services --include="*.ts" --include="*.tsx" | grep -v node_modules
```

Esperado: sólo `packages/core/src/marcas.ts`, `packages/core/src/index.ts` y los dos `extends Marcas` de `packages/estructura/src/dominio/modelos.ts`.

- [ ] **Step 5: Correr el check completo**

Run: `bun run check`
Expected: lint limpio, todos los paquetes compilan, 68 tests pasan.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/marcas.ts packages/core/src/index.ts packages/estructura/src/dominio/
git commit -m "refactor(core): Marcas sube a core, que es de donde la puede tomar cualquier modulo"
```

---

### Task 2: El paquete `personas` y el catálogo de documentos

**Files:**
- Create: `packages/personas/package.json`
- Create: `packages/personas/tsconfig.json`
- Create: `packages/personas/drizzle.config.ts`
- Create: `packages/personas/src/dominio/documentos.ts`
- Create: `packages/personas/src/dominio/index.ts`
- Test: `packages/personas/test/documentos.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `TIPOS_DE_DOCUMENTO` (tupla `as const` de `{ id, nombre }`), `type TipoDeDocumento = 'dni' | 'pasaporte'`, `nombreDelTipo(tipo: TipoDeDocumento): string`, `normalizarNumero(numero: string): string`. Los usan las tareas 3, 4, 5, 6, 7, 10 y 11.

- [ ] **Step 1: Crear el esqueleto del paquete**

`packages/personas/package.json` — copiado de `packages/estructura/package.json`, con el nombre cambiado y `graphql` agregado (la tarea 7 lo necesita para traducir errores de dominio a `GraphQLError`; `estructura` no lo tiene porque no tira nada):

```json
{
  "name": "@gps/personas",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    "./dominio": "./src/dominio/index.ts",
    "./servidor": "./src/servidor/index.ts"
  },
  "scripts": {
    "compile": "tsc --noEmit"
  },
  "dependencies": {
    "@gps/core": "workspace:*",
    "drizzle-orm": "^0.45.2",
    "graphql": "^16.9.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "drizzle-kit": "^0.31.10",
    "typescript": "^5.7.0"
  }
}
```

`packages/personas/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "test"]
}
```

`packages/personas/drizzle.config.ts`:

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

- [ ] **Step 2: Instalar, para que el workspace conozca el paquete nuevo**

Run: `bun install`
Expected: `bun.lock` se actualiza con `@gps/personas`. Sin este paso, `@gps/personas` no resuelve desde ningún otro paquete.

- [ ] **Step 3: Escribir el test que falla**

`packages/personas/test/documentos.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import { nombreDelTipo, normalizarNumero, TIPOS_DE_DOCUMENTO } from '../src/dominio/documentos'

describe('catalogo TIPOS_DE_DOCUMENTO', () => {
  test('tiene DNI y pasaporte, en ese orden', () => {
    expect(TIPOS_DE_DOCUMENTO.map((tipo) => tipo.id)).toEqual(['dni', 'pasaporte'])
  })
})

describe('nombreDelTipo', () => {
  test('devuelve la etiqueta que muestra la pantalla', () => {
    expect(nombreDelTipo('dni')).toBe('DNI')
    expect(nombreDelTipo('pasaporte')).toBe('Pasaporte')
  })
})

describe('normalizarNumero', () => {
  test('un DNI con puntos y uno sin puntos son el mismo numero', () => {
    // Es la razon de ser de la funcion: sin esto, el UNIQUE de (tipo, numero) no
    // impide cargar dos veces a la misma persona, que es para lo que existe.
    expect(normalizarNumero('30.111.222')).toBe(normalizarNumero('30111222'))
  })

  test('saca puntos, espacios y guiones', () => {
    expect(normalizarNumero(' 30.111-222 ')).toBe('30111222')
  })

  test('pasa a mayusculas, que es lo que importa en un pasaporte', () => {
    expect(normalizarNumero('ab123456')).toBe('AB123456')
  })

  test('un numero ya limpio no cambia', () => {
    expect(normalizarNumero('30111222')).toBe('30111222')
  })
})
```

- [ ] **Step 4: Correr el test y verificar que falla**

Run: `bun test packages/personas/test/documentos.test.ts`
Expected: FAIL — `Cannot find module '../src/dominio/documentos'`.

- [ ] **Step 5: Escribir el catálogo**

`packages/personas/src/dominio/documentos.ts`:

```ts
/** Los tipos de documento que la asociacion acepta. Es un conjunto cerrado, por
 *  eso es una constante y no una tabla: no hay siembra ni migracion que
 *  mantener, y al vivir en /dominio la comparten el servidor y las pantallas
 *  sin una tabla de traduccion en el medio.
 *
 *  Dos y no cinco: Libreta Civica y Libreta de Enrolamiento solo las tiene quien
 *  nacio antes de 1969, y la cedula aparece en zona de frontera. Ninguna tiene
 *  hoy una persona real detras.
 *
 *  Agregar un tipo es cambio solo de codigo. Sacar o renombrar uno NO lo es: la
 *  tabla personas sigue guardando el id viejo. Hay que migrar los datos en la
 *  misma entrega. */
export const TIPOS_DE_DOCUMENTO = [
  { id: 'dni', nombre: 'DNI' },
  { id: 'pasaporte', nombre: 'Pasaporte' },
] as const

export type TipoDeDocumento = (typeof TIPOS_DE_DOCUMENTO)[number]['id']

/** Como la pantalla nombra el tipo. Vive en el dominio y no en cada pantalla por
 *  la misma razon que etiquetaDeEdades en estructura: es presentacion del
 *  dominio, y dos copias divergen sin que nadie se entere. */
export function nombreDelTipo(tipo: TipoDeDocumento): string {
  return TIPOS_DE_DOCUMENTO.find((candidato) => candidato.id === tipo)?.nombre ?? tipo
}

/** Saca puntos, espacios y guiones, y pasa a mayusculas. Se aplica al guardar,
 *  nunca al leer.
 *
 *  No es cosmetica: es lo que hace que el UNIQUE de (tipo, numero) signifique
 *  algo. Sin esto "30.111.222" y "30111222" entran como dos personas distintas
 *  y el indice no se entera, que es justo el caso que existe para impedir:
 *  quien carga la segunda es alguien que no encontro a la primera al buscarla
 *  escrita de la otra forma. */
export function normalizarNumero(numero: string): string {
  return numero.replace(/[\s.-]/g, '').toUpperCase()
}
```

- [ ] **Step 6: Escribir el entry point de `/dominio`**

`packages/personas/src/dominio/index.ts` (va a crecer en las tareas 3 y 4):

```ts
export type { TipoDeDocumento } from './documentos'
export { nombreDelTipo, normalizarNumero, TIPOS_DE_DOCUMENTO } from './documentos'
```

- [ ] **Step 7: Correr el test y verificar que pasa**

Run: `bun test packages/personas/test/documentos.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 8: Commit**

```bash
git add packages/personas bun.lock
git commit -m "feat(personas): el paquete y el catalogo de tipos de documento"
```

---

### Task 3: El modelo, `nombreCompleto` y `calcularEdad`

**Files:**
- Create: `packages/personas/src/dominio/modelos.ts`
- Modify: `packages/personas/src/dominio/index.ts`
- Test: `packages/personas/test/modelos.test.ts`

**Interfaces:**
- Consumes: `TipoDeDocumento` de `./documentos` (tarea 2), `Marcas` de `@gps/core` (tarea 1).
- Produces: `interface Persona extends Marcas` con `id`, `tipoDeDocumento`, `numeroDeDocumento`, `nombres`, `apellidos`, `fechaDeNacimiento: string`; `type DatosDePersona = Omit<Persona, 'id' | keyof Marcas>`; `nombreCompleto(persona: Pick<Persona, 'nombres' | 'apellidos'>): string`; `calcularEdad(fechaDeNacimiento: string, hoy: Date): number`. Los usan las tareas 4, 5, 6, 7, 8, 10 y 11.

- [ ] **Step 1: Escribir el test que falla**

`packages/personas/test/modelos.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import { calcularEdad, nombreCompleto } from '../src/dominio/modelos'

// Las fechas se construyen con componentes locales y no con una cadena ISO para
// que el resultado no dependa de la zona horaria de quien corre los tests: una
// fecha de nacimiento es una fecha de calendario, no un instante. El mes va
// 0-indexado, asi que 7 es agosto.
const HOY = new Date(2026, 7, 27)

describe('nombreCompleto', () => {
  test('los apellidos primero, que es como se lista', () => {
    expect(nombreCompleto({ nombres: 'María Luz', apellidos: 'Fernández Ruiz' })).toBe(
      'Fernández Ruiz, María Luz',
    )
  })
})

describe('calcularEdad', () => {
  test('cuenta los anios cumplidos', () => {
    expect(calcularEdad('2010-05-01', HOY)).toBe(16)
  })

  test('si todavia no cumplio este anio, resta uno', () => {
    expect(calcularEdad('2010-12-01', HOY)).toBe(15)
  })

  test('el dia del cumpleanios ya cuenta', () => {
    expect(calcularEdad('2010-08-27', HOY)).toBe(16)
  })

  test('la vispera todavia no', () => {
    expect(calcularEdad('2010-08-28', HOY)).toBe(15)
  })

  test('quien nacio hoy tiene cero, no uno', () => {
    expect(calcularEdad('2026-08-27', HOY)).toBe(0)
  })

  test('una fecha futura da negativo, que es de lo que se agarra la validacion', () => {
    expect(calcularEdad('2026-08-28', HOY)).toBe(-1)
    expect(calcularEdad('2027-01-01', HOY)).toBe(-1)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `bun test packages/personas/test/modelos.test.ts`
Expected: FAIL — `Cannot find module '../src/dominio/modelos'`.

- [ ] **Step 3: Escribir el modelo**

`packages/personas/src/dominio/modelos.ts`:

```ts
import type { Marcas } from '@gps/core'
import type { TipoDeDocumento } from './documentos'

/** Una persona de la asociacion. Por ahora solo los datos personales: la
 *  pertenencia a un grupo y los cargos llegan con la iteracion que los tenga
 *  que mostrar, y viven en estructura, que es la jerarquia que se llena. */
export interface Persona extends Marcas {
  readonly id: string
  readonly tipoDeDocumento: TipoDeDocumento
  readonly numeroDeDocumento: string
  /** En plural y como texto libre: una persona tiene los que tiene. Van en dos
   *  campos y no en uno porque el listado ordena por apellido, y partir un
   *  nombre completo con heuristicas falla con "de la Vega" y "Van Der Berg". */
  readonly nombres: string
  readonly apellidos: string
  /** ISO 8601 sin hora: "2010-05-01".
   *
   *  Texto y no Date a proposito. Una fecha de nacimiento no tiene hora, y
   *  guardarla como instante la ata a una zona horaria: quien nacio el 1 de
   *  mayo aparece como 30 de abril en UTC-3. Como texto el problema no existe,
   *  se ordena igual lexicografica que cronologicamente, y es exactamente lo
   *  que emite y espera un <input type="date">. */
  readonly fechaDeNacimiento: string
}

/** Lo que entra por el alta: la Persona sin lo que pone el servidor. Derivarlo
 *  de Persona en vez de escribirlo aparte es lo que hace que agregar un campo en
 *  la iteracion que viene no se olvide en la mitad de los lugares. */
export type DatosDePersona = Omit<Persona, 'id' | keyof Marcas>

/** Como la pantalla arma el nombre para una lista. Toma lo minimo y no una
 *  Persona entera para que sirva sobre lo que devuelve una query de GraphQL, que
 *  trae solo los campos que se pidieron. */
export function nombreCompleto(persona: Pick<Persona, 'nombres' | 'apellidos'>): string {
  return `${persona.apellidos}, ${persona.nombres}`
}

/** Los anios cumplidos al dia `hoy`.
 *
 *  `hoy` entra por parametro y no se lee del sistema: es la regla de
 *  portabilidad, y ademas permite que los tests afirmen sobre bordes exactos -el
 *  dia del cumpleanios, la vispera- en vez de sobre rangos.
 *
 *  Toma la fecha y no la persona para que el formulario pueda mostrar la edad
 *  mientras se tipea, cuando todavia no hay ninguna Persona creada.
 *
 *  Se compara contra los componentes locales de `hoy` porque la fecha de
 *  nacimiento es una fecha de calendario: el cumpleanios es hoy segun el
 *  almanaque de quien mira, no segun UTC. */
export function calcularEdad(fechaDeNacimiento: string, hoy: Date): number {
  const [anio = 0, mes = 0, dia = 0] = fechaDeNacimiento.split('-').map(Number)
  const mesDeHoy = hoy.getMonth() + 1
  const yaCumplio = mesDeHoy > mes || (mesDeHoy === mes && hoy.getDate() >= dia)
  return hoy.getFullYear() - anio - (yaCumplio ? 0 : 1)
}
```

Nota sobre `const [anio = 0, mes = 0, dia = 0]`: los defaults no son decorativos. `tsconfig.base.json` tiene `noUncheckedIndexedAccess: true`, así que desestructurar un arreglo da `number | undefined` y sin los defaults no compila.

- [ ] **Step 4: Sumarlo al entry point**

`packages/personas/src/dominio/index.ts`:

```ts
export type { TipoDeDocumento } from './documentos'
export { nombreDelTipo, normalizarNumero, TIPOS_DE_DOCUMENTO } from './documentos'
export type { DatosDePersona, Persona } from './modelos'
export { calcularEdad, nombreCompleto } from './modelos'
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `bun test packages/personas/test/modelos.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/personas
git commit -m "feat(personas): el modelo, nombreCompleto y calcularEdad"
```

---

### Task 4: Las validaciones

**Files:**
- Create: `packages/personas/src/dominio/validaciones.ts`
- Modify: `packages/personas/src/dominio/index.ts`
- Test: `packages/personas/test/validaciones.test.ts`

**Interfaces:**
- Consumes: `normalizarNumero` de `./documentos`, `calcularEdad` y `DatosDePersona` de `./modelos`.
- Produces: `interface Problema { readonly campo: 'numeroDeDocumento' | 'nombres' | 'apellidos' | 'fechaDeNacimiento'; readonly mensaje: string }` y `validarPersona(datos: DatosDePersona, hoy: Date): readonly Problema[]`. Los usan las tareas 6, 7, 10 y 11.

- [ ] **Step 1: Escribir el test que falla**

`packages/personas/test/validaciones.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import type { DatosDePersona } from '../src/dominio/modelos'
import { validarPersona } from '../src/dominio/validaciones'

const HOY = new Date(2026, 7, 27)

/** Una persona valida. Cada test la rompe en un solo campo, para que sea obvio
 *  cual es la regla que se esta probando. */
const valida: DatosDePersona = {
  tipoDeDocumento: 'dni',
  numeroDeDocumento: '30111222',
  nombres: 'María Luz',
  apellidos: 'Fernández Ruiz',
  fechaDeNacimiento: '2010-05-01',
}

const campos = (datos: DatosDePersona) =>
  validarPersona(datos, HOY).map((problema) => problema.campo)

describe('validarPersona', () => {
  test('una persona valida no tiene problemas', () => {
    expect(validarPersona(valida, HOY)).toEqual([])
  })

  test('los nombres no pueden estar vacios ni ser solo espacios', () => {
    expect(campos({ ...valida, nombres: '' })).toEqual(['nombres'])
    expect(campos({ ...valida, nombres: '   ' })).toEqual(['nombres'])
  })

  test('los apellidos tampoco', () => {
    expect(campos({ ...valida, apellidos: '' })).toEqual(['apellidos'])
  })

  test('acumula todos los problemas, no corta en el primero', () => {
    // El formulario marca todos los campos que fallan de una: obligar a
    // corregir de a uno y reenviar es la peor version de esto.
    expect(campos({ ...valida, nombres: '', apellidos: '', numeroDeDocumento: '' })).toEqual([
      'nombres',
      'apellidos',
      'numeroDeDocumento',
    ])
  })

  test('un DNI con puntos es valido: se valida ya normalizado', () => {
    // Si se validara el texto crudo, los puntos harian fallar el formato y el
    // usuario veria un error por escribir el DNI como lo escribe todo el mundo.
    expect(validarPersona({ ...valida, numeroDeDocumento: '30.111.222' }, HOY)).toEqual([])
  })

  test('un DNI tiene 7 u 8 digitos', () => {
    expect(validarPersona({ ...valida, numeroDeDocumento: '1234567' }, HOY)).toEqual([])
    expect(campos({ ...valida, numeroDeDocumento: '123456' })).toEqual(['numeroDeDocumento'])
    expect(campos({ ...valida, numeroDeDocumento: '123456789' })).toEqual(['numeroDeDocumento'])
    expect(campos({ ...valida, numeroDeDocumento: 'AB123456' })).toEqual(['numeroDeDocumento'])
  })

  test('un pasaporte es alfanumerico de 5 a 15', () => {
    const pasaporte = { ...valida, tipoDeDocumento: 'pasaporte' } as const
    expect(validarPersona({ ...pasaporte, numeroDeDocumento: 'ab12345' }, HOY)).toEqual([])
    expect(campos({ ...pasaporte, numeroDeDocumento: 'AB12' })).toEqual(['numeroDeDocumento'])
    expect(campos({ ...pasaporte, numeroDeDocumento: 'AB/12345' })).toEqual(['numeroDeDocumento'])
  })

  test('el numero de documento no puede estar vacio', () => {
    expect(campos({ ...valida, numeroDeDocumento: '' })).toEqual(['numeroDeDocumento'])
    expect(campos({ ...valida, numeroDeDocumento: '...' })).toEqual(['numeroDeDocumento'])
  })

  test('la fecha tiene que tener el formato aaaa-mm-dd', () => {
    expect(campos({ ...valida, fechaDeNacimiento: '01/05/2010' })).toEqual(['fechaDeNacimiento'])
    expect(campos({ ...valida, fechaDeNacimiento: '2010-5-1' })).toEqual(['fechaDeNacimiento'])
    expect(campos({ ...valida, fechaDeNacimiento: '' })).toEqual(['fechaDeNacimiento'])
  })

  test('la fecha tiene que existir en el almanaque', () => {
    // Con solo mirar el formato, "2010-02-30" pasaria: tiene cuatro digitos,
    // dos y dos. El 30 de febrero no existe.
    expect(campos({ ...valida, fechaDeNacimiento: '2010-02-30' })).toEqual(['fechaDeNacimiento'])
    expect(campos({ ...valida, fechaDeNacimiento: '2010-13-01' })).toEqual(['fechaDeNacimiento'])
  })

  test('el 29 de febrero de un anio bisiesto si existe', () => {
    expect(validarPersona({ ...valida, fechaDeNacimiento: '2012-02-29' }, HOY)).toEqual([])
    expect(campos({ ...valida, fechaDeNacimiento: '2011-02-29' })).toEqual(['fechaDeNacimiento'])
  })

  test('la fecha de nacimiento no puede ser futura', () => {
    expect(campos({ ...valida, fechaDeNacimiento: '2026-08-28' })).toEqual(['fechaDeNacimiento'])
  })

  test('nacer hoy es valido', () => {
    expect(validarPersona({ ...valida, fechaDeNacimiento: '2026-08-27' }, HOY)).toEqual([])
  })

  test('no se aceptan mas de 120 anios, que es el tope contra el dedazo', () => {
    expect(validarPersona({ ...valida, fechaDeNacimiento: '1906-08-27' }, HOY)).toEqual([])
    expect(campos({ ...valida, fechaDeNacimiento: '1025-08-27' })).toEqual(['fechaDeNacimiento'])
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `bun test packages/personas/test/validaciones.test.ts`
Expected: FAIL — `Cannot find module '../src/dominio/validaciones'`.

- [ ] **Step 3: Escribir las validaciones**

`packages/personas/src/dominio/validaciones.ts`:

```ts
import { normalizarNumero } from './documentos'
import { calcularEdad, type DatosDePersona } from './modelos'

/** Un problema de validacion, atado a su campo. Por campo y no una lista de
 *  strings sueltos porque el formulario tiene que marcar el input que falla: un
 *  cartel generico arriba obliga a leer y adivinar cual de los cuatro era.
 *
 *  tipoDeDocumento no esta en la union porque no puede fallar: lo garantizan el
 *  tipo TipoDeDocumento del lado de TypeScript y el enum del lado de GraphQL. */
export interface Problema {
  readonly campo: 'numeroDeDocumento' | 'nombres' | 'apellidos' | 'fechaDeNacimiento'
  readonly mensaje: string
}

/** Nadie vivo tiene mas. Es un tope contra el dedazo -escribir 1025 en vez de
 *  2025-, no una afirmacion biologica. */
const MAXIMA_EDAD = 120

const FORMATO = {
  dni: { expresion: /^\d{7,8}$/, esperado: 'Un DNI tiene 7 u 8 dígitos.' },
  pasaporte: {
    expresion: /^[A-Z0-9]{5,15}$/,
    esperado: 'Un pasaporte tiene entre 5 y 15 caracteres alfanuméricos.',
  },
} as const

/** Que la cadena sea una fecha real del almanaque, y no solo que tenga la forma.
 *  Sin el ida y vuelta por Date, "2010-02-30" pasaria la expresion regular.
 *
 *  `new Date(...)` con valores explicitos es determinista y no consulta el
 *  reloj, asi que no toca la regla de portabilidad -y este archivo vive en
 *  /dominio, donde ni siquiera aplica el plugin. */
function esFechaDeCalendario(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false
  const [anio = 0, mes = 0, dia = 0] = texto.split('-').map(Number)
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  return (
    fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
  )
}

/** Las reglas que tiene que cumplir el alta de una persona. Devuelve la lista de
 *  problemas, vacia si esta todo bien. Acumula: no corta en el primero.
 *
 *  Es pura y vive en /dominio porque corre en los dos lados. El formulario la
 *  usa antes de enviar, y eso es la experiencia de uso; el servicio la usa antes
 *  de guardar, y eso es la garantia. No hay dos implementaciones que se puedan
 *  desincronizar, que es el pago de que /dominio sea isomorfo.
 *
 *  `hoy` entra por parametro: la funcion no consulta el reloj. */
export function validarPersona(datos: DatosDePersona, hoy: Date): readonly Problema[] {
  const problemas: Problema[] = []

  if (!datos.nombres.trim()) {
    problemas.push({ campo: 'nombres', mensaje: 'Los nombres no pueden estar vacíos.' })
  }
  if (!datos.apellidos.trim()) {
    problemas.push({ campo: 'apellidos', mensaje: 'Los apellidos no pueden estar vacíos.' })
  }

  // Se valida el numero ya normalizado, que es como se va a guardar: si no, un
  // DNI escrito con puntos -como lo escribe todo el mundo- daria invalido.
  const numero = normalizarNumero(datos.numeroDeDocumento)
  const formato = FORMATO[datos.tipoDeDocumento]
  if (!numero) {
    problemas.push({
      campo: 'numeroDeDocumento',
      mensaje: 'El número de documento no puede estar vacío.',
    })
  } else if (!formato.expresion.test(numero)) {
    problemas.push({ campo: 'numeroDeDocumento', mensaje: formato.esperado })
  }

  if (!esFechaDeCalendario(datos.fechaDeNacimiento)) {
    problemas.push({
      campo: 'fechaDeNacimiento',
      mensaje: 'La fecha de nacimiento tiene que ser una fecha real, con formato aaaa-mm-dd.',
    })
  } else {
    const edad = calcularEdad(datos.fechaDeNacimiento, hoy)
    if (edad < 0) {
      problemas.push({
        campo: 'fechaDeNacimiento',
        mensaje: 'La fecha de nacimiento no puede ser futura.',
      })
    } else if (edad > MAXIMA_EDAD) {
      problemas.push({
        campo: 'fechaDeNacimiento',
        mensaje: `La fecha de nacimiento es de hace más de ${MAXIMA_EDAD} años.`,
      })
    }
  }

  return problemas
}
```

- [ ] **Step 4: Sumarlo al entry point**

`packages/personas/src/dominio/index.ts`:

```ts
export type { TipoDeDocumento } from './documentos'
export { nombreDelTipo, normalizarNumero, TIPOS_DE_DOCUMENTO } from './documentos'
export type { DatosDePersona, Persona } from './modelos'
export { calcularEdad, nombreCompleto } from './modelos'
export type { Problema } from './validaciones'
export { validarPersona } from './validaciones'
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `bun test packages/personas/`
Expected: PASS — 14 tests del archivo de validaciones más los 13 de las dos tareas anteriores.

- [ ] **Step 6: Commit**

```bash
git add packages/personas
git commit -m "feat(personas): validaciones puras, compartidas por el servicio y el formulario"
```

---

### Task 5: La tabla y la migración

**Files:**
- Create: `packages/personas/src/servidor/tablas.ts`
- Create: `packages/personas/src/servidor/sql.d.ts`
- Create: `packages/personas/src/servidor/migraciones.ts`
- Create: `packages/personas/migraciones/0000_inicial.sql` (lo genera drizzle-kit)
- Test: `packages/personas/test/migraciones.test.ts`

**Interfaces:**
- Consumes: `TipoDeDocumento` de `../dominio/documentos`.
- Produces: `personas` (la tabla de Drizzle, con columnas `id`, `tipoDeDocumento`, `numeroDeDocumento`, `nombres`, `apellidos`, `fechaDeNacimiento`, `creadoEn`, `actualizadoEn`) y `migraciones: readonly Migracion[]`. Los usan las tareas 6 y 7.

- [ ] **Step 1: Escribir la tabla**

`packages/personas/src/servidor/tablas.ts`:

```ts
import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import type { TipoDeDocumento } from '../dominio/documentos'

// Se esparce en cada tabla en vez de abstraerse en core: Drizzle necesita las
// columnas declaradas literalmente para poder inferir los tipos de las filas, y
// ademas como se guardan las marcas es decision de cada modulo. El tipo Marcas
// si vive en core: es la forma del dato, que cruza hasta las pantallas.
const marcas = {
  creadoEn: integer('creado_en', { mode: 'timestamp_ms' }).notNull(),
  actualizadoEn: integer('actualizado_en', { mode: 'timestamp_ms' }).notNull(),
}

/** Las personas de la asociacion.
 *
 *  El par (tipo, numero) es la clave natural: identifica a la persona para la
 *  asociacion. Va como UNIQUE y no como primaria porque las claves naturales se
 *  corrigen -un DNI mal tipeado- y eso arrastraria cada foreign key que apunte a
 *  la persona, que en la iteracion de pertenencia van a ser varias.
 *
 *  El UNIQUE es sobre el par y no sobre el numero solo: un DNI y un pasaporte
 *  pueden coincidir en el numero, son espacios de numeracion distintos. Lo que
 *  hace que el indice sirva es que el numero se guarda normalizado; ver
 *  normalizarNumero en dominio/documentos.ts.
 *
 *  fecha_de_nacimiento es TEXT con formato aaaa-mm-dd y no un timestamp: ver el
 *  comentario en dominio/modelos.ts. */
export const personas = sqliteTable(
  'personas',
  {
    id: text('id').primaryKey(),
    tipoDeDocumento: text('tipo_de_documento').$type<TipoDeDocumento>().notNull(),
    numeroDeDocumento: text('numero_de_documento').notNull(),
    nombres: text('nombres').notNull(),
    apellidos: text('apellidos').notNull(),
    fechaDeNacimiento: text('fecha_de_nacimiento').notNull(),
    ...marcas,
  },
  (tabla) => [unique().on(tabla.tipoDeDocumento, tabla.numeroDeDocumento)],
)
```

- [ ] **Step 2: Copiar la declaración de los `.sql`**

`packages/personas/src/servidor/sql.d.ts`, idéntico al de `estructura`:

```ts
/** Los .sql que genera drizzle-kit se importan como texto, no como modulo.
 *  Sin esta declaracion tsc no sabe que tipo tienen. */
declare module '*.sql' {
  const contenido: string
  export default contenido
}
```

- [ ] **Step 3: Generar la migración**

Run, parado en el paquete:

```bash
cd packages/personas && bunx drizzle-kit generate --name inicial && cd ../..
```

Expected: se crean `packages/personas/migraciones/0000_inicial.sql`, `migraciones/meta/_journal.json` y `migraciones/meta/0000_snapshot.json`.

Abrí el `.sql` y verificá que tenga la tabla y el índice único. Tiene que verse así (drizzle-kit nombra el índice solo):

```sql
CREATE TABLE `personas` (
	`id` text PRIMARY KEY NOT NULL,
	`tipo_de_documento` text NOT NULL,
	`numero_de_documento` text NOT NULL,
	`nombres` text NOT NULL,
	`apellidos` text NOT NULL,
	`fecha_de_nacimiento` text NOT NULL,
	`creado_en` integer NOT NULL,
	`actualizado_en` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `personas_tipo_de_documento_numero_de_documento_unique` ON `personas` (`tipo_de_documento`,`numero_de_documento`);
```

Si el nombre del índice sale distinto, no lo cambies: el nombre lo elige drizzle-kit y no lo usa nadie.

- [ ] **Step 4: Declarar la lista de migraciones**

`packages/personas/src/servidor/migraciones.ts`:

```ts
// La referencia es necesaria porque quien importa este archivo desde otro
// paquete (el backend, via @gps/personas/servidor) no incluye sql.d.ts en su
// propio tsconfig: sin esta linea tsc no sabe que tipo tiene el import de abajo
// fuera de este paquete.
/// <reference path="./sql.d.ts" />
import type { Migracion } from '@gps/core'
import inicial from '../../migraciones/0000_inicial.sql' with { type: 'text' }

/** Las migraciones del modulo, en orden. Agregar una es generarla con
 *  `bunx drizzle-kit generate --name <x>` y sumarle una linea a esta lista.
 *
 *  Ojo con `with { type: 'text' }`: es una extension de Bun que Metro no
 *  soporta. Es deuda conocida, la misma que tiene estructura; ver
 *  docs/crear-un-modulo.md. */
export const migraciones: readonly Migracion[] = [{ nombre: '0000_inicial', sql: inicial }]
```

- [ ] **Step 5: Escribir el test de la migración**

`packages/personas/test/migraciones.test.ts`:

```ts
import { Database } from 'bun:sqlite'
import { beforeEach, describe, expect, test } from 'bun:test'
import { aplicarMigraciones, type Bd, type Core, type Module } from '@gps/core'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migraciones } from '../src/servidor/migraciones'

const HORA = new Date('1970-01-01T00:00:00Z')

function coreDePrueba(bd: Bd): Core {
  return {
    config: { version: '0.0.0', entorno: 'prueba', puerto: 0 },
    logger: { info: () => {}, error: () => {} },
    reloj: { ahora: () => HORA },
    bd,
    modulos: ['personas'],
    nuevoId: (prefijo) => `${prefijo}_fijo`,
  }
}

const moduloFalso: Module<object> = {
  name: 'personas',
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

const insertar = (id: string, tipo: string, numero: string) =>
  bd.run(
    sql`INSERT INTO personas VALUES (${id}, ${tipo}, ${numero}, 'Ana', 'Perez', '2010-05-01', 0, 0)`,
  )

describe('migraciones de personas', () => {
  test('crea la tabla del modulo', () => {
    const nombres = bd
      .values<[string]>(sql`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`)
      .map(([nombre]) => nombre)
    expect(nombres).toEqual(['migraciones', 'personas'])
  })

  test('la fecha de nacimiento es texto, no un entero', () => {
    // Es la decision de dominio que mas facil se pierde en una migracion
    // regenerada sin mirar: si vuelve a ser integer, la fecha vuelve a ser un
    // instante y con el la zona horaria.
    const columnas = bd.all<{ name: string; type: string }>(sql`PRAGMA table_info(personas)`)
    // sqlite normaliza el tipo declarado ("text") a mayusculas en table_info.
    expect(columnas.find((columna) => columna.name === 'fecha_de_nacimiento')?.type).toBe('TEXT')
  })

  test('dos personas no pueden compartir tipo y numero de documento', () => {
    insertar('p1', 'dni', '30111222')
    expect(() => insertar('p2', 'dni', '30111222')).toThrow()
  })

  test('un DNI y un pasaporte si pueden compartir el numero', () => {
    // Son espacios de numeracion distintos: por eso el UNIQUE es sobre el par y
    // no sobre el numero solo.
    insertar('p1', 'dni', '30111222')
    expect(() => insertar('p2', 'pasaporte', '30111222')).not.toThrow()
  })

  test('aplica la migracion del modulo', () => {
    const aplicadas = bd
      .values<[string]>(sql`SELECT nombre FROM migraciones ORDER BY nombre`)
      .map(([nombre]) => nombre)
    expect(aplicadas).toEqual(['0000_inicial'])
  })
})
```

- [ ] **Step 6: Correr el test y verificar que pasa**

Run: `bun test packages/personas/test/migraciones.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 7: Commit**

```bash
git add packages/personas
git commit -m "feat(personas): la tabla y su migracion inicial"
```

---

### Task 6: El servicio

**Files:**
- Create: `packages/personas/src/servidor/servicio.ts`
- Test: `packages/personas/test/servicio.test.ts`

**Interfaces:**
- Consumes: `personas` de `./tablas`, `migraciones` de `./migraciones`, `normalizarNumero`/`nombreDelTipo`/`TipoDeDocumento` de `../dominio/documentos`, `DatosDePersona`/`Persona` de `../dominio/modelos`, `validarPersona`/`Problema` de `../dominio/validaciones`, `Core` de `@gps/core`.
- Produces: `interface ServicioDePersonas { crearPersona(datos: DatosDePersona): Promise<Persona>; listarPersonas(): Promise<readonly Persona[]> }`, `crearServicioDePersonas(core: Core): ServicioDePersonas`, y las clases `DatosInvalidos` (con `readonly problemas: readonly Problema[]`) y `DocumentoDuplicado`. Los usan las tareas 7 y 8.

- [ ] **Step 1: Escribir el test que falla**

`packages/personas/test/servicio.test.ts`:

```ts
import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { aplicarMigraciones, type Bd, type Core, type Module, type Reloj } from '@gps/core'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import type { DatosDePersona } from '../src/dominio/modelos'
import { migraciones } from '../src/servidor/migraciones'
import {
  crearServicioDePersonas,
  DatosInvalidos,
  DocumentoDuplicado,
  type ServicioDePersonas,
} from '../src/servidor/servicio'

const HORA = new Date('1970-01-01T00:00:00Z')

/** Un servicio con la base migrada y un Core de ids fijos, para poder afirmar
 *  valores exactos. El reloj se fija en epoch 1970 para que una hora del sistema
 *  colada se distinga de un vistazo en vez de parecer plausible. */
function montar(reloj: Reloj = { ahora: () => HORA }): ServicioDePersonas {
  const base = new Database(':memory:')
  base.exec('PRAGMA foreign_keys = ON')
  const bd: Bd = drizzle(base)

  let contador = 0
  const core: Core = {
    config: { version: '0.0.0', entorno: 'prueba', puerto: 0 },
    logger: { info: () => {}, error: () => {} },
    reloj,
    bd,
    modulos: ['personas'],
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
  return crearServicioDePersonas(core)
}

/** El reloj de los tests esta en 1970, asi que una fecha de nacimiento valida
 *  tiene que ser anterior a esa. Es incomodo y es a proposito: obliga a que se
 *  note si alguien se cuelga la hora real. */
const valida: DatosDePersona = {
  tipoDeDocumento: 'dni',
  numeroDeDocumento: '30111222',
  nombres: 'María Luz',
  apellidos: 'Fernández Ruiz',
  fechaDeNacimiento: '1950-05-01',
}

describe('crearPersona', () => {
  test('devuelve la persona con el id y las marcas que da Core', async () => {
    expect(await montar().crearPersona(valida)).toEqual({
      id: 'persona_1',
      tipoDeDocumento: 'dni',
      numeroDeDocumento: '30111222',
      nombres: 'María Luz',
      apellidos: 'Fernández Ruiz',
      fechaDeNacimiento: '1950-05-01',
      creadoEn: HORA,
      actualizadoEn: HORA,
    })
  })

  test('guarda el numero de documento normalizado', async () => {
    // Sin esto el UNIQUE no sirve: "30.111.222" y "30111222" entrarian como dos
    // personas distintas.
    const servicio = montar()
    const persona = await servicio.crearPersona({ ...valida, numeroDeDocumento: '30.111.222' })
    expect(persona.numeroDeDocumento).toBe('30111222')
  })

  test('recorta los espacios de nombres y apellidos', async () => {
    const persona = await montar().crearPersona({
      ...valida,
      nombres: '  Ana  ',
      apellidos: '  Pérez  ',
    })
    expect(persona.nombres).toBe('Ana')
    expect(persona.apellidos).toBe('Pérez')
  })

  test('rechaza datos invalidos con los problemas adentro', async () => {
    const servicio = montar()
    expect(servicio.crearPersona({ ...valida, nombres: '' })).rejects.toBeInstanceOf(DatosInvalidos)

    // El servicio corre las mismas validaciones que el formulario: es la
    // garantia, no la experiencia de uso.
    try {
      await servicio.crearPersona({ ...valida, nombres: '', numeroDeDocumento: '1' })
      throw new Error('tendria que haber fallado')
    } catch (error) {
      expect(error).toBeInstanceOf(DatosInvalidos)
      expect((error as DatosInvalidos).problemas.map((problema) => problema.campo)).toEqual([
        'nombres',
        'numeroDeDocumento',
      ])
    }
  })

  test('nada invalido llega a la base', async () => {
    const servicio = montar()
    await servicio.crearPersona(valida).catch(() => {})
    await servicio.crearPersona({ ...valida, nombres: '' }).catch(() => {})
    expect(await servicio.listarPersonas()).toHaveLength(1)
  })

  test('el mismo documento dos veces falla con un mensaje que se puede mostrar', async () => {
    // Lo que garantiza la unicidad es el UNIQUE de la tabla; este error existe
    // para que el formulario tenga algo legible que mostrar en vez del texto
    // crudo de SQLite.
    const servicio = montar()
    await servicio.crearPersona(valida)
    try {
      await servicio.crearPersona({ ...valida, nombres: 'Otra' })
      throw new Error('tendria que haber fallado')
    } catch (error) {
      expect(error).toBeInstanceOf(DocumentoDuplicado)
      expect((error as Error).message).toBe('Ya hay una persona cargada con DNI 30111222.')
    }
  })

  test('el duplicado se detecta aunque el numero venga escrito distinto', async () => {
    const servicio = montar()
    await servicio.crearPersona(valida)
    expect(
      servicio.crearPersona({ ...valida, numeroDeDocumento: '30.111.222' }),
    ).rejects.toBeInstanceOf(DocumentoDuplicado)
  })

  test('un pasaporte con el mismo numero que un DNI si se puede cargar', async () => {
    const servicio = montar()
    await servicio.crearPersona(valida)
    expect(
      servicio.crearPersona({
        ...valida,
        tipoDeDocumento: 'pasaporte',
        numeroDeDocumento: '30111222',
      }),
    ).resolves.toBeDefined()
  })

  test('valida contra el reloj de Core y no contra la hora del sistema', async () => {
    // Con el reloj en 1970, una persona nacida en 2010 es del futuro. Si este
    // test pasa, es que el servicio se colgo la hora real.
    expect(montar().crearPersona({ ...valida, fechaDeNacimiento: '2010-05-01' })).rejects.toBeInstanceOf(
      DatosInvalidos,
    )
  })
})

describe('listarPersonas', () => {
  test('sin datos devuelve una lista vacia, no undefined', async () => {
    expect(await montar().listarPersonas()).toEqual([])
  })

  test('ordena por apellido respetando los acentos del castellano', async () => {
    // SQLite compara bytes: con ORDER BY, "Ávila" caeria despues de "Zaballa" y
    // la lista alfabetica dejaria de servir para encontrar gente.
    const servicio = montar()
    await servicio.crearPersona({ ...valida, apellidos: 'Zaballa', numeroDeDocumento: '30111111' })
    await servicio.crearPersona({ ...valida, apellidos: 'Ávila', numeroDeDocumento: '30222222' })
    await servicio.crearPersona({ ...valida, apellidos: 'Núñez', numeroDeDocumento: '30333333' })
    await servicio.crearPersona({ ...valida, apellidos: 'Ochoa', numeroDeDocumento: '30444444' })

    const listadas = await servicio.listarPersonas()
    expect(listadas.map((persona) => persona.apellidos)).toEqual([
      'Ávila',
      'Núñez',
      'Ochoa',
      'Zaballa',
    ])
  })

  test('a igual apellido, ordena por nombres', async () => {
    const servicio = montar()
    await servicio.crearPersona({
      ...valida,
      apellidos: 'Pérez',
      nombres: 'Rosario',
      numeroDeDocumento: '30111111',
    })
    await servicio.crearPersona({
      ...valida,
      apellidos: 'Pérez',
      nombres: 'Ana',
      numeroDeDocumento: '30222222',
    })

    const listadas = await servicio.listarPersonas()
    expect(listadas.map((persona) => persona.nombres)).toEqual(['Ana', 'Rosario'])
  })

  test('las marcas vuelven de la base como Date, y la fecha como texto', async () => {
    // Es el unico test que verifica el ida y vuelta del mapeo: sale de una fila
    // releida, no del objeto que devolvio el alta.
    const servicio = montar()
    await servicio.crearPersona(valida)
    const [persona] = await servicio.listarPersonas()
    expect(persona?.creadoEn).toEqual(HORA)
    expect(persona?.fechaDeNacimiento).toBe('1950-05-01')
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `bun test packages/personas/test/servicio.test.ts`
Expected: FAIL — `Cannot find module '../src/servidor/servicio'`.

- [ ] **Step 3: Escribir el servicio**

`packages/personas/src/servidor/servicio.ts`:

```ts
import type { Core } from '@gps/core'
import { and, eq } from 'drizzle-orm'
import { nombreDelTipo, normalizarNumero, type TipoDeDocumento } from '../dominio/documentos'
import type { DatosDePersona, Persona } from '../dominio/modelos'
import { type Problema, validarPersona } from '../dominio/validaciones'
import { personas } from './tablas'

/** Los datos del alta no pasan las reglas de /dominio. Lleva los problemas
 *  adentro para que el resolver los pueda publicar campo por campo. */
export class DatosInvalidos extends Error {
  readonly problemas: readonly Problema[]

  constructor(problemas: readonly Problema[]) {
    super(problemas.map((problema) => problema.mensaje).join(' '))
    this.name = 'DatosInvalidos'
    this.problemas = problemas
  }
}

/** Ya hay una persona con ese documento. */
export class DocumentoDuplicado extends Error {
  constructor(tipo: TipoDeDocumento, numero: string) {
    super(`Ya hay una persona cargada con ${nombreDelTipo(tipo)} ${numero}.`)
    this.name = 'DocumentoDuplicado'
  }
}

export interface ServicioDePersonas {
  crearPersona(datos: DatosDePersona): Promise<Persona>
  listarPersonas(): Promise<readonly Persona[]>
}

/** El orden alfabetico lo hace Intl y no un ORDER BY: SQLite compara bytes, asi
 *  que "Ávila" caeria despues de "Zaballa". En un idioma con acentos eso no es
 *  estetica, es una lista en la que no se encuentra a la gente.
 *
 *  Ordenar en memoria es el mismo criterio que listarDistritos, que arma el
 *  arbol con tres consultas: con la cantidad de personas de una diocesis alcanza
 *  de sobra, y si algun dia deja de alcanzar se arregla en un solo lugar. */
const alfabeto = new Intl.Collator('es')

/** Los metodos devuelven Promise aunque el driver de SQLite sea sincrono: es la
 *  costura que deja pasar a Postgres o a un driver asincrono en el telefono sin
 *  tocar a ningun consumidor. */
export function crearServicioDePersonas(core: Core): ServicioDePersonas {
  return {
    async crearPersona(datos) {
      const problemas = validarPersona(datos, core.reloj.ahora())
      if (problemas.length > 0) throw new DatosInvalidos(problemas)

      const numeroDeDocumento = normalizarNumero(datos.numeroDeDocumento)

      // Este SELECT no es la garantia -dos altas simultaneas lo pasan las dos- y
      // no hace falta que lo sea: el UNIQUE de la tabla es el que garantiza.
      // Existe solo para el mensaje: sin el, lo que llega al formulario es
      // "UNIQUE constraint failed: personas.tipo_de_documento, ...", que no se
      // le puede mostrar a nadie.
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
      core.bd.insert(personas).values(persona).run()
      return persona
    },

    async listarPersonas() {
      return core.bd
        .select()
        .from(personas)
        .all()
        .sort(
          (una, otra) =>
            alfabeto.compare(una.apellidos, otra.apellidos) ||
            alfabeto.compare(una.nombres, otra.nombres),
        )
    },
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `bun test packages/personas/test/servicio.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/personas
git commit -m "feat(personas): el servicio, con alta validada y listado ordenado por Intl"
```

---

### Task 7: El esquema, la primera mutation y el registro del módulo

**Files:**
- Create: `packages/personas/src/servidor/schema.ts`
- Create: `packages/personas/src/servidor/index.ts`
- Modify: `packages/core/src/builder.ts`
- Modify: `services/backend/src/modules.ts`
- Modify: `services/backend/package.json`
- Modify: `schema.gql` (regenerado, no se edita a mano)

**Interfaces:**
- Consumes: todo lo de las tareas 2 a 6.
- Produces: `export const personas: Module<ServicioDePersonas>` desde `@gps/personas/servidor`, más la ampliación de `Context` con `readonly personas: ServicioDePersonas`. En GraphQL: `enum TipoDeDocumento`, `type Persona`, `input DatosDePersona`, `Query.personas: [Persona!]!` y `Mutation.crearPersona(datos: DatosDePersona!): Persona!`. Los usan las tareas 8, 9, 10 y 11.

- [ ] **Step 1: Declarar `Mutation` en el builder de core**

En `packages/core/src/builder.ts`, después de `builder.queryType({})`:

```ts
  builder.queryType({})
  // Mutation se declara aca por la misma razon que Query: para que cada modulo
  // le agregue campos con builder.mutationField(...) sin competir por declarar
  // el tipo, y el orden de registro no importe.
  //
  // Ojo: GraphQL exige que un tipo tenga al menos un campo, asi que el esquema
  // no compone si ningun modulo registrado aporta una mutation. Hoy la aporta
  // personas.
  builder.mutationType({})
  return builder
```

- [ ] **Step 2: Escribir el esquema del módulo**

`packages/personas/src/servidor/schema.ts`:

```ts
import type { Builder } from '@gps/core'
import { GraphQLError } from 'graphql'
import { TIPOS_DE_DOCUMENTO, type TipoDeDocumento } from '../dominio/documentos'
import type { DatosDePersona, Persona } from '../dominio/modelos'
import { DatosInvalidos, DocumentoDuplicado } from './servicio'

export function registrarSchema(builder: Builder): void {
  const TipoDeDocumentoRef = builder.enumType('TipoDeDocumento', {
    description: 'Tipos de documento que la asociacion acepta.',
    // Los valores son los ids del dominio, en minuscula y no gritados como manda
    // la convencion de GraphQL. Es a proposito, igual que en el enum Rama: asi
    // lo que viaja por la red es el id, y la pantalla saca la etiqueta de
    // TIPOS_DE_DOCUMENTO sin una tabla de traduccion en el medio.
    values: TIPOS_DE_DOCUMENTO.map((tipo) => tipo.id) as unknown as readonly TipoDeDocumento[],
  })

  // No expone `edad`: calcularla exige consultar el reloj, que esta prohibido
  // bajo src/servidor/, y ademas el "hoy" correcto es el de quien mira la
  // pantalla, no el del servidor. El cliente la calcula con calcularEdad, que ya
  // tiene desde /dominio.
  const PersonaRef = builder.objectRef<Persona>('Persona').implement({
    description: 'Los datos personales de un miembro de la asociacion.',
    fields: (t) => ({
      id: t.exposeID('id'),
      tipoDeDocumento: t.field({
        type: TipoDeDocumentoRef,
        resolve: (persona) => persona.tipoDeDocumento,
      }),
      numeroDeDocumento: t.exposeString('numeroDeDocumento'),
      nombres: t.exposeString('nombres'),
      apellidos: t.exposeString('apellidos'),
      fechaDeNacimiento: t.exposeString('fechaDeNacimiento', {
        description: 'Fecha de calendario en formato aaaa-mm-dd, sin hora ni zona horaria.',
      }),
    }),
  })

  const DatosDePersonaRef = builder.inputRef<DatosDePersona>('DatosDePersona').implement({
    description: 'Los datos que necesita el alta de una persona.',
    // `required: true` en cada campo: defaultFieldNullability solo invierte el
    // default de los campos de salida, los de entrada siguen siendo opcionales.
    fields: (t) => ({
      tipoDeDocumento: t.field({ type: TipoDeDocumentoRef, required: true }),
      numeroDeDocumento: t.string({ required: true }),
      nombres: t.string({ required: true }),
      apellidos: t.string({ required: true }),
      fechaDeNacimiento: t.string({ required: true }),
    }),
  })

  builder.queryField('personas', (t) =>
    t.field({
      type: [PersonaRef],
      description: 'Todas las personas, ordenadas por apellido.',
      resolve: async (_padre, _args, contexto) => [...(await contexto.personas.listarPersonas())],
    }),
  )

  builder.mutationField('crearPersona', (t) =>
    t.field({
      type: PersonaRef,
      description: 'Da de alta una persona.',
      args: { datos: t.arg({ type: DatosDePersonaRef, required: true }) },
      resolve: async (_padre, args, contexto) => {
        try {
          return await contexto.personas.crearPersona(args.datos)
        } catch (error) {
          // Yoga enmascara todo lo que no sea un GraphQLError: sin esta
          // traduccion, el formulario recibe "Unexpected error." en vez del
          // motivo. La salida no es apagar el enmascarado -eso mandaria al
          // cliente el texto crudo de cualquier fallo, incluidos los de SQLite-,
          // es traducir aca. Traducir en el resolver y no en el servicio es lo
          // que mantiene al servicio sin conocer el framework, que es lo que le
          // permite correr dentro del telefono, donde no hay Yoga.
          if (error instanceof DatosInvalidos) {
            throw new GraphQLError(error.message, {
              extensions: { code: 'DATOS_INVALIDOS', problemas: error.problemas },
            })
          }
          if (error instanceof DocumentoDuplicado) {
            throw new GraphQLError(error.message, { extensions: { code: 'DOCUMENTO_DUPLICADO' } })
          }
          throw error
        }
      },
    }),
  )
}
```

- [ ] **Step 3: Escribir el objeto `Module`**

`packages/personas/src/servidor/index.ts`:

```ts
import type { Module } from '@gps/core'
import { migraciones } from './migraciones'
import { registrarSchema } from './schema'
import { crearServicioDePersonas, type ServicioDePersonas } from './servicio'

// Publica los servicios de este modulo en el contexto de GraphQL.
// Asi es como un modulo alcanza a otro: ctx.<nombre>, nunca por import.
declare module '@gps/core' {
  interface Context {
    readonly personas: ServicioDePersonas
  }
}

export const personas: Module<ServicioDePersonas> = {
  name: 'personas',
  dependencies: [],
  migraciones,
  createServices: (core) => crearServicioDePersonas(core),
  registerSchema: registrarSchema,
}

export { DatosInvalidos, DocumentoDuplicado } from './servicio'
export type { ServicioDePersonas } from './servicio'
```

- [ ] **Step 4: Registrar el módulo**

En `services/backend/package.json`, agregar la dependencia entre `@gps/estructura` y `@gps/sistema`:

```json
    "@gps/personas": "workspace:*",
```

En `services/backend/src/modules.ts`:

```ts
import { estructura } from '@gps/estructura/servidor'
import { personas } from '@gps/personas/servidor'
import { sistema } from '@gps/sistema/servidor'

/** La lista de modulos registrados. Agregar un modulo nuevo es agregarlo aca
 *  y nada mas: el orden lo resuelve ordenarModulos por dependencias. */
export const modulos = [sistema, estructura, personas]
```

Run: `bun install`

- [ ] **Step 5: Regenerar el esquema versionado**

Run: `bun run schema`
Expected: `schema.gql` crece con `type Mutation`, `input DatosDePersona`, `type Persona`, `enum TipoDeDocumento` y el campo `personas` dentro de `Query`.

Verificá a ojo que `Mutation` tenga `crearPersona(datos: DatosDePersona!): Persona!` y que todos los campos del input terminen en `!`. Si alguno quedó opcional, faltó un `required: true` en el paso 2.

- [ ] **Step 6: Correr el check completo**

Run: `bun run check`
Expected: todo verde. Los tests de `estructura`, `sistema`, `demo` y `core` siguen pasando sin tocarlos.

- [ ] **Step 7: Commit**

```bash
git add packages/personas packages/core/src/builder.ts services/backend schema.gql bun.lock
git commit -m "feat(personas): el esquema y la primera mutation del proyecto"
```

---

### Task 8: Personas en el demo

**Files:**
- Modify: `packages/demo/package.json`
- Modify: `packages/demo/src/servidor/escenario.ts`
- Modify: `packages/demo/test/escenario.test.ts`

**Interfaces:**
- Consumes: `ctx.personas.crearPersona` de la tarea 7.
- Produces: doce personas sembradas cuando `ENTORNO=demo`. Las usan las tareas 10 y 11 para tener algo que mirar.

- [ ] **Step 1: Sumar la dependencia**

En `packages/demo/package.json`, entre `@gps/estructura` y el cierre de `dependencies`:

```json
    "@gps/personas": "workspace:*"
```

Run: `bun install`

- [ ] **Step 2: Escribir el test que falla**

En `packages/demo/test/escenario.test.ts`, montar también el módulo de personas. El `montarContexto` queda así:

```ts
import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { aplicarMigraciones, type Bd, type Context, type Core } from '@gps/core'
import { estructura } from '@gps/estructura/servidor'
import { personas } from '@gps/personas/servidor'
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
    // El demo siembra personas con fechas de nacimiento reales, asi que el reloj
    // no puede estar en 1970: con esa hora, nacer en 2020 seria nacer en el
    // futuro y la validacion rechazaria la siembra. Se usa una fecha fija
    // posterior a todas ellas, no la del sistema, para que el test no cambie de
    // resultado con el paso del tiempo.
    reloj: { ahora: () => new Date('2026-08-27T00:00:00Z') },
    bd,
    modulos: ['estructura', 'personas'],
    nuevoId: (prefijo) => `${prefijo}_${++contador}`,
  }

  aplicarMigraciones(core, [estructura, personas])
  return {
    actor: null,
    estructura: estructura.createServices(core),
    personas: personas.createServices(core),
  } as Context
}
```

Los tres tests que ya existen (`siembra la diocesis entera...`, `deja al menos un grupo...`, `el grupo cerrado...`) quedan como están. Agregar al final del archivo:

```ts
describe('sembrarEscenario: personas', () => {
  test('siembra las doce personas pasando por el servicio publico', async () => {
    const contexto = montarContexto()
    await sembrarEscenario(contexto)
    expect(await contexto.personas.listarPersonas()).toHaveLength(12)
  })

  test('las edades cubren el rango entero, de castores a adulto mayor', async () => {
    // Un demo donde todas las personas tienen la misma edad no muestra si la
    // pantalla aguanta el numero de un digito ni el de dos.
    const contexto = montarContexto()
    await sembrarEscenario(contexto)

    const anios = (await contexto.personas.listarPersonas()).map((persona) =>
      Number(persona.fechaDeNacimiento.slice(0, 4)),
    )
    expect(Math.min(...anios)).toBeLessThan(1970)
    expect(Math.max(...anios)).toBeGreaterThan(2018)
  })

  test('hay al menos un pasaporte entre los DNI', async () => {
    const contexto = montarContexto()
    await sembrarEscenario(contexto)

    const tipos = (await contexto.personas.listarPersonas()).map(
      (persona) => persona.tipoDeDocumento,
    )
    expect(tipos).toContain('pasaporte')
    expect(tipos).toContain('dni')
  })

  test('la primera de la lista es la del apellido con acento', async () => {
    // Ávila antes que Bustos: si el orden fuera por bytes, "Ávila" caeria
    // ultima. Es el test que ejercita Intl.Collator con datos del demo.
    const contexto = montarContexto()
    await sembrarEscenario(contexto)

    const listadas = await contexto.personas.listarPersonas()
    expect(listadas[0]?.apellidos).toBe('Ávila')
    expect(listadas.at(-1)?.apellidos).toBe('Zaballa')
  })
})
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `bun test packages/demo/`
Expected: FAIL — los cuatro tests nuevos fallan porque `sembrarEscenario` todavía no siembra personas (`toHaveLength(12)` recibe 0).

- [ ] **Step 4: Sembrar las personas**

En `packages/demo/src/servidor/escenario.ts`, agregar el import con efecto arriba, junto al de estructura:

```ts
import '@gps/estructura/servidor'
import '@gps/personas/servidor'
import type { Context } from '@gps/core'
import type { Rama } from '@gps/estructura/dominio'
import type { DatosDePersona } from '@gps/personas/dominio'
```

Después de la constante `DIOCESIS`, agregar:

```ts
/** Las personas de la demostracion. Los criterios, todos por la misma razon que
 *  los grupos de arriba -un demo donde todas las filas son iguales no muestra si
 *  la pantalla aguanta los casos que se rompen-: edades repartidas de castores a
 *  adulto mayor, un pasaporte entre once DNI, apellidos con acento y con enie
 *  -que son los que exponen el orden alfabetico-, y un apellido compuesto y un
 *  nombre compuesto, que son los que exponen partir un nombre completo con
 *  heuristicas.
 *
 *  Todavia no pertenecen a ningun grupo: esa relacion llega con la iteracion que
 *  la tenga que mostrar. */
const PERSONAS: readonly DatosDePersona[] = [
  { tipoDeDocumento: 'dni', numeroDeDocumento: '55.402.118', nombres: 'Ámbar', apellidos: 'Ávila', fechaDeNacimiento: '2020-03-14' },
  { tipoDeDocumento: 'dni', numeroDeDocumento: '53.119.847', nombres: 'Joaquín', apellidos: 'Bustos', fechaDeNacimiento: '2018-07-02' },
  { tipoDeDocumento: 'dni', numeroDeDocumento: '49.877.210', nombres: 'María Luz', apellidos: 'Del Águila', fechaDeNacimiento: '2015-11-23' },
  { tipoDeDocumento: 'pasaporte', numeroDeDocumento: 'AB1234567', nombres: 'Piotr', apellidos: 'Kowalski', fechaDeNacimiento: '2013-08-21' },
  { tipoDeDocumento: 'dni', numeroDeDocumento: '46.210.553', nombres: 'Tomás', apellidos: 'Ibáñez', fechaDeNacimiento: '2011-01-09' },
  { tipoDeDocumento: 'dni', numeroDeDocumento: '43.998.104', nombres: 'Milagros', apellidos: 'Núñez', fechaDeNacimiento: '2008-05-30' },
  { tipoDeDocumento: 'dni', numeroDeDocumento: '40.522.967', nombres: 'Bruno', apellidos: 'Ochoa', fechaDeNacimiento: '2004-09-17' },
  { tipoDeDocumento: 'dni', numeroDeDocumento: '36.114.780', nombres: 'Sofía', apellidos: 'Peña', fechaDeNacimiento: '1998-02-11' },
  { tipoDeDocumento: 'dni', numeroDeDocumento: '33.207.415', nombres: 'Ignacio', apellidos: 'Quiroga', fechaDeNacimiento: '1993-06-25' },
  { tipoDeDocumento: 'dni', numeroDeDocumento: '28.904.331', nombres: 'Ana Clara', apellidos: 'Sánchez Elía', fechaDeNacimiento: '1985-10-08' },
  { tipoDeDocumento: 'dni', numeroDeDocumento: '25.011.628', nombres: 'Ezequiel', apellidos: 'Vera', fechaDeNacimiento: '1978-04-19' },
  { tipoDeDocumento: 'dni', numeroDeDocumento: '20.447.195', nombres: 'Rosario', apellidos: 'Zaballa', fechaDeNacimiento: '1968-12-03' },
]
```

Los números van con puntos a propósito: es como los escribe una persona, y sembrarlos así ejercita `normalizarNumero` en el camino real.

Y al final de `sembrarEscenario`, después del `for` de la diócesis:

```ts
  for (const datos of PERSONAS) {
    await ctx.personas.crearPersona(datos)
  }
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `bun test packages/demo/`
Expected: PASS, 7 tests (los 3 de estructura más los 4 nuevos).

Después dejá `bun run format` para que Biome acomode el arreglo de personas, que quedó con líneas más largas de 100.

Run: `bun run format && bun run check`
Expected: todo verde.

- [ ] **Step 6: Commit**

```bash
git add packages/demo bun.lock
git commit -m "feat(demo): siembra doce personas con nombres, acentos y un pasaporte"
```

---

### Task 9: Los hooks de `@gps/api`

**Files:**
- Create: `packages/api/src/queries/personas.graphql`
- Create: `packages/api/src/queries/crearPersona.graphql`
- Create: `packages/api/src/personas.ts`
- Modify: `packages/api/src/index.ts`

**Interfaces:**
- Consumes: `Query.personas` y `Mutation.crearPersona` del `schema.gql` regenerado en la tarea 7.
- Produces: `usePersonas()` (devuelve `{ data, isPending, error }` con `data.personas`) y `useCrearPersona()` (devuelve el resultado de `useMutation`, con `mutate(variables, opciones)`, `isPending` y `error`). Los usan las tareas 10 y 11.

El codegen lee `schema.gql` y los `.graphql` de `src/queries/`, y escribe `src/generated/graphql.ts`. Ese archivo no se edita a mano: lo regenera `bun run --filter @gps/api codegen`, que además corre solo dentro de `bun run compile`.

- [ ] **Step 1: Escribir las operaciones**

`packages/api/src/queries/personas.graphql`:

```graphql
# packages/api/src/queries/personas.graphql
query Personas {
  personas {
    id
    tipoDeDocumento
    numeroDeDocumento
    nombres
    apellidos
    fechaDeNacimiento
  }
}
```

`packages/api/src/queries/crearPersona.graphql`:

```graphql
# packages/api/src/queries/crearPersona.graphql
mutation CrearPersona($datos: DatosDePersona!) {
  crearPersona(datos: $datos) {
    id
  }
}
```

Pide sólo el `id`: la pantalla no usa lo que devuelve el alta, porque después de invalidar `['personas']` la lista se vuelve a traer entera. Pedir todos los campos sería tráfico que se descarta.

- [ ] **Step 2: Generar los tipos**

Run: `bun run --filter @gps/api codegen`
Expected: `packages/api/src/generated/graphql.ts` incorpora `PersonasDocument`, `PersonasQuery`, `CrearPersonaDocument` y `CrearPersonaMutationVariables`.

Si falla con "Unknown type DatosDePersona", es que faltó correr `bun run schema` en la tarea 7.

- [ ] **Step 3: Escribir los hooks**

`packages/api/src/personas.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CrearPersonaDocument,
  type CrearPersonaMutationVariables,
  PersonasDocument,
} from './generated/graphql'
import { useTransporte } from './proveedor'

export function usePersonas() {
  const transporte = useTransporte()
  return useQuery({
    queryKey: ['personas'],
    queryFn: () => transporte.ejecutar(PersonasDocument),
  })
}

/** Al alta exitosa invalida ['personas'] para que la lista se vuelva a traer
 *  sola. Es lo unico que la pantalla no tiene que acordarse de hacer. */
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

- [ ] **Step 4: Exportarlos**

`packages/api/src/index.ts`:

```ts
export { useDistritos } from './estructura'
export type {
  CrearPersonaMutationVariables,
  DistritosQuery,
  PersonasQuery,
  VersionQuery,
} from './generated/graphql'
export { useCrearPersona, usePersonas } from './personas'
export { crearQueryClient, ProveedorDeApi, useTransporte } from './proveedor'
export type { Transporte } from './transporte'
export { ErrorDeApi, transporteHttp } from './transporte'
export { useVersion } from './version'
```

- [ ] **Step 5: Compilar**

Run: `bun run --filter @gps/api compile`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add packages/api
git commit -m "feat(api): hooks de personas, con invalidacion del listado al alta"
```

---

### Task 10: La pantalla en la web

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/App.tsx`
- Create: `apps/web/src/pantallas/Estructura.tsx`
- Create: `apps/web/src/pantallas/Personas.tsx`

**Interfaces:**
- Consumes: `usePersonas`, `useCrearPersona`, `ErrorDeApi` de `@gps/api`; `validarPersona`, `nombreCompleto`, `calcularEdad`, `nombreDelTipo`, `TIPOS_DE_DOCUMENTO`, `DatosDePersona`, `Problema` de `@gps/personas/dominio`.
- Produces: rutas `/` y `/personas`.

Recordá la frontera: `apps/**` no puede importar `@gps/*/servidor`. Todo lo que la pantalla necesita sale de `/dominio`; Biome rechaza lo otro.

- [ ] **Step 1: Sumar las dependencias**

Run:

```bash
bun add --cwd apps/web wouter @gps/personas
```

Expected: `apps/web/package.json` suma `"wouter"` y `"@gps/personas": "workspace:*"`. Si `bun add` no resuelve el workspace, agregá `"@gps/personas": "workspace:*"` a mano y corré `bun install`.

- [ ] **Step 2: Mover la estructura a su propia pantalla**

`apps/web/src/pantallas/Estructura.tsx` — es lo que hoy vive en `App.tsx`, sin el encabezado ni la línea de versión, que pasan a ser del layout:

```tsx
import { useDistritos } from '@gps/api'
import { etiquetaDeEdades, RAMAS, type Rama } from '@gps/estructura/dominio'

const RAMA_POR_ID = new Map(RAMAS.map((rama) => [rama.id, rama]))

function EtiquetaDeRama(props: { rama: Rama }) {
  const rama = RAMA_POR_ID.get(props.rama)
  if (!rama) return null
  const edades = etiquetaDeEdades(rama)
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
        <span className="text-slate-400">Grupo Scout Nº{props.numero} -</span> {props.nombre}
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

export function Estructura() {
  const { data, isPending, error } = useDistritos()

  return (
    <>
      {isPending && <p className="mt-8 text-sm text-slate-500">Consultando la estructura…</p>}

      {error && (
        <p className="mt-8 rounded-lg bg-red-50 p-4 text-sm break-words text-red-800">
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
            <h2 className="text-sm font-semibold text-slate-900">Distrito {distrito.numero}</h2>
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
    </>
  )
}
```

- [ ] **Step 3: Escribir la pantalla de personas**

`apps/web/src/pantallas/Personas.tsx`:

```tsx
import { ErrorDeApi, useCrearPersona, usePersonas } from '@gps/api'
import {
  calcularEdad,
  type DatosDePersona,
  nombreCompleto,
  nombreDelTipo,
  type Problema,
  TIPOS_DE_DOCUMENTO,
  type TipoDeDocumento,
  validarPersona,
} from '@gps/personas/dominio'
import { type FormEvent, type ReactNode, useState } from 'react'

const VACIO: DatosDePersona = {
  tipoDeDocumento: 'dni',
  numeroDeDocumento: '',
  nombres: '',
  apellidos: '',
  fechaDeNacimiento: '',
}

const CLASE_DE_INPUT =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm ' +
  'focus:border-slate-900 focus:outline-none'

function Campo(props: { etiqueta: string; problema?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{props.etiqueta}</span>
      <div className="mt-1">{props.children}</div>
      {props.problema && <p className="mt-1 text-xs text-red-700">{props.problema}</p>}
    </label>
  )
}

export function Personas() {
  const { data, isPending, error } = usePersonas()
  const alta = useCrearPersona()
  const [datos, setDatos] = useState<DatosDePersona>(VACIO)
  const [problemas, setProblemas] = useState<readonly Problema[]>([])
  const hoy = new Date()

  const problemaDe = (campo: Problema['campo']) =>
    problemas.find((problema) => problema.campo === campo)?.mensaje

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    // Las mismas funciones puras que corre el servicio. Validar aca es la
    // experiencia de uso; que el servidor las corra igual es la garantia. Es el
    // pago de que /dominio sea isomorfo: una sola implementacion.
    const encontrados = validarPersona(datos, hoy)
    setProblemas(encontrados)
    if (encontrados.length > 0) return
    alta.mutate({ datos }, { onSuccess: () => setDatos(VACIO) })
  }

  return (
    <>
      <form onSubmit={enviar} className="mt-8 space-y-3 rounded-lg bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Cargar una persona</h2>

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
            {/* type="date" es nativo: trae el calendario del sistema, es
                accesible sin trabajo, y emite exactamente el aaaa-mm-dd que
                espera el dominio. Ninguna dependencia hace falta. */}
            <input
              type="date"
              className={CLASE_DE_INPUT}
              value={datos.fechaDeNacimiento}
              onChange={(evento) => setDatos({ ...datos, fechaDeNacimiento: evento.target.value })}
            />
          </Campo>
        </div>

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

      {isPending && <p className="mt-8 text-sm text-slate-500">Consultando las personas…</p>}

      {error && (
        <p className="mt-8 rounded-lg bg-red-50 p-4 text-sm break-words text-red-800">
          No se pudieron consultar las personas: {error.message}
        </p>
      )}

      {data?.personas.length === 0 && (
        <p className="mt-8 rounded-lg bg-white p-4 text-sm text-slate-500 shadow-sm">
          No hay personas cargadas todavía.
        </p>
      )}

      {data && data.personas.length > 0 && (
        <ul className="mt-8 divide-y divide-slate-200 rounded-lg bg-white shadow-sm">
          {data.personas.map((persona) => (
            <li key={persona.id} className="px-4 py-3">
              <p className="text-sm font-medium text-slate-900">{nombreCompleto(persona)}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {nombreDelTipo(persona.tipoDeDocumento)} {persona.numeroDeDocumento}
                <span className="text-slate-400">
                  {' · '}
                  {calcularEdad(persona.fechaDeNacimiento, hoy)} años
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
```

La edad se calcula acá y no viene del servidor: el "hoy" correcto es el de quien mira la pantalla.

- [ ] **Step 4: Convertir `App.tsx` en el layout con navegación**

`apps/web/src/App.tsx`:

```tsx
// apps/web/src/App.tsx
import { useVersion } from '@gps/api'
import type { ReactNode } from 'react'
import { Link, Route, Switch, useRoute } from 'wouter'
import { Estructura } from './pantallas/Estructura'
import { Personas } from './pantallas/Personas'

function Solapa(props: { href: string; children: ReactNode }) {
  const [activa] = useRoute(props.href)
  return (
    <Link
      href={props.href}
      className={`rounded-full px-3 py-1.5 text-sm ${
        activa ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200'
      }`}
    >
      {props.children}
    </Link>
  )
}

export function App() {
  const version = useVersion()

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto w-full max-w-md sm:max-w-2xl">
        <h1 className="text-2xl font-semibold">GPS</h1>
        <p className="mt-1 text-sm text-slate-500">Gestión para Scouts</p>

        <nav className="mt-6 flex gap-1">
          <Solapa href="/">Estructura</Solapa>
          <Solapa href="/personas">Personas</Solapa>
        </nav>

        <Switch>
          <Route path="/" component={Estructura} />
          <Route path="/personas" component={Personas} />
          <Route>
            <p className="mt-8 text-sm text-slate-500">No hay nada en esta dirección.</p>
          </Route>
        </Switch>

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

- [ ] **Step 5: Compilar y mirar la pantalla**

Run: `bun run --filter web compile`
Expected: sin errores.

Run: `bun run demo`, abrir `http://localhost:3000` y comprobar, angostando la ventana a 375px:

1. La solapa Estructura muestra los cuatro distritos como antes.
2. La solapa Personas muestra las doce sembradas, empezando por Ávila y terminando en Zaballa.
3. Cargar una persona con el formulario vacío marca cuatro campos, no un cartel genérico.
4. Cargar una persona válida la agrega a la lista sin recargar.
5. Cargar el DNI 20447195 (el de Zaballa) muestra "Ya hay una persona cargada con DNI 20447195." y **no** "Unexpected error." Si dice "Unexpected error.", faltó la traducción a `GraphQLError` del paso 2 de la tarea 7.

- [ ] **Step 6: Commit**

```bash
git add apps/web bun.lock
git commit -m "feat(web): router y pantalla de personas, con lista y alta"
```

---

### Task 11: La pantalla en mobile

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/app/index.tsx`
- Create: `apps/mobile/app/personas.tsx`

**Interfaces:**
- Consumes: lo mismo que la tarea 10.
- Produces: la ruta `/personas` de expo-router.

- [ ] **Step 1: Sumar la dependencia**

En `apps/mobile/package.json`, después de `"@gps/estructura": "workspace:*"`:

```json
    "@gps/personas": "workspace:*",
```

Run: `bun install`

- [ ] **Step 2: Escribir la pantalla**

`apps/mobile/app/personas.tsx`:

```tsx
import { ErrorDeApi, useCrearPersona, usePersonas } from '@gps/api'
import {
  calcularEdad,
  type DatosDePersona,
  nombreCompleto,
  nombreDelTipo,
  type Problema,
  TIPOS_DE_DOCUMENTO,
  validarPersona,
} from '@gps/personas/dominio'
import { Stack } from 'expo-router'
import { type ReactNode, useState } from 'react'
import { Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native'

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
    <View className="mt-3">
      <Text className="text-xs font-medium text-slate-600">{props.etiqueta}</Text>
      <View className="mt-1">{props.children}</View>
      {props.problema && <Text className="mt-1 text-xs text-red-700">{props.problema}</Text>}
    </View>
  )
}

export default function Pantalla() {
  const { data, isPending, error } = usePersonas()
  const alta = useCrearPersona()
  const [datos, setDatos] = useState<DatosDePersona>(VACIO)
  const [problemas, setProblemas] = useState<readonly Problema[]>([])
  const hoy = new Date()

  const problemaDe = (campo: Problema['campo']) =>
    problemas.find((problema) => problema.campo === campo)?.mensaje

  function enviar() {
    // Las mismas funciones puras que corre el servicio, y las mismas que corre
    // la web: una sola implementacion de las reglas para los tres lados.
    const encontrados = validarPersona(datos, hoy)
    setProblemas(encontrados)
    if (encontrados.length > 0) return
    alta.mutate({ datos }, { onSuccess: () => setDatos(VACIO) })
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <Stack.Screen options={{ headerShown: true, title: 'Personas' }} />
      <ScrollView contentContainerClassName="px-4 py-6">
        <View className="rounded-lg bg-white p-4">
          <Text className="text-sm font-semibold text-slate-900">Cargar una persona</Text>

          <Campo etiqueta="Tipo de documento">
            <View className="flex-row gap-2">
              {TIPOS_DE_DOCUMENTO.map((tipo) => (
                <Pressable
                  key={tipo.id}
                  onPress={() => setDatos({ ...datos, tipoDeDocumento: tipo.id })}
                  className={`rounded-full px-3 py-1.5 ${
                    datos.tipoDeDocumento === tipo.id ? 'bg-slate-900' : 'bg-slate-100'
                  }`}
                >
                  <Text
                    className={`text-xs ${
                      datos.tipoDeDocumento === tipo.id ? 'text-white' : 'text-slate-700'
                    }`}
                  >
                    {tipo.nombre}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Campo>

          <Campo etiqueta="Número" problema={problemaDe('numeroDeDocumento')}>
            <TextInput
              className={CLASE_DE_INPUT}
              value={datos.numeroDeDocumento}
              onChangeText={(numeroDeDocumento) => setDatos({ ...datos, numeroDeDocumento })}
              autoCapitalize="characters"
            />
          </Campo>

          <Campo etiqueta="Apellidos" problema={problemaDe('apellidos')}>
            <TextInput
              className={CLASE_DE_INPUT}
              value={datos.apellidos}
              onChangeText={(apellidos) => setDatos({ ...datos, apellidos })}
              autoCapitalize="words"
            />
          </Campo>

          <Campo etiqueta="Nombres" problema={problemaDe('nombres')}>
            <TextInput
              className={CLASE_DE_INPUT}
              value={datos.nombres}
              onChangeText={(nombres) => setDatos({ ...datos, nombres })}
              autoCapitalize="words"
            />
          </Campo>

          {/* ponytail: un TextInput con el formato crudo aaaa-mm-dd en vez de un
              calendario. React Native no tiene equivalente de <input type="date">
              y el picker es @react-native-community/datetimepicker, una
              dependencia nativa para el primer formulario del proyecto. Techo:
              tipear una fecha en un telefono es peor que elegirla. Cuando el alta
              desde el telefono sea un camino real y no una demostracion, sumar el
              picker; la validacion pura no cambia. */}
          <Campo etiqueta="Fecha de nacimiento" problema={problemaDe('fechaDeNacimiento')}>
            <TextInput
              className={CLASE_DE_INPUT}
              value={datos.fechaDeNacimiento}
              onChangeText={(fechaDeNacimiento) => setDatos({ ...datos, fechaDeNacimiento })}
              placeholder="aaaa-mm-dd"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Campo>

          {alta.isError && (
            <View className="mt-3 rounded-lg bg-red-50 p-3">
              <Text className="text-sm text-red-800">
                {alta.error instanceof ErrorDeApi
                  ? alta.error.errores.join(' ')
                  : alta.error.message}
              </Text>
            </View>
          )}

          <Pressable
            onPress={enviar}
            disabled={alta.isPending}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2.5"
          >
            <Text className="text-center text-sm font-medium text-white">
              {alta.isPending ? 'Guardando…' : 'Guardar'}
            </Text>
          </Pressable>
        </View>

        {isPending && <Text className="mt-6 text-sm text-slate-500">Consultando las personas…</Text>}

        {error && (
          <View className="mt-6 rounded-lg bg-red-50 p-4">
            <Text className="text-sm text-red-800">
              No se pudieron consultar las personas: {error.message}
            </Text>
          </View>
        )}

        {data?.personas.length === 0 && (
          <View className="mt-6 rounded-lg bg-white p-4">
            <Text className="text-sm text-slate-500">No hay personas cargadas todavía.</Text>
          </View>
        )}

        {data && data.personas.length > 0 && (
          <View className="mt-6 overflow-hidden rounded-lg bg-white">
            {data.personas.map((persona) => (
              <View key={persona.id} className="border-b border-slate-200 px-4 py-3">
                <Text className="text-sm font-medium text-slate-900">
                  {nombreCompleto(persona)}
                </Text>
                <Text className="mt-0.5 text-xs text-slate-500">
                  {nombreDelTipo(persona.tipoDeDocumento)} {persona.numeroDeDocumento}
                  <Text className="text-slate-400">
                    {' · '}
                    {calcularEdad(persona.fechaDeNacimiento, hoy)} años
                  </Text>
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
```

`<Stack.Screen options={{ headerShown: true, title: 'Personas' }} />` va acá dentro y no en el `_layout.tsx`: el `Stack` tiene `headerShown: false` global, y esta pantalla necesita el botón de volver sin cambiarle el default a la de estructura.

- [ ] **Step 3: Poner el link en la pantalla de estructura**

En `apps/mobile/app/index.tsx`, agregar `Link` al import de expo-router (el archivo hoy no importa nada de expo-router, así que la línea es nueva):

```tsx
import { Link } from 'expo-router'
```

Y justo después del `<Text className="mt-1 text-sm text-slate-500">Gestión para Scouts</Text>`:

```tsx
        <Link href="/personas" className="mt-4 text-sm font-medium text-slate-900 underline">
          Ver personas
        </Link>
```

- [ ] **Step 4: Compilar y mirar la pantalla**

Run: `bun run --filter mobile compile`
Expected: sin errores.

Con `bun run demo` corriendo en otra terminal, run: `bun run --filter mobile dev` y abrir la app. Comprobar:

1. El link "Ver personas" navega, y el header trae el botón de volver.
2. La lista muestra las doce personas.
3. El formulario vacío marca los cuatro campos.
4. Una persona válida se agrega a la lista sin recargar.

Si el teléfono no llega al backend, revisá `EXPO_PUBLIC_API_URL`: `localhost` desde el dispositivo no es la máquina de desarrollo.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile bun.lock
git commit -m "feat(mobile): pantalla de personas, con lista y alta"
```

---

### Task 12: Verificación de punta a punta

No agrega código. Es la corrida que confirma que las piezas de las once tareas anteriores funcionan juntas, y en particular la que verifica el hallazgo sobre el enmascarado de Yoga, que ningún test unitario cubre.

- [ ] **Step 1: El check completo**

Run: `bun run check`
Expected: lint limpio, todos los paquetes compilan, todos los tests pasan. Contando: los 68 que ya había, más 6 (documentos) + 7 (modelos) + 14 (validaciones) + 5 (migraciones) + 13 (servicio) + 4 (demo) = 117.

- [ ] **Step 2: El esquema versionado está al día**

Run: `bun run schema && git diff --exit-code schema.gql`
Expected: código de salida 0, sin diferencias. Si hay diferencias, es que faltó commitear el `schema.gql` regenerado en la tarea 7, y CI iba a fallar por eso.

- [ ] **Step 3: El error de duplicado llega legible al cliente**

Con `bun run demo` corriendo:

```bash
curl -s localhost:3000/graphql -H 'content-type: application/json' -d '{
  "query": "mutation { crearPersona(datos: { tipoDeDocumento: dni, numeroDeDocumento: \"20447195\", nombres: \"Rosario\", apellidos: \"Zaballa\", fechaDeNacimiento: \"1968-12-03\" }) { id } }"
}'
```

Expected: el JSON trae `"message": "Ya hay una persona cargada con DNI 20447195."`

**Si dice `"Unexpected error."`, la traducción a `GraphQLError` de la tarea 7 no está funcionando.** Es el modo de fallo más probable de todo el plan, porque no lo cubre ningún test unitario: el servicio tira el error correcto y los tests lo verifican, pero es Yoga el que decide si ese mensaje sale o se reemplaza.

- [ ] **Step 4: Una validación de servidor también llega legible**

```bash
curl -s localhost:3000/graphql -H 'content-type: application/json' -d '{
  "query": "mutation { crearPersona(datos: { tipoDeDocumento: dni, numeroDeDocumento: \"1\", nombres: \"\", apellidos: \"Perez\", fechaDeNacimiento: \"2010-05-01\" }) { id } }"
}'
```

Expected: el mensaje junta los dos problemas ("Los nombres no pueden estar vacíos. Un DNI tiene 7 u 8 dígitos.") y `extensions.code` es `"DATOS_INVALIDOS"`.

- [ ] **Step 5: Actualizar el mapa de arquitectura**

En `docs/arquitectura.md`, donde el dibujo de la sección 1 dice `sistema, estructura, ...`, sumar `personas`. Es una línea; el resto del documento ya nombra a `personas` como el módulo que venía.

- [ ] **Step 6: Commit final**

```bash
git add docs/arquitectura.md
git commit -m "docs(arquitectura): personas en el mapa de modulos"
```

---

## Notas de riesgo

Tres cosas que pueden salir distinto de lo escrito acá, con qué hacer en cada caso:

1. **El enmascarado de Yoga.** Cubierto arriba: el paso 3 de la tarea 12 es el que lo detecta. Si `GraphQLError` no alcanzara, la alternativa es un `maskedErrors: { maskError }` en `services/backend/src/server.ts` que deje pasar los errores con `extensions.code` propio — pero probá primero lo simple.
2. **`builder.inputRef` en Pothos.** Si la firma no resulta ser exactamente `builder.inputRef<T>(nombre).implement({ fields })`, la variante equivalente es `builder.inputType(nombre, { fields })`, que infiere el tipo en vez de fijarlo. Verificá que el tipo de `args.datos` en el resolver siga siendo asignable a `DatosDePersona`.
3. **El nombre del índice único que genera drizzle-kit.** Puede diferir del que figura en la tarea 5, paso 3. No lo edites: el nombre no lo usa nadie y cambiarlo a mano desincroniza el snapshot de `migraciones/meta/`.
