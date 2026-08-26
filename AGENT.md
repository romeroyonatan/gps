# GPS — Referencia para agentes

CRM para gestionar los scouts de la asociación. Diseño completo en
`docs/superpowers/specs/2026-08-24-arquitectura-y-walking-skeleton-design.md`.
Mapa de piezas en `docs/arquitectura.md`. Tutorial en prosa en `docs/crear-un-modulo.md`.

## Vocabulario: módulo ≠ plugin

- **Módulo**: una unidad de negocio nuestra (Personas, Afiliación, `sistema`).
  Interfaz `Module`, registrados en `services/backend/src/modules.ts`.
- **Plugin**: reservado para los interceptores del pipeline de GraphQL de envelop.
  Todavía no hay ninguno.

## Comandos

    bun install                 instalar
    bun run dev                 la app entera en :3000 — web y API en un solo
                                proceso, con recarga en caliente
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
6. Agregarlo a la lista de `services/backend/src/modules.ts`.
7. `bun run schema` y commitear el `schema.gql` resultante.

No hay ningún otro archivo central que tocar.

## Reglas obligatorias

**Idioma.** El idioma lo decide el dominio, no la capa. Español para lo que nombra
el escultismo y las reglas de negocio (`Persona`, `calcularCuotaDelGrupo`, campos
GraphQL, comentarios, nombres de tests). Inglés para el vocabulario técnico de
industria (`module`, `core`, `index`, `server`, `context`, `config`, `logger`,
`schema`, `repository`, `cache`, `query`) y para los archivos canónicos
(`README.md`, `schema.gql`, `package.json`, `Dockerfile`).

**Portabilidad.** El código bajo `src/servidor/` de un módulo nunca importa `bun:*`
ni `node:*`, ni lee archivos, ni consulta la hora del sistema. Todo pasa por `Core`.
Lo impone Biome. Si la regla molesta, la solución es pasar el dato por `Core`, nunca
desactivarla. Es lo que va a permitir correr los módulos dentro del teléfono.

**Fronteras de imports.** `apps/**` no puede importar `*/servidor`. Los módulos no se
importan entre sí: se comunican por el contexto (`ctx.sistema`, `ctx.personas`). Lo
impone Biome.

**Mobile-first.** Todo se diseña primero a 375px. `sm:` y `md:` sólo agregan en
pantallas grandes, nunca arreglan lo que se rompió en chicas.

**Autorización** (cuando exista `auth`). Tres capas: acceso al módulo declarado en
`accesoAlModulo`, filtrado por `Alcance` como **primer parámetro obligatorio** de todo
método de repositorio, y políticas por campo en `src/dominio/politicas.ts`. Las
políticas son funciones puras y las usan el servidor y las pantallas. Estas
convenciones están documentadas pero no implementadas todavía: no hay `auth`, ni
`Alcance` real, ni `politicas.ts` en ningún módulo existente.

## Qué NO existe todavía

Base de datos, migraciones, auth, rate limiting, bus de eventos, auditoría, archivos,
modo demo. Cada uno tiene su diseño en la spec y llega con su primer consumidor real.
No agregarlos por adelantado.
