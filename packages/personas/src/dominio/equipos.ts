import type { Marcas } from '@gps/core'

/** Equipos funcionales conocidos por las politicas de autorizacion. No son
 *  cargos estatutarios y pueden tener varias personas a la vez. */
export const TIPOS_DE_EQUIPO = [
  { id: 'secretaria', nombre: 'Secretaría' },
  { id: 'administracionDiocesana', nombre: 'Administración diocesana' },
  { id: 'tesoreriaDiocesana', nombre: 'Tesorería diocesana' },
] as const

export type TipoDeEquipo = (typeof TIPOS_DE_EQUIPO)[number]['id']

export interface Equipo extends Marcas {
  readonly id: string
  readonly tipo: TipoDeEquipo
  readonly ambitoTipo: 'grupo' | 'diocesis'
  readonly ambitoId: string | null
}

export interface IntegranteDeEquipo extends Marcas {
  readonly id: string
  readonly equipoId: string
  readonly personaId: string
  readonly desde: string
  readonly hasta: string | null
  readonly revocadoEn: Date | null
}
