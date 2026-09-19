import type { Core } from '@gps/core'
import { and, desc, eq, inArray, lt } from 'drizzle-orm'
import type { Afiliado } from '../dominio/modelos'
import { afiliados, declaraciones } from './tablas'

/** SQLite compara bytes; Intl mantiene el mismo orden alfabetico en español
 * que las otras nominas del sistema. */
const alfabeto = new Intl.Collator('es')

export function crearConsultasDeAfiliacion(core: Core) {
  async function listarAfiliados(declaracionId: string): Promise<readonly Afiliado[]> {
    return core.bd
      .select()
      .from(afiliados)
      .where(eq(afiliados.declaracionId, declaracionId))
      .all()
      .sort(
        (uno, otro) =>
          alfabeto.compare(uno.apellidos, otro.apellidos) ||
          alfabeto.compare(uno.nombres, otro.nombres),
      )
  }

  return {
    listarAfiliados,

    async listarDeclaraciones(grupoId?: string) {
      if (grupoId === undefined) {
        return core.bd.select().from(declaraciones).orderBy(desc(declaraciones.fecha)).all()
      }
      return core.bd
        .select()
        .from(declaraciones)
        .where(eq(declaraciones.grupoId, grupoId))
        .orderBy(desc(declaraciones.fecha))
        .all()
    },

    async listarACobrar(declaracionId: string): Promise<readonly Afiliado[]> {
      const declaracion = core.bd
        .select({ fecha: declaraciones.fecha, periodo: declaraciones.periodo })
        .from(declaraciones)
        .where(eq(declaraciones.id, declaracionId))
        .get()
      if (!declaracion) return []

      // No se filtra por grupo: la afiliacion es de la persona con la
      // asociacion. Si se mudo, su grupo nuevo no vuelve a pagar por ella.
      const previas = core.bd
        .select({ personaId: afiliados.personaId })
        .from(afiliados)
        .innerJoin(declaraciones, eq(declaraciones.id, afiliados.declaracionId))
        .where(
          and(
            eq(declaraciones.periodo, declaracion.periodo),
            lt(declaraciones.fecha, declaracion.fecha),
          ),
        )
        .all()

      const cubiertos = new Set(previas.map((fila) => fila.personaId))
      return (await listarAfiliados(declaracionId)).filter(
        (afiliado) => !cubiertos.has(afiliado.personaId),
      )
    },

    async afiliadosEn(
      periodo: number,
      personaIds: readonly string[],
    ): Promise<ReadonlySet<string>> {
      if (personaIds.length === 0) return new Set<string>()

      const filas = core.bd
        .select({ personaId: afiliados.personaId })
        .from(afiliados)
        .innerJoin(declaraciones, eq(declaraciones.id, afiliados.declaracionId))
        .where(
          and(eq(declaraciones.periodo, periodo), inArray(afiliados.personaId, [...personaIds])),
        )
        .all()

      return new Set(filas.map((fila) => fila.personaId))
    },
  }
}
