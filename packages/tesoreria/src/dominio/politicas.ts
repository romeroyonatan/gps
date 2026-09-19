import type { AccesoAlModulo, Actor } from '@gps/core'
import { tieneRol } from '@gps/core/roles'

/** Jefatura y Secretaria leen la cuenta de su grupo; Tesoreria diocesana
 *  escribe. Quien puede escribir y quien solo leer lo deciden las politicas
 *  por operacion, no esta capa. */
export const accesoAlModulo: AccesoAlModulo = {
  porDefecto: 'denegado',
  permitidos: [
    'jefeDeGrupo',
    'secretariaDeGrupo',
    'tesoreriaDiocesana',
    'administracionDiocesana',
    'jefeScoutDiocesano',
  ],
}

/** Jefatura y Secretaría leen la cuenta corriente de su propio grupo; las
 *  autoridades diocesanas -incluida Tesorería- la leen de cualquiera, porque
 *  necesitan ver a toda la diócesis para reconciliar y cobrar. */
export function puedeLeerCuentaDeGrupo(actor: Actor, grupoId: string): boolean {
  return (
    actor.estaElevado ||
    tieneRol(actor, ['jefeDeGrupo', 'secretariaDeGrupo'], 'grupo', grupoId) ||
    tieneRol(
      actor,
      ['tesoreriaDiocesana', 'administracionDiocesana', 'jefeScoutDiocesano'],
      'diocesis',
      null,
    )
  )
}

/** Registrar o anular un pago es privativo de Tesorería diocesana: ni la
 *  jefatura ni la Secretaría de un grupo pueden escribir su propia cuenta,
 *  aunque puedan leerla (diseño §6, separación lectura/escritura). */
export function puedeRegistrarPagos(actor: Actor): boolean {
  return actor.estaElevado || tieneRol(actor, ['tesoreriaDiocesana'], 'diocesis', null)
}

/** El panorama diocesano -saldos de todos los grupos, deuda pendiente- lo ven
 *  Tesorería y las autoridades que la nombran y le piden cuentas. */
export function puedeVerTesoreriaDeLaDiocesis(actor: Actor): boolean {
  return (
    actor.estaElevado ||
    tieneRol(
      actor,
      ['tesoreriaDiocesana', 'administracionDiocesana', 'jefeScoutDiocesano'],
      'diocesis',
      null,
    )
  )
}

/** Definir el importe de la cuota por período es una decisión diocesana:
 *  Tesorería, que después cobra esa cuota, y Administración/jefatura scout,
 *  que administran las transiciones de Tesorería. */
export function puedeConfigurarCuotas(actor: Actor): boolean {
  return puedeVerTesoreriaDeLaDiocesis(actor)
}
