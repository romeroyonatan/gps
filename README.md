# GPS

_Gestión para Scouts._ CRM para gestionar los scouts de la asociación.

**Estado: prototipo.** No opera con datos reales. Los cinco requisitos para que eso
cambie están en §1 de la spec de arquitectura.

## Levantarlo

Requiere [Bun 1.4.2](https://bun.sh).

    curl -fsSL https://bun.sh/install | bash -s "bun-v1.4.2"
    bun install
    bun run dev                  # todo en http://localhost:3000

O todo junto en un contenedor:

    docker compose up            # http://localhost:3000

La app mobile se corre con un *development build*, no con Expo Go: Expo Go se
quedó en el SDK 54 y el proyecto usa el 57. Con el backend levantado aparte:

**iOS** — requiere Xcode y CocoaPods.

    brew install cocoapods
    cd apps/mobile
    bunx expo install expo-dev-client
    bunx expo run:ios

**Android** — requiere Android Studio con un emulador creado.

    cd apps/mobile
    bunx expo install expo-dev-client
    bunx expo run:android

La primera vez, `run:*` genera el proyecto nativo con `expo prebuild`, lo
compila y lo deja corriendo contra Metro. Después reusa `apps/mobile/ios/` y
`apps/mobile/android/`, que no se versionan porque son artefactos de build.

Cambiar sólo TypeScript o JavaScript **no** necesita recompilar: alcanza con
levantar Metro.

    cd apps/mobile && bunx expo start

Va directo y no por `bun run --filter mobile dev` porque el filtro se come el
TTY y Metro pierde el menú interactivo.

Hay que volver a correr `run:*` sólo en tres casos: instalar o actualizar una
librería con código nativo, cambiar `app.json`, o subir de versión el SDK de
Expo.

En un dispositivo físico `localhost` es el dispositivo, no la máquina: hay que
apuntar la API a la IP de la red local.

    EXPO_PUBLIC_API_URL=http://192.168.1.81:3000/graphql bunx expo run:ios --device

## Verificar

    bun run check                # lint, tipos y tests

## Documentación

- `docs/arquitectura.md` — el mapa de las piezas y cómo se comunican. Empezá por acá.
- `docs/crear-un-modulo.md` — tutorial para agregar un módulo.
- `AGENT.md` — referencia densa de reglas y comandos.
- `docs/superpowers/specs/` — el diseño y por qué cada decisión es como es.
