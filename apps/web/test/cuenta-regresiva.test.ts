import { describe, expect, test } from 'bun:test'
import { cuantoFalta } from '../src/pantallas/cuenta-regresiva'

const AHORA = new Date('2026-05-01T12:00:00Z').getTime()
const enSegundos = (segundos: number) => new Date(AHORA + segundos * 1000).toISOString()

describe('cuantoFalta', () => {
  test('cuenta en mm:ss, con los segundos a dos dígitos', () => {
    expect(cuantoFalta(enSegundos(600), AHORA)).toBe('10:00')
    expect(cuantoFalta(enSegundos(65), AHORA)).toBe('1:05')
    expect(cuantoFalta(enSegundos(9), AHORA)).toBe('0:09')
  })

  test('vencida es null, que es lo que hace desaparecer las acciones globales', () => {
    expect(cuantoFalta(enSegundos(0), AHORA)).toBeNull()
    expect(cuantoFalta(enSegundos(-1), AHORA)).toBeNull()
  })
})
