import { describe, expect, test } from 'bun:test'
import { urlDeIngreso } from '../src/enlaces'

describe('urlDeIngreso', () => {
  test('dice la plataforma, así la sesión vuelve por deep link y no en cookie', () => {
    expect(urlDeIngreso('http://gps.test', 'google', 'ios')).toBe(
      'http://gps.test/auth/google/iniciar?plataforma=ios',
    )
    expect(urlDeIngreso('http://gps.test', 'apple', 'android')).toContain('plataforma=android')
  })

  test('el perfil sólo va para demo, y escapado', () => {
    expect(urlDeIngreso('http://gps.test', 'demo', 'ios', 'tesoreria')).toBe(
      'http://gps.test/auth/demo/iniciar?plataforma=ios&perfil=tesoreria',
    )
    expect(urlDeIngreso('http://gps.test', 'demo', 'ios', 'a b&c')).toContain('perfil=a%20b%26c')
  })
})
