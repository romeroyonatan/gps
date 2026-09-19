import type { Marcas } from '@gps/core'

export const MEDIOS_DE_PAGO = ['transferencia', 'efectivo', 'otro'] as const
export type MedioDePago = (typeof MEDIOS_DE_PAGO)[number]

export type TipoDeMovimiento = 'cargo_afiliacion' | 'pago' | 'anulacion_pago'

export interface CuotaDeAfiliacion extends Marcas {
  readonly periodo: number
  readonly importe: number
}

/** El importe lleva el signo del libro: deuda positiva, pago negativo. */
export interface MovimientoDeTesoreria extends Marcas {
  readonly id: string
  readonly grupoId: string
  readonly fecha: string
  readonly tipo: TipoDeMovimiento
  readonly importe: number
  readonly periodo: number | null
  readonly declaracionId: string | null
  readonly cantidad: number | null
  readonly cuota: number | null
  readonly medioDePago: MedioDePago | null
  readonly referencia: string | null
  readonly observacion: string | null
  readonly anulaA: string | null
}

export interface CuentaDeGrupo {
  readonly grupoId: string
  readonly numero: number
  readonly nombre: string
  readonly cerrado: boolean
  /** Positivo es deuda; negativo, saldo a favor. */
  readonly saldo: number
}

export interface ResumenDePendientes {
  readonly cantidad: number
  readonly periodosSinCuota: readonly number[]
}

export interface ResultadoDeReconciliacion extends ResumenDePendientes {
  readonly creados: number
}
