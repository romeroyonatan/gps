import { type Afiliacion, type Declaracion, periodoDe } from '@gps/afiliacion/dominio'
import type { Core } from '@gps/core'
import { aFechaDeCalendario } from '@gps/core/fechas'
import type { Estructura } from '@gps/estructura/dominio'
import { and, asc, desc, eq, isNotNull } from 'drizzle-orm'
import {
  type CuentaDeGrupo,
  type CuotaDeAfiliacion,
  fechaValida,
  importeEnPesosValido,
  MEDIOS_DE_PAGO,
  type MedioDePago,
  type MovimientoDeTesoreria,
  type ResultadoDeReconciliacion,
  type ResumenDePendientes,
} from '../dominio'
import { cuotasDeAfiliacion, movimientosDeTesoreria } from './tablas'

export class DatosDePagoInvalidos extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'DatosDePagoInvalidos'
  }
}

export class CuotaUtilizada extends Error {
  constructor(periodo: number) {
    super(`La cuota del período ${periodo} ya fue utilizada y no puede modificarse.`)
    this.name = 'CuotaUtilizada'
  }
}

export class PagoNoAnulable extends Error {
  constructor() {
    super('El pago no existe, no es un pago o ya fue anulado.')
    this.name = 'PagoNoAnulable'
  }
}

export interface ServicioDeTesoreria {
  definirCuota(periodo: number, importe: number): Promise<CuotaDeAfiliacion>
  listarCuotas(): Promise<readonly CuotaDeAfiliacion[]>
  listarPeriodosConfigurables(): Promise<readonly number[]>
  generarCargo(declaracion: Declaracion): Promise<MovimientoDeTesoreria | null>
  resumenDePendientes(): Promise<ResumenDePendientes>
  reconciliar(): Promise<ResultadoDeReconciliacion>
  registrarPago(datos: {
    grupoId: string
    fecha: string
    importe: number
    medioDePago: MedioDePago
    referencia?: string | null
    observacion?: string | null
  }): Promise<MovimientoDeTesoreria>
  anularPago(pagoId: string): Promise<MovimientoDeTesoreria>
  listarMovimientos(grupoId: string): Promise<readonly MovimientoDeTesoreria[]>
  listarCuentas(): Promise<readonly CuentaDeGrupo[]>
}

export function crearServicioDeTesoreria(
  core: Core,
  afiliacion: Afiliacion,
  estructura: Estructura,
): ServicioDeTesoreria {
  const limpiar = (valor?: string | null) => valor?.trim() || null

  function movimientoPorDeclaracion(declaracionId: string) {
    return core.bd
      .select()
      .from(movimientosDeTesoreria)
      .where(eq(movimientosDeTesoreria.declaracionId, declaracionId))
      .get()
  }

  async function generarCargo(declaracion: Declaracion): Promise<MovimientoDeTesoreria | null> {
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
    core.bd.insert(movimientosDeTesoreria).values(movimiento).onConflictDoNothing().run()
    return movimientoPorDeclaracion(declaracion.id) ?? null
  }

  async function declaracionesPendientes() {
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

  async function resumenDePendientes(): Promise<ResumenDePendientes> {
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

  const servicio: ServicioDeTesoreria = {
    async definirCuota(periodo, importe) {
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
    },

    async listarCuotas() {
      return core.bd
        .select()
        .from(cuotasDeAfiliacion)
        .orderBy(desc(cuotasDeAfiliacion.periodo))
        .all()
    },

    listarPeriodosConfigurables,
    generarCargo,
    resumenDePendientes,

    async reconciliar() {
      let creados = 0
      for (const declaracion of await declaracionesPendientes()) {
        if (await generarCargo(declaracion)) creados++
      }
      return { ...(await resumenDePendientes()), creados }
    },

    async registrarPago(datos) {
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
    },

    async anularPago(pagoId) {
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
    },

    async listarMovimientos(grupoId) {
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
    },

    async listarCuentas() {
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
    },
  }

  core.eventos.suscribir('AfiliacionDeclarada', async (declaracion) => {
    await generarCargo(declaracion)
  })
  return servicio
}
