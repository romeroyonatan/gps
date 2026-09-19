import { describe, expect, test } from 'bun:test'
import type { Context } from '@gps/core'
import { crearContexto, secretoDelPedido } from '../src/context'

const reloj = { ahora: () => new Date('2026-03-01T12:00:00Z') }

function base(sesionValida = true): Context {
  return {
    actor: null,
    alcance: null,
    auth: {
      resolverSesion: async (secreto: string) =>
        sesionValida && secreto === 'valido'
          ? {
              sesionId: 'sesion_1',
              personaId: 'persona_1',
              identidadId: 'identidad_1',
              estaElevada: false,
            }
          : null,
      esAdministradorDesignado: async () => true,
    },
    personas: {
      funcionesVigentes: async () => [
        { rol: 'secretariaDeGrupo', ambito: { tipo: 'grupo', id: 'grupo_1' } },
      ],
    },
    estructura: {
      expandirAlcance: async () => ({
        gruposVisibles: ['grupo_1'],
        distritosVisibles: [],
        esAdministrador: false,
      }),
    },
  } as unknown as Context
}

describe('secretoDelPedido', () => {
  test('acepta bearer mobile y cookie web', () => {
    expect(
      secretoDelPedido(
        new Request('https://gps.test/graphql', { headers: { authorization: 'Bearer movil' } }),
      ),
    ).toBe('movil')
    expect(
      secretoDelPedido(
        new Request('https://gps.test/graphql', { headers: { cookie: 'otra=1; gps_session=web' } }),
      ),
    ).toBe('web')
  })
})

describe('crearContexto', () => {
  test('un request autenticado deriva actor y alcance', async () => {
    const contexto = await crearContexto(
      base(),
      reloj,
    )({
      request: new Request('https://gps.test/graphql', {
        headers: { authorization: 'Bearer valido' },
      }),
    })

    expect(contexto.actor).toEqual({
      personaId: 'persona_1',
      roles: [{ rol: 'secretariaDeGrupo', ambito: { tipo: 'grupo', id: 'grupo_1' } }],
      esAdministradorDesignado: true,
      estaElevado: false,
    })
    expect(contexto.alcance?.gruposVisibles).toEqual(['grupo_1'])
  })

  test('sin sesión o con una revocada queda anónimo', async () => {
    const anonimo = await crearContexto(
      base(),
      reloj,
    )({
      request: new Request('https://gps.test/graphql'),
    })
    const revocado = await crearContexto(
      base(false),
      reloj,
    )({
      request: new Request('https://gps.test/graphql', {
        headers: { authorization: 'Bearer valido' },
      }),
    })
    expect(anonimo.actor).toBeNull()
    expect(revocado.actor).toBeNull()
  })
})
