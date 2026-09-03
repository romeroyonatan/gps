# Afiliación — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El módulo `afiliacion`: dos veces por año (más las extraordinarias) fotografía
quiénes estaban activos en cada grupo, y sabe decir a quiénes hay que cobrarles.

**Architecture:** Un módulo nuevo con dos tablas. `declaraciones` es la nómina de un grupo
en una fecha; `afiliados` son sus filas, congeladas con nombre y documento. Lee —nunca
escribe— `personas` y `estructura` por sus interfaces públicas. Las ordinarias las dispara
un barrido en `services/backend`; las extraordinarias, un botón en la pantalla del grupo.

**Tech Stack:** Bun, TypeScript, Drizzle sobre SQLite, Pothos + GraphQL Yoga, React (web,
con wouter y Tailwind) y React Native (mobile, con expo-router y NativeWind), TanStack
Query. Tests con `bun:test`.

**Spec:** `docs/superpowers/specs/2026-09-01-afiliacion-design.md`

## Global Constraints

Copiadas del CLAUDE.md del repo y de la spec. Aplican a **todas** las tareas.

- **Idioma.** El idioma lo decide el dominio, no la capa. Español para lo que nombra el
  escultismo y las reglas de negocio (`Declaracion`, `Afiliado`, `declarar`, campos
  GraphQL, comentarios, nombres de tests). Inglés para el vocabulario técnico de industria
  (`module`, `core`, `index`, `server`, `context`, `config`, `schema`, `logger`) y para los
  archivos canónicos (`README.md`, `schema.gql`, `package.json`).
- **Comentarios sin acentos.** El código del repo escribe los comentarios sin tildes
  (`portabilidad`, `modulo`, `anio`). Los textos que ve el usuario —mensajes de error,
  copy de pantallas, `description` de GraphQL— **sí** llevan acentos.
- **Portabilidad.** Nada bajo `src/` de un módulo importa `bun:*` ni `node:*`. Nada bajo
  `src/servidor/` consulta la hora del sistema ni genera ids: el reloj es
  `core.reloj.ahora()` y los ids son `core.nuevoId(prefijo)`. Lo impone Biome por dos
  vías, incluido el plugin `biome-plugins/portabilidad.grit`.
- **Fronteras de imports.** `apps/**` no importa `*/servidor`. Un módulo no importa el
  `/servidor` de otro; el `/dominio` sí. `packages/demo` está exceptuado.
- **Mobile-first.** Todo se diseña primero a 375px. `sm:` y `md:` sólo agregan.
- **Relojes falsos en epoch 1970** (`new Date('1970-01-01T00:00:00Z')`) en todos los tests,
  para que una hora del sistema colada se distinga de un vistazo.
- **`bun run check`** (lint + tipos + tests) tiene que quedar en verde al final de cada
  tarea. Es el comando de verificación por omisión de todas las tareas de este plan.
- **Commits** en español, con prefijo convencional (`feat(afiliacion):`, `refactor(core):`).

---

## Estructura de archivos

Lo que existe al terminar, y de qué es responsable cada archivo.

    packages/core/src/fechas.ts              aFechaDeCalendario, subpath /fechas
    packages/core/src/index.ts               se va crearBuilder al subpath /graphql
    packages/core/package.json               exports: . / graphql / fechas
    packages/core/test/fechas.test.ts        su test, mudado desde personas

    packages/estructura/src/dominio/publico.ts   + gruposAbiertosEn
    packages/estructura/src/servidor/servicio.ts implementacion
    packages/estructura/test/servicio.test.ts    + sus casos

    packages/personas/src/dominio/publico.ts     Personas, MiembroActivo (nuevo)
    packages/personas/src/servidor/servicio.ts   + miembrosActivos
    packages/personas/src/servidor/schema.ts     TipoDeDocumento por enumCompartido

    packages/afiliacion/
      src/dominio/config.ts        INICIO_DEL_PERIODO, FECHAS_ORDINARIAS
      src/dominio/periodos.ts      periodoDe, fechasOrdinariasDelPeriodo
      src/dominio/modelos.ts       Declaracion, Afiliado
      src/dominio/validaciones.ts  validarFecha
      src/dominio/index.ts         lo publico del dominio
      src/servidor/tablas.ts       declaraciones, afiliados
      src/servidor/migraciones.ts  la lista de migraciones
      src/servidor/servicio.ts     ServicioDeAfiliacion, siete metodos
      src/servidor/schema.ts       los tipos y campos de GraphQL
      src/servidor/index.ts        el Module y la ampliacion de Context

    services/backend/src/server.ts   devuelve tambien el contexto
    services/backend/src/index.ts    el barrido al arrancar y una vez por dia
    services/backend/src/modules.ts  + afiliacion

    packages/demo/src/servidor/escenario.ts   las declaraciones del escenario
    packages/api/src/afiliacion.ts            los hooks
    apps/web/src/pantallas/Afiliacion.tsx     la pantalla nueva
    apps/mobile/app/grupos/[id]/afiliacion.tsx  su equivalente

**Corrección a la spec.** §14 no listó los dos `AltaDePersona.tsx` (web y mobile), que
importan `aFechaDeCalendario` y por lo tanto los toca la Tarea 1. Tampoco listó los
`package.json` de las apps. Ver la nota de la Tarea 1.

---

### Task 1: `aFechaDeCalendario` sube a core, y core se parte en tres

Estructura la va a necesitar para comparar `cerradoEn` —un instante— contra una fecha de
almanaque, y afiliación para saber qué día es hoy. Es el tercer módulo que la usa, así que
deja de ser de personas.

**No puede salir por el índice de `@gps/core`, y eso obliga a partirlo.** Hoy el paquete
tiene un solo export, `"." → src/index.ts`, y ese índice arrastra dos librerías por imports
de valor: `builder.ts` hace `import SchemaBuilder from '@pothos/core'` y `migraciones.ts`
hace `import { sql } from 'drizzle-orm'`. Las apps importan `aFechaDeCalendario`, así que
sacarla por el índice les mete las dos en el bundle. Hoy no pasa porque lo único que se
toma de core fuera del servidor es `import type { Marcas }`, y un import **de tipo** lo
borra TypeScript. Un import de valor no. Metro además no hace tree-shaking por omisión.

El paquete queda con tres puertas, que es la misma frontera `/dominio` ↔ `/servidor` que
ya tienen todos los módulos, aplicada a core:

    @gps/core           plomeria de servidor: Config, Core, Module, Migracion,
                        aplicarMigraciones, ordenarModulos, crearServicios
    @gps/core/graphql   crearBuilder y enumCompartido: lo unico que depende de
                        Pothos
    @gps/core/fechas    aFechaDeCalendario: lo isomorfo

**Files:**
- Create: `packages/core/src/fechas.ts`
- Create: `packages/core/test/fechas.test.ts`
- Modify: `packages/core/package.json` (exports), `packages/core/src/index.ts`
- Modify: `packages/sistema/src/servidor/schema.ts`,
  `packages/estructura/src/servidor/schema.ts`, `packages/personas/src/servidor/schema.ts`,
  `services/backend/src/composicion.ts` (importan de `@gps/core/graphql`)
- Modify: `packages/personas/src/dominio/vinculos.ts` (se va la función)
- Modify: `packages/personas/src/dominio/validaciones.ts` (import)
- Modify: `packages/personas/src/dominio/index.ts` (se va del export)
- Modify: `packages/personas/test/vinculos.test.ts` (se van sus tests)
- Modify: `apps/web/package.json`, `apps/mobile/package.json` (+ `@gps/core`)
- Modify: `apps/web/src/pantallas/AltaDePersona.tsx`, `apps/mobile/componentes/AltaDePersona.tsx`

**Interfaces:**
- Produces: `aFechaDeCalendario(instante: Date): string`, importable como
  `import { aFechaDeCalendario } from '@gps/core/fechas'`. Todas las tareas siguientes la
  usan desde ahí. Y `crearBuilder`, `enumCompartido`, `ValoresDistintos`,
  `DescripcionesDistintas` y el tipo `Builder`, ahora en `@gps/core/graphql`: la Tarea 10
  escribe el `schema.ts` de afiliación contra ese import.

- [ ] **Step 1: Crear el archivo en core, con el texto que ya tenía**

`packages/core/src/fechas.ts`:

```ts
/** La fecha de calendario de un instante, segun el almanaque de quien lo mira.
 *
 *  Componentes locales y no toISOString: en UTC-3 el 1 de mayo a las 22:00
 *  seria el 2 de mayo en UTC.
 *
 *  Vive en core y no en un modulo porque la necesitan varios -personas para
 *  validar el ingreso, estructura para saber si un grupo estaba abierto un dia,
 *  afiliacion para el periodo- y los modulos no se pueden importar entre si.
 *  Es la misma razon que Marcas.
 *
 *  Ojo con el archivo: va en su propio subpath y NO en src/index.ts. El indice
 *  es plomeria de servidor y arrastra drizzle-orm por aplicarMigraciones, que
 *  importa `sql` como valor; las apps importan esta funcion, asi que sacarla
 *  por el indice se los meteria en el bundle -y Metro no hace tree-shaking-.
 *  Los tipos (Marcas) no tienen el problema: se borran al compilar. */
export function aFechaDeCalendario(instante: Date): string {
  const mes = `${instante.getMonth() + 1}`.padStart(2, '0')
  const dia = `${instante.getDate()}`.padStart(2, '0')
  return `${instante.getFullYear()}-${mes}-${dia}`
}
```

- [ ] **Step 2: Abrir las dos puertas en `packages/core/package.json`**

```json
  "exports": {
    ".": "./src/index.ts",
    "./graphql": "./src/builder.ts",
    "./fechas": "./src/fechas.ts"
  },
```

El subpath apunta a `builder.ts` sin renombrar el archivo: el nombre público lo da el
mapa de exports, que es para lo que existe. `builder` sigue describiendo bien qué hay
adentro; `graphql` describe para quién es.

- [ ] **Step 2b: Sacar el builder del índice y actualizar a los cuatro que lo usan**

En `packages/core/src/index.ts`, borrar estas dos líneas:

```ts
export type { Builder } from './builder'
export { crearBuilder, DescripcionesDistintas, enumCompartido, ValoresDistintos } from './builder'
```

`module.ts` sigue haciendo `import type { Builder } from './builder'` y no se toca: es
interno al paquete y además type-only.

Cambiar el import en los cuatro consumidores:

```ts
// packages/sistema/src/servidor/schema.ts
import type { Builder } from '@gps/core/graphql'

// packages/estructura/src/servidor/schema.ts y packages/personas/src/servidor/schema.ts
import { type Builder, enumCompartido } from '@gps/core/graphql'

// services/backend/src/composicion.ts — crearBuilder sale del import de '@gps/core'
import { crearBuilder } from '@gps/core/graphql'
```

Run: `bun run compile`
Expected: verde. Si algún archivo quedó importando `crearBuilder` o `enumCompartido` desde
`@gps/core`, tsc lo señala acá y no en runtime.

- [ ] **Step 3: Mudar el test**

Crear `packages/core/test/fechas.test.ts` con los dos casos que hoy están en
`packages/personas/test/vinculos.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import { aFechaDeCalendario } from '../src/fechas'

describe('aFechaDeCalendario', () => {
  test('usa el almanaque local y no el UTC', () => {
    // En UTC-3, el 1 de mayo a las 22:30 seria el 2 de mayo en UTC. La fecha
    // que importa es la del que la mira.
    expect(aFechaDeCalendario(new Date(2026, 4, 1, 22, 30))).toBe('2026-05-01')
  })

  test('rellena mes y dia con cero', () => {
    expect(aFechaDeCalendario(new Date(2026, 0, 9))).toBe('2026-01-09')
  })
})
```

Y borrar de `packages/personas/test/vinculos.test.ts` el `describe('aFechaDeCalendario', …)`
entero y `aFechaDeCalendario` de su línea de import (queda sólo `estaVigente`).

- [ ] **Step 4: Correr el test nuevo y verificar que pasa**

Run: `bun test packages/core/test/fechas.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Sacarla de personas y arreglar los imports**

En `packages/personas/src/dominio/vinculos.ts`: borrar la función `aFechaDeCalendario` y
su bloque de comentario, y agregar arriba:

```ts
import { aFechaDeCalendario } from '@gps/core/fechas'
```

(`estaVigente`, que está debajo, la sigue usando.)

En `packages/personas/src/dominio/validaciones.ts`, cambiar la línea de import:

```ts
import { aFechaDeCalendario } from '@gps/core/fechas'
import type { DatosDeIngreso } from './vinculos'
```

En `packages/personas/src/dominio/index.ts`, la última línea pasa de
`export { aFechaDeCalendario, estaVigente } from './vinculos'` a:

```ts
export { estaVigente } from './vinculos'
```

- [ ] **Step 6: Arreglar las dos apps**

En `apps/web/package.json` y `apps/mobile/package.json`, agregar a `dependencies`:

```json
    "@gps/core": "workspace:*",
```

En `apps/web/src/pantallas/AltaDePersona.tsx` y `apps/mobile/componentes/AltaDePersona.tsx`,
sacar `aFechaDeCalendario` del import de `@gps/personas/dominio` y agregar arriba:

```ts
import { aFechaDeCalendario } from '@gps/core/fechas'
```

- [ ] **Step 7: Reinstalar y verificar todo**

Run: `bun install && bun run check`
Expected: verde. Es un refactor puro: ningún test cambia de resultado y `schema.gql` no se
toca.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(core): aFechaDeCalendario sube a @gps/core/fechas

Estructura y afiliacion la van a necesitar y no pueden importar personas.
Va en su propio subpath y no en el indice: el indice exporta crearBuilder,
que importa @pothos/core como valor, y las apps se lo llevarian al bundle."
```

---

### Task 2: `gruposAbiertosEn` en el público de estructura

Un grupo cerrado no declara. Pero un grupo que cerró en octubre **sí** tenía nómina en
mayo, así que la pregunta lleva fecha y `obtenerGrupo` —que no la toma y devuelve `null`
para todo lo cerrado— no sirve.

**Files:**
- Modify: `packages/estructura/src/dominio/publico.ts`
- Modify: `packages/estructura/src/servidor/servicio.ts`
- Test: `packages/estructura/test/servicio.test.ts`

**Interfaces:**
- Consumes: `aFechaDeCalendario` de `@gps/core/fechas` (Tarea 1).
- Produces: `Estructura.gruposAbiertosEn(fecha: string): Promise<ReadonlySet<string>>`.
  La Tarea 7 la llama.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar a `packages/estructura/test/servicio.test.ts`. Ese archivo tiene dos helpers:
`montar()` sin argumentos y `montarConBd(reloj)`, que devuelve `{ servicio, … }`. Como
estos tests necesitan fijar el reloj para cerrar un grupo en una fecha concreta, usan el
segundo.

El reloj de estos tests va **al mediodía** y no a medianoche: `cerradoEn` se guarda como
instante y `gruposAbiertosEn` lo convierte con `aFechaDeCalendario`, que usa componentes
locales. A las 00:00 UTC, cualquier zona al oeste cae en el día anterior y el caso de la
punta inclusiva pasaría o fallaría según dónde corra el test.

