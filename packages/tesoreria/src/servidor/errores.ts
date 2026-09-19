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

/** Quien pidió la operación no tiene la función que la habilita: leer la
 * cuenta de otro grupo, registrar un pago sin ser Tesorería diocesana,
 * definir una cuota sin autoridad diocesana. */
export class OperacionDenegada extends Error {
  constructor(motivo: string) {
    super(motivo)
    this.name = 'OperacionDenegada'
  }
}
