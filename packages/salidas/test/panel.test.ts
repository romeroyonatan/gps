import { describe, expect, test } from 'bun:test'
import { categoriaDeSalida, type PermisoDelPanel, repartirSalidas } from '../src/dominio/panel'

const HOY = '2026-09-20'

function permiso(
  id: string,
  estado: PermisoDelPanel['estado'],
  desde: string,
  firmadas: readonly boolean[],
): PermisoDelPanel & { id: string } {
  const cargos = ['jefeDeGrupo', 'director', 'comisionadoDeDistrito'] as const
  return {
    id,
    estado,
    desde,
    firmas: cargos.map((cargo, indice) => ({ cargo, firmada: firmadas[indice] ?? false })),
  }
}

const soyJefeDeGrupo = (cargo: string) => cargo === 'jefeDeGrupo'

describe('categoriaDeSalida', () => {
  test('separa las actuales, las finalizadas y las anuladas', () => {
    expect(categoriaDeSalida({ estado: 'anulado', hasta: '2026-10-01' }, HOY)).toBe('anuladas')
    expect(categoriaDeSalida({ estado: 'firmado', hasta: '2026-09-19' }, HOY)).toBe('finalizadas')
    expect(categoriaDeSalida({ estado: 'firmado', hasta: HOY }, HOY)).toBe('actuales')
    expect(categoriaDeSalida({ estado: 'borrador', hasta: '2026-10-01' }, HOY)).toBe('actuales')
  })
})

describe('repartirSalidas', () => {
  test('un emitido con mi firma pendiente espera mi firma', () => {
    const { esperanMiFirma, esperanOtraFirma } = repartirSalidas(
      [permiso('a', 'emitido', '2026-10-11', [false, false, false])],
      HOY,
      soyJefeDeGrupo,
    )
    expect(esperanMiFirma.map((uno) => uno.id)).toEqual(['a'])
    expect(esperanOtraFirma).toEqual([])
  })

  test('si ya firmé, el mismo permiso pasa a esperar la de otro', () => {
    // Es la distinción que hace el inicio: "esperan tu firma" pide una acción
    // y "falta el distrito" no pide ninguna.
    const { esperanMiFirma, esperanOtraFirma } = repartirSalidas(
      [permiso('a', 'emitido', '2026-10-11', [true, true, false])],
      HOY,
      soyJefeDeGrupo,
    )
    expect(esperanMiFirma).toEqual([])
    expect(esperanOtraFirma.map((uno) => uno.id)).toEqual(['a'])
  })

  test('quien no firma nada nunca tiene salidas esperando su firma', () => {
    const { esperanMiFirma, esperanOtraFirma } = repartirSalidas(
      [permiso('a', 'emitido', '2026-10-11', [false, false, false])],
      HOY,
      () => false,
    )
    expect(esperanMiFirma).toEqual([])
    expect(esperanOtraFirma.map((uno) => uno.id)).toEqual(['a'])
  })

  test('próximas son las firmadas que todavía no pasaron, incluida la de hoy', () => {
    const { proximas } = repartirSalidas(
      [
        permiso('vieja', 'firmado', '2026-09-19', [true, true, true]),
        permiso('hoy', 'firmado', HOY, [true, true, true]),
        permiso('futura', 'firmado', '2026-10-11', [true, true, true]),
      ],
      HOY,
      soyJefeDeGrupo,
    )
    expect(proximas.map((uno) => uno.id)).toEqual(['hoy', 'futura'])
  })

  test('borrador y anulado no van a ninguna pila', () => {
    const reparto = repartirSalidas(
      [
        permiso('b', 'borrador', '2026-10-11', []),
        permiso('x', 'anulado', '2026-10-11', [true, false, false]),
      ],
      HOY,
      soyJefeDeGrupo,
    )
    expect(reparto).toEqual({ esperanMiFirma: [], esperanOtraFirma: [], proximas: [] })
  })
})
