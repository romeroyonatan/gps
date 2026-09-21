import type { MovimientoDeTesoreria } from './modelos'

export function importeEnPesosValido(importe: number): boolean {
  return Number.isSafeInteger(importe) && importe > 0
}

export function saldoDe(movimientos: readonly Pick<MovimientoDeTesoreria, 'importe'>[]): number {
  return movimientos.reduce((saldo, movimiento) => saldo + movimiento.importe, 0)
}

export function fechaValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false
  const instante = new Date(`${fecha}T00:00:00Z`)
  return !Number.isNaN(instante.getTime()) && instante.toISOString().slice(0, 10) === fecha
}

/** Qué le hace a la cuenta el importe que se está por asentar. Es la misma
 *  cuenta que hace el servidor al guardar el pago, pero contestada antes de
 *  guardarlo: la pantalla la usa para decir la consecuencia mientras se tipea,
 *  y no para habilitar o bloquear nada —pagar de más es legal y deja saldo a
 *  favor del grupo—. El saldo positivo es deuda, como lo guarda tesorería. */
export type ImputacionDelPago =
  | { tipo: 'sinImporte' }
  | { tipo: 'cancela' }
  | { tipo: 'parcial'; resta: number }
  | { tipo: 'aFavor'; sobra: number }

export function imputacionDelPago(saldo: number, importe: number): ImputacionDelPago {
  if (!importeEnPesosValido(importe)) return { tipo: 'sinImporte' }
  const resta = saldo - importe
  if (resta === 0) return { tipo: 'cancela' }
  if (resta > 0) return { tipo: 'parcial', resta }
  return { tipo: 'aFavor', sobra: -resta }
}
