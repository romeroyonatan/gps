import { describe, expect, test } from 'bun:test'
import type { Config } from '@gps/core'
import { crearAlmacenamientoEnMemoria } from '../src/almacenamiento'
import { crearBd } from '../src/bd'
import { crearConversorDeImagenes } from '../src/conversor'
import { crearCore } from '../src/core'
import { crearSellador } from '../src/sellador'

const sellador = crearSellador({ prueba: 'una-clave' }, 'prueba')

const config: Config = { version: '1.2.3', entorno: 'prueba', puerto: 0, auth: null }

const core = () =>
  crearCore(
    config,
    ['sistema'],
    crearBd(':memory:'),
    sellador,
    crearAlmacenamientoEnMemoria(),
    crearConversorDeImagenes(),
  )

describe('crearCore', () => {
  test('nuevoId prefija un UUID version 7 con el nombre de la entidad', () => {
    // El tercer grupo del UUID empieza con el nibble de version: 7, no 4.
    expect(core().nuevoId('grupo')).toMatch(
      /^grupo_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })

  test('los ids de una misma entidad salen ordenados por creacion', () => {
    // Es la propiedad por la que se eligio v7 sobre v4, y el prefijo no la
    // rompe: todas las filas de una tabla lo comparten, asi que adentro de su
    // indice el orden lo sigue decidiendo el UUID.
    const uno = core()
    const generados = Array.from({ length: 1000 }, () => uno.nuevoId('grupo'))
    expect(generados).toEqual([...generados].sort())
  })

  test('genera secretos de la cantidad pedida y no los repite', () => {
    const uno = core()
    expect(uno.nuevoSecreto(16)).toMatch(/^[0-9a-f]{32}$/)
    expect(uno.nuevoSecreto()).not.toBe(uno.nuevoSecreto())
    expect(() => uno.nuevoSecreto(0)).toThrow('entero positivo')
  })

  test('expone la base que le pasaron', () => {
    const bd = crearBd(':memory:')
    expect(
      crearCore(
        config,
        [],
        bd,
        sellador,
        crearAlmacenamientoEnMemoria(),
        crearConversorDeImagenes(),
      ).bd,
    ).toBe(bd)
  })
})
