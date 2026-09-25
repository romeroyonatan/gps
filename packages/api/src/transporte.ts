import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { print } from 'graphql'

export class ErrorDeApi extends Error {
  readonly errores: readonly string[]
  /** Los codigos que el servidor puso en `extensions.code`. Dos importan en
   *  todas las pantallas y por eso tienen pregunta propia abajo: no estar
   *  autenticado -hay que ir al login- y no tener permiso -la accion no
   *  existia para esta persona-. Confundirlos manda al login a alguien que ya
   *  entro. */
  readonly codigos: readonly string[]

  constructor(errores: readonly string[], codigos: readonly string[] = []) {
    super(`La API devolvio errores: ${errores.join('; ')}`)
    this.name = 'ErrorDeApi'
    this.errores = errores
    this.codigos = codigos
  }

  get noAutenticado(): boolean {
    return this.codigos.includes('NO_AUTENTICADO')
  }

  get sinPermiso(): boolean {
    return this.codigos.includes('SIN_PERMISO')
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

  /** De donde cuelgan las rutas que no son GraphQL: subir y bajar archivos, y
   *  el PDF de un permiso. Esas rutas devuelven caminos relativos -/archivos/x-
   *  y en el navegador alcanza, pero React Native no tiene origen contra el que
   *  resolverlos: sin esto, subir un adjunto desde el telefono falla. */
  readonly origen: string
}

/** De donde sale el secreto de la sesion en mobile. La web no la usa: su
 *  sesion viaja en una cookie HttpOnly, que el JavaScript de la pagina no
 *  puede leer -es justamente la idea- y el navegador manda sola. */
export type SecretoDeSesion = () => string | null | Promise<string | null>
export type IntencionElevada = () => boolean

function origenDe(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return ''
  }
}

export function transporteHttp(
  url: string,
  hacerPedido: typeof fetch = fetch,
  secretoDeSesion?: SecretoDeSesion,
  intencionElevada?: IntencionElevada,
): Transporte {
  return {
    // El de la URL de GraphQL: las rutas de archivos las sirve el mismo backend.
    // Vacio cuando la URL ya es relativa -asi la usa la web-: ahi el navegador
    // resuelve contra la pagina y anteponerle algo la rompe.
    origen: origenDe(url),
    async ejecutar(documento, variables) {
      const secreto = await secretoDeSesion?.()
      const esMutation = documento.definitions.some(
        (definicion) =>
          definicion.kind === 'OperationDefinition' && definicion.operation === 'mutation',
      )
      const elevada = esMutation && intencionElevada?.()
      const respuesta = await hacerPedido(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(secreto ? { authorization: `Bearer ${secreto}` } : {}),
          ...(elevada ? { 'x-gps-intencion-elevada': '1' } : {}),
        },
        // Sin esto el navegador no manda la cookie de sesion en un pedido a
        // otro origen, y la web queda anonima contra un backend separado.
        credentials: 'include',
        body: JSON.stringify({ query: print(documento), variables }),
      })

      if (respuesta.status === 401) {
        throw new ErrorDeApi(['Necesitás iniciar sesión.'], ['NO_AUTENTICADO'])
      }
      if (respuesta.status === 403) {
        throw new ErrorDeApi(['No tenés permiso para esto.'], ['SIN_PERMISO'])
      }
      if (!respuesta.ok) {
        throw new Error(`La API respondio ${respuesta.status} ${respuesta.statusText}`)
      }

      const cuerpo = (await respuesta.json()) as {
        data?: unknown
        errors?: Array<{ message: string; extensions?: { code?: unknown } }>
      }

      if (cuerpo.errors?.length) {
        throw new ErrorDeApi(
          cuerpo.errors.map((error) => error.message),
          cuerpo.errors.flatMap((error) =>
            typeof error.extensions?.code === 'string' ? [error.extensions.code] : [],
          ),
        )
      }

      return cuerpo.data as never
    },
  }
}
