import type { TipoDeCargo } from '@gps/personas/dominio'
import type { Estado } from './modelos'

/** Lo mínimo que hace falta para repartir un permiso en el panel. Estructural
 *  y no `Permiso`, porque lo que llega a las pantallas es lo que devuelve
 *  GraphQL: trae las firmas adentro y no trae el hash ni las marcas. */
export interface PermisoDelPanel {
  readonly estado: Estado
  readonly desde: string
  readonly firmas: readonly { readonly cargo: TipoDeCargo; readonly firmada: boolean }[]
}

export type CategoriaDeSalida = 'actuales' | 'finalizadas' | 'anuladas'

/** Una salida que termina hoy sigue en la lista habitual porque todavía está
 *  en curso. Lo anulado queda aparte aunque su fecha ya haya pasado. */
export function categoriaDeSalida(
  permiso: { readonly estado: Estado; readonly hasta: string },
  hoy: string,
): CategoriaDeSalida {
  if (permiso.estado === 'anulado') return 'anuladas'
  return permiso.hasta < hoy ? 'finalizadas' : 'actuales'
}

/** Cómo se reparten las salidas de un grupo: lo que espera una firma de quien
 *  mira, lo que espera la de otro, y lo firmado que todavía no pasó.
 *
 *  Las tres son excluyentes y salen del mismo dato, por eso viven juntas: el
 *  inicio las cuenta y la pantalla de salidas marca cada tarjeta con lo mismo,
 *  y dos implementaciones de "espera tu firma" terminan contradiciéndose.
 *
 *  Quién puede firmar llega por parámetro: que alguien ocupe un cargo lo sabe
 *  `politicas`, no esto. Lo de acá es sólo en qué pila cae cada permiso. */
export function repartirSalidas<P extends PermisoDelPanel>(
  permisos: readonly P[],
  hoy: string,
  puedoFirmar: (cargo: TipoDeCargo) => boolean,
): { esperanMiFirma: readonly P[]; esperanOtraFirma: readonly P[]; proximas: readonly P[] } {
  const esperanMiFirma: P[] = []
  const esperanOtraFirma: P[] = []
  const proximas: P[] = []

  for (const permiso of permisos) {
    if (permiso.estado === 'emitido') {
      const pendientes = permiso.firmas.filter((firma) => !firma.firmada)
      // Emitido sin firmas pendientes no existe -entra la tercera y pasa a
      // firmado-, pero si llegara no va en ninguna pila: no espera nada.
      if (pendientes.length === 0) continue
      if (pendientes.some((firma) => puedoFirmar(firma.cargo))) esperanMiFirma.push(permiso)
      else esperanOtraFirma.push(permiso)
      // Compara texto: aaaa-mm-dd ordena igual lexicográfica que
      // cronológicamente. El día de la salida todavía cuenta como próxima.
    } else if (permiso.estado === 'firmado' && permiso.desde >= hoy) {
      proximas.push(permiso)
    }
  }

  return { esperanMiFirma, esperanOtraFirma, proximas }
}
