import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { print } from 'graphql'

export class ErrorDeApi extends Error {
  readonly errores: readonly string[]

  constructor(errores: readonly string[]) {
    super(`La API devolvio errores: ${errores.join('; ')}`)
    this.name = 'ErrorDeApi'
    this.errores = errores
  }
}

/** Como se ejecuta una consulta. La implementacion HTTP es la unica que
 *  existe hoy; el modo local va a aportar otra que ejecuta en proceso, sin
 *  que las pantallas cambien. */
export interface Transporte {
  ejecutar<Resultado, Variables>(
    documento: TypedDocumentNode<Resultado, Variables>,
    variables?: Variables,
  ): Promise<Resultado>
}

export function transporteHttp(url: string, hacerPedido: typeof fetch = fetch): Transporte {
  return {
    async ejecutar(documento, variables) {
      const respuesta = await hacerPedido(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: print(documento), variables }),
      })

      if (!respuesta.ok) {
        throw new Error(`La API respondio ${respuesta.status} ${respuesta.statusText}`)
      }

      const cuerpo = (await respuesta.json()) as {
        data?: unknown
        errors?: Array<{ message: string }>
      }

      if (cuerpo.errors?.length) {
        throw new ErrorDeApi(cuerpo.errors.map((error) => error.message))
      }

      return cuerpo.data as never
    },
  }
}
