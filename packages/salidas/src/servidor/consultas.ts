import type { Core } from '@gps/core'
import { desc, eq } from 'drizzle-orm'
import type { Adjunto, Participante, ParticipanteEmitido, Permiso } from '../dominio/modelos'
import { adjuntos, participantes, participantesEmitidos, permisos } from './tablas'

export function crearConsultasDeSalidas(core: Core) {
  return {
    /** Los del grupo, del mas proximo al mas viejo por fecha de salida. Es el
     *  orden en que se los busca: lo que viene primero es lo que se esta
     *  organizando. */
    async listarPermisos(grupoId: string): Promise<readonly Permiso[]> {
      return core.bd
        .select()
        .from(permisos)
        .where(eq(permisos.grupoId, grupoId))
        .orderBy(desc(permisos.desde))
        .all()
    },

    async obtenerPermiso(permisoId: string): Promise<Permiso | null> {
      return core.bd.select().from(permisos).where(eq(permisos.id, permisoId)).get() ?? null
    },

    /** Los elegidos, mientras es borrador. */
    async listarParticipantes(permisoId: string): Promise<readonly Participante[]> {
      return core.bd
        .select()
        .from(participantes)
        .where(eq(participantes.permisoId, permisoId))
        .all()
    },

    /** La fotografia: quienes figuran en el papel. Vacia mientras sea borrador. */
    async listarParticipantesEmitidos(permisoId: string): Promise<readonly ParticipanteEmitido[]> {
      return core.bd
        .select()
        .from(participantesEmitidos)
        .where(eq(participantesEmitidos.permisoId, permisoId))
        .all()
    },

    async listarAdjuntos(permisoId: string): Promise<readonly Adjunto[]> {
      return core.bd.select().from(adjuntos).where(eq(adjuntos.permisoId, permisoId)).all()
    },
  }
}
