import { sql } from 'drizzle-orm'
import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import type { MedioDePago, TipoDeMovimiento } from '../dominio/modelos'

const marcas = {
  creadoEn: integer('creado_en', { mode: 'timestamp_ms' }).notNull(),
  actualizadoEn: integer('actualizado_en', { mode: 'timestamp_ms' }).notNull(),
}

export const cuotasDeAfiliacion = sqliteTable(
  'cuotas_de_afiliacion',
  {
    periodo: integer('periodo').primaryKey(),
    importe: integer('importe').notNull(),
    ...marcas,
  },
  (tabla) => [check('cuota_importe_positivo', sql`${tabla.importe} > 0`)],
)

export const movimientosDeTesoreria = sqliteTable(
  'movimientos_de_tesoreria',
  {
    id: text('id').primaryKey(),
    grupoId: text('grupo_id').notNull(),
    fecha: text('fecha').notNull(),
    tipo: text('tipo').$type<TipoDeMovimiento>().notNull(),
    importe: integer('importe').notNull(),
    periodo: integer('periodo'),
    declaracionId: text('declaracion_id'),
    cantidad: integer('cantidad'),
    cuota: integer('cuota'),
    medioDePago: text('medio_de_pago').$type<MedioDePago>(),
    referencia: text('referencia'),
    observacion: text('observacion'),
    anulaA: text('anula_a').references((): AnySQLiteColumn => movimientosDeTesoreria.id),
    ...marcas,
  },
  (tabla) => [
    check(
      'movimiento_campos_por_tipo',
      sql`(
        ${tabla.tipo} = 'cargo_afiliacion' AND ${tabla.importe} > 0
          AND ${tabla.declaracionId} IS NOT NULL AND ${tabla.periodo} IS NOT NULL
          AND ${tabla.cantidad} > 0 AND ${tabla.cuota} > 0
          AND ${tabla.medioDePago} IS NULL AND ${tabla.anulaA} IS NULL
      ) OR (
        ${tabla.tipo} = 'pago' AND ${tabla.importe} < 0
          AND ${tabla.declaracionId} IS NULL AND ${tabla.periodo} IS NULL
          AND ${tabla.cantidad} IS NULL AND ${tabla.cuota} IS NULL
          AND ${tabla.medioDePago} IN ('transferencia', 'efectivo', 'otro')
          AND ${tabla.anulaA} IS NULL
      ) OR (
        ${tabla.tipo} = 'anulacion_pago' AND ${tabla.importe} > 0
          AND ${tabla.declaracionId} IS NULL AND ${tabla.periodo} IS NULL
          AND ${tabla.cantidad} IS NULL AND ${tabla.cuota} IS NULL
          AND ${tabla.medioDePago} IS NULL AND ${tabla.anulaA} IS NOT NULL
      )`,
    ),
    uniqueIndex('cargo_por_declaracion').on(tabla.declaracionId),
    uniqueIndex('anulacion_por_pago').on(tabla.anulaA),
    index('movimientos_por_grupo').on(tabla.grupoId, tabla.fecha),
    index('cargos_por_periodo').on(tabla.periodo),
  ],
)
