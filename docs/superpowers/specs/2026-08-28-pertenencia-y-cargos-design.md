# Pertenencia y cargos: el primer vínculo entre dos módulos

Cuarta iteración. `estructura` tiene el árbol de la diócesis y `personas` tiene las
fichas, y no se tocan: una persona no pertenece a nada. Ésta las conecta, y al hacerlo
descubre que la frontera entre módulos, tal como está escrita, no deja hacerlo. Así que
la mitad de la spec es sobre **cómo un módulo usa a otro**, y la otra mitad es el modelo
de pertenencia y cargos que lo estrena.

Complementa `docs/superpowers/specs/2026-08-24-arquitectura-y-walking-skeleton-design.md`
(**la spec base**), `docs/superpowers/specs/2026-08-26-estructura-persistencia-y-demo-design.md`
(**la spec de estructura**) y `docs/superpowers/specs/2026-08-27-personas-datos-personales-design.md`
(**la spec de personas**), a las que se cita en vez de repetir.

## 1. El dominio, como es en la realidad

Las personas pertenecen a un grupo scout, y dentro del grupo hay tres categorías:

- **Beneficiarios** — pertenecen a una rama. Generalmente son los chicos, pero también
  los adultos de la rama Adultos, que participan como beneficiarios y no tienen chicos a
  cargo: es justo lo que los distingue de ser dirigentes.
- **Activos** — los dirigentes, que están a cargo de las ramas. También pertenecen a una
  rama, incluidos el jefe y el subjefe de grupo, que además dan en alguna.
- **Adherentes** — adultos a cargo de otras tareas: el cocinero, el capellán, el
  director. No tienen chicos a cargo y **no pertenecen a ninguna rama**.

Aparte de la categoría están los **cargos**. Esta iteración toma sólo los del grupo:
jefe/jefa de grupo, subjefe/subjefa de grupo, jefe/jefa de rama, capellán y director —
el sacerdote a cargo del grupo, que es adherente y más adelante va a importar porque
firma los permisos de acampe.

**Cargo y categoría son independientes.** No se validan cruzados. En la práctica el
director es adherente y el jefe de grupo es activo, pero eso es un hecho del mundo, no
una regla que el sistema tenga que imponer.

**Una persona puede tener varios cargos**, y un cargo dura un mandato: cuatro años es lo
normal. Más adelante van a existir cargos distritales (comisionado, auxiliares),
diocesanos (jefe scout diocesano, subjefe, auxiliares) y equipos (tesorería, formación).
Alguien puede ser jefe de rama, jefe de grupo, auxiliar rover, parte del equipo de
tesorería diocesano y jefe scout diocesano a la vez. No es lo ideal, pero pasa.

**Una persona pertenece a un solo grupo**, y se puede cambiar de grupo.

## 2. Alcance

### Entra

1. **La frontera entre módulos se corrige**: interfaz pública en `/dominio/publico.ts`,
   dependencias tipadas en `createServices`, y la regla del linter reescrita.
2. `enumCompartido` en `core`: un enum de GraphQL que declara más de un módulo.
3. Pertenencia y cargos en `personas`, las dos con historial: dos tablas nuevas.
4. `obtenerGrupo` en la interfaz pública de `estructura`, con su consumidor real.
5. Validaciones puras del ingreso, compartidas por el formulario y por el servicio.
6. Pantalla del grupo en web y en mobile: la lista de sus personas y el alta adentro.
7. La lista global de personas **se borra**.
8. Demo sembrado con personas repartidas en grupos, con categorías, ramas y cargos.

### No entra, y por qué

**Baja y edición.** No se puede cerrar una pertenencia ni un cargo desde la pantalla, ni
corregir los datos de una persona. Las columnas `hasta` existen y el historial se puede
escribir, pero por ahora sólo se llena con altas. La spec de personas ya difirió la
edición (§1) y sigue difiriéndose por lo mismo: modificar exige decidir qué pasa con el
documento, y dar de baja exige decidir si el cambio de grupo cierra la pertenencia
anterior automáticamente o no. Las dos preguntas se contestan mejor con una pantalla que
las pida.

**Cargos distritales, diocesanos y equipos.** El modelo los tiene en cuenta —§7.2 explica
exactamente qué columna cambia cuando lleguen— pero no hay ámbito distinto del grupo
todavía, y no hay pantalla que los cargue.

**Buscar una persona sin saber su grupo.** Al borrarse la lista global, la única forma de
llegar a alguien es por su grupo. Es una pérdida real para una secretaría diocesana y está
anotada como deuda en §12; el reemplazo es un buscador, no una lista de miles de filas.

**Reglas de edad.** Que un beneficiario de Castores tenga entre 5 y 7, que un dirigente
tenga 21 o más. `RAMAS` tiene los tramos y `calcularEdad` existe, así que la regla se
puede escribir en tres líneas. No se escribe: la asociación admite excepciones —un chico
que se queda un año más con sus amigos— y no sabemos cuáles. Una validación que hay que
saltear no es una validación.

**El bus de eventos.** Sigue esperando a Afiliación, como dice la spec base (§10).

## 3. El problema: la frontera no dejaba conectarlos

