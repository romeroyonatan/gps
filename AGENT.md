# GPS — Referencia para agentes

CRM para gestionar los scouts de la asociación. Diseño completo en
`docs/superpowers/specs/2026-08-24-arquitectura-y-walking-skeleton-design.md`.
Mapa de piezas en `docs/arquitectura.md`. Tutorial en prosa en `docs/crear-un-modulo.md`.

## Vocabulario: módulo ≠ plugin

- **Módulo**: una unidad de negocio nuestra (`sistema`, `estructura`).
  Interfaz `Module`, registrados en `services/backend/src/modules.ts`.
- **Plugin**: reservado para los interceptores del pipeline de GraphQL de envelop.
  Todavía no hay ninguno.

## Comandos

    bun install                 instalar
    bun run dev                 la app entera en :3000 — web y API en un solo
                                proceso, con recarga en caliente
    bun run demo                la app con datos de ejemplo, base en memoria
    bun run --filter mobile dev Expo
    bun run check               lint + tipos + tests
    bun run schema               regenerar schema.gql
    bun run --filter @gps/api codegen   regenerar tipos del cliente
    docker compose up           todo junto en :3000

## Cómo crear un módulo nuevo

1. Copiar `packages/sistema/` a `packages/<nombre>/`.
2. Cambiar `name` en el `package.json` a `@gps/<nombre>`.
3. Escribir el dominio en `src/dominio/`: modelos, validaciones y decisiones puras con
   nombres del negocio. Si una regla puede decidir sólo con datos recibidos por parámetro,
   vive acá aunque hoy la invoque únicamente el servidor.
4. Escribir en `src/servidor/` la orquestación de efectos, persistencia, esquema y módulo.
   `servicio.ts` declara el contrato y compone las operaciones: no es el destino automático
   de todas las reglas. Separar casos de uso cohesivos o consultas cuando mejora la lectura,
   pero no crear un archivo, una interfaz o un repository por cada método corto.
5. Si otro módulo va a necesitar algo de éste, declararlo en `src/dominio/publico.ts` —
   sólo eso, no la interfaz entera del servicio.
6. Declarar `accesoAlModulo` en `src/dominio/politicas.ts` y pasarlo al objeto `Module`.
   Es obligatorio: el módulo no compila sin decidir quién lo alcanza, y la decisión por
   omisión es `denegado`. `publico` es sólo para lo que tiene que funcionar sin sesión.
7. Declarar las dependencias en `dependencies` del objeto `Module`. `Module<S, D>` tipa
   `dependencies` contra las claves de `D`: un nombre que no esté ahí no compila. Los
   servicios ya construidos de esas dependencias llegan por el segundo parámetro de
   `createServices(core, dependencias)`, no por el contexto.
8. Si el módulo tiene tablas: declararlas en `src/servidor/tablas.ts`, generar la
   migración con `bunx drizzle-kit generate --name <nombre>` parado en el paquete, y
   sumarla a `src/servidor/migraciones.ts`.
9. Agregarlo a la lista de `services/backend/src/modules.ts`.
10. `bun run schema` y commitear el `schema.gql` resultante.

`modules.ts` es el único archivo central que hay que tocar. El `Dockerfile` no:
copia los `package.json` con `COPY --parents packages/*/package.json` (necesita el
frontend `1-labs`), justamente para que un paquete nuevo no lo obligue a nadie a
acordarse. Si alguna vez se vuelve a una lista explícita de `COPY`, este paso vuelve a
la receta.

Ejemplo del final de la cadena: `salidas` —el permiso de salida— depende de `personas`,
`estructura` y `archivos`. Su `/dominio` decide con parámetros (quiénes son los tres
firmantes, qué candidatos hay según las unidades elegidas, qué mensaje se sella) y las
pantallas usan esas mismas funciones; su `/servidor` se parte por caso de uso
(`borradores.ts`, `emision.ts`, `firmas.ts`, `pdf.ts`, `consultas.ts`) y `servicio.ts` es
sólo contrato y composición. El PDF se queda en `/servidor` aunque `pdf-lib` sea isomorfo:
`/dominio` lo importa el navegador, y un import de valor entraría al bundle de mobile.

`archivos`, en cambio, **no se parte**: solicitar, confirmar y descargar son orquestación de
efectos sin decisión separable, y quedan en su `servicio.ts`. Es el otro lado de la misma
regla.

