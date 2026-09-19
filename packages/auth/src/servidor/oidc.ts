import type { Core } from '@gps/core'
import * as jose from 'jose'
import type { ClienteHttp } from './http'
import { desafioDe, nuevoVerificador } from './pkce'

export type Plataforma = 'web' | 'ios' | 'android'

/** Lo que arranca un login: la URL a la que se redirige y los datos que hay
 *  que conservar hasta el callback para poder validar la respuesta. Quien
 *  llama los guarda sellados (ver `ServicioDeAuth.iniciarLogin`); el proveedor
 *  no sabe cómo se guardan. */
export interface InicioDeLogin {
  readonly url: string
  readonly state: string
  readonly nonce: string
  readonly codeVerifier: string
}

/** Lo único que el resto del módulo necesita de un proveedor ya validado: el
 *  `subject` estable que Google o Apple asignan a esa persona. Nada de email:
 *  el diseño descarta correlacionar identidades por correo. */
export interface ProveedorOidc {
  iniciar(redirectUri: string, plataforma: Plataforma): InicioDeLogin
  intercambiarCodigo(datos: {
    code: string
    codeVerifier: string
    nonceEsperado: string
    redirectUri: string
    plataforma: Plataforma
  }): Promise<{ subject: string }>
}

export class TokenInvalido extends Error {
  constructor(motivo: string) {
    super(`El proveedor no pudo validarse: ${motivo}`)
    this.name = 'TokenInvalido'
  }
}

/** Verifica firma, emisor, audiencia y nonce de un id_token contra un JWKS ya
 *  obtenido -no lo descarga esta función: eso lo hace el `ClienteHttp`
 *  inyectado, que en los tests es falso y no toca la red. */
async function verificarIdToken(
  idToken: string,
  jwks: unknown,
  opciones: { issuer: string; audience: string; nonce: string },
): Promise<{ subject: string }> {
  const conjunto = jose.createLocalJWKSet(jwks as jose.JSONWebKeySet)
  let resultado: jose.JWTVerifyResult
  try {
    resultado = await jose.jwtVerify(idToken, conjunto, {
      issuer: opciones.issuer,
      audience: opciones.audience,
    })
  } catch (error) {
    throw new TokenInvalido(error instanceof Error ? error.message : String(error))
  }
  if (resultado.payload.nonce !== opciones.nonce) throw new TokenInvalido('el nonce no coincide')
  if (typeof resultado.payload.sub !== 'string') throw new TokenInvalido('sin subject')
  return { subject: resultado.payload.sub }
}

export function crearProveedorGoogle(
  core: Core,
  config: {
    clienteWebId: string
    clienteIosId: string
    clienteAndroidId: string
    clienteSecreto: string
  },
  http: ClienteHttp,
): ProveedorOidc {
  const clientIdDe = (plataforma: Plataforma) =>
    plataforma === 'ios'
      ? config.clienteIosId
      : plataforma === 'android'
        ? config.clienteAndroidId
        : config.clienteWebId

  return {
    iniciar(redirectUri, plataforma) {
      const state = core.nuevoSecreto(16)
      const nonce = core.nuevoSecreto(16)
      const codeVerifier = nuevoVerificador(core)
      const parametros = new URLSearchParams({
        client_id: clientIdDe(plataforma),
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid',
        state,
        nonce,
        code_challenge: desafioDe(core, codeVerifier),
        code_challenge_method: 'S256',
      })
      return {
        url: `https://accounts.google.com/o/oauth2/v2/auth?${parametros}`,
        state,
        nonce,
        codeVerifier,
      }
    },

    async intercambiarCodigo({ code, codeVerifier, nonceEsperado, redirectUri, plataforma }) {
      const clientId = clientIdDe(plataforma)
      const token = (await http.postFormulario('https://oauth2.googleapis.com/token', {
        code,
        code_verifier: codeVerifier,
        client_id: clientId,
        // El secreto sólo aplica al cliente web: los clientes móviles de
        // Google son públicos y no lo llevan.
        ...(plataforma === 'web' ? { client_secret: config.clienteSecreto } : {}),
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      })) as { id_token?: unknown }
      if (typeof token.id_token !== 'string') throw new TokenInvalido('sin id_token')

      const jwks = await http.get('https://www.googleapis.com/oauth2/v3/certs')
      return verificarIdToken(token.id_token, jwks, {
        issuer: 'https://accounts.google.com',
        audience: clientId,
        nonce: nonceEsperado,
      })
    },
  }
}

/** El `client_secret` de Apple no es un secreto fijo: es un JWT firmado con la
 *  clave privada del equipo, de hasta seis meses de vigencia (Apple exige
 *  ES256, `iss` el equipo, `sub`/sub-audiencia el servicio, `aud`
 *  `https://appleid.apple.com`). Se firma en cada intercambio y no se
 *  persiste: es más simple que gestionar su rotación. */
async function firmarClienteSecretoDeApple(
  core: Core,
  config: { equipoId: string; claveId: string; clavePrivada: string; servicioId: string },
): Promise<string> {
  const clave = await jose.importPKCS8(config.clavePrivada, 'ES256')
  const ahora = Math.floor(core.reloj.ahora().getTime() / 1000)
  return new jose.SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: config.claveId })
    .setIssuer(config.equipoId)
    .setSubject(config.servicioId)
    .setAudience('https://appleid.apple.com')
    .setIssuedAt(ahora)
    .setExpirationTime(ahora + 300)
    .sign(clave)
}

export function crearProveedorApple(
  core: Core,
  config: {
    servicioId: string
    bundleId: string
    equipoId: string
    claveId: string
    clavePrivada: string
  },
  http: ClienteHttp,
): ProveedorOidc {
  const clientIdDe = (plataforma: Plataforma) =>
    plataforma === 'web' ? config.servicioId : config.bundleId

  return {
    iniciar(redirectUri, plataforma) {
      const state = core.nuevoSecreto(16)
      const nonce = core.nuevoSecreto(16)
      const codeVerifier = nuevoVerificador(core)
      const parametros = new URLSearchParams({
        client_id: clientIdDe(plataforma),
        redirect_uri: redirectUri,
        response_type: 'code',
        response_mode: 'form_post',
        scope: 'name',
        state,
        nonce,
        code_challenge: desafioDe(core, codeVerifier),
        code_challenge_method: 'S256',
      })
      return {
        url: `https://appleid.apple.com/auth/authorize?${parametros}`,
        state,
        nonce,
        codeVerifier,
      }
    },

    async intercambiarCodigo({ code, codeVerifier, nonceEsperado, redirectUri, plataforma }) {
      const clientId = clientIdDe(plataforma)
      const clienteSecreto = await firmarClienteSecretoDeApple(core, config)
      const token = (await http.postFormulario('https://appleid.apple.com/auth/token', {
        code,
        code_verifier: codeVerifier,
        client_id: clientId,
        client_secret: clienteSecreto,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      })) as { id_token?: unknown }
      if (typeof token.id_token !== 'string') throw new TokenInvalido('sin id_token')

      const jwks = await http.get('https://appleid.apple.com/auth/keys')
      return verificarIdToken(token.id_token, jwks, {
        issuer: 'https://appleid.apple.com',
        audience: clientId,
        nonce: nonceEsperado,
      })
    },
  }
}
