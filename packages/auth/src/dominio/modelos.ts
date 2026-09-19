import type { Marcas } from '@gps/core'

export type ProveedorDeIdentidad = 'google' | 'apple' | 'demo'

export interface IdentidadExterna extends Marcas {
  readonly id: string
  readonly personaId: string
  readonly proveedor: ProveedorDeIdentidad
  readonly subject: string
  readonly desactivadaEn: Date | null
}

export interface Sesion extends Marcas {
  readonly id: string
  readonly personaId: string
  readonly identidadId: string
  readonly expiraEn: Date
  readonly revocadaEn: Date | null
  readonly elevadaHasta: Date | null
}

export interface SesionAutenticada {
  readonly sesionId: string
  readonly personaId: string
  readonly identidadId: string
  readonly estaElevada: boolean
}
