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
