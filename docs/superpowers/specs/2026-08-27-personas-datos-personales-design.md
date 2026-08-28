# Personas: datos personales

Tercera iteración. `estructura` probó que un módulo con tablas, migraciones propias y
pantallas de lectura funciona de punta a punta. Ésta agrega el módulo `personas` —por
ahora sólo los datos personales— y estrena dos cosas que el proyecto todavía no tenía:
la primera **mutation** y el primer **formulario**.

Complementa `docs/superpowers/specs/2026-08-24-arquitectura-y-walking-skeleton-design.md`
(**la spec base**) y `docs/superpowers/specs/2026-08-26-estructura-persistencia-y-demo-design.md`
(**la spec de estructura**), a las que se cita en vez de repetir.

## 1. Alcance

### Entra

1. `Marcas` sube a `packages/core`: hoy la declara `estructura` y `personas` sería la
   segunda copia.
2. El módulo `personas`, acotado a los **datos personales**: tipo y número de documento,
   nombres, apellidos, fecha de nacimiento.
3. La primera mutation del proyecto: `mutationType` en `crearBuilder` y `crearPersona`.
4. Validaciones puras en `/dominio`, compartidas por el servicio y por el formulario.
5. Personas sembradas en `packages/demo`.
6. Router en `apps/web` (`wouter`) y una segunda ruta en `apps/mobile`.
7. Pantalla de personas: lista y alta, en web y en mobile.

### No entra, y por qué

**Pertenencia a un grupo y cargos.** Una persona todavía no pertenece a nada. Es la
iteración siguiente y, por lo que dice la spec de estructura (§1), vive en `estructura`:
es esa jerarquía la que se llena, no la ficha personal. Meter `grupoId` en la tabla de
personas ahora sería adivinar la cardinalidad —una persona puede estar en dos grupos, un
dirigente puede tener cargo en el distrito— antes de tener el caso real que la decide.

**Editar y dar de baja una persona.** El alta es lo que hace falta para que la pantalla
sirva de algo. Modificar exige decidir qué pasa con el documento (¿se puede corregir un
DNI mal tipeado? ¿y si ya hay una segunda persona con ése?) y la baja exige decidir si es
borrado o cierre, que en `estructura` fue `cerradoEn`. Las dos preguntas se contestan
mejor con la pertenencia ya modelada.

**Domicilio, teléfono, mail, contacto de emergencia, datos de salud.** Cada uno tiene
reglas propias —salud entra en su módulo, con otra sensibilidad— y ninguno tiene todavía
una pantalla que los pida.

**Búsqueda y paginado.** El demo siembra doce personas. Una lista plana alcanza y sobra;
cuando una diócesis real entre con miles, la lista se rompe y ahí se ve si lo que hace
falta es un buscador, un filtro por grupo o las dos cosas. Hoy sería una interfaz sin
consumidor.

**`auth`.** Sigue sin existir. Ver §9.

## 2. `Marcas` sube a `core`

Hoy `Marcas` —`creadoEn` y `actualizadoEn`, ver §3.3 de la spec de estructura— vive en
`packages/estructura/src/dominio/modelos.ts`. Los módulos no se importan entre sí, así
que `personas` no puede tomarla de ahí: o la copia, o sube.

Sube a `packages/core/src/marcas.ts` y se exporta desde el índice. Es legal porque
`@gps/core` es la excepción explícita de la regla de fronteras: es la plomería, no un
módulo, y Biome ya la permite desde cualquier `packages/*/src/**`.

    export interface Marcas {
      readonly creadoEn: Date
      readonly actualizadoEn: Date
    }

`estructura` la importa en vez de declararla y deja de re-exportarla desde
`/dominio` — nadie fuera del módulo la usaba.

**El helper de columnas de Drizzle NO sube.** Cada `tablas.ts` sigue declarando las suyas:

    const marcas = {
      creadoEn: integer('creado_en', { mode: 'timestamp_ms' }).notNull(),
      actualizadoEn: integer('actualizado_en', { mode: 'timestamp_ms' }).notNull(),
    }

