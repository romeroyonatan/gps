import { describe, expect, test } from 'bun:test'
import {
  armarReporteDeCobranza,
  type DatosDelReporte,
  periodosDelReporte,
  variacion,
} from '../src/dominio'

/** Dos distritos, tres grupos. El período 2026 va del 2026-03-01 al
 *  2027-02-28: por eso un pago del 2027-01 todavía cuenta como del 2026. */
const DATOS: DatosDelReporte = {
  distritos: [
    { id: 'd-norte', numero: 1, zona: 'Norte' },
    { id: 'd-sur', numero: 2, zona: 'Sur' },
  ],
  grupos: [
    { id: 'g7', distritoId: 'd-norte' },
    { id: 'g12', distritoId: 'd-norte' },
    { id: 'g31', distritoId: 'd-sur' },
  ],
  declaraciones: [
    { grupoId: 'g7', periodo: 2026 },
    { grupoId: 'g31', periodo: 2026 },
    { grupoId: 'g12', periodo: 2025 },
  ],
  movimientos: [
    // Facturado del período: dos cargos, 23 y 65 personas.
    {
      grupoId: 'g7',
      tipo: 'cargo_afiliacion',
      importe: 207000,
      periodo: 2026,
      cantidad: 23,
      fecha: '2026-05-01',
    },
    {
      grupoId: 'g31',
      tipo: 'cargo_afiliacion',
      importe: 285000,
      periodo: 2026,
      cantidad: 65,
      fecha: '2026-05-02',
    },
    // Del período anterior: entra en `anterior`, no en el corriente.
    {
      grupoId: 'g12',
      tipo: 'cargo_afiliacion',
      importe: 100000,
      periodo: 2025,
      cantidad: 10,
      fecha: '2025-05-01',
    },
    // Cobrado: el pago se guarda en negativo.
    {
      grupoId: 'g7',
      tipo: 'pago',
      importe: -200000,
      periodo: null,
      cantidad: null,
      fecha: '2026-09-16',
    },
    // Enero es la cola del período 2026, no el arranque del 2027.
    {
      grupoId: 'g31',
      tipo: 'pago',
      importe: -85000,
      periodo: null,
      cantidad: null,
      fecha: '2027-01-10',
    },
    // Una anulación resta de lo cobrado del período en que cae su fecha.
    {
      grupoId: 'g31',
      tipo: 'anulacion_pago',
      importe: 25000,
      periodo: null,
      cantidad: null,
      fecha: '2027-01-20',
    },
    // Febrero del 2026 todavía es del período 2025.
    {
      grupoId: 'g12',
      tipo: 'pago',
      importe: -40000,
      periodo: null,
      cantidad: null,
      fecha: '2026-02-10',
    },
  ],
}

describe('cobranza por distrito', () => {
  const reporte = armarReporteDeCobranza(2026, DATOS)

  test('ordena los distritos por número y cuenta sus grupos', () => {
    expect(reporte.porDistrito.map((fila) => fila.zona)).toEqual(['Norte', 'Sur'])
    expect(reporte.porDistrito.map((fila) => fila.grupos)).toEqual([2, 1])
  })

  test('cuenta los grupos que declararon en el período, no las declaraciones', () => {
    // g12 declaró, pero en el período anterior: no cuenta acá.
    expect(reporte.porDistrito.map((fila) => fila.declararon)).toEqual([1, 1])
  })

  test('factura por el período del cargo', () => {
    expect(reporte.porDistrito.map((fila) => fila.facturado)).toEqual([207000, 285000])
    expect(reporte.totales.facturado).toBe(492000)
    expect(reporte.totales.personasCobradas).toBe(88)
  })

  // La decisión del reporte: el pago no tiene período, así que cuenta en el
  // período en que cae su fecha.
  test('cobra por la fecha del pago, con enero todavía adentro del período', () => {
    expect(reporte.porDistrito[0]?.cobrado).toBe(200000)
    // 85.000 cobrados en enero menos 25.000 anulados en enero.
    expect(reporte.porDistrito[1]?.cobrado).toBe(60000)
    expect(reporte.totales.cobrado).toBe(260000)
  })

  test('la deuda del período es lo facturado menos lo cobrado', () => {
    expect(reporte.porDistrito.map((fila) => fila.deuda)).toEqual([7000, 225000])
    expect(reporte.totales.deuda).toBe(232000)
  })

  test('el período anterior se cierra con sus propios cargos y pagos', () => {
    expect(reporte.anterior.periodo).toBe(2025)
    expect(reporte.anterior.facturado).toBe(100000)
    expect(reporte.anterior.cobrado).toBe(40000)
    expect(reporte.anterior.declararon).toBe(1)
    expect(reporte.anterior.personasCobradas).toBe(10)
  })

  test('un período sin nada da un reporte en cero y no rompe', () => {
    const vacio = armarReporteDeCobranza(2030, DATOS)
    expect(vacio.totales.facturado).toBe(0)
    expect(vacio.totales.cobrado).toBe(0)
    expect(vacio.porDistrito.map((fila) => fila.deuda)).toEqual([0, 0])
  })
})

describe('variación entre períodos', () => {
  test('escribe la diferencia y el porcentaje', () => {
    expect(variacion(1987, 2104)).toEqual({ absoluta: 117, porcentaje: expect.closeTo(5.888, 2) })
    expect(variacion(24, 19).absoluta).toBe(-5)
  })

  // Desde cero no hay porcentaje: "+100 %" sería inventar una base.
  test('sin base no hay porcentaje', () => {
    expect(variacion(0, 5000)).toEqual({ absoluta: 5000, porcentaje: null })
  })
})

describe('períodos que ofrece el reporte', () => {
  test('el corriente primero y después los que tienen cuota, sin repetir', () => {
    expect(periodosDelReporte('2026-09-20', [2024, 2026, 2025])).toEqual([2026, 2025, 2024])
  })

  // Enero es la cola del período anterior: el corriente ahí es 2026, no 2027.
  test('el corriente sale de la misma regla que parte la historia', () => {
    expect(periodosDelReporte('2027-01-15', [])).toEqual([2026])
  })

  test('el corriente se ofrece aunque todavía no tenga cuota', () => {
    expect(periodosDelReporte('2026-09-20', [2025])).toEqual([2026, 2025])
  })
})
