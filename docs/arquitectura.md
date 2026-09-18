# Arquitectura de GPS

Mapa de las piezas y de cómo se comunican. Complementa la spec de diseño en
`docs/superpowers/specs/2026-08-24-arquitectura-y-walking-skeleton-design.md`, que
explica **por qué** cada decisión es como es. Este documento explica **qué hay**.

Las piezas marcadas con `(futuro)` están diseñadas pero no implementadas.

## 1. Vista general

                +---------------------+     +---------------------+
                |      apps/web       |     |    apps/mobile      |
                |  React, bundleado   |     |  Expo + React Native|
                |  por Bun + Tailwind |     |  NativeWind         |
                +----------+----------+     +----------+----------+
                           |                           |
                           +-------------+-------------+
                                         |
                              +----------v-----------+
                              |    packages/api      |
                              |  TanStack Query      |
                              |  hooks del codegen   |
                              +----------+-----------+
                                         |
                                 Transporte (interfaz)
                                         |
                    +--------------------+--------------------+
                    |                                         |
             transporteHttp                          transporteLocal
                    |                                    (futuro)
                    v                                         v
        +-----------------------+               +-------------------------+
        |   services/backend    |               |     packages/local      |
        |   Bun.serve + Yoga    |               |  compone en proceso     |
        +-----------+-----------+               +------------+------------+
                    |                                        |
                    +-------------------+--------------------+
                                        |
                          +-------------v----------------------+
                          |    packages/<modulo>               |
                          |  sistema, estructura, personas, ...|
                          +-------------+----------------------+
                                        |
                          +-------------v--------------+
                          |      packages/core         |
                          |  contrato, registro, Core  |
                          +----------------------------+

Lo importante del dibujo: **las dos ramas del transporte llegan a los mismos módulos**.
Un módulo no sabe si lo está ejecutando el servidor o el teléfono.

## 2. Adentro del backend

    +----------------------------------------------------------------+
    |  services/backend                                              |
    |                                                                |
    |  index.ts                                                      |
    |     |                                                          |
    |     v                                                          |
    |  server.ts   (Bun.serve, un solo puerto)                       |
    |     |                                                          |
    |     +-- /graphql --> GraphQL Yoga                              |
    |     |                   |                                      |
    |     |                   +-- envelop.ts            (futuro)     |
    |     |                         auditoria                        |
    |     |                         rate limiting                    |
    |     |                         cache de respuestas              |
    |     |                                                          |
    |     +-- /health  --> chequeo                                   |
    |     |                                                          |
    |     +-- /*       --> estaticos de apps/web                     |
    +----------------------------------------------------------------+

Un contenedor, un proceso, un puerto. En desarrollo y en producción es el mismo
`Bun.serve` el que sirve las tres rutas, con recarga en caliente.

## 3. Arranque: la raíz de composición

    index.ts
       |
       | 1. lee y valida la configuracion del entorno
       v
    core.ts ------------- construye ------------> Core { config, logger, reloj, bd }
       |
       | 2. toma la lista de modulos
       v
    modules.ts  ->  [ sistema, estructura, personas, ... ]
       |
       | 3. ordena por dependencies y detecta ciclos
       v
    aplicarMigraciones(core, modulos)   corre las migraciones pendientes de cada uno
       |
       v
    para cada modulo, en orden:
       |
       +--> servicios = modulo.createServices(core, dependencias)
       |         las dependencias son los servicios de modulo.dependencies,
       |         ya construidos, tipados contra su /dominio/publico.ts
       |         y se monta en el contexto bajo modulo.name
       |
       +--> modulo.registerSchema(builder)
       |
       v
    esquema compuesto  --genera-->  schema.gql   (versionado, CI lo verifica)
       |
       v
    server.ts escucha

Si a un módulo le falta algo que necesita, **no compila**. No hay resolución por
strings ni contenedor de inyección que falle en runtime.

## 4. Anatomía de un módulo

Cada módulo es un paquete con tres entradas, y quién puede importar cada una está
impuesto por el linter, no por convención.

    packages/personas/
      |
      +-- /dominio     modelos, validaciones, reglas puras, publico.ts,
      |                politicas.ts (futuro)
      |                    ^              ^                  ^               ^
      |                    |              |                  |               |
      |                 apps/web      apps/mobile    services/backend  otros modulos
      |
      +-- /servidor    esquema, resolvers, repositorios, migraciones
      |                    ^              ^              ^
      |                    |              |              |
      |             services/backend  packages/local  packages/demo
      |                                                (y NADIE mas)
      |
      +-- /ui          componentes compartibles (opcional)
                           ^          ^
                           |          |
                        apps/web  apps/mobile

Prohibido y verificado en CI, por `noRestrictedImports` en `biome.json`:

    apps/**            ---X--->  packages/*/servidor
    packages/<a>/src   ---X--->  @gps/<b>/servidor
    packages/<a>/src   ------->  @gps/<b>/dominio     (la interfaz publica)

