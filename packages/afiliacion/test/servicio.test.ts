import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import type { Declaracion } from '@gps/afiliacion/dominio'
import {
  type Alcance,
  alcanceSinLimites,
  aplicarMigraciones,
  type Bd,
  type Core,
  crearBusDeEventos,
  type Module,
  type Reloj,
} from '@gps/core'
import type { Estructura } from '@gps/estructura/dominio'
import type { MiembroActivo, Personas } from '@gps/personas/dominio'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migraciones } from '../src/servidor/migraciones'
import {
  crearServicioDeAfiliacion,
  DeclaracionDenegada,
  FechaInvalida,
  NadaQueDeclarar,
  type ServicioDeAfiliacion,
  YaDeclaroHoy,
} from '../src/servidor/servicio'

/** Posterior a toda fecha del escenario -mayo del 71 incluido- porque declarar
 *  rechaza el futuro. Sigue en los setenta: una hora del sistema colada se
 *  distingue de un vistazo en vez de parecer plausible.
 *
 *  Al mediodia y no a medianoche: aFechaDeCalendario usa componentes locales,
 *  asi que un instante a las 00:00 UTC cae en el dia anterior en cualquier zona
 *  al oeste de Greenwich. Con las 12:00 el dia es el mismo de Auckland a
 *  Honolulu, y el test no pasa o falla segun donde corra. */
const HORA = new Date('1971-06-01T12:00:00Z')

interface Miembro {
  id: string
  nombres: string
  apellidos: string
  documento: string
  grupoId: string
  desde: string
  /** Sin `hasta` sigue vigente, igual que en la tabla real. */
  hasta?: string
}

/** Un personas falso que aplica la misma regla que miembrosActivos de verdad:
 *  las dos puntas inclusivas. El servicio recibe la dependencia por el
 *  constructor, asi que el test no necesita levantar el otro modulo. */
function personasFalsas(miembros: readonly Miembro[]): Personas {
  return {
    async personaExiste() {
      throw new Error('afiliacion no deberia llamar a personaExiste')
    },
    async nombreDe() {
      throw new Error('afiliacion no deberia llamar a nombreDe')
    },
    async grupoVigenteDe() {
      throw new Error('afiliacion no deberia llamar a grupoVigenteDe')
    },
    async funcionesVigentes() {
      throw new Error('afiliacion no deberia llamar a funcionesVigentes')
    },
    // Mismo criterio que obtenerGrupo mas abajo: afiliacion no pregunta por
    // cargos, y si algun dia empieza a hacerlo el test tiene que enterarse.
    async ocupantesDelCargo() {
      throw new Error('afiliacion no deberia llamar a ocupantesDelCargo')
    },
    async miembrosDelGrupo() {
      throw new Error('afiliacion no deberia llamar a miembrosDelGrupo')
    },
    async miembrosActivos(fecha) {
      return miembros
        .filter((uno) => uno.desde <= fecha && (uno.hasta === undefined || fecha <= uno.hasta))
        .map(
          (uno): MiembroActivo => ({
            grupoId: uno.grupoId,
            persona: {
              id: uno.id,
              tipoDeDocumento: 'dni',
              numeroDeDocumento: uno.documento,
              nombres: uno.nombres,
              apellidos: uno.apellidos,
              fechaDeNacimiento: '1950-01-01',
              domicilio: 'Av. Siempre Viva 742',
              telefonoDeContacto: '11 5555-1234',
              creadoEn: HORA,
              actualizadoEn: HORA,
            },
          }),
        )
    },
  }
}

/** Una estructura falsa. `obtenerGrupo` tira: afiliacion no lo usa, y si algun
 *  dia empieza a usarlo el test tiene que enterarse en vez de recibir null. */
