import { periodoDe } from '@gps/afiliacion/dominio'
import { useAfiliadosEn, useDistritos, usePersonasDelGrupo } from '@gps/api'
import { aFechaDeCalendario } from '@gps/core/fechas'
import { type Rama, ramaDelCatalogo } from '@gps/estructura/dominio'
import {
  CATEGORIAS,
  type Categoria,
  estaVigente,
  nombreCompleto,
  nombreDelCargo,
  nombreDelTipo,
} from '@gps/personas/dominio'
import { useState } from 'react'
import { Link } from 'wouter'
import { COLOR_DE_RAMA } from '../ramas'

type Persona = NonNullable<ReturnType<typeof usePersonasDelGrupo>['data']>['personas'][number]

/** Una línea de la nómina, ya resuelta: acá no queda nada por cruzar. Es la de
 *  la pantalla; la de los archivos la arma `armarLaNomina` en el servidor, con
 *  las mismas reglas de orden y numeración. */
interface Fila {
  id: string
  numero: number
  nombre: string
  documento: string
  rama: Rama | null
  cargo: string
  afiliada: boolean
}

/** Las tres categorías en orden, con numeración corrida entre ellas: es como se
 *  presenta la nómina en el distrito, y como la lee la declaración. */
function armarFilas(
  personas: readonly Persona[],
  ramaDeUnidad: ReadonlyMap<string, Rama>,
  afiliados: ReadonlySet<string>,
  hoy: Date,
): { categoria: Categoria; nombre: string; filas: Fila[] }[] {
  let numero = 0
  return CATEGORIAS.map((categoria) => ({
    categoria: categoria.id,
    nombre: categoria.nombre,
    filas: personas
      .filter((persona) => persona.pertenencia.categoria === categoria.id)
      .map((persona) => {
        numero += 1
        // El "hasta" generado es opcional (string | null | undefined); el del
        // dominio es string | null a secas. Se normaliza solo en esta frontera.
        const vigentes = persona.cargos.filter((cargo) =>
          estaVigente({ desde: cargo.desde, hasta: cargo.hasta ?? null }, hoy),
        )
        return {
          id: persona.id,
          numero,
          nombre: nombreCompleto(persona),
          documento: `${nombreDelTipo(persona.tipoDeDocumento)} ${persona.numeroDeDocumento}`,
          rama: persona.pertenencia.unidadId
            ? (ramaDeUnidad.get(persona.pertenencia.unidadId) ?? null)
            : null,
          cargo: vigentes.map((cargo) => nombreDelCargo(cargo.cargo)).join(' · '),
          afiliada: afiliados.has(persona.id),
        }
      }),
  }))
}

function nombreDeRama(rama: Rama | null): string {
  return rama ? (ramaDelCatalogo(rama)?.nombre ?? rama) : ''
}

/** El estado se lee, no se adivina: la píldora siempre lleva su texto y el
 *  color es refuerzo. */
function Afiliacion(props: { afiliada: boolean; periodo: number }) {
  return (
    <span
      className={`inline-flex min-h-[26px] shrink-0 items-center rounded-full px-2.5 py-0.5 text-label font-semibold whitespace-nowrap ${props.afiliada ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn'}`}
    >
      {/* El período va escrito: pertenecer no es estar afiliado, y "afiliado" a
          secas no dice de cuándo. El sustantivo y no el adjetivo porque el
          padrón no guarda el género: "Afiliada" en la fila de Ignacio es un
          dato inventado. */}
      {props.afiliada ? `Afiliación ${props.periodo}` : 'Sin afiliar'}
    </span>
  )
}

function Chip(props: { rama: Rama }) {
  return (
    <span className="inline-flex min-h-[24px] items-center gap-1.5 rounded-full bg-surface-3 px-2.5 py-0.5 text-label font-medium text-ink-muted whitespace-nowrap">
      <span className={`size-2 rounded-full ${COLOR_DE_RAMA[props.rama]}`} aria-hidden="true" />
      {nombreDeRama(props.rama)}
    </span>
  )
}

