import { describe, expect, test } from 'bun:test'
import type { Actor, Alcance } from '@gps/core'
import { puedeDeclararAfiliacion, puedeVerAfiliacionDelGrupo } from '../src/dominio/politicas'

const anonimo: Actor = {
  personaId: 'nadie',
  roles: [],
  esAdministradorDesignado: false,
  estaElevado: false,
}
const elevado: Actor = { ...anonimo, personaId: 'admin', estaElevado: true }

function actorCon(rol: string, tipo: 'grupo' | 'diocesis', id: string | null): Actor {
  return { ...anonimo, personaId: 'x', roles: [{ rol, ambito: { tipo, id } } as never] }
}

describe('puedeDeclararAfiliacion', () => {
  test('declara el grupo, no la diócesis, y sólo el propio', () => {
    expect(puedeDeclararAfiliacion(actorCon('jefeDeGrupo', 'grupo', 'g1'), 'g1')).toBe(true)
    expect(puedeDeclararAfiliacion(actorCon('secretariaDeGrupo', 'grupo', 'g1'), 'g1')).toBe(true)
    expect(puedeDeclararAfiliacion(actorCon('jefeDeGrupo', 'grupo', 'g1'), 'g2')).toBe(false)
    expect(puedeDeclararAfiliacion(actorCon('tesoreriaDiocesana', 'diocesis', null), 'g1')).toBe(
      false,
    )
    expect(puedeDeclararAfiliacion(anonimo, 'g1')).toBe(false)
    expect(puedeDeclararAfiliacion(elevado, 'g1')).toBe(true)
  })
})

describe('puedeVerAfiliacionDelGrupo', () => {
  test('lee quien tenga el grupo en su alcance', () => {
    const alcance: Alcance = {
      actor: anonimo,
      gruposVisibles: ['g1'],
      distritosVisibles: [],
      esAdministrador: false,
    }
    expect(puedeVerAfiliacionDelGrupo(alcance, 'g1')).toBe(true)
    expect(puedeVerAfiliacionDelGrupo(alcance, 'g2')).toBe(false)
  })
})
