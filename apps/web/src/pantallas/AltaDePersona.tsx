import { ErrorDeApi, useCrearPersona } from '@gps/api'
import { aFechaDeCalendario } from '@gps/core/fechas'
import { etiquetaDeEdades, type Rama, ramaDelCatalogo } from '@gps/estructura/dominio'
import {
  CATEGORIAS,
  type Categoria,
  type DatosDeIngreso,
  type DatosDePersona,
  type Problema,
  TIPOS_DE_CARGO,
  TIPOS_DE_DOCUMENTO,
  type TipoDeCargo,
  type TipoDeDocumento,
  validarIngreso,
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
  'focus:border-slate-900 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400'

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

export function AltaDePersona(props: { grupoId: string; ramasAbiertas: readonly Rama[] }) {
  const alta = useCrearPersona()
  const hoy = new Date()
  const vacio = (): DatosDeIngreso => ({
    grupoId: props.grupoId,
    categoria: 'beneficiario',
    // La primera rama abierta del grupo, no una fija: el <select> solo ofrece
    // las que el grupo tiene abiertas, asi que un default que no este ahi seria
    // un formulario que arranca invalido.
    rama: props.ramasAbiertas[0] ?? null,
    desde: aFechaDeCalendario(hoy),
    cargos: [],
  })

  const [datos, setDatos] = useState<DatosDePersona>(VACIO)
  const [ingreso, setIngreso] = useState<DatosDeIngreso>(vacio)
  const [problemas, setProblemas] = useState<readonly Problema[]>([])

  const problemaDe = (campo: Problema['campo']) =>
    problemas.find((problema) => problema.campo === campo)?.mensaje

  const cargoElegido = (cargo: TipoDeCargo) =>
    ingreso.cargos.find((elegido) => elegido.cargo === cargo)

  function alternarCargo(cargo: TipoDeCargo) {
    setIngreso({
      ...ingreso,
      cargos: cargoElegido(cargo)
        ? ingreso.cargos.filter((elegido) => elegido.cargo !== cargo)
        : [...ingreso.cargos, { cargo, hasta: null }],
    })
  }

  function cambiarHasta(cargo: TipoDeCargo, hasta: string) {
    setIngreso({
      ...ingreso,
      cargos: ingreso.cargos.map((elegido) =>
        elegido.cargo === cargo ? { ...elegido, hasta: hasta || null } : elegido,
      ),
    })
  }

  function cambiarCategoria(categoria: Categoria) {
    // Un adherente no pertenece a ninguna rama: limpiarla al cambiar evita que
    // el formulario quede en un estado que el dominio rechaza sin que se vea.
    setIngreso({
      ...ingreso,
      categoria,
      rama: categoria === 'adherente' ? null : (ingreso.rama ?? props.ramasAbiertas[0] ?? null),
    })
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    // Las mismas funciones puras que corre el servicio. Validar aca es la
    // experiencia de uso; que el servidor las corra igual es la garantia.
    const encontrados = [
      ...validarPersona(datos, hoy),
      ...validarIngreso(ingreso, props.ramasAbiertas, hoy),
    ]
    setProblemas(encontrados)
    if (encontrados.length > 0) return
    alta.mutate(
      // El tipo generado del input quiere cargos mutable; el del dominio es
      // readonly a proposito, asi que se copia solo en esta frontera.
      { datos, ingreso: { ...ingreso, cargos: [...ingreso.cargos] } },
      {
        onSuccess: () => {
          setDatos(VACIO)
          setIngreso(vacio())
        },
      },
    )
  }

  return (
    <form onSubmit={enviar} className="mt-8 space-y-3 rounded-lg bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Agregar una persona</h2>

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
          {/* type="date" es nativo: trae el calendario del sistema, es accesible
              sin trabajo, y emite exactamente el aaaa-mm-dd que espera el
              dominio. Ninguna dependencia hace falta. */}
          <input
            type="date"
            className={CLASE_DE_INPUT}
            value={datos.fechaDeNacimiento}
            onChange={(evento) => setDatos({ ...datos, fechaDeNacimiento: evento.target.value })}
          />
        </Campo>

        <Campo etiqueta="Categoría">
          <select
            className={CLASE_DE_INPUT}
            value={ingreso.categoria}
            onChange={(evento) => cambiarCategoria(evento.target.value as Categoria)}
          >
            {CATEGORIAS.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nombre}
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Rama" problema={problemaDe('rama')}>
          <select
            className={CLASE_DE_INPUT}
            // Un adherente es, por definicion, el que no esta en ninguna rama.
            disabled={ingreso.categoria === 'adherente'}
            value={ingreso.rama ?? ''}
            onChange={(evento) =>
              setIngreso({ ...ingreso, rama: (evento.target.value || null) as Rama | null })
            }
          >
            <option value="">—</option>
            {/* Solo las ramas abiertas del grupo. Es la misma regla que corre el
                servidor con estructura.obtenerGrupo, no una version aparte. */}
            {props.ramasAbiertas.map((rama) => {
              const catalogo = ramaDelCatalogo(rama)
              return (
                <option key={rama} value={rama}>
                  {catalogo ? `${catalogo.nombre} (${etiquetaDeEdades(catalogo)})` : rama}
                </option>
              )
            })}
          </select>
        </Campo>

        <Campo etiqueta="Ingresó el" problema={problemaDe('desde')}>
          {/* Se propone en hoy y se puede corregir: a alguien lo cargas en
              agosto y es jefa de rama desde marzo. */}
          <input
            type="date"
            className={CLASE_DE_INPUT}
            value={ingreso.desde}
            onChange={(evento) => setIngreso({ ...ingreso, desde: evento.target.value })}
          />
        </Campo>
      </div>

      <fieldset>
        <legend className="text-xs font-medium text-slate-600">Cargos</legend>
        <div className="mt-1 space-y-2">
          {TIPOS_DE_CARGO.map((tipo) => {
            const elegido = cargoElegido(tipo.id)
            return (
              <div key={tipo.id} className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(elegido)}
                    onChange={() => alternarCargo(tipo.id)}
                  />
                  {tipo.nombre}
                </label>
                {elegido && (
                  <label className="flex items-center gap-1 text-xs text-slate-500">
                    hasta
                    <input
                      type="date"
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                      value={elegido.hasta ?? ''}
                      onChange={(evento) => cambiarHasta(tipo.id, evento.target.value)}
                    />
                  </label>
                )}
              </div>
            )
          })}
        </div>
        {problemaDe('cargos') && (
          <p className="mt-1 text-xs text-red-700">{problemaDe('cargos')}</p>
        )}
      </fieldset>

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
  )
}
