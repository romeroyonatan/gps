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
6. Declarar las dependencias en `dependencies` del objeto `Module`. `Module<S, D>` tipa
   `dependencies` contra las claves de `D`: un nombre que no esté ahí no compila. Los
   servicios ya construidos de esas dependencias llegan por el segundo parámetro de
   `createServices(core, dependencias)`, no por el contexto.
7. Si el módulo tiene tablas: declararlas en `src/servidor/tablas.ts`, generar la
   migración con `bunx drizzle-kit generate --name <nombre>` parado en el paquete, y
   sumarla a `src/servidor/migraciones.ts`.
8. Agregarlo a la lista de `services/backend/src/modules.ts`.
9. `bun run schema` y commitear el `schema.gql` resultante.

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
poquísimo y no hace falta consultarlo.

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

**Autorización** (cuando exista `auth`). Tres capas: acceso al módulo declarado en
`accesoAlModulo`, filtrado por `Alcance` como **primer parámetro obligatorio** de todo
método de repositorio, y políticas por campo en `src/dominio/politicas.ts`. Las
políticas son funciones puras y las usan el servidor y las pantallas. Estas
convenciones están documentadas pero no implementadas todavía: no hay `auth`, ni
`Alcance` real, ni `politicas.ts` en ningún módulo existente.

## Qué NO existe todavía

Auth, `Alcance` real, `politicas.ts`, rate limiting, auditoría,
`packages/local`, base en el dispositivo. Cada uno tiene su diseño en la spec y llega
con su primer consumidor real. No agregarlos por adelantado.

El bus de eventos ya existe en `Core`: es en proceso, sincrónico y tipado. Afiliación
emite `AfiliacionDeclarada` después de guardar la foto y Tesorería intenta generar el
cargo sin bloquear la declaración; si falla o falta la cuota, la reconciliación manual
recupera la deuda pendiente.

Tampoco hay baja ni edición de personas (las columnas `hasta` existen y el historial se
puede escribir, pero por ahora sólo se llena con altas), ni cargos de equipo, ni equipos, ni
forma de buscar una persona sin saber su grupo (la única consulta es
`personas(grupoId: ID!)`). Los cargos **sí** tienen ámbito: `grupo`, `distrito` y
`diocesis`, con comisionado de distrito y jefe scout diocesano. Un cargo distrital no
aparece en ninguna pantalla todavía: `listarPersonas` filtra los cargos por el grupo, así
que el comisionado sólo se ve como firmante de un permiso.

**Firma con certificado** (PAdES) tampoco: hoy la firma en la app es el dibujo, sellado con
HMAC sobre el hash del PDF, los trazos, el cargo, la persona y la fecha. Cada firma guarda
con qué clave se selló, así que rotar es agregar una clave nueva y apuntar
`CLAVE_DE_SELLO_ACTIVA` a ella; las viejas se quedan para verificar. Retirar una clave exige
re-sellar verificando primero —nunca a ciegas, eso lavaría una firma adulterada— y eso no
está construido. Si una clave se filtra, las firmas selladas con ella dejan de probar nada:
se anula y se re-emite el permiso.

La firma en papel **no se verifica**: quien sube el escaneo declara qué cargos lo firmaron.
El respaldo es el escaneo, que va como página anexa del PDF. Con `auth` se registra además
quién lo declaró.

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
