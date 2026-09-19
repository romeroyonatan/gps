import type { AccesoAlModulo, Actor, Alcance } from '@gps/core'
import { tieneRol } from '@gps/core/roles'

/** El organigrama lo necesita cualquiera que tenga alguna funcion vigente:
 *  sin distrito, grupo y unidad no se puede ni listar personas ni declarar una
 *  nomina. Que filas ve cada uno lo decide el `Alcance`, no esta capa. */
export const accesoAlModulo: AccesoAlModulo = {
  porDefecto: 'denegado',
  permitidos: [
    'dirigente',
    'jefeDeGrupo',
    'secretariaDeGrupo',
    'directorDeGrupo',
    'comisionadoDeDistrito',
    'autoridadDeDistrito',
    'jefeScoutDiocesano',
    'administracionDiocesana',
    'tesoreriaDiocesana',
  ],
}

export function puedeVerDistrito(alcance: Alcance, distritoId: string): boolean {
  return alcance.esAdministrador || alcance.distritosVisibles.includes(distritoId)
}

/** Crear o cerrar distritos, grupos y unidades es diocesano: un jefe de grupo
 *  no crea su propio grupo ni abre unidades del vecino. */
export function puedeAdministrarLaEstructura(actor: Actor): boolean {
  return (
    actor.estaElevado ||
    tieneRol(actor, ['jefeScoutDiocesano', 'administracionDiocesana'], 'diocesis', null)
  )
}