function estructuraFalsa(
  grupos: readonly { id: string; cerradoEn?: string }[] = [{ id: 'grupo_7' }],
): Estructura {
  return {
    async expandirAlcance() {
      throw new Error('afiliacion no deberia llamar a expandirAlcance')
    },
    async obtenerGrupo() {
      throw new Error('afiliacion no deberia llamar a obtenerGrupo')
    },
    async listarDistritosSinGrupos() {
      throw new Error('afiliacion no deberia llamar a listarDistritosSinGrupos')
    },
    async listarGrupos() {
      throw new Error('afiliacion no deberia llamar a listarGrupos')
    },
    async distritoEstaAbierto() {
      throw new Error('afiliacion no deberia llamar a distritoEstaAbierto')
    },
    async gruposAbiertosEn(fecha) {
      return new Set(
        grupos
          .filter((grupo) => grupo.cerradoEn === undefined || fecha <= grupo.cerradoEn)
          .map((grupo) => grupo.id),
      )
    },
  }
}

function montar(
  opciones: {
    miembros?: readonly Miembro[]
    grupos?: readonly { id: string; cerradoEn?: string }[]
    reloj?: Reloj
    suscriptor?: (declaracion: Declaracion) => void | Promise<void>
    alError?: (mensaje: string) => void
    alAuditar?: (evento: import('@gps/core').DatosDeAuditoria) => void
  } = {},
): ServicioDeAfiliacion {
  const base = new Database(':memory:')
  base.exec('PRAGMA foreign_keys = ON')
  const bd: Bd = drizzle(base)

  let contador = 0
  const core: Core = {
    config: { version: '0.0.0', entorno: 'prueba', puerto: 0, auth: null },
    logger: { info: () => {}, error: (mensaje) => opciones.alError?.(mensaje) },
    reloj: opciones.reloj ?? { ahora: () => HORA },
    bd,
    eventos: crearBusDeEventos(),
    auditoria: {
      registrar: (evento) => {
        opciones.alAuditar?.(evento)
        return 'evento_de_auditoria_test'
      },
    },
    modulos: ['estructura', 'personas', 'afiliacion'],
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
    name: 'afiliacion',
    dependencies: [],
    migraciones,
    createServices: () => ({}),
    accesoAlModulo: { porDefecto: 'denegado', permitidos: [] },
    registerSchema: () => {},
  }
  aplicarMigraciones(core, [modulo])
  if (opciones.suscriptor) core.eventos.suscribir('AfiliacionDeclarada', opciones.suscriptor)

  return crearServicioDeAfiliacion(
    core,
    personasFalsas(opciones.miembros ?? []),
    estructuraFalsa(opciones.grupos),
  )
}

const JUAN: Miembro = {
  id: 'persona_juan',
  nombres: 'Juan',
  apellidos: 'Barreto',
  documento: '30111222',
  grupoId: 'grupo_7',
  desde: '1969-03-01',
}

const MARIA: Miembro = {
  id: 'persona_maria',
  nombres: 'María',
  apellidos: 'Cabral',
  documento: '30111333',
  grupoId: 'grupo_7',
  desde: '1969-03-01',
  hasta: '1969-06-30',
}

const PEDRO: Miembro = {
  id: 'persona_pedro',
  nombres: 'Pedro',
  apellidos: 'Almada',
  documento: '30111444',
  grupoId: 'grupo_7',
  desde: '1969-07-01',
}

/** El escenario de §1 de la spec, trasladado a los setenta: Juan y Maria
 *  entran en marzo, Maria se va en junio, Pedro entra en julio. */
const ESCENARIO: readonly Miembro[] = [JUAN, MARIA, PEDRO]

const nombresDe = (afiliados: readonly { nombres: string }[]) =>
  afiliados.map((afiliado) => afiliado.nombres)