/** Los dos archivos los arma el servidor y se bajan con un link, igual que el
 *  PDF del permiso de salida: un binario no viaja por GraphQL, y asi el
 *  navegador -y el telefono- lo abre con la aplicacion que corresponde. */
function Bajar(props: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={props.href}
      className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line-strong px-3.5 text-sm font-semibold hover:bg-surface-3"
    >
      {props.children}
    </a>
  )
}

export function Nomina(props: { grupoId: string }) {
  const arbol = useDistritos()
  const lista = usePersonasDelGrupo(props.grupoId)
  const [busqueda, setBusqueda] = useState('')
  // 'todas' | 'sin-afiliar' | una rama. Uno solo: son recortes de la misma
  // lista y combinarlos no responde ninguna pregunta que alguien se haga.
  const [filtro, setFiltro] = useState<string>('todas')
  const hoy = new Date()

  const personas = lista.data?.personas ?? []
  const periodo = periodoDe(aFechaDeCalendario(hoy))
  const consulta = useAfiliadosEn(
    periodo,
    personas.map((persona) => persona.id),
  )
  const afiliados = new Set(consulta.data?.afiliadosEn ?? [])

  const distrito = arbol.data?.distritos.find((candidato) =>
    candidato.grupos.some((grupo) => grupo.id === props.grupoId),
  )
  const grupo = distrito?.grupos.find((candidato) => candidato.id === props.grupoId)

  if (arbol.isPending || lista.isPending) {
    return <p className="text-sm text-ink-muted">Consultando la nómina…</p>
  }

  const error = arbol.error ?? lista.error
  if (error) {
    return (
      <p className="rounded-lg bg-danger-soft p-4 text-sm break-words text-danger">
        No se pudo consultar la nómina: {error.message}
      </p>
    )
  }

  if (!grupo) {
    return (
      <p className="rounded-lg border border-line-strong p-4 text-sm text-ink-muted">
        No hay ningún grupo abierto con esa dirección.
      </p>
    )
  }

  // La rama es de la unidad, no de la persona: los adherentes no tienen.
  const ramaDeUnidad = new Map(grupo.unidades.map((unidad) => [unidad.id, unidad.rama]))
  const ramas = [...new Set(grupo.unidades.map((unidad) => unidad.rama))]

  const secciones = armarFilas(personas, ramaDeUnidad, afiliados, hoy)
    .map((seccion) => ({
      ...seccion,
      filas: seccion.filas.filter((fila) => {
        if (filtro === 'sin-afiliar' && fila.afiliada) return false
        if (filtro !== 'todas' && filtro !== 'sin-afiliar' && fila.rama !== filtro) return false
        const buscado = busqueda.trim().toLowerCase()
        if (!buscado) return true
        return (
          fila.nombre.toLowerCase().includes(buscado) ||
          fila.documento.toLowerCase().replaceAll('.', '').includes(buscado.replaceAll('.', ''))
        )
      }),
    }))
    .filter((seccion) => seccion.filas.length > 0)

  const visibles = secciones.flatMap((seccion) => seccion.filas)
  const recorte =
    filtro === 'todas'
      ? 'la nómina completa'
      : filtro === 'sin-afiliar'
        ? 'sin afiliar'
        : nombreDeRama(filtro as Rama)
  const fecha = aFechaDeCalendario(hoy)

  const filtros = [
    { id: 'todas', etiqueta: 'Todas' },
    ...ramas.map((rama) => ({ id: rama, etiqueta: nombreDeRama(rama) })),
    { id: 'sin-afiliar', etiqueta: 'Sin afiliar' },
  ]

  return (
    <>
      <Link href={`/grupos/${props.grupoId}`} className="text-label text-ink-muted hover:text-ink">
        ← Grupo {grupo.numero}
      </Link>

      {/* Lo mismo que encabeza el PDF: de qué grupo es y a qué día. Una nómina
          sin fecha no dice nada, ni en pantalla ni en papel. */}
      <h2 className="mt-1 text-2xl font-bold">Nómina del grupo {grupo.numero}</h2>
      <p className="mt-1 text-sm text-ink-muted">
        {grupo.nombre} · Distrito {distrito?.numero} · al {fecha}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {/* Los dos formatos como dos botones y no un menu: son dos usos
            distintos -el PDF se presenta en el distrito, la planilla se trabaja
            en una hoja de calculo- y ninguno es el caso raro del otro. */}
        <Bajar href={`/grupos/${props.grupoId}/nomina.pdf?descargar`}>Exportar PDF</Bajar>
        <Bajar href={`/grupos/${props.grupoId}/nomina.xlsx?descargar`}>Exportar XLSX</Bajar>
        <Link
          href={`/grupos/${props.grupoId}/alta`}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-3.5 text-sm font-semibold text-accent-ink hover:bg-accent-strong"
        >
          Agregar una persona
        </Link>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <input
          type="search"
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
          placeholder="Buscar por apellido o documento"
          className="h-12 w-full rounded-lg border border-line-strong px-3.5 text-base sm:max-w-80"
        />
        <div className="flex flex-wrap gap-2">
          {filtros.map((uno) => (
            <button
              key={uno.id}
              type="button"
              onClick={() => setFiltro(uno.id)}
              className={`inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-semibold ${
                filtro === uno.id
                  ? 'border-accent bg-accent text-accent-ink'
                  : 'border-line-strong hover:bg-surface-3'
              }`}
            >
              {uno.etiqueta}
            </button>
          ))}
        </div>
      </div>

      {/* La búsqueda y los filtros son para mirar: los archivos salen siempre
          con la nómina entera, que es lo que se presenta. Se dice acá para que
          nadie exporte creyendo que se lleva el recorte.
          ponytail: si alguna vez hace falta exportar el recorte, el filtro viaja
          en la URL de la ruta y lo aplica el servidor sobre las mismas filas. */}
      <p className="mt-4 text-label tabular-nums text-ink-faint">
        {visibles.length} de {personas.length} personas · {recorte} · los archivos salen completos
      </p>

      {visibles.length === 0 ? (
        <p className="mt-5 rounded-lg border border-dashed border-line-strong p-4 text-sm text-ink-muted">
          No hay nadie con ese criterio. Probá con otro apellido o sacá el filtro de rama.
        </p>
      ) : (
        <div className="mt-2 space-y-6">
          {secciones.map((seccion) => (
            <section key={seccion.categoria}>
              <h3 className="text-lg font-bold">
                {seccion.nombre}s
                <span className="ml-2 text-label font-medium tabular-nums text-ink-muted">
                  {seccion.filas.length}
                </span>
              </h3>
              <ul className="mt-2">
                {seccion.filas.map((fila) => (
                  <li
                    key={fila.id}
                    className="flex min-h-[72px] items-center gap-3 border-b border-line py-3 last:border-b-0"
                  >
                    <span className="w-7 shrink-0 text-right text-label tabular-nums text-ink-faint">
                      {fila.numero}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{fila.nombre}</p>
                      <p className="mt-0.5 text-xs tabular-nums text-ink-muted">{fila.documento}</p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-2">
                        {fila.rama && <Chip rama={fila.rama} />}
                        {fila.cargo && <span className="text-xs text-ink-faint">{fila.cargo}</span>}
                      </p>
                    </div>
                    <Afiliacion afiliada={fila.afiliada} periodo={periodo} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* Las declaraciones son el otro lado de esta misma lista: la foto que se
          manda, contra el padrón de hoy. */}
      <Link
        href={`/grupos/${props.grupoId}/afiliacion`}
        className="mt-7 inline-block text-sm text-ink-muted hover:text-ink"
      >
        Declaraciones de afiliación →
      </Link>
    </>
  )
}
