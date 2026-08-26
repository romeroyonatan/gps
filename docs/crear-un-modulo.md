# Crear un módulo

Este tutorial recorre `packages/sistema` de punta a punta: es el módulo más chico que
existe y el que se usó como plantilla para diseñar el resto. `AGENT.md` dice **qué**
hacer para crear un módulo nuevo; este documento explica **por qué** cada pieza está
donde está.

## Un módulo es un paquete

    {
      "name": "@gps/sistema",
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
        "@gps/core": "workspace:*"
      },
      "devDependencies": {
        "@types/bun": "latest",
        "typescript": "^5.7.0"
      }
    }

Hay dos entry points, no uno, y la separación no es cosmética. `./dominio` es el
subpath que puede llegar a cualquier lado: al backend, a la web y a la app mobile. Ahí
viven los tipos y las reglas puras. `./servidor` es el subpath que sólo el backend (y,
el día que exista, `packages/local`) tiene permiso de importar: ahí viven el servicio,
el esquema de GraphQL y todo lo que compone un módulo dentro del proceso que lo sirve.

Si `apps/web` pudiera importar `/servidor`, el módulo dejaría de ser portable: nada
impediría que una pantalla arrastre un resolver de Pothos, o una consulta al futuro
repositorio, al bundle que corre en el navegador o en el teléfono. La regla que
prohíbe ese import —`apps/**` no puede importar `@gps/*/servidor`— la impone Biome
(ver `biome.json`), no la memoria de quien escribe el código. Por eso conviene diseñar
el paquete con dos exports desde el primer módulo: agregar la frontera después, cuando
ya hay código que la cruza, es mucho más caro que respetarla desde el principio.

## El dominio: lo que se comparte con las apps

    /** Version del sistema. Es la respuesta de la consulta publica `version`. */
    export interface Version {
      readonly numero: string
      readonly entorno: string
      /** Nombres de los modulos registrados en esta instancia. */
      readonly modulos: readonly string[]
    }

`Version` vive en `/dominio` y no en `/servidor` porque tanto el backend como la web
como la futura app mobile necesitan saber la forma de ese dato: el backend para
resolverlo, las pantallas para tipar lo que reciben. Ponerlo en `/servidor` obligaría a
las apps a importar código de servidor sólo para tener el tipo, que es exactamente el
import que Biome prohíbe.

Esto es lo que significa "isomorfo" en este proyecto: no es código que corre igual en
el servidor y en el cliente (`Version` no corre en ningún lado, es sólo una forma), es
código que **ambos lados pueden importar sin romper ninguna frontera**. `/dominio` es
el subpath diseñado para eso.

## El servicio: la lógica

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

`crearServicioDeSistema` recibe un `Core` en vez de leer `package.json` con
`Bun.file` porque leer el disco directamente es exactamente lo que la regla de
portabilidad prohíbe bajo `src/servidor/`: nada de `bun:*`, nada de `node:*`, nada que
sólo exista en un runtime en particular. `Core` es la única vía hacia la plataforma
(`config`, `logger`, `reloj`, `modulos`); quien arma el `Core` —hoy
`services/backend/src/core.ts`— es quien decide de dónde sale cada dato.

Esta regla es aburrida hasta que se piensa en el destino final: el mismo
`crearServicioDeSistema`, sin cambiar una línea, tiene que poder correr adentro del
teléfono, recibiendo un `Core` armado con `expo-sqlite` y sin red, en vez de uno armado
por `services/backend`. Si el servicio leyera el `package.json` con una API de Bun, ese
día no llegaría nunca sin reescribir el módulo.

## El esquema: la API pública

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

El tipo `Query` se declara una única vez, en `crearBuilder` (`packages/core/src/builder.ts`),
y cada módulo le agrega campos con `builder.queryField(...)` en vez de declarar su
propio `Query`. Eso es lo que permite que ocho módulos —Personas, Estructura, Salud,
Afiliación, Permisos, Tesorería, Formación, Mensajería— escriban sobre el mismo tipo sin
pisarse: `queryField` extiende, no reemplaza, así que el orden de registro no importa y
dos módulos nunca compiten por declarar `Query` desde cero.

Los campos van en español (`version`, `numero`, `entorno`, `modulos`) porque el
contrato de GraphQL es vocabulario de negocio, no infraestructura: lo que nombra al
escultismo y a las reglas de la asociación se escribe en el idioma del dominio, igual
que los modelos y los tests. `Query`, `Builder`, `Version` como identificador de tipo
técnico de Pothos son la excepción de industria, no la regla.

