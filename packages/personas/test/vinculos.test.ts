import { describe, expect, test } from 'bun:test'
import { estaVigente, estaVigenteParaAcceso } from '../src/dominio/vinculos'

/** Un mediodia, no una medianoche: a las 00:00 UTC-3 el dia local y el UTC son
 *  distintos, y eso es lo que este test tiene que poder distinguir. */
const mediodia = (texto: string) => new Date(`${texto}T12:00:00`)

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

describe('estaVigenteParaAcceso', () => {
  test('una remocion inmediata corta el acceso aunque el mandato siga vigente', () => {
    expect(
      estaVigenteParaAcceso(
        {
          desde: '2026-03-01',
          hasta: '2030-03-01',
          revocadoEn: new Date('2027-06-01T15:00:00Z'),
        },
        mediodia('2027-06-01'),
      ),
    ).toBe(false)
  })

  test('sin revocacion respeta el periodo inclusivo', () => {
    expect(
      estaVigenteParaAcceso(
        { desde: '2026-03-01', hasta: '2030-03-01', revocadoEn: null },
        mediodia('2030-03-01'),
      ),
    ).toBe(true)
  })
})
