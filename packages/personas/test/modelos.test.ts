import { describe, expect, test } from 'bun:test'
import { calcularEdad, nombreCompleto } from '../src/dominio/modelos'

// Las fechas se construyen con componentes locales y no con una cadena ISO para
// que el resultado no dependa de la zona horaria de quien corre los tests: una
// fecha de nacimiento es una fecha de calendario, no un instante. El mes va
// 0-indexado, asi que 7 es agosto.
const HOY = new Date(2026, 7, 27)

describe('nombreCompleto', () => {
  test('los apellidos primero, que es como se lista', () => {
    expect(nombreCompleto({ nombres: 'María Luz', apellidos: 'Fernández Ruiz' })).toBe(
      'Fernández Ruiz, María Luz',
    )
  })
})

describe('calcularEdad', () => {
  test('cuenta los anios cumplidos', () => {
    expect(calcularEdad('2010-05-01', HOY)).toBe(16)
  })

  test('si todavia no cumplio este anio, resta uno', () => {
    expect(calcularEdad('2010-12-01', HOY)).toBe(15)
  })

  test('el dia del cumpleanios ya cuenta', () => {
    expect(calcularEdad('2010-08-27', HOY)).toBe(16)
  })

  test('la vispera todavia no', () => {
    expect(calcularEdad('2010-08-28', HOY)).toBe(15)
  })

  test('quien nacio hoy tiene cero, no uno', () => {
    expect(calcularEdad('2026-08-27', HOY)).toBe(0)
  })

  test('una fecha futura da negativo, que es de lo que se agarra la validacion', () => {
    expect(calcularEdad('2026-08-28', HOY)).toBe(-1)
    expect(calcularEdad('2027-01-01', HOY)).toBe(-1)
  })
})