describe('declarar', () => {
  test('la nomina de mayo son los dos que entraron en marzo', async () => {
    const servicio = montar({ miembros: ESCENARIO })
    const [declaracion] = await servicio.declarar('1969-05-01')

    expect(declaracion?.grupoId).toBe('grupo_7')
    expect(declaracion?.periodo).toBe(1969)
    expect(nombresDe(await servicio.listarAfiliados(declaracion?.id ?? ''))).toEqual([
      'Juan',
      'María',
    ])
  })

  test('la nomina de noviembre ya no tiene a la que se fue, y si al que entro', async () => {
    const servicio = montar({ miembros: ESCENARIO })
    await servicio.declarar('1969-05-01')
    const [noviembre] = await servicio.declarar('1969-11-01')

    expect(nombresDe(await servicio.listarAfiliados(noviembre?.id ?? ''))).toEqual([
      'Pedro',
      'Juan',
    ])
  })

  test('publica cada declaracion despues de guardarla', async () => {
    const recibidas: string[] = []
    const servicio = montar({
      miembros: ESCENARIO,
      suscriptor: (declaracion) => {
        recibidas.push(declaracion.id)
      },
    })

    const [declaracion] = await servicio.declarar('1969-05-01')

    expect(recibidas).toEqual([declaracion?.id ?? ''])
  })

  test('un suscriptor fallido no revierte ni hace fallar la declaracion', async () => {
    const errores: string[] = []
    const servicio = montar({
      miembros: ESCENARIO,
      suscriptor: () => {
        throw new Error('tesoreria caida')
      },
      alError: (mensaje) => errores.push(mensaje),
    })

    const [declaracion] = await servicio.declarar('1969-05-01')

    expect(await servicio.listarAfiliados(declaracion?.id ?? '')).toHaveLength(2)
    expect(errores).toEqual(['No se pudo procesar AfiliacionDeclarada'])
  })

  test('la nomina va ordenada por apellido, con Intl y no con ORDER BY', async () => {
    // SQLite compara bytes, asi que un ORDER BY pondria "Ávila" despues de
    // "Zaballa". En un idioma con acentos eso es una lista en la que no se
    // encuentra a la gente.
    const servicio = montar({
      miembros: [
        { ...JUAN, apellidos: 'Zaballa' },
        { ...MARIA, hasta: undefined, apellidos: 'Ávila' },
      ],
    })
    const [declaracion] = await servicio.declarar('1969-05-01')
    const nomina = await servicio.listarAfiliados(declaracion?.id ?? '')
    expect(nomina.map((afiliado) => afiliado.apellidos)).toEqual(['Ávila', 'Zaballa'])
  })

  test('la nomina guarda el documento, no solo el id', async () => {
    // Es lo que se le presenta a la asociacion, que identifica gente por
    // documento y no por nuestro id interno.
    const servicio = montar({ miembros: ESCENARIO })
    const [declaracion] = await servicio.declarar('1969-05-01')
    const nomina = await servicio.listarAfiliados(declaracion?.id ?? '')
    expect(nomina[0]).toMatchObject({ tipoDeDocumento: 'dni', numeroDeDocumento: '30111222' })
  })

  test('declara una nomina por grupo', async () => {
    const servicio = montar({
      miembros: [JUAN, { ...PEDRO, grupoId: 'grupo_12', desde: '1969-03-01' }],
      grupos: [{ id: 'grupo_7' }, { id: 'grupo_12' }],
    })
    const nuevas = await servicio.declarar('1969-05-01')
    expect(nuevas.map((una) => una.grupoId).sort()).toEqual(['grupo_12', 'grupo_7'])
  })

  test('un grupo cerrado no declara', async () => {
    const servicio = montar({
      miembros: ESCENARIO,
      grupos: [{ id: 'grupo_7', cerradoEn: '1969-10-15' }],
    })
    expect(await servicio.declarar('1969-11-01')).toEqual([])
  })

  test('pero si declaraba antes de cerrar', async () => {
    // El grupo existia el dia de la declaracion: la nomina es legitima.
    const servicio = montar({
      miembros: ESCENARIO,
      grupos: [{ id: 'grupo_7', cerradoEn: '1969-10-15' }],
    })
    expect(await servicio.declarar('1969-05-01')).toHaveLength(1)
  })

  test('un grupo sin nadie activo no declara', async () => {
    const servicio = montar({ miembros: [] })
    expect(await servicio.declarar('1969-05-01')).toEqual([])
  })

  test('un grupo no declara dos veces el mismo dia: se lo saltea', async () => {
    // No tira: el salteo por grupo es lo que hace idempotente al barrido. El
    // UNIQUE(fecha, grupo_id) queda de red por debajo.
    const servicio = montar({ miembros: ESCENARIO })
    await servicio.declarar('1969-05-01')
    expect(await servicio.declarar('1969-05-01')).toEqual([])
    expect(await servicio.listarDeclaraciones('grupo_7')).toHaveLength(1)
  })

  test('que un grupo ya haya declarado ese dia no frena a los otros', async () => {
    // El bug: un pre-chequeo por fecha sola daba por hecha la ordinaria de los
    // quince grupos con que la tuviera uno.
    const servicio = montar({
      miembros: [JUAN, { ...PEDRO, grupoId: 'grupo_12', desde: '1969-03-01' }],
      grupos: [{ id: 'grupo_7' }, { id: 'grupo_12' }],
    })
    await servicio.declarar('1969-05-01', 'grupo_7')

    const resto = await servicio.declarar('1969-05-01')
    expect(resto.map((una) => una.grupoId)).toEqual(['grupo_12'])
  })

  test('las dos escrituras son atomicas: sin nomina no queda declaracion', async () => {
    // Una persona repetida en el mismo grupo rompe la primary key de
    // `afiliados`. Si las dos escrituras no estuvieran en una transaccion,
    // quedaria una declaracion con la nomina a medias: una deuda que nadie
    // podria distinguir de un error.
    const servicio = montar({ miembros: [JUAN, JUAN] })
    await expect(servicio.declarar('1969-05-01')).rejects.toThrow()
    expect(await servicio.listarDeclaraciones('grupo_7')).toEqual([])
  })

  test('rechaza una fecha anterior a la ultima declaracion', async () => {
    // La regla es global y no por grupo: una declaracion retroactiva le moveria
    // el a-cobrar a una ya emitida de otro grupo.
    const servicio = montar({
      miembros: [JUAN, { ...PEDRO, grupoId: 'grupo_12', desde: '1969-03-01' }],
      grupos: [{ id: 'grupo_7' }, { id: 'grupo_12' }],
    })
    await servicio.declarar('1969-11-01', 'grupo_7')
    expect(servicio.declarar('1969-05-01', 'grupo_12')).rejects.toThrow(FechaInvalida)
  })

  test('rechaza una fecha futura', async () => {
    const servicio = montar({ miembros: ESCENARIO })
    expect(servicio.declarar('1999-05-01')).rejects.toThrow(FechaInvalida)
  })
})

