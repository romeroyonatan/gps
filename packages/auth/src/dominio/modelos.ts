import type { Marcas } from '@gps/core'

/** El proveedor externo con el que se prueba una identidad. `demo` es el
 *  proveedor interno de un clic: sólo existe en entorno demo. */
export const PROVEEDORES = ['google', 'apple', 'demo'] as const

export type ProveedorDeIdentidad = (typeof PROVEEDORES)[number]

/** Para qué es un enlace de invitación: activar el primer proveedor de una
 *  persona, o reemplazar uno que perdió. */
export const TIPOS_DE_INVITACION = ['activacion', 'recuperacion'] as const

export type TipoDeInvitacion = (typeof TIPOS_DE_INVITACION)[number]

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
  /** Hasta cuándo vale la elevación, para que la pantalla pueda mostrar
   *  cuánto queda y salir sola del modo elevado. Null si no está elevada. */
  readonly elevadaHasta: Date | null
}
