import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import {
  type Actor,
  type Alcance,
  alcanceSinLimites,
  aplicarMigraciones,
  type Bd,
  type Core,
  crearBusDeEventos,
  type Module,
  type Reloj,
} from '@gps/core'
import { aFechaDeCalendario } from '@gps/core/fechas'
import type { Estructura, GrupoConUnidades, Rama, Unidad } from '@gps/estructura/dominio'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import type { DatosDePersona } from '../src/dominio/modelos'
import type { DatosDeIngreso } from '../src/dominio/vinculos'
import { migraciones } from '../src/servidor/migraciones'
import {
  CambioDeAutoridadDenegado,
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
    expandirAlcance: async (actor) => ({
      actor,
      gruposVisibles: grupos.map(({ id }) => id),
      distritosVisibles: [],
      esAdministrador: false,
    }),
    obtenerGrupo: async (id) => grupos.find((grupo) => grupo.id === id) ?? null,
    listarGrupos: async () => grupos,
    listarDistritosSinGrupos: async () => [],
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
function montarConBd(
  reloj: Reloj = { ahora: () => HORA },
  estructura: Estructura = estructuraFalsa(),
): { servicio: ServicioDePersonas; bd: Bd } {
  const base = new Database(':memory:')
  base.exec('PRAGMA foreign_keys = ON')
  const bd: Bd = drizzle(base)

  let contador = 0
  const core: Core = {
    config: { version: '0.0.0', entorno: 'prueba', puerto: 0 },
    logger: { info: () => {}, error: () => {} },
    reloj,
    bd,
    eventos: crearBusDeEventos(),
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
    nuevoSecreto: () => `secreto_${++contador}`,
  }

  const modulo: Module<object> = {
    name: 'personas',
    dependencies: [],
    migraciones,
    createServices: () => ({}),
    accesoAlModulo: { porDefecto: 'denegado', permitidos: [] },
    registerSchema: () => {},
  }
  aplicarMigraciones(core, [modulo])
  return { servicio: crearServicioDePersonas(core, estructura), bd }
}

function montar(
  reloj: Reloj = { ahora: () => HORA },
  estructura: Estructura = estructuraFalsa(),
): ServicioDePersonas {
  return montarConBd(reloj, estructura).servicio
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
  domicilio: 'Av. Siempre Viva 742',
  telefonoDeContacto: '11 5555-1234',
}

const actor = (rol: 'jefeDeGrupo' | 'secretariaDeGrupo', grupoId = 'grupo_1'): Actor => ({
  personaId: 'actor',
  roles: [{ rol, ambito: { tipo: 'grupo', id: grupoId } }],
  esAdministradorDesignado: false,
  estaElevado: false,
})

const actorDiocesano = (rol: 'jefeScoutDiocesano' | 'administracionDiocesana' | null): Actor => ({
  personaId: 'actor',
  roles: rol ? [{ rol, ambito: { tipo: 'diocesis', id: null } }] : [],
  esAdministradorDesignado: false,
  estaElevado: rol === null,
})

/** El alcance que arma el contexto para ese actor: ve los grupos donde ejerce
 *  una funcion, y ninguno mas. */
const alcanceDe = (quien: Actor, grupos: readonly string[]): Alcance => ({
  actor: quien,
  gruposVisibles: [...grupos],
  distritosVisibles: [],
  esAdministrador: false,
})

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
    const persona = await servicio.crearPersona(alcanceSinLimites(), valida, {
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
        revocadoEn: null,
        creadoEn: HORA,
        actualizadoEn: HORA,
      },
    ])
  })

  test('falla si el grupo no existe', async () => {
    const servicio = montar(undefined, estructuraFalsa([]))
    // `await` obligatorio: sin el, la asercion no se espera, el test pasa aunque
    // la promesa se resuelva bien, y ademas queda un rechazo sin manejar.
    await expect(servicio.crearPersona(alcanceSinLimites(), valida, ingreso)).rejects.toThrow(
      GrupoInexistente,
    )
  })

  test('falla si la unidad no esta abierta en ese grupo', async () => {
    // La regla que el servidor no podia verificar antes de que un modulo
    // pudiera alcanzar al otro.
    const servicio = montar()
    await expect(
      servicio.crearPersona(alcanceSinLimites(), valida, {
        ...ingreso,
        unidadId: 'unidad_de_otro_lado',
      }),
    ).rejects.toThrow(DatosInvalidos)
  })

  test('un ingreso invalido no deja la persona escrita a medias', async () => {
    // Las tres escrituras van en una transaccion: una persona sin pertenencia
    // no aparece en ninguna pantalla, porque la unica query filtra por grupo.
    const servicio = montar()
    await expect(
      servicio.crearPersona(alcanceSinLimites(), valida, {
        ...ingreso,
        unidadId: 'unidad_de_otro_lado',
      }),
    ).rejects.toThrow()
    expect(await servicio.listarPersonas(alcanceSinLimites(), 'grupo_1')).toEqual([])
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
    await servicio.crearPersona(alcanceSinLimites(), valida, ingreso)
    await servicio.crearPersona(
      alcanceSinLimites(),
      { ...valida, numeroDeDocumento: '30111223' },
      { ...ingreso, grupoId: 'grupo_2', unidadId: 'unidad_otra' },
    )

    const delPrimero = await servicio.listarPersonas(alcanceSinLimites(), 'grupo_1')
    expect(delPrimero.map((persona) => persona.numeroDeDocumento)).toEqual(['30111222'])
  })

  test('ordena por apellido con el alfabeto castellano', async () => {
    const servicio = montar()
    await servicio.crearPersona(alcanceSinLimites(), { ...valida, apellidos: 'Zaballa' }, ingreso)
    await servicio.crearPersona(
      alcanceSinLimites(),
      { ...valida, numeroDeDocumento: '30111223', apellidos: 'Ávila' },
      ingreso,
    )
    // Con un ORDER BY de SQLite, que compara bytes, "Ávila" caeria despues de
    // "Zaballa".
    expect(
      (await servicio.listarPersonas(alcanceSinLimites(), 'grupo_1')).map((p) => p.apellidos),
    ).toEqual(['Ávila', 'Zaballa'])
  })

  test('trae los cargos de cada persona, tambien los vencidos', async () => {
    // El servidor no filtra por vigencia: manda las filas con sus fechas y la
    // pantalla aplica su propio almanaque con estaVigente.
    const servicio = montar()
    await servicio.crearPersona(alcanceSinLimites(), valida, {
      ...ingreso,
      cargos: [
        { cargo: 'jefeDeGrupo', hasta: '1969-12-31' },
        { cargo: 'jefeDeRama', hasta: null },
      ],
    })
    const [persona] = await servicio.listarPersonas(alcanceSinLimites(), 'grupo_1')
    expect(persona?.cargos.map((cargo) => cargo.cargo)).toEqual(['jefeDeGrupo', 'jefeDeRama'])
  })

  test('un grupo sin nadie devuelve la lista vacia', async () => {
    expect(await montar().listarPersonas(alcanceSinLimites(), 'grupo_1')).toEqual([])
  })

  test('cada equipo viaja con su tipo', async () => {
    // Sin el tipo, la pantalla del plantel no puede distinguir la Secretaría
    // del grupo de un equipo diocesano de la misma persona: dibujaba las dos
    // como Secretaría, y quitar una revocaba la otra.
    const servicio = montar()
    const persona = await servicio.crearPersona(alcanceSinLimites(), valida, ingreso)
    await servicio.integrarEquipo(actor('jefeDeGrupo'), {
      personaId: persona.id,
      tipo: 'secretaria',
      ambitoTipo: 'grupo',
      ambitoId: 'grupo_1',
      desde: '1970-01-01',
    })
    await servicio.integrarEquipo(actorDiocesano('jefeScoutDiocesano'), {
      personaId: persona.id,
      tipo: 'tesoreriaDiocesana',
      ambitoTipo: 'diocesis',
      ambitoId: null,
      desde: '1970-01-01',
    })

    const [traida] = await servicio.listarPersonas(alcanceSinLimites(), 'grupo_1')
    expect(traida?.equipos.map((equipo) => equipo.tipo).sort()).toEqual([
      'secretaria',
      'tesoreriaDiocesana',
    ])
  })
})

