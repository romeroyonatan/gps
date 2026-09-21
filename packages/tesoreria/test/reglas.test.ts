import { describe, expect, test } from 'bun:test'
import { fechaValida, importeEnPesosValido, imputacionDelPago, saldoDe } from '../src/dominio'

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

describe('imputación del pago que se está por asentar', () => {
  test('sin importe todavía no dice nada', () => {
    expect(imputacionDelPago(207000, 0)).toEqual({ tipo: 'sinImporte' })
    expect(imputacionDelPago(207000, Number.NaN)).toEqual({ tipo: 'sinImporte' })
  })

  test('el importe justo cancela la deuda', () => {
    expect(imputacionDelPago(207000, 207000)).toEqual({ tipo: 'cancela' })
  })

  test('el importe menor deja el resto de deuda', () => {
    expect(imputacionDelPago(207000, 100000)).toEqual({ tipo: 'parcial', resta: 107000 })
  })

  // Pagar de más no es un error: el sobrante queda a favor del grupo, igual
  // que lo guarda el servidor.
  test('el importe mayor deja saldo a favor', () => {
    expect(imputacionDelPago(207000, 250000)).toEqual({ tipo: 'aFavor', sobra: 43000 })
    expect(imputacionDelPago(0, 50000)).toEqual({ tipo: 'aFavor', sobra: 50000 })
  })
})
