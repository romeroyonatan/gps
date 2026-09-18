import { describe, expect, test } from 'bun:test'
import { grupoEstabaAbiertoEn } from '../src/dominio/vigencia'

describe('grupoEstabaAbiertoEn', () => {
  const cierre = new Date('1970-10-15T12:00:00Z')

  test('incluye todo el dia de cierre', () => {
    expect(grupoEstabaAbiertoEn('1970-10-15', cierre)).toBe(true)
  })

  test('lo excluye desde el dia siguiente', () => {
    expect(grupoEstabaAbiertoEn('1970-10-16', cierre)).toBe(false)
  })

  test('un grupo sin cierre sigue abierto', () => {
    expect(grupoEstabaAbiertoEn('2999-12-31', null)).toBe(true)
  })
})
