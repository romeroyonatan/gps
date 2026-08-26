import { type Config, type Context, crearBuilder, ordenarModulos } from '@gps/core'
import type { GraphQLSchema } from 'graphql'
import { crearCore } from './core'
import { modulos } from './modules'

/** Raiz de composicion: ordena los modulos, arma el Core, crea los servicios
 *  de cada uno y compone el esquema. Si algo falta, no compila. */
export function componer(config: Config): { esquema: GraphQLSchema; contexto: Context } {
  const ordenados = ordenarModulos(modulos)
  const core = crearCore(
    config,
    ordenados.map((modulo) => modulo.name),
  )
  const builder = crearBuilder()

  const servicios: Record<string, unknown> = {}
  for (const modulo of ordenados) {
    servicios[modulo.name] = modulo.createServices(core)
    modulo.registerSchema(builder)
  }

  const contexto = { actor: null, ...servicios } as Context
  return { esquema: builder.toSchema(), contexto }
}
