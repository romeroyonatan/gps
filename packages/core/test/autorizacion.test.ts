import { describe, expect, test } from 'bun:test'
import { graphql } from 'graphql'
import type { Actor } from '../src/actor'
import { CampoSinModulo, componerEsquema, permiteElModulo } from '../src/autorizacion'
import { crearBuilder } from '../src/builder'
import type { Context } from '../src/context'
import type { Module } from '../src/module'

function actorCon(rol: Actor['roles'][number]['rol'], estaElevado = false): Actor {
  return {
    personaId: 'persona_1',
    roles: [{ rol, ambito: { tipo: 'grupo', id: 'grupo_1' } }],
    esAdministradorDesignado: false,
    estaElevado,
  }
}

// biome-ignore lint/suspicious/noExplicitAny: los modulos de prueba no tienen servicios
function moduloDePrueba(nombre: string, registrar: Module<any, any>['registerSchema']) {
  return {
    name: nombre,
    accesoAlModulo: { porDefecto: 'denegado', permitidos: ['jefeDeGrupo'] },
    dependencies: [],
    createServices: () => ({}),
    registerSchema: registrar,
    // biome-ignore lint/suspicious/noExplicitAny: idem
  } as Module<any, any>
}

function esquemaDePrueba() {
  const builder = crearBuilder()
  const secreto = moduloDePrueba('tesoreria', (b) => {
    b.queryField('saldo', (t) => t.int({ resolve: () => 42 }))
    b.mutationField('registrarPago', (t) => t.boolean({ resolve: () => true }))
  })
  return componerEsquema(builder, [secreto])
}

function contexto(actor: Actor | null): Context {
  return { actor, alcance: null } as Context
}

describe('acceso al modulo', () => {
  test('un anonimo recibe NO_AUTENTICADO y no llega al resolver', async () => {
    const resultado = await graphql({
      schema: esquemaDePrueba(),
      source: '{ saldo }',
      contextValue: contexto(null),
    })
    expect(resultado.data).toBeNull()
    expect(resultado.errors?.[0]?.extensions?.code).toBe('NO_AUTENTICADO')
  })

  test('una funcion no permitida recibe SIN_PERMISO con el nombre del modulo', async () => {
    const resultado = await graphql({
      schema: esquemaDePrueba(),
      source: 'mutation { registrarPago }',
      contextValue: contexto(actorCon('dirigente')),
    })
    expect(resultado.errors?.[0]?.extensions?.code).toBe('SIN_PERMISO')
    expect(resultado.errors?.[0]?.message).toContain('tesoreria')
  })

  test('una funcion permitida atraviesa el control', async () => {
    const resultado = await graphql({
      schema: esquemaDePrueba(),
      source: '{ saldo }',
      contextValue: contexto(actorCon('jefeDeGrupo')),
    })
    expect(resultado.errors).toBeUndefined()
    expect(resultado.data?.saldo).toBe(42)
  })

  test('un campo raiz que no registro ningun modulo aborta la composicion', () => {
    const builder = crearBuilder()
    // Un campo colado fuera de registerSchema -o registrado con un builder que
    // no paso por componerEsquema- no tiene modulo dueño, asi que no tiene
    // politica: el esquema no se compone.
    builder.queryField('colado', (t) => t.int({ resolve: () => 1 }))
    const modulo = moduloDePrueba('sistema', (b) => {
      b.queryField('version', (t) => t.string({ resolve: () => '0' }))
    })
    expect(() => componerEsquema(builder, [modulo])).toThrow(CampoSinModulo)
  })
})

describe('permiteElModulo', () => {
  test('un modulo publico no exige sesion', () => {
    expect(permiteElModulo({ porDefecto: 'publico', permitidos: [] }, null)).toBe(true)
  })

  test('la elevacion alcanza cualquier modulo', () => {
    const acceso = { porDefecto: 'denegado', permitidos: ['jefeDeGrupo'] } as const
    expect(permiteElModulo(acceso, actorCon('dirigente', true))).toBe(true)
  })
})
