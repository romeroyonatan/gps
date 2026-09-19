import { describe, expect, test } from 'bun:test'
import type { Actor } from '@gps/core'
import {
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
