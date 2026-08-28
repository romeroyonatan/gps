import { describe, expect, test } from 'bun:test'
import type { DatosDePersona } from '../src/dominio/modelos'
import { validarPersona } from '../src/dominio/validaciones'

const HOY = new Date(2026, 7, 27)

/** Una persona valida. Cada test la rompe en un solo campo, para que sea obvio
 *  cual es la regla que se esta probando. */
const valida: DatosDePersona = {
  tipoDeDocumento: 'dni',
  numeroDeDocumento: '30111222',
  nombres: 'María Luz',
  apellidos: 'Fernández Ruiz',
  fechaDeNacimiento: '2010-05-01',
}

const campos = (datos: DatosDePersona) =>
  validarPersona(datos, HOY).map((problema) => problema.campo)

describe('validarPersona', () => {
  test('una persona valida no tiene problemas', () => {
    expect(validarPersona(valida, HOY)).toEqual([])
  })

  test('los nombres no pueden estar vacios ni ser solo espacios', () => {
    expect(campos({ ...valida, nombres: '' })).toEqual(['nombres'])
    expect(campos({ ...valida, nombres: '   ' })).toEqual(['nombres'])
  })

  test('los apellidos tampoco', () => {
    expect(campos({ ...valida, apellidos: '' })).toEqual(['apellidos'])
  })

  test('acumula todos los problemas, no corta en el primero', () => {
    // El formulario marca todos los campos que fallan de una: obligar a
    // corregir de a uno y reenviar es la peor version de esto.
    expect(campos({ ...valida, nombres: '', apellidos: '', numeroDeDocumento: '' })).toEqual([
      'nombres',
      'apellidos',
      'numeroDeDocumento',
    ])
  })

  test('un DNI con puntos es valido: se valida ya normalizado', () => {
    // Si se validara el texto crudo, los puntos harian fallar el formato y el
    // usuario veria un error por escribir el DNI como lo escribe todo el mundo.
    expect(validarPersona({ ...valida, numeroDeDocumento: '30.111.222' }, HOY)).toEqual([])
  })

  test('un DNI tiene 7 u 8 digitos', () => {
    expect(validarPersona({ ...valida, numeroDeDocumento: '1234567' }, HOY)).toEqual([])
    expect(campos({ ...valida, numeroDeDocumento: '123456' })).toEqual(['numeroDeDocumento'])
    expect(campos({ ...valida, numeroDeDocumento: '123456789' })).toEqual(['numeroDeDocumento'])
    expect(campos({ ...valida, numeroDeDocumento: 'AB123456' })).toEqual(['numeroDeDocumento'])
  })

  test('un pasaporte es alfanumerico de 5 a 15', () => {
    const pasaporte = { ...valida, tipoDeDocumento: 'pasaporte' } as const
    expect(validarPersona({ ...pasaporte, numeroDeDocumento: 'ab12345' }, HOY)).toEqual([])
    expect(campos({ ...pasaporte, numeroDeDocumento: 'AB12' })).toEqual(['numeroDeDocumento'])
    expect(campos({ ...pasaporte, numeroDeDocumento: 'AB/12345' })).toEqual(['numeroDeDocumento'])
  })

  test('el numero de documento no puede estar vacio', () => {
    expect(campos({ ...valida, numeroDeDocumento: '' })).toEqual(['numeroDeDocumento'])
    expect(campos({ ...valida, numeroDeDocumento: '...' })).toEqual(['numeroDeDocumento'])
  })

  test('la fecha tiene que tener el formato aaaa-mm-dd', () => {
    expect(campos({ ...valida, fechaDeNacimiento: '01/05/2010' })).toEqual(['fechaDeNacimiento'])
    expect(campos({ ...valida, fechaDeNacimiento: '2010-5-1' })).toEqual(['fechaDeNacimiento'])
    expect(campos({ ...valida, fechaDeNacimiento: '' })).toEqual(['fechaDeNacimiento'])
  })

  test('la fecha tiene que existir en el almanaque', () => {
    // Con solo mirar el formato, "2010-02-30" pasaria: tiene cuatro digitos,
    // dos y dos. El 30 de febrero no existe.
    expect(campos({ ...valida, fechaDeNacimiento: '2010-02-30' })).toEqual(['fechaDeNacimiento'])
    expect(campos({ ...valida, fechaDeNacimiento: '2010-13-01' })).toEqual(['fechaDeNacimiento'])
  })

  test('el 29 de febrero de un anio bisiesto si existe', () => {
    expect(validarPersona({ ...valida, fechaDeNacimiento: '2012-02-29' }, HOY)).toEqual([])
    expect(campos({ ...valida, fechaDeNacimiento: '2011-02-29' })).toEqual(['fechaDeNacimiento'])
  })

  test('la fecha de nacimiento no puede ser futura', () => {
    expect(campos({ ...valida, fechaDeNacimiento: '2026-08-28' })).toEqual(['fechaDeNacimiento'])
  })

  test('nacer hoy es valido', () => {
    expect(validarPersona({ ...valida, fechaDeNacimiento: '2026-08-27' }, HOY)).toEqual([])
  })

  test('no se aceptan mas de 120 anios, que es el tope contra el dedazo', () => {
    expect(validarPersona({ ...valida, fechaDeNacimiento: '1906-08-27' }, HOY)).toEqual([])
    expect(campos({ ...valida, fechaDeNacimiento: '1025-08-27' })).toEqual(['fechaDeNacimiento'])
  })
})