Antes de esta iteración, `biome.json` prohibía que `packages/<a>/src/**` importara
`@gps/<b>/*`, con `@gps/core` como única excepción. El mensaje decía la intención: *"los
módulos se comunican por el contexto (ctx.<modulo>)"*. Al intentar conectar los dos
módulos aparecieron tres consecuencias que no estaban previstas.

**Primera: el vocabulario del dominio no cruza.** `personas` necesita `Rama` y el catálogo
`RAMAS`, que viven en `estructura/dominio`. Son un tipo puro y una constante, sin estado,
que las dos apps ya importan de los dos módulos sin problema. La regla los frenaba igual.

**Segunda: un tipo de GraphQL no se puede referenciar desde otro módulo.**
`estructura/servidor/schema.ts` no puede usar el `PersonaRef` de Pothos que define
`personas/servidor/schema.ts`. No hay forma de que `Grupo.miembros` devuelva nombres y
apellidos.

**Tercera, y la que decide todo: un servicio no puede llamar a otro.** `createServices`
recibe `Core` y nada más, así que la única forma de alcanzar otro módulo es `ctx.<modulo>`
desde un resolver. Pero el tipo de `ctx.estructura` sólo existe donde se importó
`@gps/estructura/servidor`, que es justo lo prohibido. `Module.dependencies: string[]`
existe, se valida al arrancar y ordena el registro… y no sirve para nada más.

O sea: la relación persona–grupo tenía que vivir entera de un solo lado, y el servidor no
podía validar nada que dependiera del otro módulo.

### 3.1 Cómo lo resuelven los sistemas parecidos

Vale mirar afuera, porque el problema tiene décadas.

**SAP ABAP** tiene *package interfaces*: un paquete lista explícitamente qué objetos son
visibles desde afuera, y el paquete que los quiere usar declara un *use access* contra esa
interfaz. El chequeo de paquetes lo verifica al activar. En S/4HANA la idea subió de
nivel: cada objeto tiene un contrato de release —C1 para desarrollo cloud, o nada, que
significa privado. Y para lo que no puede ser una dependencia dirigida, cuando el
proveedor no debe conocer al consumidor, están los **BAdI**: el proveedor publica una
interfaz de extensión, los consumidores la implementan, y el kernel las resuelve en
runtime.

**Salesforce** hace lo mismo con el modificador `global`: dentro de un managed package
todo lo `public` es en realidad *package-private*, y lo único que cruza el namespace es lo
marcado `global`. Los paquetes declaran dependencias versionadas entre sí en un grafo
dirigido sin ciclos —un *extension package* depende del base, nunca al revés— y cuando
hace falta desacoplar de verdad están las **Platform Events**, que son un bus.

Los dos tienen **dos mecanismos, no uno**:

1. **Dependencia declarada contra una interfaz publicada**, para cuando A necesita a B y
   eso es un hecho del negocio.
2. **Punto de extensión o bus**, para cuando el proveedor no debe conocer al consumidor.

Nuestra arquitectura tenía el (2) diseñado y diferido —el bus llega con Afiliación— y del
(1) tenía sólo la mitad. La regla "los módulos no se importan entre sí" resultó **más
estricta que SAP y que Salesforce**, y por eso frenaba una relación que es un hecho del
negocio: una persona pertenece a un grupo.

## 4. La frontera corregida

### 4.1 La regla

Pasa a ser una sola, la misma para apps y para módulos:

    @gps/*/servidor   prohibido fuera de services/backend, packages/demo y packages/local
    @gps/*/dominio    permitido

Y el porqué, que es lo que hay que poder explicar en una línea: **el servidor de un módulo
es privado porque tiene estado y es la implementación; el dominio es puro, isomorfo y sin
estado, y es la interfaz.** Las apps ya importan `/dominio` de los dos módulos; que un
módulo no pueda es una asimetría sin razón.

Lo que la regla vieja protegía de verdad —que un módulo no manotee el repositorio ni las
tablas de otro— lo sigue protegiendo, porque todo eso vive en `/servidor`.

En `biome.json`, el patrón `["@gps/**", "!@gps/core"]` del override de
`packages/*/src/**` se reemplaza por `["@gps/*/servidor"]`, con el mensaje nuevo. El
patrón de `node:*` y `bun:*` no se toca. El override de `apps/**` queda igual: ya decía
exactamente eso.

### 4.2 `dominio/publico.ts`

El `exports` de cada `package.json` ya lista dos puntos de entrada y ningún comodín, así
que la interfaz pública como mecanismo ya existía y Bun ya la impone. Lo que faltaba era
distinguir, dentro de `/dominio`, entre el vocabulario compartido —modelos, catálogos,
funciones puras, que siempre fueron públicos— y **el contrato de servicio que el módulo le
ofrece a los demás**, que hasta ahora vivía en `/servidor` y por lo tanto era inalcanzable.

    packages/estructura/src/dominio/publico.ts

      /** Lo que estructura le publica a los otros modulos. Es deliberadamente
       *  mas chico que ServicioDeEstructura: el resto de los metodos son de
       *  este modulo y de nadie mas. */
      export interface Estructura {
        obtenerGrupo(grupoId: string): Promise<GrupoConRamas | null>
      }

