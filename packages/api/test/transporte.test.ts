import { describe, expect, test } from 'bun:test'
import { transporteHttp } from '../src/transporte'

describe('origen', () => {
  test('de una URL absoluta sale el origen', () => {
    // Es lo que mobile antepone para subir un archivo: sin esto, el PUT va a
    // una ruta relativa que React Native no sabe resolver.
    expect(transporteHttp('http://192.168.0.10:3000/graphql').origen).toBe(
      'http://192.168.0.10:3000',
    )
  })

  test('de una URL relativa queda vacio', () => {
    // Asi la usa la web: el navegador resuelve contra la pagina, y anteponerle
    // algo la romperia.
    expect(transporteHttp('/graphql').origen).toBe('')
  })
})
