import type { Plataforma } from '@gps/auth/servidor'
import {
  ElevacionDenegada,
  IdentidadNoVinculada,
  InvitacionInvalida,
  ProveedorYaVinculado,
  TransaccionDeLoginInvalida,
} from '@gps/auth/servidor'
import type { Context, Logger } from '@gps/core'

/** El login no es una mutation: es una vuelta por el navegador. Estas rutas
 *  son las dos mitades de esa vuelta -arrancar y volver- y todo lo que hay que
 *  conservar en el medio viaja sellado en una cookie, no en el servidor.
 *
 *  `intencion` distingue para qué es el login, porque las cuatro variantes
 *  comparten exactamente el mismo viaje y sólo difieren en qué se hace con el
 *  `subject` al volver: abrir sesión, vincular un segundo proveedor, elevar la
 *  sesión, o consumir un enlace de invitación. */
type Intencion = 'login' | 'vincular' | 'elevar' | 'activacion' | 'recuperacion'

const INTENCIONES: readonly Intencion[] = [
  'login',
  'vincular',
  'elevar',
  'activacion',
  'recuperacion',
]

const COOKIE_DE_SESION = 'gps_session'
const COOKIE_DE_TRANSACCION = 'gps_login'
const TREINTA_DIAS = 30 * 24 * 60 * 60

/** Lo que hay que recordar entre las dos mitades del viaje. Va en una cookie
 *  propia, de vida corta, que el callback borra apenas la usa. */
interface Pendiente {
  readonly transaccion: string
  readonly intencion: Intencion
  readonly destino: string
  readonly plataforma: Plataforma
  readonly secreto?: string
}

function cookie(pedido: Request, nombre: string): string | null {
  const crudas = pedido.headers.get('cookie')
  if (!crudas) return null
  for (const parte of crudas.split(';')) {
    const [clave, ...valor] = parte.trim().split('=')
    if (clave === nombre) return decodeURIComponent(valor.join('=')) || null
  }
  return null
}

function ponerCookie(nombre: string, valor: string, segundos: number, seguro: boolean): string {
  const atributos = [
    `${nombre}=${encodeURIComponent(valor)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${segundos}`,
  ]
  // Secure rompe el desarrollo en http://localhost, asi que lo decide el
  // entorno y no una constante.
  if (seguro) atributos.push('Secure')
  return atributos.join('; ')
}

function esIntencion(valor: string | null): valor is Intencion {
  return valor !== null && INTENCIONES.includes(valor as Intencion)
}

/** GET /auth/:proveedor/iniciar — manda al proveedor y deja la transacción en
 *  una cookie de un solo viaje. */
export function rutaDeInicioDeLogin(
  contexto: Context,
  pedido: Bun.BunRequest<'/auth/:proveedor/iniciar'>,
): Response {
  const url = new URL(pedido.url)
  const proveedor = pedido.params.proveedor
  if (proveedor !== 'google' && proveedor !== 'apple' && proveedor !== 'demo') {
    return new Response('Ese proveedor no existe.', { status: 404 })
  }
  const intencion = url.searchParams.get('intencion') ?? 'login'
  if (!esIntencion(intencion)) return new Response('Intención desconocida.', { status: 400 })

  const plataforma = (url.searchParams.get('plataforma') ?? 'web') as Plataforma
  const origen = contexto.config.auth?.origenPublico ?? url.origin
  // El perfil del proveedor demo viaja en el redirectUri porque es lo unico
  // que el proveedor recibe en las dos mitades del viaje. Para Google y Apple
  // no existe: el subject lo pone el proveedor de verdad.
  const perfil = proveedor === 'demo' ? url.searchParams.get('perfil') : null
  const redirectUri = perfil
    ? `${origen}/auth/demo/callback?perfil=${encodeURIComponent(perfil)}`
    : `${origen}/auth/${proveedor}/callback`

  let inicio: { url: string; transaccion: string }
  try {
    inicio = contexto.auth.iniciarLogin(proveedor, plataforma, redirectUri)
  } catch {
    return new Response('Ese proveedor no está configurado en esta instancia.', { status: 404 })
  }

  const pendiente: Pendiente = {
    transaccion: inicio.transaccion,
    intencion,
    // El destino vuelve a donde estaba la persona antes de entrar. Sólo se
    // admite una ruta relativa: una absoluta convertiria este login en un
    // redirector abierto hacia cualquier dominio.
    destino: rutaRelativa(url.searchParams.get('destino')),
    plataforma,
    secreto: url.searchParams.get('secreto') ?? undefined,
  }

  // El demo vuelve a esta misma app: una ruta relativa conserva el host
  // del navegador cuando Orca la publica detrás de su proxy.
  const destinoDemo = proveedor === 'demo' ? new URL(inicio.url) : null
  return new Response(null, {
    status: 302,
    headers: {
      location: destinoDemo ? `${destinoDemo.pathname}${destinoDemo.search}` : inicio.url,
      'set-cookie': ponerCookie(
        COOKIE_DE_TRANSACCION,
        JSON.stringify(pendiente),
        10 * 60,
        contexto.config.entorno === 'produccion',
      ),
    },
  })
}

