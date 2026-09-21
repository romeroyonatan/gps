import { useAlcance, useDistritos, useJefesDeGrupos } from '@gps/api'
import { aFechaDeCalendario } from '@gps/core/fechas'
import { etiquetaDeEdades, ramaDelCatalogo, type Unidad } from '@gps/estructura/dominio'
import { puedeVerPersonasDelGrupo } from '@gps/personas/dominio'
import { Link } from 'wouter'
import { Cargando, ChipDeRama, Falla, Titulo, Vacio } from '../ui'

/** El nombre propio de la unidad y, en gris, el tramo de edad de su rama. Se
 *  muestra el nombre y no la rama porque es lo que distingue dos tropas del
 *  mismo grupo; la rama viaja igual, en el punto de color de la etiqueta. */
function EtiquetaDeUnidad(props: { unidad: Pick<Unidad, 'rama' | 'nombre'> }) {
  const rama = ramaDelCatalogo(props.unidad.rama)
  if (!rama) return null
  return (
    <li>
      <ChipDeRama rama={props.unidad.rama}>
        <span className="font-normal text-ink-faint">
          {props.unidad.nombre} · {etiquetaDeEdades(rama)}
        </span>
      </ChipDeRama>
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
      <p className={`text-sm font-semibold ${props.seAbre ? 'text-ink' : 'text-ink-muted'}`}>
        <span className="font-normal text-ink-faint">Grupo Scout Nº{props.numero} —</span>{' '}
        {props.nombre}
      </p>
      {props.jefes.length > 0 && (
        <p className="mt-0.5 text-xs text-ink-muted">{props.jefes.join(' · ')}</p>
      )}
      {props.unidades.length === 0 ? (
        <p className="mt-1.5 text-xs text-ink-faint">Todavía no abrió ninguna unidad</p>
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
    <li className="border-b border-line last:border-b-0">
      {props.seAbre ? (
        <Link
          href={`/grupos/${props.id}`}
          className="flex min-h-[72px] flex-col justify-center py-3 active:bg-surface-3"
        >
          {contenido}
        </Link>
      ) : (
        <div className="flex min-h-[72px] flex-col justify-center py-3">{contenido}</div>
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
      <Titulo enlace={{ texto: 'Tesorería', href: '/tesoreria' }}>Directorio</Titulo>

      {isPending && <Cargando>Consultando la estructura…</Cargando>}
      {error && <Falla>No se pudo consultar la estructura: {error.message}</Falla>}
      {data?.distritos.length === 0 && <Vacio>No hay distritos cargados todavía.</Vacio>}

      <div className="mt-6 space-y-6">
        {data?.distritos.map((distrito) => (
          <section key={distrito.id}>
            <h3 className="text-lg font-bold">Distrito {distrito.numero}</h3>
            <p className="text-label text-ink-muted">{distrito.zona}</p>
            <ul className="mt-2">
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
