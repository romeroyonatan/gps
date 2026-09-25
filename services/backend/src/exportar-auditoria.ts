import {
  type EventoDeAuditoria,
  etiquetaDeAccion,
  etiquetaDeModulo,
  type FiltrosDeAuditoria,
  gruposAuditables,
  quienActuo,
} from '@gps/auditoria/dominio'
import { AuditoriaDenegada } from '@gps/auditoria/servidor'
import { alcanceDe, type Context, type Logger } from '@gps/core'
import { comoXlsx } from '@gps/core/xlsx'

function filtrosDe(url: string): FiltrosDeAuditoria {
  const params = new URL(url).searchParams
  const fecha = (clave: string) => {
    const valor = params.get(clave)
    if (!valor) return undefined
    const instante = new Date(valor)
    if (Number.isNaN(instante.getTime())) throw new Error(`Fecha ${clave} inválida.`)
    return instante
  }
  return {
    desde: fecha('desde'),
    hasta: fecha('hasta'),
    grupoId: params.get('grupoId') || undefined,
    actorPersonaId: params.get('actorPersonaId') || undefined,
    modulo: params.get('modulo') || undefined,
    accion: params.get('accion') || undefined,
  }
}

/** El cursor recorre todo el recorte: no sólo los 30 eventos de la pantalla. */
export async function eventosParaExportar(contexto: Context, filtros: FiltrosDeAuditoria) {
  const alcance = alcanceDe(contexto)
  const eventos: EventoDeAuditoria[] = []
  let cursor: string | undefined
  do {
    const pagina = await contexto.auditoria.listar(alcance, { ...filtros, cursor, limite: 100 })
    eventos.push(...pagina.eventos)
    cursor = pagina.cursorSiguiente ?? undefined
  } while (cursor)
  return eventos
}

const hora = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Argentina/Buenos_Aires',
})

export function xlsxDeAuditoria(eventos: readonly EventoDeAuditoria[]): Uint8Array {
  return comoXlsx('Auditoría', [
    [
      'ID evento',
      'Fecha y hora (Argentina)',
      'Acción',
      'Actor',
      'Módulo',
      'Resultado',
      'Elevado',
      'Grupo',
      'Persona afectada',
      'Tipo de entidad',
      'ID de entidad',
      'Resumen',
      'Cambios',
    ],
    ...eventos.map((evento) => [
      evento.id,
      hora.format(evento.ocurridoEn),
      etiquetaDeAccion(evento.accion),
      quienActuo(evento),
      etiquetaDeModulo(evento.modulo),
      evento.resultado,
      evento.elevado ? 'Sí' : 'No',
      evento.grupoNombre ?? evento.grupoId ?? '',
      evento.objetivoNombre ?? evento.objetivoPersonaId ?? '',
      evento.entidadTipo ?? '',
      evento.entidadId ?? '',
      JSON.stringify(evento.resumen),
      JSON.stringify(evento.cambios),
    ]),
  ])
}

export async function rutaDeExportacionDeAuditoria(
  contexto: Context,
  logger: Logger,
  pedido: Request,
): Promise<Response> {
  try {
    if (!contexto.alcance) return new Response('Necesitás iniciar sesión.', { status: 401 })
    if (gruposAuditables(contexto.alcance.actor)?.length === 0)
      return new Response('No tenés acceso a la auditoría.', { status: 403 })
    const eventos = await eventosParaExportar(contexto, filtrosDe(pedido.url))
    return new Response(xlsxDeAuditoria(eventos) as BlobPart, {
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': 'attachment; filename="auditoria.xlsx"',
        'cache-control': 'no-store',
      },
    })
  } catch (error) {
    if (error instanceof AuditoriaDenegada) return new Response(error.message, { status: 403 })
    if (error instanceof Error && error.message.startsWith('Fecha '))
      return new Response(error.message, { status: 400 })
    logger.error('Error exportando auditoría', {
      error: error instanceof Error ? error.message : String(error),
    })
    return new Response('No se pudo exportar la auditoría.', { status: 500 })
  }
}
