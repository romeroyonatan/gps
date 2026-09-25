import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { aplicarMigraciones, type Core, crearBusDeEventos } from '@gps/core'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { auditoria } from '../src/servidor'

function core(): Core {
  const bd = drizzle(new Database(':memory:'))
  return {
    bd,
    config: { entorno: 'prueba', puerto: 0, version: 'test' },
    modulos: ['auditoria'],
    eventos: crearBusDeEventos(),
    auditoria: { registrar: () => 'evento' },
    reloj: { ahora: () => new Date(0) },
    nuevoId: () => 'id',
    nuevoSecreto: () => 'secreto',
    hash: () => 'hash',
    logger: { info() {}, error() {} },
    sellador: { sellar: () => ({ sello: '', claveId: '' }), verificar: () => true },
    almacenamiento: {
      guardar: async () => {},
      leer: async () => new Uint8Array(),
      eliminar: async () => {},
    },
    conversorDeImagenes: { aJpeg: async (bytes) => bytes },
  }
}

describe('migraciones de auditoría', () => {
  test('crea el registro central desde una base con las fuentes anteriores', () => {
    const uno = core()
    uno.bd.run(
      'CREATE TABLE eventos_de_autoridad (id text, tipo text, actor_persona_id text, objetivo_persona_id text, ambito_tipo text, ambito_id text, creado_en integer)',
    )
    uno.bd.run(
      'CREATE TABLE eventos_de_seguridad (id text, tipo text, actor_persona_id text, objetivo_persona_id text, detalles text, creado_en integer)',
    )
    uno.bd.run(
      "INSERT INTO eventos_de_autoridad VALUES ('a','cargo.asignar','actor','objetivo','grupo','g',1)",
    )
    uno.bd.run(
      "INSERT INTO eventos_de_seguridad VALUES ('s','sesion.elevar','actor','actor','{}',2)",
    )
    aplicarMigraciones(uno, [auditoria])
    aplicarMigraciones(uno, [auditoria])
    expect(uno.bd.all('SELECT id FROM eventos_de_auditoria ORDER BY id')).toEqual([
      { id: 'a' },
      { id: 's' },
    ])
  })
})