Dos excepciones a la primera regla. `@gps/core` sí se puede importar: es la plomería, no
un módulo. Y `packages/demo` está exceptuado del todo, porque sembrar los módulos a
través de sus servicios públicos exige conocerlos — es su razón de ser.

`/servidor` es privado — tiene estado y es la implementación — y se llega a él por el
contexto (`ctx.personas`, `ctx.estructura`) o por las dependencias que `createServices`
recibe ya construidas. `/dominio`, en cambio, sí se importa entre módulos: es puro,
isomorfo y sin estado. Lo que un módulo le ofrece a los demás se declara en
`src/dominio/publico.ts`, deliberadamente más chico que su servicio —
`packages/estructura/src/dominio/publico.ts` publica `interface Estructura` con un solo
método, `obtenerGrupo`, mientras `ServicioDeEstructura` (en `/servidor`) tiene cinco más
que siguen siendo privados.

La frontera también ordena la lógica dentro de un módulo:

    /dominio     decisiones puras y vocabulario del negocio
    /servidor    orquestación de efectos, consultas y persistencia
    servicio.ts  contrato y composición del servicio

Una regla que puede decidir con datos recibidos por parámetro vive en `/dominio`, aunque
su único consumidor actual sea el servidor. Por ejemplo, Afiliación arma allí las
nóminas declarables a partir de miembros activos, grupos abiertos y grupos que ya
declararon. El caso de uso de `/servidor` obtiene esos datos, consulta el reloj mediante
`Core`, asigna ids y persiste declaración y nómina en una transacción.

Esto no obliga a un archivo por método ni a capas de `repository`, puertos o handlers.
Las operaciones cortas sin una decisión separable pueden seguir en `servicio.ts`, como
las altas simples de Estructura. Cuando un módulo crece, los casos de uso cohesivos y las
consultas se separan en archivos con nombres del negocio; `servicio.ts` queda como mapa
del contrato y punto de composición, no como destino automático de toda regla nueva.

Compartir un tipo de dominio entre módulos tiene una arista aparte cuando ese tipo es un
enum de GraphQL: Pothos 4.13 no tiene un `enumRef` diferido, así que un enum sólo se crea
con `builder.enumType(...)`, y crearlo dos veces con el mismo nombre aborta el esquema al
componerlo. `Rama` la necesitan tanto `estructura` (que la define, en su `/dominio`) como
`personas` (que la usa para modelar la pertenencia), y los dos módulos registran su
esquema por separado. `enumCompartido` (`packages/core/src/builder.ts`) es la plomería
que resuelve eso: el primer módulo que lo llama con un nombre lo crea, el segundo recibe
la misma referencia si los valores coinciden, y tira si no. El catálogo de valores de
`Rama` no subió a `core` —sigue siendo `estructura` quien lo declara en su `/dominio`—,
sólo el registro que evita crearlo dos veces, que es plomería y por eso vive en `core`.

## 5. El recorrido de una consulta

