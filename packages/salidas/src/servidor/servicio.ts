import type { Archivos } from '@gps/archivos/dominio'
import type { Core } from '@gps/core'
import type { Estructura } from '@gps/estructura/dominio'
import type { Personas, TipoDeCargo } from '@gps/personas/dominio'
import type {
  Adjunto,
  Aviso,
  Firma,
  Participante,
  ParticipanteEmitido,
  Permiso,
} from '../dominio/modelos'
import type { Trazos } from '../dominio/trazos'
import { crearOperacionesDeBorrador, type DatosDelPermiso } from './borradores'
import { crearConsultasDeSalidas } from './consultas'
import { crearOperacionesDeEmision } from './emision'
import { crearOperacionesDeFirma, type EstadoDeFirma } from './firmas'
import { armarPdfDelPermiso } from './pdf-del-permiso'

export { PermisoInvalido, PermisoNoEditable } from './borradores'
export { FirmaInvalida } from './firmas'

export interface ServicioDeSalidas {
  crearPermiso(grupoId: string, datos: DatosDelPermiso): Promise<Permiso>
  editarPermiso(permisoId: string, datos: DatosDelPermiso): Promise<Permiso>
  elegirUnidades(permisoId: string, unidadIds: readonly string[]): Promise<void>
  unidadesElegidas(permisoId: string): readonly string[]
  agregarParticipante(permisoId: string, personaId: string): Promise<void>
  quitarParticipante(permisoId: string, personaId: string): Promise<void>

  emitir(permisoId: string): Promise<{ permiso: Permiso; avisos: readonly Aviso[] }>
  anular(permisoId: string): Promise<Permiso>
  reEmitir(permisoId: string): Promise<Permiso>
  adjuntar(permisoId: string, archivoId: string): Promise<void>
  quitarAdjunto(permisoId: string, adjuntoId: string): Promise<void>

  estadoDeLasFirmas(permisoId: string): Promise<readonly EstadoDeFirma[]>
  firmarEnApp(permisoId: string, cargo: TipoDeCargo, trazos: Trazos): Promise<Firma>
  firmarEnPapel(
    permisoId: string,
    cargos: readonly TipoDeCargo[],
    escaneoId: string,
  ): Promise<readonly Firma[]>

  /** El PDF en su estado actual: con las firmas de la app estampadas, la marca
   *  de las de papel, y los escaneos como anexo. Sirve tanto para imprimir y
   *  firmar como para quedarse con el firmado. */
  pdfDelPermiso(permisoId: string): Promise<Uint8Array>

  listarPermisos(grupoId: string): Promise<readonly Permiso[]>
  obtenerPermiso(permisoId: string): Promise<Permiso | null>
  listarParticipantes(permisoId: string): Promise<readonly Participante[]>
  listarParticipantesEmitidos(permisoId: string): Promise<readonly ParticipanteEmitido[]>
  listarAdjuntos(permisoId: string): Promise<readonly Adjunto[]>

  /** Si este pedido puede ver los archivos de ese permiso. Lo llama `archivos`
   *  antes de entregar bytes: este modulo es el dueño y por eso decide.
   *
   *  Hoy autoriza todo porque no hay auth y no hay a quien preguntarle. La
   *  firma ya recibe el actor para no tener que cambiarla despues. */
  puedeVerArchivosDe(permisoId: string, actor: unknown): Promise<boolean>
}

/** Compone las operaciones y consultas del modulo. Las dependencias llegan ya
 *  construidas por la raiz, no por el contexto de un request. */
export function crearServicioDeSalidas(
  core: Core,
  personas: Personas,
  estructura: Estructura,
  archivos: Archivos,
): ServicioDeSalidas {
  const borradores = crearOperacionesDeBorrador(core, personas, estructura)
  const emision = crearOperacionesDeEmision(core, personas, estructura, archivos, borradores)
  const firmas = crearOperacionesDeFirma(core, personas, estructura, archivos, borradores)
  const consultas = crearConsultasDeSalidas(core)

  return {
    crearPermiso: borradores.crearPermiso,
    editarPermiso: borradores.editarPermiso,
    elegirUnidades: borradores.elegirUnidades,
    unidadesElegidas: borradores.unidadesElegidas,
    agregarParticipante: borradores.agregarParticipante,
    quitarParticipante: borradores.quitarParticipante,
    ...emision,
    ...firmas,
    ...consultas,

    pdfDelPermiso: (permisoId) =>
      armarPdfDelPermiso(estructura, archivos, borradores, firmas, consultas, permisoId),

    async puedeVerArchivosDe(_permisoId, _actor) {
      return true
    },
  }
}
