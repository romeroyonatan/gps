/** Cuánto falta para un instante, en mm:ss. Null cuando ya venció.
 *
 *  Es de la interfaz y no la barrera: el servidor compara `elevadaHasta`
 *  contra su propio reloj en cada pedido, así que adelantar el reloj del
 *  dispositivo no estira la elevación ni un segundo. */
export function cuantoFalta(hasta: string, ahora: number): string | null {
  const restan = Math.floor((new Date(hasta).getTime() - ahora) / 1000)
  if (restan <= 0) return null
  return `${Math.floor(restan / 60)}:${String(restan % 60).padStart(2, '0')}`
}
