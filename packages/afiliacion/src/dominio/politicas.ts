import type { AccesoAlModulo, Actor, Alcance } from '@gps/core'
import { tieneRol } from '@gps/core/roles'

/** Declarar nominas es de jefatura y Secretaria de grupo; Tesoreria y las
 *  autoridades diocesanas las leen porque de ahi sale el cargo de cuota. */
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

export function puedeVerAfiliacionDelGrupo(alcance: Alcance, grupoId: string): boolean {
  return alcance.esAdministrador || alcance.gruposVisibles.includes(grupoId)
}

/** La declaracion la firma el grupo: es su nomina y su deuda. Ninguna autoridad
 *  diocesana declara por el, aunque pueda leer lo declarado. */
export function puedeDeclararAfiliacion(actor: Actor, grupoId: string): boolean {
  return (
    actor.estaElevado || tieneRol(actor, ['jefeDeGrupo', 'secretariaDeGrupo'], 'grupo', grupoId)
  )
}