La línea que separa las dos cosas: `Marcas` es la **forma del dato** que cruza hasta las
pantallas, y por eso pertenece al vocabulario compartido; las columnas son **cómo un
módulo elige guardarla**, y un módulo podría guardarla distinto sin romperle el tipo a
nadie. Subir las columnas convertiría a `core` en un lugar donde se escriben esquemas, que
es justo lo que la spec de estructura evita al no tener un `schema.ts` central (§5.1).

## 3. Dominio

### 3.1 El catálogo de tipos de documento

Mismo patrón que `RAMAS` (§2 de la spec de estructura): conjunto cerrado, constante en
`/dominio`, no tabla. Sin siembra ni migración que mantener, y el servidor y las pantallas
la comparten sin traducirla.

    export const TIPOS_DE_DOCUMENTO = [
      { id: 'dni', nombre: 'DNI' },
      { id: 'pasaporte', nombre: 'Pasaporte' },
    ] as const

    export type TipoDeDocumento = (typeof TIPOS_DE_DOCUMENTO)[number]['id']

Dos, no cinco. Libreta Cívica y Libreta de Enrolamiento sólo las tiene quien nació antes
de 1969; cédula aparece en zona de frontera. Ninguna de las tres tiene hoy una persona
real detrás, y agregar una es una línea en la constante más el `bun run schema`.

Vale la misma advertencia que para las ramas: **agregar un tipo es cambio sólo de código;
sacar o renombrar uno no lo es.** La tabla sigue guardando el id viejo.

### 3.2 `normalizarNumero`

    export function normalizarNumero(numero: string): string

Saca puntos, espacios y guiones, y pasa a mayúsculas. Se aplica **al guardar**, no al leer.

No es cosmética: es lo que hace que el `UNIQUE` de §4.2 signifique algo. Sin ella,
`30.111.222` y `30111222` entran como dos personas distintas y el índice no se entera —
justo el caso que el índice existe para impedir, porque quien carga la segunda es alguien
que no encontró la primera al buscarla escrita de la otra forma.

### 3.3 El modelo

    export interface Persona extends Marcas {
      readonly id: string
      readonly tipoDeDocumento: TipoDeDocumento
      readonly numeroDeDocumento: string
      readonly nombres: string
      readonly apellidos: string
      /** ISO 8601 sin hora: "2010-05-01". Ver 3.4. */
      readonly fechaDeNacimiento: string
    }

Y el dato que entra por el alta, que es la `Persona` sin lo que pone el servidor —el id
y las marcas—:

    export type DatosDePersona = Omit<Persona, 'id' | keyof Marcas>

Es el tipo que reciben `validarPersona` y `crearPersona`, y el que el formulario junta.
Derivarlo de `Persona` en vez de escribirlo aparte es lo que hace que agregar un campo en
la iteración que viene no se olvide en la mitad de los lugares.

`nombres` y `apellidos` en plural y como texto libre, en dos campos y no en uno. Dos campos
porque el orden de listado es por apellido y partir un nombre completo con heurísticas
falla con "de la Vega" y con "Van Der Berg". Plural porque una persona tiene los que tiene:
"María Luz", "Fernández Ruiz".

### 3.4 La fecha de nacimiento es texto, no `Date`

**`fechaDeNacimiento` es un `string` en formato `YYYY-MM-DD`, y se guarda en una columna
`TEXT`.** Es la decisión menos obvia de esta spec, así que va con su razón.

Una fecha de nacimiento no tiene hora. Guardarla como `timestamp_ms` —el modo que usan las
marcas de §3.3 de la spec de estructura— la convierte en un instante, y un instante vive en
una zona horaria. Alguien nacido el 1 de mayo se guarda como `2010-05-01T00:00:00Z` y en
UTC-3 se muestra 30 de abril. El bug no aparece en los tests, que corren en una sola zona;
aparece en el teléfono del dirigente que viaja, o el día que el servidor se despliega en
otra región.

Como texto el problema no existe: `2010-05-01` es el 1 de mayo en todos lados, se ordena
lexicográficamente igual que cronológicamente, y es exactamente lo que emite y espera un
`<input type="date">` del navegador, sin conversión en el medio.

En GraphQL viaja como `String!`. **No se agrega un scalar `Date`**: el formato ya es
inequívoco, y un scalar custom obliga a enseñárselo al codegen y a cada cliente futuro para
no ganar nada que el string no dé.

