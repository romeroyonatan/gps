import { Database } from 'bun:sqlite'
import { beforeEach, describe, expect, test } from 'bun:test'
import { aplicarMigraciones, type Bd, type Core, crearBusDeEventos, type Module } from '@gps/core'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migraciones } from '../src/servidor/migraciones'

const HORA = new Date('1970-01-01T00:00:00Z')
let bd: Bd

beforeEach(() => {
  bd = drizzle(new Database(':memory:'))
  const core: Core = {
    config: { version: '0.0.0', entorno: 'prueba', puerto: 0 },
    logger: { info: () => {}, error: () => {} },
    reloj: { ahora: () => HORA },
    bd,
    eventos: crearBusDeEventos(),
    auditoria: { registrar: () => 'evento_de_auditoria_test' },
    modulos: ['tesoreria'],
    // Falso pero con el comportamiento que importa: sellar y verificar cierran
    // entre si, y un dato alterado no verifica.
    sellador: {
      sellar: (datos: string) => ({ sello: `sellado:${datos}`, claveId: 'prueba' }),
      verificar: (datos: string, sello: { sello: string; claveId: string }) =>
        sello.claveId === 'prueba' && sello.sello === `sellado:${datos}`,
    },
    almacenamiento: {
      guardar: async () => {},
      leer: async () => new Uint8Array(),
      eliminar: async () => {},
    },
    conversorDeImagenes: { aJpeg: async (contenido: Uint8Array) => contenido },
    hash: (contenido) => `hash:${typeof contenido === 'string' ? contenido : contenido.join(',')}`,
    nuevoId: (prefijo) => `${prefijo}_fijo`,
    nuevoSecreto: () => 'secreto_fijo',
  }
  const modulo: Module<object> = {
    name: 'tesoreria',
    dependencies: [],
    migraciones,
    createServices: () => ({}),
    accesoAlModulo: { porDefecto: 'denegado', permitidos: [] },
    registerSchema: () => {},
  }
  aplicarMigraciones(core, [modulo])
})

const cargo = (id: string, declaracionId: string) =>
  bd.run(sql`INSERT INTO movimientos_de_tesoreria
    (id, grupo_id, fecha, tipo, importe, periodo, declaracion_id, cantidad, cuota, creado_en, actualizado_en)
    VALUES (${id}, 'grupo_7', '2026-05-01', 'cargo_afiliacion', 20000, 2026,
      ${declaracionId}, 1, 20000, 0, 0)`)

const pago = (id: string) =>
  bd.run(sql`INSERT INTO movimientos_de_tesoreria
    (id, grupo_id, fecha, tipo, importe, medio_de_pago, creado_en, actualizado_en)
    VALUES (${id}, 'grupo_7', '2026-05-02', 'pago', -20000, 'transferencia', 0, 0)`)

describe('migraciones de tesoreria', () => {
  test('crea cuotas y movimientos', () => {
    const tablas = bd
      .values<[string]>(sql`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`)
      .map(([nombre]) => nombre)
    expect(tablas).toEqual(['cuotas_de_afiliacion', 'migraciones', 'movimientos_de_tesoreria'])
  })

  test('una declaracion tiene como maximo un cargo', () => {
    cargo('movimiento_1', 'declaracion_1')
    expect(() => cargo('movimiento_2', 'declaracion_1')).toThrow()
  })

  test('un pago tiene como maximo una anulacion', () => {
    pago('pago_1')
    const anular = (id: string) =>
      bd.run(sql`INSERT INTO movimientos_de_tesoreria
        (id, grupo_id, fecha, tipo, importe, anula_a, creado_en, actualizado_en)
        VALUES (${id}, 'grupo_7', '2026-05-03', 'anulacion_pago', 20000, 'pago_1', 0, 0)`)
    anular('anulacion_1')
    expect(() => anular('anulacion_2')).toThrow()
  })

  test('rechaza signos y campos incompatibles con el tipo', () => {
    expect(() =>
      bd.run(sql`INSERT INTO movimientos_de_tesoreria
        (id, grupo_id, fecha, tipo, importe, medio_de_pago, creado_en, actualizado_en)
        VALUES ('pago_1', 'grupo_7', '2026-05-02', 'pago', 20000, 'efectivo', 0, 0)`),
    ).toThrow()
  })
})