Y en `/servidor/servicio.ts`, la interfaz interna la extiende:

    export interface ServicioDeEstructura extends Estructura {
      crearDistrito(...): Promise<Distrito>
      crearGrupo(...): Promise<Grupo>
      abrirRama(...): Promise<void>
      cerrarGrupo(...): Promise<void>
      listarDistritos(): Promise<readonly DistritoConGrupos[]>
    }

`extends` es lo que hace que la implementación no pueda quedar corta sin que TypeScript se
entere, y que la superficie pública se lea de un vistazo: **un método**. `crearDistrito` y
`cerrarGrupo` siguen siendo privados de `estructura`, que es la mitad de la regla que
importa —"el contenido de un módulo es privado"— y la que se perdería si el archivo
público fuera simplemente la interfaz entera mudada de lugar.

**`personas` no tiene `publico.ts` todavía.** Nadie la consume. El archivo aparece cuando
exista el primer módulo que la necesite, igual que `Marcas` subió a `core` recién cuando
hubo un segundo módulo que la usaba (§2 de la spec de personas).

### 4.3 Dependencias tipadas en `Module`

    export interface Module<S = unknown, D = Record<never, never>> {
      readonly name: string
      /** Nombres de otros modulos que este necesita. Ordenan el registro, y el
       *  tipo los ata a las claves de D: un nombre que no este en D no compila. */
      readonly dependencies: readonly (keyof D & string)[]
      readonly migraciones?: readonly Migracion[]
      createServices(core: Core, dependencias: D): S
      registerSchema(builder: Builder): void
    }

Con `D` en su valor por omisión, `keyof D` es `never` y `dependencies` sólo admite la
lista vacía: los módulos que hoy declaran `dependencies: []` no se tocan.

`personas` declara:

    export const personas: Module<ServicioDePersonas, { estructura: Estructura }> = {
      name: 'personas',
      dependencies: ['estructura'],
      createServices: (core, deps) => crearServicioDePersonas(core, deps.estructura),
      ...
    }

**Si le falta la dependencia, no compila.** Es la propiedad que la spec base (§3) ya
prometía para el arranque —"no hay resolución por strings ni contenedor de inyección que
falle en runtime"— extendida a la relación entre módulos.

La raíz de composición ya ordena por `dependencies` y detecta ciclos: sólo tiene que ir
acumulando lo que construyó y pasárselo al siguiente. El único `as` del diseño vive ahí,
en el registro, que es donde está la búsqueda por string; del lado del módulo todo está
tipado.

Nótese que esto **invierte el orden que suponía la spec base** (§13, punto 4): decía que
Estructura dependería de Personas, para saber quién ocupa cada cargo. Con los cargos
viviendo en `personas` (§7.2), la flecha va al revés. La spec base ya se declaraba
tentativa en ese punto.

### 4.4 `enumCompartido` en `core`

`Grupo.ramas` y `Persona.rama` son el mismo enum `Rama`. Pothos 4.13 tiene `objectRef`,
`inputRef` e `interfaceRef` diferidos, que se crean en un archivo y se implementan en
otro, pero **no tiene `enumRef`**: un enum sólo se crea con `enumType`, y crearlo dos veces
con el mismo nombre aborta el esquema.

    // packages/core/src/builder.ts
    export function enumCompartido<V extends string>(
      builder: Builder, nombre: string, valores: readonly V[],
    )

El primer módulo que lo pide lo crea; los demás reciben el mismo ref. Si el segundo pide
el mismo nombre con valores distintos, tira: sin ese chequeo la divergencia sería
silenciosa y el esquema publicaría los valores del que registró primero, que depende del
orden de los módulos.

`core` no gana vocabulario del escultismo: `RAMAS` sigue viviendo en `estructura/dominio`
y los dos módulos se lo pasan al helper. Lo que sube a `core` es la plomería de registrar
una vez, que es exactamente lo que `core` es.

Se descartó subir `RAMAS` a `core`, que era la otra salida: mete el escultismo en la
plomería y obliga a que `crearBuilder` conozca los catálogos de los módulos.

## 5. `obtenerGrupo`, y por qué existe recién ahora

    obtenerGrupo(grupoId: string): Promise<GrupoConRamas | null>

Un método, dos garantías: que el grupo existe, y qué ramas tiene abiertas. Las dos las
necesita `crearPersona` para validar el ingreso (§6.3), y ninguna de las dos la podía
comprobar el servidor antes de §4.

Devuelve `GrupoConRamas` y no un `boolean` ni una lista de ramas suelta porque el tipo ya
existe, ya es el que arma `listarDistritos`, y es el que la pantalla del grupo va a querer
el día que la query `distritos` deje de alcanzar (§9.1).

**Un grupo cerrado devuelve `null`**, igual que `listarDistritos` no lo lista. Para los
otros módulos un grupo cerrado no existe, y eso hace que "no se puede inscribir a nadie en
un grupo cerrado" salga gratis, sin una regla aparte. El día que alguien necesite leer un
grupo cerrado —el historial de una persona que estuvo ahí— se agrega el método que lo diga,
con su consumidor.

## 6. Dominio

### 6.1 Los catálogos

