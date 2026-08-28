import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { aplicarMigraciones, type Bd, type Core, type Module, type Reloj } from '@gps/core'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import type { DatosDePersona } from '../src/dominio/modelos'
import { migraciones } from '../src/servidor/migraciones'
import {
  crearServicioDePersonas,
  DatosInvalidos,
  DocumentoDuplicado,
  type ServicioDePersonas,
} from '../src/servidor/servicio'

const HORA = new Date('1970-01-01T00:00:00Z')

/** Un servicio con la base migrada y un Core de ids fijos, para poder afirmar
 *  valores exactos. El reloj se fija en epoch 1970 para que una hora del sistema
 *  colada se distinga de un vistazo en vez de parecer plausible. */
function montar(reloj: Reloj = { ahora: () => HORA }): ServicioDePersonas {
  const base = new Database(':memory:')
  base.exec('PRAGMA foreign_keys = ON')
  const bd: Bd = drizzle(base)

  let contador = 0
  const core: Core = {
    config: { version: '0.0.0', entorno: 'prueba', puerto: 0 },
    logger: { info: () => {}, error: () => {} },
    reloj,
    bd,
    modulos: ['personas'],
    nuevoId: (prefijo) => `${prefijo}_${++contador}`,
  }

  const modulo: Module<object> = {
    name: 'personas',
    dependencies: [],
    migraciones,
    createServices: () => ({}),
    registerSchema: () => {},
  }
  aplicarMigraciones(core, [modulo])
  return crearServicioDePersonas(core)
}

/** El reloj de los tests esta en 1970, asi que una fecha de nacimiento valida
 *  tiene que ser anterior a esa. Es incomodo y es a proposito: obliga a que se
 *  note si alguien se cuelga la hora real. */
const valida: DatosDePersona = {
  tipoDeDocumento: 'dni',
  numeroDeDocumento: '30111222',
  nombres: 'María Luz',
  apellidos: 'Fernández Ruiz',
  fechaDeNacimiento: '1950-05-01',
}

describe('crearPersona', () => {
  test('devuelve la persona con el id y las marcas que da Core', async () => {
    expect(await montar().crearPersona(valida)).toEqual({
      id: 'persona_1',
      tipoDeDocumento: 'dni',
      numeroDeDocumento: '30111222',
      nombres: 'María Luz',
      apellidos: 'Fernández Ruiz',
      fechaDeNacimiento: '1950-05-01',
      creadoEn: HORA,
      actualizadoEn: HORA,
    })
  })

  test('guarda el numero de documento normalizado', async () => {
    // Sin esto el UNIQUE no sirve: "30.111.222" y "30111222" entrarian como dos
    // personas distintas.
    const servicio = montar()
    const persona = await servicio.crearPersona({ ...valida, numeroDeDocumento: '30.111.222' })
    expect(persona.numeroDeDocumento).toBe('30111222')
  })

  test('recorta los espacios de nombres y apellidos', async () => {
    const persona = await montar().crearPersona({
      ...valida,
      nombres: '  Ana  ',
      apellidos: '  Pérez  ',
    })
    expect(persona.nombres).toBe('Ana')
    expect(persona.apellidos).toBe('Pérez')
  })

  test('rechaza datos invalidos con los problemas adentro', async () => {
    const servicio = montar()
    expect(servicio.crearPersona({ ...valida, nombres: '' })).rejects.toBeInstanceOf(DatosInvalidos)

    // El servicio corre las mismas validaciones que el formulario: es la
    // garantia, no la experiencia de uso.
    try {
      await servicio.crearPersona({ ...valida, nombres: '', numeroDeDocumento: '1' })
      throw new Error('tendria que haber fallado')
    } catch (error) {
      expect(error).toBeInstanceOf(DatosInvalidos)
      expect((error as DatosInvalidos).problemas.map((problema) => problema.campo)).toEqual([
        'nombres',
        'numeroDeDocumento',
      ])
    }
  })

  test('nada invalido llega a la base', async () => {
    const servicio = montar()
    await servicio.crearPersona(valida).catch(() => {})
    await servicio.crearPersona({ ...valida, nombres: '' }).catch(() => {})
    expect(await servicio.listarPersonas()).toHaveLength(1)
  })

  test('el mismo documento dos veces falla con un mensaje que se puede mostrar', async () => {
    // Lo que garantiza la unicidad es el UNIQUE de la tabla; este error existe
    // para que el formulario tenga algo legible que mostrar en vez del texto
    // crudo de SQLite.
    const servicio = montar()
    await servicio.crearPersona(valida)
    try {
      await servicio.crearPersona({ ...valida, nombres: 'Otra' })
      throw new Error('tendria que haber fallado')
    } catch (error) {
      expect(error).toBeInstanceOf(DocumentoDuplicado)
      expect((error as Error).message).toBe('Ya hay una persona cargada con DNI 30111222.')
    }
  })

  test('el duplicado se detecta aunque el numero venga escrito distinto', async () => {
    const servicio = montar()
    await servicio.crearPersona(valida)
    expect(
      servicio.crearPersona({ ...valida, numeroDeDocumento: '30.111.222' }),
    ).rejects.toBeInstanceOf(DocumentoDuplicado)
  })

  test('un pasaporte con el mismo numero que un DNI si se puede cargar', async () => {
    const servicio = montar()
    await servicio.crearPersona(valida)
    expect(
      servicio.crearPersona({
        ...valida,
        tipoDeDocumento: 'pasaporte',
        numeroDeDocumento: '30111222',
      }),
    ).resolves.toBeDefined()
  })

  test('valida contra el reloj de Core y no contra la hora del sistema', async () => {
    // Con el reloj en 1970, una persona nacida en 2010 es del futuro. Si este
    // test pasa, es que el servicio se colgo la hora real.
    expect(
      montar().crearPersona({ ...valida, fechaDeNacimiento: '2010-05-01' }),
    ).rejects.toBeInstanceOf(DatosInvalidos)
  })
})