```ts
describe('gruposAbiertosEn', () => {
  test('un grupo cerrado en octubre sigue estando abierto en mayo', async () => {
    // Es el caso que hace que la pregunta lleve fecha: si devolviera solo los
    // abiertos hoy, se perderia la nomina legitima de mayo.
    const { servicio } = montarConBd({ ahora: () => new Date('1970-10-15T12:00:00Z') })
    const distrito = await servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })
    const grupo = await servicio.crearGrupo({
      numero: 7,
      nombre: 'San Jorge',
      distritoId: distrito.id,
    })
    await servicio.cerrarGrupo(grupo.id)

    expect(await servicio.gruposAbiertosEn('1970-05-01')).toContain(grupo.id)
    expect(await servicio.gruposAbiertosEn('1970-11-01')).not.toContain(grupo.id)
  })

  test('cerrado ese mismo dia todavia cuenta como abierto', async () => {
    // Las dos puntas inclusivas, igual que estaVigente.
    const { servicio } = montarConBd({ ahora: () => new Date('1970-10-15T12:00:00Z') })
    const distrito = await servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })
    const grupo = await servicio.crearGrupo({
      numero: 7,
      nombre: 'San Jorge',
      distritoId: distrito.id,
    })
    await servicio.cerrarGrupo(grupo.id)

    expect(await servicio.gruposAbiertosEn('1970-10-15')).toContain(grupo.id)
  })

  test('un grupo que nunca cerro esta abierto siempre', async () => {
    const servicio = montar()
    const distrito = await servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })
    const grupo = await servicio.crearGrupo({
      numero: 7,
      nombre: 'San Jorge',
      distritoId: distrito.id,
    })

    expect(await servicio.gruposAbiertosEn('2999-12-31')).toContain(grupo.id)
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `bun test packages/estructura/test/servicio.test.ts`
Expected: FAIL — `servicio.gruposAbiertosEn is not a function`.

- [ ] **Step 3: Declararla en la interfaz pública**

En `packages/estructura/src/dominio/publico.ts`, adentro de `interface Estructura`:

```ts
  /** Los ids de los grupos que estaban abiertos el dia `fecha` (aaaa-mm-dd).
   *  Cerrado ese mismo dia todavia cuenta como abierto, igual que estaVigente
   *  incluye las dos puntas.
   *
   *  Lleva fecha y obtenerGrupo no, porque las dos preguntas son distintas:
   *  aquella es "se puede inscribir a alguien hoy" y esta es "existia el dia de
   *  la declaracion". Un grupo que cerro en octubre tuvo nomina en mayo. */
  gruposAbiertosEn(fecha: string): Promise<ReadonlySet<string>>
```

- [ ] **Step 4: Implementarla**

En `packages/estructura/src/servidor/servicio.ts`, agregar el import y el método:

```ts
import { aFechaDeCalendario } from '@gps/core/fechas'
```

```ts
    async gruposAbiertosEn(fecha) {
      // El filtro va en memoria y no en el WHERE: cerrado_en es un instante en
      // milisegundos y `fecha` es un dia del almanaque, asi que compararlos
      // exige convertir el primero -y esa conversion depende de la zona
      // horaria, que es justo lo que aFechaDeCalendario resuelve. Son unas
      // decenas de grupos por diocesis; el mismo criterio que listarDistritos.
      const filas = core.bd
        .select({ id: grupos.id, cerradoEn: grupos.cerradoEn })
        .from(grupos)
        .all()
      return new Set(
        filas
          .filter((fila) => fila.cerradoEn === null || fecha <= aFechaDeCalendario(fila.cerradoEn))
          .map((fila) => fila.id),
      )
    },
```

- [ ] **Step 5: Correr y verificar que pasa**

Run: `bun test packages/estructura/test/servicio.test.ts`
Expected: PASS, los tres nuevos incluidos.

- [ ] **Step 6: Verificar todo y commitear**

```bash
bun run check
git add -A
git commit -m "feat(estructura): gruposAbiertosEn, para saber que grupos existian un dia

obtenerGrupo no sirve: no toma fecha y devuelve null para todo lo cerrado,
asi que perderia la nomina de un grupo que existia el dia de la declaracion."
```

---

### Task 3: `miembrosActivos` y el primer `publico.ts` de personas

Personas todavía no publica nada; afiliación es su primer consumidor. Sale con un solo
método, deliberadamente más chico que `ServicioDePersonas`.

`listarPersonas` no sirve: filtra por `hasta IS NULL`, que es "hoy", y acá hace falta "el
1 de mayo".

**Files:**
- Create: `packages/personas/src/dominio/publico.ts`
- Modify: `packages/personas/src/dominio/index.ts`
- Modify: `packages/personas/src/servidor/servicio.ts`
- Test: `packages/personas/test/servicio.test.ts`

**Interfaces:**
- Produces:
  - `interface MiembroActivo { readonly persona: Persona; readonly grupoId: string }`
  - `interface Personas { miembrosActivos(fecha: string): Promise<readonly MiembroActivo[]> }`
  - `ServicioDePersonas extends Personas`
  Las importa la Tarea 7 como `import type { MiembroActivo, Personas } from '@gps/personas/dominio'`.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar a `packages/personas/test/servicio.test.ts`. El archivo ya tiene `montar()`, y su
reloj está en 1970, así que las fechas de nacimiento tienen que ser anteriores:

```ts
describe('miembrosActivos', () => {
  test('incluye a quien ya habia entrado y todavia no se fue', async () => {
    const servicio = montar()
    await servicio.crearPersona(
      { ...valida, numeroDeDocumento: '30111222' },
      { ...ingreso, desde: '1969-03-01' },
    )

    const activos = await servicio.miembrosActivos('1969-05-01')
    expect(activos).toHaveLength(1)
    expect(activos[0]?.grupoId).toBe('grupo_1')
    expect(activos[0]?.persona.numeroDeDocumento).toBe('30111222')
  })

  test('no incluye a quien entro despues', async () => {
    const servicio = montar()
    await servicio.crearPersona(
      { ...valida, numeroDeDocumento: '30111222' },
      { ...ingreso, desde: '1969-07-01' },
    )
    expect(await servicio.miembrosActivos('1969-05-01')).toHaveLength(0)
  })

  test('las dos puntas son inclusivas, igual que estaVigente', async () => {
    const servicio = montar()
    await servicio.crearPersona(
      { ...valida, numeroDeDocumento: '30111222' },
      { ...ingreso, desde: '1969-05-01' },
    )
    expect(await servicio.miembrosActivos('1969-05-01')).toHaveLength(1)
  })
})
```

`valida` (un `DatosDePersona`) e `ingreso` (un `DatosDeIngreso` con `grupoId: 'grupo_1'`)
son las constantes que ese archivo ya define para el alta. La pertenencia nace con
`hasta: null`, así que el caso "se fue antes de esa fecha" no se puede montar por el
servicio todavía —no hay baja— y no se testea acá: lo cubre el escenario completo de la
Tarea 8, que escribe el `hasta` por SQL.

- [ ] **Step 2: Correr y verificar que falla**

Run: `bun test packages/personas/test/servicio.test.ts`
Expected: FAIL — `servicio.miembrosActivos is not a function`.

- [ ] **Step 3: Escribir el `publico.ts`**

`packages/personas/src/dominio/publico.ts`:

```ts
import type { Persona } from './modelos'

/** Una persona con el grupo al que pertenecia un dia dado. Lleva la Persona
 *  entera y no solo el id porque quien pregunta -afiliacion- guarda una
 *  fotografia: nombre y documento tal como estaban ese dia. */
export interface MiembroActivo {
  readonly persona: Persona
  readonly grupoId: string
}

/** Lo que personas le publica a los otros modulos, y nada mas.
 *
 *  Es deliberadamente mas chica que ServicioDePersonas: dar de alta a alguien
 *  es operacion de este modulo y de nadie mas. La regla que esto impone
 *  -interfaz publica declarada, contenido privado- es la de los package
 *  interfaces de SAP y la del modificador `global` de Salesforce.
 *
 *  Vive en /dominio y no en /servidor porque /servidor es privado: son tipos
 *  puros, sin estado, que cualquiera puede leer. */
export interface Personas {
  /** Las personas con pertenencia vigente el dia `fecha` (aaaa-mm-dd), de toda
   *  la asociacion, con el grupo al que pertenecian ese dia.
   *
   *  listarPersonas no sirve para esto: filtra por hasta IS NULL, que es "hoy".
   *  Aca hace falta "el 1 de mayo", con las dos puntas inclusivas, que es la
   *  misma regla que documenta estaVigente. */
  miembrosActivos(fecha: string): Promise<readonly MiembroActivo[]>
}
```

- [ ] **Step 4: Exportarlo desde el índice del dominio**

En `packages/personas/src/dominio/index.ts`, agregar:

```ts
export type { MiembroActivo, Personas } from './publico'
```

- [ ] **Step 5: Implementarlo en el servicio**

En `packages/personas/src/servidor/servicio.ts`:

Cambiar el import de drizzle a `import { and, eq, gte, isNull, lte, or } from 'drizzle-orm'`,
agregar `import type { Personas } from '../dominio/publico'`, y hacer que la interfaz
extienda la pública (mismo patrón que `ServicioDeEstructura extends Estructura`):

```ts
/** Lo que este modulo hace, que es mas que lo que publica: ver Personas en
 *  /dominio/publico.ts. `extends` es lo que hace que la implementacion no pueda
 *  quedar corta sin que TypeScript se entere. */
export interface ServicioDePersonas extends Personas {
  crearPersona(datos: DatosDePersona, ingreso: DatosDeIngreso): Promise<PersonaConVinculos>
  /** Las personas con pertenencia vigente en ese grupo, ordenadas por apellido. */
  listarPersonas(grupoId: string): Promise<readonly PersonaConVinculos[]>
}
```

Y agregar el método adentro del objeto que devuelve `crearServicioDePersonas`:

```ts
    async miembrosActivos(fecha) {
      // Las dos puntas inclusivas: la misma regla que estaVigente, pero contra
      // una fecha cualquiera en vez de contra hoy. Va en el WHERE y no en
      // memoria porque son fechas de texto contra fechas de texto -aaaa-mm-dd
      // ordena igual lexicografica que cronologicamente- y esto barre toda la
      // asociacion, no un grupo.
      const filas = core.bd
        .select()
        .from(pertenencias)
        .innerJoin(personas, eq(personas.id, pertenencias.personaId))
        .where(
          and(
            lte(pertenencias.desde, fecha),
            or(isNull(pertenencias.hasta), gte(pertenencias.hasta, fecha)),
          ),
        )
        .all()

      return filas.map((fila) => ({
        persona: fila.personas,
        grupoId: fila.pertenencias.grupoId,
      }))
    },
```

- [ ] **Step 6: Correr y verificar que pasa**

Run: `bun test packages/personas/test/servicio.test.ts`
Expected: PASS.

- [ ] **Step 7: Verificar todo y commitear**

```bash
bun run check
git add -A
git commit -m "feat(personas): miembrosActivos y el primer publico.ts del modulo

Afiliacion es su primer consumidor. Sale con un solo metodo: la interfaz
publica es deliberadamente mas chica que el servicio."
```

---

### Task 4: `TipoDeDocumento` pasa a `enumCompartido`

Afiliación va a declarar el mismo enum, y dos módulos no pueden declararlo con
`builder.enumType`. `enumCompartido` es el helper de core que existe para eso y que
personas ya usa con `Rama`.

Es un refactor puro: **`schema.gql` no puede cambiar**, y eso es lo que se verifica.

**Files:**
- Modify: `packages/personas/src/servidor/schema.ts`

- [ ] **Step 1: Guardar el schema actual para comparar**

Run: `bun run schema && cp schema.gql /tmp/schema-antes.gql`

- [ ] **Step 2: Cambiar la declaración**

En `packages/personas/src/servidor/schema.ts`, reemplazar el bloque
`const TipoDeDocumentoRef = builder.enumType('TipoDeDocumento', { … })` por:

```ts
  // enumCompartido y no builder.enumType porque afiliacion declara el mismo
  // enum: dos modulos no pueden declararlo dos veces. Ojo con la descripcion,
  // que tiene que ser identica en los dos, o enumCompartido tira
  // DescripcionesDistintas al componer el esquema.
  const TipoDeDocumentoRef = enumCompartido(
    builder,
    'TipoDeDocumento',
    TIPOS_DE_DOCUMENTO.map((tipo) => tipo.id),
    'Tipos de documento que la asociacion acepta.',
  )
```

El import de la primera línea ya trae `enumCompartido`, y después de la Tarea 1 viene de
`@gps/core/graphql`; verificar que siga estando.
El comentario largo que estaba sobre `values` —el que explica que los valores van en
minúscula y no gritados— se mueve al `enumCompartido` de `ramas.ts`… no: se mantiene
**encima** de esta llamada, porque sigue siendo cierto. Conservarlo.

- [ ] **Step 3: Regenerar y verificar que el schema es idéntico**

Run: `bun run schema && diff /tmp/schema-antes.gql schema.gql`
Expected: sin diferencias. Si `diff` imprime algo, la descripción o los valores no
coinciden con los de antes: corregirlos hasta que el diff quede vacío.

- [ ] **Step 4: Verificar todo y commitear**

```bash
bun run check
git add -A
git commit -m "refactor(personas): TipoDeDocumento por enumCompartido

