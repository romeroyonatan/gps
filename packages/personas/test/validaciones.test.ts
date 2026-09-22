import { describe, expect, test } from 'bun:test'
import type { DatosDePersona } from '../src/dominio/modelos'
import { validarIngreso, validarPersona } from '../src/dominio/validaciones'
import type { DatosDeIngreso } from '../src/dominio/vinculos'

const HOY = new Date(2026, 7, 27)

/** Una persona valida. Cada test la rompe en un solo campo, para que sea obvio
 *  cual es la regla que se esta probando. */
const valida: DatosDePersona = {
  tipoDeDocumento: 'dni',
  numeroDeDocumento: '30111222',
  nombres: 'María Luz',
  apellidos: 'Fernández Ruiz',
  fechaDeNacimiento: '2010-05-01',
  domicilio: 'Av. Siempre Viva 742',
  telefonoDeContacto: '11 5555-1234',
}

const campos = (datos: DatosDePersona) =>
  validarPersona(datos, HOY).map((problema) => problema.campo)

describe('validarPersona', () => {
  test('una persona valida no tiene problemas', () => {
    expect(validarPersona(valida, HOY)).toEqual([])
  })

  test('los nombres no pueden estar vacios ni ser solo espacios', () => {
    expect(campos({ ...valida, nombres: '' })).toEqual(['nombres'])
    expect(campos({ ...valida, nombres: '   ' })).toEqual(['nombres'])
  })

  test('los apellidos tampoco', () => {
    expect(campos({ ...valida, apellidos: '' })).toEqual(['apellidos'])
  })

  test('el domicilio y el teléfono de contacto son obligatorios', () => {
    expect(campos({ ...valida, domicilio: ' ' })).toEqual(['domicilio'])
    expect(campos({ ...valida, telefonoDeContacto: '' })).toEqual(['telefonoDeContacto'])
  })

  test('acumula todos los problemas, no corta en el primero', () => {
    // El formulario marca todos los campos que fallan de una: obligar a
    // corregir de a uno y reenviar es la peor version de esto.
    expect(campos({ ...valida, nombres: '', apellidos: '', numeroDeDocumento: '' })).toEqual([
      'nombres',
      'apellidos',
      'numeroDeDocumento',
    ])
  })

  test('un DNI con puntos es valido: se valida ya normalizado', () => {
    // Si se validara el texto crudo, los puntos harian fallar el formato y el
    // usuario veria un error por escribir el DNI como lo escribe todo el mundo.
    expect(validarPersona({ ...valida, numeroDeDocumento: '30.111.222' }, HOY)).toEqual([])
  })

  test('un DNI tiene 7 u 8 digitos', () => {
    expect(validarPersona({ ...valida, numeroDeDocumento: '1234567' }, HOY)).toEqual([])
    expect(campos({ ...valida, numeroDeDocumento: '123456' })).toEqual(['numeroDeDocumento'])
    expect(campos({ ...valida, numeroDeDocumento: '123456789' })).toEqual(['numeroDeDocumento'])
    expect(campos({ ...valida, numeroDeDocumento: 'AB123456' })).toEqual(['numeroDeDocumento'])
  })

  test('un pasaporte es alfanumerico de 5 a 15', () => {
    const pasaporte = { ...valida, tipoDeDocumento: 'pasaporte' } as const
    expect(validarPersona({ ...pasaporte, numeroDeDocumento: 'ab12345' }, HOY)).toEqual([])
    expect(campos({ ...pasaporte, numeroDeDocumento: 'AB12' })).toEqual(['numeroDeDocumento'])
    expect(campos({ ...pasaporte, numeroDeDocumento: 'AB/12345' })).toEqual(['numeroDeDocumento'])
  })

  test('el numero de documento no puede estar vacio', () => {
    expect(campos({ ...valida, numeroDeDocumento: '' })).toEqual(['numeroDeDocumento'])
    expect(campos({ ...valida, numeroDeDocumento: '...' })).toEqual(['numeroDeDocumento'])
  })

  test('la fecha tiene que tener el formato aaaa-mm-dd', () => {
    expect(campos({ ...valida, fechaDeNacimiento: '01/05/2010' })).toEqual(['fechaDeNacimiento'])
    expect(campos({ ...valida, fechaDeNacimiento: '2010-5-1' })).toEqual(['fechaDeNacimiento'])
    expect(campos({ ...valida, fechaDeNacimiento: '' })).toEqual(['fechaDeNacimiento'])
  })

  test('la fecha tiene que existir en el almanaque', () => {
    // Con solo mirar el formato, "2010-02-30" pasaria: tiene cuatro digitos,
    // dos y dos. El 30 de febrero no existe.
    expect(campos({ ...valida, fechaDeNacimiento: '2010-02-30' })).toEqual(['fechaDeNacimiento'])
    expect(campos({ ...valida, fechaDeNacimiento: '2010-13-01' })).toEqual(['fechaDeNacimiento'])
  })

  test('el 29 de febrero de un anio bisiesto si existe', () => {
    expect(validarPersona({ ...valida, fechaDeNacimiento: '2012-02-29' }, HOY)).toEqual([])
    expect(campos({ ...valida, fechaDeNacimiento: '2011-02-29' })).toEqual(['fechaDeNacimiento'])
  })

  test('la fecha de nacimiento no puede ser futura', () => {
    expect(campos({ ...valida, fechaDeNacimiento: '2026-08-28' })).toEqual(['fechaDeNacimiento'])
  })

  test('nacer hoy es valido', () => {
    expect(validarPersona({ ...valida, fechaDeNacimiento: '2026-08-27' }, HOY)).toEqual([])
  })

  test('no se aceptan mas de 120 anios, que es el tope contra el dedazo', () => {
    expect(validarPersona({ ...valida, fechaDeNacimiento: '1906-08-27' }, HOY)).toEqual([])
    expect(campos({ ...valida, fechaDeNacimiento: '1025-08-27' })).toEqual(['fechaDeNacimiento'])
  })
})