Ejemplo real: `afiliacion` depende de `personas` y de `estructura`
(`dependencies: ['personas', 'estructura']`), las dos por lectura nada más —no escribe
ni una persona ni un grupo—. La selección de sus nóminas declarables es una regla pura en
`src/dominio/nominas.ts`; `src/servidor/declaraciones.ts` obtiene los datos y persiste la
foto, y `src/servidor/servicio.ts` compone esas operaciones con las consultas. No todo
hecho de negocio necesita tabla: su calendario (el día de corte del período, las fechas
ordinarias) es un catálogo en `src/dominio/config.ts`, no una tabla, porque cambia
poquísimo y no hace falta consultarlo. También arma la nómina del grupo para bajar:
`src/dominio/nomina.ts` decide qué filas salen y en qué orden, y `src/servidor/pdf.ts`
y `src/servidor/xlsx.ts` sólo la dibujan —`.xlsx` es un ZIP con cinco XML, así que se
escribe a mano en vez de sumar una librería de planillas—. La sirven
`/grupos/:id/nomina.pdf` y `/grupos/:id/nomina.xlsx`, con la política de `personas` y
no la suya: verla es ver el padrón.

## Reglas obligatorias

**Idioma.** El idioma lo decide el dominio, no la capa. Español para lo que nombra
el escultismo y las reglas de negocio (`Persona`, `calcularCuotaDelGrupo`, campos
GraphQL, comentarios, nombres de tests). Inglés para el vocabulario técnico de
industria (`module`, `core`, `index`, `server`, `context`, `config`, `logger`,
`schema`, `repository`, `cache`, `query`) y para los archivos canónicos
(`README.md`, `schema.gql`, `package.json`, `Dockerfile`).

**Portabilidad.** El código bajo `src/` de un módulo (no sólo `src/servidor/`: también
`/dominio`, que se importa desde el navegador) nunca importa `bun:*` ni `node:*`, ni lee
archivos. El código bajo `src/servidor/` además nunca consulta la hora del sistema ni
genera ids al azar. Todo pasa por `Core`. Lo impone Biome por dos vías:
`noRestrictedImports` para los imports, con alcance a todo `src/`, y el plugin
`biome-plugins/portabilidad.grit`, acotado a `src/servidor/`, para lo que no es un
import (`new Date()`, `Date.now()`, `crypto.randomUUID()`) — un `new Date()` suelto pasa
cualquier regla de imports. El plugin sólo prohíbe lo que tiene reemplazo en `Core`: el
reloj es `core.reloj.ahora()` y los ids son `core.nuevoId(prefijo)`. En los tests, los
relojes falsos se fijan en epoch 1970 para que cualquier hora del sistema colada se
distinga de un vistazo en vez de parecer plausible. Si la regla de portabilidad molesta,
la solución es pasar el dato por `Core`, nunca desactivarla. Es lo que va a permitir
correr los módulos dentro del teléfono.

**Fronteras de imports.** `apps/**` no puede importar `*/servidor`. Los módulos tampoco:
el `/servidor` de un módulo es privado —tiene estado y es la implementación— y se llega a
él por el contexto (`ctx.sistema`, `ctx.personas`) o por las dependencias que
`createServices` recibe ya construidas. El `/dominio`, en cambio, **sí** se puede importar
entre módulos: es puro, isomorfo y sin estado, y las apps ya lo importan de todos. Lo que
un módulo le ofrece a los demás se declara en `src/dominio/publico.ts`, y es
deliberadamente más chico que su servicio: es la idea de los *package interfaces* de SAP y
del modificador `global` de Salesforce, y la mitad que importa es que el resto queda
privado. Lo impone Biome, con dos aclaraciones: `@gps/core` es la plomería y no un módulo,
y `packages/demo` está exceptuado incluso para `/servidor`, porque conocer a los otros
módulos para sembrarlos es literalmente su razón de ser.

**`@gps/core` tiene tres puertas, no una.** El índice (`@gps/core`) es plomería de
servidor: `Config`, `Core`, `Module`, `Migracion`, `aplicarMigraciones`,
`ordenarModulos`, `crearServicios`. `@gps/core/graphql` es lo único que depende de
Pothos: `crearBuilder` y `enumCompartido`. `@gps/core/fechas` es lo isomorfo —hoy sólo
`aFechaDeCalendario`—, la única de las tres que un `/dominio` o una app pueden importar.
Están separadas porque el índice arrastra `@pothos/core` (vía `builder.ts`) y
`drizzle-orm` (vía `migraciones.ts`) con imports **de valor**, y las apps importan
`aFechaDeCalendario`: un import de tipo no pesa porque TypeScript lo borra al compilar,
pero uno de valor no se borra, y Metro no hace tree-shaking, así que en mobile entrarían
seguro. Una función isomorfa nueva va a `@gps/core/fechas` o a un subpath propio —nunca
al índice.

