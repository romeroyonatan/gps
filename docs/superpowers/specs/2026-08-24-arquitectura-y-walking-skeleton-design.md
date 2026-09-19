# GPS — Arquitectura y walking skeleton

Fecha: 2026-08-24
Estado: aprobado, pendiente de plan de implementación

## 1. Contexto y alcance

GPS es un CRM para gestionar los scouts de la asociación. El sistema completo abarca
ocho módulos de negocio: Personas, Estructura, Salud, Afiliación, Permisos, Tesorería,
Formación y Mensajería.

Ocho módulos son demasiado para una sola spec. Esta spec cubre exclusivamente:

- La arquitectura transversal: monorepo, sistema de módulos, core, inyección de
  dependencias, GraphQL, frontends, empaquetado y documentación.
- El **walking skeleton**: una app web y una app mobile que muestran la versión del
  sistema, consumiendo la API GraphQL real. Es el "hola mundo" que prueba que todas
  las piezas encastran.
- El primer módulo, llamado `sistema`, que expone esa versión.

Cada módulo de negocio posterior tendrá su propia spec, su propio plan y su propio
ciclo de implementación, ya sobre los rieles que define este documento.

### Estado: prototipo, sin datos reales

Las primeras iteraciones construyen un **prototipo**. El sistema no va a operar con
datos reales de personas de la asociación hasta que se decida lo contrario
explícitamente.

Eso habilita diferir cosas que de otro modo serían bloqueantes —autenticación,
autorización efectiva, el módulo Salud, la bitácora de accesos, el cifrado en reposo— y
es lo que permite avanzar rápido sobre la arquitectura sin cargar todo el peso desde el
primer día.

El riesgo de este tipo de supuesto es que caduque en silencio: un prototipo que funciona
bien empieza a recibir datos de verdad sin que nadie tome la decisión de que eso pase.
Para evitarlo, la condición es explícita.

**Antes de que el sistema reciba el primer dato real de una persona, tienen que estar
resueltos:**

1. El módulo `auth` implementado y el login funcionando.
2. La autorización efectivamente aplicada: `Alcance` obligatorio en todo repositorio y
   políticas de dominio en cada módulo (§8).
3. Copias de seguridad, verificadas restaurando una.
4. Si existe el módulo Salud: bitácora de accesos, minimización en la sincronización y
   cifrado en reposo del lado del dispositivo (§8.7).
5. El régimen de protección de datos aplicable, confirmado con la asociación (§16).

Ninguno de los cinco entra en la iteración 1. Los cinco son requisito para pasar de
prototipo a sistema en uso, y ese pasaje es una decisión que se toma, no algo que ocurre.

### Qué prueba el walking skeleton

Al terminar la iteración 1, la siguiente cadena queda demostrada de punta a punta:

    registro de módulos
      -> composición del esquema Pothos
      -> resolver leyendo un servicio del módulo
      -> GraphQL Yoga
      -> schema.gql versionado
      -> codegen
      -> TanStack Query con cache persistido
      -> pantalla en web y en mobile

La única capa que queda sin probar es la persistencia, deliberadamente (ver §6).
La va a probar el primer módulo que necesite base de datos.

## 2. Decisiones de arquitectura

Cada decisión incluye la alternativa descartada y el motivo, para que no haya que
volver a discutirlas.

### 2.1 Frontend: Vite SPA + Expo, separados

Web es React + Vite + Tailwind, una SPA sin SSR. Mobile es Expo + React Native.
Comparten paquetes de dominio, modelos, validaciones y cliente de API, pero no
comparten componentes de UI.

Descartado **Expo universal** (una sola UI con react-native-web): limita layouts
densos como las tablas de afiliación y tesorería, y deja fuera el ecosistema web.

Descartado **Next.js**: el CRM vive detrás de login, así que SSR y SEO no aportan;
Next agrega un segundo runtime al deploy y rompe el "un solo webserver"; además
tiende a atraer lógica al servidor de Next en lugar de la API GraphQL pública que
nosotros mismos consumimos.

Desktop, si algún día se pide, es envolver la SPA con Tauri o Electron.

### 2.2 Un módulo es un paquete con varios entry points

`packages/<modulo>/` contiene el módulo completo y lo expone por subpaths:

- `@gps/<modulo>/dominio` — modelos, validaciones y reglas puras. Isomorfo.
- `@gps/<modulo>/servidor` — esquema GraphQL, resolvers, repositorios, migraciones.
- `@gps/<modulo>/ui` — componentes o hooks compartibles. Opcional.

El backend importa sólo `/servidor` y lo registra. Los frontends importan sólo
`/dominio` y nunca ven código de servidor.

Descartado **partir el módulo entre `packages/` y `services/backend/`**: el módulo
deja de ser un artefacto y pasa a ser una convención de carpetas repartida en dos
lugares; crear un módulo se vuelve una instrucción de varios pasos fácil de hacer a
medias, y dar de baja un módulo deja de ser borrar una carpeta.

Descartado **tres paquetes por módulo**: veinticuatro `package.json` y `tsconfig` para
ocho módulos es demasiada ceremonia para un equipo chico.

El límite front/servidor no se confía al tree-shaking: lo impone la regla
`noRestrictedImports` de Biome, con una excepción por directorio que prohíbe a
`apps/**` importar cualquier subpath `*/servidor`. Falla al lintear, no en producción.

### 2.3 GraphQL code-first con Pothos

Cada módulo recibe el builder de Pothos y registra sus tipos, queries y mutations en
TypeScript. Los resolvers quedan tipados sin codegen del lado servidor.

El SDL se **genera** y se **versiona** en `schema.gql` en la raíz del repo. CI lo
regenera y falla si difiere del commiteado, de modo que ningún cambio a la API
pública puede pasar sin aparecer en el diff.

Descartado **SDL-first con graphql-tools**: los resolvers quedan sin tipar salvo que
se agregue codegen también en el servidor, y el `extend type Query` repartido entre
módulos falla en runtime en vez de al compilar.

Descartado **Federation**: rompe el "un solo webserver" y agrega gateway y build de
supergraph para un problema que no tenemos.

### 2.4 Persistencia: Drizzle sobre SQLite (diferido)

Cuando haga falta base de datos, será Drizzle: cada módulo declara sus tablas en
TypeScript dentro de su propio paquete y `drizzle-kit` genera ahí mismo sus
migraciones SQL. No hay archivo central de esquema que todos deban editar, que es
justo lo que rompería la arquitectura de módulos. Drizzle tiene dialectos para SQLite
y Postgres, así que una migración futura es cambiar el dialecto, no reescribir.

Descartado **Prisma**: exige un `schema.prisma` único y centralizado, lo contrario a
módulos autocontenidos, y arrastra un engine binario pesado.

Descartado **Kysely + SQL a mano**: control total pero toda la portabilidad
SQLite→Postgres queda a cargo nuestro.

**Esto no entra en la iteración 1.** Ver §6.

### 2.5 Runtime: Bun

Bun cumple tres roles: runtime, gestor de paquetes y corredor de tests.

Motivos: ejecuta TypeScript nativo, con lo cual el diseño de "los paquetes internos
no se compilan" no necesita `tsx` ni bundling; trae SQLite adentro, sin binarios
nativos que compilar en la imagen Docker; e instalación aislada (`linker = "isolated"`
en `bunfig.toml`) que garantiza que un paquete sólo pueda importar lo que declaró en
su `package.json` — la misma garantía estricta que da pnpm, y sin la cual las
fronteras entre módulos se disuelven por hoisting.

Consecuencia directa: **el deploy es un contenedor, no AWS Lambda** (ver §2.6).

Se descartan por redundantes: pnpm, Turborepo, Vitest y `tsx`. Turborepo aportaría
cacheo de tareas en CI; con este tamaño de proyecto todavía no hace falta y se agrega
sin fricción cuando duela. Las tareas del workspace se corren con
`bun run --filter '*' <tarea>`.

