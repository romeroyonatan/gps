import type { Almacenamiento, Bd, Config, ConversorDeImagenes, Sellador } from '@gps/core'
import { createYoga } from 'graphql-yoga'
import inicio from '../../../apps/web/index.html'
import { componer } from './composicion'
import { crearContexto } from './context'
import { rutaDeArchivos, rutaDelPdfDeUnPermiso } from './rutas-de-archivos'

export async function crearServidor(
  config: Config,
  bd: Bd,
  sellador: Sellador,
  almacenamiento: Almacenamiento,
  conversorDeImagenes: ConversorDeImagenes,
) {
  const { esquema, contexto, logger } = await componer(
    config,
    bd,
    sellador,
    almacenamiento,
    conversorDeImagenes,
  )

  const yoga = createYoga({
    schema: esquema,
    context: crearContexto(contexto),
    graphqlEndpoint: '/graphql',
    landingPage: false,
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
      '/archivos/:id': (pedido) => rutaDeArchivos(contexto, logger, pedido),
      '/permisos/:id/pdf': (pedido) => rutaDelPdfDeUnPermiso(contexto, logger, pedido),
      '/*': inicio,
    },
  })

  // Devuelve tambien el contexto porque quien arranca el proceso necesita
  // alcanzar a los servicios sin un request encima: el barrido de afiliacion
  // corre al arrancar, no atras de una consulta.
  return { servidor, contexto }
}
