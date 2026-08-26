import { describe, expect, test } from 'bun:test'
import type { Config } from '@gps/core'
import { execute, parse } from 'graphql'
import { componer } from '../src/composicion'

const config: Config = { version: '1.2.3', entorno: 'prueba', puerto: 0 }

async function consultar(consulta: string) {
  const { esquema, contexto } = componer(config)
  return execute({
    schema: esquema,
    document: parse(consulta),
    contextValue: contexto,
  })
}

describe('esquema compuesto', () => {
  test('responde la version con los datos de la configuracion', async () => {
    const resultado = await consultar('{ version { numero entorno } }')
    expect(resultado.errors).toBeUndefined()
    expect(resultado.data).toEqual({
      version: { numero: '1.2.3', entorno: 'prueba' },
    })
  })

  test('lista los modulos efectivamente registrados', async () => {
    const resultado = await consultar('{ version { modulos } }')
    expect(resultado.data).toEqual({ version: { modulos: ['sistema'] } })
  })

  test('el contexto expone actor en null: auth todavia no existe', () => {
    const { contexto } = componer(config)
    expect(contexto.actor).toBeNull()
  })
})
