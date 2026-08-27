import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import type { Bd, Core } from '../src/core'
import { aplicarMigraciones, type Migracion } from '../src/migraciones'
import type { Module } from '../src/module'

const HORA = new Date('1970-01-01T00:00:00Z')

function coreDePrueba(bd: Bd): Core {
  return {
    config: { version: '0.0.0', entorno: 'prueba', puerto: 0 },
    logger: { info: () => {}, error: () => {} },
    reloj: { ahora: () => HORA },
    bd,
    modulos: [],
    nuevoId: (prefijo) => `${prefijo}_fijo`,
  }
}

function moduloFalso(name: string, migraciones: Migracion[]): Module<object> {
  return {
    name,
    dependencies: [],
    migraciones,
    createServices: () => ({}),
    registerSchema: () => {},
  }
}

const bdEnMemoria = (): Bd => drizzle(new Database(':memory:'))

// bd.all() con un sql crudo devuelve filas como objetos, no tuplas: hay que
// pedirle .values() al driver para poder desestructurar por posicion.
const tablas = (bd: Bd) =>
  bd
    .values<[string]>(sql`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`)
    .map(([nombre]) => nombre)

/** Un esquema con una foreign key y la migracion que drizzle-kit genera para
 *  borrarle una columna a `grupos`: SQLite no lo soporta con ALTER, asi que
 *  recrea la tabla entera. Copiado tal cual del formato que emite drizzle-kit,
 *  PRAGMA incluido. */
const INICIAL: Migracion = {
  nombre: '0000_inicial',
  sql: `CREATE TABLE distritos (id TEXT PRIMARY KEY NOT NULL, numero INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE grupos (
  id TEXT PRIMARY KEY NOT NULL,
  distrito_id TEXT NOT NULL,
  viejo TEXT,
  FOREIGN KEY (distrito_id) REFERENCES distritos(id) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE ramas_del_grupo (
  grupo_id TEXT NOT NULL,
  rama TEXT NOT NULL,
  PRIMARY KEY (grupo_id, rama),
  FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON UPDATE no action ON DELETE no action
);`,
}

const RECREACION: Migracion = {
  nombre: '0001_sin_viejo',
  sql: `PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE \`__new_grupos\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`distrito_id\` text NOT NULL,
  FOREIGN KEY (\`distrito_id\`) REFERENCES \`distritos\`(\`id\`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO \`__new_grupos\`("id", "distrito_id") SELECT "id", "distrito_id" FROM \`grupos\`;
--> statement-breakpoint
DROP TABLE \`grupos\`;
--> statement-breakpoint
ALTER TABLE \`__new_grupos\` RENAME TO \`grupos\`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;`,
}

