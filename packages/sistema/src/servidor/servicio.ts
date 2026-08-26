import type { Core } from '@gps/core'
import type { Version } from '../dominio/index'

export interface ServicioDeSistema {
  obtenerVersion(): Version
}

/** Todo lo que necesita llega por Core. El modulo no lee el package.json ni
 *  el entorno: eso lo resuelve la raiz de composicion. Ver la regla de
 *  portabilidad en AGENT.md. */
export function crearServicioDeSistema(core: Core): ServicioDeSistema {
  return {
    obtenerVersion: () => ({
      numero: core.config.version,
      entorno: core.config.entorno,
      modulos: core.modulos,
    }),
  }
}
