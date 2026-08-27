# Estructura, persistencia y modo demo

Segunda iteración. El walking skeleton probó la cadena pantalla → GraphQL → módulo
sin tocar disco. Esta spec le agrega el piso que faltaba —base de datos y
migraciones— y lo estrena con el primer módulo de negocio, `estructura`, y con datos
sembrados para poder mirar pantallas.

Complementa `docs/superpowers/specs/2026-08-24-arquitectura-y-walking-skeleton-design.md`,
al que se cita como **la spec base**.

## 1. Alcance

### Entra

1. `Core.bd`: la base como servicio de core, Drizzle sobre SQLite (§2.4 de la spec base).
2. `Core.nuevoId()`: generación de identificadores, por la regla de portabilidad.
3. Migraciones por módulo: un campo en el contrato de `Module` y un runner en `core`.
4. El módulo `estructura`, acotado al **árbol**: distritos, grupos, y qué ramas abre
   cada grupo.
5. `packages/demo`: un escenario sembrado con datos realistas.
6. Pantallas de lectura del árbol en web y mobile.

### No entra, y por qué

**Cargos, autoridades y equipos.** Jefe de grupo, comisionado de distrito, auxiliares
por rama, Edifor, Tesorería: todos apuntan a una persona, y el módulo `personas` no
existe. La spec base ya ordena `personas` antes que `estructura` (§7 de
`docs/arquitectura.md`). Modelar cargos ahora obligaría a inventar una entidad persona
dentro de `estructura` para tirarla después. Entran en la iteración que traiga
`personas`.

**Diócesis como entidad.** Una sola asociación diocesana por instancia; los distritos
no cuelgan de ninguna fila. Si algún día hay más de una, es una migración chica.

**Mutations.** Las pantallas de esta tanda son de lectura y el demo siembra llamando al
servicio, no a GraphQL. Publicar mutations sin pantalla que las use sería contrato sin
consumidor.

**`Alcance` en los repositorios.** La convención del §8.4 de la spec base existe para
filtrar por autorización. No hay `auth`, así que no hay a quién filtrar. Cuando llegue,
el filtro entra por el servicio, que es el único lugar que consulta la base.

**`packages/local` y el demo en el dispositivo.** El §11.6 de la spec base lo difiere a
su propia spec. Acá el demo es el mismo backend contra una base sembrada; la
infraestructura que lo lleva al teléfono llega con Permisos.

## 2. Dominio: qué es constante y qué es fila

La división es por naturaleza del dato, no por módulo (§11.4 de la spec base).

**Las ramas son un conjunto cerrado**, así que son constantes en `/dominio`, no una
tabla. No hay migración ni siembra que mantener, el frontend las tiene gratis porque
`/dominio` es isomorfo, y no pueden desincronizarse el código y la base.

```ts
// packages/estructura/src/dominio/ramas.ts
export const RAMAS = [
  { id: 'castores', nombre: 'Castores', desde: 5,  hasta: 7 },
  { id: 'lobatos',  nombre: 'Lobatos',  desde: 7,  hasta: 10 },
  { id: 'scouts',   nombre: 'Scouts',   desde: 10, hasta: 14 },
  { id: 'raiders',  nombre: 'Raiders',  desde: 14, hasta: 17 },
  { id: 'rovers',   nombre: 'Rovers',   desde: 17, hasta: 21 },
  { id: 'adultos',  nombre: 'Adultos',  desde: 21, hasta: null },
] as const

export type Rama = (typeof RAMAS)[number]['id']
```

El rango etario viaja con la constante porque la pantalla lo muestra. `hasta: null` en
Adultos es la rama abierta hacia arriba.

No se escriben todavía `ramaParaEdad(edad)` ni `puedeSerDirigente(edad)`. Son reglas
reales del dominio —un dirigente tiene 21 años o más, y un dirigente no puede ser
miembro de la rama Adultos, que está pensada justamente para el mayor de 21 
— pero ninguna tiene consumidor hasta que exista `personas`.
Entran con su primer usuario, junto con el test que las fija.

**Los distritos y los grupos son filas.** También lo es la relación grupo–rama: no
todos los grupos abren todas las ramas, y cuáles abre cada uno cambia con el tiempo.

