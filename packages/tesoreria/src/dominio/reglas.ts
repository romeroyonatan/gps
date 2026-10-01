export function importeEnPesosValido(importe: number): boolean {
  return Number.isSafeInteger(importe) && importe > 0
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

/** Cómo queda la cuenta al asentar un pago. Un saldo positivo es deuda. */
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