Salvedad conocida: `bun test` es ideal para dominio, core y backend, pero para tests
de componentes de React Native el camino soportado sigue siendo `jest-expo`. No es
problema porque la lógica vive en `packages/` y los componentes quedan sin nada
sustancial que testear; si algún día hacen falta, la decisión queda acotada a
`apps/mobile`.

### 2.6 Deploy: contenedor, no Lambda

Se evaluó y se descartó el plan original de AWS Lambda con SQLite sobre un volumen EFS.

Motivo: el bloqueo de archivos de SQLite depende de que el sistema de archivos
implemente locking correctamente, y sobre NFS —que es lo que es EFS— eso es
históricamente poco confiable; es el escenario que la propia documentación de SQLite
señala como propenso a corrupción. Además Lambda escala a varios contenedores
concurrentes por diseño, con lo cual habría múltiples procesos escribiendo el mismo
archivo por NFS. Mitigarlo exige concurrencia reservada en 1, que convierte el sistema
en un request a la vez.

En su lugar: un contenedor corriendo permanentemente (Fly.io, Railway o una instancia
chica), con SQLite en disco local y, cuando SQLite aparezca, Litestream replicando a
S3. Costo del mismo orden, sin el riesgo. Alternativa equivalente si se prefiere
gestionado: Turso / libSQL, compatible con Drizzle.

Terraform queda fuera de este repositorio.

### 2.7 Cliente GraphQL: TanStack Query + graphql-request

Cache por consulta, no normalizada, con persistencia en disco: IndexedDB en web,
AsyncStorage en mobile. Tipos y hooks salen de graphql-codegen leyendo el `schema.gql`
versionado.

Descartado **Apollo Client**: la cache normalizada resuelve la obsolescencia entre
módulos, que es un beneficio real, pero es el bundle más pesado y su cache es la
principal fuente de bugs de "por qué no se actualiza la UI"; además una cache
normalizada persistida en disco exige versionar y purgar cuando cambia el esquema.

Descartado **urql + graphcache**: su `offlineExchange` parece resolver el requisito
offline, pero resuelve conflictos reenviando en orden, con lo cual si dos autoridades
firman el mismo permiso sin conexión gana la última en sincronizar, sin aviso. Para
firmas entre autoridades eso no es aceptable.

**Razonamiento de fondo:** el offline de escritura no se resuelve eligiendo librería
de cache. Se resuelve con una réplica local y reglas de conflicto explícitas del
dominio (§11), y eso es ortogonal al cliente GraphQL. La lectura offline —abrir un
permiso ya descargado sin señal— sí queda cubierta por el cache persistido.

Costo aceptado: sin normalización, cuando Afiliación cambia el estado de una persona
la pantalla de Personas no se entera sola; la invalidación se escribe a mano. Es
trabajo explícito y visible, no un bug silencioso.

## 3. Estructura del monorepo

    gps/
      package.json            scripts raíz
      bunfig.toml             linker = "isolated"
      biome.json
      tsconfig.base.json
      schema.gql              contrato público versionado (generado)
      Dockerfile
      docker-compose.yml
      AGENT.md
      CLAUDE.md               enlace simbólico a AGENT.md
      README.md
      docs/
        crear-un-modulo.md    tutorial para humanos
        superpowers/specs/

      apps/
        web/                  Vite + React + Tailwind
        mobile/               Expo + React Native + NativeWind

      packages/
        core/                 contrato de módulo, registro, bus, config, logger, interfaces
        api/                  cliente GraphQL, transporte, codegen
        sistema/              primer módulo: versión del sistema

      services/
        backend/              GraphQL Yoga: compone, registra y sirve

### 3.1 Los paquetes internos no se compilan

`packages/*` no tienen `dist/`, ni `tsc -b`, ni watchers: exportan TypeScript directo
y lo compila quien los consume — Vite en web, Metro en mobile, Bun en el backend.
Esto elimina el problema más molesto de los monorepos TypeScript: cambiar un tipo en
un paquete y tener que recordar reconstruir antes de que el consumidor lo vea.

El chequeo de tipos es `tsc --noEmit` por paquete, corrido en paralelo.

## 4. Regla de idioma

**El idioma lo decide el dominio, no la capa.**

| Español | Inglés |
|---|---|
| Todo lo que nombra el escultismo: `Persona`, `Grupo`, `Distrito`, `Afiliacion`, `Permiso`, `Cuota`, `Curso` | Vocabulario técnico de la industria: `module`, `core`, `index`, `server`, `context`, `config`, `logger`, `schema`, `migration`, `repository`, `cache`, `query` |
| Reglas de negocio: `calcularCuotaDelGrupo`, `validarAfiliacion`, `estaHabilitadoParaAcampar` | Rutas y archivos canónicos: `/health`, `/graphql`, `index.ts`, `schema.gql`, `README.md`, `src/`, `migrations/` |
| Campos GraphQL y columnas del dominio: `nombre`, `apellido`, `documento`, `fechaNacimiento` | Contrato de módulo: `Module { name, dependencies, createServices, registerSchema }` |
| Comentarios, mensajes de error al usuario, nombres de tests | |

Casos de frontera ya resueltos:

- Repositorios: `PersonasRepository` con métodos en español (`buscarPorDocumento`).
  "Repository" es vocabulario de industria; "buscarPorDocumento" es dominio.
- El objeto de servicios transversales se llama `Core`, no `Nucleo`.
- El módulo `sistema` expone `Version { numero, entorno, modulos }` en español, aunque
  el módulo sea técnico, porque es API pública y es donde más importa leer en un solo
  idioma. Es el precedente que copian los demás módulos.

## 5. El core y el contrato de módulo

**Nota de vocabulario.** En este proyecto conviven dos cosas que la industria llama
"plugin" y que no tienen relación entre sí. Para evitar la confusión el vocabulario queda
fijado, y rige también en `AGENT.md` y en el código:

- **Módulo** — una unidad de negocio nuestra: Personas, Afiliación, `sistema`. La interfaz
  es `Module` y la lista registrada vive en `services/backend/src/modules.ts`.
- **Plugin** — reservado exclusivamente para los interceptores del pipeline de GraphQL de
  envelop, que es el sistema de extensión que trae Yoga. Ahí van las cosas transversales a
  todas las consultas: registro automático de auditoría (§10.2), rate limiting, cacheo de
  respuestas y enmascarado de errores. Viven en `services/backend/src/envelop.ts`.

Lo que el pedido original llamaba "arquitectura de plugins para los módulos" es lo
primero.

### 5.1 Sin contenedor de inyección mágico

Nada de decoradores ni `reflect-metadata`: además de romper con Metro, esconden los
errores hasta runtime. Se usa una **raíz de composición explícita**: el host construye
una vez los servicios transversales y se los pasa a cada módulo. Si falta algo, no
compila.

    // packages/core/src/core.ts
    export interface Core {
      reloj: Reloj                 // inyectable: los tests no dependen de la hora real
      logger: Logger
      config: Config
    }

    // packages/core/src/module.ts
    export interface Module<S = unknown> {
      readonly name: string
      readonly dependencies: readonly string[]
      createServices(core: Core): S
      registerSchema(builder: Builder): void
    }

`Core` es deliberadamente chico. No expone base de datos, notificaciones push ni
correo, porque en la iteración 1 ningún módulo los consume; cada uno entra junto con su
primer consumidor real, y agregarlos es una línea en la interfaz más su implementación
en `services/backend`. Lo que sí está fijado desde ahora es que **ese es el único lugar
por donde un módulo llega a una capacidad de plataforma** (§5.3).

### 5.2 Cómo se conectan las piezas

El host registra los módulos, resuelve el orden por `dependencies` (detectando ciclos)
y monta los servicios de cada módulo en el contexto de GraphQL bajo el nombre del
módulo. Los resolvers quedan así:

    // packages/sistema/src/servidor/schema.ts
    export function registerSchema(builder) {
      builder.objectType('Version', {
        fields: t => ({
          numero:  t.exposeString('numero'),
          entorno: t.exposeString('entorno'),
          modulos: t.exposeStringList('modulos'),
        }),
      })

      builder.queryField('version', t =>
        t.field({
          type: 'Version',
          resolve: (_, __, ctx) => ctx.sistema.obtenerVersion(),
        }))
    }