### 3.5 Validaciones

    export interface Problema {
      readonly campo: 'numeroDeDocumento' | 'nombres' | 'apellidos' | 'fechaDeNacimiento'
      readonly mensaje: string
    }

    export function validarPersona(
      datos: DatosDePersona,
      hoy: Date,
    ): readonly Problema[]

Devuelve la lista de problemas, vacía si está todo bien. **Por campo y no una lista de
strings sueltos** porque el formulario tiene que marcar el input que falla; un cartel
genérico arriba obliga a leer y adivinar cuál de los cinco campos era.

Las reglas:

- `nombres` y `apellidos`: no vacíos después de `trim`.
- `numeroDeDocumento`: no vacío y, ya normalizado, con el formato del tipo — DNI 7 u 8
  dígitos, pasaporte 5 a 15 alfanuméricos.
- `fechaDeNacimiento`: `YYYY-MM-DD` válida —incluido que el día exista, para que
  `2010-02-30` no pase—, no futura, y no anterior a 120 años.

**`hoy` entra por parámetro.** La función es pura: no consulta el reloj. En el servidor
llega `core.reloj.ahora()`, en el navegador `new Date()`. Es la regla de portabilidad, y
además es lo que permite que los tests fijen la fecha y afirmen sobre bordes exactos —
cumplir años hoy, mañana, ayer.

Estas funciones son **el motivo por el que el dominio es isomorfo**. Las mismas líneas
corren en el formulario antes de enviar y en el servicio antes de guardar. La validación
del cliente es la experiencia de uso; la del servidor es la garantía. No hay dos
implementaciones que se puedan desincronizar.

### 3.6 `nombreCompleto` y `calcularEdad`

    export function nombreCompleto(persona: Pick<Persona, 'nombres' | 'apellidos'>): string
    export function calcularEdad(fechaDeNacimiento: string, hoy: Date): number

Van en `/dominio` por la misma razón que `etiquetaDeEdades` (§2 de la spec de estructura):
son presentación **del dominio**, no del DOM ni de React Native, y dos copias divergen sin
que nadie se entere hasta que una dice otra cosa que la otra.

Son funciones libres y no métodos de una clase, y eso es deliberado. `Persona` no vive en
un lugar: es una fila de Drizzle, después un JSON de GraphQL, después una entrada del cache
persistido en IndexedDB o AsyncStorage —el cache de un mes que existe para que la app abra
sin conexión. Un método no sobrevive esas tres fronteras: lo que vuelve del cache después de
recargar es un objeto plano, sin prototipo, y `persona.calcularEdad()` fallaría sólo en el
camino de recarga, que es el que no se prueba en desarrollo. Además, con GraphQL la pantalla
no recibe una `Persona` sino lo que pidió la query, así que un método exigiría reconstruir la
entidad completa para preguntarle la edad. Por eso las firmas toman lo mínimo —`calcularEdad`
toma la fecha, no la persona—: así el formulario puede mostrar "12 años" mientras se tipea,
cuando todavía no hay ninguna persona creada.

## 4. Persistencia

### 4.1 La tabla

    export const personas = sqliteTable('personas', {
      id: text('id').primaryKey(),
      tipoDeDocumento: text('tipo_de_documento').$type<TipoDeDocumento>().notNull(),
      numeroDeDocumento: text('numero_de_documento').notNull(),
      nombres: text('nombres').notNull(),
      apellidos: text('apellidos').notNull(),
      fechaDeNacimiento: text('fecha_de_nacimiento').notNull(),
      ...marcas,
    }, (tabla) => [unique().on(tabla.tipoDeDocumento, tabla.numeroDeDocumento)])

Clave sustituta como primaria y clave natural como `UNIQUE`, igual que distritos y grupos
(§3.4 de la spec de estructura): el par documento identifica a la persona para la
asociación, pero las claves naturales se corrigen —un DNI mal tipeado— y eso arrastraría
cada foreign key que apunte a la persona, que en la iteración de pertenencia van a ser
varias.

### 4.2 Por qué el `UNIQUE` es sobre el par y no sobre el número

Un DNI y un pasaporte pueden coincidir en el número: son espacios de numeración distintos.
Sobre el par, cargar dos veces a la misma persona falla en la base, que es donde una regla
no se puede saltear.

