import type { CambioDeAuditoria, ValorDeAuditoria } from '@gps/core'

export interface EventoDeAuditoria {
  readonly id: string
  readonly ocurridoEn: Date
  readonly actorPersonaId: string | null
  readonly actorNombre: string | null
  readonly origenInterno: string | null
  readonly modulo: string
  readonly accion: string
  readonly resultado: 'exitoso' | 'rechazado'
  readonly elevado: boolean
  readonly grupoId: string | null
  readonly grupoNombre: string | null
  readonly entidadTipo: string | null
  readonly entidadId: string | null
  readonly objetivoPersonaId: string | null
  readonly objetivoNombre: string | null
  readonly resumen: Readonly<Record<string, ValorDeAuditoria>>
  readonly cambios: readonly CambioDeAuditoria[]
}

export interface FiltrosDeAuditoria {
  readonly desde?: Date
  readonly hasta?: Date
  readonly grupoId?: string
  readonly actorPersonaId?: string
  readonly modulo?: string
  readonly accion?: string
  readonly cursor?: string
  readonly limite?: number
}

export interface PaginaDeAuditoria {
  readonly eventos: readonly EventoDeAuditoria[]
  readonly cursorSiguiente: string | null
}