Mismo patrón que `RAMAS` y `TIPOS_DE_DOCUMENTO`: conjuntos cerrados, constantes en
`/dominio`, no tablas. Sin siembra ni migración que mantener, compartidos por el servidor y
las pantallas sin traducirlos.

    // packages/personas/src/dominio/categorias.ts
    export const CATEGORIAS = [
      { id: 'beneficiario', nombre: 'Beneficiario' },
      { id: 'activo',       nombre: 'Activo' },
      { id: 'adherente',    nombre: 'Adherente' },
    ] as const

    export type Categoria = (typeof CATEGORIAS)[number]['id']

    // packages/personas/src/dominio/cargos.ts
    export const TIPOS_DE_CARGO = [
      { id: 'jefeDeGrupo',    nombre: 'Jefe/Jefa de grupo' },
      { id: 'subjefeDeGrupo', nombre: 'Subjefe/Subjefa de grupo' },
      { id: 'jefeDeRama',     nombre: 'Jefe/Jefa de rama' },
      { id: 'capellan',       nombre: 'Capellán' },
      { id: 'director',       nombre: 'Director' },
    ] as const

    export type TipoDeCargo = (typeof TIPOS_DE_CARGO)[number]['id']

`TipoDeCargo` y no `Cargo` para el catálogo, por el precedente de `TipoDeDocumento`: el
`Cargo` es la fila —esta persona, este cargo, desde cuándo—, y el tipo es la entrada del
catálogo. Confundirlos es lo que hace que después no se sepa cómo llamar a la tabla.

`jefeDeRama` no dice qué rama: es la de la persona, que la pertenencia ya guarda. El día
que aparezcan los auxiliares por rama vale lo mismo. Sólo haría falta una columna si
alguien pudiera ser jefe de una rama distinta de la suya, y eso no pasa.

Vale la advertencia de siempre: **agregar una entrada es cambio sólo de código; sacar o
renombrar una no lo es**, porque las tablas siguen guardando el id viejo.

### 6.1.1 Por qué los cargos son un catálogo y no una tabla

Es la pregunta razonable —no sabemos todos los cargos que existen, y podrían crearse
nuevos— y la respuesta no depende de cuántos hay, sino de **quién crea uno**.

Si un cargo fuera una fila, `TipoDeCargo` no podría ser un enum de GraphQL: los enums se
fijan al componer el esquema. Eso arrastra que el `<select>` necesite su propia query, que
el catálogo inicial sea siembra en una migración, y sobre todo que **cualquier código que
nombre un cargo necesite un id estable**. Y los va a nombrar: el director firma los
permisos de acampe, y `Alcance` va a mapear cargos a roles (§8.3 de la spec base). Un
cargo con id de `core.nuevoId()` el código no lo puede nombrar; uno con id `'director'` es
un catálogo en código con pasos de más. La spec base ya había apostado lo mismo para los
roles: *"los roles son cargos estatutarios y cambiarlos es una decisión institucional"*.

**Lo que sí es abierto son los equipos** —tesorería, formación, y el que se arme el año que
viene—. A ésos los crea alguien, ningún código los nombra de a uno, y tienen vida propia:
miembros, ámbito, vigencia. Eso es una tabla, en la iteración que los traiga. Que los
cargos sean un catálogo cerrado no lo impide.

Lo que haría cambiar esta decisión es concreto: una pantalla donde alguien de la asociación
cree un cargo **que ningún código necesite conocer**. Ese día conviven las dos cosas, el
catálogo estatutario en código y los cargos libres en tabla; no una reemplaza a la otra.

### 6.2 Los modelos

    export interface Pertenencia extends Marcas {
      readonly id: string
      readonly personaId: string
      readonly grupoId: string
      readonly categoria: Categoria
      /** null si y solo si la categoria es adherente. */
      readonly rama: Rama | null
      /** aaaa-mm-dd. */
      readonly desde: string
      /** aaaa-mm-dd, null si sigue vigente. */
      readonly hasta: string | null
    }

    export interface Cargo extends Marcas {
      readonly id: string
      readonly personaId: string
      readonly grupoId: string
      readonly cargo: TipoDeCargo
      readonly desde: string
      /** aaaa-mm-dd. Puede estar en el futuro: un mandato dura cuatro anios y
       *  su fin se conoce el dia que empieza. */
      readonly hasta: string | null
    }

Las dos tienen la misma forma porque son el mismo tipo de hecho: un vínculo con fecha de
inicio y fecha de fin. **La diferencia está en el `hasta`**, y es la que decide los índices
de §7.3: una pertenencia no tiene mandato, así que su `hasta` se escribe el día de la baja
y nunca está en el futuro; un cargo sí lo tiene, y su `hasta` puede estar en el futuro
desde el momento en que se carga.

`desde` y `hasta` son fecha de calendario en texto, por el mismo argumento que
`fechaDeNacimiento` (§3.4 de la spec de personas): un cargo empieza un día del almanaque,
no en un instante con zona horaria, y guardarlo como `Date` haría que quien asumió el 1 de
marzo figure el 28 de febrero en UTC-3.

