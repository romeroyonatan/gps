import { sql } from 'drizzle-orm'
import { check, integer, sqliteTable, text, unique, uniqueIndex } from 'drizzle-orm/sqlite-core'
import type { ProveedorDeIdentidad } from '../dominio/modelos'

const marcas = {
  creadoEn: integer('creado_en', { mode: 'timestamp_ms' }).notNull(),
  actualizadoEn: integer('actualizado_en', { mode: 'timestamp_ms' }).notNull(),
}

export const identidadesExternas = sqliteTable(
  'identidades_externas',
  {
    id: text('id').primaryKey(),
    personaId: text('persona_id').notNull(),
    proveedor: text('proveedor').$type<ProveedorDeIdentidad>().notNull(),
    subject: text('subject').notNull(),
    desactivadaEn: integer('desactivada_en', { mode: 'timestamp_ms' }),
    ...marcas,
  },
  (tabla) => [unique().on(tabla.proveedor, tabla.subject)],
)

export const sesiones = sqliteTable(
  'sesiones',
  {
    id: text('id').primaryKey(),
    personaId: text('persona_id').notNull(),
    identidadId: text('identidad_id')
      .notNull()
      .references(() => identidadesExternas.id),
    hashDelSecreto: text('hash_del_secreto').notNull(),
    expiraEn: integer('expira_en', { mode: 'timestamp_ms' }).notNull(),
    revocadaEn: integer('revocada_en', { mode: 'timestamp_ms' }),
    elevadaHasta: integer('elevada_hasta', { mode: 'timestamp_ms' }),
    ...marcas,
  },
  (tabla) => [uniqueIndex('sesiones_hash_del_secreto_unique').on(tabla.hashDelSecreto)],
)

export const invitaciones = sqliteTable(
  'invitaciones',
  {
    id: text('id').primaryKey(),
    tipo: text('tipo').$type<'activacion' | 'recuperacion'>().notNull(),
    personaId: text('persona_id').notNull(),
    proveedorAReemplazar: text('proveedor_a_reemplazar').$type<ProveedorDeIdentidad>(),
    hashDelSecreto: text('hash_del_secreto').notNull(),
    emitidaPor: text('emitida_por').notNull(),
    expiraEn: integer('expira_en', { mode: 'timestamp_ms' }).notNull(),
    consumidaEn: integer('consumida_en', { mode: 'timestamp_ms' }),
    revocadaEn: integer('revocada_en', { mode: 'timestamp_ms' }),
    ...marcas,
  },
  (tabla) => [
    unique().on(tabla.hashDelSecreto),
    check(
      'invitacion_proveedor_valido',
      sql`(${tabla.tipo} = 'activacion' AND ${tabla.proveedorAReemplazar} IS NULL) OR (${tabla.tipo} = 'recuperacion' AND ${tabla.proveedorAReemplazar} IS NOT NULL)`,
    ),
  ],
)

export const administradorDelSistema = sqliteTable(
  'administrador_del_sistema',
  {
    singleton: integer('singleton').primaryKey(),
    personaId: text('persona_id').notNull(),
    ...marcas,
  },
  (tabla) => [check('administrador_fila_unica', sql`${tabla.singleton} = 1`)],
)

export const eventosDeSeguridad = sqliteTable('eventos_de_seguridad', {
  id: text('id').primaryKey(),
  tipo: text('tipo').notNull(),
  actorPersonaId: text('actor_persona_id'),
  objetivoPersonaId: text('objetivo_persona_id'),
  detalles: text('detalles').notNull(),
  creadoEn: integer('creado_en', { mode: 'timestamp_ms' }).notNull(),
})
