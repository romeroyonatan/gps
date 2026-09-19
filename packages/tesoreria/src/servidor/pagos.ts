import type { Alcance, Core } from '@gps/core'
import { aFechaDeCalendario } from '@gps/core/fechas'
import type { Estructura } from '@gps/estructura/dominio'
import { eq } from 'drizzle-orm'
import {
  fechaValida,
  importeEnPesosValido,
  MEDIOS_DE_PAGO,
  type MedioDePago,
  type MovimientoDeTesoreria,
  puedeRegistrarPagos,
} from '../dominio'
import { DatosDePagoInvalidos, OperacionDenegada, PagoNoAnulable } from './errores'
import { movimientosDeTesoreria } from './tablas'

/** Casos de uso sobre pagos externos: registrarlos y anularlos mediante un
 * contramovimiento. Nunca se edita ni se borra un movimiento existente. */
export function crearOperacionesDePagos(core: Core, estructura: Estructura) {
  const limpiar = (valor?: string | null) => valor?.trim() || null

  async function registrarPago(
    alcance: Alcance,
    datos: {
      grupoId: string
      fecha: string
      importe: number
      medioDePago: MedioDePago
      referencia?: string | null
      observacion?: string | null
    },
  ): Promise<MovimientoDeTesoreria> {
    if (!puedeRegistrarPagos(alcance.actor)) {
      throw new OperacionDenegada('Sólo Tesorería diocesana registra pagos.')
    }
    if (!importeEnPesosValido(datos.importe) || !fechaValida(datos.fecha)) {
      throw new DatosDePagoInvalidos('El importe o la fecha del pago no son válidos.')
    }
    if (!MEDIOS_DE_PAGO.includes(datos.medioDePago)) {
      throw new DatosDePagoInvalidos('El medio de pago no es válido.')
    }
    if (!(await estructura.listarGrupos()).some((grupo) => grupo.id === datos.grupoId)) {
      throw new DatosDePagoInvalidos('El grupo no existe.')
    }
    const ahora = core.reloj.ahora()
    const pago: MovimientoDeTesoreria = {
      id: core.nuevoId('movimiento'),
      grupoId: datos.grupoId,
      fecha: datos.fecha,
      tipo: 'pago',
      importe: -datos.importe,
      periodo: null,
      declaracionId: null,
      cantidad: null,
      cuota: null,
      medioDePago: datos.medioDePago,
      referencia: limpiar(datos.referencia),
      observacion: limpiar(datos.observacion),
      anulaA: null,
      creadoEn: ahora,
      actualizadoEn: ahora,
    }
    core.bd.insert(movimientosDeTesoreria).values(pago).run()
    return pago
  }

  async function anularPago(alcance: Alcance, pagoId: string): Promise<MovimientoDeTesoreria> {
    if (!puedeRegistrarPagos(alcance.actor)) {
      throw new OperacionDenegada('Sólo Tesorería diocesana anula pagos.')
    }
    const pago = core.bd
      .select()
      .from(movimientosDeTesoreria)
      .where(eq(movimientosDeTesoreria.id, pagoId))
      .get()
    const yaAnulado = core.bd
      .select({ id: movimientosDeTesoreria.id })
      .from(movimientosDeTesoreria)
      .where(eq(movimientosDeTesoreria.anulaA, pagoId))
      .get()
    if (pago?.tipo !== 'pago' || yaAnulado) throw new PagoNoAnulable()

    const ahora = core.reloj.ahora()
    const anulacion: MovimientoDeTesoreria = {
      id: core.nuevoId('movimiento'),
      grupoId: pago.grupoId,
      fecha: aFechaDeCalendario(ahora),
      tipo: 'anulacion_pago',
      importe: -pago.importe,
      periodo: null,
      declaracionId: null,
      cantidad: null,
      cuota: null,
      medioDePago: null,
      referencia: null,
      observacion: null,
      anulaA: pago.id,
      creadoEn: ahora,
      actualizadoEn: ahora,
    }
    core.bd.insert(movimientosDeTesoreria).values(anulacion).run()
    return anulacion
  }

  return { registrarPago, anularPago }
}
