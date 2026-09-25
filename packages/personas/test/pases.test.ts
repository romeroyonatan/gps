import { describe, expect, test } from 'bun:test'
import {
  candidatosAlPase,
  destinoPropuesto,
  destinosDelPase,
  validarPase,
} from '../src/dominio/pases'

const unidad = (
  id: string,
  rama: string,
  sexo: 'masculina' | 'femenina' | 'mixta',
  nombre = id,
  // biome-ignore lint/suspicious/noExplicitAny: la rama viene del catalogo, no del test
) => ({ id, rama: rama as any, sexo, nombre })

const manada = unidad('manada', 'lobatos', 'masculina', 'Seeonee')
const tropa = unidad('tropa', 'scouts', 'masculina', 'San Jorge')
const tropaFemenina = unidad('tropa-f', 'scouts', 'femenina', 'Santa Juana')
const clan = unidad('clan', 'rovers', 'mixta', 'Camino')
const adultos = unidad('adultos', 'adultos', 'mixta', 'Tropa')

describe('destinosDelPase', () => {
  test('el destino de la Manada es la Tropa scout', () => {
    const destinos = destinosDelPase(manada, [manada, tropa])
    expect(destinos).toEqual([{ unidad: tropa, categoria: 'beneficiario' }])
  })

  test('con dos tropas, las dos son destino', () => {
    const destinos = destinosDelPase(manada, [manada, tropa, tropaFemenina])
    expect(destinos.map((destino) => destino.unidad.id)).toEqual(['tropa', 'tropa-f'])
  })

  test('sin unidad de la rama siguiente no hay destino', () => {
    expect(destinosDelPase(manada, [manada, clan])).toEqual([])
  })

  test('del Clan se pasa a Adultos o se pasa a dirigente en cualquier unidad', () => {
    const destinos = destinosDelPase(clan, [manada, tropa, clan, adultos])
    expect(destinos).toEqual([
      { unidad: adultos, categoria: 'beneficiario' },
      { unidad: manada, categoria: 'activo' },
      { unidad: tropa, categoria: 'activo' },
      { unidad: clan, categoria: 'activo' },
      { unidad: adultos, categoria: 'activo' },
    ])
  })

  test('Adultos no tiene destinos: es la ultima rama', () => {
    expect(destinosDelPase(adultos, [manada, tropa, adultos])).toEqual([])
  })
})

describe('destinoPropuesto', () => {
  test('si hay uno solo, ese', () => {
    const destinos = destinosDelPase(manada, [manada, tropa])
    expect(destinoPropuesto(manada, destinos)?.unidad.id).toBe('tropa')
  })

  test('con dos tropas se propone la del sexo de la unidad de origen', () => {
    const destinos = destinosDelPase(manada, [manada, tropa, tropaFemenina])
    expect(destinoPropuesto(manada, destinos)?.unidad.id).toBe('tropa')
  })

  test('desde una unidad mixta con dos destinos no se propone ninguno', () => {
    const manadaMixta = unidad('manada-m', 'lobatos', 'mixta')
    const destinos = destinosDelPase(manadaMixta, [manadaMixta, tropa, tropaFemenina])
    expect(destinoPropuesto(manadaMixta, destinos)).toBeUndefined()
  })
})

