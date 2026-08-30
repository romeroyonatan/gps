import { describe, expect, test } from 'bun:test'
import { aFechaDeCalendario, estaVigente } from '../src/dominio/vinculos'

/** Un mediodia, no una medianoche: a las 00:00 UTC-3 el dia local y el UTC son
 *  distintos, y eso es lo que este test tiene que poder distinguir. */
const mediodia = (texto: string) => new Date(`${texto}T12:00:00`)

describe('aFechaDeCalendario', () => {
  test('usa los componentes locales, no UTC', () => {
    // toISOString() daria el dia siguiente para una hora nocturna en UTC-3: la
    // fecha de un vinculo es de calendario, no un instante.
    expect(aFechaDeCalendario(new Date(2026, 4, 1, 22, 30))).toBe('2026-05-01')
  })

  test('rellena mes y dia con cero', () => {
    expect(aFechaDeCalendario(new Date(2026, 0, 9))).toBe('2026-01-09')
  })
})

describe('estaVigente', () => {
  const cargo = { desde: '2026-03-01', hasta: '2030-03-01' }

  test('el dia que empieza ya esta vigente', () => {
    expect(estaVigente(cargo, mediodia('2026-03-01'))).toBe(true)
  })

  test('la vispera todavia no', () => {
    expect(estaVigente(cargo, mediodia('2026-02-28'))).toBe(false)
  })

  test('el dia que termina sigue vigente', () => {
    // El `hasta` es inclusivo: un mandato "hasta el 1 de marzo de 2030" incluye
    // ese dia.
    expect(estaVigente(cargo, mediodia('2030-03-01'))).toBe(true)
  })

  test('el dia siguiente al fin ya no', () => {
    expect(estaVigente(cargo, mediodia('2030-03-02'))).toBe(false)
  })

  test('sin hasta, sigue vigente para siempre', () => {
    expect(estaVigente({ desde: '2026-03-01', hasta: null }, mediodia('2099-01-01'))).toBe(true)
  })
})
