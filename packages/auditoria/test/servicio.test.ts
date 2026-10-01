import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { type Alcance, type Bd, type Core, crearBusDeEventos } from '@gps/core'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { crearServicioDeAuditoria } from '../src/servidor/servicio'

const CREAR = `CREATE TABLE eventos_de_auditoria (
  id text primary key, ocurrido_en integer not null, actor_persona_id text,
  origen_interno text, modulo text not null, accion text not null,
  resultado text not null, elevado integer not null, grupo_id text,
  entidad_tipo text, entidad_id text, objetivo_persona_id text,
  resumen text not null, cambios text not null
)`

function montar() {
  const bd = drizzle(new Database(':memory:'))
  bd.run(CREAR)
  const core = {
    bd,
    config: { entorno: 'prueba', puerto: 0, version: 'test' },
    modulos: [],
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
    conversorDeImagenes: { aJpeg: async (bytes: Uint8Array) => bytes },
  } satisfies Core
  const servicio = crearServicioDeAuditoria(
    core,
    {
      nombreDe: async (id: string) => ({
        nombres: id === 'actor-1' ? 'Ana' : 'Beto',
        apellidos: 'Scout',
      }),
    } as never,
    {
      listarGrupos: async () => [
        { id: 'grupo-1', numero: 1, nombre: 'Uno', cerradoEn: null },
        { id: 'grupo-2', numero: 2, nombre: 'Dos', cerradoEn: null },
      ],
    } as never,
  )
  return { bd, servicio }
}

function alcance(grupoId = 'grupo-1', elevado = false): Alcance {
  return {
    actor: {
      personaId: 'actor-1',
      roles: [{ rol: 'secretariaDeGrupo', ambito: { tipo: 'grupo', id: grupoId } }],
      esAdministradorDesignado: elevado,
      estaElevado: elevado,
    },
    gruposVisibles: [grupoId],
    distritosVisibles: [],
    esAdministrador: elevado,
  }
}

function insertar(
  bd: Bd,
  id: string,
  fecha: number,
  grupo: string | null,
  modulo = 'salidas',
  accion = 'editar',
) {
  bd.run(
    `INSERT INTO eventos_de_auditoria VALUES ('${id}', ${fecha}, 'actor-1', null, '${modulo}', '${accion}', 'exitoso', 0, ${grupo ? `'${grupo}'` : 'null'}, 'permiso', 'p', null, '{}', '[]')`,
  )
}

describe('consulta de auditoría', () => {
  test('secretaría sólo recibe su grupo y nombres legibles', async () => {
    const { bd, servicio } = montar()
    insertar(bd, 'e1', 1, 'grupo-1')
    insertar(bd, 'e2', 2, 'grupo-2')
    insertar(bd, 'e3', 3, null)
    const pagina = await servicio.listar(alcance())
    expect(pagina.eventos.map((evento) => evento.id)).toEqual(['e1'])
    expect(pagina.eventos[0]).toMatchObject({
      actorNombre: 'Ana Scout',
      grupoNombre: 'Grupo Nº1 · Uno',
    })
    await expect(servicio.listar(alcance(), { grupoId: 'grupo-2' })).rejects.toThrow(
      'No tenés acceso',
    )
  })

  test('muestra a quién se integró al equipo sin confundirlo con quien actuó', async () => {
    const { bd, servicio } = montar()
    bd.run(`INSERT INTO eventos_de_auditoria VALUES
      ('e1', 1, 'actor-1', null, 'personas', 'equipo.secretaria.integrar',
       'exitoso', 0, 'grupo-1', 'integranteDeEquipo', 'integrante-1', 'persona-2',
       '{"personaId":"persona-2"}', '[]')`)
    const pagina = await servicio.listar(alcance())
    expect(pagina.eventos[0]).toMatchObject({
      actorNombre: 'Ana Scout',
      objetivoPersonaId: 'persona-2',
      objetivoNombre: 'Beto Scout',
    })
  })

  test('una invitación conserva el destinatario aunque no tenga grupo', async () => {
    const { bd, servicio } = montar()
    bd.run(`INSERT INTO eventos_de_auditoria VALUES
      ('e1', 1, 'actor-1', null, 'auth', 'invitacion.activacion.emitir',
       'exitoso', 0, null, null, null, 'persona-2',
       '{"invitacionId":"invitacion-1"}', '[]')`)
    const pagina = await servicio.listar(alcance('grupo-1', true))
    expect(pagina.eventos[0]).toMatchObject({
      actorNombre: 'Ana Scout',
      objetivoNombre: 'Beto Scout',
      resumen: { invitacionId: 'invitacion-1' },
    })
  })

  test('elevación ve eventos globales y combina filtros', async () => {
    const { bd, servicio } = montar()
    insertar(bd, 'e1', 1, 'grupo-1', 'salidas', 'crear')
    insertar(bd, 'e2', 2, 'grupo-2', 'tesoreria', 'crear')
    insertar(bd, 'e3', 3, null, 'auth', 'elevar')
    const pagina = await servicio.listar(alcance('grupo-1', true), {
      modulo: 'tesoreria',
      accion: 'crear',
      desde: new Date(2),
      hasta: new Date(2),
    })
    expect(pagina.eventos.map((evento) => evento.id)).toEqual(['e2'])
  })

  test('pagina por cursor sin repetir filas con igual fecha', async () => {
    const { bd, servicio } = montar()
    insertar(bd, 'e3', 10, 'grupo-1')
    insertar(bd, 'e2', 10, 'grupo-1')
    insertar(bd, 'e1', 9, 'grupo-1')
    const primera = await servicio.listar(alcance(), { limite: 2 })
    expect(primera.eventos.map((evento) => evento.id)).toEqual(['e3', 'e2'])
    const segunda = await servicio.listar(alcance(), {
      limite: 2,
      cursor: primera.cursorSiguiente ?? undefined,
    })
    expect(segunda.eventos.map((evento) => evento.id)).toEqual(['e1'])
  })
})
