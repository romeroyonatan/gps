import type { Almacenamiento, Bd, Config, ConversorDeImagenes, Sellador } from '@gps/core'
import { createYoga } from 'graphql-yoga'
import inicio from '../../../apps/web/index.html'
import { crearInterceptorDeEscriturasElevadas } from './auditoria'
import { componer } from './composicion'
import { crearContexto } from './context'
import { rutaDeArchivos, rutaDeLaNominaDeUnGrupo, rutaDelPdfDeUnPermiso } from './rutas-de-archivos'
import { rutaDeCallbackDeLogin, rutaDeInicioDeLogin } from './rutas-de-auth'

export async function crearServidor(
  config: Config,
  bd: Bd,
  sellador: Sellador,
  almacenamiento: Almacenamiento,
  conversorDeImagenes: ConversorDeImagenes,
) {
  const { esquema, contexto, logger, reloj } = await componer(
    config,
    bd,
    sellador,
    almacenamiento,
    conversorDeImagenes,
  )

  const contextoPorPedido = crearContexto(contexto, reloj)
  const yoga = createYoga({
    schema: esquema,
    context: contextoPorPedido,
    graphqlEndpoint: '/graphql',
    landingPage: false,
    plugins: [crearInterceptorDeEscriturasElevadas()],
  })

  const servidor = Bun.serve({
    port: config.puerto,
    development: config.entorno === 'desarrollo',
    routes: {
      '/graphql': (pedido) => yoga.fetch(pedido),
      '/health': () => Response.json({ estado: 'ok', version: config.version }),
      // Los bytes de los archivos no pasan por GraphQL: acopla la transferencia
      // de binarios al lenguaje de consultas y transmite mal (spec base §9.2).
      // Las rutas viven aca y no en el Module porque hay un solo consumidor.
      // ponytail: si un segundo modulo necesita rutas propias, sumar `routes`
      // a Module en vez de seguir agregando casos aca.
      // Las dos mitades del viaje por el navegador: ver rutas-de-auth.ts.
      '/auth/:proveedor/iniciar': async (pedido) =>
        rutaDeInicioDeLogin(await contextoPorPedido({ request: pedido }), pedido),
      '/auth/:proveedor/callback': async (pedido) =>
        rutaDeCallbackDeLogin(await contextoPorPedido({ request: pedido }), logger, pedido),
      '/archivos/:id': async (pedido) =>
        rutaDeArchivos(await contextoPorPedido({ request: pedido }), logger, pedido),
      '/permisos/:id/pdf': async (pedido) =>
        rutaDelPdfDeUnPermiso(await contextoPorPedido({ request: pedido }), logger, pedido),
      '/grupos/:id/nomina.pdf': async (pedido) =>
        rutaDeLaNominaDeUnGrupo(
          await contextoPorPedido({ request: pedido }),
          logger,
          pedido,
          'pdf',
        ),
      '/grupos/:id/nomina.xlsx': async (pedido) =>
        rutaDeLaNominaDeUnGrupo(
          await contextoPorPedido({ request: pedido }),
          logger,
          pedido,
          'xlsx',
        ),
      '/*': inicio,
    },
  })

  // Devuelve tambien el contexto porque quien arranca el proceso necesita
  // alcanzar a los servicios sin un request encima: el barrido de afiliacion
  // corre al arrancar, no atras de una consulta.
  return { servidor, contexto }
}
