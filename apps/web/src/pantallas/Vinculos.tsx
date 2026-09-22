import { etiquetaDeEdades, ramaDelCatalogo, type Unidad } from '@gps/estructura/dominio'
import {
  ambitoDelCargo,
  type DatosDeCargo,
  TIPOS_DE_CARGO,
  type TipoDeCargo,
} from '@gps/personas/dominio'
import { useState } from 'react'
import { COLOR_DE_RAMA } from '../ramas'

export type UnidadAbierta = Pick<Unidad, 'id' | 'rama' | 'nombre' | 'sexo'>

/** Los cargos que una pantalla de grupo puede cargar: los de ámbito grupo y
 *  nada más. Un comisionado de distrito se guardaría con el grupo por ámbito,
 *  que es un cargo que no existe; `validarIngreso` lo rechaza igual, y esto es
 *  para no ofrecerlo. */
export const CARGOS_DE_GRUPO = TIPOS_DE_CARGO.filter((tipo) => ambitoDelCargo(tipo.id) === 'grupo')

/** A qué unidad va. No es un campo vacío que haya que completar: en el alta la
 *  edad ya dice a dónde, así que se propone y elegir a mano es corregir. En el
 *  cambio de rama no hay sugerencia y se elige a dedo.
 *
 *  La rama la decide `ramaParaEdad`; la unidad concreta es la que el grupo
 *  tenga abierta para esa rama, porque un grupo puede tener dos tropas o
 *  ninguna. */
export function Unidades(props: {
  unidades: readonly UnidadAbierta[]
  sugerida?: UnidadAbierta | undefined
  elegida: string | null
  onElegir: (unidadId: string) => void
  problema?: string
  /** Qué dice el encabezado cuando nadie eligió todavía. */
  etiqueta?: string
  /** Qué se lee cuando no hay ninguna unidad elegida ni sugerida. En el alta
   *  es que ninguna le corresponde por edad; en el cambio de rama es que
   *  todavía no se eligió. */
  sinElegir?: string
}) {
  const [abierto, abrir] = useState(false)
  const actual = props.unidades.find(
    (unidad) => unidad.id === (props.elegida ?? props.sugerida?.id),
  )

  if (props.unidades.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line-strong p-4 text-sm text-ink-muted">
        El grupo todavía no abrió ninguna unidad. Sólo podés cargar adherentes.
      </p>
    )
  }

  return (
    <div className="rounded-lg bg-surface-3 p-3.5 md:bg-transparent md:p-0">
      <p className="text-label text-ink-muted">
        {props.elegida
          ? 'Unidad, elegida a mano'
          : (props.etiqueta ?? 'Unidad sugerida por la edad')}
      </p>
      <div className="mt-2 flex items-center justify-between gap-3">
        {actual ? (
          <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-surface-2 px-3 font-semibold">
            <span
              className={`size-2 rounded-full ${COLOR_DE_RAMA[actual.rama]}`}
              aria-hidden="true"
            />
            {actual.nombre}
          </span>
        ) : (
          <span className="text-sm text-ink-muted">
            {props.sinElegir ?? 'Ninguna unidad abierta le corresponde por edad'}
          </span>
        )}
        <button
          type="button"
          onClick={() => abrir(!abierto)}
          aria-expanded={abierto}
          className="min-h-9 shrink-0 rounded-lg border border-line-strong bg-surface-2 px-3 text-sm font-semibold hover:bg-surface-4"
        >
          Cambiar
        </button>
      </div>

      {abierto && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {props.unidades.map((unidad) => {
            const catalogo = ramaDelCatalogo(unidad.rama)
            const esActual = unidad.id === actual?.id
            return (
              <li key={unidad.id}>
                <button
                  type="button"
                  onClick={() => {
                    props.onElegir(unidad.id)
                    abrir(false)
                  }}
                  className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm font-semibold ${
                    esActual
                      ? 'border-accent bg-accent text-accent-ink'
                      : 'border-line-strong bg-surface-2 hover:bg-surface-4'
                  }`}
                >
                  {!esActual && (
                    <span
                      className={`size-2 rounded-full ${COLOR_DE_RAMA[unidad.rama]}`}
                      aria-hidden="true"
                    />
                  )}
                  {unidad.nombre}
                  {catalogo && (
                    <span className="font-normal opacity-70">{etiquetaDeEdades(catalogo)}</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {props.problema && <p className="mt-2 text-sm text-danger">{props.problema}</p>}
    </div>
  )
}

/** Qué cargos tiene, con su fin de mandato opcional. Los usa el alta y el
 *  detalle de una persona: la misma lista de casillas, con la fecha al lado de
 *  la que se prende.
 *
 *  `ocupados` son los que ya tiene vigentes: el detalle los saca de la lista
 *  porque ahí se quitan con su ×, no con la casilla. */
export function Cargos(props: {
  elegidos: readonly DatosDeCargo[]
  onCambiar: (cargos: readonly DatosDeCargo[]) => void
  ocupados?: readonly TipoDeCargo[]
  problema?: string
}) {
  const elegido = (cargo: TipoDeCargo) => props.elegidos.find((uno) => uno.cargo === cargo)
  const disponibles = CARGOS_DE_GRUPO.filter((tipo) => !props.ocupados?.includes(tipo.id))

  return (
    <div>
      {disponibles.map((tipo) => {
        const puesto = elegido(tipo.id)
        return (
          <div key={tipo.id} className="flex min-h-11 flex-wrap items-center gap-3">
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={Boolean(puesto)}
                onChange={() =>
                  props.onCambiar(
                    puesto
                      ? props.elegidos.filter((uno) => uno.cargo !== tipo.id)
                      : [...props.elegidos, { cargo: tipo.id, hasta: null }],
                  )
                }
                className="size-5 shrink-0 accent-black"
              />
              {tipo.nombre}
            </label>
            {puesto && (
              <label className="flex items-center gap-2 text-label text-ink-muted">
                hasta
                <input
                  type="date"
                  className="rounded-lg border border-line-strong bg-surface-2 px-2 py-1.5 text-label tabular-nums"
                  value={puesto.hasta ?? ''}
                  onChange={(evento) =>
                    props.onCambiar(
                      props.elegidos.map((uno) =>
                        uno.cargo === tipo.id
                          ? { ...uno, hasta: evento.target.value || null }
                          : uno,
                      ),
                    )
                  }
                />
              </label>
            )}
          </div>
        )
      })}
      {props.problema && <p className="mt-1.5 text-sm text-danger">{props.problema}</p>}
    </div>
  )
}
