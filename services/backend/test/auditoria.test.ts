import { describe, expect, test } from 'bun:test'
import type { Context } from '@gps/core'
import { GraphQLError, parse } from 'graphql'
import { crearInterceptorDeIntentosElevados } from '../src/auditoria'

function contextoCon(intencionElevada: boolean): {
  rechazadas: { personaId: string; operacion: string }[]
  contexto: Context
} {
  const rechazadas: { personaId: string; operacion: string }[] = []
  const contexto = {
    actor: {
      personaId: 'admin',
      roles: [],
      esAdministradorDesignado: true,
      estaElevado: false,
    },
    alcance: null,
    intencionElevada,
    auth: {
      auditarIntentoElevadoRechazado: (personaId: string, operacion: string) => {
        rechazadas.push({ personaId, operacion })
      },
    },
  } as unknown as Context
  return { rechazadas, contexto }
}

function ejecutar(contexto: Context, error?: GraphQLError) {
  const plugin = crearInterceptorDeIntentosElevados()
  const continuacion = plugin.onExecute?.({
    args: {
      contextValue: contexto,
      document: parse('mutation CerrarGrupo { crearPersona }'),
      operationName: 'CerrarGrupo',
    },
  } as Parameters<NonNullable<typeof plugin.onExecute>>[0]) as
    | { onExecuteDone?: (payload: { result: { errors?: readonly GraphQLError[] } }) => void }
    | undefined
  continuacion?.onExecuteDone?.({ result: { errors: error ? [error] : undefined } })
}

describe('crearInterceptorDeIntentosElevados', () => {
  test('audita una mutation marcada que sudo ya no autoriza', () => {
    const { rechazadas, contexto } = contextoCon(true)
    ejecutar(
      contexto,
      new GraphQLError('No tenés permiso.', { extensions: { code: 'SIN_PERMISO' } }),
    )
    expect(rechazadas).toEqual([{ personaId: 'admin', operacion: 'crearPersona' }])
    expect(contexto.actor?.estaElevado).toBe(false)
  })

  test('no audita una mutation exitosa ni un error sin intención elevada', () => {
    const marcada = contextoCon(true)
    ejecutar(marcada.contexto)
    expect(marcada.rechazadas).toEqual([])

    const ordinaria = contextoCon(false)
    ejecutar(
      ordinaria.contexto,
      new GraphQLError('No tenés permiso.', { extensions: { code: 'SIN_PERMISO' } }),
    )
    expect(ordinaria.rechazadas).toEqual([])
  })
})
