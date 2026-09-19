import type { AccesoAlModulo, Actor, Alcance } from '@gps/core'
import { tieneRol } from '@gps/core/roles'

/** Alcanzar el modulo no es ver a la gente de un grupo: eso lo decide
 *  `puedeVerPersonasDelGrupo`, que es mucho mas estrecho. Aca entra cualquiera
 *  con una funcion vigente porque el directorio de la asociacion -quien
 *  conduce cada grupo- vive en este modulo, y ese si es comun.
 *
 *  Es la capa 1 haciendo su trabajo y nada mas: deja pasar el pedido al
 *  modulo, y adentro cada operacion decide. */
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

/** La gente de un grupo es del grupo: la ven su jefatura y su Secretaria, y
 *  nadie mas.
 *
 *  No alcanza con tener el grupo en el alcance. El comisionado lo tiene -su
 *  distrito se expande a sus grupos- porque necesita leer los permisos de
 *  salida que firma, y ahi ve la nomina de quienes van a esa salida. Eso es
 *  otra cosa que el padron del grupo, y `salidas` lo resuelve con sus propias
 *  tablas.
 *
 *  Las autoridades diocesanas tampoco: administran equipos diocesanos, no los
 *  datos de la gente de un grupo. La elevacion si, que para eso existe. */
export function puedeVerPersonasDelGrupo(alcance: Alcance, grupoId: string): boolean {
  return (
    alcance.esAdministrador ||
    tieneRol(alcance.actor, ['jefeDeGrupo', 'secretariaDeGrupo'], 'grupo', grupoId)
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
