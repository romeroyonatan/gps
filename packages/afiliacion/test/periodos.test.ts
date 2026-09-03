import { describe, expect, test } from 'bun:test'
import { fechasOrdinariasDelPeriodo, periodoDe } from '../src/dominio/periodos'

describe('periodoDe', () => {
  test('una fecha despues del corte cae en el periodo que arranca ese anio', () => {
    expect(periodoDe('2026-05-01')).toBe(2026)
    expect(periodoDe('2026-11-01')).toBe(2026)
  })

  test('el dia del corte ya es del periodo nuevo', () => {
    expect(periodoDe('2026-03-01')).toBe(2026)
  })

  test('el dia anterior al corte todavia es del periodo viejo', () => {
    expect(periodoDe('2026-02-28')).toBe(2025)
  })

  test('el campamento de enero cae en el periodo del anio anterior', () => {
    // Es el caso que motiva que el periodo no sea el anio del almanaque: quien
    // se afilio en noviembre de 2026 tiene que llegar cubierto a este dia.
    expect(periodoDe('2027-01-15')).toBe(2026)
  })
})

describe('fechasOrdinariasDelPeriodo', () => {
  test('resuelve cada mes-dia contra el anio que le toca', () => {
    expect(fechasOrdinariasDelPeriodo(2026)).toEqual(['2026-05-01', '2026-11-01'])
  })

  test('cada fecha ordinaria cae en el periodo que la genero', () => {
    // La propiedad que de verdad importa, y que sigue valiendo si alguien
    // cambia FECHAS_ORDINARIAS o INICIO_DEL_PERIODO: si esto se rompe, el
    // barrido declararia fechas de otro periodo.
    for (const fecha of fechasOrdinariasDelPeriodo(2026)) {
      expect(periodoDe(fecha)).toBe(2026)
    }
  })

  test('las devuelve en orden cronologico', () => {
    const fechas = fechasOrdinariasDelPeriodo(2026)
    expect([...fechas].sort()).toEqual([...fechas])
  })
})
