import { describe, expect, test } from 'bun:test'
import { leerPuerto, leerRutaDeBd } from '../src/index'

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

describe('leerRutaDeBd', () => {
  test('sin BD definida, usa un archivo en el directorio de trabajo', () => {
    expect(leerRutaDeBd('desarrollo', undefined)).toBe('./gps.db')
  })

  test('respeta BD cuando esta definida', () => {
    expect(leerRutaDeBd('produccion', '/datos/gps.db')).toBe('/datos/gps.db')
  })

  test('en demo ignora BD y usa memoria', () => {
    // Es lo que garantiza que un build de demostracion no pueda apuntar a
    // datos reales, ni siquiera por una variable de entorno mal puesta.
    expect(leerRutaDeBd('demo', '/datos/gps.db')).toBe(':memory:')
  })
})
