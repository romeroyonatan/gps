import { describe, expect, test } from 'bun:test'
import type { MiembroDelGrupo } from '@gps/personas/dominio'
import { armarLaNomina } from '../src/dominio/nomina'

const UNIDADES = new Map([
  ['u-scouts', 'scouts' as const],
  ['u-lobatos', 'lobatos' as const],
])

function miembro(
  id: string,
  apellidos: string,
  nombres: string,
  categoria: MiembroDelGrupo['categoria'],
  unidadId: string | null,
): MiembroDelGrupo {
  return {
    persona: {
      id,
      apellidos,
      nombres,
      tipoDeDocumento: 'dni',
      numeroDeDocumento: '40000000',
      fechaDeNacimiento: '2010-01-01',
      domicilio: 'Av. Siempre Viva 742',
      telefonoDeContacto: '11 5555-1234',
      creadoEn: new Date(0),
      actualizadoEn: new Date(0),
    },
    unidadId,
    categoria,
  }
}

const GENTE = [
  miembro('p3', 'Ojeda', 'Ramiro', 'activo', 'u-lobatos'),
  miembro('p1', 'Álvarez', 'Bautista', 'beneficiario', 'u-scouts'),
  miembro('p4', 'Quiroga', 'Andrés', 'adherente', null),
  miembro('p2', 'Aguirre', 'Malena', 'beneficiario', 'u-lobatos'),
]

describe('armarLaNomina', () => {
  test('agrupa por categoría y numera corrido entre las tres', () => {
    const secciones = armarLaNomina(GENTE, UNIDADES, new Set(), 2026)

    expect(secciones.map((seccion) => seccion.titulo)).toEqual([
      'Beneficiarios',
      'Activos',
      'Adherentes',
    ])
    expect(secciones.flatMap((seccion) => seccion.filas).map((fila) => fila.numero)).toEqual([
      1, 2, 3, 4,
    ])
  })

  test('ordena alfabéticamente en español dentro de cada categoría', () => {
    const [beneficiarios] = armarLaNomina(GENTE, UNIDADES, new Set(), 2026)
    // Aguirre antes que Álvarez: por bytes la tilde los daría vuelta.
    expect(beneficiarios?.filas.map((fila) => fila.celdas[0])).toEqual([
      'Aguirre, Malena',
      'Álvarez, Bautista',
    ])
  })

  test('escribe la afiliación con el período, o "Sin afiliar"', () => {
    const [beneficiarios] = armarLaNomina(GENTE, UNIDADES, new Set(['p2']), 2026)
    expect(beneficiarios?.filas.map((fila) => fila.celdas.at(-1))).toEqual([
      'Afiliación 2026',
      'Sin afiliar',
    ])
  })

  test('la rama sale de la unidad, y el adherente no tiene', () => {
    const secciones = armarLaNomina(GENTE, UNIDADES, new Set(), 2026)
    expect(secciones.at(0)?.filas.at(0)?.celdas[2]).toBe('Lobatos')
    expect(secciones.at(-1)?.filas.at(0)?.celdas[2]).toBe('')
  })

  test('una categoría sin nadie no sale', () => {
    const secciones = armarLaNomina([GENTE[0] as MiembroDelGrupo], UNIDADES, new Set(), 2026)
    expect(secciones.map((seccion) => seccion.titulo)).toEqual(['Activos'])
  })
})
