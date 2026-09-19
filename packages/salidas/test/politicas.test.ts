import { describe, expect, test } from 'bun:test'
import type { Actor, Alcance } from '@gps/core'
import { type FirmanteRequerido, firmantesRequeridos } from '../src/dominio/firmas'
import {
  puedeAdministrarPermisosDelGrupo,
  puedeFirmarEnLaApp,
  puedeVerPermisoDelGrupo,
} from '../src/dominio/politicas'

const anonimo: Actor = {
  personaId: 'nadie',
  roles: [],
  esAdministradorDesignado: false,
  estaElevado: false,
}
const elevado: Actor = { ...anonimo, personaId: 'admin', estaElevado: true }

function actorCon(rol: string, tipo: 'grupo' | 'distrito', id: string): Actor {
  return { ...anonimo, personaId: 'x', roles: [{ rol, ambito: { tipo, id } } as never] }
}

const [jefe, director, comisionado] = firmantesRequeridos('g1', 'd1') as [
  FirmanteRequerido,
  FirmanteRequerido,
  FirmanteRequerido,
]

describe('puedeAdministrarPermisosDelGrupo', () => {
  test('lo administra el grupo que sale, no el director ni el comisionado', () => {
    expect(puedeAdministrarPermisosDelGrupo(actorCon('jefeDeGrupo', 'grupo', 'g1'), 'g1')).toBe(
      true,
    )
    expect(
      puedeAdministrarPermisosDelGrupo(actorCon('secretariaDeGrupo', 'grupo', 'g1'), 'g1'),
    ).toBe(true)
    expect(puedeAdministrarPermisosDelGrupo(actorCon('jefeDeGrupo', 'grupo', 'g1'), 'g2')).toBe(
      false,
    )
    expect(puedeAdministrarPermisosDelGrupo(actorCon('directorDeGrupo', 'grupo', 'g1'), 'g1')).toBe(
      false,
    )
    expect(puedeAdministrarPermisosDelGrupo(elevado, 'g1')).toBe(true)
  })
})

describe('puedeVerPermisoDelGrupo', () => {
  test('el comisionado ve el permiso porque su distrito le expandió el grupo', () => {
    const delDistrito: Alcance = {
      actor: anonimo,
      gruposVisibles: ['g1', 'g2'],
      distritosVisibles: ['d1'],
      esAdministrador: false,
    }
    expect(puedeVerPermisoDelGrupo(delDistrito, 'g1')).toBe(true)
    expect(puedeVerPermisoDelGrupo(delDistrito, 'g3')).toBe(false)
  })
})

describe('puedeFirmarEnLaApp', () => {
  test('firma quien ocupa hoy el cargo, en el ámbito del permiso', () => {
    expect(puedeFirmarEnLaApp(actorCon('jefeDeGrupo', 'grupo', 'g1'), jefe)).toBe(true)
    expect(puedeFirmarEnLaApp(actorCon('directorDeGrupo', 'grupo', 'g1'), director)).toBe(true)
    expect(
      puedeFirmarEnLaApp(actorCon('comisionadoDeDistrito', 'distrito', 'd1'), comisionado),
    ).toBe(true)
  })

  test('no se firma por un cargo ajeno ni por el mismo cargo de otro ámbito', () => {
    expect(puedeFirmarEnLaApp(actorCon('jefeDeGrupo', 'grupo', 'g1'), director)).toBe(false)
    expect(puedeFirmarEnLaApp(actorCon('jefeDeGrupo', 'grupo', 'g2'), jefe)).toBe(false)
    expect(
      puedeFirmarEnLaApp(actorCon('comisionadoDeDistrito', 'distrito', 'd2'), comisionado),
    ).toBe(false)
  })

  test('la elevación no firma por nadie: falsificaría una firma', () => {
    expect(puedeFirmarEnLaApp(elevado, jefe)).toBe(false)
  })
})
