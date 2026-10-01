import { expect, test } from 'bun:test'
import type { Context } from '@gps/core'
import { eventosParaExportar, rutaDeExportacionDeAuditoria } from '../src/exportar-auditoria'

const alcance = {
  actor: {
    personaId: 'paula',
    roles: [{ rol: 'secretariaDeGrupo', ambito: { tipo: 'grupo', id: 'grupo-1' } }],
    estaElevado: false,
  },
  gruposVisibles: ['grupo-1'],
  distritosVisibles: [],
  esAdministrador: false,
}
const evento = {
  id: 'evento-1',
  ocurridoEn: new Date('2026-09-25T21:18:00Z'),
  actorPersonaId: 'paula',
  actorNombre: 'Paula Miranda',
  origenInterno: null,
  modulo: 'salidas',
  accion: 'emitirPermiso',
  resultado: 'exitoso',
  elevado: false,
  grupoId: 'grupo-1',
  grupoNombre: 'Grupo Nº1 · San Martín',
  entidadTipo: 'permiso',
  entidadId: 'permiso-1',
  objetivoPersonaId: null,
  objetivoNombre: null,
  resumen: { anioDeExpediente: 2026, numeroDeExpediente: 2 },
  cambios: [],
}
const logger = { error: () => {} } as never

function contexto() {
  const llamadas: unknown[] = []
  const ctx = {
    alcance,
    auditoria: {
      listar: async (
        _alcance: unknown,
        filtros: { cursor?: string; grupoId?: string; limite?: number },
      ) => {
        llamadas.push(filtros)
        return filtros.cursor
          ? { eventos: [{ ...evento, id: 'evento-2' }], cursorSiguiente: null }
          : { eventos: [evento], cursorSiguiente: 'siguiente' }
      },
    },
  } as unknown as Context
  return { ctx, llamadas }
}

test('exporta todas las páginas del recorte, no sólo las visibles', async () => {
  const { ctx, llamadas } = contexto()
  const eventos = await eventosParaExportar(ctx, { grupoId: 'grupo-1' })
  expect(eventos.map((uno) => uno.id)).toEqual(['evento-1', 'evento-2'])
  expect(llamadas).toMatchObject([
    { grupoId: 'grupo-1', limite: 100 },
    { grupoId: 'grupo-1', limite: 100, cursor: 'siguiente' },
  ])
})

test('la descarga devuelve Excel y rechaza sin sesión o permiso', async () => {
  const { ctx } = contexto()
  const url = 'http://localhost/auditoria.xlsx?grupoId=grupo-1'
  const xlsx = await rutaDeExportacionDeAuditoria(ctx, logger, new Request(url))
  expect(xlsx.status).toBe(200)
  expect(xlsx.headers.get('content-disposition')).toContain('attachment')
  const planilla = new Uint8Array(await xlsx.arrayBuffer())
  expect(planilla.slice(0, 2)).toEqual(new Uint8Array([80, 75]))
  expect(new TextDecoder().decode(planilla)).toContain('evento-2')
  const sinSesion = await rutaDeExportacionDeAuditoria(
    { ...ctx, alcance: null } as Context,
    logger,
    new Request(url),
  )
  expect(sinSesion.status).toBe(401)
  const sinPermiso = await rutaDeExportacionDeAuditoria(
    {
      ...ctx,
      alcance: { ...alcance, actor: { ...alcance.actor, roles: [] } },
    } as unknown as Context,
    logger,
    new Request(url),
  )
  expect(sinPermiso.status).toBe(403)
})
