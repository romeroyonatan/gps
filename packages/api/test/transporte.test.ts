import { describe, expect, test } from 'bun:test'
import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { parse } from 'graphql'
import { ErrorDeApi, transporteHttp } from '../src/transporte'

const DOCUMENTO = parse('{ version { numero } }') as TypedDocumentNode<
  { version: { numero: string } },
  Record<string, never>
>

function fetchFalso(cuerpo: unknown, estado = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(cuerpo), {
      status: estado,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch
}

describe('transporteHttp', () => {
  test('devuelve los datos cuando la respuesta es correcta', async () => {
    const transporte = transporteHttp(
      'http://x/graphql',
      fetchFalso({ data: { version: { numero: '1.0.0' } } }),
    )
    expect(await transporte.ejecutar(DOCUMENTO)).toEqual({ version: { numero: '1.0.0' } })
  })

  test('lanza ErrorDeApi cuando GraphQL devuelve errores', async () => {
    const transporte = transporteHttp(
      'http://x/graphql',
      fetchFalso({ errors: [{ message: 'sin permiso' }] }),
    )
    expect(transporte.ejecutar(DOCUMENTO)).rejects.toThrow(ErrorDeApi)
  })

  test('el ErrorDeApi conserva los mensajes del servidor', async () => {
    const transporte = transporteHttp(
      'http://x/graphql',
      fetchFalso({ errors: [{ message: 'sin permiso' }] }),
    )
    // Sin `throw` guardian dentro del try: ese throw lo atrapa su propio catch
    // y la asercion terminaria corriendo sobre el error equivocado. Acumulando
    // en una variable, si no se lanza nada queda undefined y el test falla.
    let errores: readonly string[] | undefined
    try {
      await transporte.ejecutar(DOCUMENTO)
    } catch (error) {
      errores = (error as ErrorDeApi).errores
    }
    expect(errores).toEqual(['sin permiso'])
  })

  test('lanza si el transporte responde con un codigo de error HTTP', async () => {
    const transporte = transporteHttp('http://x/graphql', fetchFalso({}, 500))
    expect(transporte.ejecutar(DOCUMENTO)).rejects.toThrow()
  })
})
