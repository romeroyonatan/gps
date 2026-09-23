import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const eventosDeAuditoria = sqliteTable(
  'eventos_de_auditoria',
  {
    id: text('id').primaryKey(),
    ocurridoEn: integer('ocurrido_en', { mode: 'timestamp_ms' }).notNull(),
    actorPersonaId: text('actor_persona_id'),
    origenInterno: text('origen_interno'),
    modulo: text('modulo').notNull(),
    accion: text('accion').notNull(),
    resultado: text('resultado', { enum: ['exitoso', 'rechazado'] }).notNull(),
    elevado: integer('elevado', { mode: 'boolean' }).notNull(),
    grupoId: text('grupo_id'),
    entidadTipo: text('entidad_tipo'),
    entidadId: text('entidad_id'),
    objetivoPersonaId: text('objetivo_persona_id'),
    resumen: text('resumen').notNull(),
    cambios: text('cambios').notNull(),
  },
  (tabla) => [
    index('auditoria_por_fecha').on(tabla.ocurridoEn, tabla.id),
    index('auditoria_por_grupo').on(tabla.grupoId, tabla.ocurridoEn),
    index('auditoria_por_actor').on(tabla.actorPersonaId, tabla.ocurridoEn),
    index('auditoria_por_accion').on(tabla.modulo, tabla.accion, tabla.ocurridoEn),
  ],
)