describe('declararExtraordinaria', () => {
  test('declara ese grupo solo, con la fecha de hoy', async () => {
    const servicio = montar({
      miembros: [JUAN, { ...PEDRO, grupoId: 'grupo_12', desde: '1969-03-01' }],
      grupos: [{ id: 'grupo_7' }, { id: 'grupo_12' }],
    })
    const declaracion = await servicio.declararExtraordinaria(alcanceSinLimites(), 'grupo_7')

    expect(declaracion.grupoId).toBe('grupo_7')
    expect(declaracion.fecha).toBe('1971-06-01')
  })

  test('audita actor, grupo y declaración en la misma operación', async () => {
    const eventos: import('@gps/core').DatosDeAuditoria[] = []
    const servicio = montar({ miembros: [JUAN], alAuditar: (evento) => eventos.push(evento) })
    const declaracion = await servicio.declararExtraordinaria(
      alcanceSinLimites('secretaria'),
      'grupo_7',
    )
    expect(eventos.at(-1)).toMatchObject({
      actorPersonaId: 'secretaria',
      modulo: 'afiliacion',
      accion: 'declararAfiliacion',
      grupoId: 'grupo_7',
      entidadId: declaracion.id,
    })
  })

  test('avisa si el grupo no tiene a nadie que declarar', async () => {
    const servicio = montar({ miembros: [] })
    expect(servicio.declararExtraordinaria(alcanceSinLimites(), 'grupo_7')).rejects.toThrow(
      NadaQueDeclarar,
    )
  })

  test('avisa si el grupo ya declaro hoy, en vez de tirar el error crudo de SQLite', async () => {
    // Apretar el boton dos veces, o que entre otro dirigente del mismo grupo.
    // Sin este error, el UNIQUE(fecha, grupo_id) sube como SQLiteError y la
    // pantalla dibuja "Unexpected error.".
    const servicio = montar({ miembros: ESCENARIO })
    await servicio.declararExtraordinaria(alcanceSinLimites(), 'grupo_7')
    expect(servicio.declararExtraordinaria(alcanceSinLimites(), 'grupo_7')).rejects.toThrow(
      YaDeclaroHoy,
    )
  })

  test('tambien si el que declaro hoy fue el barrido', async () => {
    // El reloj en una fecha ordinaria: declararExtraordinaria barre las
    // pendientes primero, asi que la del dia ya esta emitida cuando llega a la
    // suya. Es el dia en que se rompia el demo.
    const servicio = montar({
      miembros: ESCENARIO,
      reloj: { ahora: () => new Date('1969-05-01T12:00:00Z') },
    })
    await expect(servicio.declararExtraordinaria(alcanceSinLimites(), 'grupo_7')).rejects.toThrow(
      YaDeclaroHoy,
    )
    expect((await servicio.listarDeclaraciones('grupo_7')).map((una) => una.fecha)).toEqual([
      '1969-05-01',
    ])
  })
})

