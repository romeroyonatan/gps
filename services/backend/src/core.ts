import type { Config, Core } from '@gps/core'

export function crearCore(config: Config, modulos: readonly string[]): Core {
  return {
    config,
    modulos,
    reloj: { ahora: () => new Date() },
    logger: {
      info: (mensaje, datos) => console.log(JSON.stringify({ nivel: 'info', mensaje, ...datos })),
      error: (mensaje, datos) =>
        console.error(JSON.stringify({ nivel: 'error', mensaje, ...datos })),
    },
  }
}
