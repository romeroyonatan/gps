import { describe, expect, test } from 'bun:test'
import type { Actor } from '@gps/core'
import {
  puedeAdministrarEquiposDiocesanos,
  puedeAdministrarPlantelDeGrupo,
  puedeConfigurarCuotas,
  puedeLeerCuentaDeGrupo,
  puedeRegistrarPagos,
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

describe('puedeLeerCuentaDeGrupo', () => {
  test('jefatura y secretaria leen su grupo; las autoridades diocesanas leen cualquiera', () => {
    expect(puedeLeerCuentaDeGrupo(actorCon('jefeDeGrupo', 'grupo', 'g1'), 'g1')).toBe(true)
    expect(puedeLeerCuentaDeGrupo(actorCon('jefeDeGrupo', 'grupo', 'g1'), 'g2')).toBe(false)
    expect(puedeLeerCuentaDeGrupo(actorCon('tesoreriaDiocesana', 'diocesis', null), 'g1')).toBe(
      true,
    )
    expect(puedeLeerCuentaDeGrupo(actorCon('tesoreriaDiocesana', 'diocesis', null), 'g2')).toBe(
      true,
    )
    expect(puedeLeerCuentaDeGrupo(anonimo, 'g1')).toBe(false)
  })
})

describe('puedeRegistrarPagos', () => {
  test('sólo Tesorería diocesana o la elevación global registran pagos', () => {
    expect(puedeRegistrarPagos(actorCon('tesoreriaDiocesana', 'diocesis', null))).toBe(true)
    expect(puedeRegistrarPagos(actorCon('jefeDeGrupo', 'grupo', 'g1'))).toBe(false)
    expect(puedeRegistrarPagos(actorCon('administracionDiocesana', 'diocesis', null))).toBe(false)
    expect(puedeRegistrarPagos(elevado)).toBe(true)
  })
})

describe('puedeConfigurarCuotas', () => {
  test('Tesorería y las autoridades diocesanas configuran cuotas', () => {
    expect(puedeConfigurarCuotas(actorCon('tesoreriaDiocesana', 'diocesis', null))).toBe(true)
    expect(puedeConfigurarCuotas(actorCon('jefeScoutDiocesano', 'diocesis', null))).toBe(true)
    expect(puedeConfigurarCuotas(actorCon('jefeDeGrupo', 'grupo', 'g1'))).toBe(false)
  })
})