### 4.3 El mensaje del duplicado

`crearPersona` consulta si ya hay una persona con ese par **antes** de insertar, y si la
hay tira `DocumentoDuplicado` con un mensaje legible.

Ese `SELECT` no es la garantía —dos altas simultáneas lo pasan las dos—, y no hace falta que
lo sea: el `UNIQUE` de §4.1 es el que garantiza. El `SELECT` existe sólo para el mensaje: sin
él, lo que llega al formulario es el texto crudo de SQLite,
`UNIQUE constraint failed: personas.tipo_de_documento, personas.numero_de_documento`, que no
se le puede mostrar a nadie.

### 4.4 El orden lo hace `Intl.Collator`, no `ORDER BY`

`listarPersonas` trae las filas y las ordena en memoria por apellidos y después nombres,
con `Intl.Collator('es')`.

SQLite compara bytes: con `ORDER BY apellidos`, "Ávila" cae después de "Zaballa". No es un
detalle estético en un país donde los acentos son comunes — es una lista alfabética en la
que no se encuentra a la gente.

Ordenar en memoria es el mismo criterio que `listarDistritos`, que arma el árbol con tres
consultas (§5.2 de la spec de estructura): con la cantidad de personas de una diócesis
alcanza de sobra, y si algún día deja de alcanzar se arregla en un solo lugar.

## 5. La primera mutation

### 5.1 `mutationType` en `crearBuilder`

`packages/core/src/builder.ts` declara hoy sólo `builder.queryType({})`. Se le suma
`builder.mutationType({})`, por la misma razón por la que `Query` se declara ahí: para que
cada módulo agregue campos con `builder.mutationField(...)` sin competir por declarar el
tipo desde cero, y el orden de registro no importe.

### 5.2 La forma

    input DatosDePersona {
      tipoDeDocumento: TipoDeDocumento!
      numeroDeDocumento: String!
      nombres: String!
      apellidos: String!
      fechaDeNacimiento: String!
    }

    type Mutation {
      crearPersona(datos: DatosDePersona!): Persona!
    }

Un `input` y no cinco argumentos sueltos: el formulario junta un objeto y lo manda, y
agregar un campo en la iteración que viene no cambia la firma de la operación.

`Persona` en GraphQL expone `id`, `tipoDeDocumento`, `numeroDeDocumento`, `nombres`,
`apellidos` y `fechaDeNacimiento`. **No expone `edad`.** El resolver no puede calcularla:
consultar el reloj está prohibido bajo `src/servidor/` y el plugin de portabilidad lo
rechaza. Y aunque se pasara por `Core`, el "hoy" correcto es el de quien mira la pantalla,
no el del servidor. El cliente ya recibe `fechaDeNacimiento` y tiene `calcularEdad`
(§3.6): la edad se calcula ahí, con cero plomería y más correcta.

### 5.3 Los errores viajan como errores de GraphQL

El servicio valida con `validarPersona` y tira `DatosInvalidos`, que lleva los `Problema`
adentro. Sale por el arreglo `errors` de GraphQL y llega al cliente en `ErrorDeApi.errores`,
que ya existe en `packages/api/src/transporte.ts`.

Se descartaron dos alternativas. Una unión tipada en el esquema
(`crearPersona: Persona | ErrorDeValidacion`) declara los errores en el contrato, que es
mejor a largo plazo, pero es boilerplate de Pothos en ésta y en cada mutation futura, y la
decisión conviene tomarla cuando haya varias mutations que la paguen. `@pothos/plugin-errors`
genera esa unión sola, pero es una dependencia y configuración en `core` que todos los
módulos heredan, por una sola mutation.

Lo que hace que alcance es §3.5: **el formulario valida antes de enviar con las mismas
funciones puras**, así que el throw del servidor no es la experiencia de uso, es la última
línea de defensa. El único error que un usuario va a ver por esta vía en la práctica es el
documento duplicado de §4.3, que el cliente no puede anticipar.

### 5.4 El resolver traduce el error, porque Yoga enmascara

`createYoga` corre con el enmascarado de errores por default: cualquier excepción que no
sea un `GraphQLError` sale como `"Unexpected error."`. Sin hacer nada, el mensaje de §4.3
no llegaría nunca al formulario.

