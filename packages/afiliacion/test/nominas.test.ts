import { describe, expect, test } from 'bun:test'
import type { MiembroActivo } from '@gps/personas/dominio'
import { armarNominasDeclarables } from '../src/dominio/nominas'

const HORA = new Date('1970-01-01T00:00:00Z')

function miembro(personaId: string, grupoId: string): MiembroActivo {
  return {
    grupoId,
    persona: {
      id: personaId,
      tipoDeDocumento: 'dni',
      numeroDeDocumento: personaId,
      nombres: personaId,
      apellidos: 'Prueba',
      fechaDeNacimiento: '1950-01-01',
      domicilio: 'Av. Siempre Viva 742',
      telefonoDeContacto: '11 5555-1234',
      creadoEn: HORA,
      actualizadoEn: HORA,
    },
  }
}

const DEL_SIETE = miembro('persona_7', 'grupo_7')
const DEL_DOCE = miembro('persona_12', 'grupo_12')

describe('armarNominasDeclarables', () => {
  test('excluye miembros de grupos cerrados', () => {
    const nominas = armarNominasDeclarables([DEL_SIETE, DEL_DOCE], new Set(['grupo_7']), new Set())

    expect([...nominas.keys()]).toEqual(['grupo_7'])
  })

  test('limita la nomina al grupo solicitado', () => {
    const nominas = armarNominasDeclarables(
      [DEL_SIETE, DEL_DOCE],
      new Set(['grupo_7', 'grupo_12']),
      new Set(),
      'grupo_12',
    )

    expect([...nominas.keys()]).toEqual(['grupo_12'])
  })

  test('quita cada grupo que ya declaro sin impedir que declaren los demas', () => {
    const nominas = armarNominasDeclarables(
      [DEL_SIETE, DEL_DOCE],
      new Set(['grupo_7', 'grupo_12']),
      new Set(['grupo_7']),
    )

    expect([...nominas.keys()]).toEqual(['grupo_12'])
  })
})