describe('listarACobrar', () => {
  test('el escenario completo de la spec: 1 + 1 + 1 en dos periodos', async () => {
    const servicio = montar({ miembros: ESCENARIO })

    const [mayo] = await servicio.declarar('1969-05-01')
    expect(nombresDe(await servicio.listarACobrar(mayo?.id ?? ''))).toEqual(['Juan', 'María'])

    // Noviembre: la nomina son Juan y Pedro, pero Juan ya esta pago desde mayo
    // y lo de Maria no se recupera. Se cobra uno solo.
    const [noviembre] = await servicio.declarar('1969-11-01')
    expect(nombresDe(await servicio.listarACobrar(noviembre?.id ?? ''))).toEqual(['Pedro'])

    // Periodo nuevo: el ciclo arranca de cero y se cobra a todos los activos.
    const [mayoSiguiente] = await servicio.declarar('1970-05-01')
    expect(nombresDe(await servicio.listarACobrar(mayoSiguiente?.id ?? ''))).toEqual([
      'Pedro',
      'Juan',
    ])
  })

  test('el que se muda de grupo no se paga dos veces', async () => {
    // La afiliacion es de la persona con la asociacion, no del vinculo con un
    // grupo. Ana esta en la nomina de noviembre del Grupo 12 y no se le cobra,
    // porque el Grupo 7 ya pago por ella en mayo. Es el test que prueba que el
    // anti-join cruza grupos.
    const servicio = montar({
      miembros: [
        {
          id: 'persona_ana',
          nombres: 'Ana',
          apellidos: 'Duarte',
          documento: '30111555',
          grupoId: 'grupo_7',
          desde: '1969-03-01',
          hasta: '1969-06-30',
        },
        {
          id: 'persona_ana',
          nombres: 'Ana',
          apellidos: 'Duarte',
          documento: '30111555',
          grupoId: 'grupo_12',
          desde: '1969-07-01',
        },
      ],
      grupos: [{ id: 'grupo_7' }, { id: 'grupo_12' }],
    })

    const [mayo] = await servicio.declarar('1969-05-01')
    expect(nombresDe(await servicio.listarACobrar(mayo?.id ?? ''))).toEqual(['Ana'])

    const [noviembre] = await servicio.declarar('1969-11-01')
    expect(noviembre?.grupoId).toBe('grupo_12')
    expect(nombresDe(await servicio.listarAfiliados(noviembre?.id ?? ''))).toEqual(['Ana'])
    expect(await servicio.listarACobrar(noviembre?.id ?? '')).toEqual([])
  })

  test('los cocineros: una extraordinaria barre a todos los pendientes', async () => {
    // No solo a los recien llegados. Quien entro en junio y todavia no estaba
    // afiliado tambien se cobra: lo debe igual, y es lo que mantiene
    // "declaracion" como un solo concepto en vez de dos.
    const servicio = montar({
      miembros: [
        JUAN,
        { ...PEDRO, desde: '1969-06-15' },
        {
          id: 'persona_cocinera',
          nombres: 'Rosario',
          apellidos: 'Zaballa',
          documento: '30111666',
          grupoId: 'grupo_7',
          desde: '1969-09-01',
        },
      ],
      reloj: { ahora: () => new Date('1969-09-15T12:00:00Z') },
    })

    const [mayo] = await servicio.declarar('1969-05-01')
    expect(nombresDe(await servicio.listarACobrar(mayo?.id ?? ''))).toEqual(['Juan'])

    const extraordinaria = await servicio.declararExtraordinaria(alcanceSinLimites(), 'grupo_7')
    expect(nombresDe(await servicio.listarACobrar(extraordinaria.id))).toEqual(['Pedro', 'Rosario'])
  })

  test('el campamento de enero sigue cubierto por la afiliacion de noviembre', async () => {
    // Es el caso que motiva que el periodo no sea el anio del almanaque. Con el
    // corte el 1 de marzo, enero del 71 es todavia del periodo 1970.
    const servicio = montar({ miembros: ESCENARIO })

    const [noviembre] = await servicio.declarar('1970-11-01')
    expect(noviembre?.periodo).toBe(1970)
    expect(nombresDe(await servicio.listarACobrar(noviembre?.id ?? ''))).toEqual(['Pedro', 'Juan'])

    const [enero] = await servicio.declarar('1971-01-15')
    expect(enero?.periodo).toBe(1970)
    expect(await servicio.listarACobrar(enero?.id ?? '')).toEqual([])

    // Recien en mayo, ya en el periodo 1971, vuelven a ser cobrables.
    const [mayo] = await servicio.declarar('1971-05-01')
    expect(mayo?.periodo).toBe(1971)
    expect(nombresDe(await servicio.listarACobrar(mayo?.id ?? ''))).toEqual(['Pedro', 'Juan'])
  })
})

