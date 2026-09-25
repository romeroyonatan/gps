import { describe, expect, test } from 'bun:test'
import type { Actor } from '@gps/core'
import { gruposAuditables, puedeAuditarGrupo } from '../src/dominio'

const jefe: Actor = {
  personaId: 'jefe',
  esAdministradorDesignado: false,
  estaElevado: false,
  roles: [{ rol: 'jefeDeGrupo', ambito: { tipo: 'grupo', id: 'grupo-1' } }],
}

describe('políticas de auditoría', () => {
  test('jefatura y secretaría sólo auditan sus grupos', () => {
    expect(gruposAuditables(jefe)).toEqual(['grupo-1'])
    expect(puedeAuditarGrupo(jefe, 'grupo-1')).toBe(true)
    expect(puedeAuditarGrupo(jefe, 'grupo-2')).toBe(false)
  })

  test('secretaría tiene la misma frontera del grupo', () => {
    const secretaria: Actor = {
      ...jefe,
      roles: [{ rol: 'secretariaDeGrupo', ambito: { tipo: 'grupo', id: 'grupo-2' } }],
    }
    expect(gruposAuditables(secretaria)).toEqual(['grupo-2'])
  })

  test('sólo la elevación concede alcance global', () => {
    expect(gruposAuditables({ ...jefe, roles: [], esAdministradorDesignado: true })).toEqual([])
    expect(gruposAuditables({ ...jefe, estaElevado: true })).toBeNull()
  })
})
