import { Database } from 'bun:sqlite'
import { beforeEach, describe, expect, test } from 'bun:test'
import { aplicarMigraciones, type Bd, type Core, crearBusDeEventos, type Module } from '@gps/core'
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
    eventos: crearBusDeEventos(),
    modulos: ['estructura'],
    nuevoId: (prefijo) => `${prefijo}_fijo`,
  }
}

const moduloFalso: Module<object> = {
  name: 'estructura',
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

// El ALTER TABLE de la migracion 0001 agrega cerrado_en al final de cada
// tabla: por eso el VALUES posicional suma un NULL mas que antes.
const insertarDistrito = (id = 'd1', numero = 1) =>
  bd.run(sql`INSERT INTO distritos VALUES (${id}, ${numero}, 'San Isidro', 0, 0, NULL)`)

const insertarGrupo = (distritoId: string, id = 'g1', numero = 42) =>
  bd.run(
    sql`INSERT INTO grupos VALUES (${id}, ${numero}, 'Ceferino Namuncura', ${distritoId}, 0, 0, NULL)`,
  )

describe('migraciones de estructura', () => {
  test('crean las tres tablas del modulo', () => {
    const nombres = bd
      .values<[string]>(sql`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`)
      .map(([nombre]) => nombre)
    expect(nombres).toEqual(['distritos', 'grupos', 'migraciones', 'ramas_del_grupo'])
  })

  test('un grupo no puede colgar de un distrito inexistente', () => {
    expect(() => insertarGrupo('no-existe')).toThrow()
  })

  test('dos distritos no pueden compartir numero', () => {
    insertarDistrito('d1', 1)
    expect(() => insertarDistrito('d2', 1)).toThrow()
  })

  test('dos grupos no pueden compartir numero, ni siquiera en distritos distintos', () => {
    // El numero de grupo es unico en toda la diocesis: es lo que impide que
    // existan dos "Grupo Scout 42" y que la cuota de uno se cargue en el otro.
    insertarDistrito('d1', 1)
    insertarDistrito('d2', 2)
    insertarGrupo('d1', 'g1', 42)
    expect(() => insertarGrupo('d2', 'g2', 42)).toThrow()
  })

  test('el mismo grupo no puede abrir dos veces la misma rama', () => {
    insertarDistrito()
    insertarGrupo('d1')
    bd.run(sql`INSERT INTO ramas_del_grupo VALUES ('g1', 'lobatos', 0)`)
    expect(() => bd.run(sql`INSERT INTO ramas_del_grupo VALUES ('g1', 'lobatos', 0)`)).toThrow()
  })

  test('el mismo grupo si puede abrir ramas distintas', () => {
    insertarDistrito()
    insertarGrupo('d1')
    bd.run(sql`INSERT INTO ramas_del_grupo VALUES ('g1', 'lobatos', 0)`)
    expect(() => bd.run(sql`INSERT INTO ramas_del_grupo VALUES ('g1', 'scouts', 0)`)).not.toThrow()
  })

  test('agrega la columna cerrado_en a distritos y a grupos', () => {
    const columnasDistritos = bd
      .all<{ name: string }>(sql`PRAGMA table_info(distritos)`)
      .map((columna) => columna.name)
    const columnasGrupos = bd
      .all<{ name: string }>(sql`PRAGMA table_info(grupos)`)
      .map((columna) => columna.name)
    expect(columnasDistritos).toContain('cerrado_en')
    expect(columnasGrupos).toContain('cerrado_en')
  })

  test('aplica las dos migraciones del modulo', () => {
    const aplicadas = bd
      .values<[string]>(sql`SELECT nombre FROM migraciones ORDER BY nombre`)
      .map(([nombre]) => nombre)
    expect(aplicadas).toEqual(['0000_inicial', '0001_cierre'])
  })
})