describe('listarDeclaraciones', () => {
  test('las de ese grupo, de la mas reciente a la mas vieja', async () => {
    const servicio = montar({ miembros: ESCENARIO })
    await servicio.declarar('1969-05-01')
    await servicio.declarar('1969-11-01')

    const listadas = await servicio.listarDeclaraciones('grupo_7')
    expect(listadas.map((una) => una.fecha)).toEqual(['1969-11-01', '1969-05-01'])
  })

  test('no devuelve las de otro grupo', async () => {
    const servicio = montar({ miembros: ESCENARIO })
    await servicio.declarar('1969-05-01')
    expect(await servicio.listarDeclaraciones('grupo_12')).toEqual([])
  })

  test('sin grupo devuelve todas para los modulos consumidores', async () => {
    const servicio = montar({
      miembros: [JUAN, { ...PEDRO, grupoId: 'grupo_12', desde: '1969-03-01' }],
      grupos: [{ id: 'grupo_7' }, { id: 'grupo_12' }],
    })
    await servicio.declarar('1969-05-01')

    expect((await servicio.listarDeclaraciones()).map((una) => una.grupoId).sort()).toEqual([
      'grupo_12',
      'grupo_7',
    ])
  })
})

describe('afiliadosEn', () => {
  test('devuelve solo los que ya estan afiliados en ese periodo', async () => {
    const servicio = montar({ miembros: ESCENARIO })
    await servicio.declarar('1969-05-01')

    const afiliados = await servicio.afiliadosEn(alcanceSinLimites(), 1969, [
      'persona_juan',
      'persona_maria',
      'persona_pedro',
    ])
    expect(afiliados.has('persona_juan')).toBe(true)
    expect(afiliados.has('persona_pedro')).toBe(false)
  })

  test('el periodo siguiente arranca vacio', async () => {
    const servicio = montar({ miembros: ESCENARIO })
    await servicio.declarar('1969-05-01')
    expect(await servicio.afiliadosEn(alcanceSinLimites(), 1970, ['persona_juan'])).toEqual(
      new Set(),
    )
  })

  test('sin ids que preguntar no consulta la base', async () => {
    const servicio = montar({ miembros: ESCENARIO })
    expect(await servicio.afiliadosEn(alcanceSinLimites(), 1969, [])).toEqual(new Set())
  })
})