**Los módulos no se importan entre sí.** Cuando Afiliación necesite Personas, lo pide
por `ctx.personas`. Esa es la única vía de comunicación entre módulos, y está tipada
porque cada módulo extiende la interfaz `Context` del core por declaration merging.

### 5.3 Regla de portabilidad (obligatoria)

> El código de servidor de un módulo nunca toca una API de plataforma directamente —
> ni `bun:sqlite`, ni `fs`, ni `fetch`, ni la hora del sistema. Todo pasa por `Core`.

Es gratis hoy y es lo que hace posible el modo demo y el offline (§11). Retrofitearla
en ocho módulos sería carísimo. Va en `AGENT.md` como requisito, no como sugerencia.

### 5.4 Qué es core y qué no

Core tiene el contrato de módulo, el registro, y las **interfaces** de los servicios
transversales. En la iteración 1 esas interfaces son `Config`, `Logger` y `Reloj`; las
que vendrán —`Notificador`, `Correo`, `Almacenamiento` (§9), base de datos— se agregan
al llegar su primer consumidor.

Core nunca contiene implementaciones concretas: Expo Push, Resend o S3 viven en
`services/backend`. Ésa es la propiedad que permite testear el dominio con
implementaciones falsas sin levantar nada, y la que hace posible el modo demo (§11).

## 6. El backend y el módulo `sistema`

### 6.1 El backend es deliberadamente tonto

Todo su código es raíz de composición:

    services/backend/src/
      index.ts        arranque
      server.ts       Bun.serve: /graphql, /health, estáticos de web
      core.ts         arma el Core con las implementaciones concretas
      modules.ts      la lista de módulos registrados
      envelop.ts      interceptores del pipeline de GraphQL
      context.ts      contexto de cada request

Un solo proceso `Bun.serve`: `/graphql` va a GraphQL Yoga, `/health` responde el
chequeo, y todo lo demás sirve el build estático de `apps/web`. Eso cumple literal el
"un solo webserver": un contenedor, un puerto. En desarrollo Vite proxea `/graphql`
para tener recarga en caliente.

### 6.2 Costuras abiertas sin implementar de más

- El contexto expone `actor: Actor | null`, siempre `null` por ahora. Auth llega como
  módulo propio con su propia spec (login con Google y Apple ID); el modelo de actor,
  alcance y políticas está fijado en §8.
- Rate limiting: plugin de envelop en memoria cuando haga falta. Con un solo contenedor
  alcanza; algo compartido sólo si se escala horizontalmente. **No entra en la iteración
  1**: sin auth, sin datos y sin ambiente expuesto, no hay nada que proteger, y es
  recuperable —agregarlo es un plugin, sin cambio de API pública. Es requisito antes de
  exponer la API a internet.

### 6.3 El módulo `sistema`

No lleva base de datos ni migración. Meter SQLite, Drizzle y un migrador para que no
los use nadie es complejidad especulativa; entran cuando Personas los pida, que es un
cambio de una línea en el contrato de `Module`.

    type Query { version: Version! }

    type Version {
      numero: String!        # del package.json raíz
      entorno: String!
      modulos: [String!]!    # nombres de los módulos registrados
    }

`modulos` se arma del registro de módulos en vivo, con lo cual la consulta prueba la
composición real del sistema y no un valor hardcodeado.

## 7. Los frontends

### 7.1 `packages/api` — lo que comparten las dos apps

Las dos apps necesitan lo mismo: cliente GraphQL, tipos y hooks generados. Duplicarlo
significaría correr codegen dos veces y mantener dos copias divergentes.

    packages/api/
      codegen.ts          lee schema.gql + los documentos .graphql
      src/client.ts       fábrica del cliente (recibe transporte y almacenamiento)
      src/transporte.ts   la interfaz Transporte y la implementación HTTP
      src/generated/      hooks tipados (no se commitea, se genera)
      src/queries/        los documentos .graphql

Cada app le pasa lo que la diferencia: la URL de la API y el persistidor del cache.
El resto del código de datos es idéntico, y esa es la prueba concreta de que la
arquitectura compartida funciona.

**El cliente no habla de HTTP, habla de un transporte:**

    export interface Transporte {
      ejecutar(documento: string, variables?: object): Promise<unknown>
    }

En la iteración 1 existe una sola implementación, `transporteHttp`. La interfaz existe
desde ahora porque es lo que habilita el modo demo (§11) sin tocar ninguna pantalla.

### 7.2 `apps/web`

Vite + React + Tailwind. En desarrollo Vite proxea `/graphql` al backend con recarga
en caliente; en producción es un build estático que sirve el mismo Bun.

Sin router: hay una sola pantalla, y agregarlo cuando exista la segunda es un archivo.

### 7.3 `apps/mobile`

Expo + React Native + NativeWind, de modo que las clases se escriben igual que en web.
Se conserva `expo-router` aunque no haga falta, porque es el andamio por defecto de
Expo y sacarlo cuesta más que dejarlo. Es una asimetría deliberada con web, anotada
para que no parezca un descuido. La URL de la API entra por `EXPO_PUBLIC_API_URL`.

### 7.4 Mobile-first como regla escrita

Todo se diseña primero a 375px de ancho. Los prefijos `sm:` y `md:` se usan sólo para
**agregar** en pantallas grandes, nunca para arreglar lo que se rompió en chicas. Va
en `AGENT.md`.

### 7.5 Offline desde el esqueleto

El cache persistido de TanStack Query se configura en las dos apps desde la primera
iteración, aunque la única consulta sea la versión. La prueba de aceptación es
manual y concreta: abrir la app, cortar la red, cerrarla, volver a abrirla, y que
siga mostrando la versión en lugar de un error.

### 7.6 Fuera de alcance en la iteración 1

Paquete de tokens de diseño compartido entre Tailwind y NativeWind, componentes
compartidos, y manejo de sesión. Los tres son baratos de agregar después y hoy no
tienen a quién servir. Los tokens entran con la primera pantalla real.

## 8. Autenticación y autorización

Ninguna de las dos se implementa en la iteración 1, pero la autorización impone
convenciones que son gratis hoy y carísimas de retrofitear una vez que existan ocho
módulos consultando la base. Por eso el modelo se fija acá.

> **Al implementarse cambió una cosa de esta sección: no hay `Usuario`.** La identidad
> interna es la `Persona`, que ya existe y que todo operador de GPS tiene igual; una
> entidad aparte sólo duplicaba identidad y exigía sincronizarlas. Donde abajo dice
> `usuarioId`, hoy es `personaId`, y donde dice la tabla `usuarios`, hoy no hay tabla.
> El resto del modelo —roles con ámbito, las tres capas, el alcance como primer
> parámetro— quedó como está escrito. Ver
> `openspec/changes/agregar-autenticacion-y-autorizacion/`.

### 8.1 Autenticación: un módulo más, sin nada especial

`auth` es un módulo normal. Posee sus tablas (`identidades_externas`, `sesiones`,
`invitaciones`, `administrador_del_sistema`, `eventos_de_seguridad`), expone el login
con Google y Apple ID, y valida el secreto de sesión en cada request.

La costura necesaria ya existe y no requiere abstracción nueva: el `context.ts` del
backend le pregunta al servicio de `auth` quién llama, antes de que corra cualquier
resolver. El backend ya es la raíz de composición y ya conoce la lista de módulos, así
que es una línea explícita y tipada. No se agrega un sistema genérico de hooks de
contexto para un caso que ocurre una sola vez.

### 8.2 La autorización no es transversal

La tentación es meter la autorización en el core, como un servicio más. Es un error, y
es el que vuelve estos sistemas imposibles de auditar. "Puede ver los datos de su grupo"
no es una regla técnica: depende de la estructura real de la asociación —distrito,
grupo, autoridades— que es el dominio del módulo Estructura.

