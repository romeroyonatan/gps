import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { Rama } from '../dominio/ramas'

// Se esparce en cada tabla en vez de abstraerse: Drizzle necesita las columnas
// declaradas literalmente para poder inferir los tipos de las filas.
const marcas = {
  creadoEn: integer('creado_en', { mode: 'timestamp_ms' }).notNull(),
  actualizadoEn: integer('actualizado_en', { mode: 'timestamp_ms' }).notNull(),
}

// El numero es la clave natural: identifica al distrito para la asociacion.
// Va como UNIQUE y no como primaria, porque las claves naturales cambian -un
// distrito se renumera al partirse- y eso arrastraria cada foreign key.
export const distritos = sqliteTable('distritos', {
  id: text('id').primaryKey(),
  numero: integer('numero').notNull().unique(),
  zona: text('zona').notNull(),
  cerradoEn: integer('cerrado_en', { mode: 'timestamp_ms' }),
  ...marcas,
})

/** El numero de grupo es unico en toda la diocesis, no dentro del distrito:
 *  identifica al grupo por si solo. Si un grupo cerrado alguna vez reusa su
 *  numero, la salida es marcarlo cerrado e indice parcial, no sacar el UNIQUE. */
export const grupos = sqliteTable('grupos', {
  id: text('id').primaryKey(),
  numero: integer('numero').notNull().unique(),
  nombre: text('nombre').notNull(),
  distritoId: text('distrito_id')
    .notNull()
    .references(() => distritos.id),
  cerradoEn: integer('cerrado_en', { mode: 'timestamp_ms' }),
  ...marcas,
})

/** Que ramas tiene abiertas cada grupo. La clave primaria compuesta es lo que
 *  hace que abrir dos veces la misma rama sea un error de la base y no una
 *  regla que haya que acordarse de escribir. No lleva `actualizadoEn`: sus
 *  dos columnas son la clave, asi que la fila no se puede modificar. */
export const ramasDelGrupo = sqliteTable(
  'ramas_del_grupo',
  {
    grupoId: text('grupo_id')
      .notNull()
      .references(() => grupos.id),
    rama: text('rama').$type<Rama>().notNull(),
    creadoEn: integer('creado_en', { mode: 'timestamp_ms' }).notNull(),
  },
  (tabla) => [primaryKey({ columns: [tabla.grupoId, tabla.rama] })],
)
