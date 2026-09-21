import type { Afiliacion, Declaracion } from '@gps/afiliacion/dominio'
import type { Alcance, Core } from '@gps/core'
import type { Estructura } from '@gps/estructura/dominio'
import type {
  CuentaDeGrupo,
  CuotaDeAfiliacion,
  MedioDePago,
  MovimientoDeTesoreria,
  ReporteDeCobranza,
  ResultadoDeReconciliacion,
  ResumenDePendientes,
} from '../dominio'
import { crearOperacionesDeCargos } from './cargos'
import { crearConsultasDeTesoreria } from './consultas'
import { crearOperacionesDeCuotas } from './cuotas'
import { crearOperacionesDePagos } from './pagos'
import { crearReportesDeTesoreria } from './reportes'

export { CuotaUtilizada, DatosDePagoInvalidos, OperacionDenegada, PagoNoAnulable } from './errores'

export interface ServicioDeTesoreria {
  definirCuota(alcance: Alcance, periodo: number, importe: number): Promise<CuotaDeAfiliacion>
  listarCuotas(): Promise<readonly CuotaDeAfiliacion[]>
  listarPeriodosConfigurables(alcance: Alcance): Promise<readonly number[]>
  /** Interno: lo dispara el evento `AfiliacionDeclarada`, no un usuario. */
  generarCargo(declaracion: Declaracion): Promise<MovimientoDeTesoreria | null>
  resumenDePendientes(alcance: Alcance): Promise<ResumenDePendientes>
  reconciliar(alcance: Alcance): Promise<ResultadoDeReconciliacion>
  registrarPago(
    alcance: Alcance,
    datos: {
      grupoId: string
      fecha: string
      importe: number
      medioDePago: MedioDePago
      referencia?: string | null
      observacion?: string | null
    },
  ): Promise<MovimientoDeTesoreria>
  anularPago(alcance: Alcance, pagoId: string): Promise<MovimientoDeTesoreria>
  listarMovimientos(alcance: Alcance, grupoId: string): Promise<readonly MovimientoDeTesoreria[]>
  listarCuentas(alcance: Alcance): Promise<readonly CuentaDeGrupo[]>
  reporteDeCobranza(alcance: Alcance, periodo: number): Promise<ReporteDeCobranza>
}

/** Compone los casos de uso del módulo. Las dependencias llegan ya
 * construidas por la raíz, no por el contexto de un request. */
export function crearServicioDeTesoreria(
  core: Core,
  afiliacion: Afiliacion,
  estructura: Estructura,
): ServicioDeTesoreria {
  const cargos = crearOperacionesDeCargos(core, afiliacion)

  const servicio: ServicioDeTesoreria = {
    ...crearOperacionesDeCuotas(core, afiliacion),
    ...cargos,
    ...crearOperacionesDePagos(core, estructura),
    ...crearConsultasDeTesoreria(core, estructura),
    ...crearReportesDeTesoreria(core, afiliacion, estructura),
  }

  // Es Tesorería quien conoce a Afiliación, nunca al revés: el evento es la
  // única vía. Un fallo acá queda en el suscriptor, no revierte la declaración.
  core.eventos.suscribir('AfiliacionDeclarada', async (declaracion) => {
    await cargos.generarCargo(declaracion)
  })

  return servicio
}
