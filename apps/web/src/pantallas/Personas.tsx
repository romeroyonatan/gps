import { ErrorDeApi, useCrearPersona, usePersonas } from '@gps/api'
import {
  calcularEdad,
  type DatosDePersona,
  nombreCompleto,
  nombreDelTipo,
  type Problema,
  TIPOS_DE_DOCUMENTO,
  type TipoDeDocumento,
  validarPersona,
} from '@gps/personas/dominio'
import { type FormEvent, type ReactNode, useState } from 'react'

const VACIO: DatosDePersona = {
  tipoDeDocumento: 'dni',
  numeroDeDocumento: '',
  nombres: '',
  apellidos: '',
  fechaDeNacimiento: '',
}

const CLASE_DE_INPUT =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm ' +
  'focus:border-slate-900 focus:outline-none'

function Campo(props: { etiqueta: string; problema?: string; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: children es generico, biome no ve el control adentro
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{props.etiqueta}</span>
      <div className="mt-1">{props.children}</div>
      {props.problema && <p className="mt-1 text-xs text-red-700">{props.problema}</p>}
    </label>
  )
}

export function Personas() {
  const { data, isPending, error } = usePersonas()
  const alta = useCrearPersona()
  const [datos, setDatos] = useState<DatosDePersona>(VACIO)
  const [problemas, setProblemas] = useState<readonly Problema[]>([])
  const hoy = new Date()

  const problemaDe = (campo: Problema['campo']) =>
    problemas.find((problema) => problema.campo === campo)?.mensaje

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    // Las mismas funciones puras que corre el servicio. Validar aca es la
    // experiencia de uso; que el servidor las corra igual es la garantia. Es el
    // pago de que /dominio sea isomorfo: una sola implementacion.
    const encontrados = validarPersona(datos, hoy)
    setProblemas(encontrados)
    if (encontrados.length > 0) return
    alta.mutate({ datos }, { onSuccess: () => setDatos(VACIO) })
  }

  return (
    <>
      <form onSubmit={enviar} className="mt-8 space-y-3 rounded-lg bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Cargar una persona</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Tipo de documento">
            <select
              className={CLASE_DE_INPUT}
              value={datos.tipoDeDocumento}
              onChange={(evento) =>
                setDatos({ ...datos, tipoDeDocumento: evento.target.value as TipoDeDocumento })
              }
            >
              {TIPOS_DE_DOCUMENTO.map((tipo) => (
                <option key={tipo.id} value={tipo.id}>
                  {tipo.nombre}
                </option>
              ))}
            </select>
          </Campo>

          <Campo etiqueta="Número" problema={problemaDe('numeroDeDocumento')}>
            <input
              className={CLASE_DE_INPUT}
              value={datos.numeroDeDocumento}
              onChange={(evento) => setDatos({ ...datos, numeroDeDocumento: evento.target.value })}
              inputMode="text"
            />
          </Campo>

          <Campo etiqueta="Apellidos" problema={problemaDe('apellidos')}>
            <input
              className={CLASE_DE_INPUT}
              value={datos.apellidos}
              onChange={(evento) => setDatos({ ...datos, apellidos: evento.target.value })}
            />
          </Campo>

          <Campo etiqueta="Nombres" problema={problemaDe('nombres')}>
            <input
              className={CLASE_DE_INPUT}
              value={datos.nombres}
              onChange={(evento) => setDatos({ ...datos, nombres: evento.target.value })}
            />
          </Campo>

          <Campo etiqueta="Fecha de nacimiento" problema={problemaDe('fechaDeNacimiento')}>
            {/* type="date" es nativo: trae el calendario del sistema, es
                accesible sin trabajo, y emite exactamente el aaaa-mm-dd que
                espera el dominio. Ninguna dependencia hace falta. */}
            <input
              type="date"
              className={CLASE_DE_INPUT}
              value={datos.fechaDeNacimiento}
              onChange={(evento) => setDatos({ ...datos, fechaDeNacimiento: evento.target.value })}
            />
          </Campo>
        </div>

        {alta.isError && (
          <p className="rounded-lg bg-red-50 p-3 text-sm break-words text-red-800">
            {alta.error instanceof ErrorDeApi ? alta.error.errores.join(' ') : alta.error.message}
          </p>
        )}

        <button
          type="submit"
          disabled={alta.isPending}
          className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 sm:w-auto"
        >
          {alta.isPending ? 'Guardando…' : 'Guardar'}
        </button>
      </form>

      {isPending && <p className="mt-8 text-sm text-slate-500">Consultando las personas…</p>}

      {error && (
        <p className="mt-8 rounded-lg bg-red-50 p-4 text-sm break-words text-red-800">
          No se pudieron consultar las personas: {error.message}
        </p>
      )}

      {data?.personas.length === 0 && (
        <p className="mt-8 rounded-lg bg-white p-4 text-sm text-slate-500 shadow-sm">
          No hay personas cargadas todavía.
        </p>
      )}

      {data && data.personas.length > 0 && (
        <ul className="mt-8 divide-y divide-slate-200 rounded-lg bg-white shadow-sm">
          {data.personas.map((persona) => (
            <li key={persona.id} className="px-4 py-3">
              <p className="text-sm font-medium text-slate-900">{nombreCompleto(persona)}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {nombreDelTipo(persona.tipoDeDocumento)} {persona.numeroDeDocumento}
                <span className="text-slate-400">
                  {' · '}
                  {calcularEdad(persona.fechaDeNacimiento, hoy)} años
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
