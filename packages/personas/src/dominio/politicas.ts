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
