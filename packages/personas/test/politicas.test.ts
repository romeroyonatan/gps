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
  const alcance = (quien: Actor, grupos: string[], esAdministrador = false): Alcance => ({
    actor: quien,
    gruposVisibles: grupos,
    distritosVisibles: [],
    esAdministrador,
  })

  test('la gente de un grupo la ven su jefatura y su Secretaría, y nadie más', () => {
    const jefe = actorCon('jefeDeGrupo', 'grupo', 'g1')
    const secretaria = actorCon('secretariaDeGrupo', 'grupo', 'g1')
    expect(puedeVerPersonasDelGrupo(alcance(jefe, ['g1']), 'g1')).toBe(true)
    expect(puedeVerPersonasDelGrupo(alcance(secretaria, ['g1']), 'g1')).toBe(true)
    expect(puedeVerPersonasDelGrupo(alcance(jefe, ['g1']), 'g2')).toBe(false)
  })

  test('el comisionado alcanza el grupo pero no ve a su gente', () => {
    // Su distrito se expande a los grupos porque necesita leer los permisos de
    // salida que firma. La nómina de una salida la resuelve `salidas` con sus
    // propias tablas; el padrón del grupo no es lo mismo.
    const comisionado = {
      ...anonimo,
      personaId: 'x',
      roles: [{ rol: 'comisionadoDeDistrito', ambito: { tipo: 'distrito', id: 'd1' } } as never],
    }
    const suyos = alcance(comisionado, ['g1', 'g2'])
    expect(suyos.gruposVisibles).toContain('g1')
    expect(puedeVerPersonasDelGrupo(suyos, 'g1')).toBe(false)
  })

  test('una autoridad diocesana tampoco; la elevación sí', () => {
    const diocesana = actorCon('administracionDiocesana', 'diocesis', null)
    expect(puedeVerPersonasDelGrupo(alcance(diocesana, ['g1']), 'g1')).toBe(false)
    expect(puedeVerPersonasDelGrupo(alcance(elevado, [], true), 'g1')).toBe(true)
  })

  test('un dirigente sin cargo no ve el padrón de su propio grupo', () => {
    const dirigente = actorCon('dirigente', 'grupo', 'g1')
    expect(puedeVerPersonasDelGrupo(alcance(dirigente, ['g1']), 'g1')).toBe(false)
  })
})
