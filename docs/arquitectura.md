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
                          +-------------v--------------+
                          |    packages/<modulo>       |
                          |    sistema, personas, ...  |
                          +-------------+--------------+
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
    core.ts ------------- construye ------------> Core { config, logger, reloj }
       |
       | 2. toma la lista de modulos
       v
    modules.ts  ->  [ sistema, personas, estructura, ... ]
       |
       | 3. ordena por dependencies y detecta ciclos
       v
    para cada modulo, en orden:
       |
       +--> servicios = modulo.createServices(core)
       |         y se monta en el contexto bajo modulo.name
       |
       +--> modulo.registerSchema(builder)
       |
       +--> (futuro) corre sus migraciones pendientes
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
      +-- /dominio     modelos, validaciones, reglas puras, politicas.ts (futuro)
      |                    ^              ^                  ^
      |                    |              |                  |
      |                 apps/web      apps/mobile    services/backend
      |
      +-- /servidor    esquema, resolvers, repositorios, migraciones
      |                    ^                        ^
      |                    |                        |
      |             services/backend         packages/local
      |                                        (y NADIE mas)
      |
      +-- /ui          componentes compartibles (opcional)
                           ^          ^
                           |          |
                        apps/web  apps/mobile

Prohibido y verificado en CI:

    apps/**  ---X--->  packages/*/servidor
    packages/<a>  ---X--->  packages/<b>       (los modulos no se importan entre si)

Los módulos se comunican **sólo por el contexto**: `ctx.personas`, `ctx.estructura`.

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
    repositorio  ->  base        (futuro; el modulo `sistema` no llega hasta aca)
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

## 7. Dependencias entre módulos

`Actor` y `Alcance` son tipos de `core`; `estructura` aporta la implementación que
expande los roles en un alcance concreto. Por eso `personas` no depende de `estructura`
aunque sus repositorios reciban un `Alcance`.

    core                        plomeria; todos dependen de el

    personas        archivos    no dependen de ningun otro modulo
       ^                ^
       |                |
    estructura        permisos  <---+
       ^  ^                        |
       |  |                        |
       |  +-- salud                |
       |                           |
    afiliacion --------------------+
       ^
       |
    tesoreria

Orden de construcción que se desprende: `sistema` (hecho), luego `personas`, luego
`estructura`, y a partir de ahí el resto. Es tentativo: cada spec de módulo puede
ajustarlo.

## 8. Modo demo y offline (futuro)

Los mismos módulos, otro `Core`.

    +---------------------------+        +---------------------------+
    |  services/backend         |        |  apps/mobile              |
    |                           |        |                           |
    |  Core {                   |        |  Core {                   |
    |    bd: bun:sqlite         |        |    bd: expo-sqlite        |
    |    notificador: ExpoPush  |        |    notificador: ninguno   |
    |    almacenamiento: S3     |        |    almacenamiento: local  |
    |  }                        |        |  }                        |
    +------------+--------------+        +------------+--------------+
                 |                                    |
                 +------------------+-----------------+
                                    |
                       +------------v-------------+
                       |  packages/<modulo>       |
                       |  identico en los dos     |
                       +--------------------------+

Esto sólo funciona si se respeta la regla: **el código de servidor de un módulo nunca
toca una API de plataforma directamente.** Ni `bun:sqlite`, ni `fs`, ni `fetch`, ni la
hora del sistema. Todo pasa por `Core`.

## 9. Eventos entre módulos (futuro)

Los módulos no se llaman entre sí para reaccionar a cosas.

    afiliacion
       |
       | emite AfiliacionAprobada
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
