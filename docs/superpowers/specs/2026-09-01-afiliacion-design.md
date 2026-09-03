# Afiliación: la nómina que cada grupo presenta

Quinta iteración. `personas` sabe quién pertenece a qué grupo y desde cuándo, y ese
historial estaba esperando a alguien que lo leyera hacia atrás. Ésta es ese alguien: dos
veces al año la asociación afilia, y afiliar es fotografiar quiénes estaban activos ese
día para que después se les pueda cobrar.

El módulo no cobra nada. Genera la nómina; la deuda la va a calcular Tesorería, que
todavía no existe.

Complementa `docs/superpowers/specs/2026-08-24-arquitectura-y-walking-skeleton-design.md`
(**la spec base**), `docs/superpowers/specs/2026-08-26-estructura-persistencia-y-demo-design.md`
(**la spec de estructura**) y
`docs/superpowers/specs/2026-08-28-pertenencia-y-cargos-design.md`
(**la spec de pertenencia**), a las que se cita en vez de repetir.

## 1. El dominio, como es en la realidad

La asociación afila a su gente **dos veces por año**, en fechas fijas del almanaque —por
ejemplo el 1 de mayo y el 1 de noviembre—. En cada una, cada grupo presenta la nómina de
sus miembros activos y paga por ellos.

**La afiliación es de la persona y cubre un período.** Se paga una vez por período y por
persona. La segunda declaración del período no vuelve a cobrar a quien ya está afiliado:
cobra únicamente a los que se sumaron en el medio.

**El período no es el año del almanaque**, y ésta es la parte que hay que leer despacio.
Los campamentos anuales caen en enero, y a veces en febrero. Si la cobertura se cortara el
31 de diciembre, quien se afilió en noviembre llegaría al campamento sin afiliación —al
campamento que cierra el ciclo por el que ya pagó—. Así que el período arranca un día
configurable del almanaque, después de la temporada de campamentos: con el corte el 1 de
marzo, el período 2026 va del 1 de marzo de 2026 al 28 de febrero de 2027, y el campamento
de enero de 2027 queda cubierto por lo que se pagó en 2026.

Esto **refina** lo que dijo la spec base en §13.6, que hablaba de "el resto del año". El
año que importa es el año scout, no el del calendario.

**Lo pagado no se devuelve ni se transfiere.** Si alguien se va en julio, lo que su grupo
pagó en mayo se perdió.

El escenario de referencia, que es el que pidió la asociación y el que se testea:

    marzo       Juan y María se inscriben en el Grupo 7
    1 de mayo   declaración: la nómina son Juan y María, y se cobran los dos
    junio       María se va
    julio       Pedro se inscribe
    1 de nov.   declaración: la nómina son Juan y Pedro, y se cobra sólo Pedro
                (Juan ya está afiliado desde mayo, lo de María no se recupera)

    total del período: 3

En el período siguiente el ciclo arranca de cero, así que **la primera declaración de cada
período cobra a todos los activos**. Eso no es una regla aparte: sale de que la cobertura
es por período y de que el 1 de marzo nadie tiene afiliación del período que empieza.

**Las declaraciones no son solamente dos.** Fuera del calendario ordinario la asociación
puede declarar cuando le haga falta: el caso concreto es afiliar a los cocineros antes
del campamento anual, para que estén cubiertos durante el campamento. Una declaración
extraordinaria es una declaración igual a las otras; lo único que la distingue es que no
la disparó el calendario.

### 1.1 Pertenencia y afiliación siguen siendo cosas distintas

La spec base lo fijó en §13.6 y acá no cambia: **la pertenencia no se deriva de la
afiliación**. Se inscribe a una persona y desde ese día pertenece al grupo y participa,
esté afiliada o no. La afiliación es un hecho posterior, anual y económico, que se apoya
en la pertenencia para saber a quién alcanzar.

Por eso este módulo no escribe nada sobre las personas ni sobre sus pertenencias: sólo
las lee.

## 2. Las tres preguntas que la spec base difirió

§13.6 dejó tres puntos explícitamente para esta spec. Dos se contestan solas una vez que
se decide que la afiliación es **de la persona con la asociación** y no del vínculo
persona-grupo.

**1. Quien pertenece a dos grupos, o se cambia a mitad de año.** La afiliación es de la
persona: se paga una vez. Si Ana se muda del Grupo 7 al Grupo 12 en julio, en noviembre
aparece en la nómina del Grupo 12 pero **no se le cobra**, porque el Grupo 7 ya pagó por
ella en mayo. El Grupo 7 no recupera nada y el Grupo 12 no paga nada.

