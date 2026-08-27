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
3. Escribir el dominio en `src/dominio/`: modelos, validaciones, reglas puras.
4. Escribir el servicio, el esquema y el módulo en `src/servidor/`.
5. Declarar las dependencias en `dependencies` del objeto `Module`.
6. Si el módulo tiene tablas: declararlas en `src/servidor/tablas.ts`, generar la
   migración con `bunx drizzle-kit generate --name <nombre>` parado en el paquete, y
   sumarla a `src/servidor/migraciones.ts`.
7. Agregarlo a la lista de `services/backend/src/modules.ts`.
8. `bun run schema` y commitear el `schema.gql` resultante.

`modules.ts` es el único archivo central que hay que tocar. El `Dockerfile` no:
copia los `package.json` con `COPY --parents packages/*/package.json` (necesita el
frontend `1-labs`), justamente para que un paquete nuevo no lo obligue a nadie a
acordarse. Si alguna vez se vuelve a una lista explícita de `COPY`, este paso vuelve a
la receta.

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

**Fronteras de imports.** `apps/**` no puede importar `*/servidor`. Los módulos no se
importan entre sí: se comunican por el contexto (`ctx.sistema`, `ctx.personas`). Lo
impone Biome, con dos aclaraciones: `@gps/core` sí se puede importar —es la plomería,
no un módulo— y `packages/demo` está exceptuado, porque conocer a los otros módulos
para sembrarlos es literalmente su razón de ser.

**Mobile-first.** Todo se diseña primero a 375px. `sm:` y `md:` sólo agregan en
pantallas grandes, nunca arreglan lo que se rompió en chicas.

**Autorización** (cuando exista `auth`). Tres capas: acceso al módulo declarado en
`accesoAlModulo`, filtrado por `Alcance` como **primer parámetro obligatorio** de todo
método de repositorio, y políticas por campo en `src/dominio/politicas.ts`. Las
políticas son funciones puras y las usan el servidor y las pantallas. Estas
convenciones están documentadas pero no implementadas todavía: no hay `auth`, ni
`Alcance` real, ni `politicas.ts` en ningún módulo existente.

## Qué NO existe todavía

Auth, `Alcance` real, `politicas.ts`, rate limiting, bus de eventos, auditoría,
archivos, `packages/local`, base en el dispositivo. Cada uno tiene su diseño en la
spec y llega con su primer consumidor real. No agregarlos por adelantado.

La base es SQLite por Drizzle y llega a los módulos por `Core.bd`; las migraciones las
declara cada módulo y las aplica `aplicarMigraciones` al arrancar. Sigue sin haber
Postgres, ni pool, ni réplicas.
