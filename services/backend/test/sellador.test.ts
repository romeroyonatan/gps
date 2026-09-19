import { describe, expect, test } from 'bun:test'
import { crearSellador } from '../src/sellador'

const VIEJA = '2026-03'
const NUEVA = '2026-09'
const CLAVES = { [VIEJA]: 'la-de-marzo', [NUEVA]: 'la-de-septiembre' }

describe('crearSellador', () => {
  test('lo que sella lo verifica', () => {
    const sellador = crearSellador(CLAVES, NUEVA)
    const sello = sellador.sellar('unos datos')
    expect(sellador.verificar('unos datos', sello)).toBe(true)
  })

  test('sella con la clave activa y lo dice en el sello', () => {
    expect(crearSellador(CLAVES, NUEVA).sellar('x').claveId).toBe(NUEVA)
  })

  test('datos alterados no verifican', () => {
    // Es para lo que existe: una fila cambiada en la base no puede hacerse
    // pasar por firmada.
    const sellador = crearSellador(CLAVES, NUEVA)
    expect(sellador.verificar('otros datos', sellador.sellar('unos datos'))).toBe(false)
  })

  test('una firma sellada con la clave anterior sigue verificando', () => {
    // Es lo que permite rotar: se agrega la clave nueva, se apunta la activa a
    // ella, y lo firmado antes sigue valiendo.
    const antes = crearSellador(CLAVES, VIEJA)
    const sello = antes.sellar('unos datos')
    const despues = crearSellador(CLAVES, NUEVA)
    expect(despues.verificar('unos datos', sello)).toBe(true)
    expect(sello.claveId).toBe(VIEJA)
  })

  test('un sello de una clave que ya no esta configurada no verifica', () => {
    // No se puede afirmar que sea legitimo, asi que es false y no una
    // excepcion: el consumidor muestra "no verificada", no se cae.
    const sellador = crearSellador({ sola: 'una' }, 'sola')
    expect(sellador.verificar('x', { sello: 'lo-que-sea', claveId: 'retirada' })).toBe(false)
  })

  test('sellos de claves distintas no son intercambiables', () => {
    const conVieja = crearSellador(CLAVES, VIEJA).sellar('unos datos')
    const conNueva = crearSellador(CLAVES, NUEVA).sellar('unos datos')
    expect(conVieja.sello).not.toBe(conNueva.sello)
  })

  test('un sello cortado no verifica y no rompe', () => {
    // Llega de la base: no se puede suponer que tenga el largo correcto, y
    // timingSafeEqual tira si los largos no coinciden.
    const sellador = crearSellador(CLAVES, NUEVA)
    expect(sellador.verificar('x', { sello: 'abc', claveId: NUEVA })).toBe(false)
  })

  test('una clave activa que no esta configurada es un error al construir', () => {
    // Al arrancar y no al sellar: sellar con undefined seria un sello que no
    // prueba nada, y se descubriria recien al verificar.
    expect(() => crearSellador(CLAVES, 'inexistente')).toThrow()
  })
})