La responsabilidad se reparte así:

- **`auth` dice quién sos.** Una `Persona` con identidad externa verificada.
- **`estructura` dice qué cargo ocupás.** Cae naturalmente, porque Estructura ya modela
  distritos, grupos y autoridades: un rol no es un concepto abstracto de permisos, es un
  hecho estructural de la asociación.
- **Cada módulo decide qué habilita ese cargo sobre sus propios datos.** Personas decide
  quién ve un documento de identidad; Tesorería, quién ve una deuda.

### 8.3 El modelo: roles con ámbito

La identidad no alcanza; importa el rol y sobre qué:

    // packages/core/src/actor.ts
    export interface Actor {
      personaId: string
      roles: RolConAmbito[]
    }

    export interface RolConAmbito {
      rol: 'dirigente' | 'jefeDeGrupo' | 'autoridadDeDistrito' | 'administradorDiocesano'
      ambito: { tipo: 'grupo' | 'distrito' | 'diocesano'; id: string | null }
    }

Un dirigente del grupo 42 y una autoridad del distrito 7 usan la misma estructura. Al
ser una **lista**, resuelve los casos que van a aparecer sí o sí: alguien dirigente en
dos grupos, o jefe de grupo y a la vez autoridad de distrito.

De ahí se deriva, **una sola vez por request**, el alcance concreto:

    export interface Alcance {
      gruposVisibles: string[]      // expandido: distrito 7 -> todos sus grupos
      distritosVisibles: string[]
      esAdministrador: boolean
    }

**`Actor` y `Alcance` son tipos de `core`, no de Estructura.** Si vivieran en Estructura
habría un ciclo: los repositorios de Personas reciben un `Alcance`, y a la vez Estructura
necesita a Personas para saber quién ocupa cada cargo. Poniendo los tipos en `core` el
ciclo desaparece: Estructura aporta la **implementación** que expande los roles en un
alcance concreto —es quien conoce la jerarquía— y los demás módulos sólo reciben el
resultado ya masticado, sin depender de Estructura ni entender la estructura de la
asociación para filtrar.

### 8.4 Cómo se aplica: tres capas en cascada

La separación en capas está tomada de Salesforce (§8.8) y hace el modelo mucho más
legible: se puede responder "qué ve un dirigente" sin leer todos los resolvers.

    capa 1  modulo    ¿este rol tiene acceso a Tesoreria, en general?
       |
       v
    capa 2  registro  ¿que filas de Tesoreria? -> Alcance
       |
       v
    capa 3  campo     ¿que campos de esas filas? -> politicas

**Capa 1 — acceso al módulo, con negación por defecto explícita.** Cada módulo declara
qué roles pueden alcanzarlo, y lo declara siempre, aunque la respuesta sea "todos":

    // packages/tesoreria/src/dominio/politicas.ts
    export const accesoAlModulo: AccesoAlModulo = {
      porDefecto: 'denegado',
      permitidos: ['jefeDeGrupo', 'autoridadDeDistrito', 'administradorDiocesano'],
    }

Es una tabla chica, legible de un vistazo, y es lo que evita que un módulo nuevo quede
accesible para todos por olvido: sin declaración, no hay acceso. La declaración es
obligatoria; que el default sea `denegado` es una decisión consciente por módulo y no un
efecto secundario de qué políticas existan.

Esta capa se resuelve una vez por request, antes de tocar la base, y es la que produce
el mensaje de error útil: "no tenés acceso a Tesorería" en vez de una lista vacía.

**Capa 2 — el alcance es un parámetro obligatorio del repositorio, no un filtro
opcional.**

    export interface PersonasRepository {
      buscarPorGrupo(alcance: Alcance, grupoId: string): Promise<Persona[]>
      buscarPorDocumento(alcance: Alcance, documento: string): Promise<Persona | null>
    }

Ésta es la pieza central: **una consulta que se olvide de filtrar no compila**. Frente
al enfoque habitual de "acordate de chequear permisos en cada resolver", la diferencia
es que olvidarse deja de ser una filtración silenciosa de datos y pasa a ser un error de
tipos. Falla cerrado por construcción, no por disciplina.

**Capa 3 — las políticas son funciones puras del dominio, compartidas con el
frontend.**

    // packages/personas/src/dominio/politicas.ts
    export function puedeVerPersona(alcance: Alcance, persona: Persona): boolean
    export function puedeEditarPersona(alcance: Alcance, persona: Persona): boolean
    export function puedeVerDatosMedicos(alcance: Alcance, persona: Persona): boolean

Acá rinde la arquitectura de paquetes compartidos: el backend usa estas funciones para
autorizar y las apps usan **las mismas funciones** para decidir qué botón mostrar. El
problema clásico de que la interfaz ofrezca algo que el servidor después rechaza deja de
existir estructuralmente. Viven en `/dominio`, que es isomorfo, así que ya están
disponibles en web y mobile sin nada nuevo.

**Granularidad de campo, no sólo de fila.** Un dirigente puede ver el nombre de un chico
de otro grupo si comparten un campamento, pero no su ficha médica ni su documento.
Pothos lo resuelve con `authScopes` a nivel de campo, apoyado en las mismas funciones
puras. Es la razón por la que las políticas son varias funciones chicas y no un único
`puede(accion, recurso)`.

### 8.5 Consecuencia para el modo offline y el demo

El modo offline y el modo demo ejecutan las políticas **en el dispositivo**. Ahí dejan
de ser una barrera y pasan a ser una comodidad de interfaz: cualquiera con acceso al
teléfono puede leer la base local entera.

De ahí sale una regla obligatoria para la sincronización, que condiciona el diseño de
Permisos: **al dispositivo se sincroniza únicamente lo que su actor tiene permitido
ver.** La autorización se aplica al sincronizar, del lado del servidor, no al leer del
lado del cliente. Es más trabajo que bajar todo y filtrar en pantalla, pero es la única
versión que no filtra datos de otros grupos.

### 8.6 Qué entra en la iteración 1

Ninguna implementación. Sólo tres convenciones, para que el primer módulo real nazca
con ellas:

1. `ctx.actor: Actor | null` en el contexto desde el día uno, siempre `null` hasta que
   exista `auth`.
2. Los métodos de repositorio reciben `Alcance` como primer parámetro. Va en `AGENT.md`
   como requisito.
3. `/dominio/politicas.ts` como archivo convencional de cada módulo, con funciones puras
   y la declaración obligatoria de `accesoAlModulo` (§8.4).

Las restricciones de §8.7 no entran. La bitácora de accesos había quedado como decisión
abierta, porque un registro de accesos no se puede reconstruir hacia atrás; la decisión
de prototipo la resuelve: mientras no haya datos reales no hay accesos reales que
registrar, así que no se pierde nada difiriéndola. Pasa a ser requisito de la puerta de
salida del prototipo (§1).

### 8.7 Datos sensibles: el módulo Salud

**Salud queda fuera de las primeras iteraciones** por la decisión de prototipo. Esta
subsección no diseña el módulo: fija las restricciones que sus specs —y las de Offline y
Demo— van a tener que respetar cuando llegue el momento.

El módulo Salud guarda fichas médicas —alergias, medicación, condiciones, contacto de
emergencia— de una población mayoritariamente menor de edad. Es el dato más sensible del
sistema y es el que justifica varias decisiones de §8 que de otro modo parecerían
sobrediseño. No se diseña acá (tendrá su propia spec), pero fija cuatro restricciones
que las specs de Offline, Demo y Salud deben respetar.

**La granularidad de campo deja de ser opcional.** Un jefe de grupo necesita ver que un
chico es alérgico al maní para autorizar un campamento; no necesita ver su historia
clínica. `puedeVerDatosMedicos` no es un ejemplo ilustrativo en §8.4: es el caso que
obliga a que las políticas sean varias funciones chicas y no un `puede(accion, recurso)`.

