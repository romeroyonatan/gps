import { type PermisosQuery, useActor, useDistritos, usePermisos } from '@gps/api'
import type { Actor } from '@gps/core'
import {
  firmantesRequeridos,
  puedeAdministrarPermisosDelGrupo,
  puedeFirmarEnLaApp,
  resumenDeParticipantes,
} from '@gps/salidas/dominio'
import { Link } from 'wouter'
import { Accion, Cargando, Chip, Falla, Titulo, Vacio } from '../ui'
import { estadoDelPermiso } from './Salida'

type Permiso = PermisosQuery['permisos'][number]

/** Una salida en la lista: en qué anda y nada más. Todo lo que se toca
 *  —armarla, firmarla, adjuntarle algo— vive en su pantalla, así que la fila
 *  entera es el enlace y no hay un solo control acá adentro. */
function Fila(props: {
  permiso: Permiso
  grupoId: string
  distritoId: string | undefined
  actor: Actor | null
}) {
  const { permiso } = props

  // La misma política pura que aplica el servidor, igual que en el detalle:
  // "pendiente de tu firma" tiene que querer decir lo mismo en los dos lados.
  const firmantes = props.distritoId ? firmantesRequeridos(props.grupoId, props.distritoId) : []
  const miFirmaPendiente = permiso.firmas.some((firma) => {
    if (firma.firmada) return false
    const firmante = firmantes.find((uno) => uno.cargo === firma.cargo)
    return (
      props.actor !== null && firmante !== undefined && puedeFirmarEnLaApp(props.actor, firmante)
    )
  })
  const estado = estadoDelPermiso(permiso, miFirmaPendiente)

  return (
    <li className="border-b border-line last:border-b-0">
      <Link
        href={`/grupos/${props.grupoId}/salidas/${permiso.id}`}
        className="flex min-h-[72px] flex-col justify-center gap-1 py-3 active:bg-surface-3"
      >
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0 font-semibold">{permiso.lugar}</span>
          <Chip tono={estado.tono}>{estado.texto}</Chip>
        </span>
        <span className="text-label tabular-nums text-ink-muted">
          {permiso.desde} a {permiso.hasta}
          {permiso.estado !== 'borrador' && permiso.emitidos.length > 0 && (
            <>
              {' · '}
              {resumenDeParticipantes(
                permiso.emitidos.map((uno) => ({
                  marca: uno.marca as 'dirigente' | 'beneficiario',
                })),
              )}
            </>
          )}
        </span>
      </Link>
    </li>
  )
}

export function Salidas(props: { grupoId: string }) {
  const consulta = usePermisos(props.grupoId)
  const arbol = useDistritos()
  const actor = useActor()

  const distrito = arbol.data?.distritos.find((candidato) =>
    candidato.grupos.some((grupo) => grupo.id === props.grupoId),
  )
  const administra = actor !== null && puedeAdministrarPermisosDelGrupo(actor, props.grupoId)
  const permisos = consulta.data?.permisos ?? []

  return (
    <>
      <Titulo>Salidas</Titulo>

      {administra && (
        <div className="mt-5">
          <Accion href={`/grupos/${props.grupoId}/salidas/nueva`}>Nueva salida</Accion>
        </div>
      )}

      {consulta.isPending && <Cargando>Consultando…</Cargando>}
      {consulta.error && (
        <Falla>No se pudieron consultar los permisos: {consulta.error.message}</Falla>
      )}

      <ul className="mt-5">
        {permisos.map((permiso) => (
          <Fila
            key={permiso.id}
            permiso={permiso}
            grupoId={props.grupoId}
            distritoId={distrito?.id}
            actor={actor}
          />
        ))}
      </ul>

      {permisos.length === 0 && !consulta.isPending && (
        <Vacio>El grupo todavía no cargó ninguna salida.</Vacio>
      )}
    </>
  )
}