Pertenecer a dos grupos **a la vez** hoy no puede pasar: el índice parcial
`pertenencia_vigente_por_persona` de la spec de pertenencia (§7.3) impone "una persona,
una pertenencia vigente". La pregunta vuelve a abrirse el día que ese índice se levante.

**2. Quien se da de baja y vuelve en el mismo período.** Conserva la afiliación. Es "de la
persona" más "lo pagado no se devuelve", aplicados: ya está paga para ese período y no
vuelve a aparecer como cobrable en ninguna declaración posterior.

**3. Quien se suma después de la última declaración del período.** Queda sin afiliar hasta
la primera del período siguiente. Pertenece al grupo y participa desde el día que entra
—la pertenencia no depende de esto—, y la primera declaración del período que viene lo
levanta sin que nadie haga nada.

Ese tercer caso es, además, el que motiva las declaraciones extraordinarias: si entran
diez cocineros en diciembre y hace falta cubrirlos, se declara.

## 3. Alcance

### Entra

1. El módulo `afiliacion`: dominio, servicio, esquema, dos tablas y su migración.
2. El **período de afiliación** con día de corte configurable, que no es el año del
   almanaque. Ver §1.
3. `packages/personas/src/dominio/publico.ts` —el primero de personas— con
   `miembrosActivos(fecha)`.
4. `gruposAbiertosEn(fecha)` en el público de `estructura`.
5. `aFechaDeCalendario` sube de `personas` a `@gps/core/fechas`, y `crearBuilder` sale
   del índice de core a `@gps/core/graphql`. Ver §5.3.
6. `TipoDeDocumento` pasa a `enumCompartido`, porque ahora lo declaran dos módulos.
7. El barrido de declaraciones ordinarias en `services/backend`.
8. Pantallas en web y mobile: la señal de afiliación en la lista del grupo, la pantalla
   de declaraciones del grupo con su nómina, y el botón de declaración extraordinaria.
9. El escenario del demo, sembrado con el ejemplo de §1.

### No entra, y por qué

- **Tesorería, la deuda y el dinero.** Este módulo dice *a quiénes* hay que cobrar; el
  cuánto y el cobro son de otro módulo que no existe. `listarACobrar` es la costura por
  la que va a entrar.
- **El bus de eventos.** La spec base (§10) dice que llega con Afiliación, para que
  Tesorería reaccione a la declaración sin que Afiliación la conozca. Pero Tesorería no
  existe, y un bus con cero suscriptores es una interfaz sin consumidor. Cuando llegue,
  `declarar` emite el evento y ninguna tabla cambia.
- **Una vista de asociación.** No hay pantalla que muestre las declaraciones de todos los
  grupos juntas, porque quien la querría es Tesorería. `listarDeclaraciones` pide el
  grupo obligatorio y se vuelve opcional el día que haya un consumidor.
- **Etiqueta o motivo en la declaración.** La fecha alcanza para distinguirlas, incluso
  las extraordinarias. Se agrega el día que una pantalla necesite mostrar "cocineros del
  campamento" en vez de "15 de septiembre".
- **Declarar a una lista de personas elegida a mano.** Una declaración barre a *todos*
  los pendientes del grupo a esa fecha. Ver §4.3.
- **Anular o corregir una declaración.** Un hecho contable no se edita. Cuando aparezca
  el primer error real se decide si se anula con una contra-declaración o de otra forma;
  inventarlo ahora es inventar el caso.

## 4. El modelo

### 4.1 La declaración es una fotografía, no una vista

La alternativa era no guardar nada: una tabla de fechas, y la nómina calculada al vuelo
contra las pertenencias cada vez que alguien pregunta. Sale más barata y está mal.

**Las bajas se cargan tarde.** Si en agosto alguien registra que María se fue el 10 de
junio, una nómina calculada al vuelo haría que la del 1 de mayo cambie *después* de que
Tesorería cobró. Un hecho contable no puede moverse hacia atrás.

Así que declarar escribe las filas y las congela. Una corrección posterior de la
pertenencia no toca lo ya declarado, que es exactamente lo que se quiere.

### 4.2 La fotografía guarda el nombre y el documento

`afiliados` no guarda sólo `persona_id`: guarda también tipo y número de documento,
nombres y apellidos, tal como estaban ese día.

Es la misma razón por la que una factura guarda el nombre del cliente y no una foreign
key. Lo que se le presenta a la asociación identifica gente por documento, no por
nuestro id interno, y si en 2027 alguien corrige el apellido de María, la nómina de mayo
de 2026 tiene que seguir leyéndose como se leía en mayo de 2026.

