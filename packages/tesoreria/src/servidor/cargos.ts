import type { Afiliacion, Declaracion } from '@gps/afiliacion/dominio'
import type { Actor, Alcance, Core } from '@gps/core'
import { eq, isNotNull } from 'drizzle-orm'
import type {
  MovimientoDeTesoreria,
  ResultadoDeReconciliacion,
  ResumenDePendientes,
} from '../dominio'
import { puedeRegistrarPagos, puedeVerTesoreriaDeLaDiocesis } from '../dominio'
import { OperacionDenegada } from './errores'
import { cuotasDeAfiliacion, movimientosDeTesoreria } from './tablas'

/** Casos de uso que convierten declaraciones de Afiliación en cargos de
 * cuenta corriente: la generación automática al recibir el evento y la
 * reconciliación manual de lo que quedó pendiente. */
export function crearOperacionesDeCargos(core: Core, afiliacion: Afiliacion) {
  function movimientoPorDeclaracion(declaracionId: string) {
    return core.bd
      .select()
      .from(movimientosDeTesoreria)
      .where(eq(movimientosDeTesoreria.declaracionId, declaracionId))
      .get()
  }

  /** Genera como máximo un cargo por declaración. Es un no-op si ya existe
   * (idempotente ante reintentos y ante la reconciliación manual). */
  async function generarCargo(
    declaracion: Declaracion,
    actor: Actor | null = null,
  ): Promise<MovimientoDeTesoreria | null> {
    const existente = movimientoPorDeclaracion(declaracion.id)
    if (existente) return existente

    const cantidad = (await afiliacion.listarACobrar(declaracion.id)).length
    if (cantidad === 0) return null

    const cuota = core.bd
      .select()
      .from(cuotasDeAfiliacion)
      .where(eq(cuotasDeAfiliacion.periodo, declaracion.periodo))
      .get()
    if (!cuota) return null

    const importe = cantidad * cuota.importe
    if (!Number.isSafeInteger(importe))
      throw new Error('El total del cargo excede un entero seguro.')
    const ahora = core.reloj.ahora()
    const movimiento: MovimientoDeTesoreria = {
      id: core.nuevoId('movimiento'),
      grupoId: declaracion.grupoId,
      fecha: declaracion.fecha,
      tipo: 'cargo_afiliacion',
      importe,
      periodo: declaracion.periodo,
      declaracionId: declaracion.id,
      cantidad,
      cuota: cuota.importe,
      medioDePago: null,
      referencia: null,
      observacion: null,
      anulaA: null,
      creadoEn: ahora,
      actualizadoEn: ahora,
    }
    core.bd.transaction((tx) => {
      tx.insert(movimientosDeTesoreria).values(movimiento).onConflictDoNothing().run()
      core.auditoria.registrar(
        {
          actorPersonaId: actor?.personaId ?? null,
          origenInterno: actor ? null : 'AfiliacionDeclarada',
          modulo: 'tesoreria',
          accion: 'generarCargoDeAfiliacion',
          elevado: actor?.estaElevado ?? false,
          grupoId: movimiento.grupoId,
          entidadTipo: 'movimiento',
          entidadId: movimiento.id,
          resumen: { cantidad, cuota: cuota.importe, importe, declaracionId: declaracion.id },
        },
        tx,
      )
    })
    return movimientoPorDeclaracion(declaracion.id) ?? null
  }

  /** Declaraciones con afiliados cobrables que todavía no tienen cargo. Las
   * que no tienen a nadie a quien cobrarle no cuentan: nunca van a generar
   * cargo y no deben quedar "pendientes" para siempre. */
  async function declaracionesPendientes(): Promise<readonly Declaracion[]> {
    const declaraciones = await afiliacion.listarDeclaraciones()
    const procesadas = new Set(
      core.bd
        .select({ declaracionId: movimientosDeTesoreria.declaracionId })
        .from(movimientosDeTesoreria)
        .where(isNotNull(movimientosDeTesoreria.declaracionId))
        .all()
        .map((fila) => fila.declaracionId),
    )
    const pendientes: Declaracion[] = []
    for (const declaracion of declaraciones) {
      if (procesadas.has(declaracion.id)) continue
      if ((await afiliacion.listarACobrar(declaracion.id)).length > 0) pendientes.push(declaracion)
    }
    return pendientes
  }

  async function resumenDePendientes(alcance: Alcance): Promise<ResumenDePendientes> {
    if (!puedeVerTesoreriaDeLaDiocesis(alcance.actor)) {
      throw new OperacionDenegada('El panorama de deuda de la diócesis es de Tesorería.')
    }
    const pendientes = await declaracionesPendientes()
    const periodosConCuota = new Set(
      core.bd
        .select({ periodo: cuotasDeAfiliacion.periodo })
        .from(cuotasDeAfiliacion)
        .all()
        .map((cuota) => cuota.periodo),
    )
    return {
      cantidad: pendientes.length,
      periodosSinCuota: [
        ...new Set(
          pendientes
            .filter((declaracion) => !periodosConCuota.has(declaracion.periodo))
            .map((declaracion) => declaracion.periodo),
        ),
      ].sort((a, b) => a - b),
    }
  }

  async function reconciliar(alcance: Alcance): Promise<ResultadoDeReconciliacion> {
    if (!puedeRegistrarPagos(alcance.actor)) {
      throw new OperacionDenegada('Sólo Tesorería diocesana genera los cargos pendientes.')
    }
    let creados = 0
    for (const declaracion of await declaracionesPendientes()) {
      if (await generarCargo(declaracion, alcance.actor)) creados++
    }
    return { ...(await resumenDePendientes(alcance)), creados }
  }

  return { generarCargo, resumenDePendientes, reconciliar }
}
