# GPS

_Gestión para Scouts._ CRM para gestionar los scouts de la asociación.

**Estado: prototipo.** No opera con datos reales. Los cinco requisitos para que eso
cambie están en §1 de la spec de arquitectura.

## Levantarlo

Requiere [Bun](https://bun.sh).

    curl -fsSL https://bun.sh/install | bash
    bun install
    bun run dev                  # todo en http://localhost:3000

O todo junto en un contenedor:

    docker compose up            # http://localhost:3000

Para la app mobile hace falta Expo Go o un simulador:

    bun run --filter mobile dev

## Verificar

    bun run check                # lint, tipos y tests

## Documentación

- `docs/arquitectura.md` — el mapa de las piezas y cómo se comunican. Empezá por acá.
- `docs/crear-un-modulo.md` — tutorial para agregar un módulo.
- `AGENT.md` — referencia densa de reglas y comandos.
- `docs/superpowers/specs/` — el diseño y por qué cada decisión es como es.
