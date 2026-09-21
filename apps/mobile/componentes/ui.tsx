// apps/mobile/componentes/ui.tsx
//
// Las piezas de la guía "Moderna", escritas con las primitivas de React
// Native. Es el gemelo de `apps/web/src/ui.tsx` —mismos nombres, mismos
// tokens— y no una librería de propósito general: acá está exactamente lo que
// ya estaba repetido en las pantallas de tesorería.
//
// Regla para agregar algo: que ya exista igual en dos pantallas.

import { Link } from 'expo-router'
import type { ReactNode } from 'react'
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native'

/** El importe siempre se escribe igual, y siempre en pesos enteros: los
 *  centavos no existen en la cuota. */
export const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

/** El campo de texto de la guía: 52px de alto, borde fino, foco negro. */
export const CAMPO =
  'h-13 rounded-lg border border-line-strong bg-surface-2 px-3.5 text-base text-ink ' +
  'placeholder:text-ink-faint'

/* ── Armazón ────────────────────────────────────────────────────────────── */

/** El marco de toda pantalla: fondo de página, área segura y el mismo aire a
 *  los costados. `pie` queda fijo abajo del scroll —es donde vive la acción
 *  que cierra la tarea, arriba del teclado. */
export function Pantalla(props: { children: ReactNode; pie?: ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-6 pb-10"
        keyboardShouldPersistTaps="handled"
      >
        {props.children}
      </ScrollView>
      {props.pie}
    </SafeAreaView>
  )
}

/* ── Encabezado ─────────────────────────────────────────────────────────── */

/** El camino de vuelta, siempre igual y siempre arriba del título. */
export function Volver(props: { href: string; children: ReactNode }) {
  return (
    <Link href={props.href} className="text-label text-ink-muted">
      ← {props.children}
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
      <View className="mt-1 flex-row items-center justify-between gap-3">
        <Text className="shrink text-2xl font-bold text-ink">{props.children}</Text>
        {props.enlace && (
          <Link href={props.enlace.href} className="shrink-0 text-sm text-ink-muted">
            {props.enlace.texto} →
          </Link>
        )}
      </View>
      {props.acompaña && <Text className="mt-1 text-sm text-ink-muted">{props.acompaña}</Text>}
    </>
  )
}

/* ── Acciones ───────────────────────────────────────────────────────────── */

/** La acción que cierra la tarea: negra, ancha, 52px. Una por pantalla. */
export function BotonPrincipal(props: {
  onPress: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled}
      onPress={props.onPress}
      className={`min-h-13 items-center justify-center rounded-lg px-4 ${
        props.disabled ? 'bg-surface-4' : 'bg-accent active:bg-accent-strong'
      }`}
    >
      <Text
        className={`text-base font-semibold ${props.disabled ? 'text-ink-faint' : 'text-accent-ink'}`}
      >
        {props.children}
      </Text>
    </Pressable>
  )
}

/** Un recorte de la misma lista, elegido de a uno: son recortes y combinarlos
 *  no responde ninguna pregunta que alguien se haga. */
export function Filtros<T extends string>(props: {
  opciones: readonly { id: T; etiqueta: string }[]
  valor: T
  onElegir: (id: T) => void
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {props.opciones.map((uno) => {
        const elegido = props.valor === uno.id
        return (
          <Pressable
            key={uno.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: elegido }}
            onPress={() => props.onElegir(uno.id)}
            className={`min-h-11 justify-center rounded-full border px-3.5 ${
              elegido ? 'border-accent bg-accent' : 'border-line-strong bg-surface-2'
            }`}
          >
            <Text className={`text-sm font-semibold ${elegido ? 'text-accent-ink' : 'text-ink'}`}>
              {uno.etiqueta}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/* ── Formularios ────────────────────────────────────────────────────────── */

/** Un control con su etiqueta arriba y, si lo hay, la ayuda debajo: donde se
 *  mira el campo, y no todo junto al final. */
export function Campo(props: { etiqueta: string; ayuda?: ReactNode; children: ReactNode }) {
  return (
    <View className="mt-5 gap-1.5">
      <Text className="text-sm font-semibold text-ink">{props.etiqueta}</Text>
      {props.children}
      {props.ayuda && <Text className="text-label text-ink-faint">{props.ayuda}</Text>}
    </View>
  )
}

/* ── Estado ─────────────────────────────────────────────────────────────── */

type Tono = 'ok' | 'warn' | 'danger' | 'neutro'

const TONOS: Record<Tono, string> = {
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  neutro: 'bg-surface-3 text-ink-muted',
}

/** El estado se lee, no se adivina: la píldora siempre lleva su texto y el
 *  color es refuerzo. */
export function Chip(props: { tono?: Tono; children: ReactNode }) {
  const clases = TONOS[props.tono ?? 'neutro']
  return (
    <View className={`min-h-[26px] shrink-0 justify-center rounded-full px-2.5 ${clases}`}>
      <Text className={`text-label font-semibold ${clases}`}>{props.children}</Text>
    </View>
  )
}

/* ── Avisos ─────────────────────────────────────────────────────────────── */

/** Algo salió mal. El mensaje del servidor puede traer un id largo. */
export function Falla(props: { children: ReactNode }) {
  return (
    <View className="mt-3 rounded-lg bg-danger-soft p-3">
      <Text className="text-sm text-danger">{props.children}</Text>
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
