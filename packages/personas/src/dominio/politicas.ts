import type { AccesoAlModulo, Actor, Alcance } from '@gps/core'
import { tieneRol } from '@gps/core/roles'

/** Los datos de las personas son el nucleo sensible del sistema: solo las
 *  funciones que administran un grupo o la diocesis alcanzan el modulo. Un
 *  dirigente sin cargo no. */
export const accesoAlModulo: AccesoAlModulo = {
  porDefecto: 'denegado',
  permitidos: [
    'jefeDeGrupo',
    'secretariaDeGrupo',
    'directorDeGrupo',
    'comisionadoDeDistrito',
    'autoridadDeDistrito',
    'jefeScoutDiocesano',
    'administracionDiocesana',
  ],
}

/** Leer es cuestion de alcance y no de funcion: el comisionado ve los grupos de
 *  su distrito porque `estructura` se los expandio, no porque tenga un rol en
 *  cada uno. Escribir, en cambio, exige la funcion (ver abajo). */
export function puedeVerPersonasDelGrupo(alcance: Alcance, grupoId: string): boolean {
  return alcance.esAdministrador || alcance.gruposVisibles.includes(grupoId)
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