De paso resuelve dos cosas de plomería: `personas` publica un solo método en vez de dos,
y el tipo `Afiliado` de GraphQL es propio de este módulo, sin tener que referenciar el
`Persona` de otro —que Pothos no permite, porque cada módulo declara sus `objectRef`
adentro de su propio `registrarSchema`—.

### 4.3 Una declaración por grupo

Una declaración es de **un grupo en una fecha**. Las ordinarias se crean todas juntas
—una por cada grupo abierto con al menos un activo—; una extraordinaria crea una sola.

Es el documento real: lo que se presenta y lo que se cobra es la nómina de un grupo. Y
como el grupo es de la declaración, `afiliados` no lo repite.

**Una declaración barre a todos los pendientes del grupo a esa fecha**, no a una lista
elegida. Si el Grupo 7 declara en septiembre por los cocineros, esa declaración también
levanta a quien entró en junio y todavía no estaba afiliado. Es lo correcto —esa persona
lo debe igual— y es lo que mantiene "declaración" como un solo concepto en vez de dos.

### 4.4 El anti-join cruza grupos

Ésta es la regla que impide que "una declaración por grupo" degenere en el modelo
persona-grupo que se descartó en §2.

Una persona es cobrable en una declaración si **no aparece en ninguna declaración
anterior del mismo período**, sea del grupo que sea. Ana, que se mudó en julio, está en la
nómina de noviembre del Grupo 12 y no se le cobra, porque el Grupo 7 la declaró en mayo.

    a cobrar en la declaración D  =
      afiliados de D
      menos los que aparecen en alguna declaración con
        periodo = periodo de D  y  fecha < fecha de D

No hace falta una columna que marque quién es cobrable: los snapshots están congelados,
así que el resultado tampoco se mueve. Lo único que podría moverlo es que aparezca una
declaración *en el medio*, y eso lo prohíbe §4.5.

**El período sí es una columna**, y se escribe al declarar. Por dos razones. La primera es
que sin ella el `WHERE` tendría que hacer aritmética de fechas en SQLite para saber a qué
período cae cada fila, que es caro de leer y fácil de equivocar. La segunda es la que de
verdad decide: si algún día la asociación mueve el día de corte, una columna calculada al
vuelo **re-particionaría la historia** y cambiaría quién fue cobrable en declaraciones ya
emitidas. Guardarlo lo congela, por el mismo argumento de §4.1.

### 4.5 No se declara con fecha anterior a la última

La regla es **global, no por grupo**: si el Grupo 12 declarara con fecha retroactiva,
movería el "a cobrar" de una declaración ya emitida del Grupo 7. Se compara contra
`max(fecha)` de todas las declaraciones.

No hay regla equivalente para el futuro, porque es imposible por construcción: la API no
recibe fechas. Ver §7.

Hay un choque teórico entre esta regla y el barrido. Si alguien apretara el botón de
declaración extraordinaria *antes* de que el barrido declare una ordinaria vencida, esa
ordinaria quedaría bloqueada para siempre. En la práctica no puede ocurrir, porque el
barrido corre al arrancar el proceso, antes de que haya nadie del otro lado para apretar
nada. Igual el servicio lo rechaza con un error y lo loguea, en vez de tragárselo.

### 4.6 Dos declaraciones del mismo día

`UNIQUE(fecha, grupo_id)` impide que un grupo declare dos veces el mismo día. Que una
*persona* no caiga en dos nóminas del mismo día lo garantiza otra cosa:
`pertenencia_vigente_por_persona`, el índice parcial de `personas`. Sin él, alguien con
dos pertenencias vigentes entraría en dos nóminas de la misma fecha, y como el anti-join
compara con `fecha <` estricto, ninguna de las dos vería a la otra: se le cobraría dos
veces.

**Es una dependencia entre módulos que no se ve en el código.** Queda anotada acá y en
§12: el día que se levante ese índice, esto hay que revisarlo.

## 5. Las fronteras

Afiliación depende de `personas` y de `estructura`. Las dos por lectura, y las dos con un
método nuevo cada una en su `publico.ts`.

### 5.1 `personas.miembrosActivos`

```ts
// packages/personas/src/dominio/publico.ts
export interface MiembroActivo {
  readonly persona: Persona
  readonly grupoId: string
}

export interface Personas {
  /** Las personas con pertenencia vigente el dia `fecha` (aaaa-mm-dd), de toda
   *  la asociacion, con el grupo al que pertenecian ese dia. */
  miembrosActivos(fecha: string): Promise<readonly MiembroActivo[]>
}
```

