import { describe, expect, test } from 'bun:test'
import type { ParticipanteEmitido, Permiso } from '../src/dominio/modelos'
import {
  candidatos,
  contenidoDelPermiso,
  marcaSegunCategoria,
  numeroDeExpediente,
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
  const validos = {
    lugar: 'Estancia La Paz',
    direccion: 'Ruta 9 km 500',
    localidad: 'Los Patos',
    provincia: 'Santa Fe',
    telefono: '11 5488-2210',
    desde: '2026-10-12',
    hasta: '2026-10-14',
  }

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

  test('la dirección, la localidad y la provincia son obligatorias', () => {
    // Una dirección sin localidad ni provincia no lleva a nadie a ningún lado.
    expect(campos(validarDatos({ ...validos, direccion: '  ', provincia: '' }))).toEqual([
      'direccion',
      'provincia',
    ])
  })

  test('una fecha que no existe en el almanaque se rechaza', () => {
    // El 30 de febrero pasa cualquier expresion regular de formato.
    expect(campos(validarDatos({ ...validos, desde: '2026-02-30' }))).toEqual(['desde'])
  })

  test('acumula: no corta en el primer problema', () => {
    expect(
      campos(
        validarDatos({
          lugar: '',
          direccion: 'Ruta 9 km 500',
          localidad: 'Los Patos',
          provincia: 'Santa Fe',
          telefono: '11 5488-2210',
          desde: 'ayer',
          hasta: 'mañana',
        }),
      ),
    ).toEqual(['lugar', 'desde', 'hasta'])
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
  const jefa = { personaId: 'persona_jefa', marca: 'dirigente' } as const
  const chico = { personaId: 'persona_chico', marca: 'beneficiario' } as const

  test('con un dirigente y su responsable alcanza', () => {
    expect(validarParticipantes([jefa, chico], jefa.personaId)).toEqual([])
  })

  test('sin ningun dirigente no se puede emitir', () => {
    // Nadie sale sin un adulto a cargo.
    expect(campos(validarParticipantes([chico], null))).toEqual(['participantes'])
  })

  test('sin nadie tampoco', () => {
    expect(campos(validarParticipantes([], null))).toEqual(['participantes'])
  })

  test('sin responsable elegido no se emite', () => {
    expect(campos(validarParticipantes([jefa, chico], null))).toEqual(['responsable'])
  })

  test('el responsable tiene que ir y ser dirigente', () => {
    expect(campos(validarParticipantes([jefa, chico], chico.personaId))).toEqual(['responsable'])
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

describe('numeroDeExpediente', () => {
  test('se dicta por teléfono: año de la serie y número corrido', () => {
    // El id interno es un uuid y nadie lo lee en voz alta en un mostrador.
    expect(numeroDeExpediente({ anioDeExpediente: 2026, numeroDeExpediente: 147 })).toBe(
      'SAL-2026-0147',
    )
  })

  test('el ancho del número es presentación y no llega a la base', () => {
    expect(numeroDeExpediente({ anioDeExpediente: 2026, numeroDeExpediente: 12345 })).toBe(
      'SAL-2026-12345',
    )
  })

  test('un borrador todavía no es un expediente', () => {
    expect(numeroDeExpediente({ anioDeExpediente: null, numeroDeExpediente: null })).toBeNull()
  })
})

describe('contenidoDelPermiso', () => {
  const permiso: Pick<
    Permiso,
    | 'id'
    | 'anioDeExpediente'
    | 'numeroDeExpediente'
    | 'grupoId'
    | 'lugar'
    | 'direccion'
    | 'localidad'
    | 'provincia'
    | 'telefono'
    | 'desde'
    | 'hasta'
    | 'comoSeViaja'
    | 'responsableId'
  > = {
    id: 'permiso_1',
    anioDeExpediente: 2026,
    numeroDeExpediente: 147,
    grupoId: 'grupo_1',
    lugar: 'Camping La Aurora',
    direccion: 'Ruta 9 km 500',
    localidad: 'Los Patos',
    provincia: 'Santa Fe',
    telefono: '11 5488-2210',
    desde: '2026-10-11',
    hasta: '2026-10-13',
    comoSeViaja: 'Micro',
    responsableId: 'persona_jefa',
  }
  const quien = (personaId: string): ParticipanteEmitido => ({
    permisoId: 'permiso_1',
    personaId,
    marca: 'beneficiario',
    tipoDeDocumento: 'dni',
    numeroDeDocumento: '40111222',
    nombres: 'Ana',
    apellidos: 'Paz',
    unidad: 'Tropa scout San Jorge',
  })

  test('el orden en que vienen las filas no cambia la huella', () => {
    // Dos consultas que traen lo mismo en distinto orden tienen que dar lo
    // mismo: si no, la huella detectaría cambios que no existen.
    const uno = contenidoDelPermiso({
      permiso,
      unidades: ['u_1', 'u_2'],
      participantes: [quien('persona_a'), quien('persona_b')],
    })
    const otro = contenidoDelPermiso({
      permiso,
      unidades: ['u_2', 'u_1'],
      participantes: [quien('persona_b'), quien('persona_a')],
    })
    expect(uno).toBe(otro)
  })

  test('cambiar un documento cambia la huella', () => {
    const antes = contenidoDelPermiso({
      permiso,
      unidades: [],
      participantes: [quien('persona_a')],
    })
    const despues = contenidoDelPermiso({
      permiso,
      unidades: [],
      participantes: [{ ...quien('persona_a'), numeroDeDocumento: '40111223' }],
    })
    expect(despues).not.toBe(antes)
  })

  test('cambiar la dirección también', () => {
    const antes = contenidoDelPermiso({ permiso, unidades: [], participantes: [] })
    const despues = contenidoDelPermiso({
      permiso: { ...permiso, direccion: 'Otra ruta' },
      unidades: [],
      participantes: [],
    })
    expect(despues).not.toBe(antes)
  })
})