**Bitácora de accesos.** Toda lectura de datos de salud se registra: quién, qué ficha,
cuándo. Es la auditoría de lectura de §10.1, y es el único caso que se registra con una
llamada explícita en vez del piso automático. Es práctica estándar para datos de salud y es la única de las cuatro
restricciones que hay que decidir ahora, porque un registro de accesos no se puede
reconstruir hacia atrás: si se agrega en el módulo 8, los accesos de los módulos 1 a 7
se perdieron. Se implementa como una capacidad de `Core` (`auditoria`) que Salud usa en
cada lectura.

**Minimización en la sincronización.** Existe una tensión real: la ficha médica es
justamente el dato que más se necesita sin conexión —un campamento en el monte— y el que
menos se quiere tener en un teléfono que se puede perder. La resolución es partir el
dato: un **resumen** (alergias, medicación vigente, grupo sanguíneo, contacto de
emergencia) que sí viaja al dispositivo, y la **ficha completa** que nunca sale del
servidor. Y el resumen viaja acotado por alcance **y por tiempo**: sólo las personas de
la actividad en curso, y se purga al cerrarla.

**Cifrado en reposo del lado del dispositivo.** La réplica local que habilita el modo
offline (§11) debe estar cifrada cuando contenga datos de salud, con la clave en el
almacén seguro del sistema operativo. Es requisito de la spec de offline, no de Salud.

**Y una restricción sobre el demo:** los datos sembrados por `seedDemo` son siempre
sintéticos. Ninguna ficha médica real puede aparecer en un build de demostración, ni
siquiera anonimizada a mano.

### 8.8 Referencia: cómo lo resuelven SAP y Salesforce

Se revisaron los dos sistemas comparables más maduros antes de fijar este diseño. Las
coincidencias dan confianza y las diferencias son deliberadas.

**Lo que coincide.** El modelo de SAP gira alrededor de roles con **niveles
organizativos** —sociedad, centro— y **roles derivados**: el mismo rol funcional
replicado para distintos niveles. Un "jefe de compras del centro 1000" y uno del centro
2000 son el mismo rol con distinto ámbito. Eso es exactamente `RolConAmbito` (§8.3), en un
modelo que sobrevivió décadas en organizaciones bastante más retorcidas que una
asociación scout.

Salesforce, por su lado, separa la autorización en objeto, campo y registro, con un
*Org-Wide Default* por entidad —normalmente `Private`— sobre el que se abren accesos con
una jerarquía de roles donde quien está arriba ve lo de abajo. Esa expansión jerárquica es
nuestra derivación de distrito a grupos, y esa separación en capas es la que adoptamos en
§8.4.

**Lo que se descarta a propósito.** En los dos sistemas la autorización es
**configuración**, editable por un administrador sin desplegar código. Es una decisión de
producto correcta para plataformas vendidas a miles de organizaciones con estructuras
distintas. GPS sirve a **una** asociación con una estructura conocida y estable, así que
un motor de permisos configurable en tiempo de ejecución sería sobreingeniería — y además
empeoraría la auditabilidad: un permiso mal configurado en una pantalla no lo revisa
nadie, mientras que un cambio en `politicas.ts` pasa por un diff.

Queda como pregunta abierta para la asociación si van a querer cambiar quién ve qué sin
esperar un despliegue. Si la respuesta fuera "sí, seguido", el mapeo rol a permisos se
mueve a una tabla. La apuesta es que no: los roles son cargos estatutarios y cambiarlos es
una decisión institucional.

También se descarta el enfoque de Salesforce de **materializar** el resultado en tablas de
compartición precalculadas. Es la respuesta correcta cuando expandir el alcance es caro;
para nosotros, expandir un distrito a sus grupos es una consulta trivial que se resuelve
por request. Queda anotado como salida de emergencia si alguna vez pesa.

**Dónde nuestro diseño es mejor, y no por casualidad.** En los dos sistemas el chequeo
depende de que el desarrollador lo escriba: en ABAP, si nadie pone el `AUTHORITY-CHECK`,
no hay chequeo; en Apex, el código corre en modo sistema salvo que se declare
`with sharing`, o sea que el default es saltearse la seguridad. Los dos son fuentes
históricas de hallazgos de auditoría.

`Alcance` como primer parámetro obligatorio ataca exactamente ese modo de falla: no está
prohibido olvidarse, es que olvidarse **no compila**. Es lo más cerca que se puede estar
del *row-level security* de Postgres o del DCL de las vistas CDS de SAP sin tener un motor
que lo aplique; y con SQLite, que no tiene RLS, el sistema de tipos es la única capa donde
se puede hacer cumplir.

## 9. Archivos subidos por usuarios

Fotos de permisos firmados en papel, PDFs, documentación adjunta. Ningún módulo de la
iteración 1 tiene archivos, así que no se implementa nada; se fija el diseño porque tres
de estas decisiones son caras de revertir. `archivos` se construye junto con Permisos,
que es su primer consumidor.

### 9.1 Dónde se guardan los bytes

`Almacenamiento` es una interfaz de `Core` (§5.4), con dos implementaciones: sistema de
archivos local para prototipo y desarrollo, y S3 compatible (S3 o Cloudflare R2) cuando
haga falta durabilidad. Los módulos no cambian entre una y otra.

    export interface Almacenamiento {
      guardar(clave: string, contenido: ReadableStream, tipo: string): Promise<void>
      leer(clave: string): Promise<ReadableStream>
      eliminar(clave: string): Promise<void>
      urlDeSubida(clave: string): Promise<{ url: string; expira: Date }>
    }

**No se guardan archivos dentro de SQLite.** Para archivos chicos SQLite es competitivo,
pero una foto de un permiso son varios megabytes: infla la base, hace lentos los backups
y arruina la replicación con Litestream.

### 9.2 Cómo se suben: tres pasos, no multipart sobre GraphQL

Se descarta `graphql-upload`: acopla la transferencia de binarios al lenguaje de
consultas, transmite mal y ensucia la API pública.

El flujo es:

1. `solicitarSubida(tipo, tamaño, ...)` — mutation que valida, reserva un id y devuelve
   una URL de subida con vencimiento.
2. El cliente hace `PUT` de los bytes directo a esa URL.
3. `confirmarSubida(id)` — mutation que valida lo recibido y lo asocia al recurso.

Es más ceremonia que un POST, y se elige igual por una propiedad que ninguna otra opción
tiene: **es idéntico en prototipo y en producción**. Hoy la URL apunta a un endpoint del
propio backend; mañana es una URL prefirmada de S3 y los bytes no tocan nuestro
servidor. El código del cliente no cambia. Como la API es pública, cambiar esto después
es caro.

### 9.3 De quién es el archivo: un módulo, no core

Core no posee la tabla de archivos. Core posee exactamente una tabla (`migraciones`) y
ésa es la excepción documentada; el registro de archivos no agrega una segunda.

**`archivos` es un módulo más.** Posee el registro —id, nombre, tipo MIME, tamaño, hash,
quién lo subió, cuándo, y el dueño— tiene sus migraciones, se registra como módulo, y los
demás módulos lo alcanzan por `ctx.archivos`. Permisos guarda un `archivoId` y declara
`dependencies: ['archivos']`. Core sólo aporta el movimiento de bytes.

### 9.4 Autorización en la descarga

Una URL de archivo no puede ser una llave que saltee el `Alcance` de §8. Y el registro
tiene que saber de quién es cada archivo **desde el momento en que se crea**: archivos
que nacen sin dueño no se pueden autorizar retroactivamente.

Cada archivo se guarda con `modulo` y `recursoId`. La inversión que hace que esto
funcione es que **`archivos` no conoce ninguna regla de permisos: le pregunta al dueño.**

    // lo implementa cada módulo que tenga archivos
    puedeVerArchivoDe(alcance: Alcance, recursoId: string): Promise<boolean>

`archivos` resuelve el módulo dueño por el contexto y le consulta antes de entregar nada.
Las reglas de un permiso las sigue decidiendo Permisos, que es quien las entiende. Es la
misma composición que usa el resto del diseño.

### 9.5 Los archivos nunca se sirven inline desde el origen de la aplicación