La salida **no** es `maskedErrors: false`: eso mandaría al cliente el texto crudo de
cualquier fallo, incluidos los de SQLite, que es lo que el enmascarado existe para
impedir.

La salida es que **el resolver capture `DatosInvalidos` y `DocumentoDuplicado` y los
vuelva a tirar como `GraphQLError`**, con el mensaje y los `Problema` en `extensions`.
Es exactamente el trabajo del resolver: es la frontera entre el dominio y GraphQL. El
servicio sigue tirando errores de dominio y sin conocer el framework, que es lo que
permite que el mismo servicio corra dentro del teléfono, donde no hay Yoga.

Efecto lateral: `packages/personas` suma `graphql` a sus dependencias, sólo para
`src/servidor/schema.ts`. `estructura` no la necesita porque no tira nada.

## 6. Demo

`packages/demo` suma personas al escenario, sembrándolas por el servicio y no por SQL,
igual que la estructura (§6.1 de la spec de estructura): los datos del demo pasan por las
mismas validaciones que los reales, así que un demo que arranca es una prueba de que las
validaciones no rechazan datos legítimos.

Doce personas. Los criterios, todos por la misma razón —un demo donde todas las filas son
iguales no muestra si la pantalla aguanta los casos que se rompen—: edades repartidas de
castores a adultos, para que la columna de edad muestre el rango entero; un pasaporte entre
once DNI; apellidos con acento y con eñe, que son los que exponen el orden de §4.4; un
apellido compuesto y un nombre compuesto, que son los que exponen partir un nombre completo
con heurísticas.

Las personas no se relacionan con ningún grupo: esa columna todavía no existe (§1).

## 7. Pantallas

### 7.1 Router en la web

`apps/web` no tiene router: `App.tsx` es una sola pantalla. Con dos módulos con pantalla ya
hace falta. Se suma **`wouter`** (~2 kB, hooks y componentes `Route`/`Link`) y `App.tsx` pasa
a ser el layout con la navegación, con las pantallas en `src/pantallas/Estructura.tsx` y
`src/pantallas/Personas.tsx`.

`wouter` y no `react-router` porque el data fetching ya lo hace TanStack Query, así que
loaders, actions y el data router son superficie que no se va a usar. No es una decisión
cara de revertir: si algún día hacen falta, migrar es reescribir `App.tsx`.

Rutas: `/` es estructura, `/personas` es personas.

### 7.2 La segunda ruta en mobile

`apps/mobile` ya usa `expo-router` con un `Stack`. Se agrega `app/personas.tsx` y un link
desde la pantalla de estructura. El `Stack` tiene `headerShown: false` global, así que la
pantalla de personas declara su propio `<Stack.Screen options={{ headerShown: true }} />`
para tener el botón de volver, en vez de cambiar el default de todas.

### 7.3 La lista

Apellidos y nombres, la edad —calculada en el cliente con `calcularEdad`—, y el documento.
Mobile-first, a 375px: una fila por persona. Los tres estados que ya maneja la pantalla de
estructura —cargando, error, vacío— se repiten acá.

### 7.4 El formulario

Los cinco campos, validados al enviar con `validarPersona(datos, new Date())`. Los
`Problema` se muestran contra su campo. Si el servidor rechaza igual —documento duplicado—,
el mensaje va arriba del formulario, sin perder lo tipeado.

Al éxito, se invalida `['personas']` y la lista se actualiza sola.

**El input de fecha.** En la web es `<input type="date">`: nativo, accesible, con el
calendario del sistema, y emite exactamente el `YYYY-MM-DD` de §3.4. En React Native no hay
equivalente sin sumar `@react-native-community/datetimepicker`. Va un `TextInput` con
placeholder `aaaa-mm-dd` —el mismo formato que valida el dominio, así no hay conversión que
escribir ni un segundo formato que mantener— y la misma validación pura, marcado con un
comentario `ponytail:`
que nombra el techo —tipear una fecha en un teléfono es peor que elegirla— y el reemplazo.
Un picker es una dependencia nativa para el primer formulario del proyecto; si el alta desde
el teléfono resulta ser un camino real y no una demostración, se suma ahí.

