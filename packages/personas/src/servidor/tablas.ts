import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import type { TipoDeDocumento } from '../dominio/documentos'

// Se esparce en cada tabla en vez de abstraerse en core: Drizzle necesita las
// columnas declaradas literalmente para poder inferir los tipos de las filas, y
// ademas como se guardan las marcas es decision de cada modulo. El tipo Marcas
// si vive en core: es la forma del dato, que cruza hasta las pantallas.
const marcas = {
  creadoEn: integer('creado_en', { mode: 'timestamp_ms' }).notNull(),
  actualizadoEn: integer('actualizado_en', { mode: 'timestamp_ms' }).notNull(),
}

/** Las personas de la asociacion.
 *
 *  El par (tipo, numero) es la clave natural: identifica a la persona para la
 *  asociacion. Va como UNIQUE y no como primaria porque las claves naturales se
 *  corrigen -un DNI mal tipeado- y eso arrastraria cada foreign key que apunte a
 *  la persona, que en la iteracion de pertenencia van a ser varias.
 *
 *  El UNIQUE es sobre el par y no sobre el numero solo: un DNI y un pasaporte
 *  pueden coincidir en el numero, son espacios de numeracion distintos. Lo que
 *  hace que el indice sirva es que el numero se guarda normalizado; ver
 *  normalizarNumero en dominio/documentos.ts.
 *
 *  fecha_de_nacimiento es TEXT con formato aaaa-mm-dd y no un timestamp: ver el
 *  comentario en dominio/modelos.ts. */
export const personas = sqliteTable(
  'personas',
  {
    id: text('id').primaryKey(),
    tipoDeDocumento: text('tipo_de_documento').$type<TipoDeDocumento>().notNull(),
    numeroDeDocumento: text('numero_de_documento').notNull(),
    nombres: text('nombres').notNull(),
    apellidos: text('apellidos').notNull(),
    fechaDeNacimiento: text('fecha_de_nacimiento').notNull(),
    ...marcas,
  },
  (tabla) => [unique().on(tabla.tipoDeDocumento, tabla.numeroDeDocumento)],
)