**Mobile-first.** Todo se diseña primero a 375px. `sm:` y `md:` sólo agregan en
pantallas grandes, nunca arreglan lo que se rompió en chicas.

**Autorización.** Tres capas, y las tres están implementadas:

1. **Acceso al módulo.** Cada `Module` declara `accesoAlModulo` —es un campo
   obligatorio de la interfaz, así que un módulo nuevo no compila sin decidirlo— y
   `componerEsquema` se lo cuelga a cada campo raíz que ese módulo registra. Un campo
   raíz sin módulo dueño aborta el arranque en vez de quedar publicado abierto.
2. **Alcance.** `Alcance` es el **primer parámetro obligatorio** de todo camino de
   consulta o escritura iniciado por un usuario. La excepción declarada es el directorio
   de la asociación —el árbol de distritos y grupos, y quién conduce cada grupo—, que
   ve cualquiera con sesión: saber que un grupo existe no es un dato de ese grupo. Sus
   datos —gente, cuenta corriente, salidas— sí van por alcance. Lleva adentro al `Actor`, porque las
   dos preguntas viajan siempre juntas: qué filas se ven y qué puede hacer quien
   pregunta. Los caminos internos —el barrido de Afiliación, el suscriptor de
   Tesorería— no lo reciben y no son alcanzables desde GraphQL.
3. **Políticas por operación y campo** en `src/dominio/politicas.ts`. Son funciones
   puras sobre `Actor` o `Alcance`, las aplica el servidor y las usan las pantallas
   para no ofrecer lo que después se va a rechazar. La interfaz nunca es la barrera.

Alcanzar un grupo **no** es verlo por dentro, y las dos capas del medio son distintas a
propósito. El comisionado tiene los grupos de su distrito en `gruposVisibles` porque
necesita leer los permisos de salida que firma; el padrón de esos grupos no lo ve, y su
cuenta corriente tampoco. Cuando escribas una política de lectura, preguntate cuál de
las dos cosas estás decidiendo: `alcance.gruposVisibles.includes(...)` responde "¿lo
alcanza?", y `tieneRol(alcance.actor, ...)` responde "¿es suyo?".

Un campo denegado **no puede** ser no-nulable en GraphQL: uno que lanza se lleva puesta
la respuesta entera, así que una consulta que mezcla campos de distinto permiso pierde
también lo que sí podía ver. Un campo que se deniega por función se declara nullable y
devuelve `null` —ver `deudasPendientes`—; las escrituras sí lanzan.

`alcanceSinLimites()` existe para la siembra del demo y los tests que no prueban
autorización. No sale de ahí: el alcance de un request se construye siempre con
`estructura.expandirAlcance` a partir del actor real.

## Autenticación

La identidad interna es una `Persona`: no hay tabla de usuarios ni contraseñas. Se
entra con Google o Apple —Authorization Code con PKCE, `state` y `nonce`, validado con
JOSE— y en entorno demo con un proveedor interno de un clic, que recorre exactamente el
mismo camino. Una persona puede tener varias identidades externas; los correos no se
usan para correlacionar nada.

La sesión es un secreto opaco de 30 días, revocable, del que el servidor guarda sólo el
hash. Los roles **nunca** viajan adentro: se reconstruyen en cada request desde los
cargos y equipos vigentes, y por eso una remoción quita acceso en el pedido siguiente.
Web la lleva en una cookie `HttpOnly`; mobile en `expo-secure-store`, nunca en
AsyncStorage, y la manda como bearer. No hay refresh token: no hace falta, porque cada
request ya consulta la base y `revocarSesion` corta al instante. Lo que sí falta es un
corte por inactividad.

El acceso se activa con un enlace de un solo uso que se comparte a mano, vence a los
siete días y se puede revocar; la pantalla muestra a quién le da acceso antes de
confirmar. Recuperar es lo mismo pero reemplazando una identidad perdida: desactiva la
anterior, vincula la nueva y revoca todas las sesiones, en una transacción.

