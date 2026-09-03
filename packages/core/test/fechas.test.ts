import { describe, expect, test } from 'bun:test'
import { aFechaDeCalendario } from '../src/fechas'

describe('aFechaDeCalendario', () => {
  test('usa el almanaque local y no el UTC', () => {
    // En UTC-3, el 1 de mayo a las 22:30 seria el 2 de mayo en UTC. La fecha
    // que importa es la del que la mira.
    expect(aFechaDeCalendario(new Date(2026, 4, 1, 22, 30))).toBe('2026-05-01')
  })

  test('rellena mes y dia con cero', () => {
    expect(aFechaDeCalendario(new Date(2026, 0, 9))).toBe('2026-01-09')
  })
})