```ts
// packages/estructura/src/dominio/modelos.ts
export interface Marcas {
  readonly creadoEn: Date
  readonly actualizadoEn: Date
}

export interface Distrito extends Marcas {
  readonly id: string
  readonly numero: number
  readonly zona: string
}

export interface Grupo extends Marcas {
  readonly id: string
  readonly numero: number
  readonly nombre: string
  readonly distritoId: string
}

export interface DistritoConGrupos extends Distrito {
  readonly grupos: readonly (Grupo & { readonly ramas: readonly Rama[] })[]
}
```

`numero` es no nulo en las dos entidades: se asume que todo distrito y todo grupo de la
asociación tienen número asignado. Si aparece uno sin número, es una migración de una
línea.

**El distrito no tiene nombre.** Con el número alcanza para identificarlo, y un nombre
que nadie usa es una columna que se llena mal. `zona` queda haciendo doble función: es el
dato descriptivo y, en la pantalla, la etiqueta legible debajo de «Distrito 3».

El grupo sí lo tiene, y es el nombre propio —«Ceferino Namuncurá»—, sin el número ni la
palabra «Grupo Scout»: el número va en el medio del nombre completo («Grupo Scout 42
Ceferino Namuncurá») y la pantalla los compone.

`creadoEn` y `actualizadoEn` están en todas las filas editables. Ver §3.4.

## 3. Persistencia: `Core.bd` es el handle de Drizzle

### 3.1 La decisión

La regla de portabilidad (§5.3 de la spec base) prohíbe que el código bajo
`src/servidor/` de un módulo toque la plataforma. Pero lo que toca la plataforma es
**abrir** la base, no usarla: `drizzle-orm/sqlite-core`, que es con lo que se declaran
las tablas, no importa nada de Bun ni de Node. Así que el handle se construye en la
raíz de composición y viaja por `Core`.

```ts
// packages/core/src/core.ts
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'

export type Bd = BaseSQLiteDatabase<'sync', unknown>

export interface Core {
  readonly config: Config
  readonly logger: Logger
  readonly reloj: Reloj
  readonly bd: Bd
  readonly modulos: readonly string[]
  /** Identificador nuevo, con el prefijo de la entidad. */
  nuevoId(prefijo: string): string
}
```

```ts
// services/backend/src/bd.ts   -- aca si vale bun:sqlite
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'

export function crearBd(ruta: string): Bd {
  return drizzle(new Database(ruta))
}
```

El módulo consulta con `core.bd.select().from(grupos)`. El día que la base sea
`expo-sqlite`, cambia este archivo y ningún módulo.

**Descartado** envolver la base en una interfaz nuestra (`consultar(sql, params)`):
sería igual de portable a cambio de tirar el tipado de Drizzle, que es la razón por la
que se eligió Drizzle.

**Descartado** que el backend implemente los repositorios de cada módulo e inyecte:
rompe el módulo autocontenido, que es la propiedad central de la arquitectura.

### 3.2 Por qué los ids son UUIDv7 con prefijo

SQLite podría generarlos con `integer primary key autoincrement` y ahorrarnos el
método. No se hace, porque el modo demo y el offline de Permisos (§11.1 de la spec
base) apuntan a que **el teléfono cree filas contra su propia base local** y sincronice
después: dos dispositivos offline generarían ambos el grupo 1. Con UUID el problema no
existe.

Es **UUIDv7**, no v4. Un v4 es aleatorio de punta a punta, con lo cual cada inserción
cae en una hoja distinta del índice de la clave primaria y el árbol se fragmenta; un v7
lleva el timestamp de milisegundos en los bits altos, así que los ids salen ordenados
por creación y las inserciones son casi siempre al final del índice.

El v7 no reemplaza a la columna `creadoEn` de §3.4: el orden cronológico que trae está
codificado adentro del identificador, y leerlo exige decodificarlo. La columna es para
poder mirar la fila y saber cuándo se creó.

El costo de esta elección es que el id **filtra el momento de creación** a cualquiera
que lo vea. Para distritos y grupos no es información sensible. Para el módulo Salud
(§8.7 de la spec base) conviene revisarlo cuando llegue.

**Y llevan prefijo de entidad**, al estilo de Stripe:

    grupo_01a04035-7e28-7428-afbd-021d928ae01c

El prefijo se guarda en la base como parte del id; no se codifica ni se deriva. Cuesta
una concatenación y compra que un id en un log, en una URL o en un mensaje de error diga
de qué entidad es sin ir a buscarlo. No rompe la propiedad de §3.2: todas las filas de
una tabla comparten prefijo, así que dentro de su índice el orden lo sigue decidiendo el
UUIDv7. El prefijo es del dominio, así que va en español y en singular: `distrito_`,
`grupo_`.

