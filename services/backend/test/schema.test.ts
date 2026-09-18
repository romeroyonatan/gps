import { describe, expect, test } from 'bun:test'
import type { Config } from '@gps/core'
import { execute, parse } from 'graphql'
import { crearAlmacenamientoEnMemoria } from '../src/almacenamiento'
import { crearBd } from '../src/bd'
import { crearConversorDeImagenes } from '../src/conversor'
import { crearSellador } from '../src/sellador'

const sellador = crearSellador({ prueba: 'una-clave' }, 'prueba')

import { componer } from '../src/composicion'

const config: Config = { version: '1.2.3', entorno: 'prueba', puerto: 0 }

async function consultar(consulta: string) {
  const { esquema, contexto } = await componer(
    config,
    crearBd(':memory:'),
    sellador,
    crearAlmacenamientoEnMemoria(),
    crearConversorDeImagenes(),
  )
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
      version: {
        modulos: ['sistema', 'estructura', 'personas', 'afiliacion', 'archivos', 'salidas'],
      },
    })
  })

  test('el contexto expone actor en null: auth todavia no existe', async () => {
    const { contexto } = await componer(
      config,
      crearBd(':memory:'),
      sellador,
      crearAlmacenamientoEnMemoria(),
      crearConversorDeImagenes(),
    )
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

describe('afiliacion en el esquema compuesto', () => {
  test('la query declaraciones existe y responde vacia sin datos', async () => {
    const resultado = await consultar('{ declaraciones(grupoId: "grupo_1") { fecha periodo } }')
    expect(resultado.errors).toBeUndefined()
    expect(resultado.data).toEqual({ declaraciones: [] })
  })

  test('afiliadosEn responde vacio sin declaraciones', async () => {
    const resultado = await consultar('{ afiliadosEn(periodo: 2026, personaIds: ["persona_1"]) }')
    expect(resultado.errors).toBeUndefined()
    expect(resultado.data).toEqual({ afiliadosEn: [] })
  })

  test('TipoDeDocumento lo declaran dos modulos y el esquema compone igual', async () => {
    // Si personas y afiliacion lo declararan con builder.enumType, componer
    // tiraria. enumCompartido es lo que lo permite; este test es el que se
    // rompe si alguno de los dos se sale del helper o cambia la descripcion.
    const resultado = await consultar('{ __type(name: "TipoDeDocumento") { name } }')
    expect(resultado.errors).toBeUndefined()
  })
})