Es el primer `publico.ts` de personas, y sale con un solo método por la razón de la spec
de pertenencia §4.2: la interfaz pública es deliberadamente más chica que el servicio.

`listarPersonas` no servía: filtra por `hasta IS NULL`, que es "hoy", y acá hace falta "el
1 de mayo". La condición es `desde <= fecha AND (hasta IS NULL OR fecha <= hasta)` —las
mismas dos puntas inclusivas que ya documenta `estaVigente`, pero contra una fecha
cualquiera—.

Devuelve la `Persona` entera y no sólo el id porque la fotografía guarda nombre y
documento (§4.2).

### 5.2 `estructura.gruposAbiertosEn`

Un grupo cerrado no declara. Pero un grupo que cerró en octubre **sí** tenía nómina en
mayo, así que la pregunta lleva fecha:

```ts
/** Los ids de los grupos que estaban abiertos el dia `fecha` (aaaa-mm-dd).
 *  Cerrado ese mismo dia cuenta como abierto, igual que estaVigente incluye
 *  las dos puntas. */
gruposAbiertosEn(fecha: string): Promise<ReadonlySet<string>>
```

`obtenerGrupo` no alcanzaba: no toma fecha y devuelve `null` para todo lo cerrado, así
que perdería la nómina legítima de un grupo que existía el día de la declaración.

Esto es lo que la spec de estructura ya había previsto. `Grupo.cerradoEn` es una fecha y
no un booleano, y el comentario en `dominio/modelos.ts` dice textualmente por qué:
*"Afiliacion necesita saber hasta que periodo existio el grupo"*. Éste es ese momento.

### 5.3 `aFechaDeCalendario` sube a core, y core se parte en dos

`cerradoEn` es un instante y `fecha` es un día del almanaque, así que compararlos pide
convertir el primero — y es exactamente el problema de zona horaria que
`aFechaDeCalendario` ya resuelve y documenta (en UTC-3, el 1 de mayo a las 22:00 sería el
2 de mayo en UTC).

Hoy vive en `personas/dominio/vinculos.ts`. Con estructura es el tercer módulo que la
necesita, así que deja de ser de personas y pasa a core, por el mismo criterio que
`Marcas`: es la forma de un dato que cruza módulos y pantallas. `estaVigente` se queda en
personas, que es de quien es.

**Pero no puede salir por el índice de `@gps/core`, y esto obliga a partirlo.** Hoy el
paquete tiene un solo export, `"." → src/index.ts`, y ese índice arrastra dos librerías por
imports de valor:

- `builder.ts` hace `import SchemaBuilder from '@pothos/core'`
- `migraciones.ts` hace `import { sql } from 'drizzle-orm'`

Las apps importan `aFechaDeCalendario` —`AltaDePersona.tsx`, en web y en mobile—, así que
sacarla por el índice les mete Pothos y drizzle en el bundle. Hoy no pasa porque lo único
que alguien toma de core fuera del servidor es `import type { Marcas }`, y un import **de
tipo** lo borra TypeScript al compilar. Un import de valor no se borra. En web, Rollup
podría sacudir el árbol; **Metro no hace tree-shaking por omisión**, así que en mobile
entran seguro.

El paquete queda con tres puertas, y el criterio se dice en una frase:

    @gps/core           plomeria de servidor: Config, Core, Module, Migracion,
                        aplicarMigraciones, ordenarModulos, crearServicios
    @gps/core/graphql   crearBuilder y enumCompartido: lo unico que depende de
                        Pothos. Lo importan los schema.ts y la raiz de
                        composicion, y nadie mas
    @gps/core/fechas    aFechaDeCalendario: lo isomorfo, lo que un /dominio o
                        una app pueden importar sin arrastrar nada

Es la misma frontera `/dominio` ↔ `/servidor` que ya tienen todos los módulos, aplicada a
core. La puerta `/graphql` es la que pidió corregir el problema de raíz —una librería de
GraphQL no es plomería que todos necesiten— y `/fechas` sigue haciendo falta igual,
porque `aplicarMigraciones` deja drizzle en el índice. El día que alguien quiera el índice
verdaderamente liviano, el paso siguiente es mudar `aplicarMigraciones`; no hace falta
ahora, porque es plomería que ninguna app quiere.

## 6. Dominio

### 6.1 `config.ts`

