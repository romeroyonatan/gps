import { autorizadores } from '@gps/archivos/servidor'
import {
  type Almacenamiento,
  aplicarMigraciones,
  type Bd,
  type Config,
  type Context,
  type ConversorDeImagenes,
  componerEsquema,
  crearServicios,
  type Logger,
  ordenarModulos,
  type Reloj,
  type Sellador,
} from '@gps/core'
import { crearBuilder } from '@gps/core/graphql'
import type { GraphQLSchema } from 'graphql'
import { crearCore } from './core'
import { modulos } from './modules'

/** Raiz de composicion: ordena los modulos, arma el Core, crea los servicios
 *  de cada uno y compone el esquema. Si algo falta, no compila. */
/** Recibe el sellador y el almacenamiento ya construidos, no las variables de
 *  entorno con que se arman: de que forma vienen las claves o donde estan los
 *  bytes es asunto de quien arranca el proceso, y asi el generador de schema y
 *  los tests componen con implementaciones de juguete sin inventar un entorno. */
export async function componer(
  config: Config,
  bd: Bd,
  sellador: Sellador,
  almacenamiento: Almacenamiento,
  conversorDeImagenes: ConversorDeImagenes,
): Promise<{ esquema: GraphQLSchema; contexto: Context; logger: Logger; reloj: Reloj }> {
  const ordenados = ordenarModulos(modulos)
  const core = crearCore(
    config,
    ordenados.map((modulo) => modulo.name),
    bd,
    sellador,
    almacenamiento,
    conversorDeImagenes,
  )
  const builder = crearBuilder()

  // Antes de crear los servicios: ninguno deberia poder consultar una tabla
  // que todavia no existe.
  aplicarMigraciones(core, ordenados)

  const servicios = crearServicios(core, ordenados)
  const contexto = {
    actor: null,
    alcance: null,
    sesionId: null,
    elevadaHasta: null,
    intencionElevada: false,
    config,
    ...servicios,
  } as Context

  // `archivos` no puede depender de sus dueños -seria un ciclo-, asi que los
  // dueños se registran aca, cuando sus servicios ya existen. Un archivo cuyo
  // modulo no este en este registro no se entrega.
  autorizadores.salidas = (recursoId, alcance) =>
    contexto.salidas.puedeVerArchivosDe(recursoId, alcance)
  const esquema = componerEsquema(builder, ordenados)

  // La base del demo es siempre nueva y en memoria (ver leerRutaDeBd), asi que
  // no hace falta que la siembra sea idempotente.
  if (config.entorno === 'demo') {
    // Dinamico: el escenario de ejemplo no tiene por que estar en memoria en
    // produccion.
    const { sembrarEscenario } = await import('@gps/demo/servidor')
    await sembrarEscenario(contexto, core.reloj.ahora())
  }

  // El logger sale de aca y no del Context: el contexto es lo que ven los
  // resolvers, y sumarle plomeria del servidor lo ensancha para todos los
  // modulos. Quien sirve HTTP si lo necesita, para dejar rastro de lo que no
  // supo traducir.
  return { esquema, contexto, logger: core.logger, reloj: core.reloj }
}
