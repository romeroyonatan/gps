import { describe, expect, test } from 'bun:test'
import { alcanceSinLimites } from '@gps/core'
import { alcanceDelFirmante, montar, permisoConGente } from './montar'

describe('auditoría de salidas', () => {
  test('guarda acciones y firmas sin copiar trazos', async () => {
    const { servicio, eventos } = montar()
    const permiso = await permisoConGente(servicio)
    await servicio.emitir(alcanceSinLimites('secretaria'), permiso.id)
    const trazos = { trazos: [[[0.1234, 0.5678] as const]] }
    await servicio.firmarEnApp(alcanceDelFirmante('jefeDeGrupo'), permiso.id, 'jefeDeGrupo', trazos)

    expect(eventos.map((evento) => evento.accion)).toContain('crearPermiso')
    expect(eventos.find((evento) => evento.accion === 'firmarEnApp')).toMatchObject({
      grupoId: permiso.grupoId,
      objetivoPersonaId: 'persona_jefe',
      resumen: { permisoId: permiso.id, cargo: 'jefeDeGrupo', modo: 'app' },
    })
    expect(JSON.stringify(eventos)).not.toContain('0.1234')
    expect(JSON.stringify(eventos)).not.toContain('sellado:')
  })
})
