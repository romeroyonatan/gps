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
    modulos: ['afiliacion'],
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
  name: 'afiliacion',
  dependencies: [],
  migraciones,
  createServices: () => ({}),
  registerSchema: () => {},
}

let bd: Bd

beforeEach(() => {
  const base = new Database(':memory:')
  base.exec('PRAGMA foreign_keys = ON')
  bd = drizzle(base)
  aplicarMigraciones(coreDePrueba(bd), [moduloFalso])
})

const declarar = (id: string, grupoId: string, fecha: string, periodo: number) =>
  bd.run(sql`INSERT INTO declaraciones VALUES (${id}, ${grupoId}, ${fecha}, ${periodo}, 0, 0)`)

const afiliar = (declaracionId: string, personaId: string) =>
  bd.run(
    sql`INSERT INTO afiliados
        VALUES (${declaracionId}, ${personaId}, 'dni', '30111222', 'Ana', 'Perez')`,
  )

describe('migraciones de afiliacion', () => {
  test('crea las tablas del modulo', () => {
    const nombres = bd
      .values<[string]>(sql`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`)
      .map(([nombre]) => nombre)
    expect(nombres).toEqual(['afiliados', 'declaraciones', 'migraciones'])
  })

  test('un grupo no puede declarar dos veces el mismo dia', () => {
    // La red por debajo de la idempotencia del barrido. Quien la hace cumplir
    // en el camino normal es `declarar`, que saltea los grupos que ya tienen
    // declaracion con esa fecha; el UNIQUE es lo que atrapa lo que ese salteo
    // no puede ver, como dos procesos declarando a la vez.
    declarar('d1', 'grupo_1', '2026-05-01', 2026)
    expect(() => declarar('d2', 'grupo_1', '2026-05-01', 2026)).toThrow()
  })

  test('pero dos grupos si declaran el mismo dia', () => {
    // Las ordinarias son una declaracion por grupo, todas con la misma fecha.
    declarar('d1', 'grupo_1', '2026-05-01', 2026)
    expect(() => declarar('d2', 'grupo_2', '2026-05-01', 2026)).not.toThrow()
  })

  test('una persona no puede estar dos veces en la misma nomina', () => {
    declarar('d1', 'grupo_1', '2026-05-01', 2026)
    afiliar('d1', 'persona_1')
    expect(() => afiliar('d1', 'persona_1')).toThrow()
  })

  test('la fecha es texto y el periodo es entero', () => {
    // Si la fecha vuelve a ser integer, vuelve a ser un instante y con el la
    // zona horaria. Es la decision que mas facil se pierde en una migracion
    // regenerada sin mirar.
    const columnas = bd.all<{ name: string; type: string }>(sql`PRAGMA table_info(declaraciones)`)
    expect(columnas.find((columna) => columna.name === 'fecha')?.type).toBe('TEXT')
    expect(columnas.find((columna) => columna.name === 'periodo')?.type).toBe('INTEGER')
  })
})