Un PDF puede contener JavaScript y un SVG es HTML. Servir archivos subidos por usuarios
desde el mismo origen que la app es XSS con acceso a la sesión.

Regla: dominio separado para archivos, o siempre `Content-Disposition: attachment` junto
con `X-Content-Type-Options: nosniff`. Además se valida el tipo real por contenido, no
por la extensión ni por el `Content-Type` que declara el cliente, y se aplica un límite
de tamaño en el paso 1 del handshake.

Es gratis hacerlo bien desde el principio y aparece como vulnerabilidad, no como
refactor, si se hace mal.

### 9.6 Offline

La foto de un permiso firmado es justamente lo que hay que poder ver sin señal, así que
la réplica local tiene que cachear bytes y no sólo filas. Eso engorda mucho la
sincronización: una foto son megabytes contra kilobytes de una fila.

Restricción para la spec de offline: al dispositivo viaja un **derivado reducido**
—imagen recomprimida, PDF tal cual si es chico— y el original queda en el servidor.

### 9.7 Qué entra en la iteración 1

Ninguna implementación. Las tres decisiones que se fijan por ser caras de revertir son:
el handshake de tres pasos (es API pública), el dueño obligatorio en el registro (no se
reconstruye hacia atrás) y la regla de no servir inline (§9.5).

## 10. Auditoría y eventos de dominio

No se implementa en la iteración 1. Se documenta porque el mecanismo elegido condiciona
cómo se escriben las mutations de todos los módulos, y porque el bus de eventos resuelve
un problema que no es de auditoría (§10.3).

### 10.1 Son dos auditorías, no una

**Auditoría de escritura** — quién cambió qué. Volumen bajo, necesita el antes y el
después, y tiene significado de negocio: "Fulana aprobó la afiliación del grupo 42".

**Auditoría de lectura** — quién vio qué. Es el caso de §8.7, fichas médicas. Volumen
altísimo, sin diff, y sólo relevante para datos sensibles.

Mezclarlas produce un sistema que registra demasiado ruido para ser útil y demasiado
poco para ser confiable.

### 10.2 Piso automático: toda mutation se registra

Un plugin de envelop en el backend registra **toda** mutation: actor, nombre, argumentos
con los campos sensibles enmascarados, resultado, timestamp e id de request. Cero
esfuerzo por módulo.

Acá rinde haber elegido GraphQL con nombres de dominio en español: **el nombre de la
mutation ya es la acción de negocio** — `aprobarAfiliacion`, `firmarPermiso`,
`registrarPago`— así que el registro sale legible sin que nadie escriba nada.

Se descarta la alternativa de sólo llamar a una función de auditoría dentro de cada
mutation, por la misma razón por la que `Alcance` es obligatorio (§8.4): alguien agrega
una mutation, se olvida, y el hueco es silencioso. Con el piso automático, olvidarse es
imposible.

### 10.3 Eventos de dominio: el argumento no es la auditoría

El requisito dice que en la afiliación se genera una deuda según la cantidad de personas
activas de cada grupo. Eso es Tesorería reaccionando a algo que ocurrió en Afiliación.
Sin eventos, Afiliación tendría que conocer e invocar a Tesorería, que es exactamente el
acoplamiento entre módulos que el resto del diseño evita.

Con un evento, Afiliación emite `AfiliacionAprobada` y no sabe quién escucha: Tesorería
genera la deuda, Mensajería avisa al grupo, Notificaciones manda el push, y **auditoría
es un suscriptor más**.

O sea: el bus no se justifica por la auditoría. Se justifica porque los requisitos ya
contienen al menos tres reacciones entre módulos, y la auditoría se cuelga gratis de ahí.

### 10.4 Cómo se acota para que no se vuelva un monstruo

Los buses de eventos son un clásico de sobreingeniería y vuelven el flujo difícil de
seguir. Restricciones, todas obligatorias:

- **En proceso, sincrónico y tipado.** Un registro de handlers al lado del registro de
  módulos. Sin broker, sin cola, sin serialización.
- **Sin `any`:** cada módulo declara sus eventos y los suscriptores se tipan por
  declaration merging, igual que el `Context`.
- **Se conserva el stack trace**, que es lo que se pierde con los buses asincrónicos y lo
  que después hace que nadie entienda por qué se generó una deuda.

El bus vive en `core`, porque es plomería como el registro de módulos. `auditoria` es un
módulo, como `archivos`: posee su tabla y sus migraciones.

### 10.5 Transaccionalidad

Es la parte difícil y no tiene una solución gratis. Si el evento se emite después de
confirmar la transacción y el suscriptor falla, queda una afiliación aprobada sin deuda
generada. Si se emite dentro, un suscriptor lento o externo bloquea la escritura.

La resolución: **los suscriptores que deben ser consistentes corren dentro de la misma
transacción** y pueden hacerla fallar entera — Tesorería y auditoría entran acá. Los
efectos externos —push, correo— no: requieren un patrón de bandeja de salida y un
worker, que es justamente la pieza que hoy se decidió no construir. Hasta que exista, los
efectos externos se disparan explícitamente y se acepta que puedan perderse.

### 10.6 Propiedades del registro

**Es de sólo agregar.** No hay mutations para editarlo ni borrarlo, ni siquiera para
administradores. Un registro que se puede modificar no sirve como registro.

**Es dato sensible en sí mismo.** Saber quién consultó la ficha médica de quién revela
información sobre las dos personas. Se lee bajo su propia política, más restrictiva que
la del dato original.

### 10.7 Qué entra en la iteración 1

Nada. Se evaluó meter el bus de eventos desde el principio y se descartó: no tiene
emisores ni suscriptores hasta que existan dos módulos, no es API pública, y agregarlo
después no rompe nada. Es distinto del caso de `Alcance` (§8.6) o del dueño de los
archivos (§9.4), que sí eran irrecuperables hacia atrás.

Bus, `auditoria` y registro automático se implementan cuando llegue **Afiliación**, que
es quien trae el primer evento real entre módulos.

## 11. Modo demo (diseñado ahora, implementado después)

### 11.1 Qué es y por qué importa más de lo que parece

Un build que corre con datos precargados y realistas, íntegramente en el dispositivo,
sin backend. Sirve para mostrar avance y para entrenar usuarios sin riesgo.

Hay dos maneras de hacerlo. Falsear el transporte —responder desde un archivo de datos
fijos— es barato, pero los datos se desincronizan del esquema, las mutaciones no
funcionan de verdad y no sirve para nada más. La otra es **correr el backend real
dentro del dispositivo** contra una base local sembrada: comportamiento idéntico al
real, mutaciones que funcionan, cero mantenimiento de datos falsos.

Se elige la segunda, y la razón excede al demo: **es la misma maquinaria que requiere
el offline de Permisos.** Un teléfono que ejecuta los módulos contra una base local y
sincroniza después es el modo demo con datos reales. No es una inversión para hacer
demos bonitas; es la infraestructura del requisito offline, y el demo es su primer
usuario.

### 11.2 El demo no redefine servicios de core: los provee

Ya está resuelto por el diseño de §5. El backend arma `Core` con SQLite y
notificaciones reales; en modo local, la app arma `Core` con `expo-sqlite` o SQLite en
WASM y un notificador que no hace nada. Los módulos no cambian una línea. Esto depende
enteramente de la regla de portabilidad de §5.3.

### 11.3 No se rompe el límite de imports

En vez de permitir que `apps/*` importe `*/servidor`, se agrega un paquete intermedio:

    packages/local/     compone los módulos en proceso y expone una API local

`packages/local` es el único autorizado a importar los `/servidor`. Las apps importan
`@gps/local`, que devuelve un `Transporte` que ejecuta contra el esquema compuesto sin
red. La regla de Biome queda intacta y la excepción está confinada a un paquete.

### 11.4 Los datos: catálogo por módulo, escenario en un módulo `demo`

Un primer diseño repartía todos los datos entre métodos `seedDemo` de cada módulo, para
que ninguno conociera a los otros. Se descartó al probarlo contra un caso concreto: "un
distrito, con un grupo, con cinco personas, donde una es jefa de ese grupo y otra es
comisionada del distrito".