**Descartados los global IDs de Relay** —`base64("Grupo:<uuid>")`— por ahora. Existen para
que `Grupo 1` y `Distrito 1` no colisionen, que es un problema de los ids autoincrementales
y no de un UUID. Lo que los haría valiosos es el par `node(id: ID!)` más una caché
normalizada, y `packages/api` usa TanStack Query, que cachea por `queryKey` y no por
entidad: no hay consumidor. Costarían codificar y decodificar en cada borde, dos modos de
falla nuevos —basura que no decodifica, tipo que no coincide— e ids ilegibles en los logs.
La decisión es además reversible sin migrar datos: un global ID es serialización del borde
de GraphQL, la base sigue guardando el id crudo, así que el día que haya Relay se agrega
`@pothos/plugin-relay` y se envuelve lo que ya existe.

`nuevoId()` vive en `Core` por la regla de portabilidad, exactamente igual que
`reloj.ahora()`. El backend lo implementa con `Bun.randomUUIDv7()`, que es nativo desde
Bun 1.1 — cero dependencias nuevas. En el dispositivo, la implementación de `Core` que
arme `packages/local` va a tener que aportar la suya; es un archivo de una función y no
afecta a ningún módulo.

### 3.3 Marcas de tiempo: `creadoEn` y `actualizadoEn`

Toda fila editable lleva las dos columnas, para saber de un vistazo cuándo se creó y
cuándo se tocó por última vez sin depender de una auditoría que todavía no existe.

    integer('creado_en',      { mode: 'timestamp_ms' }).notNull()
    integer('actualizado_en', { mode: 'timestamp_ms' }).notNull()

`timestamp_ms` guarda epoch en milisegundos y Drizzle lo mapea a `Date` en los dos
sentidos. Es el modo que sobrevive el cambio a Postgres y el que no depende de cómo
formatee fechas el driver.

**Las escribe el servicio con `core.reloj.ahora()`.** No con `DEFAULT CURRENT_TIMESTAMP`
de SQLite ni con `$defaultFn(() => new Date())` de Drizzle: las dos leen el reloj de la
plataforma por detrás de `Core`, que es exactamente lo que prohíbe la regla de
portabilidad (§5.3 de la spec base), y además vuelven los tests dependientes de la hora
real. Pasando por `reloj`, un test puede fijar la hora y afirmar sobre el valor exacto.

En el alta las dos columnas reciben el mismo instante. `actualizadoEn` se refresca en
cada `update`; como esta iteración no publica ninguna mutación de modificación (§1), hoy
no hay quien lo refresque todavía, y la primera actualización que se agregue tiene que
hacerlo.

**`ramasDelGrupo` lleva sólo `creadoEn`.** Sus dos columnas *son* la clave primaria, así
que la fila no se puede modificar: se abre o se cierra la rama, no se edita. Un
`actualizadoEn` ahí sería una columna que nunca podría diferir de `creadoEn`.

**No se exponen en GraphQL por ahora.** Ninguna de las pantallas de esta tanda las
muestra, y publicarlas obliga a introducir un escalar `DateTime` en el esquema público
—que Pothos no trae— sin consumidor que lo justifique. Entran con la primera pantalla
que las necesite.

### 3.4 Clave sustituta como primaria, clave natural como UNIQUE

Varias entidades tienen un identificador real propio: `distritos.numero`,
`grupos.numero`, y más adelante `(tipo_documento, numero_documento)` en `personas`. Ese
identificador **no** es la clave primaria; la primaria es siempre el id generado de §3.2.
La clave natural se declara aparte, como restricción `UNIQUE`.

Las dos mitades importan.

**Por qué no es la primaria.** Las claves naturales cambian: un distrito se renumera
cuando se parte o se fusiona, y un documento se corrige porque se cargó con un dígito de
más. Si eso fuera la primaria, cambiarlo obligaría a actualizar en cascada cada foreign
key del sistema, y todo id ya repartido —una URL, la caché de un teléfono, un formulario
impreso— quedaría colgado. Y una clave natural compuesta contamina todas las foreign
keys: si `personas` se identificara por `(tipo_documento, numero_documento)`, cada tabla
que referencia a una persona arrastraría dos columnas, multiplicado por Afiliación,
Tesorería, Salud y Permisos.

