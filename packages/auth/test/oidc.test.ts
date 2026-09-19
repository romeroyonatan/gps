import { describe, expect, test } from 'bun:test'
import type { Core } from '@gps/core'
import * as jose from 'jose'
import type { ClienteHttp } from '../src/servidor/http'
import { crearProveedorApple, crearProveedorGoogle, TokenInvalido } from '../src/servidor/oidc'

const HORA = new Date('2026-01-01T00:00:00Z')

function coreFalso(): Core {
  let contador = 0
  return {
    config: { version: '0.0.0', entorno: 'prueba', puerto: 0 },
    logger: { info: () => {}, error: () => {} },
    reloj: { ahora: () => HORA },
    bd: {} as Core['bd'],
    modulos: [],
    sellador: { sellar: () => ({ sello: '', claveId: '' }), verificar: () => true },
    almacenamiento: {
      guardar: async () => {},
      leer: async () => new Uint8Array(),
      eliminar: async () => {},
    },
    conversorDeImagenes: { aJpeg: async (contenido) => contenido },
    hash: (contenido) => new Bun.CryptoHasher('sha256').update(contenido).digest('hex'),
    nuevoId: (prefijo) => `${prefijo}_${++contador}`,
    nuevoSecreto: (bytes = 32) =>
      Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) =>
        b.toString(16).padStart(2, '0'),
      ).join(''),
  }
}

/** Un proveedor falso: firma un id_token real con una clave generada al vuelo
 *  y expone su JWKS, así el verificador de verdad -jose- corre igual que
 *  contra Google o Apple, sin tocar la red. */
async function httpFalsoConIdToken(
  claims: Record<string, unknown>,
  alg: 'RS256' | 'ES256' = 'RS256',
): Promise<ClienteHttp> {
  const { privateKey, publicKey } = await jose.generateKeyPair(alg)
  const kid = 'clave-1'
  const idToken = await new jose.SignJWT(claims).setProtectedHeader({ alg, kid }).sign(privateKey)
  const jwk = await jose.exportJWK(publicKey)
  const jwks = { keys: [{ ...jwk, kid, alg }] }

  return {
    async postFormulario() {
      return { id_token: idToken }
    },
    async get() {
      return jwks
    },
  }
}

describe('proveedor de Google', () => {
  test('inicia con PKCE, state y nonce, y valida el id_token que vuelve', async () => {
    const core = coreFalso()
    const http = await httpFalsoConIdToken({
      iss: 'https://accounts.google.com',
      aud: 'cliente-web',
      sub: 'google-subject-1',
      nonce: 'sera-reemplazado',
    })
    const proveedor = crearProveedorGoogle(
      core,
      {
        clienteWebId: 'cliente-web',
        clienteIosId: 'ios',
        clienteAndroidId: 'android',
        clienteSecreto: 'x',
      },
      http,
    )

    const inicio = proveedor.iniciar('https://gps.test/callback', 'web')
    expect(inicio.url).toContain('code_challenge=')
    expect(inicio.url).toContain('client_id=cliente-web')

    // El nonce real lo pone quien firma el token en este test -el nonce que
    // Google devolvería adentro del id_token-, así que se firma de nuevo con
    // el nonce que sí espera el verificador.
    const http2 = await httpFalsoConIdToken({
      iss: 'https://accounts.google.com',
      aud: 'cliente-web',
      sub: 'google-subject-1',
      nonce: inicio.nonce,
    })
    const proveedor2 = crearProveedorGoogle(
      core,
      {
        clienteWebId: 'cliente-web',
        clienteIosId: 'ios',
        clienteAndroidId: 'android',
        clienteSecreto: 'x',
      },
      http2,
    )
    const resultado = await proveedor2.intercambiarCodigo({
      code: 'un-codigo',
      codeVerifier: inicio.codeVerifier,
      nonceEsperado: inicio.nonce,
      redirectUri: 'https://gps.test/callback',
      plataforma: 'web',
    })
    expect(resultado).toEqual({ subject: 'google-subject-1' })
  })

  test('rechaza emisor, audiencia y nonce equivocados', async () => {
    const core = coreFalso()
    const config = {
      clienteWebId: 'cliente-web',
      clienteIosId: 'ios',
      clienteAndroidId: 'android',
      clienteSecreto: 'x',
    }
    const datosDeIntercambio = {
      code: 'c',
      redirectUri: 'https://gps.test/callback',
      plataforma: 'web' as const,
    }

    const emisorMalo = await httpFalsoConIdToken({
      iss: 'https://otro.example',
      aud: 'cliente-web',
      sub: 's',
      nonce: 'n',
    })
    await expect(
      crearProveedorGoogle(core, config, emisorMalo).intercambiarCodigo({
        ...datosDeIntercambio,
        codeVerifier: 'v',
        nonceEsperado: 'n',
      }),
    ).rejects.toThrow(TokenInvalido)

    const audienciaMala = await httpFalsoConIdToken({
      iss: 'https://accounts.google.com',
      aud: 'otro-cliente',
      sub: 's',
      nonce: 'n',
    })
    await expect(
      crearProveedorGoogle(core, config, audienciaMala).intercambiarCodigo({
        ...datosDeIntercambio,
        codeVerifier: 'v',
        nonceEsperado: 'n',
      }),
    ).rejects.toThrow(TokenInvalido)

    const nonceMalo = await httpFalsoConIdToken({
      iss: 'https://accounts.google.com',
      aud: 'cliente-web',
      sub: 's',
      nonce: 'nonce-firmado',
    })
    await expect(
      crearProveedorGoogle(core, config, nonceMalo).intercambiarCodigo({
        ...datosDeIntercambio,
        codeVerifier: 'v',
        nonceEsperado: 'nonce-esperado-distinto',
      }),
    ).rejects.toThrow(TokenInvalido)
  })
})

describe('proveedor de Apple', () => {
  test('valida un id_token de Apple con clave ES256', async () => {
    const core = coreFalso()
    const http = await httpFalsoConIdToken(
      {
        iss: 'https://appleid.apple.com',
        aud: 'servicio.gps',
        sub: 'apple-subject-1',
        nonce: 'nonce-apple',
      },
      'ES256',
    )
    // Una clave ES256 real: firmarClienteSecretoDeApple corre antes del
    // intercambio y no acepta una PKCS8 inventada.
    const { privateKey } = await jose.generateKeyPair('ES256', { extractable: true })
    const clavePrivada = await jose.exportPKCS8(privateKey)
    const proveedor = crearProveedorApple(
      core,
      {
        servicioId: 'servicio.gps',
        bundleId: 'bundle.gps',
        equipoId: 'equipo',
        claveId: 'clave',
        clavePrivada,
      },
      http,
    )

    const resultado = await proveedor.intercambiarCodigo({
      code: 'c',
      codeVerifier: 'v',
      nonceEsperado: 'nonce-apple',
      redirectUri: 'https://gps.test/callback',
      plataforma: 'web',
    })
    expect(resultado).toEqual({ subject: 'apple-subject-1' })
  })
})
