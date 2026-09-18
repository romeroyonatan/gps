import { describe, expect, test } from 'bun:test'
import { deserializar, estaVacio, serializar, type Trazos } from '../src/dominio/trazos'

const firma: Trazos = { trazos: [[[0.1, 0.2] as const, [0.3, 0.4] as const]] }

describe('serializar', () => {
  test('dos representaciones equivalentes dan la misma cadena', () => {
    // Es la razon de ser del redondeo: si 0.1 se releyera de la base como
    // 0.10000000000000001, el sello dejaria de cerrar y una firma legitima
    // pasaria por adulterada.
    const conRuido: Trazos = {
      trazos: [[[0.10000000000000001, 0.2] as const, [0.3, 0.4] as const]],
    }
    expect(serializar(conRuido)).toBe(serializar(firma))
  })

  test('mas alla del cuarto decimal no cambia nada', () => {
    const casi: Trazos = { trazos: [[[0.100004, 0.2] as const, [0.3, 0.4] as const]] }
    expect(serializar(casi)).toBe(serializar(firma))
  })

  test('el cuarto decimal si cuenta', () => {
    const otra: Trazos = { trazos: [[[0.1002, 0.2] as const, [0.3, 0.4] as const]] }
    expect(serializar(otra)).not.toBe(serializar(firma))
  })

  test('el cero negativo no se cuela como "-0"', () => {
    // Un gesto que empieza justo en el borde puede dar -0, que serializa
    // distinto que 0 y rompe la comparacion.
    expect(serializar({ trazos: [[[-0, 0] as const]] })).toBe(
      serializar({ trazos: [[[0, 0] as const]] }),
    )
  })

  test('el orden de los trazos importa: una firma al reves no es la misma', () => {
    const alReves: Trazos = { trazos: [[[0.3, 0.4] as const, [0.1, 0.2] as const]] }
    expect(serializar(alReves)).not.toBe(serializar(firma))
  })
})

describe('estaVacio', () => {
  test('sin ningun trazo esta vacio', () => {
    expect(estaVacio({ trazos: [] })).toBe(true)
  })

  test('con trazos sin puntos tambien: es apretar firmar sin dibujar', () => {
    expect(estaVacio({ trazos: [[], []] })).toBe(true)
  })

  test('con un punto ya no', () => {
    expect(estaVacio({ trazos: [[[0.5, 0.5] as const]] })).toBe(false)
  })
})

describe('deserializar', () => {
  test('lo que serializa lo lee igual', () => {
    expect(serializar(deserializar(serializar(firma)) ?? { trazos: [] })).toBe(serializar(firma))
  })

  test('algo corrupto devuelve null en vez de tirar', () => {
    // Una firma con trazos ilegibles tiene que poder mostrarse como "no
    // verificada" sin tumbar la consulta del permiso entero.
    expect(deserializar('{ no es json')).toBeNull()
    expect(deserializar('{"trazos": 1}')).toBeNull()
  })
})