**Por qué el `UNIQUE` no es opcional.** Sin él la clave natural deja de valer y aparecen
dos filas para la misma entidad, que en un sistema de gestión es el desastre de datos
clásico: dos legajos del mismo chico, la cuota pagada en uno y el permiso en el otro. La
restricción va en la base y no en una validación del servicio, porque la base es lo único
que no se puede saltear.

En esta iteración: `UNIQUE (numero)` en `distritos` y `UNIQUE (numero)` en `grupos` —el
número de grupo es único en toda la diócesis, no dentro del distrito, así que identifica
al grupo por sí solo. Para `personas`, cuando llegue, el `UNIQUE (tipo_documento,
numero_documento)` va **not null**: en la asociación toda persona tiene documento, sin
excepción, así que no hay caso que justifique dejar la columna vacía.

Consecuencia conocida y aceptada: si un grupo se cierra y su número se reutiliza para uno
nuevo, el `UNIQUE` lo rechaza. La solución cuando aparezca es marcar el grupo cerrado y
hacer el índice parcial, no sacar la restricción.

### 3.5 Configuración

La ruta de la base es del backend, no de los módulos: no entra en `Config` de `core`.
Se lee en `services/backend/src/index.ts` junto al puerto, con la variable `BD` y
`./gps.db` por defecto, y `crearServidor(config, bd)` recibe el handle ya construido —
lo que además le permite a los tests pasar `:memory:`.

`*.db` se agrega a `.gitignore`.

## 4. Migraciones

### 4.1 El contrato crece un campo

```ts
// packages/core/src/migraciones.ts
export interface Migracion {
  readonly nombre: string
  readonly sql: string
}
```

```ts
// packages/core/src/module.ts
export interface Module<S = unknown> {
  readonly name: string
  readonly dependencies: readonly string[]
  readonly migraciones?: readonly Migracion[]
  createServices(core: Core): S
  registerSchema(builder: Builder): void
}
```

Opcional: `sistema` no tiene tablas y no debería declarar un array vacío para decirlo.

`drizzle-kit generate` escribe el SQL dentro del paquete del módulo, en
`packages/estructura/migraciones/`, configurado por un `drizzle.config.ts` propio del
paquete. No hay archivo central de esquema, que es justamente lo que rompería la
arquitectura de módulos (§2.4 de la spec base). Los `.sql` se importan con
`with { type: 'text' }` y se publican en orden desde
`src/servidor/migraciones.ts`; el paquete trae un `sql.d.ts` de una línea para que
`tsc` los acepte. Agregar una migración es generar el archivo y agregarle una línea a
ese índice.

### 4.2 El runner vive en `core`

```ts
// packages/core/src/migraciones.ts
export function aplicarMigraciones(bd: Bd, modulos: readonly Module<any>[]): void
```

Crea `migraciones(modulo, nombre, aplicadaEn)` con clave primaria `(modulo, nombre)` si
no existe, y por cada módulo —en el orden topológico que ya calcula `ordenarModulos`—
aplica las que no estén registradas, cada una junto con su registro en la misma
transacción. Son unas 25 líneas.

Va en `core` y no en `services/backend` a propósito: no toca el sistema de archivos ni
importa nada de Bun, así que el mismo runner sirve cuando los módulos corran dentro del
teléfono.

**Descartado** `drizzle-orm/bun-sqlite/migrator`: lee de una carpeta única con `node:fs`
—lo que obliga a centralizar las migraciones— y lleva su registro comparando
timestamps, con lo cual, corriéndolo carpeta por carpeta, una migración vieja del
módulo B queda salteada si ya se aplicó una más nueva del módulo A.

### 4.3 Dónde se corre

En `componer()`, después de ordenar los módulos y antes de crear los servicios: un
servicio no debería poder consultar una tabla que todavía no existe. En producción y en
desarrollo es el mismo camino; no hay comando de migración aparte.

## 5. El módulo `estructura`

### 5.1 Tablas

