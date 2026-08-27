import { describe, expect, test } from 'bun:test'
import { etiquetaDeEdades, RAMAS } from '../src/dominio/ramas'

describe('catalogo de RAMAS', () => {
  test('tiene las seis ramas, de menor a mayor edad', () => {
    expect(RAMAS.map((rama) => rama.id)).toEqual([
      'castores',
      'lobatos',
      'scouts',
      'raiders',
      'rovers',
      'adultos',
    ])
  })

  test('los tramos de edad se encadenan sin huecos ni superposicion', () => {
    // El tope de cada rama es el piso de la siguiente: un chico de 10 pasa de
    // Lobatos a Scouts sin quedar afuera de las dos ni adentro de ambas.
    // Los tipos se ensanchan a mano: `slice` sobre una tupla `as const` devuelve
    // la union de todos los elementos, y sin ensanchar, el 5 de Castores no es
    // asignable al tipo de los topes y `expect` no resuelve la sobrecarga.
    const topes: readonly (number | null)[] = RAMAS.slice(0, -1).map((rama) => rama.hasta)
    const pisos: readonly (number | null)[] = RAMAS.slice(1).map((rama) => rama.desde)
    expect(topes).toEqual(pisos)
  })

  test('solo la ultima rama no tiene tope: Adultos es abierta hacia arriba', () => {
    expect(RAMAS.filter((rama) => rama.hasta === null).map((rama) => rama.id)).toEqual(['adultos'])
  })
})

describe('etiquetaDeEdades', () => {
  test('un tramo cerrado va con el guion largo entre las dos edades', () => {
    expect(RAMAS.map(etiquetaDeEdades)).toEqual(['5–7', '7–10', '10–14', '14–17', '17–21', '21+'])
  })
})
