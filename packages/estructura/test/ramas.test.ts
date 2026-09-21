import { describe, expect, test } from 'bun:test'
import { etiquetaDeEdades, RAMAS, ramaDelCatalogo, ramaParaEdad } from '../src/dominio/ramas'

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

  test('cada rama sabe como se llama su unidad', () => {
    expect(RAMAS.map((rama) => rama.unidad)).toEqual([
      'Colonia',
      'Manada',
      'Tropa scout',
      'Tropa raider',
      'Clan',
      'Tropa',
    ])
  })
})

describe('etiquetaDeEdades', () => {
  test('un tramo cerrado va con el guion largo entre las dos edades', () => {
    expect(RAMAS.map(etiquetaDeEdades)).toEqual(['5–7', '7–10', '10–14', '14–17', '17–21', '21+'])
  })
})

describe('ramaDelCatalogo', () => {
  test('devuelve la entrada del catalogo, no solo el nombre', () => {
    // Los consumidores le piden nombre y tambien le pasan la entrada entera a
    // etiquetaDeEdades, por eso el helper devuelve la entrada y no un string.
    expect(ramaDelCatalogo('lobatos')).toEqual({
      id: 'lobatos',
      nombre: 'Lobatos',
      desde: 7,
      hasta: 10,
      unidad: 'Manada',
    })
  })

  test('un id que no esta en el catalogo no rompe: devuelve undefined', () => {
    // Es el caso que el comentario de RAMAS avisa: sacar o renombrar una rama
    // deja ids viejos dando vueltas en los datos, y el helper tiene que poder
    // decir "no esta" sin tirar.
    expect(ramaDelCatalogo('inexistente' as never)).toBeUndefined()
  })
})

describe('ramaParaEdad', () => {
  test('cada edad cae en la rama de su tramo', () => {
    expect(ramaParaEdad(5)?.id).toBe('castores')
    expect(ramaParaEdad(6)?.id).toBe('castores')
    expect(ramaParaEdad(8)?.id).toBe('lobatos')
    expect(ramaParaEdad(12)?.id).toBe('scouts')
    expect(ramaParaEdad(15)?.id).toBe('raiders')
    expect(ramaParaEdad(19)?.id).toBe('rovers')
  })

  test('el borde es del que empieza: hasta es exclusivo', () => {
    // El de 10 ya es scout, no lobato. Es donde se equivocan las dos copias
    // de esta regla que hubiera si viviera en las pantallas.
    expect(ramaParaEdad(10)?.id).toBe('scouts')
    expect(ramaParaEdad(14)?.id).toBe('raiders')
    expect(ramaParaEdad(17)?.id).toBe('rovers')
    expect(ramaParaEdad(21)?.id).toBe('adultos')
  })

  test('adultos está abierta hacia arriba', () => {
    expect(ramaParaEdad(40)?.id).toBe('adultos')
    expect(ramaParaEdad(95)?.id).toBe('adultos')
  })

  test('por debajo de castores no hay rama', () => {
    // Devolver la primera sería inventar que el de 3 años entra en alguna.
    expect(ramaParaEdad(4)).toBeUndefined()
    expect(ramaParaEdad(0)).toBeUndefined()
  })
})