```ts
// packages/estructura/src/servidor/tablas.ts
const marcas = {
  creadoEn: integer('creado_en', { mode: 'timestamp_ms' }).notNull(),
  actualizadoEn: integer('actualizado_en', { mode: 'timestamp_ms' }).notNull(),
}

export const distritos = sqliteTable('distritos', {
  id: text('id').primaryKey(),
  numero: integer('numero').notNull().unique(),
  zona: text('zona').notNull(),
  ...marcas,
})

export const grupos = sqliteTable('grupos', {
  id: text('id').primaryKey(),
  numero: integer('numero').notNull().unique(),
  nombre: text('nombre').notNull(),
  distritoId: text('distrito_id').notNull().references(() => distritos.id),
  ...marcas,
})

export const ramasDelGrupo = sqliteTable('ramas_del_grupo', {
  grupoId: text('grupo_id').notNull().references(() => grupos.id),
  rama: text('rama').$type<Rama>().notNull(),
  creadoEn: integer('creado_en', { mode: 'timestamp_ms' }).notNull(),
}, (t) => [primaryKey({ columns: [t.grupoId, t.rama] })])
```

`marcas` es un objeto que se esparce, no una abstracción: Drizzle necesita las columnas
declaradas literalmente en cada tabla para inferir sus tipos.

La clave primaria compuesta de `ramasDelGrupo` es lo que hace que abrir dos veces la
misma rama sea un error de la base y no una regla que haya que recordar escribir.

### 5.2 Servicio

Un archivo que habla con Drizzle directamente. **Sin capa de repositorio**: la capa
existe en el diseño para recibir el `Alcance` y filtrar por autorización, y no hay
`auth`. Cuando llegue, el filtro entra acá, que es el único lugar del módulo que
consulta la base.

```ts
export interface ServicioDeEstructura {
  crearDistrito(datos: { numero: number; zona: string }): Promise<Distrito>
  crearGrupo(datos: { numero: number; nombre: string; distritoId: string }): Promise<Grupo>
  abrirRama(grupoId: string, rama: Rama): Promise<void>
  listarDistritos(): Promise<readonly DistritoConGrupos[]>
}
```

Sólo lo que tienen consumidor: `listarDistritos` la usa la pantalla, las otras tres las
usa el escenario del demo. No hay `cerrarRama`, ni renombrar, ni borrar hasta que haya
una pantalla que lo pida.

Los métodos devuelven `Promise` aunque el driver de SQLite sea síncrono. Es una palabra
que mantiene abierta la costura hacia Postgres y hacia un driver asíncrono en el
dispositivo, y los resolvers de GraphQL no notan la diferencia.

`listarDistritos` resuelve el árbol entero en tres consultas y arma la jerarquía en
memoria. Con la cantidad de distritos y grupos de una diócesis es holgadamente
suficiente; si alguna vez deja de serlo, el lugar donde se arregla es este método.

### 5.3 Esquema GraphQL

```graphql
enum Rama { castores lobatos scouts raiders rovers adultos }

type Grupo {
  id: ID!
  numero: Int!
  nombre: String!
  ramas: [Rama!]!
}

type Distrito {
  id: ID!
  numero: Int!
  zona: String!
  grupos: [Grupo!]!
}

type Query {
  distritos: [Distrito!]!
}
```

El enum se construye desde `RAMAS`, así que agregar una rama al catálogo la agrega al
esquema público y `bun run schema` lo detecta. `schema.gql` regenerado y commiteado; el
CI ya verifica que esté al día.

Los valores del enum van **en minúscula**, contra la convención de GraphQL de gritarlos.
Es a propósito: así el valor que viaja por la red *es* el id del dominio, y la pantalla
puede hacer `RAMAS.find((r) => r.id === valor)` para sacar el nombre y el rango etario
del catálogo isomorfo, sin una tabla de traducción en el medio. Gritar el enum obligaría
a mantener ese mapeo en los dos extremos a cambio de nada. El codegen se configura con
`enumsAsTypes`, con lo cual el tipo generado es la misma unión de literales que
`Rama` en `/dominio`.

## 6. Modo demo

### 6.1 `demo` es una función, no un módulo

`packages/demo` no tiene esquema ni servicios propios, así que implementar `Module` no
le compraría nada: sería un contrato lleno de métodos vacíos. Exporta una función.

```ts
// packages/demo/src/servidor/escenario.ts
import type {} from '@gps/estructura/servidor'  // trae la ampliacion de Context

export async function sembrarEscenario(ctx: Context): Promise<void>
```

Siembra llamando a los **servicios públicos**, no escribiendo SQL. Es la propiedad que
decide el diseño (§11.4 de la spec base): los datos del demo pasan por las mismas
validaciones y reglas de dominio que los reales, con lo cual es imposible generar un
demo con datos que el sistema consideraría inválidos.