Afiliacion va a declarar el mismo enum y dos modulos no pueden declararlo
con builder.enumType. El schema.gql no cambia."
```

---

### Task 5: El paquete `afiliacion` y su dominio

El paquete nuevo con todo lo puro: el calendario, el período y la validación de la fecha.
Sin tablas ni servicio todavía; todos los tests de esta tarea son unitarios y sin base.

**Files:**
- Create: `packages/afiliacion/package.json`, `packages/afiliacion/tsconfig.json`
- Create: `packages/afiliacion/src/dominio/{config,periodos,modelos,validaciones,index}.ts`
- Test: `packages/afiliacion/test/{periodos,validaciones}.test.ts`

**Interfaces:**
- Consumes: `TipoDeDocumento` de `@gps/personas/dominio`, `Marcas` de `@gps/core`.
- Produces: `INICIO_DEL_PERIODO`, `FECHAS_ORDINARIAS`, `periodoDe(fecha): number`,
  `fechasOrdinariasDelPeriodo(periodo): readonly string[]`,
  `validarFecha(fecha, ultima, hoy): string | null`, y los tipos `Declaracion` y `Afiliado`.

- [ ] **Step 1: Crear el paquete**

`packages/afiliacion/package.json` (copiado de personas, con las dependencias que
corresponden — afiliación depende de personas **y** de estructura):

```json
{
  "name": "@gps/afiliacion",
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
    "@gps/estructura": "workspace:*",
    "@gps/personas": "workspace:*",
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

`packages/afiliacion/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "test"]
}
```

Run: `bun install`

- [ ] **Step 2: Escribir `config.ts`**

`packages/afiliacion/src/dominio/config.ts`:

```ts
/** El dia en que arranca el periodo de afiliacion, como mes-dia.
 *
 *  Va despues de la temporada de campamentos -enero, a veces febrero- y no el
 *  1 de enero. Si la cobertura se cortara el 31 de diciembre, quien se afilio
 *  en noviembre llegaria sin afiliacion al campamento que cierra el ciclo por
 *  el que ya pago. Con el corte el 1 de marzo, el periodo 2026 va del 1 de
 *  marzo de 2026 al 28 de febrero de 2027. */
export const INICIO_DEL_PERIODO = '03-01'

/** Los dias en que la asociacion afila, como mes-dia. El anio lo resuelve
 *  fechasOrdinariasDelPeriodo.
 *
 *  Es un catalogo y no una tabla por lo mismo que los cargos: es un hecho del
 *  negocio, chico, que cambia poquisimo. Se llama config y no calendario
 *  porque es el archivo que se toca cuando la asociacion mueve una fecha.
 *
 *  No va en Config de core: Config tiene version, entorno y puerto, que son
 *  infraestructura, y meterle un campo de negocio hace que core conozca a un
 *  modulo. Con ocho modulos termina siendo el cajon de todos. */
export const FECHAS_ORDINARIAS = ['05-01', '11-01'] as const
```

- [ ] **Step 3: Escribir los tests del período, que fallan**

`packages/afiliacion/test/periodos.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import { fechasOrdinariasDelPeriodo, periodoDe } from '../src/dominio/periodos'

describe('periodoDe', () => {
  test('una fecha despues del corte cae en el periodo que arranca ese anio', () => {
    expect(periodoDe('2026-05-01')).toBe(2026)
    expect(periodoDe('2026-11-01')).toBe(2026)
  })

  test('el dia del corte ya es del periodo nuevo', () => {
    expect(periodoDe('2026-03-01')).toBe(2026)
  })

  test('el dia anterior al corte todavia es del periodo viejo', () => {
    expect(periodoDe('2026-02-28')).toBe(2025)
  })

  test('el campamento de enero cae en el periodo del anio anterior', () => {
    // Es el caso que motiva que el periodo no sea el anio del almanaque: quien
    // se afilio en noviembre de 2026 tiene que llegar cubierto a este dia.
    expect(periodoDe('2027-01-15')).toBe(2026)
  })
})

describe('fechasOrdinariasDelPeriodo', () => {
  test('resuelve cada mes-dia contra el anio que le toca', () => {
    expect(fechasOrdinariasDelPeriodo(2026)).toEqual(['2026-05-01', '2026-11-01'])
  })

  test('cada fecha ordinaria cae en el periodo que la genero', () => {
    // La propiedad que de verdad importa, y que sigue valiendo si alguien
    // cambia FECHAS_ORDINARIAS o INICIO_DEL_PERIODO: si esto se rompe, el
    // barrido declararia fechas de otro periodo.
    for (const fecha of fechasOrdinariasDelPeriodo(2026)) {
      expect(periodoDe(fecha)).toBe(2026)
    }
  })

  test('las devuelve en orden cronologico', () => {
    const fechas = fechasOrdinariasDelPeriodo(2026)
    expect([...fechas].sort()).toEqual([...fechas])
  })
})
```

- [ ] **Step 4: Correr y verificar que falla**

Run: `bun test packages/afiliacion/test/periodos.test.ts`
Expected: FAIL — no existe `../src/dominio/periodos`.

- [ ] **Step 5: Escribir `periodos.ts`**

`packages/afiliacion/src/dominio/periodos.ts`:

```ts
import { FECHAS_ORDINARIAS, INICIO_DEL_PERIODO } from './config'

/** El periodo al que cae una fecha: el anio en que ese periodo arranco.
 *
 *  Con INICIO_DEL_PERIODO en '03-01', periodoDe('2027-01-15') es 2026: enero es
 *  la cola del ciclo anterior, no el arranque de uno nuevo.
 *
 *  Compara texto contra texto: mes-dia en formato mm-dd ordena igual
 *  lexicografica que cronologicamente, asi que no hay nada que parsear. */
export function periodoDe(fecha: string): number {
  const anio = Number(fecha.slice(0, 4))
  const mesDia = fecha.slice(5)
  return mesDia >= INICIO_DEL_PERIODO ? anio : anio - 1
}

/** Las fechas ordinarias de ese periodo, en orden cronologico.
 *
 *  Cada mes-dia se resuelve contra el anio del almanaque que le toca, que no
 *  siempre es el anio en que el periodo arranca: con el corte en marzo, un
 *  '01-15' en FECHAS_ORDINARIAS cae en el anio siguiente. Hoy no hay ninguno
 *  asi, y la funcion existe igual para que agregarlo no sea un bug silencioso. */
export function fechasOrdinariasDelPeriodo(periodo: number): readonly string[] {
  return FECHAS_ORDINARIAS.map(
    (mesDia) => `${mesDia >= INICIO_DEL_PERIODO ? periodo : periodo + 1}-${mesDia}`,
  ).sort()
}
```

- [ ] **Step 6: Correr y verificar que pasa**

Run: `bun test packages/afiliacion/test/periodos.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 7: Escribir el test de `validarFecha`, que falla**

`packages/afiliacion/test/validaciones.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import { validarFecha } from '../src/dominio/validaciones'

describe('validarFecha', () => {
  test('una fecha bien formada, no futura y no anterior a la ultima, pasa', () => {
    expect(validarFecha('1970-05-01', '1970-03-01', '1970-06-01')).toBeNull()
  })

  test('sin declaraciones previas, cualquier fecha no futura pasa', () => {
    expect(validarFecha('1970-05-01', null, '1970-06-01')).toBeNull()
  })

  test('rechaza lo que no tiene forma de fecha', () => {
    expect(validarFecha('1/5/70', null, '1970-06-01')).toContain('aaaa-mm-dd')
  })

  test('rechaza una fecha futura', () => {
    expect(validarFecha('1970-07-01', null, '1970-06-01')).toContain('futura')
  })

  test('hoy mismo no es futuro', () => {
    expect(validarFecha('1970-06-01', null, '1970-06-01')).toBeNull()
  })

  test('rechaza una fecha anterior a la ultima declaracion', () => {
    // Es lo que impide que aparezca una declaracion "en el medio" y le mueva el
    // a-cobrar a una ya emitida. Ver §4.5 de la spec.
    expect(validarFecha('1970-04-01', '1970-05-01', '1970-06-01')).toContain('anterior')
  })

  test('la misma fecha que la ultima si pasa', () => {
    // Un grupo declarando el mismo dia que otro es normal: las ordinarias son
    // una declaracion por grupo, todas con la misma fecha.
    expect(validarFecha('1970-05-01', '1970-05-01', '1970-06-01')).toBeNull()
  })
})
```

- [ ] **Step 8: Correr y verificar que falla**

Run: `bun test packages/afiliacion/test/validaciones.test.ts`
Expected: FAIL — no existe `../src/dominio/validaciones`.

- [ ] **Step 9: Escribir `validaciones.ts`**

`packages/afiliacion/src/dominio/validaciones.ts`:

```ts
const FORMATO = /^\d{4}-\d{2}-\d{2}$/

/** El motivo por el que no se puede declarar con esa fecha, o null si se puede.
 *
 *  Devuelve el mensaje pelado y no un Problema con campo, como hace personas:
 *  aca hay un solo campo y ningun formulario que marcar.
 *
 *  Chequea la forma y no que la fecha exista en el almanaque -"2026-02-30"
 *  pasa- a proposito: ninguna fecha llega tipeada por nadie. Salen de
 *  FECHAS_ORDINARIAS y de aFechaDeCalendario(reloj), que no pueden inventar un
 *  30 de febrero. El regex esta como red, no como validacion de un formulario.
 *
 *  `hoy` y `ultima` entran por parametro: la funcion es pura y el reloj es del
 *  servicio. */
export function validarFecha(fecha: string, ultima: string | null, hoy: string): string | null {
  if (!FORMATO.test(fecha)) {
    return `"${fecha}" no es una fecha con formato aaaa-mm-dd.`
  }
  if (fecha > hoy) {
    return 'No se puede declarar una afiliación con fecha futura.'
  }
  if (ultima !== null && fecha < ultima) {
    return `Ya hay una declaración del ${ultima}: no se puede declarar con una fecha anterior.`
  }
  return null
}
```

- [ ] **Step 10: Correr y verificar que pasa**

Run: `bun test packages/afiliacion/test/validaciones.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 11: Escribir los modelos y el índice**

`packages/afiliacion/src/dominio/modelos.ts`:

```ts
import type { Marcas } from '@gps/core'
import type { TipoDeDocumento } from '@gps/personas/dominio'

/** La nomina que un grupo presenta en una fecha. Una por grupo: lo que se
 *  presenta y lo que se cobra es la nomina de un grupo, no una lista global. */
export interface Declaracion extends Marcas {
  readonly id: string
  readonly grupoId: string
  /** aaaa-mm-dd. El dia de la foto. */
  readonly fecha: string
  /** El anio en que arranca el periodo al que cae esta declaracion. Con el
   *  corte el 1 de marzo, el 15 de enero de 2027 es del periodo 2026.
   *
   *  Se guarda y no se deriva. Ademas de ahorrar aritmetica de fechas en SQL:
   *  si algun dia se mueve INICIO_DEL_PERIODO, un periodo calculado al vuelo
   *  re-particionaria la historia y cambiaria quien fue cobrable en
   *  declaraciones ya emitidas. */
  readonly periodo: number
}

/** Una fila de la nomina: como estaba esa persona el dia de la declaracion.
 *
 *  Guarda nombre y documento y no solo el id por la misma razon por la que una
 *  factura guarda el nombre del cliente: lo que se le presenta a la asociacion
 *  identifica gente por documento, y si en 2027 alguien corrige un apellido, la
 *  nomina de mayo de 2026 tiene que seguir leyendose como se leia entonces.
 *
 *  No lleva id ni marcas: la declaracion ya tiene su creadoEn, y el par
 *  (declaracion, persona) es la clave. */
export interface Afiliado {
  readonly declaracionId: string
  readonly personaId: string
  readonly tipoDeDocumento: TipoDeDocumento
  readonly numeroDeDocumento: string
  readonly nombres: string
  readonly apellidos: string
}
```

`packages/afiliacion/src/dominio/index.ts`:

```ts
export { FECHAS_ORDINARIAS, INICIO_DEL_PERIODO } from './config'
export type { Afiliado, Declaracion } from './modelos'
export { fechasOrdinariasDelPeriodo, periodoDe } from './periodos'
export { validarFecha } from './validaciones'
```

- [ ] **Step 12: Verificar todo y commitear**

```bash
bun run check
git add -A
git commit -m "feat(afiliacion): el paquete y su dominio

El periodo con dia de corte configurable -que no es el anio del almanaque,
porque los campamentos caen en enero-, las fechas ordinarias y la
validacion de la fecha de una declaracion."
```

---

### Task 6: Las tablas y la migración

**Files:**
- Create: `packages/afiliacion/drizzle.config.ts`, `packages/afiliacion/src/servidor/tablas.ts`,
  `packages/afiliacion/src/servidor/sql.d.ts`, `packages/afiliacion/src/servidor/migraciones.ts`
- Create: `packages/afiliacion/migraciones/0000_inicial.sql` (la genera drizzle-kit)
- Test: `packages/afiliacion/test/migraciones.test.ts`

**Interfaces:**
- Produces: `declaraciones` y `afiliados` (tablas de Drizzle), y `migraciones` para el `Module`.

- [ ] **Step 1: Copiar la plomería de drizzle**

`packages/afiliacion/drizzle.config.ts` y `packages/afiliacion/src/servidor/sql.d.ts`:
copiar tal cual desde `packages/personas/`. No cambia una línea.

- [ ] **Step 2: Escribir `tablas.ts`**

`packages/afiliacion/src/servidor/tablas.ts`:

```ts
import type { TipoDeDocumento } from '@gps/personas/dominio'
import { index, integer, primaryKey, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'

// Se esparce en cada tabla en vez de abstraerse en core: Drizzle necesita las
// columnas declaradas literalmente para poder inferir los tipos de las filas.
const marcas = {
  creadoEn: integer('creado_en', { mode: 'timestamp_ms' }).notNull(),
  actualizadoEn: integer('actualizado_en', { mode: 'timestamp_ms' }).notNull(),
}

/** La nomina que un grupo presenta en una fecha.
 *
 *  `grupo_id` va sin foreign key: la tabla `grupos` es de estructura y
 *  declararla exigiria importar su tablas.ts, que es privado. La integridad la
 *  da gruposAbiertosEn al declarar. Es la misma perdida consciente que en
 *  pertenencias; ver §7.4 de la spec de pertenencia.
 *
 *  El UNIQUE sobre (fecha, grupo_id) es lo que hace idempotente al barrido:
 *  correrlo mil veces no puede duplicar nada, asi que quien lo llama y cuando
 *  deja de ser una decision delicada.
 *
 *  El indice por periodo es para el anti-join de "a cobrar" y para
 *  afiliadosEn, que preguntan siempre por un periodo. */
export const declaraciones = sqliteTable(
  'declaraciones',
  {
    id: text('id').primaryKey(),
    grupoId: text('grupo_id').notNull(),
    fecha: text('fecha').notNull(),
    periodo: integer('periodo').notNull(),
    ...marcas,
  },
  (tabla) => [
    unique().on(tabla.fecha, tabla.grupoId),
    index('declaracion_por_periodo').on(tabla.periodo),
  ],
)

/** Las filas de una nomina, congeladas: como estaba cada persona ese dia.
 *
 *  Contra `declaraciones` la foreign key si va -es del mismo modulo-; contra
 *  `personas` no, por lo mismo que grupo_id.
 *
 *  Sin id ni marcas: la declaracion ya tiene su creadoEn, y el par
 *  (declaracion, persona) es la clave natural y la primaria.
 *
 *  El indice por persona_id es para afiliadosEn, la unica lectura que no entra
 *  por declaracion_id y la que corre en cada carga de la lista de un grupo. */
export const afiliados = sqliteTable(
  'afiliados',
  {
    declaracionId: text('declaracion_id')
      .notNull()
      .references(() => declaraciones.id),
    personaId: text('persona_id').notNull(),
    tipoDeDocumento: text('tipo_de_documento').$type<TipoDeDocumento>().notNull(),
    numeroDeDocumento: text('numero_de_documento').notNull(),
    nombres: text('nombres').notNull(),
    apellidos: text('apellidos').notNull(),
  },
  (tabla) => [
    primaryKey({ columns: [tabla.declaracionId, tabla.personaId] }),
    index('afiliado_por_persona').on(tabla.personaId),
  ],
)
```

- [ ] **Step 3: Generar la migración**

Run, parado en el paquete:

```bash
cd packages/afiliacion && bunx drizzle-kit generate --name inicial && cd ../..
```

Expected: aparece `packages/afiliacion/migraciones/0000_inicial.sql`. Abrirlo y verificar
que crea las dos tablas, el `UNIQUE` sobre `(fecha, grupo_id)`, la primaria compuesta de
`afiliados` y los dos índices.

- [ ] **Step 4: Escribir `migraciones.ts`**

`packages/afiliacion/src/servidor/migraciones.ts`:

```ts
// La referencia es necesaria porque quien importa este archivo desde otro
// paquete no incluye sql.d.ts en su propio tsconfig: sin esta linea tsc no sabe
// que tipo tiene el import de abajo fuera de este paquete.
/// <reference path="./sql.d.ts" />
import type { Migracion } from '@gps/core'
import inicial from '../../migraciones/0000_inicial.sql' with { type: 'text' }

/** Las migraciones del modulo, en orden. Agregar una es generarla con
 *  `bunx drizzle-kit generate --name <x>` y sumarle una linea a esta lista.
 *
 *  Ojo con `with { type: 'text' }`: es una extension de Bun que Metro no
 *  soporta. Es deuda conocida, la misma que tienen estructura y personas. */
export const migraciones: readonly Migracion[] = [{ nombre: '0000_inicial', sql: inicial }]
```

- [ ] **Step 5: Escribir el test de la migración**

`packages/afiliacion/test/migraciones.test.ts`:

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
    modulos: ['afiliacion'],
    nuevoId: (prefijo) => `${prefijo}_fijo`,
  }
}

