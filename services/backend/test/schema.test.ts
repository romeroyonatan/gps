import { describe, expect, test } from 'bun:test'
import type { Config } from '@gps/core'
import { execute, parse } from 'graphql'
import { crearBd } from '../src/bd'
import { componer } from '../src/composicion'

const config: Config = { version: '1.2.3', entorno: 'prueba', puerto: 0 }

async function consultar(consulta: string) {
  const { esquema, contexto } = await componer(config, crearBd(':memory:'))
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
    expect(resultado.data).toEqual({
      version: { modulos: ['sistema', 'estructura', 'personas'] },
    })
  })

  test('el contexto expone actor en null: auth todavia no existe', async () => {
    const { contexto } = await componer(config, crearBd(':memory:'))
    expect(contexto.actor).toBeNull()
  })

  test('expone el arbol de la diocesis, vacio si no hay datos', async () => {
    const resultado = await consultar('{ distritos { id numero zona grupos { id numero ramas } } }')
    expect(resultado.errors).toBeUndefined()
    expect(resultado.data).toEqual({ distritos: [] })
  })

  test('el enum Rama publica los seis ids del catalogo', async () => {
    const resultado = await consultar('{ __type(name: "Rama") { enumValues { name } } }')
    const tipo = resultado.data?.__type as { enumValues: { name: string }[] }
    const valores = tipo.enumValues.map((valor) => valor.name)
    expect(valores).toEqual(['adultos', 'castores', 'lobatos', 'raiders', 'rovers', 'scouts'])
  })
})
