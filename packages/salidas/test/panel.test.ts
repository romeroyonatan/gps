import { describe, expect, test } from 'bun:test'
import type { Actor } from '@gps/core'
import { firmantesRequeridos } from '../src/dominio/firmas'
import { repartirSalidas, type SalidaDelPanel } from '../src/dominio/panel'

const firmantes = firmantesRequeridos('g1', 'd1')

function actorCon(rol: string, tipo: 'grupo' | 'distrito', id: string): Actor {
  return {
    personaId: 'x',
    roles: [{ rol, ambito: { tipo, id } } as never],
    esAdministradorDesignado: false,
    estaElevado: false,
  }
}

const jefe = actorCon('jefeDeGrupo', 'grupo', 'g1')

function salida(datos: Partial<SalidaDelPanel> & { id: string }) {
  return {
    estado: 'emitido',
    hasta: '2026-01-10',
    firmas: [
      { cargo: 'jefeDeGrupo', firmada: false },
      { cargo: 'director', firmada: false },
      { cargo: 'comisionadoDeDistrito', firmada: false },
    ],
    ...datos,
  } as SalidaDelPanel & { id: string }
}

const ids = (salidas: readonly { id: string }[]) => salidas.map((una) => una.id)

describe('repartirSalidas', () => {
  test('separa la firma propia de la ajena: firmar es personal', () => {
    const tuya = salida({ id: 'tuya' })
    const ajena = salida({
      id: 'ajena',
      firmas: [
        { cargo: 'jefeDeGrupo', firmada: true },
        { cargo: 'director', firmada: false },
      ],
    })

    const panel = repartirSalidas([tuya, ajena], jefe, firmantes, '2026-01-01')

    expect(ids(panel.esperanTuFirma)).toEqual(['tuya'])
    expect(ids(panel.esperanLaDeOtro)).toEqual(['ajena'])
    expect(panel.proximas).toEqual([])
  })

  test('el permiso de otro grupo espera la firma de otro, aunque el cargo sea el mismo', () => {
    const panel = repartirSalidas([salida({ id: 'a' })], jefe, firmantesRequeridos('g2', 'd1'), '')

    expect(ids(panel.esperanLaDeOtro)).toEqual(['a'])
  })

  test('las tres firmadas y el borrador son próximas mientras no hayan vuelto', () => {
    const firmado = salida({
      id: 'firmado',
      estado: 'firmado',
      firmas: [{ cargo: 'jefeDeGrupo', firmada: true }],
    })
    const borrador = salida({ id: 'borrador', estado: 'borrador', firmas: [] })
    const vieja = salida({ id: 'vieja', estado: 'firmado', firmas: [], hasta: '2025-12-31' })

    const panel = repartirSalidas([firmado, borrador, vieja], jefe, firmantes, '2026-01-01')

    expect(ids(panel.proximas)).toEqual(['firmado', 'borrador'])
  })

  test('la firma que falta sigue faltando aunque la salida ya haya pasado', () => {
    const panel = repartirSalidas(
      [salida({ id: 'pasada', hasta: '2025-01-01' })],
      jefe,
      firmantes,
      '2026-01-01',
    )

    expect(ids(panel.esperanTuFirma)).toEqual(['pasada'])
  })

  test('el permiso anulado no está en ninguna de las tres', () => {
    const panel = repartirSalidas(
      [salida({ id: 'a', estado: 'anulado', firmas: [] })],
      jefe,
      firmantes,
      '2026-01-01',
    )

    expect(panel).toEqual({ esperanTuFirma: [], esperanLaDeOtro: [], proximas: [] })
  })
})
