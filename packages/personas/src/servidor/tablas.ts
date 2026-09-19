import { sql } from 'drizzle-orm'
import { check, integer, sqliteTable, text, unique, uniqueIndex } from 'drizzle-orm/sqlite-core'
import type { TipoDeCargo } from '../dominio/cargos'
import type { Categoria } from '../dominio/categorias'
import type { TipoDeDocumento } from '../dominio/documentos'
import type { TipoDeEquipo } from '../dominio/equipos'

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

/** La pertenencia de una persona a un grupo, con su periodo.
 *
 *  `grupo_id` y `unidad_id` van sin foreign key: las tablas `grupos` y
 *  `unidades` son de estructura y declararlas exigiria importar su tablas.ts,
 *  que es privado. La integridad la da obtenerGrupo en el alta. Es una perdida
 *  real y consciente; ver §7.4 de la spec. Contra `personas`, en cambio, la
 *  foreign key va: es del mismo modulo.
 *
 *  La rama no se guarda: sale de la unidad. Guardar las dos seria un dato
 *  duplicado que puede contradecirse. `unidad_id` es null en los adherentes,
 *  que no pertenecen a ninguna.
 *
 *  El indice parcial es "una persona pertenece a un solo grupo" puesto en la
 *  base. Funciona porque una pertenencia no tiene mandato: su `hasta` se
 *  escribe el dia de la baja y nunca esta en el futuro, asi que `hasta IS NULL`
 *  y "vigente" son lo mismo. Y sigue permitiendo todas las pertenencias
 *  cerradas que haga falta, que es el historial. */
export const pertenencias = sqliteTable(
  'pertenencias',
  {
    id: text('id').primaryKey(),
    personaId: text('persona_id')
      .notNull()
      .references(() => personas.id),
    grupoId: text('grupo_id').notNull(),
    categoria: text('categoria').$type<Categoria>().notNull(),
    unidadId: text('unidad_id'),
    desde: text('desde').notNull(),
    hasta: text('hasta'),
    ...marcas,
  },
  (tabla) => [
    uniqueIndex('pertenencia_vigente_por_persona').on(tabla.personaId).where(sql`hasta is null`),
  ],
)

/** Los cargos de una persona, con su ambito y su periodo.
 *
 *  A diferencia de `pertenencias`, el UNIQUE es completo y no parcial: un cargo
 *  puede nacer con su `hasta` puesto cuatro anios adelante -un mandato-, asi
 *  que `WHERE hasta IS NULL` no seleccionaria los vigentes y un indice parcial
 *  no impediria nada. Lo que este ataja es el duplicado exacto, que es el
 *  error que de verdad ocurre: el doble click en Guardar. */
export const cargos = sqliteTable(
  'cargos',
  {
    id: text('id').primaryKey(),
    personaId: text('persona_id')
      .notNull()
      .references(() => personas.id),
    /** El grupo, el distrito, o NULL para los de la diocesis, que no es una
     *  entidad. Cual de los tres es lo dice el catalogo a partir de `cargo`, no
     *  una columna: guardarlo tambien seria un dato que puede contradecir al
     *  catalogo. Sin foreign key por la misma razon que grupo_id en
     *  pertenencias: las dos tablas son de estructura. */
    ambitoId: text('ambito_id'),
    cargo: text('cargo').$type<TipoDeCargo>().notNull(),
    desde: text('desde').notNull(),
    hasta: text('hasta'),
    revocadoEn: integer('revocado_en', { mode: 'timestamp_ms' }),
    ...marcas,
  },
  // SQLite trata dos NULL como distintos en un UNIQUE, asi que esto no ataja el
  // duplicado exacto de un cargo diocesano -ambito_id es NULL-: eso lo valida
  // el servicio.
  (tabla) => [unique().on(tabla.personaId, tabla.ambitoId, tabla.cargo, tabla.desde)],
)

export const equipos = sqliteTable(
  'equipos',
  {
    id: text('id').primaryKey(),
    tipo: text('tipo').$type<TipoDeEquipo>().notNull(),
    ambitoTipo: text('ambito_tipo').$type<'grupo' | 'diocesis'>().notNull(),
    ambitoId: text('ambito_id'),
    ...marcas,
  },
  (tabla) => [
    check(
      'equipo_ambito_valido',
      sql`(${tabla.ambitoTipo} = 'grupo' AND ${tabla.ambitoId} IS NOT NULL) OR (${tabla.ambitoTipo} = 'diocesis' AND ${tabla.ambitoId} IS NULL)`,
    ),
    uniqueIndex('equipo_de_grupo_unico')
      .on(tabla.tipo, tabla.ambitoId)
      .where(sql`${tabla.ambitoTipo} = 'grupo'`),
    uniqueIndex('equipo_diocesano_unico')
      .on(tabla.tipo)
      .where(sql`${tabla.ambitoTipo} = 'diocesis'`),
  ],
)

/** Auditoría de cambios de autoridad: quién, sobre quién, en qué ámbito y
 *  cuándo. Se escribe en la misma transacción que el cambio: una escritura
 *  fallida no deja auditoría huérfana. */
export const eventosDeAutoridad = sqliteTable('eventos_de_autoridad', {
  id: text('id').primaryKey(),
  tipo: text('tipo').notNull(),
  actorPersonaId: text('actor_persona_id').notNull(),
  objetivoPersonaId: text('objetivo_persona_id').notNull(),
  ambitoTipo: text('ambito_tipo').notNull(),
  ambitoId: text('ambito_id'),
  creadoEn: integer('creado_en', { mode: 'timestamp_ms' }).notNull(),
})

export const integrantesDeEquipo = sqliteTable(
  'integrantes_de_equipo',
  {
    id: text('id').primaryKey(),
    equipoId: text('equipo_id')
      .notNull()
      .references(() => equipos.id),
    personaId: text('persona_id')
      .notNull()
      .references(() => personas.id),
    desde: text('desde').notNull(),
    hasta: text('hasta'),
    revocadoEn: integer('revocado_en', { mode: 'timestamp_ms' }),
    ...marcas,
  },
  (tabla) => [unique().on(tabla.equipoId, tabla.personaId, tabla.desde)],
)
