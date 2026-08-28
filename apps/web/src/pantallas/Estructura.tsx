import { useDistritos } from '@gps/api'
import { etiquetaDeEdades, RAMAS, type Rama } from '@gps/estructura/dominio'

const RAMA_POR_ID = new Map(RAMAS.map((rama) => [rama.id, rama]))

function EtiquetaDeRama(props: { rama: Rama }) {
  const rama = RAMA_POR_ID.get(props.rama)
  if (!rama) return null
  const edades = etiquetaDeEdades(rama)
  return (
    <li className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
      {rama.nombre} <span className="text-slate-400">{edades}</span>
    </li>
  )
}

function Grupo(props: { numero: number; nombre: string; ramas: readonly Rama[] }) {
  return (
    <li className="px-4 py-3">
      <p className="text-sm font-medium text-slate-900">
        <span className="text-slate-400">Grupo Scout Nº{props.numero} -</span> {props.nombre}
      </p>
      {props.ramas.length === 0 ? (
        <p className="mt-1.5 text-xs text-slate-400">Todavía no abrió ninguna rama</p>
      ) : (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {props.ramas.map((rama) => (
            <EtiquetaDeRama key={rama} rama={rama} />
          ))}
        </ul>
      )}
    </li>
  )
}

export function Estructura() {
  const { data, isPending, error } = useDistritos()

  return (
    <>
      {isPending && <p className="mt-8 text-sm text-slate-500">Consultando la estructura…</p>}

      {error && (
        <p className="mt-8 rounded-lg bg-red-50 p-4 text-sm break-words text-red-800">
          No se pudo consultar la estructura: {error.message}
        </p>
      )}

      {data?.distritos.length === 0 && (
        <p className="mt-8 rounded-lg bg-white p-4 text-sm text-slate-500 shadow-sm">
          No hay distritos cargados todavía.
        </p>
      )}

      <div className="mt-8 space-y-6">
        {data?.distritos.map((distrito) => (
          <section key={distrito.id}>
            <h2 className="text-sm font-semibold text-slate-900">Distrito {distrito.numero}</h2>
            <p className="text-xs text-slate-500">{distrito.zona}</p>
            <ul className="mt-2 divide-y divide-slate-200 rounded-lg bg-white shadow-sm">
              {distrito.grupos.map((grupo) => (
                <Grupo
                  key={grupo.id}
                  numero={grupo.numero}
                  nombre={grupo.nombre}
                  ramas={grupo.ramas}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  )
}