Ésta es la cadena que el walking skeleton prueba de punta a punta.

    pantalla
       |
       v
    useVersionQuery()            hook generado por codegen desde schema.gql
       |
       v
    TanStack Query               si hay copia en disco, responde sin red
       |
       v
    Transporte.ejecutar()
       |
       v
    POST /graphql
       |
       v
    GraphQL Yoga
       |
       v
    plugins de envelop           auditoria, rate limit
       |
       v
    context.ts                   arma { actor, sistema, personas, ... }
       |
       v
    resolver de Pothos           ctx.sistema.obtenerVersion()
       |
       v
    servicio del modulo
       |
       v
    repositorio  ->  base        (estructura llega hasta aca; sistema no tiene tablas)
       |
       v
    respuesta

## 6. Autorización (futuro)

    request
       |
       v
    auth        quien sos      -->  Actor { usuarioId, roles[] }
       |
       v
    estructura  que alcanzas   -->  Alcance { gruposVisibles, distritosVisibles }
       |
       +----------------------------+
       |                            |
       v                            v
    repositorio(alcance, ...)    politicas.puedeVer...(alcance, x)
       |                            |
       |                            +--> tambien lo usa la pantalla,
       |                                 para decidir que boton mostrar
       v
    filas que el actor puede ver

Dos garantías salen de este dibujo. La primera: `alcance` es el **primer parámetro
obligatorio** de todo repositorio, así que una consulta que se olvide de filtrar no
compila. La segunda: las políticas son las **mismas funciones** en el servidor y en la
pantalla, así que la interfaz no puede ofrecer algo que el servidor vaya a rechazar.

Un grupo se subdivide en **unidades**: la Manada, las dos Tropas, el Clan. La rama sigue
siendo el catálogo —el tramo de edad, y cómo se llama el tipo de unidad que le
corresponde—, y la unidad es la instancia concreta que ese grupo abrió, con su sexo
(masculina, femenina o mixta) y su nombre propio. Es la misma separación que hay entre los
cargos, que los nombra el código, y los equipos, que los crea alguien. Por eso un grupo
puede tener dos tropas scout, que es lo que la tabla `ramas_del_grupo` —clave
`(grupo, rama)`— no podía representar. Las ramas abiertas de un grupo se derivan de sus
unidades, sin repetir.

La persona pertenece a una unidad y no a una rama: la rama sale de la unidad. A quién se
pone en cuál lo deciden los dirigentes; el sistema no lo valida ni lo sugiere, y `Persona`
no guarda sexo.

Quien ocupa cada cargo lo dice `personas`, no `estructura` — ver §7. Cuando llegue
`auth`, la cadena de dependencias va a ser `auth` → `personas` → `estructura`.

## 7. Dependencias entre módulos

`Actor` y `Alcance` son tipos de `core`; `estructura` va a aportar, cuando exista `auth`,
la implementación que expande los roles en un alcance concreto. Eso es ortogonal a la
dependencia de módulo que ya existe hoy: `personas` depende de `estructura`.

    core                        plomeria; todos dependen de el

    estructura      archivos    no dependen de ningun otro modulo
       ^                ^
       |                |
    personas           permisos
       ^  ^
       |  |
       |  +-- salud
       |
    afiliacion      depende tambien de estructura, directo y no solo via personas
       ^
       |
    tesoreria

La spec base suponía que `estructura` iba a depender de `personas`, porque modela cargos
y autoridades (jefe de grupo, comisionado de distrito, auxiliares, Edifor): todos apuntan
a una persona. Al conectar los dos módulos la relación resultó invertida: la pertenencia
y los cargos viven en `personas`, en dos tablas con historial (`pertenencias` y `cargos`),
así que es `personas` quien depende de `estructura` (`dependencies: ['estructura']`) —
para saber a qué grupo pertenece cada quien — y no al revés. `estructura` no depende de
ningún otro módulo (`dependencies: []`), y quién ocupa cada cargo lo dice `personas`.

