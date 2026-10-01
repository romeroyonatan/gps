import { useInfiniteQuery } from '@tanstack/react-query'
import { AuditoriaDocument } from './generated/graphql'
import { useTransporte } from './proveedor'

export interface FiltrosDeAuditoria {
  readonly desde?: string
  readonly hasta?: string
  readonly grupoId?: string
  readonly actorPersonaId?: string
  readonly modulo?: string
  readonly accion?: string
}

/** Historial paginado por cursor, del más reciente al más antiguo. El
 *  servidor ya intersecta los filtros con el alcance de quien pregunta: acá
 *  no hay que repetir esa regla, sólo mostrar lo que vuelve. */
function parametrosDeAuditoria(filtros: FiltrosDeAuditoria) {
  const params = new URLSearchParams()
  for (const [clave, valor] of Object.entries(filtros)) if (valor) params.set(clave, valor)
  return params.toString()
}

export function rutaDeExportacionDeAuditoria(filtros: FiltrosDeAuditoria) {
  return `/auditoria.xlsx?${parametrosDeAuditoria(filtros)}`
}

export function useAuditoria(filtros: FiltrosDeAuditoria) {
  const transporte = useTransporte()
  return useInfiniteQuery({
    queryKey: ['auditoria', filtros],
    queryFn: ({ pageParam }) =>
      transporte.ejecutar(AuditoriaDocument, { ...filtros, cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (ultima) => ultima.auditoria.cursorSiguiente,
  })
}
