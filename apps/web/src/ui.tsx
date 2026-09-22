// apps/web/src/ui.tsx
//
// Las piezas de la guía, escritas una sola vez. No es una librería de
// componentes de propósito general: es exactamente lo que ya estaba repetido
// en las pantallas —la píldora de estado, el recuadro de error, el encabezado,
// la fila— con la decisión de diseño escrita en un lugar en vez de quince.
//
// Regla para agregar algo acá: que ya exista igual en dos pantallas. Lo que
// aparece una sola vez se queda en su pantalla.

import { type Rama, ramaDelCatalogo } from '@gps/estructura/dominio'
import type { ReactNode } from 'react'
import { Link } from 'wouter'
import { COLOR_DE_RAMA } from './ramas'

/* ── Clases ─────────────────────────────────────────────────────────────── */

export const CAMPO =
  'w-full rounded-lg border border-line-strong bg-surface-2 px-3.5 text-base text-ink ' +
  'placeholder:text-ink-faint focus:border-ink focus:outline-none ' +
  'disabled:bg-surface-3 disabled:text-ink-faint'

export const BOTON_PRINCIPAL =
  'flex min-h-12 w-full items-center justify-center rounded-lg bg-accent px-4 text-base ' +
  'font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-40'

export const BOTON_SECUNDARIO =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line-strong ' +
  'px-3.5 text-sm font-semibold text-ink hover:bg-surface-3 disabled:opacity-40'

/** Lo menos frecuente y lo que no se deshace: chiquito y al final. */
export const BOTON_AL_MARGEN =
  'min-h-9 text-label text-ink-faint hover:text-danger disabled:opacity-40'

/** Densidad teléfono de la guía: fila cómoda de 56px. Es una clase y no una
 *  `<Fila>`: lo que va adentro cambia en cada pantalla y envolverlo no
 *  ahorraba nada. Las de 72px, con dos líneas de dato, las escribe cada
 *  pantalla: hoy hay una sola. */
export const FILA = 'flex min-h-14 items-center gap-3 border-b border-line py-2 last:border-b-0'

/** Elegido y elegible: el par de colores de todo control que se elige de a uno
 *  —las píldoras de `Filtros`, los dos caminos de la firma, las categorías del
 *  alta—. Son clases y no un `<Segmentado>` porque la forma cambia en cada
 *  lugar (redondo, rectangular, al ancho de la fila) y el color no. */
export const ELEGIDO = 'border-accent bg-accent text-accent-ink'
export const ELEGIBLE = 'border-line-strong hover:bg-surface-3'

/** La lista que de `md:` para arriba pasa a ser tabla: en el teléfono es una
 *  lista suelta y en escritorio se encuadra. Es el mismo markup con otra
 *  grilla, no dos pantallas paralelas. Las columnas las declara cada tabla
 *  —no se parecen en nada entre sí—; lo que se comparte es el marco. */
export const TABLA = 'mt-5 md:rounded-xl md:border md:border-line-strong'

/** El pie de una `TABLA`: a la izquierda cuántos son, a la derecha el total. El
 *  filtro cambia la pregunta, así que el total tiene que cambiar con ella. */
export const PIE_DE_TABLA =
  'mt-4 flex flex-wrap justify-between gap-3 rounded-lg bg-surface-3 px-4 py-3 text-sm ' +
  'md:mt-0 md:rounded-none md:rounded-b-xl'

/* ── Iconos ─────────────────────────────────────────────────────────────── */

/** El único dibujo de la guía: trazo de 1.7, sin relleno, hereda el color del
 *  texto. Son los `d` de los `<path>` y nada más —no hay librería de iconos—,
 *  así que un icono nuevo es una constante con sus trazos, no una dependencia. */
export function Icono(props: { trazos: readonly string[]; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={props.className ?? 'size-6 shrink-0'}
    >
      {props.trazos.map((trazo) => (
        <path key={trazo} d={trazo} />
      ))}
    </svg>
  )
}

/** Abre, cierra y lleva adelante. Rotado 90° es el que apunta abajo. */
export const CHEVRON = ['m9 18 6-6-6-6'] as const

/* ── Encabezado ─────────────────────────────────────────────────────────── */

