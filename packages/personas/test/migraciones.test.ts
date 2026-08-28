import { Database } from 'bun:sqlite'
import { beforeEach, describe, expect, test } from 'bun:test'
import { aplicarMigraciones, type Bd, type Core, type Module } from '@gps/core'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migraciones } from '../src/servidor/migraciones'

const HORA = new Date('1970-01-01T00:00:00Z')

function coreDePrueba(bd: Bd): Core {
  return {
    config: { version: '0.0.0', entorno: 'prueba', puerto: 0 },
    logger: { info: () => {}, error: () => {} },
    reloj: { ahora: () => HORA },
    bd,
    modulos: ['personas'],
    nuevoId: (prefijo) => `${prefijo}_fijo`,
  }
}

const moduloFalso: Module<object> = {
  name: 'personas',
  dependencies: [],
  migraciones,
  createServices: () => ({}),
  registerSchema: () => {},
}

let bd: Bd

beforeEach(() => {
  const base = new Database(':memory:')
  // Igual que crearBd en el backend: sin el PRAGMA las foreign keys no muerden.
  base.exec('PRAGMA foreign_keys = ON')
  bd = drizzle(base)
  aplicarMigraciones(coreDePrueba(bd), [moduloFalso])
})

const insertar = (id: string, tipo: string, numero: string) =>
  bd.run(
    sql`INSERT INTO personas VALUES (${id}, ${tipo}, ${numero}, 'Ana', 'Perez', '2010-05-01', 0, 0)`,
  )

describe('migraciones de personas', () => {
  test('crea la tabla del modulo', () => {
    const nombres = bd
      .values<[string]>(sql`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`)
      .map(([nombre]) => nombre)
    expect(nombres).toEqual(['migraciones', 'personas'])
  })

  test('la fecha de nacimiento es texto, no un entero', () => {
    // Es la decision de dominio que mas facil se pierde en una migracion
    // regenerada sin mirar: si vuelve a ser integer, la fecha vuelve a ser un
    // instante y con el la zona horaria.
    const columnas = bd.all<{ name: string; type: string }>(sql`PRAGMA table_info(personas)`)
    // sqlite normaliza el tipo declarado ("text") a mayusculas en table_info.
    expect(columnas.find((columna) => columna.name === 'fecha_de_nacimiento')?.type).toBe('TEXT')
  })

  test('dos personas no pueden compartir tipo y numero de documento', () => {
    insertar('p1', 'dni', '30111222')
    expect(() => insertar('p2', 'dni', '30111222')).toThrow()
  })

  test('un DNI y un pasaporte si pueden compartir el numero', () => {
    // Son espacios de numeracion distintos: por eso el UNIQUE es sobre el par y
    // no sobre el numero solo.
    insertar('p1', 'dni', '30111222')
    expect(() => insertar('p2', 'pasaporte', '30111222')).not.toThrow()
  })

  test('aplica la migracion del modulo', () => {
    const aplicadas = bd
      .values<[string]>(sql`SELECT nombre FROM migraciones ORDER BY nombre`)
      .map(([nombre]) => nombre)
    expect(aplicadas).toEqual(['0000_inicial'])
  })
})
