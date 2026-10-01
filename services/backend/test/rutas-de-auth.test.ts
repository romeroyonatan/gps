import { describe, expect, test } from 'bun:test'
import type { Context } from '@gps/core'
import { rutaDeCallbackDeLogin, rutaDeInicioDeLogin } from '../src/rutas-de-auth'

const logger = { info: () => {}, error: () => {} }

/** Un contexto de juguete con el minimo que estas rutas tocan: la config y el
 *  servicio de auth. Lo demas del Context no entra en el viaje del login. */
function contextoCon(auth: Partial<Context['auth']>, actor: Context['actor'] = null): Context {
  return {
    actor,
    alcance: null,
    sesionId: actor ? 'sesion_1' : null,
    config: { version: '0.0.0', entorno: 'prueba', puerto: 0, auth: null },
    auth,
  } as unknown as Context
}

const iniciando = () => ({
  iniciarLogin: () => ({ url: 'https://google.test/auth?x=1', transaccion: 'tx' }),
})

function pedidoDeInicio(query: string, proveedor = 'google') {
  const pedido = new Request(
    `http://gps.test/auth/${proveedor}/iniciar${query}`,
  ) as Bun.BunRequest<'/auth/:proveedor/iniciar'>
  Object.defineProperty(pedido, 'params', { value: { proveedor } })
  return pedido
}

function pedidoDeCallback(query: string, cookie?: string) {
  const pedido = new Request(`http://gps.test/auth/google/callback${query}`, {
    headers: cookie ? { cookie } : undefined,
  }) as Bun.BunRequest<'/auth/:proveedor/callback'>
  Object.defineProperty(pedido, 'params', { value: { proveedor: 'google' } })
  return pedido
}

const pendiente = (datos: Record<string, unknown>) =>
  `gps_login=${encodeURIComponent(JSON.stringify({ transaccion: 'tx', destino: '/', plataforma: 'web', ...datos }))}`

describe('iniciar el login', () => {
  test('redirige al proveedor y deja la transacción en una cookie de un viaje', () => {
    const respuesta = rutaDeInicioDeLogin(contextoCon(iniciando()), pedidoDeInicio(''))
    expect(respuesta.status).toBe(302)
    expect(respuesta.headers.get('location')).toBe('https://google.test/auth?x=1')
    const cookie = respuesta.headers.get('set-cookie') ?? ''
    expect(cookie).toContain('gps_login=')
    expect(cookie).toContain('HttpOnly')
  })

  test('demo vuelve al mismo host aunque el backend esté detrás de un proxy', () => {
    const auth = {
      iniciarLogin: () => ({
        url: 'http://localhost:63253/auth/demo/callback?perfil=demo&code=demo&state=s',
        transaccion: 'tx',
      }),
    }
    const respuesta = rutaDeInicioDeLogin(contextoCon(auth), pedidoDeInicio('?perfil=demo', 'demo'))
    expect(respuesta.headers.get('location')).toBe(
      '/auth/demo/callback?perfil=demo&code=demo&state=s',
    )
    expect(respuesta.headers.get('set-cookie')).toContain('gps_login=')
  })

  test('un proveedor que no existe es 404', () => {
    const pedido = pedidoDeInicio('', 'facebook')
    expect(rutaDeInicioDeLogin(contextoCon(iniciando()), pedido).status).toBe(404)
  })

  test('el proveedor demo no existe fuera de demo: el servicio lo rechaza', () => {
    // Las dos defensas del diseño §9: la interfaz no lo muestra, y acá el
    // servicio tampoco lo conoce, así que la ruta contesta 404.
    const sinDemo = contextoCon({
      iniciarLogin: () => {
        throw new Error('demo no está configurado')
      },
    })
    expect(rutaDeInicioDeLogin(sinDemo, pedidoDeInicio('?perfil=jefatura', 'demo')).status).toBe(
      404,
    )
  })

  test('un destino absoluto no convierte el login en un redirector abierto', () => {
    const respuesta = rutaDeInicioDeLogin(
      contextoCon(iniciando()),
      pedidoDeInicio('?destino=https://malo.test/robar'),
    )
    const guardado = JSON.parse(
      decodeURIComponent(
        /gps_login=([^;]*)/.exec(respuesta.headers.get('set-cookie') ?? '')?.[1] ?? '',
      ),
    )
    expect(guardado.destino).toBe('/')
  })

  test('un destino protocolo-relativo tampoco', () => {
    const respuesta = rutaDeInicioDeLogin(
      contextoCon(iniciando()),
      pedidoDeInicio('?destino=//malo.test/robar'),
    )
    const guardado = JSON.parse(
      decodeURIComponent(
        /gps_login=([^;]*)/.exec(respuesta.headers.get('set-cookie') ?? '')?.[1] ?? '',
      ),
    )
    expect(guardado.destino).toBe('/')
  })
})