## 8. Verificación

- `bun run check`: lint, tipos y tests.
- Tests del módulo, con el `Core` falso de reloj fijo en epoch 1970 y ids fijos, como los de
  `estructura`: migraciones (la tabla existe, el `UNIQUE` muerde), validaciones (cada regla y
  sus bordes, con `hoy` fijo), normalización, orden con acentos, alta duplicada.
- `bun run schema` y commitear el `schema.gql`. CI verifica que no quede desactualizado.
- `bun run --filter @gps/api codegen` después del schema.
- `bun run demo`, y cargar una persona desde la pantalla en web y en mobile: es lo único que
  prueba la cadena entera, formulario → mutation → servicio → base → invalidación → lista.

## 9. Deuda conocida

**Esta mutation la puede llamar cualquiera.** No hay `auth`, así que cualquiera que alcance
el `/graphql` puede dar de alta personas. Es coherente con el estado del proyecto —todo es
público hoy—, pero cambia de categoría: hasta acá todo era lectura. Cuando llegue `auth`,
`crearPersona` es la primera que necesita `accesoAlModulo`, y los datos personales son
además el primer candidato a políticas por campo (`src/dominio/politicas.ts`, §8.4 de la
spec base).

**Sin unicidad blanda.** Dos personas con el mismo nombre y fecha de nacimiento y documentos
distintos entran las dos, y es correcto: pueden ser dos personas. Pero si una es la misma
cargada con un typo en el documento, nadie avisa. Un aviso de posible duplicado es trabajo
para cuando haya volumen real.

**`normalizarNumero` no valida el dígito verificador de nada.** DNI argentino no tiene;
pasaporte sí tiene formato por país. Se valida largo y alfabeto, nada más.

**El cliente y el servidor pueden discrepar sobre qué día es hoy.** `calcularEdad`
(§3.6) compara los dígitos de `fechaDeNacimiento` contra los campos de fecha locales
del `Date` que recibe. El formulario le pasa el `new Date()` del navegador; el
servicio le pasa `core.reloj.ahora()`, que es el `new Date()` del proceso del
servidor. Ni el `Dockerfile` ni `compose.yaml` fijan `TZ`, así que el servidor corre
en el calendario que tenga el contenedor —normalmente UTC—. A alguien en una zona
horaria adelantada, en las últimas horas antes de la medianoche del servidor, que
carga una fecha de nacimiento de ese mismo día, el formulario se la acepta y el
servidor se la rechaza con "La fecha de nacimiento no puede ser futura.": un error
legible, no un dato corrupto, pero desconcertante porque el formulario ya la había
aceptado. No se arregla ahora porque la ventana es angosta —sólo cerca de la
medianoche, sólo para un alta del mismo día, sólo cuando el cliente le lleva la
delantera al servidor—, la falla es un mensaje claro y no una corrupción
silenciosa, y el arreglo —un día de tolerancia, o resolver "hoy" en un solo lugar—
se decide mejor cuando haya un usuario real cruzando husos horarios.

## 10. Archivos que se tocan

Nuevos:

    packages/core/src/marcas.ts
    packages/personas/                       (paquete completo, plantilla: estructura)
      package.json, tsconfig.json, drizzle.config.ts
      src/dominio/{index,modelos,documentos,validaciones}.ts
      src/servidor/{index,servicio,schema,tablas,migraciones,sql.d}.ts
      migraciones/0000_inicial.sql
      test/{migraciones,validaciones,documentos,servicio}.test.ts
    packages/api/src/personas.ts
    packages/api/src/queries/{personas,crearPersona}.graphql
    apps/web/src/pantallas/{Estructura,Personas}.tsx
    apps/mobile/app/personas.tsx

Modificados:

    packages/core/src/index.ts               exporta Marcas
    packages/core/src/builder.ts             suma mutationType
    packages/estructura/src/dominio/modelos.ts, index.ts    importa Marcas de core
    services/backend/src/modules.ts          una línea
    packages/demo/{package.json,src/servidor/escenario.ts}  siembra personas
    packages/api/src/index.ts                exporta los hooks nuevos
    apps/web/{package.json,src/App.tsx}      wouter y el layout con navegación
    schema.gql                               regenerado
