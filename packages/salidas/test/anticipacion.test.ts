import { describe, expect, test } from 'bun:test'
import { avisoDeAnticipacion, cuentaRegresivaDeSalida } from '../src/dominio/anticipacion'
import { DIAS_DE_ANTICIPACION } from '../src/dominio/config'

describe('cuentaRegresivaDeSalida', () => {
  test('cuenta los días futuros y nombra hoy y las salidas empezadas', () => {
    expect(cuentaRegresivaDeSalida('2026-10-01', '2026-10-15')).toBe('Faltan 14 días')
    expect(cuentaRegresivaDeSalida('2026-10-01', '2026-10-02')).toBe('Faltan 1 día')
    expect(cuentaRegresivaDeSalida('2026-10-01', '2026-10-01')).toBe('Sale hoy')
    expect(cuentaRegresivaDeSalida('2026-10-02', '2026-10-01')).toBe('Empezó hace 1 día')
  })
})

describe('avisoDeAnticipacion', () => {
  test('con la anticipacion justa no avisa', () => {
    // El limite cuenta como suficiente: pedir 15 dias y avisar a los 15 seria
    // avisar siempre que se cumple la regla.
    expect(avisoDeAnticipacion('2026-10-01', '2026-10-16')).toBeNull()
    expect(DIAS_DE_ANTICIPACION).toBe(15)
  })

  test('con tiempo de sobra tampoco', () => {
    expect(avisoDeAnticipacion('2026-01-01', '2026-10-12')).toBeNull()
  })

  test('un dia menos y avisa, diciendo cuantos faltan', () => {
    const aviso = avisoDeAnticipacion('2026-10-01', '2026-10-15')
    expect(aviso?.codigo).toBe('anticipacionInsuficiente')
    expect(aviso?.mensaje).toContain('14')
  })

  test('el mismo dia avisa', () => {
    expect(avisoDeAnticipacion('2026-10-12', '2026-10-12')?.codigo).toBe('anticipacionInsuficiente')
  })

  test('una salida que ya empezo lo dice distinto', () => {
    // "Faltan -3 dias" no se le puede mostrar a nadie.
    const aviso = avisoDeAnticipacion('2026-10-15', '2026-10-12')
    expect(aviso?.mensaje).toContain('ya empezó')
    expect(aviso?.mensaje).not.toContain('-')
  })

  test('cruzar un cambio de mes se cuenta bien', () => {
    // Del 20 de octubre al 4 de noviembre hay 15 dias: justo el limite.
    expect(avisoDeAnticipacion('2026-10-20', '2026-11-04')).toBeNull()
    expect(avisoDeAnticipacion('2026-10-20', '2026-11-03')).not.toBeNull()
  })

  test('cruzar un 29 de febrero tambien', () => {
    // 2028 es bisiesto: del 15 de febrero al 1 de marzo hay 15 dias.
    expect(avisoDeAnticipacion('2028-02-15', '2028-03-01')).toBeNull()
  })
})