const moduloFalso: Module<object> = {
  name: 'afiliacion',
  dependencies: [],
  migraciones,
  createServices: () => ({}),
  registerSchema: () => {},
}

let bd: Bd

beforeEach(() => {
  const base = new Database(':memory:')
  base.exec('PRAGMA foreign_keys = ON')
  bd = drizzle(base)
  aplicarMigraciones(coreDePrueba(bd), [moduloFalso])
})

const declarar = (id: string, grupoId: string, fecha: string, periodo: number) =>
  bd.run(
    sql`INSERT INTO declaraciones VALUES (${id}, ${grupoId}, ${fecha}, ${periodo}, 0, 0)`,
  )

const afiliar = (declaracionId: string, personaId: string) =>
  bd.run(
    sql`INSERT INTO afiliados
        VALUES (${declaracionId}, ${personaId}, 'dni', '30111222', 'Ana', 'Perez')`,
  )

describe('migraciones de afiliacion', () => {
  test('crea las tablas del modulo', () => {
    const nombres = bd
      .values<[string]>(sql`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`)
      .map(([nombre]) => nombre)
    expect(nombres).toEqual(['afiliados', 'declaraciones', 'migraciones'])
  })

  test('un grupo no puede declarar dos veces el mismo dia', () => {
    // Es lo que hace idempotente al barrido: sin este UNIQUE, correrlo dos
    // veces duplicaria cada nomina.
    declarar('d1', 'grupo_1', '2026-05-01', 2026)
    expect(() => declarar('d2', 'grupo_1', '2026-05-01', 2026)).toThrow()
  })

  test('pero dos grupos si declaran el mismo dia', () => {
    // Las ordinarias son una declaracion por grupo, todas con la misma fecha.
    declarar('d1', 'grupo_1', '2026-05-01', 2026)
    expect(() => declarar('d2', 'grupo_2', '2026-05-01', 2026)).not.toThrow()
  })

  test('una persona no puede estar dos veces en la misma nomina', () => {
    declarar('d1', 'grupo_1', '2026-05-01', 2026)
    afiliar('d1', 'persona_1')
    expect(() => afiliar('d1', 'persona_1')).toThrow()
  })

  test('la fecha es texto y el periodo es entero', () => {
    // Si la fecha vuelve a ser integer, vuelve a ser un instante y con el la
    // zona horaria. Es la decision que mas facil se pierde en una migracion
    // regenerada sin mirar.
    const columnas = bd.all<{ name: string; type: string }>(sql`PRAGMA table_info(declaraciones)`)
    expect(columnas.find((columna) => columna.name === 'fecha')?.type).toBe('TEXT')
    expect(columnas.find((columna) => columna.name === 'periodo')?.type).toBe('INTEGER')
  })
})
```

- [ ] **Step 6: Correr y verificar que pasa**

Run: `bun test packages/afiliacion/test/migraciones.test.ts`
Expected: PASS, 5 tests. Si "crea las tablas" falla por el orden, ajustar el `toEqual` al
orden alfabético real que devuelve SQLite.

- [ ] **Step 7: Verificar todo y commitear**

```bash
bun run check
git add -A
git commit -m "feat(afiliacion): las dos tablas y su migracion

declaraciones con UNIQUE(fecha, grupo_id) -que es lo que hace idempotente
al barrido- y afiliados con la nomina congelada."
```

---

### Task 7: `declarar`, `declararExtraordinaria` y `listarAfiliados`

El corazón del módulo: fotografiar. Esta tarea deja las nóminas escritas y legibles; a
quién hay que cobrarle es la Tarea 8.

**Sobre el reloj de estos tests.** El escenario de §1 de la spec se cuenta en 2026, pero
los relojes falsos van en los setenta. La traducción es directa: marzo de 1969, mayo de
1969, noviembre de 1969, mayo de 1970. El reloj se fija en **`1971-06-01T00:00:00Z`**,
porque `declarar` rechaza fechas futuras y tiene que ser posterior a todas las del
escenario —incluido el campamento de enero de 1971 de la Tarea 8—. Sigue siendo
inconfundiblemente falso: una fecha de 1971 no es la hora de ninguna máquina.

**Files:**
- Create: `packages/afiliacion/src/servidor/servicio.ts`
- Test: `packages/afiliacion/test/servicio.test.ts`

**Interfaces:**
- Consumes: `Personas` y `MiembroActivo` de `@gps/personas/dominio` (Tarea 3),
  `Estructura` de `@gps/estructura/dominio` (Tarea 2), `aFechaDeCalendario` de
  `@gps/core/fechas` (Tarea 1), `periodoDe` y `validarFecha` del dominio (Tarea 5),
  `declaraciones` y `afiliados` de `./tablas` (Tarea 6).
- Produces:
  - `crearServicioDeAfiliacion(core: Core, personas: Personas, estructura: Estructura): ServicioDeAfiliacion`
  - `interface ServicioDeAfiliacion` con `declarar(fecha, grupoId?)`,
    `declararExtraordinaria(grupoId)` y `listarAfiliados(declaracionId)`
  - `class FechaInvalida extends Error`, `class NadaQueDeclarar extends Error`

- [ ] **Step 1: Escribir el andamiaje de los tests y los primeros casos**

`packages/afiliacion/test/servicio.test.ts`:

```ts
import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { aplicarMigraciones, type Bd, type Core, type Module, type Reloj } from '@gps/core'
import type { Estructura } from '@gps/estructura/dominio'
import type { MiembroActivo, Personas } from '@gps/personas/dominio'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migraciones } from '../src/servidor/migraciones'
import {
  crearServicioDeAfiliacion,
  FechaInvalida,
  NadaQueDeclarar,
  type ServicioDeAfiliacion,
} from '../src/servidor/servicio'

/** Posterior a toda fecha del escenario -mayo del 71 incluido- porque declarar
 *  rechaza el futuro. Sigue en los setenta: una hora del sistema colada se
 *  distingue de un vistazo en vez de parecer plausible.
 *
 *  Al mediodia y no a medianoche: aFechaDeCalendario usa componentes locales,
 *  asi que un instante a las 00:00 UTC cae en el dia anterior en cualquier zona
 *  al oeste de Greenwich. Con las 12:00 el dia es el mismo de Auckland a
 *  Honolulu, y el test no pasa o falla segun donde corra. */
const HORA = new Date('1971-06-01T12:00:00Z')

interface Miembro {
  id: string
  nombres: string
  apellidos: string
  documento: string
  grupoId: string
  desde: string
  /** Sin `hasta` sigue vigente, igual que en la tabla real. */
  hasta?: string
}

/** Un personas falso que aplica la misma regla que miembrosActivos de verdad:
 *  las dos puntas inclusivas. El servicio recibe la dependencia por el
 *  constructor, asi que el test no necesita levantar el otro modulo. */
function personasFalsas(miembros: readonly Miembro[]): Personas {
  return {
    async miembrosActivos(fecha) {
      return miembros
        .filter((uno) => uno.desde <= fecha && (uno.hasta === undefined || fecha <= uno.hasta))
        .map(
          (uno): MiembroActivo => ({
            grupoId: uno.grupoId,
            persona: {
              id: uno.id,
              tipoDeDocumento: 'dni',
              numeroDeDocumento: uno.documento,
              nombres: uno.nombres,
              apellidos: uno.apellidos,
              fechaDeNacimiento: '1950-01-01',
              creadoEn: HORA,
              actualizadoEn: HORA,
            },
          }),
        )
    },
  }
}

/** Una estructura falsa. `obtenerGrupo` tira: afiliacion no lo usa, y si algun
 *  dia empieza a usarlo el test tiene que enterarse en vez de recibir null. */
function estructuraFalsa(
  grupos: readonly { id: string; cerradoEn?: string }[] = [{ id: 'grupo_7' }],
): Estructura {
  return {
    async obtenerGrupo() {
      throw new Error('afiliacion no deberia llamar a obtenerGrupo')
    },
    async gruposAbiertosEn(fecha) {
      return new Set(
        grupos
          .filter((grupo) => grupo.cerradoEn === undefined || fecha <= grupo.cerradoEn)
          .map((grupo) => grupo.id),
      )
    },
  }
}

function montar(opciones: {
  miembros?: readonly Miembro[]
  grupos?: readonly { id: string; cerradoEn?: string }[]
  reloj?: Reloj
} = {}): ServicioDeAfiliacion {
  const base = new Database(':memory:')
  base.exec('PRAGMA foreign_keys = ON')
  const bd: Bd = drizzle(base)

  let contador = 0
  const core: Core = {
    config: { version: '0.0.0', entorno: 'prueba', puerto: 0 },
    logger: { info: () => {}, error: () => {} },
    reloj: opciones.reloj ?? { ahora: () => HORA },
    bd,
    modulos: ['estructura', 'personas', 'afiliacion'],
    nuevoId: (prefijo) => `${prefijo}_${++contador}`,
  }

  const modulo: Module<object> = {
    name: 'afiliacion',
    dependencies: [],
    migraciones,
    createServices: () => ({}),
    registerSchema: () => {},
  }
  aplicarMigraciones(core, [modulo])

  return crearServicioDeAfiliacion(
    core,
    personasFalsas(opciones.miembros ?? []),
    estructuraFalsa(opciones.grupos),
  )
}

/** El escenario de §1 de la spec, trasladado a los setenta: Juan y Maria
 *  entran en marzo, Maria se va en junio, Pedro entra en julio. */
const ESCENARIO: readonly Miembro[] = [
  {
    id: 'persona_juan',
    nombres: 'Juan',
    apellidos: 'Barreto',
    documento: '30111222',
    grupoId: 'grupo_7',
    desde: '1969-03-01',
  },
  {
    id: 'persona_maria',
    nombres: 'María',
    apellidos: 'Cabral',
    documento: '30111333',
    grupoId: 'grupo_7',
    desde: '1969-03-01',
    hasta: '1969-06-30',
  },
  {
    id: 'persona_pedro',
    nombres: 'Pedro',
    apellidos: 'Almada',
    documento: '30111444',
    grupoId: 'grupo_7',
    desde: '1969-07-01',
  },
]

const nombresDe = (afiliados: readonly { nombres: string }[]) =>
  afiliados.map((afiliado) => afiliado.nombres)

describe('declarar', () => {
  test('la nomina de mayo son los dos que entraron en marzo', async () => {
    const servicio = montar({ miembros: ESCENARIO })
    const [declaracion] = await servicio.declarar('1969-05-01')

    expect(declaracion?.grupoId).toBe('grupo_7')
    expect(declaracion?.periodo).toBe(1969)
    expect(nombresDe(await servicio.listarAfiliados(declaracion?.id ?? ''))).toEqual([
      'Juan',
      'María',
    ])
  })

  test('la nomina de noviembre ya no tiene a la que se fue, y si al que entro', async () => {
    const servicio = montar({ miembros: ESCENARIO })
    await servicio.declarar('1969-05-01')
    const [noviembre] = await servicio.declarar('1969-11-01')

    expect(nombresDe(await servicio.listarAfiliados(noviembre?.id ?? ''))).toEqual([
      'Pedro',
      'Juan',
    ])
  })

  test('la nomina va ordenada por apellido, con Intl y no con ORDER BY', async () => {
    // SQLite compara bytes, asi que un ORDER BY pondria "Ávila" despues de
    // "Zaballa". En un idioma con acentos eso es una lista en la que no se
    // encuentra a la gente.
    const servicio = montar({
      miembros: [
        { ...ESCENARIO[0]!, apellidos: 'Zaballa' },
        { ...ESCENARIO[1]!, hasta: undefined, apellidos: 'Ávila' },
      ],
    })
    const [declaracion] = await servicio.declarar('1969-05-01')
    const nomina = await servicio.listarAfiliados(declaracion?.id ?? '')
    expect(nomina.map((afiliado) => afiliado.apellidos)).toEqual(['Ávila', 'Zaballa'])
  })

  test('la nomina guarda el documento, no solo el id', async () => {
    // Es lo que se le presenta a la asociacion, que identifica gente por
    // documento y no por nuestro id interno.
    const servicio = montar({ miembros: ESCENARIO })
    const [declaracion] = await servicio.declarar('1969-05-01')
    const nomina = await servicio.listarAfiliados(declaracion?.id ?? '')
    expect(nomina[0]).toMatchObject({ tipoDeDocumento: 'dni', numeroDeDocumento: '30111222' })
  })

  test('declara una nomina por grupo', async () => {
    const servicio = montar({
      miembros: [ESCENARIO[0]!, { ...ESCENARIO[2]!, grupoId: 'grupo_12', desde: '1969-03-01' }],
      grupos: [{ id: 'grupo_7' }, { id: 'grupo_12' }],
    })
    const nuevas = await servicio.declarar('1969-05-01')
    expect(nuevas.map((una) => una.grupoId).sort()).toEqual(['grupo_12', 'grupo_7'])
  })

  test('un grupo cerrado no declara', async () => {
    const servicio = montar({
      miembros: ESCENARIO,
      grupos: [{ id: 'grupo_7', cerradoEn: '1969-10-15' }],
    })
    expect(await servicio.declarar('1969-11-01')).toEqual([])
  })

  test('pero si declaraba antes de cerrar', async () => {
    // El grupo existia el dia de la declaracion: la nomina es legitima.
    const servicio = montar({
      miembros: ESCENARIO,
      grupos: [{ id: 'grupo_7', cerradoEn: '1969-10-15' }],
    })
    expect(await servicio.declarar('1969-05-01')).toHaveLength(1)
  })

  test('un grupo sin nadie activo no declara', async () => {
    const servicio = montar({ miembros: [] })
    expect(await servicio.declarar('1969-05-01')).toEqual([])
  })

  test('un grupo no puede declarar dos veces el mismo dia', async () => {
    const servicio = montar({ miembros: ESCENARIO })
    await servicio.declarar('1969-05-01')
    expect(servicio.declarar('1969-05-01')).rejects.toThrow()
  })

  test('rechaza una fecha anterior a la ultima declaracion', async () => {
    // La regla es global y no por grupo: una declaracion retroactiva le moveria
    // el a-cobrar a una ya emitida de otro grupo.
    const servicio = montar({
      miembros: [ESCENARIO[0]!, { ...ESCENARIO[2]!, grupoId: 'grupo_12', desde: '1969-03-01' }],
      grupos: [{ id: 'grupo_7' }, { id: 'grupo_12' }],
    })
    await servicio.declarar('1969-11-01', 'grupo_7')
    expect(servicio.declarar('1969-05-01', 'grupo_12')).rejects.toThrow(FechaInvalida)
  })

  test('rechaza una fecha futura', async () => {
    const servicio = montar({ miembros: ESCENARIO })
    expect(servicio.declarar('1999-05-01')).rejects.toThrow(FechaInvalida)
  })
})