```ts
// packages/afiliacion/src/dominio/config.ts
/** El dia en que arranca el periodo de afiliacion, como mes-dia. Va despues de
 *  la temporada de campamentos -enero, a veces febrero- para que el campamento
 *  que cierra un ciclo quede cubierto por la afiliacion de ese ciclo y no por
 *  la del siguiente. Ver §1. */
export const INICIO_DEL_PERIODO = '03-01'

/** Los dias en que la asociacion afila, como mes-dia. El anio lo resuelve
 *  `fechasOrdinariasDelPeriodo`. Es un catalogo y no una tabla por lo mismo que
 *  los cargos (spec de pertenencia §6.1.1): es un hecho del negocio, chico, que
 *  cambia poquisimo. Se llama config y no calendario porque es el archivo que
 *  se toca cuando la asociacion mueve una fecha. */
export const FECHAS_ORDINARIAS = ['05-01', '11-01'] as const
```

Vive en `/dominio` y no en `/servidor` para que sea puro e importable: el barrido lo lee
desde `services/backend`.

No va en `Config` de core, aunque sea configuración. `Config` tiene `version`, `entorno` y
`puerto`, que son infraestructura; meterle un campo de negocio hace que core conozca a un
módulo, y con ocho módulos termina siendo el cajón de todos.

### 6.2 Los modelos

```ts
export interface Declaracion extends Marcas {
  readonly id: string
  readonly grupoId: string
  /** aaaa-mm-dd. El dia de la foto. */
  readonly fecha: string
  /** El anio en que arranca el periodo al que cae esta declaracion. Con el
   *  corte el 1 de marzo, el 15 de enero de 2027 es del periodo 2026. Se
   *  guarda y no se deriva: ver §4.4. */
  readonly periodo: number
}

/** Una fila de la nomina: como estaba esa persona el dia de la declaracion.
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

`TipoDeDocumento` se importa de `@gps/personas/dominio`, que es un import permitido: el
`/dominio` de un módulo es público (spec de pertenencia §4.1).

### 6.3 El período

Dos funciones puras, y son toda la aritmética de calendario del módulo:

```ts
/** El periodo al que cae una fecha: el anio en que ese periodo arranco. Con
 *  INICIO_DEL_PERIODO en '03-01', periodoDe('2027-01-15') es 2026. */
export function periodoDe(fecha: string): number

/** Las fechas ordinarias de ese periodo, en orden cronologico. Resuelve cada
 *  mes-dia contra el anio del almanaque que le toca, que no siempre es el anio
 *  en que el periodo arranca: con el corte en marzo, un '01-15' en
 *  FECHAS_ORDINARIAS caeria en el anio siguiente. */
export function fechasOrdinariasDelPeriodo(periodo: number): readonly string[]
```

Viven en `/dominio` y no en `/servidor` porque las usan los dos lados: el barrido para
saber qué declarar, y las pantallas para saber por qué período preguntar. Es la razón por
la que `config.ts` está en `/dominio` y no en la config del backend.

### 6.4 `validarFecha`

La otra función pura, y la única que produce un `Problema`:

```ts
/** `ultima` es la fecha de la declaracion mas reciente, o null si no hay
 *  ninguna. `hoy` entra por parametro por la regla de portabilidad. */
export function validarFecha(
  fecha: string,
  ultima: string | null,
  hoy: string,
): Problema | null
```

Tres condiciones: formato `aaaa-mm-dd`, no posterior a `hoy`, y no anterior a `ultima`.
La segunda es inalcanzable desde la API (§7) y se valida igual, porque el barrido y el
demo llaman al servicio directo.

Un solo tipo de error, `FechaInvalida`, y no tres clases: las tres condiciones son sobre
el mismo campo y el consumidor las trata igual.

## 7. El servicio

```ts
export interface ServicioDeAfiliacion {
  /** Fotografia a los miembros activos del dia `fecha`. Sin `grupoId` declara
   *  todos los grupos abiertos con al menos un activo; con `grupoId`, ese solo.
   *  Devuelve una declaracion por grupo. */
  declarar(fecha: string, grupoId?: string): Promise<readonly Declaracion[]>

  /** La extraordinaria: fotografia ese grupo con la fecha de hoy. Existe
   *  aparte de `declarar` porque el resolver no puede armar la fecha: Context
   *  lleva `actor` y nada mas, asi que al reloj solo lo alcanza el servicio,
   *  que cierra sobre core. */
  declararExtraordinaria(grupoId: string): Promise<Declaracion>

  /** Declara toda fecha ordinaria del periodo corriente que ya paso y no tiene
   *  declaracion, en orden. Idempotente. */
  declararPendientes(): Promise<readonly Declaracion[]>

  listarDeclaraciones(grupoId: string): Promise<readonly Declaracion[]>

  /** La nomina de esa declaracion, ordenada por apellido. */
  listarAfiliados(declaracionId: string): Promise<readonly Afiliado[]>

