import { periodoDe } from '@gps/afiliacion/dominio'
import { useAfiliadosEn, useGrupo, usePersonasDelGrupo } from '@gps/api'
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
import {
  Accion,
  Bajar,
  CAMPO,
  Cargando,
  Chip,
  ChipDeRama,
  Falla,
  Filtros,
  Titulo,
  Vacio,
} from '../ui'

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

/** La píldora de afiliación. El período va escrito: pertenecer no es estar
 *  afiliado, y "afiliado" a secas no dice de cuándo. El sustantivo y no el
 *  adjetivo porque el padrón no guarda el género: "Afiliada" en la fila de
 *  Ignacio es un dato inventado. */
function Afiliacion(props: { afiliada: boolean; periodo: number }) {
  return (
    <Chip tono={props.afiliada ? 'ok' : 'warn'}>
      {props.afiliada ? `Afiliación ${props.periodo}` : 'Sin afiliar'}
    </Chip>
  )
}

export function Nomina(props: { grupoId: string }) {
  const arbol = useGrupo(props.grupoId)
  const { grupo, distrito } = arbol
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

  if (arbol.isPending || lista.isPending) return <Cargando>Consultando la nómina…</Cargando>

  const error = arbol.error ?? lista.error
  if (error) {
    return <Falla>No se pudo consultar la nómina: {error.message}</Falla>
  }

  if (!grupo) {
    return <Vacio>No hay ningún grupo abierto con esa dirección.</Vacio>
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
      {/* Lo mismo que encabeza el PDF: de qué grupo es y a qué día. Una nómina
          sin fecha no dice nada, ni en pantalla ni en papel. */}
      <Titulo acompaña={`${grupo.nombre} · Distrito ${distrito?.numero} · al ${fecha}`}>
        Nómina del grupo {grupo.numero}
      </Titulo>

      <div className="mt-5 flex flex-wrap gap-2">
        {/* Los dos formatos como dos botones y no un menu: son dos usos
            distintos -el PDF se presenta en el distrito, la planilla se trabaja
            en una hoja de calculo- y ninguno es el caso raro del otro. */}
        <Bajar href={`/grupos/${props.grupoId}/nomina.pdf?descargar`}>Exportar PDF</Bajar>
        <Bajar href={`/grupos/${props.grupoId}/nomina.xlsx?descargar`}>Exportar XLSX</Bajar>
        <Accion href={`/grupos/${props.grupoId}/alta`}>Agregar una persona</Accion>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <input
          type="search"
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
          placeholder="Buscar por apellido o documento"
          className={`${CAMPO} h-12 sm:max-w-80`}
        />
        <Filtros opciones={filtros} valor={filtro} onElegir={setFiltro} />
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
        <Vacio>
          No hay nadie con ese criterio. Probá con otro apellido o sacá el filtro de rama.
        </Vacio>
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
                        {fila.rama && <ChipDeRama rama={fila.rama} />}
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