describe('declararExtraordinaria', () => {
  test('declara ese grupo solo, con la fecha de hoy', async () => {
    const servicio = montar({
      miembros: [ESCENARIO[0]!, { ...ESCENARIO[2]!, grupoId: 'grupo_12', desde: '1969-03-01' }],
      grupos: [{ id: 'grupo_7' }, { id: 'grupo_12' }],
    })
    const declaracion = await servicio.declararExtraordinaria('grupo_7')

    expect(declaracion.grupoId).toBe('grupo_7')
    expect(declaracion.fecha).toBe('1971-06-01')
  })

  test('avisa si el grupo no tiene a nadie que declarar', async () => {
    const servicio = montar({ miembros: [] })
    expect(servicio.declararExtraordinaria('grupo_7')).rejects.toThrow(NadaQueDeclarar)
  })
})
```

Que la extraordinaria no toque al `grupo_12` se prueba en la Tarea 8, cuando exista
`listarDeclaraciones`.

- [ ] **Step 2: Correr y verificar que falla**

Run: `bun test packages/afiliacion/test/servicio.test.ts`
Expected: FAIL — no existe `../src/servidor/servicio`.

- [ ] **Step 3: Escribir el servicio**

`packages/afiliacion/src/servidor/servicio.ts`:

```ts
import type { Core } from '@gps/core'
import { aFechaDeCalendario } from '@gps/core/fechas'
import type { Estructura } from '@gps/estructura/dominio'
import type { MiembroActivo, Personas } from '@gps/personas/dominio'
import { eq, max } from 'drizzle-orm'
import type { Afiliado, Declaracion } from '../dominio/modelos'
import { periodoDe } from '../dominio/periodos'
import { validarFecha } from '../dominio/validaciones'
import { afiliados, declaraciones } from './tablas'

/** La fecha de la declaracion no sirve: futura, mal formada, o anterior a la
 *  ultima ya emitida. Un solo tipo y no tres clases: las tres condiciones son
 *  sobre el mismo campo y el consumidor las trata igual. */
export class FechaInvalida extends Error {
  constructor(motivo: string) {
    super(motivo)
    this.name = 'FechaInvalida'
  }
}

/** Se pidio una declaracion extraordinaria de un grupo que no tiene a nadie
 *  activo, o que esta cerrado. */
export class NadaQueDeclarar extends Error {
  constructor(grupoId: string) {
    super('El grupo no tiene miembros activos para declarar, o está cerrado.')
    this.name = 'NadaQueDeclarar'
    this.grupoId = grupoId
  }
  readonly grupoId: string
}

export interface ServicioDeAfiliacion {
  /** Fotografia a los miembros activos del dia `fecha`. Sin `grupoId` declara
   *  todos los grupos abiertos con al menos un activo; con `grupoId`, ese solo.
   *  Devuelve una declaracion por grupo. */
  declarar(fecha: string, grupoId?: string): Promise<readonly Declaracion[]>

  /** La extraordinaria: fotografia ese grupo con la fecha de hoy. Existe aparte
   *  de `declarar` porque el resolver no puede armar la fecha: Context lleva
   *  `actor` y nada mas, asi que al reloj solo lo alcanza el servicio. */
  declararExtraordinaria(grupoId: string): Promise<Declaracion>

  /** La nomina de esa declaracion, ordenada por apellido. */
  listarAfiliados(declaracionId: string): Promise<readonly Afiliado[]>
}

/** El orden alfabetico lo hace Intl y no un ORDER BY: SQLite compara bytes, asi
 *  que "Ávila" caeria despues de "Zaballa". Es el mismo criterio que
 *  listarPersonas, y por la misma razon. */
const alfabeto = new Intl.Collator('es')

/** `personas` y `estructura` entran por el constructor y no por el contexto:
 *  son dependencias declaradas del modulo, que la raiz de composicion pasa ya
 *  construidas. Asi el servicio las puede usar sin saber si hay un request
 *  encima, que es lo que le permite correr dentro del telefono. */
