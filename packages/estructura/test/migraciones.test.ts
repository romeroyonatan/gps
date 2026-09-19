import { Database } from 'bun:sqlite'
import { beforeEach, describe, expect, test } from 'bun:test'
import { aplicarMigraciones, type Bd, type Core, crearBusDeEventos, type Module } from '@gps/core'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migraciones } from '../src/servidor/migraciones'

const HORA = new Date('1970-01-01T00:00:00Z')

function coreDePrueba(bd: Bd): Core {
  return {
    config: { version: '0.0.0', entorno: 'prueba', puerto: 0, auth: null },
    logger: { info: () => {}, error: () => {} },
    reloj: { ahora: () => HORA },
    bd,
    eventos: crearBusDeEventos(),
    modulos: ['estructura'],
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
    // Falso pero estable y sensible al contenido, que es lo que los tests miran.
    hash: (contenido: Uint8Array | string) =>
      `hash:${typeof contenido === 'string' ? contenido : contenido.join(',')}`,
    nuevoId: (prefijo) => `${prefijo}_fijo`,
    nuevoSecreto: () => 'secreto_fijo',
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
    expect(nombres).toEqual(['distritos', 'grupos', 'migraciones', 'unidades'])
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

  const insertarUnidad = (
    id: string,
    rama: string,
    nombre: string,
    cerradaEn: number | null = null,
  ) =>
    bd.run(
      sql`INSERT INTO unidades VALUES (${id}, 'g1', ${rama}, 'mixta', ${nombre}, ${cerradaEn}, 0, 0)`,
    )

  test('el mismo grupo no puede tener dos unidades abiertas de la misma rama y nombre', () => {
    insertarDistrito()
    insertarGrupo('d1')
    insertarUnidad('u1', 'scouts', 'San Jorge')
    expect(() => insertarUnidad('u2', 'scouts', 'San Jorge')).toThrow()
  })

  test('el mismo grupo si puede tener dos unidades de la misma rama con nombres distintos', () => {
    // Es el caso que ramas_del_grupo hacia imposible: dos tropas scout.
    insertarDistrito()
    insertarGrupo('d1')
    insertarUnidad('u1', 'scouts', 'San Jorge')
    expect(() => insertarUnidad('u2', 'scouts', 'Santa Juana')).not.toThrow()
  })

  test('el mismo nombre se puede repetir en otra rama', () => {
    insertarDistrito()
    insertarGrupo('d1')
    insertarUnidad('u1', 'scouts', 'San Jorge')
    expect(() => insertarUnidad('u2', 'raiders', 'San Jorge')).not.toThrow()
  })

  test('una unidad cerrada libera su nombre: el UNIQUE es solo entre las abiertas', () => {
    insertarDistrito()
    insertarGrupo('d1')
    insertarUnidad('u1', 'scouts', 'San Jorge', 0)
    expect(() => insertarUnidad('u2', 'scouts', 'San Jorge')).not.toThrow()
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

  test('convierte cada rama abierta en una unidad, con su tipo de nombre', () => {
    // La base arranca ya migrada, asi que el caso se arma al reves: se levanta
    // una base con las migraciones hasta 0001, se siembran ramas y recien ahi
    // se aplican las dos que faltan. Es la unica forma de probar la conversion.
    const base = new Database(':memory:')
    base.exec('PRAGMA foreign_keys = ON')
    const vieja: Bd = drizzle(base)
    aplicarMigraciones(coreDePrueba(vieja), [
      { ...moduloFalso, migraciones: migraciones.slice(0, 2) },
    ])
    vieja.run(sql`INSERT INTO distritos VALUES ('d1', 1, 'San Isidro', 0, 0, NULL)`)
    vieja.run(sql`INSERT INTO grupos VALUES ('g1', 42, 'Ceferino', 'd1', 0, 0, NULL)`)
    vieja.run(sql`INSERT INTO ramas_del_grupo VALUES ('g1', 'lobatos', 111)`)
    vieja.run(sql`INSERT INTO ramas_del_grupo VALUES ('g1', 'scouts', 222)`)

    aplicarMigraciones(coreDePrueba(vieja), [moduloFalso])

    const filas = vieja.values<[string, string, string, string, string, number | null, number]>(
      sql`SELECT id, grupo_id, rama, sexo, nombre, cerrada_en, creado_en FROM unidades ORDER BY rama`,
    )
    expect(filas).toEqual([
      ['unidad_g1_lobatos', 'g1', 'lobatos', 'mixta', 'Manada', null, 111],
      ['unidad_g1_scouts', 'g1', 'scouts', 'mixta', 'Tropa scout', null, 222],
    ])
  })

  test('aplica las migraciones del modulo', () => {
    const aplicadas = bd
      .values<[string]>(sql`SELECT nombre FROM migraciones ORDER BY nombre`)
      .map(([nombre]) => nombre)
    expect(aplicadas).toEqual([
      '0000_inicial',
      '0001_cierre',
      '0002_unidades',
      '0003_baja_ramas_del_grupo',
    ])
  })
})
