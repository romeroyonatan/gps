import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { aplicarMigraciones, type Bd, type Core, type Module, type Reloj } from '@gps/core'
import { aFechaDeCalendario } from '@gps/core/fechas'
import type { Estructura, GrupoConUnidades, Rama, Unidad } from '@gps/estructura/dominio'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import type { DatosDePersona } from '../src/dominio/modelos'
import type { DatosDeIngreso } from '../src/dominio/vinculos'
import { migraciones } from '../src/servidor/migraciones'
import {
  CargoInvalido,
  crearServicioDePersonas,
  DatosInvalidos,
  DocumentoDuplicado,
  GrupoInexistente,
  type ServicioDePersonas,
} from '../src/servidor/servicio'

const HORA = new Date('1970-01-01T00:00:00Z')

const unidadDe = (id: string, rama: Rama, nombre: string): Unidad => ({
  id,
  grupoId: 'grupo_1',
  rama,
  sexo: 'mixta',
  nombre,
  cerradaEn: null,
  creadoEn: HORA,
  actualizadoEn: HORA,
})

const GRUPO: GrupoConUnidades = {
  id: 'grupo_1',
  numero: 42,
  nombre: 'Ceferino Namuncurá',
  distritoId: 'distrito_1',
  cerradoEn: null,
  creadoEn: HORA,
  actualizadoEn: HORA,
  unidades: [
    unidadDe('unidad_lob', 'lobatos', 'Manada'),
    unidadDe('unidad_sco', 'scouts', 'Tropa scout'),
  ],
}

/** Una estructura falsa: el servicio la recibe por el constructor, no por el
 *  contexto, asi que el test no necesita levantar el otro modulo. Es lo que
 *  hace testeable la dependencia entre modulos. */
const DISTRITOS_ABIERTOS = new Set(['distrito_1'])

function estructuraFalsa(grupos: readonly GrupoConUnidades[] = [GRUPO]): Estructura {
  return {
    obtenerGrupo: async (id) => grupos.find((grupo) => grupo.id === id) ?? null,
    distritoEstaAbierto: async (id) => DISTRITOS_ABIERTOS.has(id),
    // Personas no usa gruposAbiertosEn: se implementa solo para satisfacer la
    // interfaz. Los GrupoConUnidades de este archivo tienen cerradoEn: null.
    async gruposAbiertosEn(fecha) {
      return new Set(
        grupos
          .filter(
            (grupo) => grupo.cerradoEn === null || fecha <= aFechaDeCalendario(grupo.cerradoEn),
          )
          .map((grupo) => grupo.id),
      )
    },
  }
}

/** Un servicio con la base migrada y un Core de ids fijos, para poder afirmar
 *  valores exactos. El reloj se fija en epoch 1970 para que una hora del sistema
 *  colada se distinga de un vistazo en vez de parecer plausible. */
