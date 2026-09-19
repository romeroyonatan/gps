import type { Actor } from '@gps/core'

function tieneRol(
  actor: Actor,
  roles: readonly string[],
  tipo: 'grupo' | 'diocesis',
  id: string | null,
) {
  return actor.roles.some(
    (funcion) =>
      roles.includes(funcion.rol) && funcion.ambito.tipo === tipo && funcion.ambito.id === id,
  )
}

export function puedeAdministrarPlantelDeGrupo(actor: Actor, grupoId: string): boolean {
  return (
    actor.estaElevado || tieneRol(actor, ['jefeDeGrupo', 'secretariaDeGrupo'], 'grupo', grupoId)
  )
}

export function puedeAdministrarEquiposDiocesanos(actor: Actor): boolean {
  return (
    actor.estaElevado ||
    tieneRol(actor, ['jefeScoutDiocesano', 'administracionDiocesana'], 'diocesis', null)
  )
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

/** Definir el importe de la cuota por período es una decisión diocesana:
 *  Tesorería, que después cobra esa cuota, y Administración/jefatura scout,
 *  que administran las transiciones de Tesorería. */
export function puedeConfigurarCuotas(actor: Actor): boolean {
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