describe('crearPersona', () => {
  test('devuelve la persona con el id y las marcas que da Core', async () => {
    const persona = await montar().crearPersona(alcanceSinLimites(), valida, ingreso)
    expect(persona).toMatchObject({
      id: 'persona_1',
      tipoDeDocumento: 'dni',
      numeroDeDocumento: '30111222',
      nombres: 'María Luz',
      apellidos: 'Fernández Ruiz',
      fechaDeNacimiento: '1950-05-01',
      domicilio: 'Av. Siempre Viva 742',
      telefonoDeContacto: '11 5555-1234',
      creadoEn: HORA,
      actualizadoEn: HORA,
    })
  })

  test('guarda el numero de documento normalizado', async () => {
    // Sin esto el UNIQUE no sirve: "30.111.222" y "30111222" entrarian como dos
    // personas distintas.
    const servicio = montar()
    const persona = await servicio.crearPersona(
      alcanceSinLimites(),
      { ...valida, numeroDeDocumento: '30.111.222' },
      ingreso,
    )
    expect(persona.numeroDeDocumento).toBe('30111222')
  })

  test('recorta los espacios de nombres y apellidos', async () => {
    const persona = await montar().crearPersona(
      alcanceSinLimites(),
      { ...valida, nombres: '  Ana  ', apellidos: '  Pérez  ' },
      ingreso,
    )
    expect(persona.nombres).toBe('Ana')
    expect(persona.apellidos).toBe('Pérez')
  })

  test('rechaza datos invalidos con los problemas adentro', async () => {
    const servicio = montar()
    expect(
      servicio.crearPersona(alcanceSinLimites(), { ...valida, nombres: '' }, ingreso),
    ).rejects.toBeInstanceOf(DatosInvalidos)

    // El servicio corre las mismas validaciones que el formulario: es la
    // garantia, no la experiencia de uso.
    try {
      await servicio.crearPersona(
        alcanceSinLimites(),
        { ...valida, nombres: '', numeroDeDocumento: '1' },
        ingreso,
      )
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
    await servicio.crearPersona(alcanceSinLimites(), valida, ingreso).catch(() => {})
    await servicio
      .crearPersona(alcanceSinLimites(), { ...valida, nombres: '' }, ingreso)
      .catch(() => {})
    expect(await servicio.listarPersonas(alcanceSinLimites(), 'grupo_1')).toHaveLength(1)
  })

  test('el mismo documento dos veces falla con un mensaje que se puede mostrar', async () => {
    // Lo que garantiza la unicidad es el UNIQUE de la tabla; este error existe
    // para que el formulario tenga algo legible que mostrar en vez del texto
    // crudo de SQLite.
    const servicio = montar()
    await servicio.crearPersona(alcanceSinLimites(), valida, ingreso)
    try {
      await servicio.crearPersona(alcanceSinLimites(), { ...valida, nombres: 'Otra' }, ingreso)
      throw new Error('tendria que haber fallado')
    } catch (error) {
      expect(error).toBeInstanceOf(DocumentoDuplicado)
      expect((error as Error).message).toBe('Ya hay una persona cargada con DNI 30111222.')
    }
  })

  test('el duplicado se detecta aunque el numero venga escrito distinto', async () => {
    const servicio = montar()
    await servicio.crearPersona(alcanceSinLimites(), valida, ingreso)
    expect(
      servicio.crearPersona(
        alcanceSinLimites(),
        { ...valida, numeroDeDocumento: '30.111.222' },
        ingreso,
      ),
    ).rejects.toBeInstanceOf(DocumentoDuplicado)
  })

  test('un pasaporte con el mismo numero que un DNI si se puede cargar', async () => {
    const servicio = montar()
    await servicio.crearPersona(alcanceSinLimites(), valida, ingreso)
    expect(
      servicio.crearPersona(
        alcanceSinLimites(),
        { ...valida, tipoDeDocumento: 'pasaporte', numeroDeDocumento: '30111222' },
        ingreso,
      ),
    ).resolves.toBeDefined()
  })

  test('valida contra el reloj de Core y no contra la hora del sistema', async () => {
    // Con el reloj en 1970, una persona nacida en 2010 es del futuro. Si este
    // test pasa, es que el servicio se colgo la hora real.
    expect(
      montar().crearPersona(
        alcanceSinLimites(),
        { ...valida, fechaDeNacimiento: '2010-05-01' },
        ingreso,
      ),
    ).rejects.toBeInstanceOf(DatosInvalidos)
  })
})

describe('miembrosActivos', () => {
  test('incluye a quien ya habia entrado y todavia no se fue', async () => {
    const servicio = montar()
    await servicio.crearPersona(
      alcanceSinLimites(),
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
      alcanceSinLimites(),
      { ...valida, numeroDeDocumento: '30111222' },
      { ...ingreso, desde: '1969-07-01' },
    )
    expect(await servicio.miembrosActivos('1969-05-01')).toHaveLength(0)
  })

  test('las dos puntas son inclusivas, igual que estaVigente', async () => {
    const servicio = montar()
    await servicio.crearPersona(
      alcanceSinLimites(),
      { ...valida, numeroDeDocumento: '30111222' },
      { ...ingreso, desde: '1969-05-01' },
    )
    expect(await servicio.miembrosActivos('1969-05-01')).toHaveLength(1)
  })
})

describe('funcionesVigentes', () => {
  test('deriva pertenencia, cargo y equipo sin confiar en roles almacenados', async () => {
    const { servicio, bd } = montarConBd()
    await servicio.crearPersona(alcanceSinLimites(), valida, {
      ...ingreso,
      categoria: 'activo',
      unidadId: 'unidad_lob',
      cargos: [{ cargo: 'jefeDeGrupo', hasta: null }],
    })
    bd.run(sql`INSERT INTO equipos VALUES ('equipo_1', 'secretaria', 'grupo', 'grupo_1', 0, 0)`)
    bd.run(
      sql`INSERT INTO integrantes_de_equipo VALUES
          ('integrante_1', 'equipo_1', 'persona_1', '1969-01-01', NULL, NULL, 0, 0)`,
    )

    expect(await servicio.personaExiste('persona_1')).toBe(true)
    expect(await servicio.personaExiste('otra')).toBe(false)
    expect(await servicio.grupoVigenteDe('persona_1', '1970-01-01')).toBe('grupo_1')
    expect(await servicio.funcionesVigentes('persona_1', '1970-01-01')).toEqual([
      { rol: 'dirigente', ambito: { tipo: 'grupo', id: 'grupo_1' } },
      { rol: 'jefeDeGrupo', ambito: { tipo: 'grupo', id: 'grupo_1' } },
      { rol: 'secretariaDeGrupo', ambito: { tipo: 'grupo', id: 'grupo_1' } },
    ])
  })

  test('la revocacion corta el acceso sin borrar la historia', async () => {
    const { servicio, bd } = montarConBd()
    await servicio.crearPersona(alcanceSinLimites(), valida, {
      ...ingreso,
      cargos: [{ cargo: 'director', hasta: null }],
    })
    bd.run(sql`UPDATE cargos SET revocado_en = 1 WHERE persona_id = 'persona_1'`)

    expect(await servicio.funcionesVigentes('persona_1', '1970-01-01')).toEqual([])
    expect(
      bd.all<{ cantidad: number }>(sql`SELECT count(*) AS cantidad FROM cargos`)[0]?.cantidad,
    ).toBe(1)
  })
})

describe('administración de autoridades', () => {
  test('Jefatura agrega varios secretarios de su grupo y cualquiera puede nombrar jefatura', async () => {
    const servicio = montar()
    const una = await servicio.crearPersona(alcanceSinLimites(), valida, ingreso)
    const otra = await servicio.crearPersona(
      alcanceSinLimites(),
      { ...valida, numeroDeDocumento: '30111223', nombres: 'Ana' },
      ingreso,
    )
    await servicio.integrarEquipo(actor('jefeDeGrupo'), {
      personaId: una.id,
      tipo: 'secretaria',
      ambitoTipo: 'grupo',
      ambitoId: 'grupo_1',
      desde: '1970-01-01',
    })
    await servicio.integrarEquipo(actor('jefeDeGrupo'), {
      personaId: otra.id,
      tipo: 'secretaria',
      ambitoTipo: 'grupo',
      ambitoId: 'grupo_1',
      desde: '1970-01-01',
    })

    const cargo = await servicio.asignarCargoComo(actor('secretariaDeGrupo'), {
      personaId: otra.id,
      cargo: 'jefeDeGrupo',
      ambitoId: 'grupo_1',
      desde: '1970-01-01',
    })
    expect(cargo.cargo).toBe('jefeDeGrupo')
  })

  test('falla cerrado fuera del grupo y la revocación quita acceso inmediatamente', async () => {
    const servicio = montar()
    const persona = await servicio.crearPersona(alcanceSinLimites(), valida, ingreso)
    await expect(
      servicio.integrarEquipo(actor('jefeDeGrupo', 'grupo_2'), {
        personaId: persona.id,
        tipo: 'secretaria',
        ambitoTipo: 'grupo',
        ambitoId: 'grupo_1',
        desde: '1970-01-01',
      }),
    ).rejects.toThrow(CambioDeAutoridadDenegado)

    const integrante = await servicio.integrarEquipo(actor('jefeDeGrupo'), {
      personaId: persona.id,
      tipo: 'secretaria',
      ambitoTipo: 'grupo',
      ambitoId: 'grupo_1',
      desde: '1970-01-01',
    })
    await servicio.revocarIntegranteDeEquipo(actor('jefeDeGrupo'), integrante.id)
    expect(await servicio.funcionesVigentes(persona.id, '1970-01-01')).not.toContainEqual({
      rol: 'secretariaDeGrupo',
      ambito: { tipo: 'grupo', id: 'grupo_1' },
    })
  })

  test('se puede remover a la última jefatura', async () => {
    const servicio = montar()
    const persona = await servicio.crearPersona(alcanceSinLimites(), valida, ingreso)
    const cargo = await servicio.asignarCargoComo(actor('secretariaDeGrupo'), {
      personaId: persona.id,
      cargo: 'jefeDeGrupo',
      ambitoId: 'grupo_1',
      desde: '1970-01-01',
    })
    await servicio.revocarCargo(actor('secretariaDeGrupo'), cargo.id)
    expect(await servicio.funcionesVigentes(persona.id, '1970-01-01')).toEqual([])
  })

  test('cada cambio de autoridad queda auditado con actor, objetivo, ambito e instante', async () => {
    const { servicio, bd } = montarConBd()
    const persona = await servicio.crearPersona(alcanceSinLimites(), valida, ingreso)
    const cargo = await servicio.asignarCargoComo(actor('secretariaDeGrupo'), {
      personaId: persona.id,
      cargo: 'jefeDeGrupo',
      ambitoId: 'grupo_1',
      desde: '1970-01-01',
    })
    await servicio.revocarCargo(actor('jefeDeGrupo'), cargo.id)

    const eventos = bd.all<{ tipo: string; actor_persona_id: string; objetivo_persona_id: string }>(
      sql`SELECT tipo, actor_persona_id, objetivo_persona_id FROM eventos_de_autoridad ORDER BY creado_en, tipo`,
    )
    expect(eventos).toEqual([
      {
        tipo: 'cargo.jefeDeGrupo.asignar',
        actor_persona_id: 'actor',
        objetivo_persona_id: persona.id,
      },
      {
        tipo: 'cargo.jefeDeGrupo.revocar',
        actor_persona_id: 'actor',
        objetivo_persona_id: persona.id,
      },
    ])
  })
})

describe('administración de equipos diocesanos', () => {
  test('jefatura scout y administración diocesana pueden nombrarse y remover Tesorería entre sí', async () => {
    const servicio = montar()
    const persona = await servicio.crearPersona(alcanceSinLimites(), valida, ingreso)

    await servicio.integrarEquipo(actorDiocesano('jefeScoutDiocesano'), {
      personaId: persona.id,
      tipo: 'administracionDiocesana',
      ambitoTipo: 'diocesis',
      ambitoId: null,
      desde: '1970-01-01',
    })
    const tesorero = await servicio.integrarEquipo(actorDiocesano('administracionDiocesana'), {
      personaId: persona.id,
      tipo: 'tesoreriaDiocesana',
      ambitoTipo: 'diocesis',
      ambitoId: null,
      desde: '1970-01-01',
    })
    await servicio.revocarIntegranteDeEquipo(actorDiocesano('jefeScoutDiocesano'), tesorero.id)

    expect(await servicio.funcionesVigentes(persona.id, '1970-01-01')).toContainEqual({
      rol: 'administracionDiocesana',
      ambito: { tipo: 'diocesis', id: null },
    })
    expect(await servicio.funcionesVigentes(persona.id, '1970-01-01')).not.toContainEqual({
      rol: 'tesoreriaDiocesana',
      ambito: { tipo: 'diocesis', id: null },
    })
  })

  test('una autoridad diocesana vacante se recupera con elevación', async () => {
    const servicio = montar()
    const persona = await servicio.crearPersona(alcanceSinLimites(), valida, ingreso)
    await expect(
      servicio.integrarEquipo(actorDiocesano(null), {
        personaId: persona.id,
        tipo: 'administracionDiocesana',
        ambitoTipo: 'diocesis',
        ambitoId: null,
        desde: '1970-01-01',
      }),
    ).resolves.toBeTruthy()
  })
})

describe('asignarCargo', () => {
  const montarConPersona = async () => {
    const servicio = montar()
    const persona = await servicio.crearPersona(alcanceSinLimites(), valida, ingreso)
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
    const persona = await servicio.crearPersona(alcanceSinLimites(), valida, {
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

describe('alcance entre grupos', () => {
  test('la jefatura del grupo A no lee las personas del grupo B', async () => {
    const servicio = montar(undefined, estructuraFalsa([GRUPO, { ...GRUPO, id: 'grupo_2' }]))
    await servicio.crearPersona(alcanceSinLimites(), valida, ingreso)

    const delUno = alcanceDe(actor('jefeDeGrupo', 'grupo_1'), ['grupo_1'])
    const delDos = alcanceDe(actor('jefeDeGrupo', 'grupo_2'), ['grupo_2'])
    expect(await servicio.listarPersonas(delUno, 'grupo_1')).toHaveLength(1)
    expect(await servicio.listarPersonas(delDos, 'grupo_1')).toEqual([])
  })

  test('la jefatura del grupo A no da de alta en el grupo B', async () => {
    const servicio = montar(undefined, estructuraFalsa([GRUPO, { ...GRUPO, id: 'grupo_2' }]))
    const delDos = alcanceDe(actor('jefeDeGrupo', 'grupo_2'), ['grupo_2'])
    await expect(servicio.crearPersona(delDos, valida, ingreso)).rejects.toThrow()
    expect(await servicio.listarPersonas(alcanceSinLimites(), 'grupo_1')).toEqual([])
  })

  test('la secretaria del propio grupo si da de alta', async () => {
    const servicio = montar()
    const secretaria = alcanceDe(actor('secretariaDeGrupo', 'grupo_1'), ['grupo_1'])
    const persona = await servicio.crearPersona(secretaria, valida, ingreso)
    expect(persona.pertenencia.grupoId).toBe('grupo_1')
  })
})

describe('editarPersona', () => {
  const alcance = (quien: Actor) => alcanceDe(quien, ['grupo_1'])

  test('corrige un DNI mal tipeado y no toca pertenencia ni cargos', async () => {
    const servicio = montar()
    const persona = await servicio.crearPersona(alcanceSinLimites(), valida, {
      ...ingreso,
      cargos: [{ cargo: 'jefeDeRama', hasta: null }],
    })

    const corregida = await servicio.editarPersona(
      alcance(actor('secretariaDeGrupo')),
      persona.id,
      {
        ...valida,
        numeroDeDocumento: '30.111.999',
        domicilio: 'Otra calle 1',
      },
    )

    expect(corregida.numeroDeDocumento).toBe('30111999')
    const [enLaLista] = await servicio.listarPersonas(alcanceSinLimites(), 'grupo_1')
    expect(enLaLista?.domicilio).toBe('Otra calle 1')
    expect(enLaLista?.pertenencia).toEqual(persona.pertenencia)
    expect(enLaLista?.cargos).toEqual(persona.cargos)
  })

  test('el documento de otra persona se rechaza con un mensaje que se puede mostrar', async () => {
    const servicio = montar()
    const una = await servicio.crearPersona(alcanceSinLimites(), valida, ingreso)
    await servicio.crearPersona(
      alcanceSinLimites(),
      { ...valida, numeroDeDocumento: '30111333' },
      ingreso,
    )

    expect(
      servicio.editarPersona(alcance(actor('jefeDeGrupo')), una.id, {
        ...valida,
        numeroDeDocumento: '30111333',
      }),
    ).rejects.toBeInstanceOf(DocumentoDuplicado)
  })

  test('guardar sin tocar el documento no choca consigo misma', async () => {
    const servicio = montar()
    const persona = await servicio.crearPersona(alcanceSinLimites(), valida, ingreso)

    const corregida = await servicio.editarPersona(alcance(actor('jefeDeGrupo')), persona.id, {
      ...valida,
      telefonoDeContacto: '11 4444-0000',
    })
    expect(corregida.telefonoDeContacto).toBe('11 4444-0000')
  })

  test('datos invalidos no llegan a la base', async () => {
    const servicio = montar()
    const persona = await servicio.crearPersona(alcanceSinLimites(), valida, ingreso)

    expect(
      servicio.editarPersona(alcance(actor('jefeDeGrupo')), persona.id, {
        ...valida,
        apellidos: '  ',
      }),
    ).rejects.toBeInstanceOf(DatosInvalidos)
    const [sinCambios] = await servicio.listarPersonas(alcanceSinLimites(), 'grupo_1')
    expect(sinCambios?.apellidos).toBe('Fernández Ruiz')
  })

  test('la jefatura de otro grupo no puede corregirla', async () => {
    const servicio = montar()
    const persona = await servicio.crearPersona(alcanceSinLimites(), valida, ingreso)

    expect(
      servicio.editarPersona(alcanceDe(actor('jefeDeGrupo', 'grupo_9'), ['grupo_9']), persona.id, {
        ...valida,
        domicilio: 'Calle ajena 1',
      }),
    ).rejects.toBeInstanceOf(CambioDeAutoridadDenegado)
  })
})

describe('cambiarDeUnidad', () => {
  const dirigente = { ...ingreso, categoria: 'activo' as const, unidadId: 'unidad_lob' }

  test('cierra la pertenencia la vispera y abre la nueva', async () => {
    const servicio = montar()
    const persona = await servicio.crearPersona(alcanceSinLimites(), valida, {
      ...dirigente,
      cargos: [{ cargo: 'jefeDeRama', hasta: null }],
    })

    const nueva = await servicio.cambiarDeUnidad(
      alcanceDe(actor('jefeDeGrupo'), ['grupo_1']),
      persona.id,
      'unidad_sco',
      '1969-12-01',
    )

    expect(nueva.unidadId).toBe('unidad_sco')
    expect(nueva.desde).toBe('1969-12-01')
    expect(nueva.categoria).toBe('activo')

    const [enLaLista] = await servicio.listarPersonas(alcanceSinLimites(), 'grupo_1')
    expect(enLaLista?.pertenencia.unidadId).toBe('unidad_sco')
    // Los cargos no se mueven: su ambito es el grupo, no la pertenencia.
    expect(enLaLista?.cargos).toEqual(persona.cargos)
  })

  test('una consulta a una fecha anterior ve la unidad de ese dia', async () => {
    const servicio = montar()
    const persona = await servicio.crearPersona(alcanceSinLimites(), valida, dirigente)
    await servicio.cambiarDeUnidad(
      alcanceDe(actor('jefeDeGrupo'), ['grupo_1']),
      persona.id,
      'unidad_sco',
      '1969-12-01',
    )

    const antes = await servicio.miembrosDelGrupo('grupo_1', '1969-06-01')
    expect(antes.map((miembro) => miembro.unidadId)).toEqual(['unidad_lob'])
    const despues = await servicio.miembrosDelGrupo('grupo_1', '1969-12-01')
    expect(despues.map((miembro) => miembro.unidadId)).toEqual(['unidad_sco'])
    // La vispera del cambio todavia es de la unidad vieja, y de una sola.
    const vispera = await servicio.miembrosDelGrupo('grupo_1', '1969-11-30')
    expect(vispera.map((miembro) => miembro.unidadId)).toEqual(['unidad_lob'])
  })

  test('un beneficiario no cambia de unidad por aca', async () => {
    const servicio = montar()
    const persona = await servicio.crearPersona(alcanceSinLimites(), valida, ingreso)

    expect(
      servicio.cambiarDeUnidad(
        alcanceDe(actor('jefeDeGrupo'), ['grupo_1']),
        persona.id,
        'unidad_sco',
        '1969-12-01',
      ),
    ).rejects.toBeInstanceOf(DatosInvalidos)
  })

  test('la jefatura de otro grupo no puede pasarlo de unidad', async () => {
    const servicio = montar()
    const persona = await servicio.crearPersona(alcanceSinLimites(), valida, dirigente)

    expect(
      servicio.cambiarDeUnidad(
        alcanceDe(actor('jefeDeGrupo', 'grupo_9'), ['grupo_9']),
        persona.id,
        'unidad_sco',
        '1969-12-01',
      ),
    ).rejects.toBeInstanceOf(CambioDeAutoridadDenegado)
  })
})

describe('listarPersonas y la revocación', () => {
  test('un cargo revocado deja de aparecer, uno vencido no', async () => {
    const servicio = montar()
    const persona = await servicio.crearPersona(alcanceSinLimites(), valida, {
      ...ingreso,
      // Uno vencido y uno vigente: el vencido es historia y se muestra igual.
      cargos: [
        { cargo: 'jefeDeRama', hasta: '1969-06-01' },
        { cargo: 'jefeDeGrupo', hasta: null },
      ],
    })
    const jefatura = persona.cargos.find((cargo) => cargo.cargo === 'jefeDeGrupo')

    await servicio.revocarCargo(actor('jefeDeGrupo'), jefatura?.id ?? '')

    const [enLaLista] = await servicio.listarPersonas(alcanceSinLimites(), 'grupo_1')
    expect(enLaLista?.cargos.map((cargo) => cargo.cargo)).toEqual(['jefeDeRama'])
  })
})
