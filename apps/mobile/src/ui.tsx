// apps/mobile/src/ui.tsx
//
// Las piezas de la guía, escritas una sola vez. Es el gemelo en React Native
// de `apps/web/src/ui.tsx`: los mismos nombres, los mismos tokens y las mismas
// decisiones, con `View`/`Text` en vez de `div`/`p`. No es una librería de
// propósito general: es lo que ya estaba repetido en las pantallas.
//
// Regla para agregar algo acá: que ya exista igual en dos pantallas.

import { type Rama, ramaDelCatalogo } from '@gps/estructura/dominio'
import { Link } from 'expo-router'
import { cssInterop } from 'nativewind'
import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { CHEVRON } from './iconos'
import { COLOR_DE_RAMA } from './ramas'

/* ── Clases ─────────────────────────────────────────────────────────────── */

/** Objetivo táctil de 48px y radio 8px, como pide la guía para el jefe de
 *  grupo apurado. No hay `:focus` ni `::placeholder` en NativeWind: el color
 *  del placeholder va por prop en cada campo. */
export const CAMPO =
  'min-h-12 rounded-lg border border-line-strong bg-surface-2 px-3.5 text-base text-ink'

/** Densidad teléfono de la guía: fila cómoda de 56px. Es una clase y no una
 *  `<Fila>` porque lo que va adentro cambia en cada pantalla. Las de 72px, con
 *  dos líneas de dato, las escribe cada pantalla. */
export const FILA = 'min-h-14 flex-row items-center gap-3 border-b border-line py-2'

/* ── Iconos ─────────────────────────────────────────────────────────────── */

// `react-native-svg` no tiene `currentColor`: el trazo se escribe o no se ve.
// `cssInterop` cierra el hueco -toma el color que resuelve la clase y lo pasa
// como prop `stroke`-, así un icono se pinta con `text-ink` como cualquier
// texto y el modo oscuro lo da vuelta solo, sin un hex escrito a mano.
cssInterop(Path, { className: { target: false, nativeStyleToProp: { color: 'stroke' } } })

/** El único dibujo de la guía: trazo de 1.7, sin relleno. Son los `d` de los
 *  `<path>` y nada más —ver `iconos.ts`—, así que un icono nuevo es una
 *  constante con sus trazos, no una dependencia. */