  /** Los de esa nomina que no aparecen en ninguna declaracion anterior del
   *  mismo periodo: lo que Tesoreria va a cobrar. Ver §4.4. */
  listarACobrar(declaracionId: string): Promise<readonly Afiliado[]>

  /** Los que ya tienen afiliacion en ese periodo, de entre los que se
   *  preguntan. Devuelve el subconjunto afiliado y no un mapa de booleanos: es
   *  la misma informacion y el consumidor la usa igual, sin construir una
   *  entrada por cada persona preguntada. */
  afiliadosEn(periodo: number, personaIds: readonly string[]): Promise<ReadonlySet<string>>
}
```

Siete métodos, y los siete tienen consumidor en esta iteración: el barrido, la mutation,
la pantalla de declaraciones, su nómina, el subconjunto a cobrar y la señal en la lista
del grupo. `declarar` con fecha explícita lo usan el barrido, el demo y los tests, que son
los únicos que necesitan declarar en una fecha que no es hoy.

**Ninguna fecha llega desde afuera.** La extraordinaria la pone el servicio con
`core.reloj.ahora()` y el barrido pasa la del calendario, así que nadie tipea una fecha
nunca. Por eso "no se declara en el futuro" no es una regla que haya que hacer cumplir: es
imposible por construcción.

`periodo` entra por parámetro en `afiliadosEn` y no sale de `core.reloj`, por la misma
razón que `estaVigente` recibe `hoy`: el almanaque correcto es el de quien mira la
pantalla. La pantalla lo calcula con `periodoDe`, que puede importar porque vive en
`/dominio`.

El orden alfabético lo hace `Intl.Collator('es')` en memoria y no un `ORDER BY`, por lo
mismo que `listarPersonas`: SQLite compara bytes y "Ávila" caería después de "Zaballa".

## 8. Persistencia

```ts
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

**`grupo_id` y `persona_id` van sin foreign key**, por lo mismo que `pertenencias.grupo_id`
en la spec de pertenencia §7.4: las tablas son de otros módulos y declararlas exigiría
importar su `tablas.ts`, que es privado. Contra `declaraciones`, en cambio, la foreign key
va: es del mismo módulo.

**`afiliados` no lleva `id` ni marcas.** La declaración ya tiene el `creadoEn`, y el par
`(declaracion_id, persona_id)` es la clave natural y la primaria.

**El `UNIQUE(fecha, grupo_id)`** es lo que hace idempotente al barrido: correrlo mil veces
no puede duplicar nada, así que quién lo llama y cuándo deja de ser una decisión delicada.

**El índice por `persona_id`** es para `afiliadosEn`, que es la única lectura que no entra
por `declaracion_id` y la que corre en cada carga de la lista de un grupo. El de `periodo`
es para el anti-join de §4.4 y para el mismo `afiliadosEn`, que preguntan siempre por un
período.

## 9. El barrido

Vive en `services/backend`, no adentro del módulo:

```ts
// al arrancar, y una vez por dia
await afiliacion.declararPendientes()
```

**Adentro del teléfono no hay nada que schedulear**, y el módulo tiene que ser el mismo en
los dos lados. Ésa es la regla de portabilidad aplicada a algo que no es un import: quién
dispara es de la raíz de composición, no del módulo.

**Lo que corre a diario no es la declaración: es la pregunta.** La declaración pasa dos
veces al año; preguntar "¿hoy es día de declarar y todavía no declaré?" hay que hacerlo
seguido, porque un proceso no tiene forma de enterarse de que pasó una fecha si nada lo
despierta a mirar. La pregunta es una consulta a `declaraciones` y no hace nada el 99,5%
de los días.

Un timer apuntado a la fecha exacta —lo natural de pensar— no se puede escribir directo:
`setTimeout` guarda el delay en un entero de 32 bits y se rompe arriba de ~24,8 días. Un
`setTimeout` a seis meses no espera seis meses: dispara al instante. Apuntar a una fecha
lejana obliga a encadenar esperas cortas y volver a preguntar en cada una, que es el
barrido periódico escrito de forma más complicada.

**El que hace el trabajo de verdad es el arranque.** El intervalo es el seguro para el
proceso que lleva meses en pie. El arranque es lo que hace que el sistema se cure solo: si
estuvo caído toda la semana del 1 de mayo, al volver declara mayo y sigue, porque las
pertenencias tienen historial y la foto del 1 de mayo se puede tomar el 8.

## 10. La API

