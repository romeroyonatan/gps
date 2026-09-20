import type { Alcance, Core } from '@gps/core'
import type { Estructura } from '@gps/estructura/dominio'
import type { Personas } from '@gps/personas/dominio'
import type { Afiliado, Declaracion } from '../dominio/modelos'
import type { Afiliacion } from '../dominio/publico'
import { crearConsultasDeAfiliacion } from './consultas'
import { crearOperacionesDeDeclaracion } from './declaraciones'
import { crearConsultasDeLaNomina } from './nomina'

export {
  DeclaracionDenegada,
  FechaInvalida,
  NadaQueDeclarar,
  YaDeclaroHoy,
} from './declaraciones'
export { GrupoInexistente, NominaFueraDeAlcance } from './nomina'

export interface ServicioDeAfiliacion extends Afiliacion {
  /** Fotografia a los miembros activos del dia `fecha`. Sin `grupoId` declara
   * todos los grupos abiertos; con `grupoId`, ese solo. */
  declarar(fecha: string, grupoId?: string): Promise<readonly Declaracion[]>

  /** Fotografia ese grupo con la fecha de hoy, luego de completar las
   * declaraciones ordinarias pendientes. */
  declararExtraordinaria(alcance: Alcance, grupoId: string): Promise<Declaracion>

  /** La nomina de esa declaracion, ordenada por apellido. */
  listarAfiliados(declaracionId: string): Promise<readonly Afiliado[]>

  /** Las declaraciones, de la mas reciente a la mas vieja. Con grupo limita
   * la consulta a su cuenta. */
  listarDeclaraciones(grupoId?: string): Promise<readonly Declaracion[]>

  /** Lo mismo, pero iniciado por un usuario: filtra por su alcance. */
  listarDeclaracionesDelGrupo(alcance: Alcance, grupoId: string): Promise<readonly Declaracion[]>

  /** Los miembros de la nomina que no aparecieron antes en el mismo periodo. */
  listarACobrar(declaracionId: string): Promise<readonly Afiliado[]>

  /** El subconjunto que ya tiene afiliacion en ese periodo. */
  afiliadosEn(
    alcance: Alcance,
    periodo: number,
    personaIds: readonly string[],
  ): Promise<ReadonlySet<string>>

  /** Declara las fechas ordinarias vencidas que cada grupo aun no emitio. */
  declararPendientes(): Promise<readonly Declaracion[]>

  /** El padron de hoy del grupo, con su afiliacion del periodo, para bajar. Son
   * dos usos del mismo documento: el PDF se presenta en el distrito y la
   * planilla se trabaja en una hoja de calculo. */
  pdfDeLaNomina(
    alcance: Alcance,
    grupoId: string,
  ): Promise<{ nombre: string; contenido: Uint8Array }>
  xlsxDeLaNomina(
    alcance: Alcance,
    grupoId: string,
  ): Promise<{ nombre: string; contenido: Uint8Array }>
}

/** Compone los casos de uso y consultas del modulo. Las dependencias llegan ya
 * construidas por la raiz, no por el contexto de un request. */
export function crearServicioDeAfiliacion(
  core: Core,
  personas: Personas,
  estructura: Estructura,
): ServicioDeAfiliacion {
  const consultas = crearConsultasDeAfiliacion(core)
  return {
    ...crearOperacionesDeDeclaracion(core, personas, estructura),
    ...consultas,
    ...crearConsultasDeLaNomina(core, personas, estructura, consultas.afiliadosEn),
  }
}