export function Icono(props: {
  trazos: readonly string[]
  medida?: number
  /** El color, como clase de texto: `text-ink`, `text-ink-faint`. */
  className?: string
}) {
  const medida = props.medida ?? 22
  return (
    <Svg width={medida} height={medida} viewBox="0 0 24 24" fill="none">
      {props.trazos.map((trazo) => (
        <Path
          key={trazo}
          d={trazo}
          className={props.className ?? 'text-ink'}
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  )
}

/** El chevron, que abre y cierra una sección o dice que una fila se entra. */
export function Chevron(props: { abierto?: boolean; className?: string }) {
  return (
    <View style={props.abierto ? { transform: [{ rotate: '90deg' }] } : undefined}>
      <Icono trazos={CHEVRON} medida={18} className={props.className ?? 'text-ink-faint'} />
    </View>
  )
}

/* ── Encabezado ─────────────────────────────────────────────────────────── */

/** El camino de vuelta, siempre igual y siempre arriba del título. */
export function Volver(props: { href: string; children: ReactNode }) {
  return (
    // El color va en un `Text` adentro y no en el `Link`: las variables del
    // tema no llegan a las clases que se le cuelgan al `Link`, y en oscuro el
    // enlace se quedaba con el gris del tema claro.
    <Link href={props.href} asChild>
      <Pressable className="min-h-9 justify-center">
        <Text className="text-label text-ink-muted">← {props.children}</Text>
      </Pressable>
    </Link>
  )
}

/** El título de la pantalla y, a la derecha, su enlace de salida si tiene uno.
 *  Una sola acción: si hacen falta dos, van abajo como botones. */
export function Titulo(props: {
  children: ReactNode
  acompaña?: ReactNode
  enlace?: { texto: string; href: string }
}) {
  return (
    <>
      <View className="mt-1 flex-row items-baseline justify-between gap-3">
        <Text className="text-2xl font-bold text-ink">{props.children}</Text>
        {props.enlace && (
          <Link href={props.enlace.href} asChild>
            <Pressable className="min-h-9 shrink-0 justify-center">
              <Text className="text-sm text-ink-muted">{props.enlace.texto} →</Text>
            </Pressable>
          </Link>
        )}
      </View>
      {props.acompaña && <Text className="mt-1 text-sm text-ink-muted">{props.acompaña}</Text>}
    </>
  )
}

/** Una sección con su nombre a la izquierda y su única acción a la derecha,
 *  siempre con la misma forma. Ninguna acción vive suelta adentro del texto. */
export function Seccion(props: {
  titulo: string
  cuantos?: number
  detalle?: string
  enlace?: { texto: string; href: string }
  children?: ReactNode
}) {
  return (
    <View className="mt-5 border-t border-line pt-4">
      <View className="flex-row items-baseline justify-between gap-3">
        <Text className="flex-1 text-lg font-bold text-ink">
          {props.titulo}
          {/* Un contador en cero no informa nada: lo dice el estado vacío. */}
          {props.cuantos !== undefined && props.cuantos > 0 && (
            <Text className="text-label font-medium text-ink-muted"> {props.cuantos}</Text>
          )}
          {props.detalle && (
            <Text className="text-label font-medium text-ink-muted"> {props.detalle}</Text>
          )}
        </Text>
        {props.enlace && (
          <Link href={props.enlace.href} asChild>
            <Pressable className="min-h-9 shrink-0 justify-center">
              <Text className="text-sm text-ink-muted">{props.enlace.texto} →</Text>
            </Pressable>
          </Link>
        )}
      </View>
      {props.children}
    </View>
  )
}

/* ── Acciones ───────────────────────────────────────────────────────────── */

/** La acción de la pantalla: negra, ancha y de 48px. Es la única que hay por
 *  pantalla; lo que no se deshace va al final, no acá. */
export function Boton(props: {
  onPress: () => void
  disabled?: boolean
  children: ReactNode
  /** El ancho lo decide quien la usa: sola en la pantalla va ancha, adentro de
   *  una fila de botones va al alto del contenido. */
  angosta?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      disabled={props.disabled}
      className={`min-h-12 items-center justify-center rounded-lg bg-accent px-4 ${
        props.angosta ? 'self-start' : ''
      } ${props.disabled ? 'opacity-40' : ''}`}
    >
      <Text className="text-base font-semibold text-accent-ink">{props.children}</Text>
    </Pressable>
  )
}

/** La segunda acción, cuando hay dos: el borde en vez del relleno. Una sola
 *  pantalla puede tener varias -bajar el PDF, subir el papel, re-emitir-, y
 *  ninguna de ellas es la principal. */
export function BotonSecundario(props: {
  onPress: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      disabled={props.disabled}
      className={`min-h-12 items-center justify-center rounded-lg border border-line-strong px-3.5 ${
        props.disabled ? 'opacity-40' : ''
      }`}
    >
      <Text className="text-sm font-semibold text-ink">{props.children}</Text>
    </Pressable>
  )
}

/** La acción de una pantalla de lista que abre la pantalla de su formulario:
 *  arriba de la lista, negra, y nunca un formulario colgado abajo. */
export function Accion(props: { href: string; children: ReactNode }) {
  return (
    <Link href={props.href} asChild>
      <Pressable className="min-h-12 items-center justify-center rounded-lg bg-accent px-3.5">
        <Text className="text-sm font-semibold text-accent-ink">{props.children}</Text>
      </Pressable>
    </Link>
  )
}

/** Lo menos frecuente y lo que no se deshace: chiquito y al final. */
export function AccionAlMargen(props: {
  onPress: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      disabled={props.disabled}
      className={`min-h-9 justify-center ${props.disabled ? 'opacity-40' : ''}`}
    >
      <Text className="text-label text-ink-faint">{props.children}</Text>
    </Pressable>
  )
}

/** Un recorte de la misma lista, elegido de a uno: son recortes y combinarlos
 *  no responde ninguna pregunta que alguien se haga.
 *
 *  Es también la única forma de elegir de una lista en React Native, que no
 *  tiene `<select>`. Cuando lo que se elige sí se combina -los cargos de
 *  alguien, que pueden ser varios-, `valor` es la lista de los prendidos. */
export function Filtros<T extends string>(props: {
  opciones: readonly { id: T; etiqueta: string }[]
  valor: T | null | readonly T[]
  onElegir: (id: T) => void
  deshabilitado?: boolean
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {props.opciones.map((uno) => {
        const activo = Array.isArray(props.valor)
          ? props.valor.includes(uno.id)
          : uno.id === props.valor
        return (
          <Pressable
            key={uno.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: activo }}
            disabled={props.deshabilitado}
            onPress={() => props.onElegir(uno.id)}
            className={`min-h-9 justify-center rounded-full border px-3 ${
              activo ? 'border-accent bg-accent' : 'border-line-strong bg-surface-2'
            } ${props.deshabilitado ? 'opacity-40' : ''}`}
          >
            <Text className={`text-sm font-semibold ${activo ? 'text-accent-ink' : 'text-ink'}`}>
              {uno.etiqueta}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/* ── Formularios ────────────────────────────────────────────────────────── */

/** Un control con su etiqueta arriba y, si lo hay, el problema debajo. El
 *  problema va donde se mira el campo y no todo junto al final. */
export function Campo(props: { etiqueta: string; problema?: string; children: ReactNode }) {
  return (
    <View>
      <Text className="text-sm font-semibold text-ink">{props.etiqueta}</Text>
      <View className="mt-1.5">{props.children}</View>
      {props.problema && <Text className="mt-1.5 text-sm text-danger">{props.problema}</Text>}
    </View>
  )
}

/* ── Estado ─────────────────────────────────────────────────────────────── */

type Tono = 'ok' | 'warn' | 'info' | 'neutro'

const TONOS: Record<Tono, { caja: string; letra: string }> = {
  ok: { caja: 'bg-ok-soft', letra: 'text-ok' },
  warn: { caja: 'bg-warn-soft', letra: 'text-warn' },
  info: { caja: 'bg-info-soft', letra: 'text-info' },
  neutro: { caja: 'bg-surface-3', letra: 'text-ink-muted' },
}

/** El estado se lee, no se adivina: la píldora siempre lleva su texto y el
 *  color es refuerzo. Sin borde, sin versalitas, sin punto de color suelto. */
export function Chip(props: { tono?: Tono; children: ReactNode }) {
  const tono = TONOS[props.tono ?? 'neutro']
  return (
    <View
      className={`min-h-[26px] shrink-0 flex-row items-center gap-1.5 rounded-full px-2.5 py-0.5 ${tono.caja}`}
    >
      <Text className={`text-label font-semibold ${tono.letra}`}>{props.children}</Text>
    </View>
  )
}

/** La etiqueta de rama, que es el único uso que la guía le da al color de
 *  rama: punto de 8px adentro de una etiqueta gris, con el nombre escrito al
 *  lado. Nunca fondo de fila ni color de texto. */
export function ChipDeRama(props: { rama: Rama; children?: ReactNode }) {
  return (
    <View className="min-h-[26px] flex-row items-center gap-1.5 rounded-full bg-surface-3 px-2.5 py-0.5">
      <View className={`h-2 w-2 rounded-full ${COLOR_DE_RAMA[props.rama]}`} />
      <Text className="text-label font-semibold text-ink">
        {ramaDelCatalogo(props.rama)?.nombre ?? props.rama}
        {props.children}
      </Text>
    </View>
  )
}

/* ── Avisos ─────────────────────────────────────────────────────────────── */

/** Algo salió mal. El mensaje del servidor puede traer un id largo sin
 *  espacios: en React Native el texto ya corta solo, no hace falta nada.
 *
 *  Sin nada adentro no se dibuja: así las pantallas pueden escribir
 *  `<Falla>{consulta.error?.message}</Falla>` sin envolverlo en un `&&`. */
export function Falla(props: { children: ReactNode }) {
  if (!props.children) return null
  return (
    <View className="mt-3 rounded-lg bg-danger-soft p-3">
      <Text className="text-sm text-danger">{props.children}</Text>
    </View>
  )
}

/** Nada salió mal todavía, pero conviene saberlo antes de seguir. */
export function Aviso(props: { children: ReactNode }) {
  if (!props.children) return null
  return (
    <View className="mt-3 rounded-lg bg-warn-soft p-3">
      <Text className="text-sm text-warn">{props.children}</Text>
    </View>
  )
}

/** La consulta todavía no volvió. */
export function Cargando(props: { children: ReactNode }) {
  return <Text className="mt-6 text-sm text-ink-muted">{props.children}</Text>
}

/** La consulta volvió sin nada. Borde punteado y no bloque gris: el gris
 *  agrupa contenido, y acá justamente no hay. */
export function Vacio(props: { children: ReactNode }) {
  return (
    <View className="mt-5 rounded-lg border border-dashed border-line-strong p-4">
      <Text className="text-sm text-ink-muted">{props.children}</Text>
    </View>
  )
}

/** Se puede mirar pero no tocar, y el motivo es una regla, no un error. */
export function Nota(props: { children: ReactNode }) {
  return (
    <View className="mt-4 rounded-lg bg-surface-3 p-3">
      <Text className="text-sm text-ink-muted">{props.children}</Text>
    </View>
  )
}
