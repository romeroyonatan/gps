import { describe, expect, test } from 'bun:test'
import { alcanceSinLimites, type Config } from '@gps/core'
import { execute, parse } from 'graphql'
import { crearAlmacenamientoEnMemoria } from '../src/almacenamiento'
import { crearBd } from '../src/bd'
import { crearConversorDeImagenes } from '../src/conversor'
import { crearSellador } from '../src/sellador'

const sellador = crearSellador({ prueba: 'una-clave' }, 'prueba')

import { componer } from '../src/composicion'

const config: Config = { version: '1.2.3', entorno: 'prueba', puerto: 0, auth: null }

/** Estos tests verifican la forma del esquema compuesto, no la autorizacion:
 *  cada modulo prueba su matriz de permisos por separado. Un actor elevado
 *  atraviesa la capa 1 sin tener que sembrar cargos para cada consulta. */
const sinLimites = alcanceSinLimites('persona_prueba')
const elevado = sinLimites.actor

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
    contextValue: { ...contexto, actor: elevado, alcance: sinLimites },
  })
}

describe('esquema compuesto', () => {
  test('los casos internos no estan publicados', async () => {
    // El barrido de afiliacion y el suscriptor de tesoreria corren sin usuario
    // y por eso no pasan por el alcance. Que no haya forma de dispararlos desde
    // GraphQL es lo que sostiene esa excepcion.
    const { esquema } = await componer(
      config,
      crearBd(':memory:'),
      sellador,
      crearAlmacenamientoEnMemoria(),
      crearConversorDeImagenes(),
    )
    const raices = [
      ...Object.keys(esquema.getQueryType()?.getFields() ?? {}),
      ...Object.keys(esquema.getMutationType()?.getFields() ?? {}),
    ]
    expect(raices).not.toContain('declararPendientes')
    expect(raices).not.toContain('generarCargo')
  })

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
        modulos: [
          'sistema',
          'estructura',
          'personas',
          'auth',
          'afiliacion',
          'tesoreria',
          'archivos',
          'salidas',
        ],
      },
    })
  })

  test('el contexto base es anónimo y sin alcance', async () => {
    const { contexto } = await componer(
      config,
      crearBd(':memory:'),
      sellador,
      crearAlmacenamientoEnMemoria(),
      crearConversorDeImagenes(),
    )
    expect(contexto.actor).toBeNull()
    expect(contexto.alcance).toBeNull()
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

describe('tesoreria en el esquema compuesto', () => {
  test('expone cuentas y pendientes vacios sin datos', async () => {
    const resultado = await consultar(
      '{ cuentasDeGrupos { grupoId saldo } deudasPendientes { cantidad periodosSinCuota } }',
    )
    expect(resultado.errors).toBeUndefined()
    expect(resultado.data).toEqual({
      cuentasDeGrupos: [],
      deudasPendientes: { cantidad: 0, periodosSinCuota: [] },
    })
  })

  test('define y consulta una cuota', async () => {
    const { esquema, contexto } = await componer(
      config,
      crearBd(':memory:'),
      sellador,
      crearAlmacenamientoEnMemoria(),
      crearConversorDeImagenes(),
    )
    const [periodo] = await contexto.tesoreria.listarPeriodosConfigurables(alcanceSinLimites())
    const mutacion = await execute({
      schema: esquema,
      document: parse(
        'mutation Definir($periodo: Int!) { definirCuotaDeAfiliacion(periodo: $periodo, importe: 20000) { periodo importe } }',
      ),
      variableValues: { periodo },
      contextValue: { ...contexto, actor: elevado, alcance: sinLimites },
    })
    const consulta = await execute({
      schema: esquema,
      document: parse('{ cuotasDeAfiliacion { periodo importe } }'),
      contextValue: { ...contexto, actor: elevado, alcance: sinLimites },
    })
    expect(mutacion.errors).toBeUndefined()
    expect(consulta.data).toEqual({ cuotasDeAfiliacion: [{ periodo, importe: 20000 }] })
  })

  test('traduce los datos de pago invalidos a un error de negocio', async () => {
    const resultado = await consultar(
      'mutation { registrarPago(grupoId: "inexistente", fecha: "2026-05-01", importe: 20000, medioDePago: efectivo) { id } }',
    )
    expect(resultado.errors?.[0]?.extensions.code).toBe('DatosDePagoInvalidos')
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
