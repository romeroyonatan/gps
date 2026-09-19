import type { Core } from '@gps/core'
import type { Estructura } from '@gps/estructura/dominio'
import type { Personas } from '@gps/personas/dominio'
import type { Afiliado, Declaracion } from '../dominio/modelos'
import type { Afiliacion } from '../dominio/publico'
import { crearConsultasDeAfiliacion } from './consultas'
import { crearOperacionesDeDeclaracion } from './declaraciones'

export { FechaInvalida, NadaQueDeclarar, YaDeclaroHoy } from './declaraciones'

export interface ServicioDeAfiliacion extends Afiliacion {
  /** Fotografia a los miembros activos del dia `fecha`. Sin `grupoId` declara
   * todos los grupos abiertos; con `grupoId`, ese solo. */
  declarar(fecha: string, grupoId?: string): Promise<readonly Declaracion[]>

  /** Fotografia ese grupo con la fecha de hoy, luego de completar las
   * declaraciones ordinarias pendientes. */
  declararExtraordinaria(grupoId: string): Promise<Declaracion>

  /** La nomina de esa declaracion, ordenada por apellido. */
  listarAfiliados(declaracionId: string): Promise<readonly Afiliado[]>

  /** Las declaraciones, de la mas reciente a la mas vieja. Con grupo limita
   * la consulta a su cuenta. */
  listarDeclaraciones(grupoId?: string): Promise<readonly Declaracion[]>

  /** Los miembros de la nomina que no aparecieron antes en el mismo periodo. */
  listarACobrar(declaracionId: string): Promise<readonly Afiliado[]>

  /** El subconjunto que ya tiene afiliacion en ese periodo. */
  afiliadosEn(periodo: number, personaIds: readonly string[]): Promise<ReadonlySet<string>>

  /** Declara las fechas ordinarias vencidas que cada grupo aun no emitio. */
  declararPendientes(): Promise<readonly Declaracion[]>
}

/** Compone los casos de uso y consultas del modulo. Las dependencias llegan ya
 * construidas por la raiz, no por el contexto de un request. */
export function crearServicioDeAfiliacion(
  core: Core,
  personas: Personas,
  estructura: Estructura,
): ServicioDeAfiliacion {
  return {
    ...crearOperacionesDeDeclaracion(core, personas, estructura),
    ...crearConsultasDeAfiliacion(core),
  }
}
