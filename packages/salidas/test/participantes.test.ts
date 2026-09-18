import { describe, expect, test } from 'bun:test'
import { cuantos, resumenDeParticipantes } from '../src/dominio/participantes'

describe('cuantos', () => {
  test('el singular no dice "1 dirigentes"', () => {
    // Es lo primero que se ve mal, tanto en la pantalla como en el papel.
    expect(cuantos(1, 'dirigente')).toBe('1 dirigente')
  })

  test('cero y varios van en plural', () => {
    expect(cuantos(0, 'dirigente')).toBe('0 dirigentes')
    expect(cuantos(4, 'beneficiario')).toBe('4 beneficiarios')
  })
})

describe('resumenDeParticipantes', () => {
  test('cuenta cada tipo y los escribe para mostrar', () => {
    expect(
      resumenDeParticipantes([
        { marca: 'dirigente' },
        { marca: 'beneficiario' },
        { marca: 'beneficiario' },
      ]),
    ).toBe('1 dirigente, 2 beneficiarios')
  })

  test('sin nadie lo dice igual, en plural', () => {
    expect(resumenDeParticipantes([])).toBe('0 dirigentes, 0 beneficiarios')
  })
})
