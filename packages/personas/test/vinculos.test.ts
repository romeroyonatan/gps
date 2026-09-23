import { describe, expect, test } from 'bun:test'
import { estaVigente, estaVigenteParaAcceso, validarCambioDeUnidad } from '../src/dominio/vinculos'

/** Un mediodia, no una medianoche: a las 00:00 UTC-3 el dia local y el UTC son
 *  distintos, y eso es lo que este test tiene que poder distinguir. */
const mediodia = (texto: string) => new Date(`${texto}T12:00:00`)

describe('estaVigente', () => {
  const cargo = { desde: '2026-03-01', hasta: '2030-03-01' }

  test('el dia que empieza ya esta vigente', () => {
    expect(estaVigente(cargo, mediodia('2026-03-01'))).toBe(true)
  })

  test('la vispera todavia no', () => {
    expect(estaVigente(cargo, mediodia('2026-02-28'))).toBe(false)
  })

  test('el dia que termina sigue vigente', () => {
    // El `hasta` es inclusivo: un mandato "hasta el 1 de marzo de 2030" incluye
    // ese dia.
    expect(estaVigente(cargo, mediodia('2030-03-01'))).toBe(true)
  })

  test('el dia siguiente al fin ya no', () => {
    expect(estaVigente(cargo, mediodia('2030-03-02'))).toBe(false)
  })

  test('sin hasta, sigue vigente para siempre', () => {
    expect(estaVigente({ desde: '2026-03-01', hasta: null }, mediodia('2099-01-01'))).toBe(true)
  })
})

describe('estaVigenteParaAcceso', () => {
  test('una remocion inmediata corta el acceso aunque el mandato siga vigente', () => {
    expect(
      estaVigenteParaAcceso(
        {
          desde: '2026-03-01',
          hasta: '2030-03-01',
          revocadoEn: new Date('2027-06-01T15:00:00Z'),
        },
        mediodia('2027-06-01'),
      ),
    ).toBe(false)
  })

  test('sin revocacion respeta el periodo inclusivo', () => {
    expect(
      estaVigenteParaAcceso(
        { desde: '2026-03-01', hasta: '2030-03-01', revocadoEn: null },
        mediodia('2030-03-01'),
      ),
    ).toBe(true)
  })
})

// El reloj de los tests esta en 1970: una fecha de sistema colada se nota.
const HOY_CAMBIO = new Date(1970, 0, 1, 12)

const dirigente = { categoria: 'activo' as const, unidadId: 'unidad_lob', desde: '1969-03-01' }
const ABIERTAS = [{ id: 'unidad_lob' }, { id: 'unidad_sco' }]

const campos = (problemas: readonly { campo: string }[]) => problemas.map((p) => p.campo)

describe('validarCambioDeUnidad', () => {
  test('un dirigente pasa a otra unidad abierta del grupo', () => {
    expect(
      validarCambioDeUnidad(dirigente, 'unidad_sco', '1969-12-01', ABIERTAS, HOY_CAMBIO),
    ).toEqual([])
  })

  test('un beneficiario no cambia de unidad por aca: eso es una ceremonia', () => {
    const chico = { ...dirigente, categoria: 'beneficiario' as const }
    expect(
      campos(validarCambioDeUnidad(chico, 'unidad_sco', '1969-12-01', ABIERTAS, HOY_CAMBIO)),
    ).toEqual(['unidad'])
  })

  test('un adherente tampoco', () => {
    const adherente = { categoria: 'adherente' as const, unidadId: null, desde: '1969-03-01' }
    expect(
      campos(validarCambioDeUnidad(adherente, 'unidad_sco', '1969-12-01', ABIERTAS, HOY_CAMBIO)),
    ).toEqual(['unidad'])
  })

  test('la unidad en la que ya esta no es un cambio', () => {
    expect(
      campos(validarCambioDeUnidad(dirigente, 'unidad_lob', '1969-12-01', ABIERTAS, HOY_CAMBIO)),
    ).toEqual(['unidad'])
  })

  test('la unidad tiene que estar abierta en ese grupo', () => {
    expect(
      campos(
        validarCambioDeUnidad(dirigente, 'unidad_de_otro', '1969-12-01', ABIERTAS, HOY_CAMBIO),
      ),
    ).toEqual(['unidad'])
  })

  test('la fecha no puede ser futura', () => {
    expect(
      campos(validarCambioDeUnidad(dirigente, 'unidad_sco', '1971-01-01', ABIERTAS, HOY_CAMBIO)),
    ).toEqual(['desde'])
  })

  test('la fecha tiene que ser del almanaque', () => {
    expect(
      campos(validarCambioDeUnidad(dirigente, 'unidad_sco', '1969-02-30', ABIERTAS, HOY_CAMBIO)),
    ).toEqual(['desde'])
  })

  test('el cambio tiene que ser posterior al desde de la pertenencia vigente', () => {
    // Si no, la pertenencia que se cierra naceria terminada: su hasta seria
    // anterior a su desde.
    expect(
      campos(validarCambioDeUnidad(dirigente, 'unidad_sco', '1969-03-01', ABIERTAS, HOY_CAMBIO)),
    ).toEqual(['desde'])
    expect(
      campos(validarCambioDeUnidad(dirigente, 'unidad_sco', '1969-01-01', ABIERTAS, HOY_CAMBIO)),
    ).toEqual(['desde'])
  })

  test('hoy es una fecha valida', () => {
    expect(
      validarCambioDeUnidad(dirigente, 'unidad_sco', '1970-01-01', ABIERTAS, HOY_CAMBIO),
    ).toEqual([])
  })
})