// El reloj de los tests esta en 1970, asi que un ingreso valido tiene que ser
// anterior. Es incomodo y es a proposito: obliga a que se note si alguien se
// cuelga la hora real.
const HOY_INGRESO = new Date(1970, 0, 1, 12)

const ingreso: DatosDeIngreso = {
  grupoId: 'grupo_1',
  categoria: 'beneficiario',
  unidadId: 'unidad_lob',
  desde: '1969-03-01',
  cargos: [],
}

const ABIERTAS = [{ id: 'unidad_lob' }, { id: 'unidad_sco' }] as const

const camposDeIngreso = (problemas: readonly { campo: string }[]) => problemas.map((p) => p.campo)

describe('validarIngreso', () => {
  test('un ingreso completo no tiene problemas', () => {
    expect(validarIngreso(ingreso, ABIERTAS, HOY_INGRESO)).toEqual([])
  })

  test('un beneficiario sin unidad es un dato incompleto', () => {
    expect(
      camposDeIngreso(validarIngreso({ ...ingreso, unidadId: null }, ABIERTAS, HOY_INGRESO)),
    ).toEqual(['unidad'])
  })

  test('un activo sin unidad tambien: hasta el jefe de grupo da en alguna', () => {
    const activo = { ...ingreso, categoria: 'activo' as const, unidadId: null }
    expect(camposDeIngreso(validarIngreso(activo, ABIERTAS, HOY_INGRESO))).toEqual(['unidad'])
  })

  test('un adherente con unidad es una contradiccion', () => {
    const adherente = { ...ingreso, categoria: 'adherente' as const }
    expect(camposDeIngreso(validarIngreso(adherente, ABIERTAS, HOY_INGRESO))).toEqual(['unidad'])
  })

  test('un adherente sin unidad esta bien', () => {
    const adherente = { ...ingreso, categoria: 'adherente' as const, unidadId: null }
    expect(validarIngreso(adherente, ABIERTAS, HOY_INGRESO)).toEqual([])
  })

  test('la unidad tiene que estar abierta en ese grupo', () => {
    // Es la regla que el servidor no podia verificar antes de que un modulo
    // pudiera alcanzar al otro. Estar en la lista es a la vez existir, estar
    // abierta y ser de este grupo: obtenerGrupo devuelve solo esas.
    expect(
      camposDeIngreso(
        validarIngreso({ ...ingreso, unidadId: 'unidad_de_otro' }, ABIERTAS, HOY_INGRESO),
      ),
    ).toEqual(['unidad'])
  })

  test('a quien va en cual no lo decide el sistema', () => {
    // Una unidad femenina y otra masculina admiten a cualquiera: Persona ni
    // siquiera guarda sexo. Lo deciden los dirigentes.
    expect(validarIngreso({ ...ingreso, unidadId: 'unidad_sco' }, ABIERTAS, HOY_INGRESO)).toEqual(
      [],
    )
  })

  test('la fecha de ingreso tiene que ser del almanaque', () => {
    expect(
      camposDeIngreso(validarIngreso({ ...ingreso, desde: '1969-02-30' }, ABIERTAS, HOY_INGRESO)),
    ).toEqual(['desde'])
  })

  test('la fecha de ingreso no puede ser futura', () => {
    expect(
      camposDeIngreso(validarIngreso({ ...ingreso, desde: '1971-01-01' }, ABIERTAS, HOY_INGRESO)),
    ).toEqual(['desde'])
  })

  test('un cargo que no es del grupo no se puede cargar en el alta', () => {
    // El alta lo guardaria con el grupo como ambito, y un comisionado de
    // distrito con un grupo por distrito no es ningun cargo.
    const cargos = [{ cargo: 'comisionadoDeDistrito' as const, hasta: null }]
    expect(camposDeIngreso(validarIngreso({ ...ingreso, cargos }, ABIERTAS, HOY_INGRESO))).toEqual([
      'cargos',
    ])
  })

  test('el mismo cargo no puede ir dos veces', () => {
    const cargos = [
      { cargo: 'jefeDeRama' as const, hasta: null },
      { cargo: 'jefeDeRama' as const, hasta: null },
    ]
    expect(camposDeIngreso(validarIngreso({ ...ingreso, cargos }, ABIERTAS, HOY_INGRESO))).toEqual([
      'cargos',
    ])
  })

  test('un cargo puede terminar en el futuro: un mandato dura cuatro anios', () => {
    const cargos = [{ cargo: 'jefeDeGrupo' as const, hasta: '1973-03-01' }]
    expect(validarIngreso({ ...ingreso, cargos }, ABIERTAS, HOY_INGRESO)).toEqual([])
  })

  test('un cargo no puede terminar antes de empezar', () => {
    const cargos = [{ cargo: 'jefeDeGrupo' as const, hasta: '1968-01-01' }]
    expect(camposDeIngreso(validarIngreso({ ...ingreso, cargos }, ABIERTAS, HOY_INGRESO))).toEqual([
      'cargos',
    ])
  })

  test('acumula: no corta en el primer problema', () => {
    const roto = { ...ingreso, unidadId: 'unidad_de_otro', desde: '1971-01-01' }
    expect(camposDeIngreso(validarIngreso(roto, ABIERTAS, HOY_INGRESO))).toEqual([
      'unidad',
      'desde',
    ])
  })
})
