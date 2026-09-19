import { describe, expect, test } from 'bun:test'
import { fechaValida, importeEnPesosValido, saldoDe } from '../src/dominio'

describe('reglas de la cuenta corriente', () => {
  test('suma cargos, pagos y anulaciones con su signo', () => {
    expect(saldoDe([{ importe: 200000 }, { importe: -50000 }, { importe: 50000 }])).toBe(200000)
  })

  test('un pago superior deja saldo a favor', () => {
    expect(saldoDe([{ importe: 20000 }, { importe: -30000 }])).toBe(-10000)
  })

  test('los importes son pesos enteros positivos', () => {
    expect(importeEnPesosValido(20000)).toBe(true)
    expect(importeEnPesosValido(0)).toBe(false)
    expect(importeEnPesosValido(-1)).toBe(false)
    expect(importeEnPesosValido(1.5)).toBe(false)
  })

  test('la fecha debe existir y usar aaaa-mm-dd', () => {
    expect(fechaValida('2026-05-01')).toBe(true)
    expect(fechaValida('2026-02-30')).toBe(false)
    expect(fechaValida('01/05/2026')).toBe(false)
  })
})
