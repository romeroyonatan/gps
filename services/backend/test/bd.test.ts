import { describe, expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'
import { crearBd } from '../src/bd'

describe('crearBd', () => {
  test('devuelve una base utilizable', () => {
    const bd = crearBd(':memory:')
    // drizzle devuelve las filas crudas como arrays de valores, no objetos.
    // El generic explicito evita que la inferencia de expect() con un
    // resultado unknown elija el overload de Matchers<undefined>.
    expect(bd.get<number[]>(sql`SELECT 1 + 1`)).toEqual([2])
  })

  test('deja prendidas las foreign keys: SQLite las ignora por defecto', () => {
    // Sin el PRAGMA, las referencias que declaran las migraciones no rechazan
    // nada y la base acepta filas huerfanas en silencio.
    const bd = crearBd(':memory:')
    bd.run(sql.raw('CREATE TABLE padre (id TEXT PRIMARY KEY)'))
    bd.run(sql.raw('CREATE TABLE hijo (id TEXT PRIMARY KEY, padre_id TEXT REFERENCES padre(id))'))
    expect(() => bd.run(sql.raw("INSERT INTO hijo VALUES ('h1', 'inexistente')"))).toThrow()
  })
})
