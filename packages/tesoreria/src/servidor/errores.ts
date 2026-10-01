import { ErrorDeNegocio } from '@gps/core/errores'

export class DatosDePagoInvalidos extends ErrorDeNegocio {}

export class CuotaUtilizada extends ErrorDeNegocio {
  constructor(periodo: number) {
    super(`La cuota del período ${periodo} ya fue utilizada y no puede modificarse.`)
  }
}

export class PagoNoAnulable extends ErrorDeNegocio {
  constructor() {
    super('El pago no existe, no es un pago o ya fue anulado.')
  }
}

/** Quien pidió la operación no tiene la función que la habilita: leer la
 * cuenta de otro grupo, registrar un pago sin ser Tesorería diocesana,
 * definir una cuota sin autoridad diocesana. */
export class OperacionDenegada extends ErrorDeNegocio {}
