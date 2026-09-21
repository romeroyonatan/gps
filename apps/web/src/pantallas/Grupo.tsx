import { periodoDe } from '@gps/afiliacion/dominio'
import {
  useActor,
  useAfiliadosEn,
  useGrupo,
  usePermisos,
  usePersonasDelGrupo,
  useTesoreria,
} from '@gps/api'
import { aFechaDeCalendario } from '@gps/core/fechas'
import type { Rama } from '@gps/estructura/dominio'
import type { TipoDeCargo } from '@gps/personas/dominio'
import { puedeFirmarComo, repartirSalidas } from '@gps/salidas/dominio'
import { Link } from 'wouter'
import { COLOR_DE_RAMA } from '../ramas'
import {
  BOTON_PRINCIPAL,
  Cargando,
  ChipDeRama,
  Falla,
  Pendiente,
  Saldo,
  Seccion,
  Titulo,
  Vacio,
} from '../ui'

/** La distribución por rama: barra de proporciones más una etiqueta por rama
 *  con su nombre escrito. El color nunca viaja solo. */
function PorRama(props: { total: number; ramas: readonly { rama: Rama; cuantos: number }[] }) {
  if (props.total === 0) return null
  return (
    <>
      <div className="mt-3.5 flex h-2.5 overflow-hidden rounded-full">
        {props.ramas.map((una) => (
          <span
            key={una.rama}
            className={COLOR_DE_RAMA[una.rama]}
            style={{ width: `${(una.cuantos / props.total) * 100}%` }}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {props.ramas.map((una) => (
          <li key={una.rama}>
            <ChipDeRama rama={una.rama}>
              <strong className="tabular-nums">{una.cuantos}</strong>
            </ChipDeRama>
          </li>
        ))}
      </ul>
    </>
  )
}

export function Grupo(props: { id: string }) {
  const arbol = useGrupo(props.id)
  const { grupo, distrito } = arbol
  const lista = usePersonasDelGrupo(props.id)
  const permisos = usePermisos(props.id)
  const tesoreria = useTesoreria()
  const actor = useActor()
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

  if (arbol.isPending || lista.isPending) return <Cargando>Consultando el grupo…</Cargando>

  const error = arbol.error ?? lista.error
  if (error) {
    return <Falla>No se pudo consultar el grupo: {error.message}</Falla>
  }

  if (!grupo) {
    return <Vacio>No hay ningún grupo abierto con esa dirección.</Vacio>
  }

  const sinAfiliar = personas.filter((persona) => !afiliados.has(persona.id)).length

  // Por rama, contando por la unidad a la que pertenece cada quien: la rama es
  // de la unidad, no de la persona. Se listan sólo las ramas con gente.
  const ramaDeUnidad = new Map(grupo.unidades.map((unidad) => [unidad.id, unidad.rama]))
  const porRama = new Map<Rama, number>()
  for (const persona of personas) {
    const rama = persona.pertenencia.unidadId
      ? ramaDeUnidad.get(persona.pertenencia.unidadId)
      : undefined
    if (rama) porRama.set(rama, (porRama.get(rama) ?? 0) + 1)
  }
  const ramas = [...porRama].map(([rama, cuantos]) => ({ rama, cuantos }))
  const enRamas = ramas.reduce((suma, una) => suma + una.cuantos, 0)

  // El reparto es la misma función pura que usa la pantalla de salidas, así
  // que "espera tu firma" quiere decir lo mismo en los dos lados.
  const puedoFirmar = (cargo: TipoDeCargo) => puedeFirmarComo(actor, cargo, props.id, distrito?.id)
  const reparto = repartirSalidas(
    permisos.data?.permisos ?? [],
    aFechaDeCalendario(hoy),
    puedoFirmar,
  )
  const esperanFirma = reparto.esperanMiFirma.length

  // Sólo las pilas con algo: una fila que dice "0" no informa nada y empuja
  // hacia abajo a las que sí.
  const filasDeSalidas = [
    {
      titulo: 'Esperan tu firma',
      detalle: `La más próxima, ${[...reparto.esperanMiFirma].sort((a, b) => a.desde.localeCompare(b.desde))[0]?.desde}`,
      cuantas: reparto.esperanMiFirma.length,
    },
    {
      titulo: 'Firmadas, falta el resto',
      detalle: 'Sin acción de tu parte',
      cuantas: reparto.esperanOtraFirma.length,
    },
    {
      titulo: 'Próximas',
      detalle: [...reparto.proximas]
        .sort((a, b) => a.desde.localeCompare(b.desde))
        .map((una) => `${una.lugar} · ${una.desde}`)[0],
      cuantas: reparto.proximas.length,
    },
  ].filter((fila) => fila.cuantas > 0)

  const cuenta = tesoreria.data?.cuentasDeGrupos.find((una) => una.grupoId === props.id)

  return (
    <>
      <Titulo>
        Grupo {grupo.numero} — {grupo.nombre}
      </Titulo>

      {esperanFirma > 0 && (
        <Pendiente>
          <p className="font-semibold text-warn">
            {esperanFirma === 1
              ? '1 salida espera tu firma'
              : `${esperanFirma} salidas esperan tu firma`}
          </p>
          <Link href={`/grupos/${props.id}/salidas`} className={`${BOTON_PRINCIPAL} mt-3 sm:w-fit`}>
            Ver salidas
          </Link>
        </Pendiente>
      )}

      <Seccion
        titulo="Integrantes"
        enlace={{ texto: 'Ver nómina', href: `/grupos/${props.id}/nomina` }}
      >
        <p className="mt-1.5 flex items-baseline gap-2.5">
          <span className="text-3xl font-bold tabular-nums">{personas.length}</span>
          <span className="text-sm text-ink-muted">
            pertenecen · {sinAfiliar} sin afiliar en {periodo}
          </span>
        </p>
        <PorRama total={enRamas} ramas={ramas} />
      </Seccion>

      {cuenta && (
        <Seccion
          titulo="Cuenta corriente"
          enlace={{ texto: 'Ver movimientos', href: `/tesoreria/grupos/${props.id}` }}
        >
          <Saldo importe={cuenta.saldo} className="mt-1.5" />
        </Seccion>
      )}

      <Seccion
        titulo="Salidas"
        enlace={{ texto: 'Ver todas', href: `/grupos/${props.id}/salidas` }}
      >
        {!permisos.data ? (
          <p className="mt-1.5 text-sm text-ink-muted">Consultando las salidas…</p>
        ) : filasDeSalidas.length === 0 ? (
          <p className="mt-1.5 text-sm text-ink-muted">
            {permisos.data.permisos.length === 0
              ? 'El grupo todavía no cargó ninguna salida.'
              : 'Ninguna salida espera nada por ahora.'}
          </p>
        ) : (
          <ul className="mt-2">
            {filasDeSalidas.map((fila) => (
              <li
                key={fila.titulo}
                className="flex min-h-[52px] items-center justify-between gap-3 border-b border-line last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{fila.titulo}</p>
                  <p className="text-label tabular-nums text-ink-muted">{fila.detalle}</p>
                </div>
                <span className="shrink-0 text-xl font-bold tabular-nums">{fila.cuantas}</span>
              </li>
            ))}
          </ul>
        )}
      </Seccion>
    </>
  )
}
