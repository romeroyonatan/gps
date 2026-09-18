import { describe, expect, test } from 'bun:test'
import { nombreDeLaUnidad, ramasDeLasUnidades } from '../src/dominio/unidades'

describe('nombreDeLaUnidad', () => {
  test('compone el tipo de la rama, el nombre propio y el sexo', () => {
    expect(nombreDeLaUnidad({ rama: 'scouts', nombre: 'Santa Juana', sexo: 'femenina' })).toBe(
      'Tropa scout Santa Juana · femenina',
    )
  })

  test('scouts y raiders se distinguen aunque a las dos se les diga tropa', () => {
    expect(nombreDeLaUnidad({ rama: 'scouts', nombre: 'San Jorge', sexo: 'mixta' })).toBe(
      'Tropa scout San Jorge · mixta',
    )
    expect(nombreDeLaUnidad({ rama: 'raiders', nombre: 'San Jorge', sexo: 'mixta' })).toBe(
      'Tropa raider San Jorge · mixta',
    )
  })

  test('no repite el tipo cuando el nombre propio ya es el tipo', () => {
    // Es el nombre que dejo la migracion a las unidades que venian de
    // ramas_del_grupo, y el que usa el demo para los grupos con una sola.
    expect(nombreDeLaUnidad({ rama: 'castores', nombre: 'Colonia', sexo: 'mixta' })).toBe(
      'Colonia · mixta',
    )
  })

  test('una rama que ya no esta en el catalogo deja el nombre propio, no rompe', () => {
    // Mismo criterio que ramaDelCatalogo: sacar una rama deja ids viejos en los
    // datos, y mostrarlos a medias es mejor que tirar.
    expect(
      nombreDeLaUnidad({ rama: 'inexistente' as never, nombre: 'Seeonee', sexo: 'mixta' }),
    ).toBe('Seeonee · mixta')
  })
})

describe('ramasDeLasUnidades', () => {
  test('dos unidades de la misma rama son una sola rama abierta', () => {
    expect(
      ramasDeLasUnidades([{ rama: 'scouts' }, { rama: 'scouts' }, { rama: 'lobatos' }]),
    ).toEqual(['lobatos', 'scouts'])
  })

  test('vienen de menor a mayor edad, no en el orden en que se cargaron', () => {
    expect(ramasDeLasUnidades([{ rama: 'rovers' }, { rama: 'castores' }])).toEqual([
      'castores',
      'rovers',
    ])
  })

  test('un grupo sin unidades no tiene ninguna rama abierta', () => {
    expect(ramasDeLasUnidades([])).toEqual([])
  })

  test('una rama que ya no esta en el catalogo no se cuela', () => {
    // `ramas: [Rama!]!` es no nulo hasta arriba: un id viejo anularia la query
    // entera, o sea pantalla en blanco.
    expect(ramasDeLasUnidades([{ rama: 'inexistente' as never }, { rama: 'scouts' }])).toEqual([
      'scouts',
    ])
  })
})
