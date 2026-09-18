import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import type { SexoDeUnidad } from '../dominio/modelos'
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

/** Las unidades de cada grupo: la Manada, las dos Tropas, el Clan. Reemplaza a
 *  `ramas_del_grupo`, cuya clave primaria (grupo, rama) hacia imposible que un
 *  grupo tuviera dos tropas scout.
 *
 *  El UNIQUE es parcial -solo entre las abiertas- por la misma razon que el de
 *  pertenencias: una unidad cerrada tiene que poder reabrirse con el mismo
 *  nombre, y un UNIQUE completo lo impediria para siempre. El sexo no entra en
 *  la clave: lo que distingue dos unidades de la misma rama es el nombre. */
export const unidades = sqliteTable(
  'unidades',
  {
    id: text('id').primaryKey(),
    grupoId: text('grupo_id')
      .notNull()
      .references(() => grupos.id),
    rama: text('rama').$type<Rama>().notNull(),
    sexo: text('sexo').$type<SexoDeUnidad>().notNull(),
    nombre: text('nombre').notNull(),
    cerradaEn: integer('cerrada_en', { mode: 'timestamp_ms' }),
    ...marcas,
  },
  (tabla) => [
    uniqueIndex('unidad_abierta_por_grupo_rama_nombre')
      .on(tabla.grupoId, tabla.rama, tabla.nombre)
      .where(sql`cerrada_en is null`),
  ],
)
