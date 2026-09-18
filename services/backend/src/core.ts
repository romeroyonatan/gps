import type { Almacenamiento, Bd, Config, ConversorDeImagenes, Core, Sellador } from '@gps/core'

export function crearCore(
  config: Config,
  modulos: readonly string[],
  bd: Bd,
  sellador: Sellador,
  almacenamiento: Almacenamiento,
  conversorDeImagenes: ConversorDeImagenes,
): Core {
  return {
    config,
    modulos,
    bd,
    sellador,
    almacenamiento,
    conversorDeImagenes,
    reloj: { ahora: () => new Date() },
    nuevoId: (prefijo) => `${prefijo}_${Bun.randomUUIDv7()}`,
    hash: (contenido) => new Bun.CryptoHasher('sha256').update(contenido).digest('hex'),
    logger: {
      info: (mensaje, datos) => console.log(JSON.stringify({ nivel: 'info', mensaje, ...datos })),
      error: (mensaje, datos) =>
        console.error(JSON.stringify({ nivel: 'error', mensaje, ...datos })),
    },
  }
}
