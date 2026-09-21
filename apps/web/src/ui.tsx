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

/* ── Avisos ─────────────────────────────────────────────────────────────── */

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
