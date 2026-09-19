import { describe, expect, test } from 'bun:test'
import type { Actor, Alcance } from '@gps/core'
import {
  puedeAdministrarEquiposDiocesanos,
  puedeAdministrarPlantelDeGrupo,
  puedeVerPersonasDelGrupo,
} from '../src/dominio/politicas'

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

describe('puedeAdministrarPlantelDeGrupo', () => {
  test('jefatura y secretaria administran su propio grupo, no otro', () => {
    expect(puedeAdministrarPlantelDeGrupo(actorCon('jefeDeGrupo', 'grupo', 'g1'), 'g1')).toBe(true)
    expect(puedeAdministrarPlantelDeGrupo(actorCon('secretariaDeGrupo', 'grupo', 'g1'), 'g1')).toBe(
      true,
    )
    expect(puedeAdministrarPlantelDeGrupo(actorCon('jefeDeGrupo', 'grupo', 'g1'), 'g2')).toBe(false)
    expect(puedeAdministrarPlantelDeGrupo(anonimo, 'g1')).toBe(false)
    expect(puedeAdministrarPlantelDeGrupo(elevado, 'g1')).toBe(true)
  })
})

describe('puedeAdministrarEquiposDiocesanos', () => {
  test('sólo las autoridades diocesanas o la elevación global', () => {
    expect(
      puedeAdministrarEquiposDiocesanos(actorCon('jefeScoutDiocesano', 'diocesis', null)),
    ).toBe(true)
    expect(
      puedeAdministrarEquiposDiocesanos(actorCon('administracionDiocesana', 'diocesis', null)),
    ).toBe(true)
    expect(puedeAdministrarEquiposDiocesanos(actorCon('jefeDeGrupo', 'grupo', 'g1'))).toBe(false)
    expect(puedeAdministrarEquiposDiocesanos(elevado)).toBe(true)
  })
})

describe('puedeVerPersonasDelGrupo', () => {
  const alcance = (grupos: string[], esAdministrador = false): Alcance => ({
    actor: anonimo,
    gruposVisibles: grupos,
    distritosVisibles: [],
    esAdministrador,
  })

  test('se lee lo que el alcance ya expandio, y nada mas', () => {
    expect(puedeVerPersonasDelGrupo(alcance(['g1']), 'g1')).toBe(true)
    expect(puedeVerPersonasDelGrupo(alcance(['g1']), 'g2')).toBe(false)
    expect(puedeVerPersonasDelGrupo(alcance([], true), 'g2')).toBe(true)
  })
})