/** El camino de vuelta, siempre igual y siempre arriba del título. */
export function Volver(props: { href: string; children: ReactNode }) {
  return (
    <Link href={props.href} className="text-label text-ink-muted hover:text-ink">
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
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <h2 className="text-2xl font-bold">{props.children}</h2>
        {props.enlace && (
          <Link href={props.enlace.href} className="shrink-0 text-sm text-ink-muted hover:text-ink">
            {props.enlace.texto} →
          </Link>
        )}
      </div>
      {props.acompaña && <p className="mt-1 text-sm text-ink-muted">{props.acompaña}</p>}
    </>
  )
}

/** Una sección con su nombre a la izquierda y su única acción a la derecha,
 *  siempre con la misma forma. Ninguna acción vive suelta adentro del texto. */
export function Seccion(props: {
  titulo: string
  cuantos?: number
  enlace?: { texto: string; href: string }
  children?: ReactNode
}) {
  return (
    <section className="mt-5 border-t border-line pt-4 first-of-type:border-t-0 first-of-type:pt-0">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-bold">
          {props.titulo}
          {/* Un contador en cero no informa nada: lo dice el estado vacío. */}
          {props.cuantos !== undefined && props.cuantos > 0 && (
            <span className="ml-2 text-label font-medium tabular-nums text-ink-muted">
              {props.cuantos}
            </span>
          )}
        </h3>
        {props.enlace && (
          <Link href={props.enlace.href} className="shrink-0 text-sm text-ink-muted hover:text-ink">
            {props.enlace.texto} →
          </Link>
        )}
      </div>
      {props.children}
    </section>
  )
}

/* ── Acciones ───────────────────────────────────────────────────────────── */

/** La acción de una pantalla de lista que abre la pantalla de su formulario:
 *  arriba de la lista, negra, y nunca un formulario colgado abajo. */
export function Accion(props: { href: string; children: ReactNode }) {
  return (
    <Link
      href={props.href}
      className="inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-3.5 text-sm font-semibold text-accent-ink hover:bg-accent-strong"
    >
      {props.children}
    </Link>
  )
}

/** Un archivo que arma el servidor y baja el navegador: PDF, XLSX, escaneo.
 *  Es un `<a>` y no un botón a propósito —así se puede guardar o compartir con
 *  el menú de siempre—, con la forma del botón secundario. */
export function Bajar(props: { href: string; children: ReactNode; nuevaPestaña?: boolean }) {
  return (
    <a
      href={props.href}
      {...(props.nuevaPestaña ? { target: '_blank', rel: 'noreferrer' } : {})}
      className={BOTON_SECUNDARIO}
    >
      {props.children}
    </a>
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
    <div className="flex flex-wrap gap-2">
      {props.opciones.map((uno) => (
        <button
          key={uno.id}
          type="button"
          onClick={() => props.onElegir(uno.id)}
          className={`inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-semibold ${
            props.valor === uno.id
              ? 'border-accent bg-accent text-accent-ink'
              : 'border-line-strong hover:bg-surface-3'
          }`}
        >
          {uno.etiqueta}
        </button>
      ))}
    </div>
  )
}

/* ── Formularios ────────────────────────────────────────────────────────── */

/** Un control con su etiqueta arriba y, si lo hay, el problema debajo. El
 *  problema va donde se mira el campo y no todo junto al final: enterarse
 *  tarde de qué campo estaba mal no le sirve a nadie. */
export function Campo(props: { etiqueta: string; problema?: string; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: children es generico, biome no ve el control adentro
    <label className="block">
      <span className="text-sm font-semibold">{props.etiqueta}</span>
      <div className="mt-1.5">{props.children}</div>
      {props.problema && <p className="mt-1.5 text-sm text-danger">{props.problema}</p>}
    </label>
  )
}

/* ── Estado ─────────────────────────────────────────────────────────────── */

type Tono = 'ok' | 'warn' | 'info' | 'neutro'

const TONOS: Record<Tono, string> = {
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  info: 'bg-info-soft text-info',
  neutro: 'bg-surface-3 text-ink-muted',
}

/** El estado se lee, no se adivina: la píldora siempre lleva su texto y el
 *  color es refuerzo. Sin borde, sin versalitas, sin punto de color suelto. */
export function Chip(props: { tono?: Tono; children: ReactNode }) {
  return (
    <span
      className={`inline-flex min-h-[26px] shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-label font-semibold whitespace-nowrap ${TONOS[props.tono ?? 'neutro']}`}
    >
      {props.children}
    </span>
  )
}

