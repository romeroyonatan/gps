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

/** Un importe escrito como lo escribe la tesorería: pesos, sin centavos. El
 *  formateador es isomorfo -`Intl` está en el navegador, en el teléfono y en
 *  el servidor-, así que vive acá y no en la interfaz de cada app: estaba
 *  copiado en cuatro pantallas de web y cuatro de mobile.
 *
 *  Devuelve el importe tal cual viene: el signo y la palabra -"De deuda", "a
 *  favor"- los decide quien lo muestra, porque un saldo positivo es deuda y
 *  eso es vocabulario de pantalla, no de formato. */
const PESOS = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

export function enPesos(importe: number): string {
  return PESOS.format(importe)
}
