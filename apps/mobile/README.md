# GPS en el teléfono

La misma app que `apps/web`, con React Native y Expo. Lo que comparten las dos
apps son los `/dominio` de los módulos —las reglas puras— y **no** la interfaz:
React DOM y React Native no dibujan con las mismas etiquetas. La paridad se
copia a mano, y cuando se rompe hay que decirlo.

    bun run --filter mobile dev     Expo
    bun run check                   lint + tipos + tests (corre todo el repo)

## Dónde está cada cosa

| Carpeta | Qué hay |
| --- | --- |
| `app/` | Las rutas. Es expo-router: el archivo **es** la dirección. `app/_layout.tsx` es la cáscara —sesión, rol activo, menú de abajo—. |
| `src/ui.tsx` | **Las piezas de interfaz.** Mirá acá antes de escribir markup. |
| `src/` (el resto) | La cáscara: ingreso, sesión, rol activo, barras, iconos, colores de rama. La barra de abajo tiene cinco destinos —Principal, Nómina, Salidas, Tesorería y Más—; Plantel y Auditoría viven en `app/grupos/[id]/mas.tsx`. |
| `componentes/` | Lo que es demasiado grande para una pieza y se usa desde una pantalla sola o dos: el alta de persona y el pad de firma. |

## Las piezas: `src/ui.tsx`

Es el gemelo de `apps/web/src/ui.tsx`: los mismos nombres, los mismos tokens y
las mismas decisiones, con `View`/`Text` en vez de `div`/`p`. No es una librería
de propósito general.

| Pieza | Qué es |
| --- | --- |
| `CAMPO` | Clases del input: borde, alto de 48px, deshabilitado. Va en el `className` de un `TextInput`. |
| `FILA` | Fila de lista de 56px. Las de 72px, con dos líneas de dato, las escribe cada pantalla. |
| `Icono` | El único dibujo de la guía: trazos de 1.7 sobre `viewBox` de 24, hereda el color por `className`. Los `d` están en `src/iconos.ts`. |
| `Trazo` | El `<Path>` de `react-native-svg` ya enseñado a leer `className`. Importalo de acá —y nunca un color escrito a mano—: es lo que hace que el dibujo dé vuelta con el tema. |
| `Chevron` | Abre y cierra una sección, o dice que una fila se entra. |
| `Volver` | El camino de vuelta, siempre arriba del título. |
| `Titulo` | El título de la pantalla, su bajada y su único enlace de salida. |
| `Seccion` | Una sección con su nombre, su contador y su única acción. |
| `Boton` | La acción de la pantalla: negra, 48px. Una por pantalla. |
| `BotonSecundario` | La otra acción: con borde. Varias por pantalla, ninguna principal. |
| `Accion` | El enlace negro que abre el formulario de una lista. |
| `AccionAlMargen` | Lo infrecuente y lo que no se deshace: chiquito y al final. |
| `Casilla` | Lo que se marca y se desmarca de una lista: las unidades de una salida, quiénes pasan de rama. React Native no tiene `<input type=checkbox>`, así que el cuadrito se dibuja a mano y se toca la fila entera. |
| `Filtros` | Recortes de una misma lista. Es además **la única forma de elegir** en React Native, que no tiene `<select>`: con `valor` como lista, se combinan. |
| `Campo` | Un control con su etiqueta arriba y su problema debajo. |
| `Chip` | La píldora de estado, con su texto siempre escrito y el color como refuerzo. Tonos: `ok`, `warn`, `info`, `neutro`. |
| `ChipDeRama` | La etiqueta de rama: el punto de color de 8px adentro de un `Chip`. |
| `Etiqueta` | Un `Chip` con una × al lado, con `hitSlop`: un cargo o un equipo que se le puede sacar a alguien. Sin `onQuitar` es un `Chip` a secas. |
| `Saldo` | El saldo de una cuenta con la palabra que dice de qué lado va. Positivo es deuda. |
| `Falla` / `Aviso` / `Nota` | Salió mal / conviene saberlo / se mira pero no se toca. `Aviso` con `accion` es además el cartel destacado de lo que hay que hacer hoy. |
| `Cargando` / `Vacio` | La consulta no volvió / volvió sin nada. |

Aparte: `src/ramas.ts` tiene `COLOR_DE_RAMA`, escrito entero y no interpolado
—Tailwind lee las clases del fuente—, y su único uso es el punto del
`ChipDeRama`.

## Agregar una pieza nueva está bien visto

Con una condición: **que la misma forma ya esté escrita en dos pantallas.** Lo
que aparece una sola vez se queda en su pantalla; una abstracción con un solo
consumidor es deuda, no reuso. Cuando aparece la segunda, moverla acá es el
cambio más corto, no el más largo.

Si una pieza existente casi sirve, preferí estirarla —una clase al lado
(`` `${BOTON_SECUNDARIO} min-h-12` ``) o una prop opcional, como `accion` en
`Aviso`— antes que copiar sus clases a una pantalla.

Y si la pieza nueva ya existe en `apps/web/src/ui.tsx`, poné**le el mismo
nombre**, aunque el markup sea otro: el nombre es lo que hace que las dos apps
se lean igual.

## Una lista no lleva un formulario adentro

La acción va **arriba** de la lista, con `Accion`, y abre una pantalla propia; cargar algo
es una tarea que termina, y al terminar se vuelve a la lista, que recién cargada es la
confirmación de que salió bien. Un formulario colgado al pie compite por el lugar con lo
que se vino a leer y no se puede compartir por dirección.

Son pares: Nómina → Alta de persona, Salidas → Nueva salida, Cuenta del grupo → Registrar
pago, Cuotas → Definir una cuota. Cuando lo que se carga sigue editándose después —el
borrador de una salida—, esa edición vive en la pantalla del objeto
(`salidas/[permisoId]`), no de vuelta en la lista.

## Lo que es distinto por ser un teléfono

- **Nunca un color escrito a mano.** La app sigue al sistema
  (`colorScheme.set('system')` en `app/_layout.tsx`), así que un `#000000`
  desaparece en oscuro. Los colores son clases del tema: `text-ink`,
  `bg-surface-2`. En SVG eso se logra con `Trazo`.
- **Pantalla con formulario**: su `ScrollView` lleva
  `automaticallyAdjustKeyboardInsets` y `keyboardShouldPersistTaps="handled"`.
  Sin lo primero el teclado tapa los campos de abajo y el botón de guardar; sin
  lo segundo el primer toque con el teclado abierto sólo lo cierra. Es del
  propio `ScrollView`: no hace falta envolver nada.
- **No hay `<input type="date">` ni `<select>`.** Las fechas se escriben
  `aaaa-mm-dd` y las valida el `/dominio`; para elegir, `Filtros`.
- **El secreto de la sesión va a `expo-secure-store`**, nunca a AsyncStorage.
  En AsyncStorage van el cache de datos y el rol elegido, que no son
  credenciales. Ver `src/sesion.ts`.
- **Objetivo táctil de 48px** en todo lo que se toca, y `accessibilityRole` en
  cada `Pressable`: es un botón, un `tab`, un `radio`.
- **Las listas son `ScrollView`, no `FlatList`.** Montan todo de una. Con un
  nómina de grupo y el directorio de la diócesis alcanza; si alguna lista se
  vuelve larga de verdad, ése es el techo y ahí se cambia.
