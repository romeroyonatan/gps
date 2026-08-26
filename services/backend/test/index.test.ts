import { describe, expect, test } from 'bun:test'
import { leerPuerto } from '../src/index'

describe('leerPuerto', () => {
  test('sin PUERTO definido, usa 3000 por defecto', () => {
    expect(leerPuerto(undefined)).toBe(3000)
  })

  test('con un valor valido, lo usa', () => {
    expect(leerPuerto('4000')).toBe(4000)
  })

  test('con un valor malformado, lanza en vez de dejarlo en NaN', () => {
    expect(() => leerPuerto('abc')).toThrow('PUERTO invalido')
  })
})
