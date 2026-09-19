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
