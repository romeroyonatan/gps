import type { Afiliacion } from '@gps/afiliacion/dominio'
import { periodoDe } from '@gps/afiliacion/dominio'
import type { Core } from '@gps/core'
import { aFechaDeCalendario } from '@gps/core/fechas'
import { and, desc, eq } from 'drizzle-orm'
import { type CuotaDeAfiliacion, importeEnPesosValido } from '../dominio'
import { CuotaUtilizada, DatosDePagoInvalidos } from './errores'
import { cuotasDeAfiliacion, movimientosDeTesoreria } from './tablas'

/** Casos de uso sobre la cuota por período: qué períodos se pueden
 * configurar y cuánto vale cada uno. */
export function crearOperacionesDeCuotas(core: Core, afiliacion: Afiliacion) {
  /** El período actual y el siguiente siempre son configurables; los de
   * declaraciones existentes también, para poder saldar deuda vieja. Un
   * período que ya generó un cargo queda fuera: cambiarlo alteraría cargos
   * congelados. */
  async function listarPeriodosConfigurables(): Promise<readonly number[]> {
    const actual = periodoDe(aFechaDeCalendario(core.reloj.ahora()))
    const utilizados = new Set(
      core.bd
        .select({ periodo: movimientosDeTesoreria.periodo })
        .from(movimientosDeTesoreria)
        .where(eq(movimientosDeTesoreria.tipo, 'cargo_afiliacion'))
        .all()
        .flatMap((fila) => (fila.periodo === null ? [] : [fila.periodo])),
    )
    const candidatos = new Set([actual, actual + 1])
    for (const declaracion of await afiliacion.listarDeclaraciones()) {
      candidatos.add(declaracion.periodo)
    }
    return [...candidatos].filter((periodo) => !utilizados.has(periodo)).sort((a, b) => a - b)
  }

  async function definirCuota(periodo: number, importe: number): Promise<CuotaDeAfiliacion> {
    if (!Number.isInteger(periodo) || !importeEnPesosValido(importe)) {
      throw new DatosDePagoInvalidos('El período y el importe deben ser enteros positivos.')
    }
    const anterior = core.bd
      .select()
      .from(cuotasDeAfiliacion)
      .where(eq(cuotasDeAfiliacion.periodo, periodo))
      .get()
    const fueUtilizada = core.bd
      .select({ id: movimientosDeTesoreria.id })
      .from(movimientosDeTesoreria)
      .where(
        and(
          eq(movimientosDeTesoreria.tipo, 'cargo_afiliacion'),
          eq(movimientosDeTesoreria.periodo, periodo),
        ),
      )
      .get()
    if (anterior && fueUtilizada) throw new CuotaUtilizada(periodo)
    if (!(await listarPeriodosConfigurables()).includes(periodo)) {
      throw new DatosDePagoInvalidos('El período no está disponible para configurar.')
    }

    const ahora = core.reloj.ahora()
    core.bd
      .insert(cuotasDeAfiliacion)
      .values({ periodo, importe, creadoEn: anterior?.creadoEn ?? ahora, actualizadoEn: ahora })
      .onConflictDoUpdate({
        target: cuotasDeAfiliacion.periodo,
        set: { importe, actualizadoEn: ahora },
      })
      .run()
    return core.bd
      .select()
      .from(cuotasDeAfiliacion)
      .where(eq(cuotasDeAfiliacion.periodo, periodo))
      .get() as CuotaDeAfiliacion
  }

  async function listarCuotas(): Promise<readonly CuotaDeAfiliacion[]> {
    return core.bd
      .select()
      .from(cuotasDeAfiliacion)
      .orderBy(desc(cuotasDeAfiliacion.periodo))
      .all()
  }

  return { definirCuota, listarCuotas, listarPeriodosConfigurables }
}
