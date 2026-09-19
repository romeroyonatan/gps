import { describe, expect, test } from 'bun:test'
import type { Actor, Alcance } from '@gps/core'
import { puedeAdministrarLaEstructura, puedeVerDistrito } from '../src/dominio/politicas'

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

function alcance(grupos: string[], distritos: string[], esAdministrador = false): Alcance {
  return { actor: anonimo, gruposVisibles: grupos, distritosVisibles: distritos, esAdministrador }
}

describe('puedeAdministrarLaEstructura', () => {
  test('es diocesano: un jefe de grupo no crea grupos ni distritos', () => {
    expect(puedeAdministrarLaEstructura(actorCon('jefeScoutDiocesano', 'diocesis', null))).toBe(
      true,
    )
    expect(
      puedeAdministrarLaEstructura(actorCon('administracionDiocesana', 'diocesis', null)),
    ).toBe(true)
    expect(puedeAdministrarLaEstructura(actorCon('jefeDeGrupo', 'grupo', 'g1'))).toBe(false)
    expect(puedeAdministrarLaEstructura(anonimo)).toBe(false)
    expect(puedeAdministrarLaEstructura(elevado)).toBe(true)
  })
})

describe('lectura por alcance', () => {
  test('sólo se ve el distrito que estructura expandió, salvo elevación', () => {
    expect(puedeVerDistrito(alcance([], ['d1']), 'd1')).toBe(true)
    expect(puedeVerDistrito(alcance([], ['d1']), 'd2')).toBe(false)
    expect(puedeVerDistrito(alcance([], [], true), 'd9')).toBe(true)
  })
})
