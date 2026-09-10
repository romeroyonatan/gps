import { describe, expect, test } from 'bun:test'
import { leerEntorno, leerPuerto, leerRutaDeBd } from '../src/index'

describe('leerEntorno', () => {
  test('sin ENTORNO definido, usa desarrollo', () => {
    expect(leerEntorno(undefined)).toBe('desarrollo')
  })

  test('acepta los cuatro entornos conocidos', () => {
    expect(['desarrollo', 'produccion', 'prueba', 'demo'].map(leerEntorno)).toEqual([
      'desarrollo',
      'produccion',
      'prueba',
      'demo',
    ])
  })

  test('con un valor desconocido, lanza en vez de arrancar en desarrollo', () => {
    expect(() => leerEntorno('production')).toThrow('ENTORNO invalido')
  })
})

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