describe('aplicarMigraciones', () => {
  test('aplica las migraciones pendientes de un modulo', () => {
    const bd = bdEnMemoria()
    aplicarMigraciones(coreDePrueba(bd), [
      moduloFalso('personas', [{ nombre: '0000_inicial', sql: 'CREATE TABLE personas (id TEXT)' }]),
    ])
    expect(tablas(bd)).toContain('personas')
  })

  test('una segunda corrida no reaplica lo que ya corrio', () => {
    // El CREATE TABLE es sin IF NOT EXISTS a proposito: si el runner lo
    // reaplicara, esta segunda llamada lanzaria en vez de no hacer nada.
    const bd = bdEnMemoria()
    const modulos = [
      moduloFalso('personas', [{ nombre: '0000_inicial', sql: 'CREATE TABLE personas (id TEXT)' }]),
    ]
    aplicarMigraciones(coreDePrueba(bd), modulos)
    expect(() => aplicarMigraciones(coreDePrueba(bd), modulos)).not.toThrow()
    expect(bd.all(sql`SELECT nombre FROM migraciones`)).toHaveLength(1)
  })

  test('registra el modulo, el nombre y la hora que da el reloj de Core', () => {
    // La hora sale de core.reloj y no de la plataforma: por eso el test puede
    // afirmar el instante exacto en vez de un rango.
    const bd = bdEnMemoria()
    aplicarMigraciones(coreDePrueba(bd), [
      moduloFalso('personas', [{ nombre: '0000_inicial', sql: 'CREATE TABLE personas (id TEXT)' }]),
    ])
    expect(bd.values(sql`SELECT modulo, nombre, aplicada_en FROM migraciones`)).toEqual([
      ['personas', '0000_inicial', HORA.getTime()],
    ])
  })

  test('ejecuta todas las sentencias de un archivo, no solo la primera', () => {
    // drizzle-kit separa las sentencias con este marcador y sqlite prepara una
    // por vez: sin partir el archivo, la segunda tabla nunca se crearia.
    const bd = bdEnMemoria()
    aplicarMigraciones(coreDePrueba(bd), [
      moduloFalso('personas', [
        {
          nombre: '0000_inicial',
          sql: 'CREATE TABLE una (id TEXT);\n--> statement-breakpoint\nCREATE TABLE otra (id TEXT);',
        },
      ]),
    ])
    expect(tablas(bd)).toContain('una')
    expect(tablas(bd)).toContain('otra')
  })

  test('si una sentencia falla, la migracion no queda registrada como aplicada', () => {
    const bd = bdEnMemoria()
    const roto = moduloFalso('personas', [
      {
        nombre: '0000_inicial',
        sql: 'CREATE TABLE una (id TEXT);\n--> statement-breakpoint\nESTO NO ES SQL;',
      },
    ])
    expect(() => aplicarMigraciones(coreDePrueba(bd), [roto])).toThrow()
    expect(bd.all(sql`SELECT nombre FROM migraciones`)).toHaveLength(0)
    expect(tablas(bd)).not.toContain('una')
  })

  test('aplica el baile de recreacion de tabla que emite drizzle-kit', () => {
    // Regresion: para todo lo que SQLite no soporta con ALTER, drizzle-kit
    // emite CREATE __new / INSERT...SELECT / DROP / RENAME. Con las foreign
    // keys prendidas el DROP falla, y el PRAGMA que trae el archivo es un
    // no-op adentro de la transaccion del runner: la unica forma de que esto
    // pase es apagarlas afuera.
    const bd = bdEnMemoria()
    bd.run(sql.raw('PRAGMA foreign_keys = ON'))
    const core = coreDePrueba(bd)

    aplicarMigraciones(core, [moduloFalso('estructura', [INICIAL])])
    bd.run(sql.raw("INSERT INTO distritos (id, numero) VALUES ('d1', 1)"))
    bd.run(sql.raw("INSERT INTO grupos (id, distrito_id, viejo) VALUES ('g1', 'd1', 'x')"))
    // La fila hija es la que hace fallar el DROP: sin nadie que referencie a
    // `grupos`, SQLite lo borra aunque las foreign keys esten prendidas.
    bd.run(sql.raw("INSERT INTO ramas_del_grupo (grupo_id, rama) VALUES ('g1', 'lobatos')"))

    aplicarMigraciones(core, [moduloFalso('estructura', [INICIAL, RECREACION])])

    expect(bd.values(sql`SELECT id, distrito_id FROM grupos`)).toEqual([['g1', 'd1']])
    expect(bd.values(sql`SELECT grupo_id, rama FROM ramas_del_grupo`)).toEqual([['g1', 'lobatos']])
    expect(bd.all(sql`SELECT nombre FROM migraciones`)).toHaveLength(2)
    // Y las deja como estaban: si el runner se olvidara del ON, la base
    // seguiria sin validar referencias despues de migrar.
    expect(bd.values(sql`PRAGMA foreign_keys`)).toEqual([[1]])
  })

  test('si una migracion deja filas huerfanas, lanza', () => {
    // El INSERT...SELECT corre con las foreign keys apagadas, asi que nadie mas
    // que el foreign_key_check final se entera de que la fila quedo colgada.
    const bd = bdEnMemoria()
    const huerfana: Migracion = {
      nombre: '0001_huerfana',
      sql: "INSERT INTO grupos (id, distrito_id, viejo) VALUES ('g9', 'no_existe', 'x')",
    }
    expect(() =>
      aplicarMigraciones(coreDePrueba(bd), [moduloFalso('estructura', [INICIAL, huerfana])]),
    ).toThrow(/huerfanas/)
  })

  test('un modulo sin migraciones no rompe nada', () => {
    const bd = bdEnMemoria()
    expect(() => aplicarMigraciones(coreDePrueba(bd), [moduloFalso('sistema', [])])).not.toThrow()
  })
})
