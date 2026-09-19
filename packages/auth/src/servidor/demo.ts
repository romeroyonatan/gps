import type { Core } from '@gps/core'
import type { ProveedorOidc } from './oidc'
import { TokenInvalido } from './oidc'

/** El proveedor interno del entorno demo: un clic y adentro, sin Google ni
 *  Apple ni red.
 *
 *  No es un atajo que saltee la autorización: recorre exactamente el mismo
 *  camino que los otros dos -transacción sellada, `state`, callback, sesión
 *  opaca, derivación de cargos y equipos vigentes- y por eso sirve para
 *  mostrar el demo y para probar los flujos sin proveedores externos. Lo
 *  único que reemplaza es la parte que necesitaría a Google: en vez de mandar
 *  a la persona a otro sitio, la manda de vuelta al callback propio.
 *
 *  El perfil elegido viaja en el `redirectUri`, que es lo único que el
 *  proveedor recibe en las dos mitades del viaje. El `subject` es ese perfil:
 *  es lo que `identidades_externas` tiene vinculado a cada persona sembrada.
 *
 *  Se registra sólo cuando `config.entorno === 'demo'`. Fuera de ahí el
 *  servicio no lo conoce y `iniciarLogin` falla: la ruta no existe y el
 *  servicio también lo rechaza, que son las dos defensas que pide el diseño. */
export function crearProveedorDemo(core: Core): ProveedorOidc {
  return {
    iniciar(redirectUri) {
      const state = core.nuevoSecreto()
      const separador = redirectUri.includes('?') ? '&' : '?'
      return {
        url: `${redirectUri}${separador}code=demo&state=${state}`,
        state,
        nonce: core.nuevoSecreto(),
        codeVerifier: core.nuevoSecreto(),
      }
    },

    async intercambiarCodigo({ redirectUri }) {
      const perfil = new URL(redirectUri).searchParams.get('perfil')
      if (!perfil) throw new TokenInvalido('el enlace demo no dice qué perfil usar')
      return { subject: perfil }
    },
  }
}