describe('declararPendientes', () => {
  test('declara las ordinarias del periodo que ya pasaron', async () => {
    // Reloj en noviembre del 69: mayo ya paso, noviembre tambien.
    const servicio = montar({
      miembros: ESCENARIO,
      reloj: { ahora: () => new Date('1969-11-20T12:00:00Z') },
    })
    const nuevas = await servicio.declararPendientes()
    expect(nuevas.map((una) => una.fecha)).toEqual(['1969-05-01', '1969-11-01'])
  })

  test('cubre todos los grupos abiertos: es interno y no depende de ningun actor', async () => {
    const servicio = montar({
      miembros: [JUAN, { ...PEDRO, grupoId: 'grupo_12', desde: '1969-03-01' }],
      grupos: [{ id: 'grupo_7' }, { id: 'grupo_12' }],
      reloj: { ahora: () => new Date('1969-11-20T12:00:00Z') },
    })
    // Sin alcance y sin actor: el barrido no pasa por la autorizacion porque no
    // lo inicia un usuario. Si alguna vez lo hiciera, dejaria grupos afuera.
    const nuevas = await servicio.declararPendientes()
    expect([...new Set(nuevas.map((una) => una.grupoId))].sort()).toEqual(['grupo_12', 'grupo_7'])
  })

  test('no declara las que todavia no llegaron', async () => {
    const servicio = montar({
      miembros: ESCENARIO,
      reloj: { ahora: () => new Date('1969-06-15T12:00:00Z') },
    })
    expect((await servicio.declararPendientes()).map((una) => una.fecha)).toEqual(['1969-05-01'])
  })

  test('es idempotente: dos corridas seguidas dejan lo mismo', async () => {
    // Es la propiedad que hace que quien lo llama y cuando deje de ser una
    // decision delicada. La garantiza el UNIQUE(fecha, grupo_id).
    const servicio = montar({
      miembros: ESCENARIO,
      reloj: { ahora: () => new Date('1969-11-20T12:00:00Z') },
    })
    await servicio.declararPendientes()
    expect(await servicio.declararPendientes()).toEqual([])
    expect(await servicio.listarDeclaraciones('grupo_7')).toHaveLength(2)
  })

  test('se pone al dia despues de estar caido', async () => {
    // Las pertenencias tienen historial, asi que la foto del 1 de mayo se puede
    // tomar en noviembre y sale bien.
    const servicio = montar({
      miembros: ESCENARIO,
      reloj: { ahora: () => new Date('1969-11-20T12:00:00Z') },
    })
    await servicio.declararPendientes()
    const [mayo] = (await servicio.listarDeclaraciones('grupo_7')).filter(
      (una) => una.fecha === '1969-05-01',
    )
    expect(nombresDe(await servicio.listarAfiliados(mayo?.id ?? ''))).toEqual(['Juan', 'María'])
  })

  test('una extraordinaria del mismo dia no le come la ordinaria a los demas', async () => {
    // El escenario que se perdia en silencio: el barrido corre a la tarde y a
    // la manania un grupo apreto el boton. Con el pre-chequeo por fecha, esa
    // sola declaracion daba por hecha la ordinaria de todos.
    const servicio = montar({
      miembros: [JUAN, { ...PEDRO, grupoId: 'grupo_12', desde: '1969-03-01' }],
      grupos: [{ id: 'grupo_7' }, { id: 'grupo_12' }],
      reloj: { ahora: () => new Date('1969-05-01T12:00:00Z') },
    })
    // Una declaracion suelta del grupo 7 con la fecha ordinaria, que es lo que
    // dejaba el boton antes de que declararExtraordinaria barriera primero.
    await servicio.declarar('1969-05-01', 'grupo_7')

    const nuevas = await servicio.declararPendientes()
    expect(nuevas.map((una) => una.grupoId)).toEqual(['grupo_12'])
    expect(await servicio.listarDeclaraciones('grupo_12')).toHaveLength(1)
  })

  test('una extraordinaria posterior no deja bloqueada una ordinaria vencida', async () => {
    // El otro escenario: la extraordinaria del 2 de mayo dejaria a la ordinaria
    // del 1 "con fecha anterior a la ultima" para siempre. declararExtraordinaria
    // vacia las pendientes antes de declarar, asi que no puede pasar.
    const servicio = montar({
      miembros: ESCENARIO,
      reloj: { ahora: () => new Date('1969-05-02T12:00:00Z') },
    })
    const extraordinaria = await servicio.declararExtraordinaria(alcanceSinLimites(), 'grupo_7')

    expect(extraordinaria.fecha).toBe('1969-05-02')
    expect((await servicio.listarDeclaraciones('grupo_7')).map((una) => una.fecha)).toEqual([
      '1969-05-02',
      '1969-05-01',
    ])
    // Y el barrido posterior no tiene nada que reintentar ni que loguear.
    expect(await servicio.declararPendientes()).toEqual([])
  })

  test('no toca las ordinarias de otro periodo', async () => {
    const servicio = montar({
      miembros: ESCENARIO,
      reloj: { ahora: () => new Date('1970-06-15T12:00:00Z') },
    })
    // Estamos en el periodo 1970: solo el 1 de mayo de 1970 esta vencido.
    expect((await servicio.declararPendientes()).map((una) => una.fecha)).toEqual(['1970-05-01'])
  })
})

