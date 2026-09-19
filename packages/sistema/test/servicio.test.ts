import { describe, expect, test } from 'bun:test'
import type { Bd, Core } from '@gps/core'
import { crearServicioDeSistema } from '../src/servidor/servicio'

function coreFalso(parcial: Partial<Core> = {}): Core {
  return {
    config: { version: '9.9.9', entorno: 'prueba', puerto: 0, auth: null },
    logger: { info: () => {}, error: () => {} },
    reloj: { ahora: () => new Date('1970-01-01T00:00:00Z') },
    // sistema no consulta la base ni genera ids: el fake no los provee, y si
    // algun dia los usara este test explotaria, que es lo que queremos.
    bd: null as unknown as Bd,
    // Falso pero con el comportamiento que importa: sellar y verificar cierran
    // entre si, y un dato alterado no verifica.
    sellador: {
      sellar: (datos: string) => ({ sello: `sellado:${datos}`, claveId: 'prueba' }),
      verificar: (datos: string, sello: { sello: string; claveId: string }) =>
        sello.claveId === 'prueba' && sello.sello === `sellado:${datos}`,
    },
    almacenamiento: {
      guardar: async () => {},
      leer: async () => new Uint8Array(),
      eliminar: async () => {},
    },
    conversorDeImagenes: { aJpeg: async (contenido: Uint8Array) => contenido },
    // Falso pero estable y sensible al contenido, que es lo que los tests miran.
    hash: (contenido: Uint8Array | string) =>
      `hash:${typeof contenido === 'string' ? contenido : contenido.join(',')}`,
    nuevoId: () => {
      throw new Error('sistema no deberia generar ids')
    },
    nuevoSecreto: () => {
      throw new Error('sistema no deberia generar secretos')
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