Y lo que entra por el alta, derivado igual que `DatosDePersona` (§3.3 de la spec de
personas), porque es lo que hace que agregar un campo más adelante no se olvide en la
mitad de los lugares:

    export type DatosDeCargo =
      Omit<Cargo, 'id' | 'personaId' | 'grupoId' | 'desde' | keyof Marcas>

    export interface DatosDeIngreso {
      readonly grupoId: string
      readonly categoria: Categoria
      readonly rama: Rama | null
      readonly desde: string
      readonly cargos: readonly DatosDeCargo[]
    }

`DatosDeCargo` no lleva `desde`: el del cargo es el de la pertenencia (§9.3). Lo único
propio de cada cargo en el alta es su `hasta`.

    export function estaVigente(
      vinculo: { desde: string; hasta: string | null }, hoy: Date,
    ): boolean

`hoy` entra por parámetro y no se lee del reloj, como `calcularEdad` y `validarPersona`.
Acá no es sólo la regla de portabilidad: **el "hoy" correcto es el de quien mira la
pantalla**, y el servidor no lo sabe. Por eso el servidor no filtra por vigencia y
`Persona.cargos` devuelve todas las filas con sus fechas (§8): manda los hechos, y la
pantalla aplica su propio almanaque. Es la misma decisión que ya está escrita para no
exponer `edad`.

### 6.3 `validarIngreso`

    export function validarIngreso(
      ingreso: DatosDeIngreso, ramasAbiertas: readonly Rama[], hoy: Date,
    ): readonly Problema[]

Pura, acumulativa —no corta en el primer problema—, y atada a su campo, igual que
`validarPersona` (§3.5 de la spec de personas). Las reglas:

- **Rama obligatoria salvo adherente.** Un beneficiario o un activo sin rama es un dato
  incompleto; un adherente con rama es una contradicción, porque el adherente es
  justamente el que no está en ninguna.
- **La rama tiene que estar abierta en ese grupo.** Ésta es la que no se podía verificar
  del lado del servidor antes de §4. Ahora `ramasAbiertas` sale de
  `estructura.obtenerGrupo(grupoId)` en el servicio, y del árbol que la pantalla ya tiene
  en el formulario. Una sola implementación para los dos.
- **`desde` es una fecha de calendario real y no futura.** Se ingresa a un grupo el día
  que se ingresa.
- **El `hasta` de un cargo, si viene, es real y posterior al `desde`.** No se exige que
  esté en el futuro: cargar un mandato que ya venció es válido, es historial.
- **Sin cargos repetidos** en la misma alta.

`validarPersona` **no se toca**: sus reglas, sus tests y su tipo `DatosDePersona` quedan
como están. El ingreso es otro hecho y tiene su propia función.

## 7. Persistencia

### 7.1 Dos tablas nuevas, y `personas` sin tocar

`personas` no cambia. Es consecuencia de guardar la pertenencia aparte, y vale anotarla:
agregarle columnas `NOT NULL` a una tabla con filas obliga a SQLite a reconstruirla
entera, y la migración de esta iteración es dos `CREATE TABLE` y dos índices.

    pertenencias   id, persona_id, grupo_id, categoria, rama NULL,
                   desde, hasta NULL, creado_en, actualizado_en

    cargos         id, persona_id, grupo_id, cargo,
                   desde, hasta NULL, creado_en, actualizado_en

### 7.2 `grupo_id` propio en las dos

En `cargos` podría parecer redundante: el ámbito del cargo es el grupo de la persona, y la
persona ya lo tiene. No lo es, por dos razones. La primera es que **con historial deja de
ser cierto**: alguien que se muda de grupo tiene una pertenencia vieja y una nueva, y el
cargo que tuvo pertenece a una de las dos, no a "la actual". La segunda es que sin la
columna, cerrar una pertenencia cambiaría retroactivamente el ámbito de todos sus cargos.

Cuando lleguen los cargos distritales, diocesanos y de equipo, **la columna que cambia es
ésta**: `grupo_id` se generaliza a `(ambito_tipo, ambito_id)`. Es una migración de una
tabla, sin tocar `pertenencias` ni `personas`.

### 7.3 Los índices, que son donde están las garantías

    UNIQUE (persona_id) WHERE hasta IS NULL          -- en pertenencias
    UNIQUE (persona_id, grupo_id, cargo, desde)      -- en cargos

**El de `pertenencias` es parcial y dice "una persona, un grupo".** SQLite soporta índices
parciales y Drizzle los declara con `.where()`. Es la regla puesta en la base y no en algo
que haya que acordarse de escribir, que es el mismo criterio con el que `ramas_del_grupo`
usa la clave compuesta (§3 de la spec de estructura). Y sigue permitiendo todas las
pertenencias cerradas que haga falta, que es el historial. Funciona **porque una
pertenencia no tiene mandato**: su `hasta` nunca está en el futuro, así que `hasta IS NULL`
y "vigente" son lo mismo.

**El de `cargos` es completo, no parcial, y garantiza menos.** Un cargo puede nacer con su
`hasta` puesto cuatro años adelante, así que `WHERE hasta IS NULL` no seleccionaría los
vigentes y el índice parcial no impediría nada. Lo que este índice ataja es el duplicado
exacto —el doble click en Guardar—, que es el error que de verdad ocurre.

