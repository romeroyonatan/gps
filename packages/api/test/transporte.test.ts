import { describe, expect, test } from 'bun:test'
import { ErrorDeApi, transporteHttp } from '../src/transporte'

describe('origen', () => {
  test('de una URL absoluta sale el origen', () => {
    // Es lo que mobile antepone para subir un archivo: sin esto, el PUT va a
    // una ruta relativa que React Native no sabe resolver.
    expect(transporteHttp('http://192.168.0.10:3000/graphql').origen).toBe(
      'http://192.168.0.10:3000',
    )
  })

  test('de una URL relativa queda vacio', () => {
    // Asi la usa la web: el navegador resuelve contra la pagina, y anteponerle
    // algo la romperia.
    expect(transporteHttp('/graphql').origen).toBe('')
  })
})

/** Un documento de juguete: al transporte sólo le importa poder imprimirlo. */
const CONSULTA = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      selectionSet: {
        kind: 'SelectionSet',
        selections: [{ kind: 'Field', name: { kind: 'Name', value: '__typename' } }],
      },
    },
  ],
  // biome-ignore lint/suspicious/noExplicitAny: un documento minimo, sin el tipado generado
} as any

const MUTACION = {
  ...CONSULTA,
  definitions: [{ ...CONSULTA.definitions[0], operation: 'mutation' }],
}

/** El error que el transporte lanza, ya tipado: lo que importa de estos tests
 *  son `noAutenticado` y `sinPermiso`. */
const comoErrorDeApi = async (correr: () => Promise<unknown>): Promise<ErrorDeApi> => {
  try {
    await correr()
  } catch (error) {
    if (error instanceof ErrorDeApi) return error
    throw error
  }
  throw new Error('Se esperaba un ErrorDeApi.')
}

const cabeceras = (pedido: RequestInit | undefined): Record<string, string> =>
  (pedido?.headers as Record<string, string>) ?? {}

function respondiendo(cuerpo: unknown, status = 200) {
  const pedidos: RequestInit[] = []
  const falso = (async (_url: string, opciones?: RequestInit) => {
    pedidos.push(opciones ?? {})
    return new Response(JSON.stringify(cuerpo), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  }) as unknown as typeof fetch
  return { falso, pedidos }
}

describe('credenciales', () => {
  test('la web manda la cookie y no un bearer', async () => {
    const { falso, pedidos } = respondiendo({ data: {} })
    await transporteHttp('/graphql', falso).ejecutar(CONSULTA)
    expect(pedidos[0]?.credentials).toBe('include')
    expect(cabeceras(pedidos[0]).authorization).toBeUndefined()
  })

  test('mobile manda el secreto como bearer', async () => {
    const { falso, pedidos } = respondiendo({ data: {} })
    const transporte = transporteHttp('http://gps.test/graphql', falso, () => 'sec')
    await transporte.ejecutar(CONSULTA)
    expect(cabeceras(pedidos[0]).authorization).toBe('Bearer sec')
  })

  test('sin sesion guardada no manda cabecera vacia', async () => {
    const { falso, pedidos } = respondiendo({ data: {} })
    await transporteHttp('http://gps.test/graphql', falso, () => null).ejecutar(CONSULTA)
    expect(cabeceras(pedidos[0]).authorization).toBeUndefined()
  })

  test('marca sólo mutations iniciadas mientras el cliente veía sudo', async () => {
    const { falso, pedidos } = respondiendo({ data: {} })
    const transporte = transporteHttp('/graphql', falso, undefined, () => true)
    await transporte.ejecutar(CONSULTA)
    await transporte.ejecutar(MUTACION)
    expect(cabeceras(pedidos[0])['x-gps-intencion-elevada']).toBeUndefined()
    expect(cabeceras(pedidos[1])['x-gps-intencion-elevada']).toBe('1')
  })
})

describe('errores distinguibles', () => {
  test('no autenticado y sin permiso no se confunden', async () => {
    const anonimo = respondiendo({
      errors: [{ message: 'Necesitás iniciar sesión.', extensions: { code: 'NO_AUTENTICADO' } }],
    })
    const sinPermiso = respondiendo({
      errors: [{ message: 'No tenés acceso a tesoreria.', extensions: { code: 'SIN_PERMISO' } }],
    })

    const uno = await comoErrorDeApi(() =>
      transporteHttp('/graphql', anonimo.falso).ejecutar(CONSULTA),
    )
    expect(uno.noAutenticado).toBe(true)
    expect(uno.sinPermiso).toBe(false)

    const otro = await comoErrorDeApi(() =>
      transporteHttp('/graphql', sinPermiso.falso).ejecutar(CONSULTA),
    )
    expect(otro.sinPermiso).toBe(true)
    expect(otro.noAutenticado).toBe(false)
  })

  test('un 401 del transporte tambien es no autenticado', async () => {
    const { falso } = respondiendo({}, 401)
    const error = await comoErrorDeApi(() => transporteHttp('/graphql', falso).ejecutar(CONSULTA))
    expect(error.noAutenticado).toBe(true)
  })
})