`afiliacion` depende de `personas` **y** de `estructura` (`dependencies: ['personas',
'estructura']`), las dos por lectura: no escribe ni una persona ni un grupo. Necesita
`estructura.gruposAbiertosEn` para saber qué grupos existían un día dado, y
`personas.miembrosActivos` para la nómina de ese día — ninguna de las dos alcanza sola,
porque un grupo cerrado no debe declarar aunque su gente siga viva en las tablas de
`personas` (ver §"Qué NO existe todavía" en `AGENT.md` sobre esa deuda). No depende de
`permisos`: esa flecha era un error de una versión anterior de este diagrama, de cuando
`afiliacion` era todavía especulativa.

Orden de construcción que se desprende: `sistema`, `estructura` y `personas` (hechos), y
a partir de ahí el resto. Es tentativo: cada spec de módulo puede ajustarlo.

## 8. Modo demo y offline

Los mismos módulos, otro `Core`.

    +---------------------------+        +---------------------------+
    |  services/backend         |        |  apps/mobile   (futuro)   |
    |                           |        |                           |
    |  Core {                   |        |  Core {                   |
    |    bd: bun:sqlite         |        |    bd: expo-sqlite        |
    |    notificador (futuro)   |        |    notificador: ninguno   |
    |    almacenamiento (futuro)|        |    almacenamiento: local  |
    |  }                        |        |  }                        |
    +------------+--------------+        +------------+--------------+
                 |                                    |
                 +------------------+-----------------+
                                    |
                       +------------v-------------+
                       |  packages/<modulo>       |
                       |  identico en los dos     |
                       +--------------------------+

La mitad izquierda ya existe, salvo lo marcado `(futuro)`: `services/backend/src/bd.ts`
abre SQLite real por Drizzle, con WAL y cinco segundos de espera ante un lock, y
`bun run demo` (`ENTORNO=demo`) levanta esa misma base en memoria, sembrada por
`packages/demo` a través de los servicios públicos de cada
módulo — la siembra no conoce repositorios ni tablas, sólo llama a lo que cualquier
resolver llamaría.

La mitad derecha sigue siendo futuro completo: no hay `packages/local` ni base en el
dispositivo. Cuando exista, va a componer los mismos módulos con un `Core` que abra
`expo-sqlite` en vez de `bun:sqlite` — `bd.ts` es hoy el único archivo que conoce el
driver, así que cambiarlo ahí es todo lo que hace falta del lado del servidor.

Esto sólo funciona si se respeta la regla: **el código de servidor de un módulo nunca
toca una API de plataforma directamente.** Ni `bun:sqlite`, ni `fs`, ni `fetch`, ni la
hora del sistema. Todo pasa por `Core`.

Con una deuda conocida, que conviene tener escrita y no escondida. El runner
`aplicarMigraciones` sí es portable: recibe `sql: string` y habla por `core.bd`, sin
tocar el sistema de archivos ni el driver. Lo que **no** es portable es cómo cada
módulo consigue ese texto, que es un detalle de plataforma: hoy `estructura` lo importa
con `with { type: 'text' }`, una extensión de Bun que Metro no soporta (del atributo de
import sólo `json` es estándar). El día que exista `packages/local` va a haber que
resolverlo ahí — un transformer de Metro, o pasarle las migraciones al módulo de otra
forma —, pero es un cambio en los módulos, no en el runner.

## 9. Eventos entre módulos (futuro)

Los módulos no se llaman entre sí para reaccionar a cosas.

    afiliacion
       |
       | emite AfiliacionDeclarada
       v
    bus de eventos (core, en proceso, sincronico, tipado)
       |
       +--> tesoreria      genera la deuda      | misma transaccion:
       +--> auditoria      registra el hecho    | pueden hacerla fallar
       |
       +--> mensajeria     avisa al grupo       | efectos externos:
       +--> notificaciones manda el push        | requieren bandeja de salida

Afiliación no sabe quién escucha. Ése es el punto: la deuda la genera Tesorería sin que
Afiliación la conozca.

El evento se llama `AfiliacionDeclarada` y no `AfiliacionAprobada`: lo que hace
`afiliacion.declarar` es una declaración —una fotografía de quién está en cada grupo un
día dado—, no una aprobación. No hay nada que aprobar. El bus de la primera fila sigue
sin existir, como el resto de este diagrama: llega recién con Tesorería, su primer
suscriptor real.
