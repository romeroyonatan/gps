import { describe, expect, test } from 'bun:test'
import type { Context } from '@gps/core'
import { parse } from 'graphql'
import { crearInterceptorDeEscriturasElevadas } from '../src/auditoria'

function contextoCon(actor: Context['actor']): {
  auditadas: { personaId: string; operacion: string }[]
  contexto: Context
} {
  const auditadas: { personaId: string; operacion: string }[] = []
  const contexto = {
    actor,
    alcance: null,
    auth: {
      auditarEscrituraElevada: (personaId: string, operacion: string) => {
        auditadas.push({ personaId, operacion })
      },
    },
  } as unknown as Context
  return { auditadas, contexto }
}

const elevado: Context['actor'] = {
  personaId: 'admin',
  roles: [],
  esAdministradorDesignado: true,
  estaElevado: true,
}
const ordinario: Context['actor'] = {
  personaId: 'jefe',
  roles: [],
  esAdministradorDesignado: false,
  estaElevado: false,
}

describe('crearInterceptorDeEscriturasElevadas', () => {
  test('audita una mutation ejecutada con sudo', () => {
    const { auditadas, contexto } = contextoCon(elevado)
    const plugin = crearInterceptorDeEscriturasElevadas()
    plugin.onExecute?.({
      args: {
        contextValue: contexto,
        document: parse('mutation CerrarGrupo { crearPersona }'),
        operationName: 'CerrarGrupo',
      },
    } as Parameters<NonNullable<typeof plugin.onExecute>>[0])

    expect(auditadas).toEqual([{ personaId: 'admin', operacion: 'CerrarGrupo' }])
  })

  test('no audita una mutation ordinaria ni una query elevada', () => {
    const plugin = crearInterceptorDeEscriturasElevadas()

    const ordinaria = contextoCon(ordinario)
    plugin.onExecute?.({
      args: {
        contextValue: ordinaria.contexto,
        document: parse('mutation Algo { crearPersona }'),
        operationName: 'Algo',
      },
    } as Parameters<NonNullable<typeof plugin.onExecute>>[0])
    expect(ordinaria.auditadas).toEqual([])

    const query = contextoCon(elevado)
    plugin.onExecute?.({
      args: {
        contextValue: query.contexto,
        document: parse('query Version { version { numero } }'),
        operationName: 'Version',
      },
    } as Parameters<NonNullable<typeof plugin.onExecute>>[0])
    expect(query.auditadas).toEqual([])
  })

  test('un pedido anónimo -sin actor- no rompe ni audita', () => {
    const { auditadas, contexto } = contextoCon(null)
    const plugin = crearInterceptorDeEscriturasElevadas()
    plugin.onExecute?.({
      args: {
        contextValue: contexto,
        document: parse('mutation Algo { crearPersona }'),
        operationName: 'Algo',
      },
    } as Parameters<NonNullable<typeof plugin.onExecute>>[0])
    expect(auditadas).toEqual([])
  })
})
