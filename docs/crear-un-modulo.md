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
archivo. Es la vía para que un resolver llegue al servicio de `sistema` sin conocer su
implementación: en tiempo de ejecución, `services/backend/src/composicion.ts` mete
`crearServicioDeSistema(core)` bajo la clave `sistema` del objeto de contexto; en
tiempo de compilación, este `declare module` es lo que le permite a un resolver de
otro módulo escribir `contexto.sistema.obtenerVersion()` y que TypeScript lo acepte.

Un módulo nunca importa el `/servidor` de otro —eso lo prohíbe Biome, y sigue
prohibido—, pero sí puede importar su `/dominio`, y en particular su `publico.ts`, para
tipar una dependencia declarada (la próxima sección lo recorre con `estructura` y
`personas`). `ctx.<modulo>` sigue siendo el canal para lo que un resolver necesita en
tiempo de ejecución; `dependencies` es el canal para lo que un módulo necesita antes, al
construir sus propios servicios.

## La interfaz pública: cuando otro módulo necesita algo tuyo

`sistema` no depende de nadie, así que no hace falta `publico.ts` para explicarlo. Para
ver la pieza hay que mirar `packages/estructura` y `packages/personas`, que sí están
conectados: `personas` necesita saber a qué grupo pertenece cada persona, y eso lo sabe
`estructura`.

La tentación fácil sería que `personas` importara `ServicioDeEstructura` entero, la
interfaz que vive en `/servidor` con los seis métodos del servicio. `Estructura` no lo
permite: Biome rechaza cualquier import de `@gps/estructura/servidor` desde otro módulo,
porque `/servidor` es privado — tiene estado y es la implementación.

Lo que un módulo le presta a los demás se declara aparte, en `src/dominio/publico.ts`, y
a propósito es más chico que el servicio completo:

    // packages/estructura/src/dominio/publico.ts
    export interface Estructura {
      /** El grupo con sus ramas abiertas, o null si no existe o esta cerrado. */
      obtenerGrupo(grupoId: string): Promise<GrupoConRamas | null>
    }

`ServicioDeEstructura`, en `/servidor`, extiende `Estructura` y le agrega cinco métodos
más (crear distrito, crear grupo, abrir rama, cerrar grupo, listar distritos) que
`personas` no necesita y no puede ver. Ésa es la mitad que importa de la regla: lo que no
se publica en `publico.ts` queda privado, aunque viva en el mismo paquete. Es la idea de
los *package interfaces* de SAP y del modificador `global` de Salesforce — declarar la
superficie pública aparte de la implementación, para que agrandar el servicio no agrande
lo que los demás pueden tocar.

Declarar la dependencia es tipar el `Module` contra ella:

    import type { Module } from '@gps/core'
    import type { Estructura } from '@gps/estructura/dominio'

    export const personas: Module<ServicioDePersonas, { estructura: Estructura }> = {
      name: 'personas',
      dependencies: ['estructura'],
      createServices: (core, dependencias) =>
        crearServicioDePersonas(core, dependencias.estructura),
      registerSchema: registrarSchema,
    }

`Module<S, D>` tipa `dependencies` contra las claves de `D`: escribir `dependencies:
['sistema']` acá no compilaría, porque `sistema` no está en `{ estructura: Estructura }`.
El servicio concreto de `estructura` —no sólo su tipo— llega por el segundo parámetro de
`createServices`, ya construido: `crearServicios` (`packages/core/src/registry.ts`) arma
ese objeto recorriendo `modulo.dependencies` y leyendo lo que ya construyó para cada
nombre, así que para cuando corre `personas.createServices`, `dependencias.estructura` ya
es un `ServicioDeEstructura` real, no una promesa ni una referencia diferida.

Con `publico.ts` conviene ser conservador: agregar un método ahí es agrandar lo que
cualquier módulo futuro puede llegar a usar, y sacarlo después rompe a quien ya lo usa.
`Estructura` publica un solo método porque es el único que `personas` necesita hoy — el
resto se agrega cuando aparezca el consumidor real, no antes.

## Las tablas y las migraciones

