import { describe, expect, test } from 'bun:test'
import { validarFecha } from '../src/dominio/validaciones'

describe('validarFecha', () => {
  test('una fecha bien formada, no futura y no anterior a la ultima, pasa', () => {
    expect(validarFecha('1970-05-01', '1970-03-01', '1970-06-01')).toBeNull()
  })

  test('sin declaraciones previas, cualquier fecha no futura pasa', () => {
    expect(validarFecha('1970-05-01', null, '1970-06-01')).toBeNull()
  })

  test('rechaza lo que no tiene forma de fecha', () => {
    expect(validarFecha('1/5/70', null, '1970-06-01')).toContain('aaaa-mm-dd')
  })

  test('rechaza una fecha futura', () => {
    expect(validarFecha('1970-07-01', null, '1970-06-01')).toContain('futura')
  })

  test('hoy mismo no es futuro', () => {
    expect(validarFecha('1970-06-01', null, '1970-06-01')).toBeNull()
  })

  test('rechaza una fecha anterior a la ultima declaracion', () => {
    // Es lo que impide que aparezca una declaracion "en el medio" y le mueva el
    // a-cobrar a una ya emitida. Ver §4.5 de la spec.
    expect(validarFecha('1970-04-01', '1970-05-01', '1970-06-01')).toContain('anterior')
  })

  test('la misma fecha que la ultima si pasa', () => {
    // Un grupo declarando el mismo dia que otro es normal: las ordinarias son
    // una declaracion por grupo, todas con la misma fecha.
    expect(validarFecha('1970-05-01', '1970-05-01', '1970-06-01')).toBeNull()
  })
})
