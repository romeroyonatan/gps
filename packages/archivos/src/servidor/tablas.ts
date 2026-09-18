import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { TipoAdmitido } from '../dominio/archivos'

// Se esparce en cada tabla en vez de abstraerse: Drizzle necesita las columnas
// declaradas literalmente para poder inferir los tipos de las filas.
const marcas = {
  creadoEn: integer('creado_en', { mode: 'timestamp_ms' }).notNull(),
  actualizadoEn: integer('actualizado_en', { mode: 'timestamp_ms' }).notNull(),
}

/** El registro de los archivos. Los bytes no estan aca: van a Almacenamiento,
 *  porque una foto de un permiso son varios megabytes y adentro de SQLite
 *  inflan los backups y arruinan la replicacion (spec base §9.1).
 *
 *  `modulo` y `recurso_id` van sin foreign key: apuntan a tablas de otros
 *  modulos, que son privadas. Es la misma perdida consciente que grupo_id en
 *  pertenencias, y aca ademas es inevitable: apuntan a tablas distintas segun
 *  el modulo. */
export const archivos = sqliteTable('archivos', {
  id: text('id').primaryKey(),
  nombre: text('nombre').notNull(),
  tipo: text('tipo').$type<TipoAdmitido>().notNull(),
  tamano: integer('tamano').notNull(),
  sha256: text('sha256').notNull(),
  modulo: text('modulo').notNull(),
  recursoId: text('recurso_id').notNull(),
  // Entero y no boolean: SQLite no tiene boolean, y Drizzle lo mapea con
  // { mode: 'boolean' }.
  confirmado: integer('confirmado', { mode: 'boolean' }).notNull(),
  ...marcas,
})