**El solapamiento de períodos entre dos altas distintas no se verifica, y hoy no puede
ocurrir.** Dos filas del mismo cargo con rangos que se pisan SQLite no las puede prohibir
sin un trigger, y un trigger no lo vale. Pero el único camino que escribe en `cargos` es el
alta de una persona nueva, que por definición no tiene cargos previos: lo único que puede
duplicarse es dentro del mismo formulario, y eso lo ataja `validarIngreso` (§6.3). La
verificación contra las filas existentes llega con la mutation que le agrega un cargo a
alguien que ya está cargado, junto con su consumidor. Anotado en §12.

### 7.4 Sin foreign key sobre `grupo_id`

`pertenencias` y `cargos` viven en la misma base SQLite que `grupos`, pero declarar la
foreign key exigiría importar `estructura/servidor/tablas.ts`, que es privado por §4.1. La
integridad la da `obtenerGrupo` en el alta: si el grupo no existe, el ingreso no se guarda.

Es una pérdida real y consciente. La base no impide que una fila apunte a un grupo
borrado, y lo que la protege es una validación de aplicación. Vale la pena porque la
alternativa es que un módulo escriba contra el esquema de otro, que es peor y no tiene
vuelta atrás.

## 8. La API

    enum Categoria    { beneficiario, activo, adherente }
    enum TipoDeCargo  { jefeDeGrupo, subjefeDeGrupo, jefeDeRama, capellan, director }

    type Pertenencia { categoria: Categoria!, rama: Rama, desde: String! }
    type Cargo       { cargo: TipoDeCargo!, desde: String!, hasta: String }

    type Persona {
      ...los datos personales de siempre...
      pertenencia: Pertenencia!
      cargos: [Cargo!]!
    }

    input DatosDeCargo   { cargo: TipoDeCargo!, hasta: String }

    input DatosDeIngreso {
      grupoId: ID!, categoria: Categoria!, rama: Rama,
      desde: String!, cargos: [DatosDeCargo!]!
    }

    query    personas(grupoId: ID!): [Persona!]!
    mutation crearPersona(datos: DatosDePersona!, ingreso: DatosDeIngreso!): Persona!

Los valores de los enums son los ids del dominio, en minúscula y no gritados, por la misma
razón que `Rama` y `TipoDeDocumento`: lo que viaja es el id, y la pantalla saca la etiqueta
del catálogo sin tabla de traducción en el medio.

**`DatosDePersona` no se toca.** Sigue siendo `Omit<Persona, 'id' | keyof Marcas>` sobre
los datos personales. Lo del grupo entra por un segundo argumento porque es otro hecho, y
así el input, sus validaciones y sus tests quedan intactos.

**`Pertenencia` no expone `grupoId`.** La query ya filtra por grupo; devolverlo sería
repetir en cada fila el argumento de la consulta.

**`pertenencia` es no nulo** porque `personas(grupoId)` devuelve, por construcción, gente
con una pertenencia vigente en ese grupo. El día que exista la baja hay que revisarlo: o la
query lo sigue garantizando, o el campo se vuelve nulo.

**La API no publica el historial todavía.** `pertenencia` es la vigente y `cargos` son las
filas de la pertenencia vigente, con sus fechas. Las tablas lo guardan desde hoy; cuando
haya una pantalla que lo pida, los datos ya están. Publicar `pertenencias: [Pertenencia!]!`
sin pantalla sería contrato sin consumidor.

**Errores.** `crearPersona` gana `GRUPO_INEXISTENTE` y reusa `DATOS_INVALIDOS` para los
problemas de `validarIngreso`, con la misma traducción a `GraphQLError` en el resolver que
ya está escrita y por la misma razón: Yoga enmascara todo lo que no sea un `GraphQLError`
(§5.4 de la spec de personas).

## 9. Pantallas

### 9.1 La navegación

La solapa "Personas" desaparece, y con ella `apps/web/src/pantallas/Personas.tsx`,
`apps/mobile/app/personas.tsx`, la query global y su hook. Con una sola solapa el `nav` de
solapas también se va: se borra más de lo que se agrega.

    /                 el arbol: distritos, grupos, ramas         (ya existe)
    /grupos/:id       las personas del grupo, y el alta          (nueva)

Cada grupo del árbol pasa a ser un link. La pantalla del grupo **no estrena una query
`grupo(id)`**: reusa `distritos`, que TanStack Query ya tiene en caché porque venís de ahí,
y de paso trae el distrito para el encabezado. Son quince grupos; el día que el árbol deje
de entrar en una query se agrega `grupo(id)` y se arregla en un solo lugar. En mobile,
`app/grupos/[id].tsx` con expo-router.

### 9.2 La lista

Las personas agrupadas por rama, en el orden de `RAMAS` —de menor a mayor edad, el mismo
criterio que ya usa `ordenarPorCatalogo`—, y los adherentes al final. Dentro de cada rama,
primero los activos y después los beneficiarios, ordenados por apellido con el
`Intl.Collator` que el servicio ya aplica.

Cada persona muestra su nombre, su edad y sus cargos vigentes como etiquetas, filtradas en
el cliente con `estaVigente(cargo, hoy)`. Una rama abierta sin nadie adentro se muestra
vacía y no se esconde, porque es información: el grupo abrió Castores y todavía no
tiene chicos.

### 9.3 El formulario