export function crearServicioDeAfiliacion(
  core: Core,
  personas: Personas,
  estructura: Estructura,
): ServicioDeAfiliacion {
  /** La fecha de la declaracion mas reciente de toda la asociacion, o null si
   *  no hay ninguna. Global y no por grupo a proposito: ver validarFecha. */
  function ultimaFecha(): string | null {
    return (
      core.bd.select({ fecha: max(declaraciones.fecha) }).from(declaraciones).get()?.fecha ?? null
    )
  }

  async function listarAfiliados(declaracionId: string): Promise<readonly Afiliado[]> {
    return core.bd
      .select()
      .from(afiliados)
      .where(eq(afiliados.declaracionId, declaracionId))
      .all()
      .sort(
        (uno, otro) =>
          alfabeto.compare(uno.apellidos, otro.apellidos) ||
          alfabeto.compare(uno.nombres, otro.nombres),
      )
  }

  async function declarar(fecha: string, grupoId?: string): Promise<readonly Declaracion[]> {
    const motivo = validarFecha(fecha, ultimaFecha(), aFechaDeCalendario(core.reloj.ahora()))
    if (motivo !== null) throw new FechaInvalida(motivo)

    const abiertos = await estructura.gruposAbiertosEn(fecha)
    const activos = await personas.miembrosActivos(fecha)

    const porGrupo = new Map<string, MiembroActivo[]>()
    for (const activo of activos) {
      // Un grupo cerrado no declara. Un grupo que cerro despues de `fecha` si:
      // existia ese dia, y la nomina de ese dia es legitima.
      if (!abiertos.has(activo.grupoId)) continue
      if (grupoId !== undefined && activo.grupoId !== grupoId) continue
      const suyos = porGrupo.get(activo.grupoId) ?? []
      suyos.push(activo)
      porGrupo.set(activo.grupoId, suyos)
    }
    // Los grupos vacios no generan nomina. Ademas de ser lo obvio, es lo que
    // deja a afiliacion sin tener que pedirle la lista de grupos a estructura:
    // sale de miembrosActivos.
    if (porGrupo.size === 0) return []

    const ahora = core.reloj.ahora()
    const periodo = periodoDe(fecha)
    const nuevas: Declaracion[] = []
    const filas: (typeof afiliados.$inferInsert)[] = []

    for (const [suGrupo, miembros] of porGrupo) {
      const declaracion: Declaracion = {
        id: core.nuevoId('declaracion'),
        grupoId: suGrupo,
        fecha,
        periodo,
        creadoEn: ahora,
        actualizadoEn: ahora,
      }
      nuevas.push(declaracion)
      for (const { persona } of miembros) {
        // Nombre y documento se copian, no se referencian: la nomina es un
        // documento contable y tiene que seguir leyendose como se leia ese dia.
        filas.push({
          declaracionId: declaracion.id,
          personaId: persona.id,
          tipoDeDocumento: persona.tipoDeDocumento,
          numeroDeDocumento: persona.numeroDeDocumento,
          nombres: persona.nombres,
          apellidos: persona.apellidos,
        })
      }
    }

    // Las dos escrituras en una transaccion: una declaracion sin nomina seria
    // una deuda de cero que nadie podria distinguir de un error.
    core.bd.transaction((tx) => {
      tx.insert(declaraciones).values(nuevas).run()
      tx.insert(afiliados).values(filas).run()
    })

    return nuevas
  }

  return {
    declarar,
    listarAfiliados,

    async declararExtraordinaria(grupoId) {
      const [declaracion] = await declarar(aFechaDeCalendario(core.reloj.ahora()), grupoId)
      if (!declaracion) throw new NadaQueDeclarar(grupoId)
      return declaracion
    },
  }
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `bun test packages/afiliacion/test/servicio.test.ts`
Expected: PASS. Si el test de "declara una nomina por grupo" falla por orden, es porque el
`Map` conserva el orden de aparición en `miembrosActivos`: el `.sort()` del `expect` ya lo
cubre.

- [ ] **Step 5: Verificar todo y commitear**

```bash
bun run check
git add -A
git commit -m "feat(afiliacion): declarar, la fotografia de la nomina

Una declaracion por grupo abierto con activos, con nombre y documento
copiados y no referenciados: la nomina es un documento contable y tiene
que seguir leyendose como se leia ese dia."
```

---

### Task 8: Las lecturas — `listarACobrar`, `listarDeclaraciones` y `afiliadosEn`

Acá vive la regla que impide que "una declaración por grupo" degenere en el modelo
persona-grupo que la spec descartó: **el anti-join cruza grupos**.

**Files:**
- Modify: `packages/afiliacion/src/servidor/servicio.ts`
- Test: `packages/afiliacion/test/servicio.test.ts`

**Interfaces:**
- Produces, sobre `ServicioDeAfiliacion`:
  - `listarDeclaraciones(grupoId: string): Promise<readonly Declaracion[]>`
  - `listarACobrar(declaracionId: string): Promise<readonly Afiliado[]>`
  - `afiliadosEn(periodo: number, personaIds: readonly string[]): Promise<ReadonlySet<string>>`

- [ ] **Step 1: Escribir los tests que fallan**

Agregar a `packages/afiliacion/test/servicio.test.ts`:

```ts
describe('listarACobrar', () => {
  test('el escenario completo de la spec: 1 + 1 + 1 en dos periodos', async () => {
    const servicio = montar({ miembros: ESCENARIO })

    const [mayo] = await servicio.declarar('1969-05-01')
    expect(nombresDe(await servicio.listarACobrar(mayo?.id ?? ''))).toEqual(['Juan', 'María'])

    // Noviembre: la nomina son Juan y Pedro, pero Juan ya esta pago desde mayo
    // y lo de Maria no se recupera. Se cobra uno solo.
    const [noviembre] = await servicio.declarar('1969-11-01')
    expect(nombresDe(await servicio.listarACobrar(noviembre?.id ?? ''))).toEqual(['Pedro'])

    // Periodo nuevo: el ciclo arranca de cero y se cobra a todos los activos.
    const [mayoSiguiente] = await servicio.declarar('1970-05-01')
    expect(nombresDe(await servicio.listarACobrar(mayoSiguiente?.id ?? ''))).toEqual([
      'Pedro',
      'Juan',
    ])
  })

  test('el que se muda de grupo no se paga dos veces', async () => {
    // La afiliacion es de la persona con la asociacion, no del vinculo con un
    // grupo. Ana esta en la nomina de noviembre del Grupo 12 y no se le cobra,
    // porque el Grupo 7 ya pago por ella en mayo. Es el test que prueba que el
    // anti-join cruza grupos.
    const servicio = montar({
      miembros: [
        {
          id: 'persona_ana',
          nombres: 'Ana',
          apellidos: 'Duarte',
          documento: '30111555',
          grupoId: 'grupo_7',
          desde: '1969-03-01',
          hasta: '1969-06-30',
        },
        {
          id: 'persona_ana',
          nombres: 'Ana',
          apellidos: 'Duarte',
          documento: '30111555',
          grupoId: 'grupo_12',
          desde: '1969-07-01',
        },
      ],
      grupos: [{ id: 'grupo_7' }, { id: 'grupo_12' }],
    })

    const [mayo] = await servicio.declarar('1969-05-01')
    expect(nombresDe(await servicio.listarACobrar(mayo?.id ?? ''))).toEqual(['Ana'])

    const [noviembre] = await servicio.declarar('1969-11-01')
    expect(noviembre?.grupoId).toBe('grupo_12')
    expect(nombresDe(await servicio.listarAfiliados(noviembre?.id ?? ''))).toEqual(['Ana'])
    expect(await servicio.listarACobrar(noviembre?.id ?? '')).toEqual([])
  })

  test('los cocineros: una extraordinaria barre a todos los pendientes', async () => {
    // No solo a los recien llegados. Quien entro en junio y todavia no estaba
    // afiliado tambien se cobra: lo debe igual, y es lo que mantiene
    // "declaracion" como un solo concepto en vez de dos.
    const servicio = montar({
      miembros: [
        ESCENARIO[0]!,
        { ...ESCENARIO[2]!, desde: '1969-06-15' },
        {
          id: 'persona_cocinera',
          nombres: 'Rosario',
          apellidos: 'Zaballa',
          documento: '30111666',
          grupoId: 'grupo_7',
          desde: '1969-09-01',
        },
      ],
      reloj: { ahora: () => new Date('1969-09-15T12:00:00Z') },
    })

    const [mayo] = await servicio.declarar('1969-05-01')
    expect(nombresDe(await servicio.listarACobrar(mayo?.id ?? ''))).toEqual(['Juan'])

    const extraordinaria = await servicio.declararExtraordinaria('grupo_7')
    expect(nombresDe(await servicio.listarACobrar(extraordinaria.id))).toEqual([
      'Pedro',
      'Rosario',
    ])
  })

  test('el campamento de enero sigue cubierto por la afiliacion de noviembre', async () => {
    // Es el caso que motiva que el periodo no sea el anio del almanaque. Con el
    // corte el 1 de marzo, enero del 71 es todavia del periodo 1970.
    const servicio = montar({ miembros: ESCENARIO })

    const [noviembre] = await servicio.declarar('1970-11-01')
    expect(noviembre?.periodo).toBe(1970)
    expect(nombresDe(await servicio.listarACobrar(noviembre?.id ?? ''))).toEqual(['Pedro', 'Juan'])

    const [enero] = await servicio.declarar('1971-01-15')
    expect(enero?.periodo).toBe(1970)
    expect(await servicio.listarACobrar(enero?.id ?? '')).toEqual([])

    // Recien en mayo, ya en el periodo 1971, vuelven a ser cobrables.
    const [mayo] = await servicio.declarar('1971-05-01')
    expect(mayo?.periodo).toBe(1971)
    expect(nombresDe(await servicio.listarACobrar(mayo?.id ?? ''))).toEqual(['Pedro', 'Juan'])
  })
})

describe('listarDeclaraciones', () => {
  test('las de ese grupo, de la mas reciente a la mas vieja', async () => {
    const servicio = montar({ miembros: ESCENARIO })
    await servicio.declarar('1969-05-01')
    await servicio.declarar('1969-11-01')

    const listadas = await servicio.listarDeclaraciones('grupo_7')
    expect(listadas.map((una) => una.fecha)).toEqual(['1969-11-01', '1969-05-01'])
  })

  test('no devuelve las de otro grupo', async () => {
    const servicio = montar({ miembros: ESCENARIO })
    await servicio.declarar('1969-05-01')
    expect(await servicio.listarDeclaraciones('grupo_12')).toEqual([])
  })
})

describe('afiliadosEn', () => {
  test('devuelve solo los que ya estan afiliados en ese periodo', async () => {
    const servicio = montar({ miembros: ESCENARIO })
    await servicio.declarar('1969-05-01')

    const afiliados = await servicio.afiliadosEn(1969, [
      'persona_juan',
      'persona_maria',
      'persona_pedro',
    ])
    expect(afiliados.has('persona_juan')).toBe(true)
    expect(afiliados.has('persona_pedro')).toBe(false)
  })

  test('el periodo siguiente arranca vacio', async () => {
    const servicio = montar({ miembros: ESCENARIO })
    await servicio.declarar('1969-05-01')
    expect(await servicio.afiliadosEn(1970, ['persona_juan'])).toEqual(new Set())
  })

  test('sin ids que preguntar no consulta la base', async () => {
    const servicio = montar({ miembros: ESCENARIO })
    expect(await servicio.afiliadosEn(1969, [])).toEqual(new Set())
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `bun test packages/afiliacion/test/servicio.test.ts`
Expected: FAIL — `servicio.listarACobrar is not a function`.

- [ ] **Step 3: Agregar los tres métodos a la interfaz**

En `packages/afiliacion/src/servidor/servicio.ts`, dentro de `ServicioDeAfiliacion`:

```ts
  /** Las declaraciones de ese grupo, de la mas reciente a la mas vieja.
   *
   *  El grupo es obligatorio: la pantalla que existe es la del grupo. Se vuelve
   *  opcional el dia que haya una vista de asociacion, que es de Tesoreria. */
  listarDeclaraciones(grupoId: string): Promise<readonly Declaracion[]>

  /** Los de esa nomina que no aparecen en ninguna declaracion anterior del
   *  mismo periodo: lo que Tesoreria va a cobrar. */
  listarACobrar(declaracionId: string): Promise<readonly Afiliado[]>

  /** Los que ya tienen afiliacion en ese periodo, de entre los que se
   *  preguntan. Devuelve el subconjunto afiliado y no un mapa de booleanos: es
   *  la misma informacion y el consumidor la usa igual, sin construir una
   *  entrada por cada persona preguntada. */
  afiliadosEn(periodo: number, personaIds: readonly string[]): Promise<ReadonlySet<string>>
```

- [ ] **Step 4: Implementarlos**

Ampliar el import de drizzle a `import { and, desc, eq, inArray, lt, max } from 'drizzle-orm'`
y agregar al objeto que devuelve `crearServicioDeAfiliacion`:

```ts
    async listarDeclaraciones(grupoId) {
      return core.bd
        .select()
        .from(declaraciones)
        .where(eq(declaraciones.grupoId, grupoId))
        .orderBy(desc(declaraciones.fecha))
        .all()
    },

    async listarACobrar(declaracionId) {
      const declaracion = core.bd
        .select({ fecha: declaraciones.fecha, periodo: declaraciones.periodo })
        .from(declaraciones)
        .where(eq(declaraciones.id, declaracionId))
        .get()
      if (!declaracion) return []

      // El anti-join NO filtra por grupo, y eso no es un olvido: la afiliacion
      // es de la persona con la asociacion, no del vinculo con un grupo. Quien
      // se mudo en julio esta en la nomina de noviembre de su grupo nuevo y no
      // se le cobra, porque el viejo ya pago por ella en mayo. Agregar aca un
      // eq(declaraciones.grupoId, ...) convertiria el modelo en el que la spec
      // descarto en §2.
      const previas = core.bd
        .select({ personaId: afiliados.personaId })
        .from(afiliados)
        .innerJoin(declaraciones, eq(declaraciones.id, afiliados.declaracionId))
        .where(
          and(
            eq(declaraciones.periodo, declaracion.periodo),
            lt(declaraciones.fecha, declaracion.fecha),
          ),
        )
        .all()

      const cubiertos = new Set(previas.map((fila) => fila.personaId))
      return (await listarAfiliados(declaracionId)).filter(
        (afiliado) => !cubiertos.has(afiliado.personaId),
      )
    },

    async afiliadosEn(periodo, personaIds) {
      // Sin ids no hay nada que preguntar, y un inArray vacio en SQL es un
      // WHERE que no compila en algunos dialectos.
      if (personaIds.length === 0) return new Set<string>()

      const filas = core.bd
        .select({ personaId: afiliados.personaId })
        .from(afiliados)
        .innerJoin(declaraciones, eq(declaraciones.id, afiliados.declaracionId))
        .where(
          and(eq(declaraciones.periodo, periodo), inArray(afiliados.personaId, [...personaIds])),
        )
        .all()

      return new Set(filas.map((fila) => fila.personaId))
    },
```

- [ ] **Step 5: Correr y verificar que pasa**

Run: `bun test packages/afiliacion/test/servicio.test.ts`
Expected: PASS, incluidos los cuatro de `listarACobrar`.

- [ ] **Step 6: Verificar todo y commitear**

```bash
bun run check
git add -A
git commit -m "feat(afiliacion): a quien hay que cobrarle

El anti-join cruza grupos a proposito: la afiliacion es de la persona con
la asociacion. Quien se muda a mitad de periodo no se paga dos veces."
```

---

### Task 9: `declararPendientes`

Lo que el barrido llama. Idempotente por la base, no por cuidado.

**Files:**
- Modify: `packages/afiliacion/src/servidor/servicio.ts`
- Test: `packages/afiliacion/test/servicio.test.ts`

**Interfaces:**
- Produces: `declararPendientes(): Promise<readonly Declaracion[]>` sobre `ServicioDeAfiliacion`.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
describe('declararPendientes', () => {
  test('declara las ordinarias del periodo que ya pasaron', async () => {
    // Reloj en noviembre del 69: mayo ya paso, noviembre tambien.
    const servicio = montar({
      miembros: ESCENARIO,
      reloj: { ahora: () => new Date('1969-11-20T12:00:00Z') },
    })
    const nuevas = await servicio.declararPendientes()
    expect(nuevas.map((una) => una.fecha)).toEqual(['1969-05-01', '1969-11-01'])
  })

  test('no declara las que todavia no llegaron', async () => {
    const servicio = montar({
      miembros: ESCENARIO,
      reloj: { ahora: () => new Date('1969-06-15T12:00:00Z') },
    })
    expect((await servicio.declararPendientes()).map((una) => una.fecha)).toEqual(['1969-05-01'])
  })

  test('es idempotente: dos corridas seguidas dejan lo mismo', async () => {
    // Es la propiedad que hace que quien lo llama y cuando deje de ser una
    // decision delicada. La garantiza el UNIQUE(fecha, grupo_id).
    const servicio = montar({
      miembros: ESCENARIO,
      reloj: { ahora: () => new Date('1969-11-20T12:00:00Z') },
    })
    await servicio.declararPendientes()
    expect(await servicio.declararPendientes()).toEqual([])
    expect(await servicio.listarDeclaraciones('grupo_7')).toHaveLength(2)
  })

  test('se pone al dia despues de estar caido', async () => {
    // Las pertenencias tienen historial, asi que la foto del 1 de mayo se puede
    // tomar en noviembre y sale bien.
    const servicio = montar({
      miembros: ESCENARIO,
      reloj: { ahora: () => new Date('1969-11-20T12:00:00Z') },
    })
    await servicio.declararPendientes()
    const [mayo] = (await servicio.listarDeclaraciones('grupo_7')).filter(
      (una) => una.fecha === '1969-05-01',
    )
    expect(nombresDe(await servicio.listarAfiliados(mayo?.id ?? ''))).toEqual(['Juan', 'María'])
  })

  test('no toca las ordinarias de otro periodo', async () => {
    const servicio = montar({
      miembros: ESCENARIO,
      reloj: { ahora: () => new Date('1970-06-15T12:00:00Z') },
    })
    // Estamos en el periodo 1970: solo el 1 de mayo de 1970 esta vencido.
    expect((await servicio.declararPendientes()).map((una) => una.fecha)).toEqual(['1970-05-01'])
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `bun test packages/afiliacion/test/servicio.test.ts`
Expected: FAIL — `servicio.declararPendientes is not a function`.

- [ ] **Step 3: Implementarlo**

Agregar `fechasOrdinariasDelPeriodo` al import de `../dominio/periodos`, declarar el método
en la interfaz:

```ts
  /** Declara toda fecha ordinaria del periodo corriente que ya paso y no tiene
   *  declaracion, en orden. Idempotente: el UNIQUE(fecha, grupo_id) hace que
   *  correrlo mil veces no pueda duplicar nada. */
  declararPendientes(): Promise<readonly Declaracion[]>
```

e implementarlo en el objeto de retorno:

```ts
    async declararPendientes() {
      const hoy = aFechaDeCalendario(core.reloj.ahora())
      const periodo = periodoDe(hoy)
      const yaDeclaradas = new Set(
        core.bd
          .select({ fecha: declaraciones.fecha })
          .from(declaraciones)
          .where(eq(declaraciones.periodo, periodo))
          .all()
          .map((fila) => fila.fecha),
      )

      const nuevas: Declaracion[] = []
      for (const fecha of fechasOrdinariasDelPeriodo(periodo)) {
        if (fecha > hoy || yaDeclaradas.has(fecha)) continue
        try {
          nuevas.push(...(await declarar(fecha)))
        } catch (error) {
          // El unico caso posible es una ordinaria que quedo antes de una
          // extraordinaria ya emitida. En la practica no puede pasar -el
          // barrido corre al arrancar, antes de que haya nadie del otro lado
          // para apretar el boton- pero si pasara, se loguea en vez de tumbar
          // el arranque del servidor entero.
          if (error instanceof FechaInvalida) {
            core.logger.error('No se pudo declarar una afiliacion ordinaria vencida', {
              fecha,
              motivo: error.message,
            })
            continue
          }
          throw error
        }
      }
      return nuevas
    },
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `bun test packages/afiliacion/test/servicio.test.ts`
Expected: PASS, los cinco nuevos incluidos.

- [ ] **Step 5: Verificar todo y commitear**

```bash
bun run check
git add -A
git commit -m "feat(afiliacion): declararPendientes, lo que llama el barrido

Declara toda ordinaria del periodo que ya paso y no tiene declaracion.
Idempotente por el UNIQUE de la tabla, no por cuidado."
```

---

### Task 10: El esquema GraphQL y el registro del módulo

Acá el módulo empieza a existir para el resto del sistema.

**Files:**
- Create: `packages/afiliacion/src/servidor/schema.ts`, `packages/afiliacion/src/servidor/index.ts`
- Modify: `services/backend/src/modules.ts`, `services/backend/package.json`
- Modify: `schema.gql` (regenerado)
- Test: `services/backend/test/schema.test.ts`

**Interfaces:**
- Produces: `export const afiliacion: Module<ServicioDeAfiliacion, { personas: Personas; estructura: Estructura }>`
  y la ampliación `Context.afiliacion`. Las Tareas 11 y 12 la usan como `ctx.afiliacion`.

- [ ] **Step 1: Escribir el schema**

`packages/afiliacion/src/servidor/schema.ts`:

```ts
import { type Builder, enumCompartido } from '@gps/core/graphql'
import { TIPOS_DE_DOCUMENTO } from '@gps/personas/dominio'
import { GraphQLError } from 'graphql'
import type { Afiliado, Declaracion } from '../dominio/modelos'
import { NadaQueDeclarar } from './servicio'

export function registrarSchema(builder: Builder): void {
  // enumCompartido y no builder.enumType: personas declara el mismo enum. La
  // descripcion tiene que ser identica a la de alla, o el helper tira
  // DescripcionesDistintas al componer el esquema.
  const TipoDeDocumentoRef = enumCompartido(
    builder,
    'TipoDeDocumento',
    TIPOS_DE_DOCUMENTO.map((tipo) => tipo.id),
    'Tipos de documento que la asociacion acepta.',
  )

  // Expone nombre y documento como quedaron guardados, no como estan hoy en
  // personas: es una fotografia, no una vista.
  const AfiliadoRef = builder.objectRef<Afiliado>('Afiliado').implement({
    description: 'Una fila de la nómina: cómo estaba esa persona el día de la declaración.',
    fields: (t) => ({
      personaId: t.exposeID('personaId'),
      tipoDeDocumento: t.field({
        type: TipoDeDocumentoRef,
        resolve: (afiliado) => afiliado.tipoDeDocumento,
      }),
      numeroDeDocumento: t.exposeString('numeroDeDocumento'),
      nombres: t.exposeString('nombres'),
      apellidos: t.exposeString('apellidos'),
    }),
  })

  const DeclaracionRef = builder.objectRef<Declaracion>('Declaracion').implement({
    description: 'La nómina que un grupo presenta en una fecha.',
    fields: (t) => ({
      id: t.exposeID('id'),
      fecha: t.exposeString('fecha', {
        description: 'Fecha de calendario en formato aaaa-mm-dd, sin hora ni zona horaria.',
      }),
      periodo: t.exposeInt('periodo', {
        description: 'El año en que arranca el período al que cae esta declaración.',
      }),
      afiliados: t.field({
        type: [AfiliadoRef],
        description: 'La nómina completa del grupo ese día.',
        resolve: async (declaracion, _args, contexto) => [
          ...(await contexto.afiliacion.listarAfiliados(declaracion.id)),
        ],
      }),
      aCobrar: t.field({
        type: [AfiliadoRef],
        description: 'Los de la nómina que todavía no tenían afiliación ese período.',
        resolve: async (declaracion, _args, contexto) => [
          ...(await contexto.afiliacion.listarACobrar(declaracion.id)),
        ],
      }),
    }),
  })

  builder.queryField('declaraciones', (t) =>
    t.field({
      type: [DeclaracionRef],
      description: 'Las declaraciones de un grupo, de la más reciente a la más vieja.',
      args: { grupoId: t.arg.id({ required: true }) },
      resolve: async (_padre, args, contexto) => [
        ...(await contexto.afiliacion.listarDeclaraciones(String(args.grupoId))),
      ],
    }),
  )

  // Query suelta y no un campo de Persona porque la flecha va en la otra
  // direccion: afiliacion depende de personas, y personas no puede llamar a un
  // modulo que no conoce. La pantalla hace las dos queries y cruza por id.
  builder.queryField('afiliadosEn', (t) =>
    t.idList({
      description: 'Los ids, de entre los preguntados, que ya tienen afiliación ese período.',
      args: {
        periodo: t.arg.int({ required: true }),
        personaIds: t.arg.idList({ required: true }),
      },
      resolve: async (_padre, args, contexto) => [
        ...(await contexto.afiliacion.afiliadosEn(
          args.periodo,
          args.personaIds.map((id) => String(id)),
        )),
      ],
    }),
  )

  builder.mutationField('declararAfiliacion', (t) =>
    t.field({
      type: DeclaracionRef,
      description: 'Declaración extraordinaria: fotografía al grupo con la fecha de hoy.',
      args: { grupoId: t.arg.id({ required: true }) },
      resolve: async (_padre, args, contexto) => {
        try {
          return await contexto.afiliacion.declararExtraordinaria(String(args.grupoId))
        } catch (error) {
          // Yoga enmascara todo lo que no sea un GraphQLError: sin esta
          // traduccion, la pantalla recibe "Unexpected error." en vez del
          // motivo. Traducir en el resolver y no en el servicio es lo que
          // mantiene al servicio sin conocer el framework.
          if (error instanceof NadaQueDeclarar) {
            throw new GraphQLError(error.message, { extensions: { code: 'NADA_QUE_DECLARAR' } })
          }
          throw error
        }
      },
    }),
  )
}
```

- [ ] **Step 2: Escribir el `index.ts` del módulo**

`packages/afiliacion/src/servidor/index.ts`:

```ts
import type { Module } from '@gps/core'
import type { Estructura } from '@gps/estructura/dominio'
import type { Personas } from '@gps/personas/dominio'
import { migraciones } from './migraciones'
import { registrarSchema } from './schema'
import { crearServicioDeAfiliacion, type ServicioDeAfiliacion } from './servicio'

// Publica los servicios de este modulo en el contexto de GraphQL.
// Asi es como un modulo alcanza a otro: ctx.<nombre>, nunca por import.
declare module '@gps/core' {
  interface Context {
    readonly afiliacion: ServicioDeAfiliacion
  }
}

export const afiliacion: Module<
  ServicioDeAfiliacion,
  { personas: Personas; estructura: Estructura }
> = {
  name: 'afiliacion',
  // Las dos por lectura y ninguna por escritura: este modulo no toca ni una
  // persona ni un grupo.
  dependencies: ['personas', 'estructura'],
  migraciones,
  createServices: (core, dependencias) =>
    crearServicioDeAfiliacion(core, dependencias.personas, dependencias.estructura),
  registerSchema: registrarSchema,
}

export type { ServicioDeAfiliacion } from './servicio'
export { FechaInvalida, NadaQueDeclarar } from './servicio'
```

- [ ] **Step 3: Registrarlo**

En `services/backend/package.json`, agregar a `dependencies`:

```json
    "@gps/afiliacion": "workspace:*",
```

En `services/backend/src/modules.ts`:

```ts
import { afiliacion } from '@gps/afiliacion/servidor'
import { estructura } from '@gps/estructura/servidor'
import { personas } from '@gps/personas/servidor'
import { sistema } from '@gps/sistema/servidor'

/** La lista de modulos registrados. Agregar un modulo nuevo es agregarlo aca
 *  y nada mas: el orden lo resuelve ordenarModulos por dependencias. */
export const modulos = [sistema, estructura, personas, afiliacion]
```

Run: `bun install`

- [ ] **Step 4: Escribir el test del esquema compuesto**

Agregar a `services/backend/test/schema.test.ts`:

```ts
describe('afiliacion en el esquema compuesto', () => {
  test('la query declaraciones existe y responde vacia sin datos', async () => {
    const resultado = await consultar('{ declaraciones(grupoId: "grupo_1") { fecha periodo } }')
    expect(resultado.errors).toBeUndefined()
    expect(resultado.data).toEqual({ declaraciones: [] })
  })

  test('afiliadosEn responde vacio sin declaraciones', async () => {
    const resultado = await consultar(
      '{ afiliadosEn(periodo: 2026, personaIds: ["persona_1"]) }',
    )
    expect(resultado.errors).toBeUndefined()
    expect(resultado.data).toEqual({ afiliadosEn: [] })
  })

  test('TipoDeDocumento lo declaran dos modulos y el esquema compone igual', async () => {
    // Si personas y afiliacion lo declararan con builder.enumType, componer
    // tiraria. enumCompartido es lo que lo permite; este test es el que se
    // rompe si alguno de los dos se sale del helper o cambia la descripcion.
    const resultado = await consultar('{ __type(name: "TipoDeDocumento") { name } }')
    expect(resultado.errors).toBeUndefined()
  })
})
```

- [ ] **Step 5: Correr, regenerar el schema y verificar**

```bash
bun test services/backend/test/schema.test.ts
bun run schema
bun run --filter @gps/api codegen
bun run check
```

Expected: tests en verde, y `schema.gql` con los tipos `Afiliado` y `Declaracion`, las dos
queries y la mutation nuevas. Revisar el diff de `schema.gql` a ojo antes de commitear.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(afiliacion): el esquema y el registro del modulo

declaraciones y afiliadosEn como queries, declararAfiliacion como la
mutation de la extraordinaria. Es el primer enum que declaran dos
modulos: TipoDeDocumento sale por enumCompartido en los dos."
```

---

### Task 11: El barrido en el backend

**Files:**
- Modify: `services/backend/src/server.ts` (devuelve también el contexto)
- Modify: `services/backend/src/index.ts`

Ningún test llama hoy a `crearServidor` —`schema.test.ts` usa `componer` directo— así que
cambiarle la forma del retorno sólo toca `index.ts`.

- [ ] **Step 1: Que `crearServidor` devuelva el contexto**

En `services/backend/src/server.ts`, cambiar el final de la función:

```ts
  const servidor = Bun.serve({
    port: config.puerto,
    development: config.entorno === 'desarrollo',
    routes: {
      '/graphql': (pedido) => yoga.fetch(pedido),
      '/health': () => Response.json({ estado: 'ok', version: config.version }),
      '/*': inicio,
    },
  })

  // Devuelve tambien el contexto porque quien arranca el proceso necesita
  // alcanzar a los servicios sin un request encima: el barrido de afiliacion
  // corre al arrancar, no atras de una consulta.
  return { servidor, contexto }
```

- [ ] **Step 2: Llamar al barrido al arrancar y una vez por día**

En `services/backend/src/index.ts`, dentro del `if (import.meta.main)`:

```ts
  const { servidor, contexto } = await crearServidor(config, bd)

  // Las declaraciones ordinarias de afiliacion. Lo que corre a diario no es la
  // declaracion -que pasa dos veces al anio- sino la pregunta: un proceso no
  // tiene forma de enterarse de que paso una fecha si nada lo despierta a
  // mirar. Es idempotente por el UNIQUE de la tabla.
  //
  // El que hace el trabajo de verdad es este primer llamado: si el proceso
  // estuvo caido toda la semana del 1 de mayo, al volver declara mayo y sigue.
  // El intervalo es el seguro para el proceso que lleva meses en pie.
  //
  // Un setTimeout apuntado a la fecha exacta no sirve: guarda el delay en un
  // entero de 32 bits y se rompe arriba de ~24,8 dias. Un setTimeout a seis
  // meses dispara al instante.
  await contexto.afiliacion.declararPendientes()
  const UN_DIA = 24 * 60 * 60 * 1000
  setInterval(() => {
    void contexto.afiliacion.declararPendientes()
  }, UN_DIA)

  process.on('SIGTERM', () => process.exit(0))
```

(El `process.on('SIGTERM', …)` y el `console.log` que ya estaban se quedan como están; sólo
cambió la línea del `const servidor` por la desestructuración.)

- [ ] **Step 3: Verificar a mano que arranca**

Run: `bun run dev`
Expected: el log de "GPS escuchando" como siempre, sin errores. Cortarlo con Ctrl-C.

- [ ] **Step 4: Verificar todo y commitear**

```bash
bun run check
git add -A
git commit -m "feat(backend): el barrido de las declaraciones ordinarias

Al arrancar y una vez por dia. Vive aca y no en el modulo porque adentro
del telefono no hay nada que schedulear, y el modulo tiene que ser el
mismo en los dos lados."
```

---

### Task 12: El demo

**Files:**
- Modify: `packages/demo/src/servidor/escenario.ts`, `packages/demo/package.json`
- Test: `packages/demo/test/escenario.test.ts`

- [ ] **Step 1: Sembrar las declaraciones**

En `packages/demo/package.json`, agregar `"@gps/afiliacion": "workspace:*"` a
`dependencies`. En `escenario.ts`, agregar el import con efecto arriba, junto a los otros:

```ts
import '@gps/afiliacion/servidor'
```

Y al final de `sembrarEscenario`, después del bucle de personas:

```ts
  // Las ordinarias del periodo corriente que ya pasaron, y despues una
  // extraordinaria del grupo 42.
  //
  // El orden importa: la extraordinaria lleva la fecha de hoy, asi que si
  // fuera primero dejaria a las ordinarias vencidas "con fecha anterior a la
  // ultima" y el barrido del backend no podria emitirlas nunca.
  //
  // La extraordinaria queda con la nomina llena y nada que cobrar, porque en el
  // escenario nadie ingreso despues de la ordinaria. Es el caso que la pantalla
  // tiene que saber dibujar, asi que sirve que este.
  await ctx.afiliacion.declararPendientes()

  const grupoDeLaExtraordinaria = gruposPorNumero.get(42)
  if (!grupoDeLaExtraordinaria) throw new Error('El escenario no tiene el grupo 42.')
  await ctx.afiliacion.declararExtraordinaria(grupoDeLaExtraordinaria)
```

- [ ] **Step 2: Cablear afiliación en `montarContexto` y agregar el test**

`packages/demo/test/escenario.test.ts` ya tiene un `montarContexto()` que arma los
servicios a mano. Hay que sumarle el tercero. Su reloj está fijo en **2026-08-27** —y no en
1970, porque el escenario siembra fechas de nacimiento reales—, así que el período
corriente es 2026 y la única ordinaria vencida es el 1 de mayo de 2026.

En el import de arriba, agregar `import { afiliacion } from '@gps/afiliacion/servidor'`.
En `montarContexto`, cambiar `modulos`, las migraciones y el contexto:

```ts
    modulos: ['estructura', 'personas', 'afiliacion'],
```

```ts
  aplicarMigraciones(core, [estructura, personas, afiliacion])
  // personas depende de estructura y afiliacion de las dos, asi que se
  // construyen en ese orden: es el mismo cableado que hace crearServicios en la
  // raiz de composicion, a mano porque el test arma su propio contexto.
  const servicioDeEstructura = estructura.createServices(core, {})
  const servicioDePersonas = personas.createServices(core, { estructura: servicioDeEstructura })
  return {
    actor: null,
    estructura: servicioDeEstructura,
    personas: servicioDePersonas,
    afiliacion: afiliacion.createServices(core, {
      personas: servicioDePersonas,
      estructura: servicioDeEstructura,
    }),
  } as Context
```

Y el test nuevo, adentro del `describe('sembrarEscenario', …)`:

```ts
  test('deja declaraciones para mirar: la ordinaria vencida y una extraordinaria', async () => {
    const contexto = montarContexto()
    await sembrarEscenario(contexto)

    const grupos = (await contexto.estructura.listarDistritos()).flatMap(
      (distrito) => distrito.grupos,
    )
    const grupo42 = grupos.find((grupo) => grupo.numero === 42)
    expect(grupo42).toBeDefined()

    const declaraciones = await contexto.afiliacion.listarDeclaraciones(grupo42?.id ?? '')
    // La ordinaria del 1 de mayo de 2026 y la extraordinaria del dia del reloj.
    expect(declaraciones.map((una) => una.fecha)).toEqual(['2026-08-27', '2026-05-01'])

    // En la ordinaria, que es la primera del periodo, todos son cobrables.
    const ordinaria = declaraciones[1]
    const nomina = await contexto.afiliacion.listarAfiliados(ordinaria?.id ?? '')
    expect(nomina).not.toHaveLength(0)
    expect(await contexto.afiliacion.listarACobrar(ordinaria?.id ?? '')).toEqual(nomina)

    // En la extraordinaria, la nomina es la misma y no hay nada que cobrar:
    // nadie ingreso entre mayo y agosto. Es el caso que la pantalla tiene que
    // saber dibujar.
    const extraordinaria = declaraciones[0]
    expect(await contexto.afiliacion.listarAfiliados(extraordinaria?.id ?? '')).toHaveLength(
      nomina.length,
    )
    expect(await contexto.afiliacion.listarACobrar(extraordinaria?.id ?? '')).toEqual([])
  })
```

- [ ] **Step 3: Verificar y mirar el demo**

```bash
bun install
bun test packages/demo
bun run demo
```

Expected: tests en verde, y `http://localhost:3000/graphql` responde
`{ declaraciones(grupoId: "…") { fecha periodo afiliados { apellidos } aCobrar { apellidos } } }`
con datos. Cortar con Ctrl-C.

- [ ] **Step 4: Verificar todo y commitear**

```bash
bun run check
git add -A
git commit -m "feat(demo): declaraciones en el escenario

Las ordinarias vencidas y una extraordinaria del grupo 42, en ese orden:
al reves, la extraordinaria dejaria a las ordinarias con fecha anterior."
```

---

### Task 13: La capa `@gps/api`

**Files:**
- Create: `packages/api/src/queries/afiliacion.graphql`, `packages/api/src/afiliacion.ts`
- Modify: `packages/api/src/index.ts`

**Interfaces:**
- Produces: `useDeclaraciones(grupoId)`, `useAfiliadosEn(periodo, personaIds)` y
  `useDeclararAfiliacion()`. Las usan las Tareas 14 y 15.

- [ ] **Step 1: Escribir las operaciones**

`packages/api/src/queries/afiliacion.graphql`:

```graphql
# packages/api/src/queries/afiliacion.graphql
query Declaraciones($grupoId: ID!) {
  declaraciones(grupoId: $grupoId) {
    id
    fecha
    periodo
    afiliados {
      personaId
      tipoDeDocumento
      numeroDeDocumento
      nombres
      apellidos
    }
    aCobrar {
      personaId
    }
  }
}

query AfiliadosEn($periodo: Int!, $personaIds: [ID!]!) {
  afiliadosEn(periodo: $periodo, personaIds: $personaIds)
}

mutation DeclararAfiliacion($grupoId: ID!) {
  declararAfiliacion(grupoId: $grupoId) {
    id
    fecha
  }
}
```

`aCobrar` trae sólo `personaId`: la pantalla ya tiene los nombres en `afiliados` y cruza
por id, así que pedir el resto sería traer cada fila dos veces.

- [ ] **Step 2: Escribir los hooks**

`packages/api/src/afiliacion.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AfiliadosEnDocument,
  DeclaracionesDocument,
  DeclararAfiliacionDocument,
} from './generated/graphql'
import { useTransporte } from './proveedor'

/** Las declaraciones de un grupo, de la mas reciente a la mas vieja. */
export function useDeclaraciones(grupoId: string) {
  const transporte = useTransporte()
  return useQuery({
    queryKey: ['declaraciones', grupoId],
    queryFn: () => transporte.ejecutar(DeclaracionesDocument, { grupoId }),
  })
}

/** Quienes de esa lista ya estan afiliados en ese periodo. El periodo lo pone
 *  la pantalla, de su propio almanaque: es el mismo criterio que estaVigente. */
export function useAfiliadosEn(periodo: number, personaIds: readonly string[]) {
  const transporte = useTransporte()
  return useQuery({
    // Los ids van en la clave: dos grupos distintos preguntan por gente
    // distinta y no pueden compartir la entrada de cache.
    queryKey: ['afiliadosEn', periodo, personaIds],
    queryFn: () =>
      transporte.ejecutar(AfiliadosEnDocument, { periodo, personaIds: [...personaIds] }),
    // Sin ids no hay nada que preguntar y la query no tiene que salir.
    enabled: personaIds.length > 0,
  })
}

/** Al declarar invalida las dos cosas que cambian: la lista de declaraciones
 *  del grupo y la señal de afiliacion de su gente. */
export function useDeclararAfiliacion() {
  const transporte = useTransporte()
  const clienteDeQueries = useQueryClient()
  return useMutation({
    mutationFn: (variables: { grupoId: string }) =>
      transporte.ejecutar(DeclararAfiliacionDocument, variables),
    onSuccess: () => {
      clienteDeQueries.invalidateQueries({ queryKey: ['declaraciones'] })
      clienteDeQueries.invalidateQueries({ queryKey: ['afiliadosEn'] })
    },
  })
}
```

- [ ] **Step 3: Exportarlos**

En `packages/api/src/index.ts`, agregar:

```ts
export { useAfiliadosEn, useDeclaraciones, useDeclararAfiliacion } from './afiliacion'
```

y sumar `DeclaracionesQuery` a la lista de tipos que se re-exportan desde
`./generated/graphql`.

- [ ] **Step 4: Regenerar los tipos y verificar**

```bash
bun run --filter @gps/api codegen
bun run check
```

Expected: verde. Si el codegen no encuentra las operaciones, verificar que `codegen.ts`
tome `src/queries/*.graphql` con un glob y no con una lista.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(api): hooks de afiliacion"
```

---

### Task 14: La pantalla web

**Files:**
- Create: `apps/web/src/pantallas/Afiliacion.tsx`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/pantallas/Grupo.tsx`
- Modify: `apps/web/package.json` (+ `@gps/afiliacion`)

- [ ] **Step 1: La señal en la lista del grupo**

En `apps/web/package.json`, agregar `"@gps/afiliacion": "workspace:*"` a `dependencies`, y
`bun install`.

En `apps/web/src/pantallas/Grupo.tsx`:

```ts
import { useAfiliadosEn, useDistritos, usePersonasDelGrupo } from '@gps/api'
import { periodoDe } from '@gps/afiliacion/dominio'
import { aFechaDeCalendario } from '@gps/core/fechas'
```

`FilaDePersona` recibe una prop más y dibuja la señal:

```tsx
function FilaDePersona(props: { persona: Persona; hoy: Date; afiliada: boolean }) {
  // …lo que ya tenía…
  return (
    <li className="px-4 py-3">
      <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
        {/* El signo va antes del nombre y con title: a 375px es lo primero que
            se ve, y el lector de pantalla necesita el texto. */}
        <span
          aria-hidden="true"
          className={props.afiliada ? 'text-emerald-600' : 'text-slate-300'}
        >
          {props.afiliada ? '✓' : '✗'}
        </span>
        <span className="sr-only">{props.afiliada ? 'Afiliada' : 'Sin afiliar'}:</span>
        {nombreCompleto(props.persona)}
      </p>
      {/* …el resto igual… */}
    </li>
  )
}
```

`Seccion` pasa la prop hacia abajo: agregar `afiliados: ReadonlySet<string>` a sus props y
`afiliada={props.afiliados.has(persona.id)}` en el `FilaDePersona`.

Y en `Grupo`, después de `const lista = usePersonasDelGrupo(props.id)`:

```tsx
  const personas = lista.data?.personas ?? []
  // El periodo lo calcula el cliente, de su propio almanaque: es el mismo
  // criterio que estaVigente y que calcularEdad, que tampoco los resuelve el
  // servidor.
  const periodo = periodoDe(aFechaDeCalendario(hoy))
  const consulta = useAfiliadosEn(
    periodo,
    personas.map((persona) => persona.id),
  )
  const afiliados = new Set(consulta.data?.afiliadosEn ?? [])
```

(La declaración de `const personas` que hoy está más abajo se sube acá; borrar la de abajo.)
Pasar `afiliados={afiliados}` a cada `<Seccion>`.

Debajo del encabezado, el enlace a la pantalla nueva:

```tsx
      <Link
        href={`/grupos/${props.id}/afiliacion`}
        className="mt-2 inline-block text-sm text-slate-500 hover:text-slate-900"
      >
        Afiliación →
      </Link>
```

- [ ] **Step 2: La pantalla de declaraciones**

`apps/web/src/pantallas/Afiliacion.tsx`:

```tsx
import { useDeclaraciones, useDeclararAfiliacion } from '@gps/api'
import { nombreDelTipo } from '@gps/personas/dominio'
import { Link } from 'wouter'

type Declaracion = NonNullable<ReturnType<typeof useDeclaraciones>['data']>['declaraciones'][number]

function Nomina(props: { declaracion: Declaracion }) {
  const aCobrar = new Set(props.declaracion.aCobrar.map((uno) => uno.personaId))
  return (
    <ul className="mt-2 divide-y divide-slate-200 rounded-lg bg-white shadow-sm">
      {props.declaracion.afiliados.map((afiliado) => (
        <li key={afiliado.personaId} className="px-4 py-3">
          <p className="text-sm font-medium text-slate-900">
            {afiliado.apellidos}, {afiliado.nombres}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {nombreDelTipo(afiliado.tipoDeDocumento)} {afiliado.numeroDeDocumento}
            {aCobrar.has(afiliado.personaId) ? (
              <span className="ml-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                a cobrar
              </span>
            ) : (
              <span className="ml-1.5 text-slate-400">· ya afiliada</span>
            )}
          </p>
        </li>
      ))}
    </ul>
  )
}

export function Afiliacion(props: { grupoId: string }) {
  const consulta = useDeclaraciones(props.grupoId)
  const declarar = useDeclararAfiliacion()

  return (
    <>
      <Link
        href={`/grupos/${props.grupoId}`}
        className="mt-6 inline-block text-sm text-slate-500 hover:text-slate-900"
      >
        ← Grupo
      </Link>
      <h2 className="mt-1 text-lg font-semibold text-slate-900">Afiliación</h2>

      {consulta.isPending && <p className="mt-8 text-sm text-slate-500">Consultando…</p>}

      {consulta.error && (
        <p className="mt-8 rounded-lg bg-red-50 p-4 text-sm break-words text-red-800">
          No se pudieron consultar las declaraciones: {consulta.error.message}
        </p>
      )}

      <div className="mt-6 space-y-6">
        {(consulta.data?.declaraciones ?? []).map((declaracion) => (
          <section key={declaracion.id}>
            <h3 className="text-sm font-semibold text-slate-900">
              {declaracion.fecha}
              <span className="ml-1 font-normal text-slate-400">
                período {declaracion.periodo} · {declaracion.afiliados.length} en la nómina ·{' '}
                {declaracion.aCobrar.length} a cobrar
              </span>
            </h3>
            <Nomina declaracion={declaracion} />
          </section>
        ))}

        {consulta.data?.declaraciones.length === 0 && (
          <p className="rounded-lg bg-white p-4 text-sm text-slate-500 shadow-sm">
            El grupo todavía no tiene ninguna declaración.
          </p>
        )}
      </div>

      {/* Lo menos frecuente, asi que va al final y no compite por lugar. */}
      <button
        type="button"
        disabled={declarar.isPending}
        onClick={() => declarar.mutate({ grupoId: props.grupoId })}
        className="mt-8 w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
      >
        {declarar.isPending ? 'Declarando…' : 'Declarar afiliación extraordinaria'}
      </button>

      {declarar.error && (
        <p className="mt-2 rounded-lg bg-red-50 p-4 text-sm break-words text-red-800">
          {declarar.error.message}
        </p>
      )}
    </>
  )
}
```

- [ ] **Step 3: La ruta**

En `apps/web/src/App.tsx`, importar `Afiliacion` y agregar la ruta **antes** de la de
`/grupos/:id` (wouter toma la primera que matchea, y `/grupos/:id` matchearía primero si
fuera al revés):

```tsx
          <Route path="/grupos/:id/afiliacion">
            {(params) => <Afiliacion grupoId={params.id} />}
          </Route>
          <Route path="/grupos/:id">{(params) => <Grupo id={params.id} />}</Route>
```

- [ ] **Step 4: Mirarlo a 375px**

Run: `bun run demo`, abrir `http://localhost:3000`, entrar a un grupo del distrito 1, y con
el devtools en 375px: verificar la señal ✓/✗ en la lista, entrar a Afiliación, ver las dos
declaraciones del grupo 42 con sus nóminas, y apretar el botón de extraordinaria (tiene que
fallar con "Ya hay una declaración del …", porque la del demo es de hoy — es la respuesta
correcta y prueba que el error llega a la pantalla).

- [ ] **Step 5: Verificar todo y commitear**

```bash
bun run check
git add -A
git commit -m "feat(web): la senial de afiliacion y la pantalla de declaraciones"
```

---

### Task 15: La pantalla mobile

Lo mismo que la Tarea 14, con React Native y expo-router. Las dos apps van a la par: no se
abre una deuda de paridad.

**Files:**
- Create: `apps/mobile/app/grupos/[id]/afiliacion.tsx`
- Modify: `apps/mobile/app/grupos/[id].tsx`, `apps/mobile/package.json`

**Ojo con expo-router:** para que `grupos/[id]/afiliacion.tsx` conviva con `grupos/[id].tsx`
hay que mover la pantalla del grupo a `grupos/[id]/index.tsx`. Es el layout que expo-router
espera para una ruta con hijos.

- [ ] **Step 1: Mover la pantalla del grupo y agregar la señal**

```bash
mkdir -p "apps/mobile/app/grupos/[id]"
git mv "apps/mobile/app/grupos/[id].tsx" "apps/mobile/app/grupos/[id]/index.tsx"
```

En el archivo movido, los imports relativos suben un nivel: `'../../componentes/AltaDePersona'`
pasa a `'../../../componentes/AltaDePersona'`. Agregar
`"@gps/afiliacion": "workspace:*"` y `"@gps/core": "workspace:*"` a
`apps/mobile/package.json` (el segundo ya lo agregó la Tarea 1) y correr `bun install`.

Aplicar los mismos cambios que la Tarea 14, con los componentes de React Native:

```tsx
import { useAfiliadosEn, useDistritos, usePersonasDelGrupo } from '@gps/api'
import { periodoDe } from '@gps/afiliacion/dominio'
import { aFechaDeCalendario } from '@gps/core/fechas'
```

En `FilaDePersona`, la señal antes del nombre:

```tsx
      <Text className="text-sm font-medium text-slate-900">
        <Text className={props.afiliada ? 'text-emerald-600' : 'text-slate-300'}>
          {props.afiliada ? '✓ ' : '✗ '}
        </Text>
        {nombreCompleto(props.persona)}
      </Text>
```

Y en la pantalla, lo mismo que en web —`periodoDe(aFechaDeCalendario(hoy))`, `useAfiliadosEn`,
el `Set`— más el enlace:

```tsx
            <Link href={`/grupos/${id}/afiliacion`} className="mt-2 text-sm text-slate-500">
              Afiliación →
            </Link>
```

- [ ] **Step 2: La pantalla de declaraciones**

`apps/mobile/app/grupos/[id]/afiliacion.tsx`:

```tsx
import { useDeclaraciones, useDeclararAfiliacion } from '@gps/api'
import { nombreDelTipo } from '@gps/personas/dominio'
import { Link, useLocalSearchParams } from 'expo-router'
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native'

type Declaracion = NonNullable<
  ReturnType<typeof useDeclaraciones>['data']
>['declaraciones'][number]

function Nomina(props: { declaracion: Declaracion }) {
  const aCobrar = new Set(props.declaracion.aCobrar.map((uno) => uno.personaId))
  return (
    <View className="mt-2 overflow-hidden rounded-lg bg-white">
      {props.declaracion.afiliados.map((afiliado) => (
        <View key={afiliado.personaId} className="border-b border-slate-200 px-4 py-3">
          <Text className="text-sm font-medium text-slate-900">
            {afiliado.apellidos}, {afiliado.nombres}
          </Text>
          <Text className="mt-0.5 text-xs text-slate-500">
            {nombreDelTipo(afiliado.tipoDeDocumento)} {afiliado.numeroDeDocumento}
            {aCobrar.has(afiliado.personaId) ? (
              <Text className="text-amber-800"> · a cobrar</Text>
            ) : (
              <Text className="text-slate-400"> · ya afiliada</Text>
            )}
          </Text>
        </View>
      ))}
    </View>
  )
}

export default function Pantalla() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const consulta = useDeclaraciones(id)
  const declarar = useDeclararAfiliacion()

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView contentContainerClassName="px-4 py-10">
        <Link href={`/grupos/${id}`} className="text-sm text-slate-500">
          ← Grupo
        </Link>
        <Text className="mt-1 text-lg font-semibold text-slate-900">Afiliación</Text>

        {consulta.isPending && <Text className="mt-8 text-sm text-slate-500">Consultando…</Text>}

        {consulta.error && (
          <View className="mt-8 rounded-lg bg-red-50 p-4">
            <Text className="text-sm text-red-800">
              No se pudieron consultar las declaraciones: {consulta.error.message}
            </Text>
          </View>
        )}

        {(consulta.data?.declaraciones ?? []).map((declaracion) => (
          <View key={declaracion.id} className="mt-6">
            <Text className="text-sm font-semibold text-slate-900">
              {declaracion.fecha}
              <Text className="font-normal text-slate-400">
                {' '}
                período {declaracion.periodo} · {declaracion.afiliados.length} en la nómina ·{' '}
                {declaracion.aCobrar.length} a cobrar
              </Text>
            </Text>
            <Nomina declaracion={declaracion} />
          </View>
        ))}

        {consulta.data?.declaraciones.length === 0 && (
          <View className="mt-6 rounded-lg bg-white p-4">
            <Text className="text-sm text-slate-500">
              El grupo todavía no tiene ninguna declaración.
            </Text>
          </View>
        )}

        {/* Lo menos frecuente, asi que va al final y no compite por lugar. */}
        <Pressable
          disabled={declarar.isPending}
          onPress={() => declarar.mutate({ grupoId: id })}
          className="mt-8 rounded-lg bg-slate-900 px-4 py-3"
        >
          <Text className="text-center text-sm font-medium text-white">
            {declarar.isPending ? 'Declarando…' : 'Declarar afiliación extraordinaria'}
          </Text>
        </Pressable>

        {declarar.error && (
          <View className="mt-2 rounded-lg bg-red-50 p-4">
            <Text className="text-sm text-red-800">{declarar.error.message}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
```

- [ ] **Step 3: Verificar en Expo**

```bash
bun run --filter mobile dev
```

Expected: la lista del grupo con la señal, la navegación a Afiliación y vuelta, y las
nóminas. Verificar que el `git mv` no rompió la ruta `/grupos/:id`.

- [ ] **Step 4: Verificar todo y commitear**

```bash
bun run check
git add -A
git commit -m "feat(mobile): la senial de afiliacion y la pantalla de declaraciones

La pantalla del grupo se mueve a grupos/[id]/index.tsx: es el layout que
expo-router pide para una ruta con hijos."
```

---

### Task 16: Documentación

**Files:**
- Modify: `CLAUDE.md`, `docs/arquitectura.md`

- [ ] **Step 1: Actualizar el CLAUDE.md**

En la sección "Qué NO existe todavía", sacar lo que ahora sí existe y agregar lo que quedó
como deuda de esta iteración:

- Sigue sin haber bus de eventos, y ahora hay un consumidor a la vista: cuando llegue
  Tesorería, `declarar` va a emitir `AfiliacionDeclarada`.
- Agregar: **cerrar un grupo no cierra las pertenencias de su gente**. Afiliación lo
  esquiva filtrando por `gruposAbiertosEn`, pero `listarPersonas` de un grupo cerrado
  sigue devolviendo gente.
- Agregar a la lista de módulos: `afiliacion`, con `personas` y `estructura` como
  dependencias, las dos por lectura.
- Mencionar `aFechaDeCalendario` en `@gps/core/fechas` y **por qué está en un subpath**:
  el índice de core arrastra Pothos, y las apps la importan.

- [ ] **Step 2: Actualizar `docs/arquitectura.md`**

Dos lugares concretos:

- **El grafo de la §"Los módulos"** ya dibuja `afiliacion`, pero como futuro y con una
  flecha a `permisos`. Corregirlo: `afiliacion` depende de `personas` y de `estructura`,
  las dos por lectura, y de nadie más.
- **El diagrama de la §9 (Eventos entre módulos)** dice que afiliación emite
  `AfiliacionAprobada`. El evento que va a emitir este módulo es **`AfiliacionDeclarada`**,
  porque lo que ocurre es una declaración y no una aprobación —no hay nada que aprobar—.
  Corregir el nombre y dejar anotado que el bus sigue sin existir: llega con Tesorería, que
  es su primer suscriptor real.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: afiliacion en el mapa"
```