Hay una única persona administradora designada. Su sesión normal no es global: para
tener alcance global tiene que **reautenticarse** con una identidad ya vinculada, y esa
elevación dura diez minutos, vive en la sesión y se audita entera. Transferir la
administración exige elevación; si la única administradora pierde sus identidades,
`bun run admin asignar --persona <id>` la reemplaza desde el servidor, y no hay mutation
equivalente a propósito.

Los equipos —Secretaría de grupo, Administración diocesana, Tesorería diocesana— son
hechos de `personas`, igual que los cargos, con vigencia y revocación instantánea. No
son roles que alguien asigne a mano en auth.

## Qué NO existe todavía

Rate limiting, corte de sesión por inactividad, firma con certificado, `packages/local`,
base en el dispositivo. Cada uno tiene su diseño en la spec y llega con su primer
consumidor real. No agregarlos por adelantado.

El bus de eventos ya existe en `Core`: es en proceso, sincrónico y tipado. Afiliación
emite `AfiliacionDeclarada` después de guardar la foto y Tesorería intenta generar el
cargo sin bloquear la declaración; si falla o falta la cuota, la reconciliación manual
recupera la deuda pendiente.

Tampoco hay baja ni edición de personas (las columnas `hasta` existen y el historial se
puede escribir, pero por ahora sólo se llena con altas), ni forma de buscar una persona
sin saber su grupo (la única consulta es `personas(grupoId: ID!)`). Los cargos **sí**
tienen ámbito: `grupo`, `distrito` y `diocesis`, con comisionado de distrito y jefe
scout diocesano. Un cargo distrital no aparece en ninguna pantalla todavía:
`listarPersonas` filtra los cargos por el grupo, así que el comisionado sólo se ve como
firmante de un permiso.

Los equipos **sí** existen —Secretaría, Administración diocesana y Tesorería diocesana—
y la pantalla de plantel de un grupo administra su jefatura y su Secretaría. Los equipos
diocesanos no tienen pantalla todavía: se administran con las mismas mutations
(`integrarEquipo`, `revocarIntegranteDeEquipo`) desde la API.

**Firma con certificado** (PAdES) no existe: hoy la firma en la app es el dibujo, sellado con
HMAC sobre el hash del PDF, los trazos, el cargo, la persona y la fecha. Cada firma guarda
con qué clave se selló, así que rotar es agregar una clave nueva y apuntar
`CLAVE_DE_SELLO_ACTIVA` a ella; las viejas se quedan para verificar. Retirar una clave exige
re-sellar verificando primero —nunca a ciegas, eso lavaría una firma adulterada— y eso no
está construido. Si una clave se filtra, las firmas selladas con ella dejan de probar nada:
se anula y se re-emite el permiso.

La firma en la app sí exige identidad: la registra quien ocupa el cargo firmante vigente
en el ámbito del permiso, y ni siquiera la elevación firma por otro —sería falsificar una
firma, y es la única política donde `estaElevado` no alcanza—.

La firma en papel **no se verifica**: quien sube el escaneo declara qué cargos lo firmaron.
El respaldo es el escaneo, que va como página anexa del PDF. Registrar quién lo declaró
sigue pendiente.

Tampoco hay forma de abrir o cerrar una unidad desde las pantallas: el servicio de
`estructura` las tiene (`abrirUnidad`, `cerrarUnidad`) y el demo las usa, pero ninguna
mutation las expone. Llega con la pantalla que las necesite. Y una unidad no se puede
renombrar, así que los nombres por defecto que dejó la migración —"Tropa scout" a secas—
sólo se corrigen sembrando de nuevo.

Deuda conocida: **cerrar un grupo no cierra las pertenencias de su gente.** `estructura`
no puede hacerlo porque la dependencia va al revés —no conoce a `personas`—, y ningún
otro módulo lo hace tampoco. `afiliacion` la esquiva filtrando por `gruposAbiertosEn` al
declarar, pero `listarPersonas` de un grupo cerrado sigue devolviendo gente.

También queda, de deuda de paridad: la pantalla `Grupo` de mobile no tiene el estado "no
hay ningún grupo abierto con esa dirección" que sí tiene la de web
(`apps/web/src/pantallas/Grupo.tsx`). Quedó a la vista al construir las pantallas de
afiliación y no se resolvió ahí.

La base es SQLite por Drizzle y llega a los módulos por `Core.bd`; las migraciones las
declara cada módulo y las aplica `aplicarMigraciones` al arrancar. Sigue sin haber
Postgres, ni pool, ni réplicas.
