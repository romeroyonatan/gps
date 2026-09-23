import type { TipoDeCargo, TipoDeDocumento } from '@gps/personas/dominio'
import { integer, primaryKey, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import type { Estado, Marca, ModoDeFirma } from '../dominio/modelos'

// Se esparce en cada tabla en vez de abstraerse: Drizzle necesita las columnas
// declaradas literalmente para poder inferir los tipos de las filas.
const marcas = {
  creadoEn: integer('creado_en', { mode: 'timestamp_ms' }).notNull(),
  actualizadoEn: integer('actualizado_en', { mode: 'timestamp_ms' }).notNull(),
}

/** El permiso. `grupo_id`, `pdf_id` y `reemplaza_a` van sin foreign key contra
 *  otros modulos por la misma razon que en pertenencias: sus tablas son
 *  privadas. `reemplaza_a` si podria tenerla -es de este modulo- pero apunta a
 *  la misma tabla y SQLite no lo necesita para nada que el servicio no valide. */
export const permisos = sqliteTable(
  'permisos',
  {
    id: text('id').primaryKey(),
    grupoId: text('grupo_id').notNull(),
    estado: text('estado').$type<Estado>().notNull(),
    lugar: text('lugar').notNull(),
    direccion: text('direccion').notNull(),
    localidad: text('localidad').notNull(),
    provincia: text('provincia').notNull(),
    desde: text('desde').notNull(),
    hasta: text('hasta').notNull(),
    comoSeViaja: text('como_se_viaja'),
    responsableId: text('responsable_id'),
    telefono: text('telefono').notNull(),
    anioDeExpediente: integer('anio_de_expediente'),
    numeroDeExpediente: integer('numero_de_expediente'),
    pdfId: text('pdf_id'),
    hashDelPdf: text('hash_del_pdf'),
    hashDelContenido: text('hash_del_contenido'),
    reemplazaA: text('reemplaza_a'),
    ...marcas,
  },
  // Los numeros de expediente no se repiten, y un permiso anulado origina a
  // lo sumo un reemplazo. SQLite permite varios NULL en ambos UNIQUE.
  (tabla) => [
    unique().on(tabla.anioDeExpediente, tabla.numeroDeExpediente),
    unique().on(tabla.reemplazaA),
  ],
)

/** Que unidades del grupo van. La clave compuesta impide elegir dos veces la
 *  misma sin una regla aparte. */
export const unidadesDelPermiso = sqliteTable(
  'unidades_del_permiso',
  {
    permisoId: text('permiso_id')
      .notNull()
      .references(() => permisos.id),
    unidadId: text('unidad_id').notNull(),
    creadoEn: integer('creado_en', { mode: 'timestamp_ms' }).notNull(),
  },
  (tabla) => [primaryKey({ columns: [tabla.permisoId, tabla.unidadId] })],
)

/** Quien va, mientras es borrador. Sin marcas: sus dos columnas son la clave,
 *  asi que la fila no se modifica, se borra y se crea. */
export const participantes = sqliteTable(
  'participantes',
  {
    permisoId: text('permiso_id')
      .notNull()
      .references(() => permisos.id),
    personaId: text('persona_id').notNull(),
    marca: text('marca').$type<Marca>().notNull(),
    creadoEn: integer('creado_en', { mode: 'timestamp_ms' }).notNull(),
  },
  (tabla) => [primaryKey({ columns: [tabla.permisoId, tabla.personaId] })],
)

/** La fotografia de quienes fueron, tomada al emitir. Tabla aparte de
 *  `participantes` y no una columna mas: son dos hechos distintos -a quien
 *  elegi y quien figura en el papel firmado- y el segundo no cambia nunca. */
export const participantesEmitidos = sqliteTable(
  'participantes_emitidos',
  {
    permisoId: text('permiso_id')
      .notNull()
      .references(() => permisos.id),
    personaId: text('persona_id').notNull(),
    marca: text('marca').$type<Marca>().notNull(),
    tipoDeDocumento: text('tipo_de_documento').$type<TipoDeDocumento>().notNull(),
    numeroDeDocumento: text('numero_de_documento').notNull(),
    nombres: text('nombres').notNull(),
    apellidos: text('apellidos').notNull(),
    unidad: text('unidad').notNull(),
    creadoEn: integer('creado_en', { mode: 'timestamp_ms' }).notNull(),
  },
  (tabla) => [primaryKey({ columns: [tabla.permisoId, tabla.personaId] })],
)

/** Las firmas puestas. El UNIQUE por (permiso, cargo) es "cada cargo firma una
 *  sola vez", puesto en la base y no en una regla que haya que acordarse. */
export const firmas = sqliteTable(
  'firmas',
  {
    id: text('id').primaryKey(),
    permisoId: text('permiso_id')
      .notNull()
      .references(() => permisos.id),
    cargo: text('cargo').$type<TipoDeCargo>().notNull(),
    modo: text('modo').$type<ModoDeFirma>().notNull(),
    personaId: text('persona_id').notNull(),
    nombres: text('nombres').notNull(),
    apellidos: text('apellidos').notNull(),
    fecha: text('fecha').notNull(),
    trazos: text('trazos'),
    sello: text('sello'),
    claveDeSello: text('clave_de_sello'),
    escaneoId: text('escaneo_id'),
    ...marcas,
  },
  (tabla) => [unique().on(tabla.permisoId, tabla.cargo)],
)

/** Las planificaciones y demas. No entran en el PDF ni en el hash: se pueden
 *  sumar despues de firmado sin invalidar ninguna firma. */
export const adjuntos = sqliteTable(
  'adjuntos',
  {
    id: text('id').primaryKey(),
    permisoId: text('permiso_id')
      .notNull()
      .references(() => permisos.id),
    archivoId: text('archivo_id').notNull(),
    ...marcas,
  },
  (tabla) => [unique().on(tabla.permisoId, tabla.archivoId)],
)
