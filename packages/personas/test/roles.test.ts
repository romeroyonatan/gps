import { describe, expect, test } from 'bun:test'
import type { Actor, RolConAmbito } from '@gps/core'
import { nombreDelRol, rolesParaElegir } from '../src/dominio/roles'

const actorCon = (...roles: RolConAmbito[]): Actor => ({
  personaId: 'x',
  roles,
  esAdministradorDesignado: false,
  estaElevado: false,
})

const enGrupo = (rol: RolConAmbito['rol'], id: string): RolConAmbito => ({
  rol,
  ambito: { tipo: 'grupo', id },
})
const enDiocesis = (rol: RolConAmbito['rol']): RolConAmbito => ({
  rol,
  ambito: { tipo: 'diocesis', id: null },
})

describe('rolesParaElegir', () => {
  test('la jefatura absorbe al dirigente del mismo grupo', () => {
    const roles = rolesParaElegir(
      actorCon(enGrupo('dirigente', 'g1'), enGrupo('jefeDeGrupo', 'g1')),
    )
    expect(roles.map((funcion) => funcion.rol)).toEqual(['jefeDeGrupo'])
  })

  test('el dirigente de otro grupo sobrevive', () => {
    const roles = rolesParaElegir(
      actorCon(enGrupo('dirigente', 'g1'), enGrupo('jefeDeGrupo', 'g2')),
    )
    expect(roles).toHaveLength(2)
  })

  test('dos funciones diocesanas distintas conviven: son dos trabajos', () => {
    const roles = rolesParaElegir(
      actorCon(enDiocesis('tesoreriaDiocesana'), enDiocesis('administracionDiocesana')),
    )
    expect(roles).toHaveLength(2)
  })

  test('la comisionada es dirigente de su grupo y comisionada de su distrito', () => {
    const roles = rolesParaElegir(
      actorCon(enGrupo('dirigente', 'g1'), {
        rol: 'comisionadoDeDistrito',
        ambito: { tipo: 'distrito', id: 'd1' },
      }),
    )
    expect(roles.map((funcion) => funcion.rol)).toEqual(['dirigente', 'comisionadoDeDistrito'])
  })

  test('una sola función no ofrece nada que elegir', () => {
    expect(rolesParaElegir(actorCon(enGrupo('dirigente', 'g1')))).toHaveLength(1)
  })

  test('el mismo rol por cargo y por equipo no se ofrece dos veces', () => {
    const roles = rolesParaElegir(
      actorCon(enGrupo('secretariaDeGrupo', 'g1'), enGrupo('secretariaDeGrupo', 'g1')),
    )
    expect(roles).toHaveLength(1)
  })
})

test('cada rol tiene nombre en español', () => {
  expect(nombreDelRol('tesoreriaDiocesana')).toBe('Tesorería diocesana')
})