describe('volver del proveedor', () => {
  test('web se lleva la sesión en una cookie HttpOnly', async () => {
    const contexto = contextoCon({
      completarLogin: async () => ({ secreto: 'sec', sesionId: 'sesion_1' }),
    })
    const respuesta = await rutaDeCallbackDeLogin(
      contexto,
      logger,
      pedidoDeCallback('?code=c&state=s', pendiente({ intencion: 'login', destino: '/grupos' })),
    )
    expect(respuesta.status).toBe(302)
    expect(respuesta.headers.get('location')).toBe('/grupos')
    // Cada una en su propio header: unidas con coma el cliente no guarda
    // ninguna y se vuelve del login igual de anonimo que antes.
    const cookies = respuesta.headers.getSetCookie()
    expect(cookies).toHaveLength(2)
    expect(cookies.some((una) => una.startsWith('gps_session=sec;'))).toBe(true)
    expect(cookies.every((una) => una.includes('HttpOnly'))).toBe(true)
    // La del viaje se borra apenas se usa.
    expect(cookies.some((una) => una.startsWith('gps_login=;'))).toBe(true)
  })

  test('mobile vuelve por deep link y no recibe cookie de sesión', async () => {
    const contexto = contextoCon({
      completarLogin: async () => ({ secreto: 'sec', sesionId: 'sesion_1' }),
    })
    const respuesta = await rutaDeCallbackDeLogin(
      contexto,
      logger,
      pedidoDeCallback('?code=c&state=s', pendiente({ intencion: 'login', plataforma: 'ios' })),
    )
    expect(respuesta.headers.get('location')).toBe('gps://sesion?secreto=sec')
    expect(respuesta.headers.getSetCookie().some((una) => una.startsWith('gps_session='))).toBe(
      false,
    )
  })

  test('sin la cookie del viaje no se completa nada', async () => {
    const respuesta = await rutaDeCallbackDeLogin(
      contextoCon({}),
      logger,
      pedidoDeCallback('?code=c&state=s'),
    )
    expect(respuesta.status).toBe(400)
  })

  test('elevar exige una sesión abierta', async () => {
    const respuesta = await rutaDeCallbackDeLogin(
      contextoCon({}),
      logger,
      pedidoDeCallback('?code=c&state=s', pendiente({ intencion: 'elevar' })),
    )
    expect(respuesta.status).toBe(401)
  })

  test('elevar con sesión llama al servicio y vuelve al destino', async () => {
    const elevadas: string[] = []
    const contexto = contextoCon(
      {
        elevarSesion: async (sesionId: string) => {
          elevadas.push(sesionId)
        },
      },
      { personaId: 'p1', roles: [], esAdministradorDesignado: true, estaElevado: false },
    )
    const respuesta = await rutaDeCallbackDeLogin(
      contexto,
      logger,
      pedidoDeCallback('?code=c&state=s', pendiente({ intencion: 'elevar', destino: '/admin' })),
    )
    expect(elevadas).toEqual(['sesion_1'])
    expect(respuesta.headers.get('location')).toBe('/admin')
  })
})
