import type { Afiliacion, Declaracion } from '@gps/afiliacion/dominio'
import type { Core } from '@gps/core'
import type { Estructura } from '@gps/estructura/dominio'
import type {
  CuentaDeGrupo,
  CuotaDeAfiliacion,
  MedioDePago,
  MovimientoDeTesoreria,
  ResultadoDeReconciliacion,
  ResumenDePendientes,
} from '../dominio'
import { crearOperacionesDeCargos } from './cargos'
import { crearConsultasDeTesoreria } from './consultas'
import { crearOperacionesDeCuotas } from './cuotas'
import { crearOperacionesDePagos } from './pagos'

export { CuotaUtilizada, DatosDePagoInvalidos, PagoNoAnulable } from './errores'

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
  }

  // Es Tesorería quien conoce a Afiliación, nunca al revés: el evento es la
  // única vía. Un fallo acá queda en el suscriptor, no revierte la declaración.
  core.eventos.suscribir('AfiliacionDeclarada', async (declaracion) => {
    await cargos.generarCargo(declaracion)
  })

  return servicio
}
