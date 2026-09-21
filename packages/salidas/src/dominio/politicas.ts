import type { AccesoAlModulo, Actor, Alcance, Rol } from '@gps/core'
import { tieneRol } from '@gps/core/roles'
import { type FirmanteRequerido, firmantesRequeridos } from './firmas'

/** Jefatura y Secretaria administran los permisos de su grupo; director y
 *  comisionado entran porque son firmantes y necesitan leer lo que firman. */
export const accesoAlModulo: AccesoAlModulo = {
  porDefecto: 'denegado',
  permitidos: ['jefeDeGrupo', 'secretariaDeGrupo', 'directorDeGrupo', 'comisionadoDeDistrito'],
}

/** Ver y descargar: alcanza con tener el grupo del permiso a la vista. Es lo
 *  que deja que el comisionado lea el permiso que tiene que firmar, porque
 *  `estructura` le expandio su distrito a esos grupos. */
export function puedeVerPermisoDelGrupo(alcance: Alcance, grupoId: string): boolean {
  return alcance.esAdministrador || alcance.gruposVisibles.includes(grupoId)
}

/** Crear, editar, emitir, anular, adjuntar y registrar firmas en papel: es
 *  administrar el permiso, y lo hace el grupo que sale. */
export function puedeAdministrarPermisosDelGrupo(actor: Actor, grupoId: string): boolean {
  return (
    actor.estaElevado || tieneRol(actor, ['jefeDeGrupo', 'secretariaDeGrupo'], 'grupo', grupoId)
  )
}

const ROL_DEL_CARGO: Record<FirmanteRequerido['cargo'], Rol | undefined> = {
  jefeDeGrupo: 'jefeDeGrupo',
  subjefeDeGrupo: undefined,
  jefeDeRama: undefined,
  capellan: undefined,
  director: 'directorDeGrupo',
  comisionadoDeDistrito: 'comisionadoDeDistrito',
  jefeScoutDiocesano: 'jefeScoutDiocesano',
}

/** Firmar en la app es un acto personal: lo hace quien ocupa hoy ese cargo en
 *  ese ambito, y nadie mas. La elevacion no firma por nadie -seria falsificar
 *  una firma-, a diferencia de todo el resto de las politicas. */
export function puedeFirmarEnLaApp(actor: Actor, firmante: FirmanteRequerido): boolean {
  const rol = ROL_DEL_CARGO[firmante.cargo]
  return rol !== undefined && tieneRol(actor, [rol], firmante.ambito, firmante.ambitoId)
}

/** Si quien mira ocupa hoy ese cargo firmante del permiso de ese grupo.
 *
 *  Es `firmantesRequeridos` + `puedeFirmarEnLaApp` en una sola pregunta, que es
 *  como la hacen los dos lados: tres pantallas y el servidor escribían el mismo
 *  cruce a mano, y "pendiente de tu firma" tiene que querer decir lo mismo en
 *  todas. Sin distrito todavía no se sabe quién es el comisionado, y entonces
 *  nadie firma: es el estado de carga, no un permiso denegado. */
export function puedeFirmarComo(
  actor: Actor | null,
  cargo: FirmanteRequerido['cargo'],
  grupoId: string,
  distritoId: string | undefined,
): boolean {
  if (actor === null || distritoId === undefined) return false
  const firmante = firmantesRequeridos(grupoId, distritoId).find((uno) => uno.cargo === cargo)
  return firmante !== undefined && puedeFirmarEnLaApp(actor, firmante)
}
