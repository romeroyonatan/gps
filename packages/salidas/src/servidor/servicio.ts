import type { Archivos } from '@gps/archivos/dominio'
import type { Actor, Alcance, Core } from '@gps/core'
import type { Estructura } from '@gps/estructura/dominio'
import type { Personas, TipoDeCargo } from '@gps/personas/dominio'
import { firmantesRequeridos } from '../dominio/firmas'
import type {
  Adjunto,
  Aviso,
  Firma,
  Participante,
  ParticipanteEmitido,
  Permiso,
} from '../dominio/modelos'
import {
  puedeAdministrarPermisosDelGrupo,
  puedeFirmarEnLaApp,
  puedeVerPermisoDelGrupo,
} from '../dominio/politicas'
import type { Trazos } from '../dominio/trazos'
import { crearOperacionesDeBorrador, type DatosDelPermiso } from './borradores'
import { crearConsultasDeSalidas } from './consultas'
import { crearOperacionesDeEmision } from './emision'
import { crearOperacionesDeFirma, type EstadoDeFirma } from './firmas'
import { armarPdfDelPermiso } from './pdf-del-permiso'

/** El permiso no es del alcance de quien pide -o no existe, que se responde
 *  igual: un permiso ajeno no se distingue de uno inexistente-. */
export class PermisoFueraDeAlcance extends Error {
  constructor() {
    super('No tenés acceso a este permiso de salida.')
    this.name = 'PermisoFueraDeAlcance'
  }
}

export { PermisoInvalido, PermisoNoEditable } from './borradores'
export { FirmaInvalida } from './firmas'

export interface ServicioDeSalidas {
  crearPermiso(alcance: Alcance, grupoId: string, datos: DatosDelPermiso): Promise<Permiso>
  editarPermiso(alcance: Alcance, permisoId: string, datos: DatosDelPermiso): Promise<Permiso>
  elegirUnidades(alcance: Alcance, permisoId: string, unidadIds: readonly string[]): Promise<void>
  /** Sin alcance: es un campo del Permiso que ya se autorizo al leerlo. */
  unidadesElegidas(permisoId: string): readonly string[]
  agregarParticipante(alcance: Alcance, permisoId: string, personaId: string): Promise<void>
  quitarParticipante(alcance: Alcance, permisoId: string, personaId: string): Promise<void>
  /** Quien queda a cargo: uno de los dirigentes que van. */
  elegirResponsable(alcance: Alcance, permisoId: string, personaId: string): Promise<void>

  emitir(
    alcance: Alcance,
    permisoId: string,
  ): Promise<{ permiso: Permiso; avisos: readonly Aviso[] }>
  anular(alcance: Alcance, permisoId: string): Promise<Permiso>
  reEmitir(alcance: Alcance, permisoId: string): Promise<Permiso>
  adjuntar(alcance: Alcance, permisoId: string, archivoId: string): Promise<void>
  quitarAdjunto(alcance: Alcance, permisoId: string, adjuntoId: string): Promise<void>

  estadoDeLasFirmas(alcance: Alcance, permisoId: string): Promise<readonly EstadoDeFirma[]>
  /** Firma la persona que ocupa hoy el cargo, y nadie mas: no alcanza con
   *  administrar el permiso, ni con estar elevado. */
  firmarEnApp(
    alcance: Alcance,
    permisoId: string,
    cargo: TipoDeCargo,
    trazos: Trazos,
  ): Promise<Firma>
  firmarEnPapel(
    alcance: Alcance,
    permisoId: string,
    cargos: readonly TipoDeCargo[],
    escaneoId: string,
  ): Promise<readonly Firma[]>

  /** El PDF en su estado actual: con las firmas de la app estampadas, la marca
   *  de las de papel, y los escaneos como anexo. Sirve tanto para imprimir y
   *  firmar como para quedarse con el firmado. */
  pdfDelPermiso(alcance: Alcance, permisoId: string): Promise<Uint8Array>

  listarPermisos(alcance: Alcance, grupoId: string): Promise<readonly Permiso[]>
  obtenerPermiso(alcance: Alcance, permisoId: string): Promise<Permiso | null>
  listarParticipantes(alcance: Alcance, permisoId: string): Promise<readonly Participante[]>
  listarParticipantesEmitidos(
    alcance: Alcance,
    permisoId: string,
  ): Promise<readonly ParticipanteEmitido[]>
  listarAdjuntos(alcance: Alcance, permisoId: string): Promise<readonly Adjunto[]>

  /** Si este pedido puede ver los archivos de ese permiso. Lo llama `archivos`
   *  antes de entregar bytes: este modulo es el dueño y por eso decide. Es lo
   *  que hace que una URL de descarga no esquive el filtro de Salidas. */
  puedeVerArchivosDe(permisoId: string, alcance: Alcance | null): Promise<boolean>
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