describe('candidatosAlPase', () => {
  const beneficiario = (id: string, fechaDeNacimiento: string, unidadId = 'manada') => ({
    id,
    fechaDeNacimiento,
    pertenencia: { unidadId, categoria: 'beneficiario' as const },
  })
  const fecha = '2026-04-10'

  test('el que ya tiene la edad de la rama siguiente esta propuesto', () => {
    // Lobatos va de 7 a 10, con el 10 excluido: el de 10 ya es scout.
    const [bloque] = candidatosAlPase([beneficiario('a', '2016-04-10')], [manada], fecha)
    expect(bloque?.cumplen.map((candidato) => candidato.persona.id)).toEqual(['a'])
    expect(bloque?.cumplen[0]?.edad).toBe(10)
  })

  test('la vispera del cumpleanios todavia esta entre los cercanos', () => {
    const [bloque] = candidatosAlPase([beneficiario('a', '2016-04-11')], [manada], fecha)
    expect(bloque?.cumplen).toEqual([])
    expect(bloque?.cerca.map((candidato) => candidato.persona.id)).toEqual(['a'])
  })

  test('el que cumple dentro de los doce meses esta entre los cercanos', () => {
    const [bloque] = candidatosAlPase([beneficiario('a', '2016-08-10')], [manada], fecha)
    expect(bloque?.cerca.map((candidato) => candidato.persona.id)).toEqual(['a'])
  })

  test('el que esta lejos no aparece', () => {
    const [bloque] = candidatosAlPase([beneficiario('a', '2018-04-10')], [manada], fecha)
    expect(bloque?.cumplen).toEqual([])
    expect(bloque?.cerca).toEqual([])
  })

  test('los dirigentes no son candidatos', () => {
    const dirigente = {
      id: 'd',
      fechaDeNacimiento: '1996-01-01',
      pertenencia: { unidadId: 'manada', categoria: 'activo' as const },
    }
    const [bloque] = candidatosAlPase([dirigente], [manada], fecha)
    expect(bloque?.cumplen).toEqual([])
    expect(bloque?.cerca).toEqual([])
  })

  test('cada unidad elegida trae su bloque, y los de otra unidad no se cuelan', () => {
    const personas = [
      beneficiario('lobato', '2016-04-10'),
      beneficiario('scout', '2012-04-10', 'tropa'),
    ]
    const bloques = candidatosAlPase(personas, [manada, tropa], fecha)
    expect(bloques.map((bloque) => bloque.unidad.id)).toEqual(['manada', 'tropa'])
    expect(bloques[0]?.cumplen.map((candidato) => candidato.persona.id)).toEqual(['lobato'])
    expect(bloques[1]?.cumplen.map((candidato) => candidato.persona.id)).toEqual(['scout'])
  })

  test('una unidad de Adultos no tiene candidatos: no hay a donde pasar', () => {
    const grande = {
      id: 'g',
      fechaDeNacimiento: '1980-01-01',
      pertenencia: { unidadId: 'adultos', categoria: 'beneficiario' as const },
    }
    const [bloque] = candidatosAlPase([grande], [adultos], fecha)
    expect(bloque?.cumplen).toEqual([])
    expect(bloque?.cerca).toEqual([])
  })
})

describe('validarPase', () => {
  const abiertas = [manada, tropa, clan, adultos]
  const hoy = new Date('2026-04-20T12:00:00')
  const fecha = '2026-04-10'
  const pertenencia = {
    categoria: 'beneficiario' as const,
    unidadId: 'manada',
    desde: '2024-03-01',
  }
  const pase = {
    personaId: 'p',
    unidadDeOrigenId: 'manada',
    unidadDestinoId: 'tropa',
    categoria: 'beneficiario' as const,
  }

  test('el pase de un lobato a la tropa no tiene problemas', () => {
    expect(validarPase(pase, pertenencia, fecha, abiertas, hoy)).toEqual([])
  })

  test('un dirigente no pasa por la ceremonia', () => {
    const problemas = validarPase(
      pase,
      { ...pertenencia, categoria: 'activo' },
      fecha,
      abiertas,
      hoy,
    )
    expect(problemas[0]?.mensaje).toContain('beneficiarios')
  })

  test('si ya no esta en la unidad de origen, se rechaza', () => {
    const problemas = validarPase(pase, { ...pertenencia, unidadId: 'tropa' }, fecha, abiertas, hoy)
    expect(problemas[0]?.mensaje).toContain('volvé a cargar')
  })

  test('de la Manada no se pasa al Clan', () => {
    const alClan = { ...pase, unidadDestinoId: 'clan' }
    expect(validarPase(alClan, pertenencia, fecha, abiertas, hoy)).toHaveLength(1)
  })

  test('un rover pasa a dirigente en la Manada', () => {
    const aDirigente = {
      personaId: 'p',
      unidadDeOrigenId: 'clan',
      unidadDestinoId: 'manada',
      categoria: 'activo' as const,
    }
    const delClan = { ...pertenencia, unidadId: 'clan' }
    expect(validarPase(aDirigente, delClan, fecha, abiertas, hoy)).toEqual([])
  })

  test('pero no entra a la Manada como beneficiario', () => {
    const comoChico = {
      personaId: 'p',
      unidadDeOrigenId: 'clan',
      unidadDestinoId: 'manada',
      categoria: 'beneficiario' as const,
    }
    const delClan = { ...pertenencia, unidadId: 'clan' }
    expect(validarPase(comoChico, delClan, fecha, abiertas, hoy)).toHaveLength(1)
  })

  test('la fecha no puede ser futura', () => {
    const problemas = validarPase(pase, pertenencia, '2026-04-21', abiertas, hoy)
    expect(problemas[0]?.campo).toBe('desde')
  })

  test('ni anterior al comienzo de la pertenencia vigente', () => {
    const problemas = validarPase(pase, pertenencia, '2024-03-01', abiertas, hoy)
    expect(problemas[0]?.campo).toBe('desde')
  })
})