Los campos personales de hoy, más categoría, rama y cargos. Tres cosas:

- **La rama se deshabilita si la categoría es adherente**, y el `<select>` ofrece **sólo
  las ramas abiertas del grupo**, que la pantalla ya tiene del árbol. Es la misma regla que
  corre el servidor, no una versión aparte.
- **`desde` se propone en hoy y se puede corregir.** Es el caso real: a alguien lo cargás
  en agosto y es jefa de rama desde marzo. Y evita que el servidor tenga que convertir un
  instante a "hoy" sin saber la zona horaria de quien mira.
- **Cargos: un checkbox por cargo, y un `hasta` opcional al lado del que se marque.** El
  `desde` del cargo es el de la pertenencia. Sin edición todavía, si el `hasta` no se
  pudiera cargar acá la columna sería capacidad muerta.

Mobile-first, a 375px: los campos en una columna, `sm:grid-cols-2` sólo agrega, como el
formulario que ya existe.

## 10. Demo

`packages/demo` reparte las personas en grupos. Se amplía la lista de doce, con el mismo
criterio que ya está escrito para los grupos y para las personas: **un demo donde todas las
filas son iguales no muestra si la pantalla aguanta los casos que se rompen.**

- Un grupo cargado de verdad —el 42, que tiene las seis ramas abiertas— con beneficiarios
  y dirigentes en varias ramas, un jefe de grupo, un subjefe, jefes de rama, y un director,
  y un cocinero que es adherente y no tiene ningún cargo del catálogo.
- Un grupo con una sola rama y dos personas.
- Un grupo abierto sin nadie: el 88, que todavía no abrió ninguna rama, así que la pantalla
  tiene que resolver "no hay ramas" y "no hay personas" a la vez.
- Un cargo con `hasta` en el futuro —un mandato de cuatro años— y uno ya vencido, para que
  `estaVigente` tenga los dos casos.

Sigue sembrando por los servicios públicos de cada módulo, no por SQL: los datos del demo
pasan por las mismas validaciones que los reales, que es la propiedad que decide ese
diseño (§6 de la spec de personas).

## 11. Verificación

- `bun run check` —lint, tipos y tests— en verde.
- `bun run schema` y el `schema.gql` commiteado.
- Tests de dominio: `validarIngreso` con cada regla, incluida la rama cerrada en el grupo;
  `estaVigente` en los bordes —el día que empieza, el día que termina, `hasta` nulo.
- Tests de servicio: alta con ingreso, alta con grupo inexistente, alta con grupo cerrado,
  alta con rama no abierta, `personas(grupoId)` devolviendo sólo los del grupo, y que un
  alta con datos inválidos no deje ni la persona ni la pertenencia a medio escribir.
- Test de migraciones del módulo, como los dos que ya existen.
- Test de `enumCompartido`: dos módulos piden el mismo enum y el esquema compone; con
  valores distintos, tira.
- Test del registro: un módulo con `dependencies` recibe los servicios construidos, y el
  orden es el del grafo.
- `bun run demo` y recorrer a mano el árbol, un grupo lleno, uno vacío, y un alta.

## 12. Deuda conocida

1. **No hay baja ni edición.** El historial se puede escribir pero sólo se llena con altas.
   Cambiar a alguien de grupo, hoy, no se puede hacer desde la pantalla.
2. **Nada verifica el solapamiento de cargos entre altas distintas** (§7.3). Hoy no hace
   falta —el alta es el único camino que escribe en `cargos` y la persona es nueva— pero la
   primera mutation que le agregue un cargo a alguien ya cargado tiene que traerla.
3. **No hay foreign key sobre `grupo_id`** (§7.4). Una fila puede quedar apuntando a un
   grupo que no existe si algo salta la validación.
4. **No se puede buscar a una persona sin saber su grupo.** Al borrarse la lista global es
   la única forma de llegar. El reemplazo es un buscador, no una lista de miles.
5. **La spec base decía que `estructura` diría qué cargo ocupa cada uno** (§8.3), y ahora
   lo dice `personas`. Cuando llegue `auth`, `Alcance` se arma consultando a `personas`, y
   la dependencia va a ser `auth` -> `personas` -> `estructura`.
6. **`enumCompartido` empieza a ser un registro global de tipos de GraphQL.** Hoy tiene un
   solo caso y un solo tipo de tipo. Si aparecen tres o cuatro, o si hace falta compartir
   un `objectRef`, conviene revisar si lo que falta no es que el esquema de un módulo pueda
   declarar tipos exportables, en vez de un helper por forma.
7. **Las reglas de edad por rama siguen sin escribirse** (§2), y con la pertenencia ya
   modelada, ahora sí se pueden.

### 12.1 Lo que encontró la revisión de la rama, y se dejó para después

La revisión final de la rama —hecha sobre los 21 commits juntos, que es lo que ninguna
revisión por tarea puede ver— confirmó que el modelo aguanta el dominio y que las garantías
de la base se sostienen. Cuatro cosas se arreglaron antes de integrar. Estas doce quedaron
anotadas, ninguna alcanzable hoy salvo la primera:

