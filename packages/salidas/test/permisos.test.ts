import { describe, expect, test } from 'bun:test'
import {
  candidatos,
  marcaSegunCategoria,
  puedeTransicionar,
  sePuedeEditar,
  validarDatos,
  validarParticipantes,
} from '../src/dominio/permisos'

const campos = (problemas: readonly { campo: string }[]) => problemas.map((uno) => uno.campo)

describe('marcaSegunCategoria', () => {
  test('el activo es el dirigente; el resto, beneficiario', () => {
    // Es lo que la categoria ya significa: el activo es el que tiene chicos a
    // cargo. Dos formas de decirlo se contradicen.
    expect(marcaSegunCategoria('activo')).toBe('dirigente')
    expect(marcaSegunCategoria('beneficiario')).toBe('beneficiario')
    expect(marcaSegunCategoria('adherente')).toBe('beneficiario')
  })
})

describe('validarDatos', () => {
  const validos = { lugar: 'Estancia La Paz', desde: '2026-10-12', hasta: '2026-10-14' }

  test('unos datos completos no tienen problemas', () => {
    expect(validarDatos(validos)).toEqual([])
  })

  test('una salida de un solo dia es valida', () => {
    expect(validarDatos({ ...validos, hasta: validos.desde })).toEqual([])
  })

  test('volver antes de salir no', () => {
    expect(campos(validarDatos({ ...validos, hasta: '2026-10-11' }))).toEqual(['hasta'])
  })

  test('el lugar en blanco no alcanza', () => {
    expect(campos(validarDatos({ ...validos, lugar: '   ' }))).toEqual(['lugar'])
  })

  test('una fecha que no existe en el almanaque se rechaza', () => {
    // El 30 de febrero pasa cualquier expresion regular de formato.
    expect(campos(validarDatos({ ...validos, desde: '2026-02-30' }))).toEqual(['desde'])
  })

  test('acumula: no corta en el primer problema', () => {
    expect(campos(validarDatos({ lugar: '', desde: 'ayer', hasta: 'mañana' }))).toEqual([
      'lugar',
      'desde',
      'hasta',
    ])
  })
})

describe('candidatos', () => {
  const persona = (
    unidadId: string | null,
    categoria: 'activo' | 'beneficiario' | 'adherente',
  ) => ({
    pertenencia: { unidadId, categoria },
  })

  test('van los de las unidades elegidas y no los de las otras', () => {
    const deLaTropa = persona('u_tropa', 'beneficiario')
    const deLaManada = persona('u_manada', 'beneficiario')
    expect(candidatos([deLaTropa, deLaManada], ['u_tropa'])).toEqual([deLaTropa])
  })

  test('los adultos sin unidad entran siempre', () => {
    // El cocinero es adherente y no pertenece a ninguna unidad, y va igual.
    // Dejarlo afuera seria una regla que no existe en el mundo.
    const cocinero = persona(null, 'adherente')
    expect(candidatos([cocinero], ['u_tropa'])).toEqual([cocinero])
  })

  test('con dos unidades elegidas entran las dos', () => {
    const todos = [persona('u_una', 'beneficiario'), persona('u_otra', 'beneficiario')]
    expect(candidatos(todos, ['u_una', 'u_otra'])).toEqual(todos)
  })

  test('sin unidades elegidas solo quedan los que no tienen', () => {
    const deLaTropa = persona('u_tropa', 'beneficiario')
    const cocinero = persona(null, 'adherente')
    expect(candidatos([deLaTropa, cocinero], [])).toEqual([cocinero])
  })
})

describe('validarParticipantes', () => {
  test('con un dirigente alcanza', () => {
    expect(validarParticipantes([{ marca: 'dirigente' }, { marca: 'beneficiario' }])).toEqual([])
  })

  test('sin ningun dirigente no se puede emitir', () => {
    // Nadie sale sin un adulto a cargo.
    expect(campos(validarParticipantes([{ marca: 'beneficiario' }]))).toEqual(['participantes'])
  })

  test('sin nadie tampoco', () => {
    expect(campos(validarParticipantes([]))).toEqual(['participantes'])
  })
})

describe('puedeTransicionar', () => {
  test('el camino normal', () => {
    expect(puedeTransicionar('borrador', 'emitido')).toBe(true)
    expect(puedeTransicionar('emitido', 'firmado')).toBe(true)
  })

  test('un borrador no se anula: se borra o se deja', () => {
    expect(puedeTransicionar('borrador', 'anulado')).toBe(false)
  })

  test('emitido y firmado si se anulan', () => {
    expect(puedeTransicionar('emitido', 'anulado')).toBe(true)
    expect(puedeTransicionar('firmado', 'anulado')).toBe(true)
  })

  test('de anulado no se sale: re-emitir crea otro permiso', () => {
    expect(puedeTransicionar('anulado', 'borrador')).toBe(false)
    expect(puedeTransicionar('anulado', 'emitido')).toBe(false)
  })

  test('no se vuelve atras', () => {
    expect(puedeTransicionar('emitido', 'borrador')).toBe(false)
    expect(puedeTransicionar('firmado', 'emitido')).toBe(false)
  })
})

describe('sePuedeEditar', () => {
  test('solo el borrador', () => {
    // Es la regla que hace que lo firmado siga diciendo lo mismo.
    expect(sePuedeEditar('borrador')).toBe(true)
    expect(sePuedeEditar('emitido')).toBe(false)
    expect(sePuedeEditar('firmado')).toBe(false)
    expect(sePuedeEditar('anulado')).toBe(false)
  })
})