/** La etiqueta de rama, que es el único uso que la guía le da al color de
 *  rama: punto de 8px adentro de una etiqueta gris, con el nombre escrito al
 *  lado. Nunca fondo de fila ni color de texto. */
export function ChipDeRama(props: { rama: Rama; children?: ReactNode }) {
  return (
    <Chip>
      <span className={`size-2 rounded-full ${COLOR_DE_RAMA[props.rama]}`} aria-hidden="true" />
      {ramaDelCatalogo(props.rama)?.nombre ?? props.rama}
      {props.children}
    </Chip>
  )
}

/** Un hecho que alguien le puso a una persona y le puede sacar: un cargo, un
 *  equipo. Es un `Chip` con una × al lado; sin `onQuitar` es un `Chip` y nada
 *  más, que es como se ve cuando quien mira no puede administrar. */
export function Etiqueta(props: {
  children: ReactNode
  onQuitar?: () => void
  quitando?: boolean
}) {
  return (
    <Chip>
      {props.children}
      {props.onQuitar && (
        <button
          type="button"
          onClick={props.onQuitar}
          disabled={props.quitando}
          className="text-ink-faint hover:text-danger disabled:opacity-40"
          aria-label="Quitar"
        >
          ×
        </button>
      )}
    </Chip>
  )
}

/* ── Plata ──────────────────────────────────────────────────────────────── */

/** Los pesos, escritos igual en todas las pantallas. Sin centavos: la cuota se
 *  define en pesos enteros y los centavos son ruido en una lista de quince
 *  grupos. Es el gemelo del de `apps/mobile/componentes/ui.tsx`. */
export const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

/** El saldo de la cuenta de un grupo, con su lectura escrita debajo.
 *
 *  El saldo positivo es deuda: así lo guarda tesorería. El signo se escribe y
 *  el color es refuerzo, nunca el dato —la misma regla que `Chip`—. */
export function Saldo(props: { importe: number; className?: string }) {
  return (
    <div className={props.className}>
      <p className={`text-2xl font-bold tabular-nums ${props.importe > 0 ? 'text-danger' : ''}`}>
        {props.importe > 0 ? '−' : ''}
        {pesos.format(Math.abs(props.importe))}
      </p>
      <p className="mt-0.5 text-sm text-ink-muted">
        {props.importe > 0 ? 'De deuda' : props.importe < 0 ? 'A favor del grupo' : 'Sin deuda'}.
      </p>
    </div>
  )
}

/* ── Avisos ─────────────────────────────────────────────────────────────── */

/** Lo que exige acción, arriba de todo. Sólo se dibuja si hay algo que hacer:
 *  un bloque destacado que dice "0" no destaca nada, así que la pantalla no lo
 *  monta en vez de montarlo vacío. */
export function Pendiente(props: { children: ReactNode }) {
  return <section className="mt-5 rounded-lg bg-warn-soft p-4">{props.children}</section>
}

/** Algo salió mal. `break-words` porque el mensaje del servidor puede traer un
 *  id largo sin espacios y si no desborda el teléfono. */
export function Falla(props: { children: ReactNode }) {
  return (
    <p className="mt-3 rounded-lg bg-danger-soft p-3 text-sm break-words text-danger">
      {props.children}
    </p>
  )
}

/** Nada salió mal todavía, pero conviene saberlo antes de seguir. */
export function Aviso(props: { children: ReactNode }) {
  return <p className="mt-3 rounded-lg bg-warn-soft p-3 text-sm text-warn">{props.children}</p>
}

/** La consulta todavía no volvió. */
export function Cargando(props: { children: ReactNode }) {
  return <p className="mt-6 text-sm text-ink-muted">{props.children}</p>
}

/** La consulta volvió sin nada. Borde punteado y no bloque gris: el gris
 *  agrupa contenido, y acá justamente no hay. */
export function Vacio(props: { children: ReactNode }) {
  return (
    <p className="mt-5 rounded-lg border border-dashed border-line-strong p-4 text-sm text-ink-muted">
      {props.children}
    </p>
  )
}

/** Se puede mirar pero no tocar, y el motivo es una regla, no un error. */
export function Nota(props: { children: ReactNode }) {
  return <p className="mt-4 rounded-lg bg-surface-3 p-3 text-sm text-ink-muted">{props.children}</p>
}