1. **El formulario ofrece un default imposible en un grupo sin ramas.** Es el único hallazgo
   alcanzable hoy: el grupo 88 del demo no tiene ninguna rama abierta, así que el `<select>`
   sólo ofrece "—", y Guardar devuelve *"Elegí la rama a la que pertenece"*, un error que no
   se puede satisfacer. El único alta válida ahí es un adherente y nada lo dice. Arreglo de
   una línea en `AltaDePersona.tsx` de las dos apps: arrancar en `adherente` cuando el grupo
   no tiene ramas.
2. **La regla de frontera no cubre el escape por ruta relativa.**
   `import '../../../estructura/src/servidor/tablas'` pasa Biome, el `exports` del
   `package.json` y `tsc`. No es regresión —la regla vieja tenía el mismo agujero— pero §7.4
   dice textualmente que la foreign key sobre `grupo_id` no se declara *porque exigiría
   importar ese archivo privado*, así que el próximo que quiera esa FK tiene el atajo a mano.
   Arreglo: sumar `"**/src/servidor/**"` al mismo grupo de `noRestrictedImports`.
3. **La excepción de `packages/demo` apaga también la regla de portabilidad.** El
   `!packages/demo/**` excluye el override entero, que tiene dos grupos: el de
   `@gps/*/servidor` y el de `node:*` / `bun:*`. La documentación justifica la excepción sólo
   por el primero. Un `import 'node:fs'` en el escenario pasaría el lint, y `composicion.ts`
   importa `@gps/demo/servidor` dinámicamente. Arreglo: partir el override en dos.
4. **El `ingreso` del formulario web no se resincroniza si cambia el grupo.** `useState` con
   inicializador perezoso congela `grupoId`, `rama` y `desde` en el primer montaje. Hoy no es
   alcanzable —la única salida de la pantalla desmonta el componente— y se vuelve alcanzable
   el día que haya un link grupo→grupo o el buscador de §12.4. Arreglo: `key={props.id}`.
   Mobile no lo tiene, por el `<Stack>` de expo-router.
5. **La foreign key de `pertenencias` y `cargos` contra `personas` no tiene test.**
6. **`GrupoInexistente.grupoId` se escribe y nunca se lee.**
7. **Mobile no resuelve el "grupo inexistente" que sí resuelve web.**
8. **Cuatro tests contradicen la regla que el propio archivo escribe.**
9. **Huecos chicos en los tests de `validarIngreso`.**
10. **El `hasta` del cargo del demo caduca en 2028**: ese día el escenario deja de tener un
    cargo vigente y la pantalla del grupo 42 se ve distinta sin que nadie haya tocado nada.
11. **Las excepciones de `docs/arquitectura.md` apuntan a la regla equivocada.**
12. **El test de `aFechaDeCalendario` depende de la zona horaria del entorno**: en un CI con
    `TZ=UTC` pasaría igual con una implementación rota. El arreglo es fijar `TZ` para
    `bun test`, que es decisión de configuración del repo.

## 13. Archivos que se tocan

    biome.json                                         la regla de fronteras
    packages/core/src/module.ts                        Module<S, D>, dependencies tipadas
    packages/core/src/registry.ts                      pasa las dependencias construidas
    packages/core/src/builder.ts                       enumCompartido
    packages/core/src/index.ts                         + enumCompartido

    packages/estructura/src/dominio/publico.ts         nuevo: interface Estructura
    packages/estructura/src/dominio/index.ts           + Estructura
    packages/estructura/src/servidor/servicio.ts       extends Estructura, + obtenerGrupo
    packages/estructura/src/servidor/schema.ts         Rama por enumCompartido

    packages/personas/package.json                     + @gps/estructura
    packages/personas/src/dominio/categorias.ts        nuevo
    packages/personas/src/dominio/cargos.ts            nuevo
    packages/personas/src/dominio/vinculos.ts          nuevo: Pertenencia, Cargo, estaVigente
    packages/personas/src/dominio/validaciones.ts      + validarIngreso
    packages/personas/src/dominio/index.ts             + lo nuevo
    packages/personas/src/servidor/tablas.ts           + pertenencias, cargos
    packages/personas/src/servidor/servicio.ts         crearPersona(datos, ingreso), lista por grupo
    packages/personas/src/servidor/schema.ts           tipos nuevos, query con grupoId
    packages/personas/src/servidor/index.ts            Module<S, { estructura: Estructura }>
    packages/personas/migraciones/0001_*.sql           nueva

    packages/demo/src/servidor/escenario.ts            personas repartidas en grupos

    packages/api/src/queries/personas.graphql          + grupoId
    packages/api/src/queries/crearPersona.graphql      + ingreso
    packages/api/src/personas.ts                       hooks
    packages/api/src/index.ts                          se va el hook de la lista global

    apps/web/src/App.tsx                               ruta /grupos/:id, se va el nav
    apps/web/src/pantallas/Grupo.tsx                   nueva
    apps/web/src/pantallas/Estructura.tsx              grupos clickeables
    apps/web/src/pantallas/Personas.tsx                se borra
    apps/mobile/app/grupos/[id].tsx                    nueva
    apps/mobile/app/index.tsx                          grupos clickeables
    apps/mobile/app/personas.tsx                       se borra

    schema.gql                                         regenerado
    CLAUDE.md, docs/arquitectura.md                    la regla de fronteras nueva