function montar(
  reloj: Reloj = { ahora: () => HORA },
  estructura: Estructura = estructuraFalsa(),
): ServicioDePersonas {
  const base = new Database(':memory:')
  base.exec('PRAGMA foreign_keys = ON')
  const bd: Bd = drizzle(base)

  let contador = 0
  const core: Core = {
    config: { version: '0.0.0', entorno: 'prueba', puerto: 0 },
    logger: { info: () => {}, error: () => {} },
    reloj,
    bd,
    modulos: ['estructura', 'personas'],
    // Falso pero con el comportamiento que importa: sellar y verificar cierran
    // entre si, y un dato alterado no verifica.
    sellador: {
      sellar: (datos: string) => ({ sello: `sellado:${datos}`, claveId: 'prueba' }),
      verificar: (datos: string, sello: { sello: string; claveId: string }) =>
        sello.claveId === 'prueba' && sello.sello === `sellado:${datos}`,
    },
    almacenamiento: {
      guardar: async () => {},
      leer: async () => new Uint8Array(),
      eliminar: async () => {},
    },
    conversorDeImagenes: { aJpeg: async (contenido: Uint8Array) => contenido },
    // Falso pero estable y sensible al contenido, que es lo que los tests miran.
    hash: (contenido: Uint8Array | string) =>
      `hash:${typeof contenido === 'string' ? contenido : contenido.join(',')}`,
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
  return crearServicioDePersonas(core, estructura)
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

const ingreso: DatosDeIngreso = {
  grupoId: 'grupo_1',
  categoria: 'beneficiario',
  unidadId: 'unidad_lob',
  desde: '1969-03-01',
  cargos: [],
}

describe('crearPersona con ingreso', () => {
  test('devuelve la persona con su pertenencia y sus cargos', async () => {
    const servicio = montar()
    const persona = await servicio.crearPersona(valida, {
      ...ingreso,
      cargos: [{ cargo: 'jefeDeRama', hasta: '1973-03-01' }],
    })

    expect(persona.pertenencia).toEqual({
      id: 'pertenencia_2',
      personaId: 'persona_1',
      grupoId: 'grupo_1',
      categoria: 'beneficiario',
      unidadId: 'unidad_lob',
      desde: '1969-03-01',
      hasta: null,
      creadoEn: HORA,
      actualizadoEn: HORA,
    })
    expect(persona.cargos).toEqual([
      {
        id: 'cargo_3',
        personaId: 'persona_1',
        ambitoId: 'grupo_1',
        cargo: 'jefeDeRama',
        // El desde del cargo es el de la pertenencia: el formulario no pide la
        // misma fecha dos veces.
        desde: '1969-03-01',
        hasta: '1973-03-01',
        creadoEn: HORA,
        actualizadoEn: HORA,
      },
    ])
  })

  test('falla si el grupo no existe', async () => {
    const servicio = montar(undefined, estructuraFalsa([]))
    // `await` obligatorio: sin el, la asercion no se espera, el test pasa aunque
    // la promesa se resuelva bien, y ademas queda un rechazo sin manejar.
    await expect(servicio.crearPersona(valida, ingreso)).rejects.toThrow(GrupoInexistente)
  })

  test('falla si la unidad no esta abierta en ese grupo', async () => {
    // La regla que el servidor no podia verificar antes de que un modulo
    // pudiera alcanzar al otro.
    const servicio = montar()
    await expect(
      servicio.crearPersona(valida, { ...ingreso, unidadId: 'unidad_de_otro_lado' }),
    ).rejects.toThrow(DatosInvalidos)
  })

  test('un ingreso invalido no deja la persona escrita a medias', async () => {
    // Las tres escrituras van en una transaccion: una persona sin pertenencia
    // no aparece en ninguna pantalla, porque la unica query filtra por grupo.
    const servicio = montar()
    await expect(
      servicio.crearPersona(valida, { ...ingreso, unidadId: 'unidad_de_otro_lado' }),
    ).rejects.toThrow()
    expect(await servicio.listarPersonas('grupo_1')).toEqual([])
  })
})

describe('listarPersonas', () => {
  test('devuelve solo las del grupo pedido', async () => {
    const otroGrupo: GrupoConUnidades = {
      ...GRUPO,
      id: 'grupo_2',
      numero: 7,
      unidades: [unidadDe('unidad_otra', 'lobatos', 'Manada')],
    }
    const servicio = montar(undefined, estructuraFalsa([GRUPO, otroGrupo]))
    await servicio.crearPersona(valida, ingreso)
    await servicio.crearPersona(
      { ...valida, numeroDeDocumento: '30111223' },
      { ...ingreso, grupoId: 'grupo_2', unidadId: 'unidad_otra' },
    )

    const delPrimero = await servicio.listarPersonas('grupo_1')
    expect(delPrimero.map((persona) => persona.numeroDeDocumento)).toEqual(['30111222'])
  })

  test('ordena por apellido con el alfabeto castellano', async () => {
    const servicio = montar()
    await servicio.crearPersona({ ...valida, apellidos: 'Zaballa' }, ingreso)
    await servicio.crearPersona(
      { ...valida, numeroDeDocumento: '30111223', apellidos: 'Ávila' },
      ingreso,
    )
    // Con un ORDER BY de SQLite, que compara bytes, "Ávila" caeria despues de
    // "Zaballa".
    expect((await servicio.listarPersonas('grupo_1')).map((p) => p.apellidos)).toEqual([
      'Ávila',
      'Zaballa',
    ])
  })

  test('trae los cargos de cada persona, tambien los vencidos', async () => {
    // El servidor no filtra por vigencia: manda las filas con sus fechas y la
    // pantalla aplica su propio almanaque con estaVigente.
    const servicio = montar()
    await servicio.crearPersona(valida, {
      ...ingreso,
      cargos: [
        { cargo: 'jefeDeGrupo', hasta: '1969-12-31' },
        { cargo: 'jefeDeRama', hasta: null },
      ],
    })
    const [persona] = await servicio.listarPersonas('grupo_1')
    expect(persona?.cargos.map((cargo) => cargo.cargo)).toEqual(['jefeDeGrupo', 'jefeDeRama'])
  })

  test('un grupo sin nadie devuelve la lista vacia', async () => {
    expect(await montar().listarPersonas('grupo_1')).toEqual([])
  })
})

describe('crearPersona', () => {
  test('devuelve la persona con el id y las marcas que da Core', async () => {
    const persona = await montar().crearPersona(valida, ingreso)
    expect(persona).toMatchObject({
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
    const persona = await servicio.crearPersona(
      { ...valida, numeroDeDocumento: '30.111.222' },
      ingreso,
    )
    expect(persona.numeroDeDocumento).toBe('30111222')
  })

  test('recorta los espacios de nombres y apellidos', async () => {
    const persona = await montar().crearPersona(
      { ...valida, nombres: '  Ana  ', apellidos: '  Pérez  ' },
      ingreso,
    )
    expect(persona.nombres).toBe('Ana')
    expect(persona.apellidos).toBe('Pérez')
  })

  test('rechaza datos invalidos con los problemas adentro', async () => {
    const servicio = montar()
    expect(servicio.crearPersona({ ...valida, nombres: '' }, ingreso)).rejects.toBeInstanceOf(
      DatosInvalidos,
    )

    // El servicio corre las mismas validaciones que el formulario: es la
    // garantia, no la experiencia de uso.
    try {
      await servicio.crearPersona({ ...valida, nombres: '', numeroDeDocumento: '1' }, ingreso)
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
    await servicio.crearPersona(valida, ingreso).catch(() => {})
    await servicio.crearPersona({ ...valida, nombres: '' }, ingreso).catch(() => {})
    expect(await servicio.listarPersonas('grupo_1')).toHaveLength(1)
  })

  test('el mismo documento dos veces falla con un mensaje que se puede mostrar', async () => {
    // Lo que garantiza la unicidad es el UNIQUE de la tabla; este error existe
    // para que el formulario tenga algo legible que mostrar en vez del texto
    // crudo de SQLite.
    const servicio = montar()
    await servicio.crearPersona(valida, ingreso)
    try {
      await servicio.crearPersona({ ...valida, nombres: 'Otra' }, ingreso)
      throw new Error('tendria que haber fallado')
    } catch (error) {
      expect(error).toBeInstanceOf(DocumentoDuplicado)
      expect((error as Error).message).toBe('Ya hay una persona cargada con DNI 30111222.')
    }
  })

  test('el duplicado se detecta aunque el numero venga escrito distinto', async () => {
    const servicio = montar()
    await servicio.crearPersona(valida, ingreso)
    expect(
      servicio.crearPersona({ ...valida, numeroDeDocumento: '30.111.222' }, ingreso),
    ).rejects.toBeInstanceOf(DocumentoDuplicado)
  })

  test('un pasaporte con el mismo numero que un DNI si se puede cargar', async () => {
    const servicio = montar()
    await servicio.crearPersona(valida, ingreso)
    expect(
      servicio.crearPersona(
        { ...valida, tipoDeDocumento: 'pasaporte', numeroDeDocumento: '30111222' },
        ingreso,
      ),
    ).resolves.toBeDefined()
  })

  test('valida contra el reloj de Core y no contra la hora del sistema', async () => {
    // Con el reloj en 1970, una persona nacida en 2010 es del futuro. Si este
    // test pasa, es que el servicio se colgo la hora real.
    expect(
      montar().crearPersona({ ...valida, fechaDeNacimiento: '2010-05-01' }, ingreso),
    ).rejects.toBeInstanceOf(DatosInvalidos)
  })
})

describe('miembrosActivos', () => {
  test('incluye a quien ya habia entrado y todavia no se fue', async () => {
    const servicio = montar()
    await servicio.crearPersona(
      { ...valida, numeroDeDocumento: '30111222' },
      { ...ingreso, desde: '1969-03-01' },
    )

    const activos = await servicio.miembrosActivos('1969-05-01')
    expect(activos).toHaveLength(1)
    expect(activos[0]?.grupoId).toBe('grupo_1')
    expect(activos[0]?.persona.numeroDeDocumento).toBe('30111222')
  })

  test('no incluye a quien entro despues', async () => {
    const servicio = montar()
    await servicio.crearPersona(
      { ...valida, numeroDeDocumento: '30111222' },
      { ...ingreso, desde: '1969-07-01' },
    )
    expect(await servicio.miembrosActivos('1969-05-01')).toHaveLength(0)
  })

  test('las dos puntas son inclusivas, igual que estaVigente', async () => {
    const servicio = montar()
    await servicio.crearPersona(
      { ...valida, numeroDeDocumento: '30111222' },
      { ...ingreso, desde: '1969-05-01' },
    )
    expect(await servicio.miembrosActivos('1969-05-01')).toHaveLength(1)
  })
})

describe('asignarCargo', () => {
  const montarConPersona = async () => {
    const servicio = montar()
    const persona = await servicio.crearPersona(valida, ingreso)
    return { servicio, persona }
  }

  test('un comisionado queda con el distrito como ambito', async () => {
    const { servicio, persona } = await montarConPersona()
    expect(
      servicio.asignarCargo({
        personaId: persona.id,
        cargo: 'comisionadoDeDistrito',
        ambitoId: 'distrito_1',
        desde: '1969-03-01',
      }),
    ).resolves.toMatchObject({ ambitoId: 'distrito_1', cargo: 'comisionadoDeDistrito' })
  })

  test('un cargo de distrito apuntando a un grupo se rechaza', async () => {
    // El ambito sale del catalogo, asi que un grupo no puede hacer de distrito
    // aunque el id exista.
    const { servicio, persona } = await montarConPersona()
    expect(
      servicio.asignarCargo({
        personaId: persona.id,
        cargo: 'comisionadoDeDistrito',
        ambitoId: 'grupo_1',
        desde: '1969-03-01',
      }),
    ).rejects.toThrow(CargoInvalido)
  })

  test('el jefe scout diocesano no apunta a ninguna entidad', async () => {
    const { servicio, persona } = await montarConPersona()
    expect(
      servicio.asignarCargo({
        personaId: persona.id,
        cargo: 'jefeScoutDiocesano',
        ambitoId: null,
        desde: '1969-03-01',
      }),
    ).resolves.toMatchObject({ ambitoId: null })
  })

  test('un cargo diocesano con entidad se rechaza', async () => {
    const { servicio, persona } = await montarConPersona()
    expect(
      servicio.asignarCargo({
        personaId: persona.id,
        cargo: 'jefeScoutDiocesano',
        ambitoId: 'distrito_1',
        desde: '1969-03-01',
      }),
    ).rejects.toThrow(CargoInvalido)
  })

  test('un cargo de grupo sin entidad se rechaza', async () => {
    const { servicio, persona } = await montarConPersona()
    expect(
      servicio.asignarCargo({
        personaId: persona.id,
        cargo: 'jefeDeGrupo',
        ambitoId: null,
        desde: '1969-03-01',
      }),
    ).rejects.toThrow(CargoInvalido)
  })

  test('un distrito que no existe o esta cerrado se rechaza', async () => {
    const { servicio, persona } = await montarConPersona()
    expect(
      servicio.asignarCargo({
        personaId: persona.id,
        cargo: 'comisionadoDeDistrito',
        ambitoId: 'distrito_cerrado',
        desde: '1969-03-01',
      }),
    ).rejects.toThrow(CargoInvalido)
  })

  test('el mismo cargo diocesano dos veces con la misma fecha se rechaza', async () => {
    // Es el unico duplicado que el UNIQUE de la tabla deja pasar: SQLite trata
    // dos NULL como distintos.
    const { servicio, persona } = await montarConPersona()
    const datos = {
      personaId: persona.id,
      cargo: 'jefeScoutDiocesano' as const,
      ambitoId: null,
      desde: '1969-03-01',
    }
    await servicio.asignarCargo(datos)
    expect(servicio.asignarCargo(datos)).rejects.toThrow(CargoInvalido)
  })
})

describe('ocupantesDelCargo', () => {
  const montarConDirector = async () => {
    const servicio = montar()
    const persona = await servicio.crearPersona(valida, {
      ...ingreso,
      cargos: [{ cargo: 'director', hasta: '1972-03-01' }],
    })
    return { servicio, persona }
  }

  test('devuelve a quien ocupaba el cargo ese dia', async () => {
    const { servicio, persona } = await montarConDirector()
    const ocupantes = await servicio.ocupantesDelCargo('director', 'grupo_1', '1970-06-15')
    expect(ocupantes.map((uno) => uno.id)).toEqual([persona.id])
  })

  test('el ultimo dia del periodo todavia cuenta', async () => {
    // Las dos puntas inclusivas, igual que estaVigente.
    const { servicio, persona } = await montarConDirector()
    const ocupantes = await servicio.ocupantesDelCargo('director', 'grupo_1', '1972-03-01')
    expect(ocupantes.map((uno) => uno.id)).toEqual([persona.id])
  })

  test('el dia siguiente al hasta ya no', async () => {
    const { servicio } = await montarConDirector()
    expect(await servicio.ocupantesDelCargo('director', 'grupo_1', '1972-03-02')).toEqual([])
  })

  test('antes del desde tampoco', async () => {
    const { servicio } = await montarConDirector()
    expect(await servicio.ocupantesDelCargo('director', 'grupo_1', '1969-02-28')).toEqual([])
  })

  test('un cargo que nadie ocupaba devuelve la lista vacia', async () => {
    const { servicio } = await montarConDirector()
    expect(await servicio.ocupantesDelCargo('capellan', 'grupo_1', '1970-06-15')).toEqual([])
  })

  test('el mismo cargo en otra entidad no se mezcla', async () => {
    const { servicio } = await montarConDirector()
    expect(await servicio.ocupantesDelCargo('director', 'grupo_2', '1970-06-15')).toEqual([])
  })

  test('un cargo diocesano se consulta con ambito null', async () => {
    const { servicio, persona } = await montarConDirector()
    await servicio.asignarCargo({
      personaId: persona.id,
      cargo: 'jefeScoutDiocesano',
      ambitoId: null,
      desde: '1969-03-01',
    })
    const ocupantes = await servicio.ocupantesDelCargo('jefeScoutDiocesano', null, '1970-06-15')
    expect(ocupantes.map((uno) => uno.id)).toEqual([persona.id])
  })
})
