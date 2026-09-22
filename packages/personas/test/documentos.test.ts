import { describe, expect, test } from 'bun:test'
import {
  nombreDelTipo,
  normalizarNumero,
  paraMarcar,
  TIPOS_DE_DOCUMENTO,
} from '../src/dominio/documentos'

describe('catalogo TIPOS_DE_DOCUMENTO', () => {
  test('tiene DNI y pasaporte, en ese orden', () => {
    expect(TIPOS_DE_DOCUMENTO.map((tipo) => tipo.id)).toEqual(['dni', 'pasaporte'])
  })
})

describe('nombreDelTipo', () => {
  test('devuelve la etiqueta que muestra la pantalla', () => {
    expect(nombreDelTipo('dni')).toBe('DNI')
    expect(nombreDelTipo('pasaporte')).toBe('Pasaporte')
  })
})

describe('normalizarNumero', () => {
  test('un DNI con puntos y uno sin puntos son el mismo numero', () => {
    // Es la razon de ser de la funcion: sin esto, el UNIQUE de (tipo, numero) no
    // impide cargar dos veces a la misma persona, que es para lo que existe.
    expect(normalizarNumero('30.111.222')).toBe(normalizarNumero('30111222'))
  })

  test('saca puntos, espacios y guiones', () => {
    expect(normalizarNumero(' 30.111-222 ')).toBe('30111222')
  })

  test('pasa a mayusculas, que es lo que importa en un pasaporte', () => {
    expect(normalizarNumero('ab123456')).toBe('AB123456')
  })

  test('un numero ya limpio no cambia', () => {
    expect(normalizarNumero('30111222')).toBe('30111222')
  })
})

describe('paraMarcar', () => {
  test('saca espacios, guiones y paréntesis', () => {
    expect(paraMarcar('11 5555-1234')).toBe('1155551234')
    expect(paraMarcar('(011) 4555.1234')).toBe('01145551234')
  })

  test('conserva el + del prefijo internacional, y sólo ése', () => {
    expect(paraMarcar('+54 9 11 5555-1234')).toBe('+5491155551234')
    expect(paraMarcar('11+5555')).toBe('115555')
  })
})
