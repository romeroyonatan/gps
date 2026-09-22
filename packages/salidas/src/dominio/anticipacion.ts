import { DIAS_DE_ANTICIPACION } from './config'
import type { Aviso } from './modelos'

const UN_DIA = 24 * 60 * 60 * 1000

/** Cuantos dias faltan entre dos fechas de calendario. Las dos en aaaa-mm-dd,
 *  interpretadas en UTC: como las dos se arman igual, la diferencia no depende
 *  de la zona horaria de nadie. */
function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / UN_DIA)
}

/** La cuenta corta para la lista de salidas. */
export function cuentaRegresivaDeSalida(hoy: string, desde: string): string {
  const faltan = diasEntre(hoy, desde)
  if (faltan === 0) return 'Sale hoy'
  if (faltan < 0) return `Empezó hace ${Math.abs(faltan)} ${faltan === -1 ? 'día' : 'días'}`
  return `Faltan ${faltan} ${faltan === 1 ? 'día' : 'días'}`
}

/** El aviso de que se esta emitiendo tarde, o null si hay tiempo de sobra.
 *
 *  Avisa y no impide: el numero es provisorio (ver config.ts) y una salida que
 *  ya esta organizada no se puede desarmar porque el sistema tenga un numero
 *  que la asociacion todavia no confirmo. Cuando lo confirme, esto puede pasar
 *  a bloquear cambiando solo quien lo llama.
 *
 *  Vive en el dominio y no en el servidor porque las pantallas lo muestran
 *  antes de apretar "emitir": la misma funcion decide en los dos lados. */
export function avisoDeAnticipacion(hoy: string, desde: string): Aviso | null {
  const faltan = diasEntre(hoy, desde)
  if (faltan >= DIAS_DE_ANTICIPACION) return null
  return {
    codigo: 'anticipacionInsuficiente',
    mensaje:
      faltan < 0
        ? `La salida ya empezó. La asociación pide presentarlo con ${DIAS_DE_ANTICIPACION} días de anticipación.`
        : `Faltan ${faltan} días: la asociación pide ${DIAS_DE_ANTICIPACION} de anticipación.`,
  }
}
