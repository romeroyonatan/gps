import { type Bd, type Config, type Core, crearBusDeEventos } from '@gps/core'

export function crearCore(config: Config, modulos: readonly string[], bd: Bd): Core {
  return {
    config,
    modulos,
    bd,
    eventos: crearBusDeEventos(),
    reloj: { ahora: () => new Date() },
    nuevoId: (prefijo) => `${prefijo}_${Bun.randomUUIDv7()}`,
    logger: {
      info: (mensaje, datos) => console.log(JSON.stringify({ nivel: 'info', mensaje, ...datos })),
      error: (mensaje, datos) =>
        console.error(JSON.stringify({ nivel: 'error', mensaje, ...datos })),
    },
  }
}
