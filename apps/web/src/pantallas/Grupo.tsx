import { periodoDe } from '@gps/afiliacion/dominio'
import { useAfiliadosEn, useDistritos, usePersonasDelGrupo } from '@gps/api'
import { aFechaDeCalendario } from '@gps/core/fechas'
import { etiquetaDeEdades, RAMAS } from '@gps/estructura/dominio'
import {
  calcularEdad,
  estaVigente,
  nombreCompleto,
  nombreDelCargo,
  nombreDelTipo,
} from '@gps/personas/dominio'
import { Link } from 'wouter'
import { AltaDePersona } from './AltaDePersona'

type Persona = NonNullable<ReturnType<typeof usePersonasDelGrupo>['data']>['personas'][number]

function FilaDePersona(props: { persona: Persona; hoy: Date; afiliada: boolean }) {
  // El "hasta" generado es opcional (string | null | undefined); el del
  // dominio es string | null a secas. Se normaliza solo en esta frontera.
  const vigentes = props.persona.cargos.filter((cargo) =>
    estaVigente({ desde: cargo.desde, hasta: cargo.hasta ?? null }, props.hoy),
  )
  return (
    <li className="px-4 py-3">
      <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
        {/* El signo va antes del nombre: a 375px es lo primero que se ve, y
            el lector de pantalla necesita el texto del span siguiente. */}
        <span aria-hidden="true" className={props.afiliada ? 'text-emerald-600' : 'text-slate-300'}>
          {props.afiliada ? '✓' : '✗'}
        </span>
        <span className="sr-only">{props.afiliada ? 'Afiliada' : 'Sin afiliar'}:</span>
        {nombreCompleto(props.persona)}
      </p>
      <p className="mt-0.5 text-xs text-slate-500">
        {nombreDelTipo(props.persona.tipoDeDocumento)} {props.persona.numeroDeDocumento}
        <span className="text-slate-400">
          {' · '}
          {calcularEdad(props.persona.fechaDeNacimiento, props.hoy)} años
        </span>
      </p>
      {vigentes.length > 0 && (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {vigentes.map((cargo) => (
            <li
              key={cargo.cargo}
              className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
            >
              {nombreDelCargo(cargo.cargo)}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function Seccion(props: {
  titulo: string
  detalle?: string
  personas: readonly Persona[]
  hoy: Date
  afiliados: ReadonlySet<string>
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-900">
        {props.titulo}
        {props.detalle && <span className="ml-1 font-normal text-slate-400">{props.detalle}</span>}
      </h3>
      {props.personas.length === 0 ? (
        <p className="mt-1 text-xs text-slate-400">Todavía no hay nadie</p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-200 rounded-lg bg-white shadow-sm">
          {props.personas.map((persona) => (
            <FilaDePersona
              key={persona.id}
              persona={persona}
              hoy={props.hoy}
              afiliada={props.afiliados.has(persona.id)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

export function Grupo(props: { id: string }) {
  const arbol = useDistritos()
  const lista = usePersonasDelGrupo(props.id)
  const hoy = new Date()

  const personas = lista.data?.personas ?? []
  // El periodo lo calcula el cliente, de su propio almanaque: es el mismo
  // criterio que estaVigente y que calcularEdad, que tampoco los resuelve el
  // servidor.
  const periodo = periodoDe(aFechaDeCalendario(hoy))
  const consulta = useAfiliadosEn(
    periodo,
    personas.map((persona) => persona.id),
  )
  const afiliados = new Set(consulta.data?.afiliadosEn ?? [])

  // Reusa la query del arbol en vez de estrenar grupo(id): TanStack Query ya la
  // tiene en cache porque venis de ahi, y de paso trae el distrito para el
  // encabezado. Son quince grupos; el dia que deje de entrar en una query se
  // agrega grupo(id) y se arregla en un solo lugar.
  const distrito = arbol.data?.distritos.find((candidato) =>
    candidato.grupos.some((grupo) => grupo.id === props.id),
  )
  const grupo = distrito?.grupos.find((candidato) => candidato.id === props.id)

  if (arbol.isPending || lista.isPending) {
    return <p className="mt-8 text-sm text-slate-500">Consultando el grupo…</p>
  }

  const error = arbol.error ?? lista.error
  if (error) {
    return (
      <p className="mt-8 rounded-lg bg-red-50 p-4 text-sm break-words text-red-800">
        No se pudo consultar el grupo: {error.message}
      </p>
    )
  }

  if (!grupo) {
    return (
      <p className="mt-8 rounded-lg bg-white p-4 text-sm text-slate-500 shadow-sm">
        No hay ningún grupo abierto con esa dirección.
      </p>
    )
  }

  const adherentes = personas.filter((persona) => persona.pertenencia.categoria === 'adherente')

  return (
    <>
      <Link href="/" className="mt-6 inline-block text-sm text-slate-500 hover:text-slate-900">
        ← Distrito {distrito?.numero}
      </Link>
      <h2 className="mt-1 text-lg font-semibold text-slate-900">
        <span className="text-slate-400">Grupo Scout Nº{grupo.numero} -</span> {grupo.nombre}
      </h2>
      <Link
        href={`/grupos/${props.id}/afiliacion`}
        className="mt-2 inline-block text-sm text-slate-500 hover:text-slate-900"
      >
        Afiliación →
      </Link>

      <div className="mt-6 space-y-6">
        {/* En el orden del catalogo, de menor a mayor edad: el mismo criterio
            que ordenarPorCatalogo en el servidor. Una rama abierta sin nadie se
            muestra vacia y no se esconde, porque es informacion. */}
        {RAMAS.filter((rama) => grupo.ramas.includes(rama.id)).map((rama) => {
          const suyas = personas.filter((persona) => persona.pertenencia.rama === rama.id)
          // Primero los dirigentes: son los que uno busca cuando abre la rama.
          const activos = suyas.filter((p) => p.pertenencia.categoria === 'activo')
          const beneficiarios = suyas.filter((p) => p.pertenencia.categoria === 'beneficiario')
          return (
            <Seccion
              key={rama.id}
              titulo={rama.nombre}
              detalle={etiquetaDeEdades(rama)}
              personas={[...activos, ...beneficiarios]}
              hoy={hoy}
              afiliados={afiliados}
            />
          )
        })}

        {grupo.ramas.length === 0 && (
          <p className="rounded-lg bg-white p-4 text-sm text-slate-500 shadow-sm">
            El grupo todavía no abrió ninguna rama.
          </p>
        )}

        <Seccion titulo="Adherentes" personas={adherentes} hoy={hoy} afiliados={afiliados} />
      </div>

      <AltaDePersona grupoId={props.id} ramasAbiertas={grupo.ramas} />
    </>
  )
}
