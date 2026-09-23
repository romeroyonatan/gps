import { crearRegistroDeAuditoria } from '@gps/auditoria/servidor'
import {
  type Almacenamiento,
  type Bd,
  type Config,
  type ConversorDeImagenes,
  type Core,
  crearBusDeEventos,
  type Sellador,
} from '@gps/core'

function nuevoSecreto(bytes = 32): string {
  if (!Number.isInteger(bytes) || bytes < 1)
    throw new RangeError('bytes tiene que ser un entero positivo')
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

export function crearCore(
  config: Config,
  modulos: readonly string[],
  bd: Bd,
  sellador: Sellador,
  almacenamiento: Almacenamiento,
  conversorDeImagenes: ConversorDeImagenes,
): Core {
  const reloj = { ahora: () => new Date() }
  const nuevoId = (prefijo: string) => `${prefijo}_${Bun.randomUUIDv7()}`
  return {
    config,
    modulos,
    bd,
    eventos: crearBusDeEventos(),
    auditoria: crearRegistroDeAuditoria(bd, reloj, nuevoId),
    sellador,
    almacenamiento,
    conversorDeImagenes,
    reloj,
    nuevoId,
    nuevoSecreto,
    hash: (contenido) => new Bun.CryptoHasher('sha256').update(contenido).digest('hex'),
    logger: {
      info: (mensaje, datos) => console.log(JSON.stringify({ nivel: 'info', mensaje, ...datos })),
      error: (mensaje, datos) =>
        console.error(JSON.stringify({ nivel: 'error', mensaje, ...datos })),
    },
  }
}
