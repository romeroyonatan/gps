import { describe, expect, test } from 'bun:test'
import { type Bd, type Core, crearBusDeEventos } from '@gps/core'
import { crearServicioDeSistema } from '../src/servidor/servicio'

function coreFalso(parcial: Partial<Core> = {}): Core {
  return {
    config: { version: '9.9.9', entorno: 'prueba', puerto: 0 },
    logger: { info: () => {}, error: () => {} },
    reloj: { ahora: () => new Date('1970-01-01T00:00:00Z') },
    // sistema no consulta la base ni genera ids: el fake no los provee, y si
    // algun dia los usara este test explotaria, que es lo que queremos.
    bd: null as unknown as Bd,
    eventos: crearBusDeEventos(),
    nuevoId: () => {
      throw new Error('sistema no deberia generar ids')
    },
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