Ese escenario **no es independiente por módulo**: es una sola historia que atraviesa
Personas, Estructura y Afiliación. Repartirla en métodos `seedDemo` obliga a que
Estructura referencie ids de personas que sembró Personas —acoplamiento por string que
se rompe en silencio— y, peor, hace que el escenario deje de poder leerse: cambiar "un
grupo" por "tres grupos" pasa a ser editar cuatro archivos y reconstruir la historia
mentalmente a partir de los cuatro. Para un conjunto de datos cuyo único propósito es
contar una historia clara, es exactamente lo contrario de lo que hace falta.

La división correcta es por naturaleza del dato, no por módulo:

**Conjuntos cerrados — constantes en `/dominio`, no filas.** Tipos de documento, tipos de
permiso, categorías de curso. Un primer diseño los sembraba con un método `seedDemo` del
contrato de `Module`; se descartó porque para un conjunto cerrado las constantes son
estrictamente mejores: no hay migración ni siembra que mantener, el frontend las tiene
gratis porque `/dominio` es isomorfo, TypeScript verifica exhaustividad en los `switch`, y
no pueden desincronizarse el código y la base — que es exactamente lo que ocurre cuando
existe una unión de strings en el código *y* una tabla con las mismas filas.

Sin ese caso, `seedDemo` se quedaba sin trabajo: era un método del contrato sin
consumidores. **Se eliminó del contrato de `Module`.**

**Datos de referencia editables — filas comunes, y no son datos de demo.** El monto de la
cuota de un período, por ejemplo. Son datos reales del sistema que la asociación edita con
el tiempo, y se cargan por la aplicación como cualquier otro dato.

**El escenario — un módulo `demo`.** Declara como dependencias a todos los módulos que
quiera representar y compone la historia llamando a sus **servicios públicos**:

    // packages/demo/src/servidor/escenario.ts
    export const dependencies = ['personas', 'estructura', 'afiliacion']

    export async function sembrarEscenario(ctx: Contexto) {
      const distrito = await ctx.estructura.crearDistrito({
        nombre: 'Distrito Norte',
      })

      const grupo = await ctx.estructura.crearGrupo({
        nombre: 'Grupo Scout 42 Ceferino Namuncurá',
        distritoId: distrito.id,
      })

      const [ana, bruno, carla, diego, elena] = await ctx.personas.crearVarias([
        { nombre: 'Ana',   apellido: 'Gómez',     documento: '30111222', ... },
        { nombre: 'Bruno', apellido: 'Pereyra',   documento: '31222333', ... },
        { nombre: 'Carla', apellido: 'Sosa',      documento: '28333444', ... },
        { nombre: 'Diego', apellido: 'Fernández', documento: '45444555', ... },
        { nombre: 'Elena', apellido: 'Ríos',      documento: '46555666', ... },
      ])

      // Se inscriben en el grupo: ya son parte y ya pueden participar
      await ctx.estructura.inscribir({
        grupoId: grupo.id,
        personaIds: [ana, bruno, carla, diego, elena].map(p => p.id),
      })

      // La declaración cobra una afiliación por cada alta nueva del año
      await ctx.afiliacion.declarar({
        grupoId: grupo.id,
        periodo: '2026-1',
        personaIds: [ana, bruno, carla, diego, elena].map(p => p.id),
      })

      await ctx.estructura.designarAutoridad({
        personaId: ana.id,
        rol: 'jefeDeGrupo',
        ambito: { tipo: 'grupo', id: grupo.id },
      })

      await ctx.estructura.designarAutoridad({
        personaId: carla.id,
        rol: 'autoridadDeDistrito',
        ambito: { tipo: 'distrito', id: distrito.id },
      })
    }

El escenario se lee de arriba abajo, en un archivo, como la frase que lo describe.

**La propiedad que decide la elección** no es la legibilidad sino ésta: se siembra a
través de las APIs públicas de los módulos, no escribiendo SQL. Los datos del demo pasan
por las mismas validaciones y reglas de dominio que los datos reales, con lo cual es
imposible generar un demo con datos que el sistema consideraría inválidos — que es
exactamente cómo se arruinan los demos.

**Costo aceptado:** `demo` es un archivo que conoce a todos los módulos, que es lo que el
resto del diseño evita. La diferencia es que agregar un módulo **no obliga** a tocarlo:
el sistema funciona igual sin que `demo` lo mencione. Se edita sólo si se quiere que ese
módulo aparezca en la demostración, que es una decisión distinta.

Este escenario, además, valida el modelo de §8.3: que Carla sea integrante del grupo 42 y
a la vez comisionada del distrito sólo se puede representar porque los roles son una
lista con ámbito y no un campo único.

### 11.5 Riesgo aceptado

Una app que trae el stack de servidor adentro trae también todas las reglas de negocio,
extraíbles del bundle. Para este sistema no es un problema de confidencialidad, pero
implica que las reglas de autorización validadas sólo en servidor son evitables en un
build local. Consecuencia práctica y obligatoria: **el build de demo es un build aparte
y nunca se conecta a datos reales**, y en particular nunca a datos de salud (§8.7).

### 11.6 Qué entra en la iteración 1

Sólo lo que es gratis ahora y caro después:

1. El `Transporte` como interfaz en `packages/api`, con la implementación HTTP nada más.
2. La regla de portabilidad (§5.3) escrita en `AGENT.md`.

`packages/local`, el transporte local, la base en dispositivo y los datos sembrados
quedan para su propia spec, probablemente justo antes de Permisos.

## 12. Docker, CI y tests

### 12.1 Docker

`Dockerfile` multi-etapa sobre la imagen oficial de Bun: una etapa instala dependencias
y construye el estático de `apps/web`, la final corre el backend sirviendo ese estático.
Sin binarios nativos que compilar, con lo cual la imagen es chica y el build rápido.

`docker-compose.yml` levanta un solo servicio en el puerto 3000. `docker compose up`
y la app anda. Sin volumen todavía, porque no hay base; entra junto con SQLite.

Para el día a día sin Docker: `bun run dev` levanta backend y Vite juntos,
`bun run dev:mobile` levanta Expo.

### 12.2 CI (GitHub Actions)

Un solo workflow en cada push:

1. `bun install --frozen-lockfile`
2. Biome: lint y formato, incluida la regla de fronteras de imports
3. `tsc --noEmit` en cada paquete
4. `bun test`
5. Regenerar `schema.gql` desde el builder de Pothos y **fallar si difiere del
   commiteado**. El codegen del cliente no se commitea: CI lo regenera y el
   `tsc --noEmit` del paso 3 falla si las consultas dejaron de coincidir con el esquema.
6. Construir el estático de web y la imagen Docker

El paso 5 es el que sostiene el diseño: nadie puede cambiar la API pública sin que
aparezca en el diff, y ninguna consulta puede quedar desalineada del esquema sin que
CI lo detecte.

### 12.3 Tests

Uno por capa, para probar que la capa es testeable — no para cobertura.

| Capa | Qué prueba |
|---|---|
| `core` | el registro resuelve el orden por dependencias y detecta ciclos |
| `sistema` | el servicio devuelve la versión que le inyectaron, con un `Core` falso |
| `backend` | ejecuta `{ version { numero modulos } }` contra el esquema compuesto, sin HTTP |
| `api` | el cliente funciona con un `Transporte` falso |
| `web` / `mobile` | ninguno, justificadamente: no tienen lógica |

## 13. Documentación

Dos documentos, porque sirven para cosas distintas.

**`AGENT.md`** — referencia densa para agentes. Cubre: cómo crear un módulo nuevo paso
a paso copiando `packages/sistema`, el contrato de `Module`, la distinción entre módulo
y plugin de envelop (§5), la tabla de idioma de §4,
la regla de portabilidad de §5.3, las tres convenciones de autorización de §8.6
—`Alcance` como primer parámetro de todo repositorio y `politicas.ts` como archivo
convencional—, mobile-first, las fronteras de imports y por qué existen, y los comandos
para levantar, testear y regenerar. `CLAUDE.md` es un enlace
simbólico a `AGENT.md`, para que no haya dos documentos divergiendo.

