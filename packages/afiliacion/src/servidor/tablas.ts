import type { TipoDeDocumento } from '@gps/personas/dominio'
import { index, integer, primaryKey, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'

// Se esparce en cada tabla en vez de abstraerse en core: Drizzle necesita las
// columnas declaradas literalmente para poder inferir los tipos de las filas.
const marcas = {
  creadoEn: integer('creado_en', { mode: 'timestamp_ms' }).notNull(),
  actualizadoEn: integer('actualizado_en', { mode: 'timestamp_ms' }).notNull(),
}

/** La nomina que un grupo presenta en una fecha.
 *
 *  `grupo_id` va sin foreign key: la tabla `grupos` es de estructura y
 *  declararla exigiria importar su tablas.ts, que es privado. La integridad la
 *  da gruposAbiertosEn al declarar. Es la misma perdida consciente que en
 *  pertenencias; ver §7.4 de la spec de pertenencia.
 *
 *  El UNIQUE sobre (fecha, grupo_id) es la red por debajo de la idempotencia
 *  del barrido: en el camino normal quien la hace cumplir es `declarar`, que
 *  saltea los grupos que ya tienen declaracion con esa fecha -si dejara que
 *  avisara el UNIQUE, la insercion de un grupo tumbaria la transaccion de los
 *  otros catorce-. Entre los dos, quien llama al barrido y cuando deja de ser
 *  una decision delicada.
 *
 *  El indice por periodo es para el anti-join de "a cobrar" y para
 *  afiliadosEn, que preguntan siempre por un periodo. */
export const declaraciones = sqliteTable(
  'declaraciones',
  {
    id: text('id').primaryKey(),
    grupoId: text('grupo_id').notNull(),
    fecha: text('fecha').notNull(),
    periodo: integer('periodo').notNull(),
    ...marcas,
  },
  (tabla) => [
    unique().on(tabla.fecha, tabla.grupoId),
    index('declaracion_por_periodo').on(tabla.periodo),
  ],
)

/** Las filas de una nomina, congeladas: como estaba cada persona ese dia.
 *
 *  Contra `declaraciones` la foreign key si va -es del mismo modulo-; contra
 *  `personas` no, por lo mismo que grupo_id.
 *
 *  Sin id ni marcas: la declaracion ya tiene su creadoEn, y el par
 *  (declaracion, persona) es la clave natural y la primaria.
 *
 *  El indice por persona_id es para afiliadosEn, la unica lectura que no entra
 *  por declaracion_id y la que corre en cada carga de la lista de un grupo. */
export const afiliados = sqliteTable(
  'afiliados',
  {
    declaracionId: text('declaracion_id')
      .notNull()
      .references(() => declaraciones.id),
    personaId: text('persona_id').notNull(),
    tipoDeDocumento: text('tipo_de_documento').$type<TipoDeDocumento>().notNull(),
    numeroDeDocumento: text('numero_de_documento').notNull(),
    nombres: text('nombres').notNull(),
    apellidos: text('apellidos').notNull(),
  },
  (tabla) => [
    primaryKey({ columns: [tabla.declaracionId, tabla.personaId] }),
    index('afiliado_por_persona').on(tabla.personaId),
  ],
)