## El módulo: atar los cabos

    import type { Module } from '@gps/core'
    import { registrarSchema } from './schema'
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

`declare module '@gps/core'` usa *declaration merging* de TypeScript para agregarle un
campo a la interfaz `Context` que vive en `packages/core/src/context.ts`, sin tocar ese
archivo. Es la única vía para que otro módulo llegue al servicio de `sistema`: en
tiempo de ejecución, `services/backend/src/composicion.ts` mete
`crearServicioDeSistema(core)` bajo la clave `sistema` del objeto de contexto; en
tiempo de compilación, este `declare module` es lo que le permite a un resolver de
otro módulo escribir `contexto.sistema.obtenerVersion()` y que TypeScript lo acepte. No
hay un import directo de un módulo a otro en ningún punto: `dependencies` sólo ordena
el arranque, el contexto es el único canal de comunicación entre módulos en tiempo de
ejecución.

## Registrarlo

    import { sistema } from '@gps/sistema/servidor'

    /** La lista de modulos registrados. Agregar un modulo nuevo es agregarlo aca
     *  y nada mas: el orden lo resuelve ordenarModulos por dependencias. */
    export const modulos = [sistema]

Ésta es la única línea que un módulo nuevo agrega a un archivo compartido: un import y
una entrada en el arreglo. No hay un segundo lugar donde registrar rutas, resolvers o
servicios.

`ordenarModulos` (`packages/core/src/registry.ts`), que corre en
`services/backend/src/composicion.ts` antes de crear ningún servicio, recorre
`dependencies` de cada módulo y produce un orden topológico estable: si `personas`
declarara `dependencies: ['sistema']`, `sistema` se construiría primero sin importar en
qué orden aparecen en el arreglo de `modulos`. Si un módulo declara una dependencia que
no está en la lista, `ordenarModulos` tira `DependenciaFaltante` ("El modulo X depende
de Y, que no esta registrado"); si dos módulos se necesitan en círculo, tira
`CicloDeDependencias` con la cadena completa. Los dos son errores al arrancar el
proceso, no fallas silenciosas en runtime.

## Testearlo aislado

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

`coreFalso` es todo lo que hace falta para testear un módulo: como el servicio sólo
conoce la plataforma a través de `Core`, y `Core` es una interfaz, un objeto plano que
la implementa alcanza para probar el servicio sin backend, sin red, sin base de datos y
sin levantar ningún proceso. No hace falta un mock de framework ni una base de datos
de prueba.

El reloj se inyecta (`reloj: { ahora: () => new Date('2026-01-01T00:00:00Z') }`) para
que un test que dependa de la fecha —éste todavía no la usa, pero cualquier módulo con
vencimientos o antigüedad la va a necesitar— dé el mismo resultado siempre. Si el
servicio llamara a `new Date()` directamente, el test sería un test distinto cada vez
que corre, lo cual es la misma razón por la que `Core.reloj` existe en primer lugar.

## Qué se rompe si ignorás las reglas

- **Importar `bun:sqlite` (o cualquier `bun:*`/`node:*`) dentro de `src/servidor/`** rompe
  el modo local y el offline: ese módulo ya no puede correr dentro del teléfono ni en
  cualquier otro runtime, porque quedó atado a una API que sólo existe en el proceso de
  Bun del backend. Biome lo rechaza al lintear, pero el daño real es de arquitectura, no
  de estilo.
- **Importar otro módulo directamente** (en vez de comunicarse por `ctx.<modulo>`) hace
  imposible dar de baja el módulo importado sin romper compilación en todos los que lo
  importaron directo. El contexto existe para que cada módulo dependa de una interfaz
  (`Context`), no de la implementación concreta de otro paquete.
- **Olvidarse de correr `bun run schema` después de tocar el esquema** hace fallar CI: el
  `schema.gql` versionado queda desactualizado respecto del que el código compone, y esa
  discrepancia es justamente lo que la verificación de CI existe para detectar.
- **Olvidarse de `Alcance` como primer parámetro de un método de repositorio** —cuando
  exista `auth` y haya repositorios reales— filtra datos de otros grupos: sin ese filtro
  obligatorio, una consulta que debería limitarse al grupo del actor puede devolver filas
  de toda la asociación.
