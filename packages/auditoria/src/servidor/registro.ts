import type {
  Bd,
  DatosDeAuditoria,
  EjecutorDeAuditoria,
  RegistroDeAuditoria,
  Reloj,
} from '@gps/core'
import { sql } from 'drizzle-orm'

/** La implementación vive con la tabla, pero llega a los demás módulos por
 * `Core`: ninguna frontera importa el `/servidor` de auditoría. */
export function crearRegistroDeAuditoria(
  bd: Bd,
  reloj: Reloj,
  nuevoId: (prefijo: string) => string,
): RegistroDeAuditoria {
  return {
    registrar(datos: DatosDeAuditoria, ejecutor: EjecutorDeAuditoria = bd): string {
      const id = nuevoId('evento_de_auditoria')
      ejecutor.run(sql`
        INSERT INTO eventos_de_auditoria (
          id, ocurrido_en, actor_persona_id, origen_interno, modulo, accion,
          resultado, elevado, grupo_id, entidad_tipo, entidad_id,
          objetivo_persona_id, resumen, cambios
        ) VALUES (
          ${id}, ${reloj.ahora().getTime()}, ${datos.actorPersonaId},
          ${datos.origenInterno ?? null}, ${datos.modulo}, ${datos.accion},
          ${datos.resultado ?? 'exitoso'}, ${datos.elevado ? 1 : 0},
          ${datos.grupoId ?? null}, ${datos.entidadTipo ?? null},
          ${datos.entidadId ?? null}, ${datos.objetivoPersonaId ?? null},
          ${JSON.stringify(datos.resumen ?? {})}, ${JSON.stringify(datos.cambios ?? [])}
        )
      `)
      return id
    },
  }
}
