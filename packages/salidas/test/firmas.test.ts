import { describe, expect, test } from 'bun:test'
import { firmantesRequeridos, mensajeASellar } from '../src/dominio/firmas'
import type { Trazos } from '../src/dominio/trazos'

const trazos: Trazos = { trazos: [[[0.1, 0.2] as const, [0.3, 0.4] as const]] }

const datos = {
  hashDelPdf: 'abc123',
  cargo: 'jefeDeGrupo' as const,
  personaId: 'persona_1',
  fecha: '2026-10-01',
  trazos,
}

describe('firmantesRequeridos', () => {
  test('son tres: jefe de grupo, director y comisionado', () => {
    expect(firmantesRequeridos('grupo_1', 'distrito_1').map((uno) => uno.cargo)).toEqual([
      'jefeDeGrupo',
      'director',
      'comisionadoDeDistrito',
    ])
  })

  test('los dos del grupo apuntan al grupo y el comisionado al distrito', () => {
    // Es lo que decide donde se busca a cada persona: el comisionado no esta
    // en el grupo, esta en el distrito al que el grupo pertenece.
    expect(firmantesRequeridos('grupo_1', 'distrito_1')).toEqual([
      { cargo: 'jefeDeGrupo', ambito: 'grupo', ambitoId: 'grupo_1' },
      { cargo: 'director', ambito: 'grupo', ambitoId: 'grupo_1' },
      { cargo: 'comisionadoDeDistrito', ambito: 'distrito', ambitoId: 'distrito_1' },
    ])
  })
})

describe('mensajeASellar', () => {
  test('el mismo dato da el mismo mensaje', () => {
    // Si no fuera estable, una firma legitima dejaria de verificar.
    expect(mensajeASellar(datos)).toBe(mensajeASellar({ ...datos }))
  })

  test('cambiar el PDF cambia el mensaje', () => {
    // Es lo que ata la firma a ese documento y no a otro.
    expect(mensajeASellar({ ...datos, hashDelPdf: 'otro' })).not.toBe(mensajeASellar(datos))
  })

  test('cambiar el cargo o la persona tambien', () => {
    // Sin esto, dos firmas del mismo permiso serian intercambiables.
    expect(mensajeASellar({ ...datos, cargo: 'director' })).not.toBe(mensajeASellar(datos))
    expect(mensajeASellar({ ...datos, personaId: 'persona_2' })).not.toBe(mensajeASellar(datos))
  })

  test('cambiar la fecha o los trazos tambien', () => {
    expect(mensajeASellar({ ...datos, fecha: '2026-10-02' })).not.toBe(mensajeASellar(datos))
    expect(mensajeASellar({ ...datos, trazos: { trazos: [[[0.9, 0.9] as const]] } })).not.toBe(
      mensajeASellar(datos),
    )
  })

  test('los trazos van al final: son lo unico que puede tener el separador', () => {
    // Asi dos entradas distintas no pueden producir la misma cadena.
    expect(mensajeASellar(datos).indexOf('[[')).toBeGreaterThan(
      mensajeASellar(datos).lastIndexOf('|') - 1,
    )
  })
})
