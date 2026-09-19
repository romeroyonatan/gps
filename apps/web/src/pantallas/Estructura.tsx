import { useAlcance, useDistritos, useJefesDeGrupos } from '@gps/api'
import { aFechaDeCalendario } from '@gps/core/fechas'
import { etiquetaDeEdades, ramaDelCatalogo, type Unidad } from '@gps/estructura/dominio'
import { puedeVerPersonasDelGrupo } from '@gps/personas/dominio'
import { Link } from 'wouter'

/** El nombre propio y, en gris, el tramo de edad de su rama. Se muestra el
 *  nombre y no la rama porque es lo que distingue dos tropas del mismo grupo. */
function EtiquetaDeUnidad(props: { unidad: Pick<Unidad, 'rama' | 'nombre'> }) {
  const rama = ramaDelCatalogo(props.unidad.rama)
  if (!rama) return null
  return (
    <li className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
      {props.unidad.nombre} <span className="text-slate-400">{etiquetaDeEdades(rama)}</span>
    </li>
  )
}

function Grupo(props: {
  id: string
  numero: number
  nombre: string
  jefes: readonly string[]
  /** Si quien mira alcanza este grupo. El directorio los lista todos, pero el
   *  detalle -su gente, su cuenta, sus salidas- es del ámbito de cada uno: un
   *  grupo que no se va a poder abrir no se ofrece como enlace. */
  seAbre: boolean
  unidades: readonly Pick<Unidad, 'id' | 'rama' | 'nombre'>[]
}) {
  const contenido = (
    <>
      <p className={`text-sm font-medium ${props.seAbre ? 'text-slate-900' : 'text-slate-500'}`}>
        <span className="text-slate-400">Grupo Scout Nº{props.numero} -</span> {props.nombre}
      </p>
      {props.jefes.length > 0 && (
        <p className="mt-0.5 text-xs text-slate-500">{props.jefes.join(' · ')}</p>
      )}
      {props.unidades.length === 0 ? (
        <p className="mt-1.5 text-xs text-slate-400">Todavía no abrió ninguna unidad</p>
      ) : (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {props.unidades.map((unidad) => (
            <EtiquetaDeUnidad key={unidad.id} unidad={unidad} />
          ))}
        </ul>
      )}
    </>
  )

  return (
    <li>
      {props.seAbre ? (
        <Link
          href={`/grupos/${props.id}`}
          className="block px-4 py-3 hover:bg-slate-50 active:bg-slate-100"
        >
          {contenido}
        </Link>
      ) : (
        <div className="px-4 py-3">{contenido}</div>
      )}
    </li>
  )
}

export function Estructura() {
  const { data, isPending, error } = useDistritos()

  // El árbol lo da `estructura` y los jefes `personas`: son dos módulos, así
  // que son dos consultas y la pantalla cruza por id. El "hoy" es el de quien
  // mira, no el del servidor.
  const grupos = (data?.distritos ?? []).flatMap((distrito) =>
    distrito.grupos.map((grupo) => grupo.id),
  )
  const jefes = useJefesDeGrupos(grupos, aFechaDeCalendario(new Date()))
  const alcance = useAlcance()
  const porGrupo = new Map<string, string[]>()
  for (const jefe of jefes.data?.jefesDeGrupos ?? []) {
    const suyos = porGrupo.get(jefe.grupoId) ?? []
    suyos.push(`${jefe.nombres} ${jefe.apellidos}`)
    porGrupo.set(jefe.grupoId, suyos)
  }

  return (
    <>
      <Link href="/tesoreria" className="mt-6 inline-block text-sm font-medium text-slate-700">
        Tesorería →
      </Link>

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
                  id={grupo.id}
                  numero={grupo.numero}
                  nombre={grupo.nombre}
                  jefes={porGrupo.get(grupo.id) ?? []}
                  seAbre={alcance !== null && puedeVerPersonasDelGrupo(alcance, grupo.id)}
                  unidades={grupo.unidades}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  )
}
