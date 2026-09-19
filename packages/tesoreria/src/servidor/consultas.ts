import type { Core } from '@gps/core'
import type { Estructura } from '@gps/estructura/dominio'
import { asc, eq } from 'drizzle-orm'
import type { CuentaDeGrupo, MovimientoDeTesoreria } from '../dominio'
import { movimientosDeTesoreria } from './tablas'

/** Consultas de sólo lectura sobre la cuenta corriente: el detalle de un
 * grupo y el resumen de todos. */
export function crearConsultasDeTesoreria(core: Core, estructura: Estructura) {
  async function listarMovimientos(grupoId: string): Promise<readonly MovimientoDeTesoreria[]> {
    return core.bd
      .select()
      .from(movimientosDeTesoreria)
      .where(eq(movimientosDeTesoreria.grupoId, grupoId))
      .orderBy(
        asc(movimientosDeTesoreria.fecha),
        asc(movimientosDeTesoreria.creadoEn),
        asc(movimientosDeTesoreria.id),
      )
      .all()
  }

  async function listarCuentas(): Promise<readonly CuentaDeGrupo[]> {
    const saldos = new Map<string, number>()
    for (const movimiento of core.bd.select().from(movimientosDeTesoreria).all()) {
      saldos.set(movimiento.grupoId, (saldos.get(movimiento.grupoId) ?? 0) + movimiento.importe)
    }
    return (await estructura.listarGrupos()).map((grupo) => ({
      grupoId: grupo.id,
      numero: grupo.numero,
      nombre: grupo.nombre,
      cerrado: grupo.cerradoEn !== null,
      saldo: saldos.get(grupo.id) ?? 0,
    }))
  }

  return { listarMovimientos, listarCuentas }
}