**`docs/crear-un-modulo.md`** — tutorial para humanos, en prosa, con `sistema` como
ejemplo trabajado de punta a punta. Explica *por qué* cada pieza está donde está: qué
es el contrato de módulo, cómo se compone el esquema, cómo se inyectan los servicios,
cómo se testea un módulo aislado, y qué se rompe si se ignoran las reglas.

**`docs/arquitectura.md`** — el mapa de las piezas y de cómo se comunican, en diagramas.
Responde "qué hay y cómo se conecta"; la spec responde "por qué es así". Es el documento
que se le pasa a alguien que se suma al proyecto, antes que cualquier otro. Se mantiene
al día cuando cambia una pieza.

**`README.md`** — qué es GPS, cómo levantarlo (instalar Bun, `bun install`,
`bun run dev`, `docker compose up`), y punteros a los dos documentos anteriores.

## 14. Despliegue

En esta iteración el entregable es **la imagen Docker**, no un ambiente productivo.
Es lo que permite mostrar avance y lo que convierte el deploy real en una decisión de
dónde, no de cómo.

Cuando toque: contenedor corriendo permanentemente (Fly.io o Railway) y, cuando
aparezca SQLite, Litestream replicando a S3. Terraform, fuera de este repositorio.

## 15. Alcance de la iteración 1

### Entra

- Monorepo con Bun workspaces, instalación aislada, Biome, `tsconfig.base.json`.
- `packages/core`: contrato de `Module`, registro con resolución
  de dependencias y detección de ciclos, e interfaz `Core` con `Config`, `Logger` y
  `Reloj`. Sin `Notificador`, `Correo` ni base de datos: entran con su primer consumidor.
- `packages/sistema`: módulo `sistema` con `/dominio` y `/servidor`, expone `version`.
- Las tres convenciones de autorización de §8.6: `ctx.actor` (siempre `null`), `Alcance`
  como primer parámetro de repositorio, y `politicas.ts` como archivo convencional.
  Convenciones documentadas, sin implementación.
- `packages/api`: interfaz `Transporte`, `transporteHttp`, cliente con TanStack Query,
  configuración de codegen, documentos en `src/queries/`.
- `services/backend`: `Bun.serve` con `/graphql` (Yoga + Pothos), `/health` y estáticos;
  raíz de composición; `actor` siempre `null`. Sin `envelop.ts`: ver §6.2.
- `schema.gql` generado y versionado, con verificación en CI.
- `apps/web`: Vite + React + Tailwind, una pantalla que muestra la versión, cache
  persistido en IndexedDB.
- `apps/mobile`: Expo + React Native + NativeWind, una pantalla que muestra la versión,
  cache persistido en AsyncStorage.
- `Dockerfile` y `docker-compose.yml`.
- Workflow de CI.
- Un test por capa según §12.3.
- `AGENT.md`, `CLAUDE.md` (enlace simbólico), `docs/crear-un-modulo.md`, `README.md`.

### No entra

- SQLite, Drizzle, migraciones y migrador — hasta que un módulo los necesite.
- Auth (Google / Apple ID) y toda implementación de autorización — módulo propio y
  spec propia. De §8 sólo entran las convenciones, no el código.
- `packages/local`, transporte local, base en dispositivo, datos de demo.
- Tokens de diseño compartidos, componentes compartidos, router en web.
- Los ocho módulos de negocio, Salud incluido.
- El módulo `archivos` y la subida de archivos (§9): sólo se fija el diseño.
- El bus de eventos, el módulo `auditoria` y el registro automático de mutations (§10):
  sólo se fija el diseño; llegan con Afiliación.
- Terraform y ambiente productivo.

## 16. Riesgos y decisiones a revisar

1. **Sin normalización de cache**, las invalidaciones entre módulos se escriben a mano.
   Se revisa si duele de verdad; migrar significa reescribir la capa de hooks generados,
   no el dominio ni la API.
2. **La persistencia queda sin probar** hasta el primer módulo con base de datos. Es el
   costo aceptado de no meter SQLite especulativamente; el módulo Personas debe tratar
   esa integración como parte de su alcance, no como algo ya resuelto.
3. **`bun test` y componentes de React Native** — si algún día hacen falta tests de
   componentes en mobile, la decisión queda acotada a `apps/mobile`.
4. **El orden de construcción lo fija el grafo de dependencias, no el orden en que los
   módulos fueron enumerados.** Con `Actor` y `Alcance` en `core` (§8.3), Personas no
   depende de nadie y Estructura depende de Personas —necesita saber quién ocupa cada
   cargo—, así que la cadena es `sistema` -> Personas -> Estructura, y de ahí en adelante
   Salud, Afiliación, Permisos y el resto. El grafo completo está dibujado en
   `docs/arquitectura.md`. Es tentativo: cada spec de módulo puede ajustarlo.
5. **El régimen de protección de datos aplicable a los datos de salud hay que
   confirmarlo antes de diseñar el módulo Salud**, no después. En Argentina, la Ley
   25.326 clasifica los datos de salud como sensibles y les impone requisitos más
   estrictos de consentimiento, resguardo y cesión; si la asociación opera en otra
   jurisdicción, aplica la equivalente. Esto puede condicionar dónde se aloja la base,
   qué puede replicarse a un dispositivo y qué consentimientos hay que registrar —o sea,
   decisiones de infraestructura, no sólo de módulo. Mientras el sistema sea un
   prototipo sin datos reales no bloquea nada, pero es uno de los cinco requisitos de la
   puerta de salida (§1). No es asesoramiento legal: es un punto a verificar con quien
   corresponda en la asociación.
6. **Pertenencia y afiliación son cosas distintas — resuelto.** El escenario de §11.4
   destapó la pregunta y la asociación la respondió; queda registrada acá porque fija
   una frontera entre tres módulos.

   - **La pertenencia a un grupo es un hecho propio y continuo**, con alta y baja en
     cualquier momento. Se inscribe a una persona y desde ese momento es parte del grupo
     y puede participar de los eventos. **No se deriva de la afiliación.** Vive en
     Estructura.
   - **La afiliación es anual y por persona.** Una vez pagada, cubre a esa persona por el
     resto del año.
   - **Las dos declaraciones anuales son momentos de cobro, no dos afiliaciones
     distintas.** Cada declaración cobra únicamente a las personas activas que todavía no
     tienen afiliación paga en ese año.
   - **Lo pagado no se devuelve ni se transfiere** entre personas.

   Ejemplo de referencia: María y Pedro se inscriben en marzo; la declaración de mayo
   cobra $2. Juan se suma en junio y María se va en julio; la declaración de noviembre
   cobra $1, sólo por Juan, porque Pedro ya estaba pago y lo de María no se recupera.
   Total del año, $3. Al año siguiente Pedro y Juan vuelven a pagar.

   Consecuencia arquitectónica: la deuda que genera Tesorería se calcula de la
   declaración de Afiliación, no de la cantidad de miembros que informa Estructura.

   **Diferido a la spec de Afiliación**, por decisión explícita: qué pasa con una persona
   que pertenece a dos grupos o que se cambia a mitad de año —si la afiliación es de la
   persona con la asociación se paga una vez, si es del vínculo persona-grupo paga cada
   grupo, y eso cambia el cálculo de la deuda—; si alguien que se dio de baja y vuelve el
   mismo año conserva su afiliación; y qué ocurre con quien se suma después de la segunda
   declaración y queda sin afiliar hasta el año siguiente.
7. **La regla de portabilidad de §5.3 es la más fácil de violar sin darse cuenta** y la
   más cara de recuperar. Conviene evaluar un chequeo automático (por ejemplo, prohibir
   por lint los imports de `bun:*` y `node:*` dentro de `packages/*/src/servidor/`)
   cuando exista el segundo módulo.
