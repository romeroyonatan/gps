import { describe, expect, test } from 'bun:test'
import { importeEnPesosValido, imputacionDelPago } from '../src/dominio'

describe('reglas de la cuenta corriente', () => {
  test('los importes son pesos enteros positivos', () => {
    expect(importeEnPesosValido(20000)).toBe(true)
    expect(importeEnPesosValido(0)).toBe(false)
    expect(importeEnPesosValido(-1)).toBe(false)
    expect(importeEnPesosValido(1.5)).toBe(false)
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