```graphql
type Afiliado {
  personaId: ID!
  tipoDeDocumento: TipoDeDocumento!
  numeroDeDocumento: String!
  nombres: String!
  apellidos: String!
}

type Declaracion {
  id: ID!
  fecha: String!
  "El año en que arranca el período al que cae esta declaración."
  periodo: Int!
  "La nómina completa del grupo ese día."
  afiliados: [Afiliado!]!
  "Los de la nómina que todavía no tenían afiliación ese período."
  aCobrar: [Afiliado!]!
}

type Query {
  declaraciones(grupoId: ID!): [Declaracion!]!
  "Los ids, de entre los preguntados, que ya tienen afiliación ese período."
  afiliadosEn(periodo: Int!, personaIds: [ID!]!): [ID!]!
}

type Mutation {
  "Declaración extraordinaria: fotografía al grupo con la fecha de hoy."
  declararAfiliacion(grupoId: ID!): Declaracion!
}
```

`afiliadosEn` va como query suelta y no como campo de `Persona` porque la flecha va en la
otra dirección: afiliación depende de personas, y personas no puede llamar a un módulo que
no conoce. La pantalla hace las dos queries y cruza por id.

`declararAfiliacion` resuelve contra `declararExtraordinaria` y devuelve una sola
`Declaracion` y no una lista: la extraordinaria es siempre de un grupo. La ordinaria no
tiene mutation — la dispara el barrido.

**`TipoDeDocumento` pasa a `enumCompartido`.** Hoy `personas` lo declara con
`builder.enumType`, y dos módulos no pueden declarar el mismo enum. `enumCompartido` es el
helper de core que existe justo para esto y que ya se usa con `Rama`.

## 11. Pantallas

En web y mobile a la par, como la iteración anterior.

**La señal en la lista del grupo.** Cada persona de `Grupo.tsx` muestra si está afiliada
en el período corriente. La pantalla ya tiene la lista; le suma una query con los ids y
cruza. El período lo calcula el cliente con `periodoDe(aFechaDeCalendario(hoy))`, de su
propio almanaque — es el mismo criterio que `estaVigente` y que `calcularEdad`, que
tampoco los resuelve el servidor.

**La pantalla de declaraciones del grupo.** Lista las declaraciones por fecha, y al abrir
una muestra su nómina con los cobrables distinguidos de los ya cubiertos. Mobile-first a
375px: la nómina es una lista de nombre y documento, no una tabla.

**El botón de declaración extraordinaria**, en esa pantalla. Es lo menos frecuente, así
que no compite por lugar con nada.

## 12. Verificación

`bun run check` en verde, `bun run schema` y el codegen del cliente regenerados y
commiteados.

Los tests que importan:

- **El escenario de §1, literal**, como test del servicio: mayo da nómina de dos y dos
  cobrables; noviembre da nómina de dos (Juan y Pedro) y un cobrable (Pedro); el 1 de mayo
  siguiente vuelve a dar dos cobrables.
- **El cambio de grupo**: Ana se muda en julio, en noviembre está en la nómina del grupo
  nuevo y no es cobrable. Es el que prueba que el anti-join cruza grupos (§4.4).
- **Los cocineros**: una extraordinaria en septiembre levanta también a quien entró en
  junio, no sólo a los recién llegados.
- **El grupo cerrado**: cerrado en octubre, no declara en noviembre; y sí declara en una
  fecha en que estaba abierto.
- **El grupo vacío**: no genera declaración.
- **El campamento de enero**, que es el que motiva todo §1: con el corte el 1 de marzo,
  quien se afilió el 1 de noviembre de 2026 sigue afiliado el 15 de enero de 2027, y una
  declaración de esa fecha no lo cobra. Recién la del 1 de mayo de 2027 lo hace.
- **`periodoDe` y `fechasOrdinariasDelPeriodo`**, como tests puros: las dos puntas del
  corte (28 de febrero y 1 de marzo) y un mes-día de FECHAS_ORDINARIAS que cae en el año
  siguiente al de arranque del período.
- **`declararPendientes` es idempotente**: dos corridas seguidas dejan lo mismo.
- **`validarFecha`**, como test puro.
- **La migración**, con el patrón que ya tiene cada módulo.

Los relojes falsos se fijan en epoch 1970, como manda el CLAUDE.md, para que cualquier
hora del sistema colada se distinga de un vistazo.

## 13. Deuda conocida

1. **Cerrar un grupo no cierra las pertenencias de su gente.** Estructura no puede hacerlo
   —la flecha va al revés— y nadie más lo hace. Afiliación lo esquiva filtrando por
   `gruposAbiertosEn`, pero `listarPersonas` de un grupo cerrado sigue devolviendo gente.
   Es un problema de personas y estructura, no de éste, y llega con quien lo sufra.
