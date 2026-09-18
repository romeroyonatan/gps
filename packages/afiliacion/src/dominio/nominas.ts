import type { MiembroActivo } from '@gps/personas/dominio'

/** Agrupa la foto de miembros que corresponde declarar por grupo.
 *
 * Un grupo cerrado no declara, el pedido opcional limita la foto a ese grupo y
 * una declaracion ya emitida vuelve idempotente la operacion para ese grupo sin
 * impedir que declaren los demas. */
export function armarNominasDeclarables(
  miembrosActivos: readonly MiembroActivo[],
  gruposAbiertos: ReadonlySet<string>,
  gruposYaDeclarados: ReadonlySet<string>,
  grupoSolicitado?: string,
): ReadonlyMap<string, readonly MiembroActivo[]> {
  const nominas = new Map<string, MiembroActivo[]>()

  for (const miembro of miembrosActivos) {
    if (!gruposAbiertos.has(miembro.grupoId)) continue
    if (grupoSolicitado !== undefined && miembro.grupoId !== grupoSolicitado) continue
    const suyos = nominas.get(miembro.grupoId) ?? []
    suyos.push(miembro)
    nominas.set(miembro.grupoId, suyos)
  }

  for (const grupoId of gruposYaDeclarados) nominas.delete(grupoId)
  return nominas
}
