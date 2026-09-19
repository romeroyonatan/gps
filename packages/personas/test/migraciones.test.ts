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
})

const insertarPertenencia = (
  id: string,
  personaId: string,
  grupoId: string,
  hasta: string | null,
) =>
  bd.run(
    sql`INSERT INTO pertenencias
        VALUES (${id}, ${personaId}, ${grupoId}, 'beneficiario', 'lobatos', '2026-03-01', ${hasta}, 0, 0)`,
  )

describe('pertenencias y cargos', () => {
  test('crea las tablas del modulo', () => {
    const nombres = bd
      .values<[string]>(sql`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`)
      .map(([nombre]) => nombre)
    expect(nombres).toEqual(['cargos', 'migraciones', 'personas', 'pertenencias'])
  })

  test('una persona no puede tener dos pertenencias vigentes, ni siquiera en grupos distintos', () => {
    // Lo que el indice UNIQUE (persona_id) WHERE hasta IS NULL fija es "una
    // persona, un solo grupo a la vez", no solo "no repetir el mismo grupo".
    // Insertando las dos vigentes en grupos distintos es la unica forma de
    // distinguir esta invariante de un indice mas laxo (persona_id, grupo_id):
    // ese otro indice dejaria pasar este caso y la persona quedaria vigente en
    // dos grupos a la vez.
    insertar('p1', 'dni', '30111222')
    insertarPertenencia('pe1', 'p1', 'grupo_1', null)
    expect(() => insertarPertenencia('pe2', 'p1', 'grupo_2', null)).toThrow()
  })

  test('pero si muchas cerradas, que es el historial', () => {
    // El indice es parcial: solo mira las filas con hasta IS NULL.
    insertar('p1', 'dni', '30111222')
    insertarPertenencia('pe1', 'p1', 'grupo_1', '2020-12-31')
    insertarPertenencia('pe2', 'p1', 'grupo_2', '2023-12-31')
    expect(() => insertarPertenencia('pe3', 'p1', 'grupo_1', null)).not.toThrow()
  })

  test('el mismo cargo no se puede cargar dos veces con la misma fecha', () => {
    // Lo que ataja es el doble click en Guardar. El solapamiento de periodos
    // SQLite no lo puede expresar sin un trigger; ver §7.3 de la spec.
    insertar('p1', 'dni', '30111222')
    const insertarCargo = (id: string) =>
      bd.run(
        sql`INSERT INTO cargos
            VALUES (${id}, 'p1', 'grupo_1', 'jefeDeGrupo', '2026-03-01', NULL, 0, 0)`,
      )
    insertarCargo('c1')
    expect(() => insertarCargo('c2')).toThrow()
  })

  test('las fechas de los vinculos son texto, no enteros', () => {
    // Es la decision de dominio que mas facil se pierde en una migracion
    // regenerada sin mirar: si vuelven a ser integer, vuelven a ser instantes
    // y con ellos la zona horaria.
    const columnas = bd.all<{ name: string; type: string }>(sql`PRAGMA table_info(pertenencias)`)
    expect(columnas.find((columna) => columna.name === 'desde')?.type).toBe('TEXT')
    expect(columnas.find((columna) => columna.name === 'hasta')?.type).toBe('TEXT')
  })

  test('aplica las dos migraciones del modulo', () => {
    const aplicadas = bd
      .values<[string]>(sql`SELECT nombre FROM migraciones ORDER BY nombre`)
      .map(([nombre]) => nombre)
    expect(aplicadas).toEqual(['0000_inicial', '0001_pertenencias_y_cargos'])
  })
})