2. **La garantía de §4.6 depende de un índice de otro módulo.**
   `pertenencia_vigente_por_persona` es lo que impide que una persona caiga en dos nóminas
   del mismo día. No hay nada en el código de afiliación que lo diga; está escrito acá.
3. **Sin bus de eventos.** Cuando llegue Tesorería, `declarar` emite `AfiliacionDeclarada`
   y nada más cambia.
4. **Una declaración rechazada por retroactiva se loguea y nadie la ve.** No hay pantalla
   de alertas ni forma de enterarse salvo mirando los logs. Aceptable mientras el caso sea
   tan improbable como en §4.5.
5. **`FECHAS_ORDINARIAS` e `INICIO_DEL_PERIODO` piden rebuild.** Mover el 1 de mayo al 15
   es un cambio de código. Si la asociación empieza a moverlas seguido, pasan a ser una
   tabla con su pantalla.
6. **Mover `INICIO_DEL_PERIODO` deja una costura.** Las declaraciones viejas conservan el
   período con que se escribieron —que es lo que se quiere, §4.4— pero el período que
   queda partido al medio por el cambio puede resultar más corto o más largo que doce
   meses, y nadie avisa. Es aceptable porque mover el corte es una decisión de la
   asociación que se toma una vez cada muchos años, y quien la tome va a estar mirando.

## 14. Archivos que se tocan

    packages/core/src/fechas.ts                        nuevo: aFechaDeCalendario
    packages/core/src/index.ts                         se va crearBuilder al subpath
    packages/core/package.json                         exports: . / graphql / fechas
    packages/core/test/fechas.test.ts                  nuevo: el test que se mudo

    packages/estructura/src/servidor/schema.ts         importa de @gps/core/graphql
    packages/personas/src/servidor/schema.ts           idem
    packages/sistema/src/servidor/schema.ts            idem
    services/backend/src/composicion.ts                idem

    apps/web/package.json, apps/mobile/package.json    + @gps/core
    apps/web/src/pantallas/AltaDePersona.tsx           importa de @gps/core/fechas
    apps/mobile/componentes/AltaDePersona.tsx          idem

    packages/estructura/src/dominio/publico.ts         + gruposAbiertosEn
    packages/estructura/src/servidor/servicio.ts       + gruposAbiertosEn

    packages/personas/src/dominio/publico.ts           nuevo: Personas, MiembroActivo
    packages/personas/src/dominio/vinculos.ts          se va aFechaDeCalendario
    packages/personas/src/dominio/validaciones.ts      importa de core
    packages/personas/src/dominio/index.ts             + publico, sin aFechaDeCalendario
    packages/personas/src/servidor/servicio.ts         + miembrosActivos
    packages/personas/src/servidor/schema.ts           TipoDeDocumento por enumCompartido
    packages/personas/test/vinculos.test.ts            se va el test que se mudo

    packages/afiliacion/                               el modulo entero, nuevo
      package.json, tsconfig.json, drizzle.config.ts
      src/dominio/config.ts                            el corte y las fechas ordinarias
      src/dominio/periodos.ts                          periodoDe, fechasOrdinariasDelPeriodo
      src/dominio/modelos.ts                           Declaracion, Afiliado
      src/dominio/validaciones.ts                      validarFecha
      src/dominio/index.ts
      src/servidor/tablas.ts                           declaraciones, afiliados
      src/servidor/migraciones.ts
      src/servidor/servicio.ts
      src/servidor/schema.ts
      src/servidor/index.ts                            Module<S, { personas, estructura }>
      migraciones/0000_*.sql
      test/                                            los de §12

    services/backend/src/modules.ts                    + afiliacion
    services/backend/src/index.ts                      el barrido al arrancar y diario

    packages/demo/src/servidor/escenario.ts            el escenario de §1
    packages/demo/package.json                         + @gps/afiliacion

    packages/api/src/queries/afiliacion.graphql        nuevo
    packages/api/src/afiliacion.ts                     hooks
    packages/api/src/index.ts                          + los hooks

    apps/web/src/App.tsx                               ruta /grupos/:id/afiliacion
    apps/web/src/pantallas/Grupo.tsx                   la senial de afiliacion
    apps/web/src/pantallas/Afiliacion.tsx              nueva

    apps/mobile/app/grupos/[id].tsx                    la senial de afiliacion
    apps/mobile/app/grupos/[id]/afiliacion.tsx         nueva

    schema.gql                                         regenerado
    CLAUDE.md, docs/arquitectura.md                    el modulo nuevo y el barrido
