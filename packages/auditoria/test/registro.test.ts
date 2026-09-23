import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { crearRegistroDeAuditoria } from '../src/servidor'

const CREAR = `CREATE TABLE eventos_de_auditoria (
  id text primary key, ocurrido_en integer not null, actor_persona_id text,
  origen_interno text, modulo text not null, accion text not null,
  resultado text not null, elevado integer not null, grupo_id text,
  entidad_tipo text, entidad_id text, objetivo_persona_id text,
  resumen text not null, cambios text not null
)`

describe('registro de auditoría', () => {
  test('toma id y hora de Core y guarda sólo el resumen explícito', () => {
    const bd = drizzle(new Database(':memory:'))
    bd.run(CREAR)
    const registro = crearRegistroDeAuditoria(
      bd,
      { ahora: () => new Date(1234) },
      (prefijo) => `${prefijo}_1`,
    )
    const id = registro.registrar({
      actorPersonaId: 'persona-1',
      modulo: 'salidas',
      accion: 'crearPermiso',
      resumen: { permisoId: 'permiso-1' },
    })
    expect(id).toBe('evento_de_auditoria_1')
    expect(
      bd.values<[string, number, string]>(
        'SELECT id, ocurrido_en, resumen FROM eventos_de_auditoria',
      )[0],
    ).toEqual(['evento_de_auditoria_1', 1234, '{"permisoId":"permiso-1"}'])
  })

  test('participa de la transacción del cambio auditado', () => {
    const bd = drizzle(new Database(':memory:'))
    bd.run(CREAR)
    bd.run('CREATE TABLE cosas (id text primary key)')
    const registro = crearRegistroDeAuditoria(bd, { ahora: () => new Date(0) }, () => 'evento-1')
    expect(() =>
      bd.transaction((tx) => {
        tx.run("INSERT INTO cosas VALUES ('cosa-1')")
        registro.registrar({ actorPersonaId: 'persona-1', modulo: 'prueba', accion: 'crear' }, tx)
        throw new Error('falla posterior')
      }),
    ).toThrow('falla posterior')
    expect(bd.all('SELECT * FROM cosas')).toEqual([])
    expect(bd.all('SELECT * FROM eventos_de_auditoria')).toEqual([])
  })
})