/** GET /auth/:proveedor/callback — cierra el viaje según la intención con la
 *  que empezó. */
export async function rutaDeCallbackDeLogin(
  contexto: Context,
  logger: Logger,
  pedido: Bun.BunRequest<'/auth/:proveedor/callback'>,
): Promise<Response> {
  const url = new URL(pedido.url)
  const code = url.searchParams.get('code')
  const stateRecibido = url.searchParams.get('state')
  const guardado = cookie(pedido, COOKIE_DE_TRANSACCION)
  if (!code || !stateRecibido || !guardado) {
    return new Response('Falta parte de la respuesta del proveedor.', { status: 400 })
  }

  let pendiente: Pendiente
  try {
    pendiente = JSON.parse(guardado) as Pendiente
  } catch {
    return new Response('La transacción de login no es válida.', { status: 400 })
  }
  const datos = { transaccion: pendiente.transaccion, stateRecibido, code }
  const seguro = contexto.config.entorno === 'produccion'
  const borrarTransaccion = ponerCookie(COOKIE_DE_TRANSACCION, '', 0, seguro)

  try {
    switch (pendiente.intencion) {
      case 'login':
        return abrirSesion(await contexto.auth.completarLogin(datos), pendiente, seguro, [
          borrarTransaccion,
        ])
      case 'activacion': {
        if (!pendiente.secreto) return new Response('Falta el enlace.', { status: 400 })
        const sesion = await contexto.auth.consumirActivacion(pendiente.secreto, datos)
        return abrirSesion(sesion, pendiente, seguro, [borrarTransaccion])
      }
      case 'recuperacion': {
        if (!pendiente.secreto) return new Response('Falta el enlace.', { status: 400 })
        const sesion = await contexto.auth.consumirRecuperacion(pendiente.secreto, datos)
        return abrirSesion(sesion, pendiente, seguro, [borrarTransaccion])
      }
      case 'vincular': {
        if (!contexto.actor) return new Response('Necesitás iniciar sesión.', { status: 401 })
        await contexto.auth.vincularProveedor(contexto.actor.personaId, datos)
        return volver(pendiente.destino, [borrarTransaccion])
      }
      case 'elevar': {
        if (!contexto.sesionId) return new Response('Necesitás iniciar sesión.', { status: 401 })
        await contexto.auth.elevarSesion(contexto.sesionId, datos)
        return volver(pendiente.destino, [borrarTransaccion])
      }
    }
  } catch (error) {
    if (
      error instanceof IdentidadNoVinculada ||
      error instanceof InvitacionInvalida ||
      error instanceof ProveedorYaVinculado ||
      error instanceof ElevacionDenegada ||
      error instanceof TransaccionDeLoginInvalida
    ) {
      return new Response(error.message, {
        status: 403,
        headers: { 'set-cookie': borrarTransaccion },
      })
    }
    logger.error('Fallo el callback de login', {
      error: error instanceof Error ? error.message : String(error),
    })
    return new Response('No pudimos completar el ingreso.', { status: 500 })
  }
}

/** Web se lleva la sesión en una cookie HttpOnly -no la toca el JavaScript de
 *  la página-; mobile vuelve por deep link y guarda el secreto en el
 *  almacenamiento seguro del sistema, así que ahí sí viaja en la URL. */
function abrirSesion(
  sesion: { secreto: string },
  pendiente: Pendiente,
  seguro: boolean,
  cookies: readonly string[],
): Response {
  if (pendiente.plataforma !== 'web') {
    const deepLink = `gps://sesion?secreto=${encodeURIComponent(sesion.secreto)}`
    return new Response(null, { status: 302, headers: cabeceras(deepLink, cookies) })
  }
  return new Response(null, {
    status: 302,
    headers: cabeceras(pendiente.destino, [
      ...cookies,
      ponerCookie(COOKIE_DE_SESION, sesion.secreto, TREINTA_DIAS, seguro),
    ]),
  })
}

function volver(destino: string, cookies: readonly string[]): Response {
  return new Response(null, { status: 302, headers: cabeceras(destino, cookies) })
}

/** Cada cookie va en su propio `Set-Cookie`. Unirlas con coma en un solo
 *  header las deja invalidas -el cliente lee una cookie sola con basura
 *  adentro y la sesion no se guarda-, y como el header sigue ahi el bug no se
 *  ve desde el servidor: se ve al entrar y seguir anonimo. */
function cabeceras(destino: string, cookies: readonly string[]): Headers {
  const headers = new Headers({ location: destino })
  for (const galletita of cookies) headers.append('set-cookie', galletita)
  return headers
}

/** Sólo una ruta de esta misma app. Una URL absoluta -o una que empiece con
 *  `//`, que el navegador lee como absoluta- convertiria el login en un
 *  redirector abierto: se manda el enlace, la víctima entra de verdad, y sale
 *  en el sitio de quien lo mandó. */
function rutaRelativa(destino: string | null): string {
  if (!destino?.startsWith('/') || destino.startsWith('//')) return '/'
  return destino
}
