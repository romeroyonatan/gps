import { describe, expect, test } from 'bun:test'
import type { Core } from '@gps/core'
import { crearServicioDeSistema } from '../src/servidor/servicio'

function coreFalso(parcial: Partial<Core> = {}): Core {
  return {
    config: { version: '9.9.9', entorno: 'prueba', puerto: 0 },
    logger: { info: () => {}, error: () => {} },
    reloj: { ahora: () => new Date('2026-01-01T00:00:00Z') },
    modulos: ['sistema'],
    ...parcial,
  }
}

describe('crearServicioDeSistema', () => {
  test('devuelve la version que le inyectaron, no una leida del disco', () => {
    const servicio = crearServicioDeSistema(coreFalso())
    expect(servicio.obtenerVersion().numero).toBe('9.9.9')
  })

  test('devuelve el entorno inyectado', () => {
    const servicio = crearServicioDeSistema(coreFalso())
    expect(servicio.obtenerVersion().entorno).toBe('prueba')
  })

  test('lista los modulos registrados', () => {
    const servicio = crearServicioDeSistema(coreFalso({ modulos: ['sistema', 'personas'] }))
    expect(servicio.obtenerVersion().modulos).toEqual(['sistema', 'personas'])
  })
})
