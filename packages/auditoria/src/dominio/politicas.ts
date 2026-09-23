import type { AccesoAlModulo, Actor } from '@gps/core'

export const accesoAlModulo: AccesoAlModulo = {
  porDefecto: 'denegado',
  permitidos: ['jefeDeGrupo', 'secretariaDeGrupo'],
}

/** `null` significa alcance global; una lista vacía, ningún evento. Sólo los
 * roles de conducción del grupo dan acceso: alcanzar un grupo por otro cargo
 * no alcanza para leer su historial. */
export function gruposAuditables(actor: Actor): readonly string[] | null {
  if (actor.estaElevado) return null
  return [
    ...new Set(
      actor.roles
        .filter(
          (funcion) =>
            (funcion.rol === 'jefeDeGrupo' || funcion.rol === 'secretariaDeGrupo') &&
            funcion.ambito.tipo === 'grupo' &&
            funcion.ambito.id,
        )
        .map((funcion) => funcion.ambito.id as string),
    ),
  ]
}

export function puedeAuditarGrupo(actor: Actor, grupoId: string): boolean {
  const grupos = gruposAuditables(actor)
  return grupos === null || grupos.includes(grupoId)
}
