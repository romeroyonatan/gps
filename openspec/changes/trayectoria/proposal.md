## Why

De un chico que está hace seis años en el grupo, el sistema sabe hoy una sola cosa: en qué
unidad está. No sabe que estuvo en la Seisena blanca, que pasó a la Patrulla Águila, ni
cuándo tomó su promesa o su segunda clase. Eso vive en los libros de cada grupo y se pierde
cuando cambia la jefatura. Además, la promesa scout se hace una vez en la vida: si no queda
escrita, el grupo al que el chico se muda no tiene cómo saber que ya la tomó.

## What Changes

- **Subunidades** en `estructura`: la Seisena de la Manada, la Patrulla de la Tropa, el
  Equipo del Clan. `RAMAS` declara cómo se llama la subunidad de cada rama, como ya declara
  la unidad. Se abren y se cierran como las unidades, y las administran la jefatura y la
  Secretaría del grupo.
- **Módulo nuevo `trayectoria`**, opcional y al final de la cadena: depende de `personas` y
  `estructura` por lectura, y nadie depende de él.
  - **Tramos** `(persona, unidad, subunidad?, desde, hasta?)`: en qué patrulla estuvo y
    desde cuándo. La subunidad es opcional, para poder registrar un período de una unidad
    vieja del que no se sabe la patrulla.
  - **Hitos** de progresión, de un catálogo por rama: uniforme, promesa, estrellas, clases.
    Cada hito se toma una sola vez en la vida, y el catálogo dice en qué ramas se puede
    tomar: por eso la promesa scout la puede tomar un scout, un raider o alguien que entró
    de grande, pero una sola vez.
  - **Insignias** —aptitudes, especialidades, jalones—: de cero a muchas, con nombre libre
    hasta que lleguen los reglamentos.
  - Las fechas admiten precisión parcial (`2019`, `2019-06`, `2019-06-30`), porque la
    historia vieja se carga de memoria y de los libros.
- **Las fechas y los datos viejos no se validan contra el padrón**: un tramo puede no
  coincidir con las pertenencias. Es un registro, no una restricción.
- `personas` publica `PasesRegistrados` después de un pase, y `trayectoria` cierra con eso
  la patrulla de quien pasó: la patrulla cambia con el pase.
- **Pantallas**: la trayectoria completa de una persona en
  `/grupos/:id/personas/:personaId/trayectoria`, con su resumen en la ficha; y la unidad en
  `/grupos/:id/unidades/:unidadId`, donde se abren las patrullas y se reparte a los chicos.

## Capabilities

### New Capabilities

- `trayectoria`: la historia de una persona en el grupo —sus tramos en unidades y
  subunidades, sus hitos de progresión y sus insignias—.

### Modified Capabilities

- `unidades`: las unidades se subdividen en subunidades, que se abren y se cierran.

## Impact

- `packages/estructura`: `RAMAS` suma la subunidad de cada rama, tabla `subunidades`,
  migración, servicio, esquema GraphQL, `publico.ts` y `politicas.ts` (nueva, con la misma
  regla de jefatura y Secretaría que `personas`, escrita acá para no armar un ciclo entre
  los dos paquetes).
- `packages/personas`: evento `PasesRegistrados` declarado en `dominio/publico.ts` y
  publicado después del commit del pase.
- `packages/trayectoria`: módulo nuevo, con sus catálogos, sus tablas y su esquema.
- `packages/demo`: patrullas y una historia sembrada, con fechas parciales incluidas.
- `apps/web` y `apps/mobile`: pantalla de trayectoria, resumen en la ficha, pantalla de
  unidad.
- `schema.gql`, `services/backend/src/modules.ts`, `docs/arquitectura.md` y `CLAUDE.md`.
- Depende de `pase-de-unidad`: sin el pase, los tramos de unidad no tienen de dónde salir y
  no hay evento que cierre la patrulla.
