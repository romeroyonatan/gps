import { timingSafeEqual } from 'node:crypto'
import type { Sellador, Sello } from '@gps/core'

/** HMAC-SHA256 sobre los datos, con la clave que dice `claveId`.
 *
 *  Sellar usa siempre la clave activa; verificar usa la que el sello declara,
 *  que es lo que permite rotar sin invalidar lo ya firmado. Una clave que ya no
 *  esta configurada no verifica: no se puede afirmar que el sello sea legitimo.
 *
 *  La comparacion es en tiempo constante. Es la unica parte que no es obvia:
 *  con `===` el tiempo de respuesta filtra cuantos bytes del sello acerto quien
 *  prueba, y con suficientes intentos eso permite construir uno valido. */
export function crearSellador(claves: Readonly<Record<string, string>>, activa: string): Sellador {
  const claveActiva = claves[activa]
  if (claveActiva === undefined) {
    throw new Error(`La clave de sello activa "${activa}" no esta configurada.`)
  }

  function calcular(datos: string, clave: string): string {
    return new Bun.CryptoHasher('sha256', clave).update(datos).digest('hex')
  }

  return {
    sellar: (datos) => ({ sello: calcular(datos, claveActiva), claveId: activa }),

    verificar(datos, sello: Sello) {
      const clave = claves[sello.claveId]
      if (clave === undefined) return false
      const esperado = calcular(datos, clave)
      // timingSafeEqual exige el mismo largo; los dos son hex de sha256, pero
      // el sello llega de la base y puede estar cortado.
      if (esperado.length !== sello.sello.length) return false
      return timingSafeEqual(Buffer.from(esperado), Buffer.from(sello.sello))
    },
  }
}