  // Capa 2 en un solo lugar: toda operacion sobre un permiso empieza por
  // resolver de que grupo es y compararlo con el alcance. Las operaciones de
  // /borradores, /emision y /firmas no lo repiten porque no se llega a ellas
  // sin pasar por aca: son privadas del modulo.
  async function grupoDe(permisoId: string): Promise<string> {
    const permiso = await consultas.obtenerPermiso(permisoId)
    if (!permiso) throw new PermisoFueraDeAlcance()
    return permiso.grupoId
  }

  async function exigirAdministrar(alcance: Alcance, permisoId: string): Promise<void> {
    if (!puedeAdministrarPermisosDelGrupo(alcance.actor, await grupoDe(permisoId))) {
      throw new PermisoFueraDeAlcance()
    }
  }

  async function exigirVer(alcance: Alcance, permisoId: string): Promise<void> {
    if (!puedeVerPermisoDelGrupo(alcance, await grupoDe(permisoId))) {
      throw new PermisoFueraDeAlcance()
    }
  }

  const administrando =
    <A extends unknown[], R>(
      operacion: (actor: Actor, permisoId: string, ...args: A) => Promise<R>,
    ) =>
    async (alcance: Alcance, permisoId: string, ...args: A): Promise<R> => {
      await exigirAdministrar(alcance, permisoId)
      return operacion(alcance.actor, permisoId, ...args)
    }

  const leyendo =
    <A extends unknown[], R>(operacion: (permisoId: string, ...args: A) => Promise<R>) =>
    async (alcance: Alcance, permisoId: string, ...args: A): Promise<R> => {
      await exigirVer(alcance, permisoId)
      return operacion(permisoId, ...args)
    }

  return {
    async crearPermiso(alcance, grupoId, datos) {
      if (!puedeAdministrarPermisosDelGrupo(alcance.actor, grupoId)) {
        throw new PermisoFueraDeAlcance()
      }
      return borradores.crearPermiso(alcance.actor, grupoId, datos)
    },
    editarPermiso: administrando(borradores.editarPermiso),
    elegirUnidades: administrando(borradores.elegirUnidades),
    unidadesElegidas: borradores.unidadesElegidas,
    agregarParticipante: administrando(borradores.agregarParticipante),
    quitarParticipante: administrando(borradores.quitarParticipante),
    elegirResponsable: administrando(borradores.elegirResponsable),

    emitir: administrando(emision.emitir),
    anular: administrando(emision.anular),
    reEmitir: administrando(emision.reEmitir),
    adjuntar: administrando(emision.adjuntar),
    quitarAdjunto: administrando(emision.quitarAdjunto),

    estadoDeLasFirmas: leyendo(firmas.estadoDeLasFirmas),
    firmarEnPapel: administrando(firmas.firmarEnPapel),

    async firmarEnApp(alcance, permisoId, cargo, trazos) {
      await exigirVer(alcance, permisoId)
      const grupo = await estructura.obtenerGrupo(await grupoDe(permisoId))
      const requerido = grupo
        ? firmantesRequeridos(grupo.id, grupo.distritoId).find((uno) => uno.cargo === cargo)
        : undefined
      // Si el cargo ni siquiera firma permisos, lo rechaza el servicio con su
      // mensaje -no es un problema de permisos-; lo que se deniega aca es
      // firmar por un cargo que si firma y que quien pide no ocupa.
      if (requerido && !puedeFirmarEnLaApp(alcance.actor, requerido)) {
        throw new PermisoFueraDeAlcance()
      }
      return firmas.firmarEnApp(alcance.actor, permisoId, cargo, trazos)
    },

    async listarPermisos(alcance, grupoId) {
      if (!puedeVerPermisoDelGrupo(alcance, grupoId)) return []
      return consultas.listarPermisos(grupoId)
    },
    async obtenerPermiso(alcance, permisoId) {
      const permiso = await consultas.obtenerPermiso(permisoId)
      return permiso && puedeVerPermisoDelGrupo(alcance, permiso.grupoId) ? permiso : null
    },
    listarParticipantes: leyendo(consultas.listarParticipantes),
    listarParticipantesEmitidos: leyendo(consultas.listarParticipantesEmitidos),
    listarAdjuntos: leyendo(consultas.listarAdjuntos),

    pdfDelPermiso: leyendo((permisoId) =>
      armarPdfDelPermiso(core, estructura, archivos, borradores, firmas, consultas, permisoId),
    ),

    async puedeVerArchivosDe(permisoId, alcance) {
      if (!alcance) return false
      const permiso = await consultas.obtenerPermiso(permisoId)
      return permiso !== null && puedeVerPermisoDelGrupo(alcance, permiso.grupoId)
    },
  }
}