`sistema` no tiene tablas — por eso sirve de plantilla para todo lo anterior, pero no
para esto. Para ver el resto del patrón hay que mirar `packages/estructura`.

Las tablas se declaran con Drizzle en `src/servidor/tablas.ts`, no en `/dominio`: son
detalle de cómo se guardan los datos, no forma que las apps necesiten conocer. Al lado,
`drizzle.config.ts` apunta `schema` a ese archivo y `out` a `./migraciones`, una
carpeta dentro del propio paquete. No hay un `drizzle.config.ts` ni un directorio de
migraciones centrales para todo el proyecto: cada módulo genera las suyas paradas en su
propio directorio (`bunx drizzle-kit generate --name <nombre>`), por la misma razón por
la que no hay un `schema.ts` central para el GraphQL — un archivo compartido es un
archivo que dos módulos que no se conocen entre sí terminan pisándose al tocar.

`drizzle-kit generate` escribe el `.sql` nuevo en `migraciones/`; sumarlo a la lista es
un paso aparte, a mano, en `src/servidor/migraciones.ts`:

    import inicial from '../../migraciones/0000_inicial.sql' with { type: 'text' }

    export const migraciones: readonly Migracion[] = [{ nombre: '0000_inicial', sql: inicial }]

El `import ... with { type: 'text' }` trae el SQL como string en vez de ejecutarlo:
`aplicarMigraciones`, en `packages/core`, es quien lo corre, sentencia por sentencia,
dentro de una transacción, contra `core.bd` — nunca el módulo. Por eso el archivo lleva
`migraciones` como campo del objeto `Module` (`migraciones: readonly Migracion[]`) y no
como código que se ejecuta solo al importar el paquete: el orden en que se aplican las
migraciones de todos los módulos lo decide la raíz de composición, no cada paquete por
separado. `aplicarMigraciones` corre antes de `createServices` de cualquier módulo —
ninguno debería poder consultar una tabla que todavía no existe — y sabe qué ya aplicó
por una tabla propia (`migraciones`, con `modulo` y `nombre` como clave), así que
correrla de nuevo con la misma base no repite nada. También guarda el contenido aplicado:
editar una migración ya ejecutada hace fallar el arranque en vez de divergir en silencio.

Una advertencia sobre esa línea, para que la copies sabiendo lo que copiás: el atributo
`with { type: 'text' }` **es una extensión de Bun** — del estándar sólo `json` lo es — y
Metro no lo soporta. Es decir que el runner es portable al teléfono pero *esta forma de
cargarle el texto no*. Es deuda conocida y aceptada: el día que exista `packages/local`
va a haber que resolverla, con un transformer de Metro o pasándole las migraciones al
módulo de otra manera, y ese día hay que tocar todos los módulos que hayan copiado esta
línea. Copiala igual —hoy no hay alternativa mejor y el costo se paga una sola vez—,
pero no la tomes como una decisión cerrada.

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
`dependencies` de cada módulo y produce un orden topológico estable: `personas` declara
`dependencies: ['estructura']`, así que `estructura` se construye primero sin importar en
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
- **Importar el `/servidor` de otro módulo directamente** (en vez de por el contexto o
  por las `dependencies` de `Module`) hace imposible dar de baja el módulo importado sin
  romper la compilación de todos los que lo importaron directo. El `/dominio` sí se puede
  importar —es la interfaz pública, declarada a propósito en `publico.ts`—, pero el
  `/servidor` es la implementación con estado, y a ésa cada módulo llega siempre detrás
  de una interfaz (`Context`, o la `D` de `Module<S, D>`), nunca por import directo.
- **Olvidarse de correr `bun run schema` después de tocar el esquema** hace fallar CI: el
  `schema.gql` versionado queda desactualizado respecto del que el código compone, y esa
  discrepancia es justamente lo que la verificación de CI existe para detectar.
- **Olvidarse de `Alcance` como primer parámetro de un método de repositorio** —cuando
  exista `auth` y haya repositorios reales— filtra datos de otros grupos: sin ese filtro
  obligatorio, una consulta que debería limitarse al grupo del actor puede devolver filas
  de toda la asociación.
