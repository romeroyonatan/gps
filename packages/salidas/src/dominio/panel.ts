import type { Actor } from '@gps/core'
import type { TipoDeCargo } from '@gps/personas/dominio'
import type { FirmanteRequerido } from './firmas'
import { puedeFirmarEnLaApp } from './politicas'

/** Lo poco que hace falta saber de un permiso para repartirlo en el panel. Es
 *  estructural a propósito: lo cumple tanto el modelo del servidor como lo que
 *  devuelve la consulta de GraphQL, y así las pantallas no traducen nada. */
export interface SalidaDelPanel {
  readonly estado: string
  /** aaaa-mm-dd, el día que vuelven. */
  readonly hasta: string
  readonly firmas: readonly { readonly cargo: TipoDeCargo; readonly firmada: boolean }[]
}

/** Las tres filas con que abre el grupo: qué espera a quien mira, qué espera a
 *  otro, y qué viene.
 *
 *  Quién firma qué lo decide `puedeFirmarEnLaApp`, la misma política que aplica
 *  el servidor: firmar es personal, así que "espera tu firma" es exactamente
 *  "hay una firma pendiente de un cargo que ocupás vos".
 *
 *  Las dos filas de firmas no miran el almanaque: una firma que falta sigue
 *  faltando aunque la salida haya pasado, y esconderla dejaría el permiso
 *  colgado sin que nadie se entere. La tercera sí: "próximas" son las que
 *  todavía no volvieron. */
export function repartirSalidas<T extends SalidaDelPanel>(
  salidas: readonly T[],
  actor: Actor,
  firmantes: readonly FirmanteRequerido[],
  hoy: string,
): { esperanTuFirma: readonly T[]; esperanLaDeOtro: readonly T[]; proximas: readonly T[] } {
  const esperanTuFirma: T[] = []
  const esperanLaDeOtro: T[] = []
  const proximas: T[] = []

  for (const salida of salidas) {
    if (salida.estado === 'anulado') continue

    const pendientes = salida.firmas.filter((firma) => !firma.firmada)
    if (salida.estado === 'emitido' && pendientes.length > 0) {
      const tuya = pendientes.some((firma) => {
        const firmante = firmantes.find((uno) => uno.cargo === firma.cargo)
        return firmante !== undefined && puedeFirmarEnLaApp(actor, firmante)
      })
      ;(tuya ? esperanTuFirma : esperanLaDeOtro).push(salida)
      continue
    }

    if (salida.hasta >= hoy) proximas.push(salida)
  }

  return { esperanTuFirma, esperanLaDeOtro, proximas }
}
