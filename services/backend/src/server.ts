import type { Config } from '@gps/core'
import { createYoga } from 'graphql-yoga'
import inicio from '../../../apps/web/index.html'
import { componer } from './composicion'
import { crearContexto } from './context'

export function crearServidor(config: Config) {
  const { esquema, contexto } = componer(config)

  const yoga = createYoga({
    schema: esquema,
    context: crearContexto(contexto),
    graphqlEndpoint: '/graphql',
    landingPage: false,
  })

  return Bun.serve({
    port: config.puerto,
    development: config.entorno === 'desarrollo',
    routes: {
      '/graphql': (pedido) => yoga.fetch(pedido),
      '/health': () => Response.json({ estado: 'ok', version: config.version }),
      '/*': inicio,
    },
  })
}