describe('listarPersonas', () => {
  test('sin datos devuelve una lista vacia, no undefined', async () => {
    expect(await montar().listarPersonas()).toEqual([])
  })

  test('ordena por apellido respetando los acentos del castellano', async () => {
    // SQLite compara bytes: con ORDER BY, "Ávila" caeria despues de "Zaballa" y
    // la lista alfabetica dejaria de servir para encontrar gente.
    const servicio = montar()
    await servicio.crearPersona({ ...valida, apellidos: 'Zaballa', numeroDeDocumento: '30111111' })
    await servicio.crearPersona({ ...valida, apellidos: 'Ávila', numeroDeDocumento: '30222222' })
    await servicio.crearPersona({ ...valida, apellidos: 'Núñez', numeroDeDocumento: '30333333' })
    await servicio.crearPersona({ ...valida, apellidos: 'Ochoa', numeroDeDocumento: '30444444' })

    const listadas = await servicio.listarPersonas()
    expect(listadas.map((persona) => persona.apellidos)).toEqual([
      'Ávila',
      'Núñez',
      'Ochoa',
      'Zaballa',
    ])
  })

  test('a igual apellido, ordena por nombres', async () => {
    const servicio = montar()
    await servicio.crearPersona({
      ...valida,
      apellidos: 'Pérez',
      nombres: 'Rosario',
      numeroDeDocumento: '30111111',
    })
    await servicio.crearPersona({
      ...valida,
      apellidos: 'Pérez',
      nombres: 'Ana',
      numeroDeDocumento: '30222222',
    })

    const listadas = await servicio.listarPersonas()
    expect(listadas.map((persona) => persona.nombres)).toEqual(['Ana', 'Rosario'])
  })

  test('las marcas vuelven de la base como Date, y la fecha como texto', async () => {
    // Es el unico test que verifica el ida y vuelta del mapeo: sale de una fila
    // releida, no del objeto que devolvio el alta.
    const servicio = montar()
    await servicio.crearPersona(valida)
    const [persona] = await servicio.listarPersonas()
    expect(persona?.creadoEn).toEqual(HORA)
    expect(persona?.fechaDeNacimiento).toBe('1950-05-01')
  })
})