El costo aceptado es que `demo` conoce a los módulos que quiere representar. Agregar un
módulo nuevo no obliga a tocarlo: el sistema funciona igual sin que `demo` lo mencione.

### 6.2 Cómo se enciende

Se agrega `'demo'` a `Entorno`. `bun run demo` arranca con `ENTORNO=demo BD=:memory:`:
la base se crea vacía en cada arranque, se migra, se siembra, y muere con el proceso. No
hay archivo de demo que se pudra, no hace falta que la siembra sea idempotente, y no hay
manera de que un build de demo toque datos reales — que es la consecuencia práctica
obligatoria del §11.5 de la spec base.

`componer()` pasa a ser `async` para poder esperar la siembra; `index.ts` la espera con
top-level await.

### 6.3 Los datos

Cuatro distritos con zona, y una docena de grupos repartidos de manera despareja entre
ellos. Lo que importa para mirar pantallas es que **las ramas varíen**: un grupo con las
seis, varios con sólo lobatos y scouts, alguno con una sola. Un demo donde todos los
grupos son iguales no muestra si la pantalla aguanta.

    Distrito 1   zona San Isidro     4 grupos
    Distrito 2   zona Quilmes        3 grupos
    Distrito 3   zona Ciudad         3 grupos
    Distrito 4   zona Moron          2 grupos

Nombres de grupo con la forma real: `Grupo Scout 42 Ceferino Namuncurá`,
`Grupo Scout 7 San Jorge`, `Grupo Scout 15 Nuestra Señora de Luján`.

## 7. Pantallas

Web y mobile, diseñadas a 375px primero (`sm:` y `md:` sólo agregan). Reemplazan a la
tarjeta de versión del walking skeleton como contenido principal.

Lista de distritos; cada distrito se titula «Distrito N» con la zona debajo; después sus
grupos con número y nombre; y en cada grupo las ramas que abre, como etiquetas. Un grupo sin ramas abiertas
lo dice explícitamente en vez de mostrar una fila vacía.

`packages/api` suma `src/queries/distritos.graphql` y el hook `useDistritos()`, con los
tipos regenerados por codegen. Las dos apps consumen el mismo hook.

## 8. Verificación

- `packages/estructura/test/servicio.test.ts` — contra SQLite en memoria: crear
  distrito y grupo, abrir ramas, y que `listarDistritos` devuelva el árbol armado.
  Abrir dos veces la misma rama falla. Con un `reloj` fijo, el alta deja `creadoEn` y
  `actualizadoEn` en ese instante exacto — que es lo que verifica que la hora entra por
  `Core` y no por el driver.
- `packages/core/test/migraciones.test.ts` — el runner aplica lo pendiente, y una
  segunda corrida no hace nada.
- `packages/demo/test/escenario.test.ts` — el escenario siembra sin errores y deja el
  árbol esperado. Es el test que atrapa que un cambio en un servicio rompa el demo.
- `bun run schema` regenerado y commiteado; `bun run check` en verde.

## 9. Archivos que se tocan

**Nuevos**

    packages/core/src/migraciones.ts
    packages/estructura/                  paquete completo
    packages/demo/                        paquete completo
    services/backend/src/bd.ts
    packages/api/src/queries/distritos.graphql
    packages/api/src/estructura.ts

**Modificados**

    packages/core/src/core.ts             bd, nuevoId (UUIDv7 con prefijo), 'demo'
    packages/core/src/module.ts           migraciones
    packages/core/src/index.ts            exports
    services/backend/src/core.ts          construye bd y nuevoId
    services/backend/src/composicion.ts   migra, siembra, async
    services/backend/src/server.ts        recibe el handle
    services/backend/src/index.ts         BD, entorno demo
    services/backend/src/modules.ts       + estructura
    packages/api/src/index.ts             + useDistritos
    apps/web/src/App.tsx
    apps/mobile/app/index.tsx
    schema.gql
    package.json                          script demo
    .gitignore                            *.db
    CLAUDE.md, docs/arquitectura.md       la base ya no es futuro

## 10. Lo que esta spec deja preparado

Cuando llegue `personas`, el trabajo de cargos es aditivo y ya tiene su lugar: una tabla
`cargos(personaId, cargo, ambitoTipo, ambitoId)` en `estructura`, las reglas de edad en
`/dominio`, y la implementación de `Alcance` que expande los roles del actor recorriendo
esta misma jerarquía (§8.3 de la spec base). Nada de lo que se construye acá se tira.
