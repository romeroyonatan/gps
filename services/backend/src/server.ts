import type { Bd, Config } from '@gps/core'
import { createYoga } from 'graphql-yoga'
import inicio from '../../../apps/web/index.html'
import { componer } from './composicion'
import { crearContexto } from './context'

export async function crearServidor(config: Config, bd: Bd) {
  const { esquema, contexto } = await componer(config, bd)

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
      '/*': inicio,
    },
  })

  // Devuelve tambien el contexto porque quien arranca el proceso necesita
  // alcanzar a los servicios sin un request encima: el barrido de afiliacion
  // corre al arrancar, no atras de una consulta.
  return { servidor, contexto }
}
