import {
  aplicarMigraciones,
  type Bd,
  type Config,
  type Context,
  crearBuilder,
  ordenarModulos,
} from '@gps/core'
import type { GraphQLSchema } from 'graphql'
import { crearCore } from './core'
import { modulos } from './modules'

/** Raiz de composicion: ordena los modulos, arma el Core, crea los servicios
 *  de cada uno y compone el esquema. Si algo falta, no compila. */
export async function componer(
  config: Config,
  bd: Bd,
): Promise<{ esquema: GraphQLSchema; contexto: Context }> {
  const ordenados = ordenarModulos(modulos)
  const core = crearCore(
    config,
    ordenados.map((modulo) => modulo.name),
    bd,
  )
  const builder = crearBuilder()

  // Antes de crear los servicios: ninguno deberia poder consultar una tabla
  // que todavia no existe.
  aplicarMigraciones(core, ordenados)

  const servicios: Record<string, unknown> = {}
  for (const modulo of ordenados) {
    servicios[modulo.name] = modulo.createServices(core)
    modulo.registerSchema(builder)
  }

  const contexto = { actor: null, ...servicios } as Context

  // La base del demo es siempre nueva y en memoria (ver leerRutaDeBd), asi que
  // no hace falta que la siembra sea idempotente.
  if (config.entorno === 'demo') {
    // Dinamico: el escenario de ejemplo no tiene por que estar en memoria en
    // produccion.
    const { sembrarEscenario } = await import('@gps/demo/servidor')
    await sembrarEscenario(contexto)
  }

  return { esquema: builder.toSchema(), contexto }
}