describe('alcance entre grupos', () => {
  const delGrupo = (grupoId: string): Alcance => ({
    actor: {
      personaId: 'persona_1',
      roles: [{ rol: 'jefeDeGrupo', ambito: { tipo: 'grupo', id: grupoId } }],
      esAdministradorDesignado: false,
      estaElevado: false,
    },
    gruposVisibles: [grupoId],
    distritosVisibles: [],
    esAdministrador: false,
  })

  test('no se declara la nomina de un grupo ajeno', async () => {
    const servicio = montar({ miembros: [JUAN] })
    expect(servicio.declararExtraordinaria(delGrupo('grupo_12'), 'grupo_7')).rejects.toThrow(
      DeclaracionDenegada,
    )
  })

  test('no se leen las declaraciones de un grupo ajeno', async () => {
    const servicio = montar({ miembros: [JUAN] })
    await servicio.declararExtraordinaria(delGrupo('grupo_7'), 'grupo_7')
    expect(
      (await servicio.listarDeclaracionesDelGrupo(delGrupo('grupo_7'), 'grupo_7')).length,
    ).toBeGreaterThan(0)
    expect(await servicio.listarDeclaracionesDelGrupo(delGrupo('grupo_12'), 'grupo_7')).toEqual([])
  })

  test('afiliadosEn no contesta por personas de grupos ajenos', async () => {
    const servicio = montar({ miembros: [JUAN] })
    const declarada = await servicio.declararExtraordinaria(delGrupo('grupo_7'), 'grupo_7')
    const propios = await servicio.afiliadosEn(delGrupo('grupo_7'), declarada.periodo, [JUAN.id])
    expect(propios.has(JUAN.id)).toBe(true)
    const ajenos = await servicio.afiliadosEn(delGrupo('grupo_12'), declarada.periodo, [JUAN.id])
    expect(ajenos.has(JUAN.id)).toBe(false)
  })
})
