import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import {
  alcanceSinLimites,
  aplicarMigraciones,
  type Bd,
  type Core,
  crearBusDeEventos,
  type Module,
  type Reloj,
} from '@gps/core'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import type { Rama } from '../src/dominio/ramas'
import { ramasDeLasUnidades } from '../src/dominio/unidades'
import { migraciones } from '../src/servidor/migraciones'
import {
  crearServicioDeEstructura,
  type ServicioDeEstructura,
  UnidadInvalida,
} from '../src/servidor/servicio'

const HORA = new Date('1970-01-01T00:00:00Z')

/** Un modulo con la base migrada y un Core de ids fijos: asi los tests pueden
 *  afirmar valores exactos en vez de rangos. El reloj es fijo en HORA por
 *  default; algun test lo reemplaza por uno que avanza para verificar que una
 *  operacion mueve `actualizadoEn`. La fecha es epoch 1970 para que una hora
 *  del sistema colada se distinga de un vistazo en vez de parecer plausible. */
function montarConBd(reloj: Reloj = { ahora: () => HORA }): {
  servicio: ServicioDeEstructura
  bd: Bd
} {
  const base = new Database(':memory:')
  base.exec('PRAGMA foreign_keys = ON')
  const bd: Bd = drizzle(base)

  let contador = 0
  const core: Core = {
    config: { version: '0.0.0', entorno: 'prueba', puerto: 0, auth: null },
    logger: { info: () => {}, error: () => {} },
    reloj,
    bd,
    eventos: crearBusDeEventos(),
    modulos: ['estructura'],
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
    name: 'estructura',
    dependencies: [],
    migraciones,
    createServices: () => ({}),
    accesoAlModulo: { porDefecto: 'denegado', permitidos: [] },
    registerSchema: () => {},
  }
  aplicarMigraciones(core, [modulo])
  return { servicio: crearServicioDeEstructura(core), bd }
}

const montar = (): ServicioDeEstructura => montarConBd().servicio

/** Casi todos los tests abrian ramas y solo miran que rama quedo. Con unidades
 *  hace falta un nombre, que a esos tests no les importa: lo pone el helper. */
const abrirUnidadDe = (servicio: ServicioDeEstructura, grupoId: string, rama: Rama) =>
  servicio.abrirUnidad({ grupoId, rama, sexo: 'mixta', nombre: `La de ${rama}` })

describe('crearDistrito', () => {
  test('devuelve el distrito con el id y las marcas que da Core', () => {
    const servicio = montar()
    expect(servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })).resolves.toEqual({
      id: 'distrito_1',
      numero: 1,
      zona: 'San Isidro',
      cerradoEn: null,
      creadoEn: HORA,
      actualizadoEn: HORA,
    })
  })
})

describe('expandirAlcance', () => {
  test('expande grupo, distrito y sudo sin dar poder al administrador no elevado', async () => {
    const servicio = montar()
    const distrito1 = await servicio.crearDistrito({ numero: 1, zona: 'Norte' })
    const distrito2 = await servicio.crearDistrito({ numero: 2, zona: 'Sur' })
    const grupo1 = await servicio.crearGrupo({ numero: 1, nombre: 'Uno', distritoId: distrito1.id })
    const grupo2 = await servicio.crearGrupo({ numero: 2, nombre: 'Dos', distritoId: distrito2.id })
    const actor = {
      personaId: 'persona_1',
      roles: [
        {
          rol: 'comisionadoDeDistrito' as const,
          ambito: { tipo: 'distrito' as const, id: distrito1.id },
        },
      ],
      esAdministradorDesignado: true,
      estaElevado: false,
    }

    expect(await servicio.expandirAlcance(actor)).toEqual({
      actor,
      distritosVisibles: [distrito1.id],
      gruposVisibles: [grupo1.id],
      esAdministrador: false,
    })
    expect(await servicio.expandirAlcance({ ...actor, roles: [] })).toEqual({
      actor: { ...actor, roles: [] },
      distritosVisibles: [],
      gruposVisibles: [],
      esAdministrador: false,
    })
    expect(await servicio.expandirAlcance({ ...actor, roles: [], estaElevado: true })).toEqual({
      actor: { ...actor, roles: [], estaElevado: true },
      distritosVisibles: [distrito1.id, distrito2.id],
      gruposVisibles: [grupo1.id, grupo2.id],
      esAdministrador: true,
    })
  })
})

describe('listarDistritos', () => {
  test('sin datos devuelve una lista vacia, no undefined', async () => {
    expect(await montar().listarDistritos(alcanceSinLimites())).toEqual([])
  })

  test('las marcas vuelven de la base como Date, no como el entero que guarda', async () => {
    // El resultado de listarDistritos sale de una fila releida, asi que es lo
    // unico que verifica el ida y vuelta timestamp_ms <-> Date del mapeo.
    const servicio = montar()
    await servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })
    const [distrito] = await servicio.listarDistritos(alcanceSinLimites())
    expect(distrito?.creadoEn).toEqual(HORA)
    expect(distrito?.actualizadoEn).toEqual(HORA)
  })

  test('devuelve el arbol armado: distrito, sus grupos y sus ramas', async () => {
    const servicio = montar()
    const distrito = await servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })
    const grupo = await servicio.crearGrupo({
      numero: 42,
      nombre: 'Ceferino Namuncurá',
      distritoId: distrito.id,
    })
    await abrirUnidadDe(servicio, grupo.id, 'lobatos')
    await abrirUnidadDe(servicio, grupo.id, 'scouts')

    const arbol = await servicio.listarDistritos(alcanceSinLimites())
    expect(arbol).toHaveLength(1)
    expect(arbol[0]?.zona).toBe('San Isidro')
    expect(arbol[0]?.grupos).toHaveLength(1)
    expect(arbol[0]?.grupos[0]?.numero).toBe(42)
    expect(ramasDeLasUnidades(arbol[0]?.grupos[0]?.unidades ?? [])).toEqual(['lobatos', 'scouts'])
  })

  test('las unidades vuelven en orden del catalogo, no en el que se abrieron', async () => {
    // La pantalla las muestra de menor a mayor edad; que ese orden dependa de
    // en que orden se cargaron seria un bug dificil de ver.
    const servicio = montar()
    const distrito = await servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })
    const grupo = await servicio.crearGrupo({ numero: 1, nombre: 'Uno', distritoId: distrito.id })
    await abrirUnidadDe(servicio, grupo.id, 'rovers')
    await abrirUnidadDe(servicio, grupo.id, 'castores')
    await abrirUnidadDe(servicio, grupo.id, 'scouts')

    const arbol = await servicio.listarDistritos(alcanceSinLimites())
    expect(arbol[0]?.grupos[0]?.unidades.map((unidad) => unidad.rama)).toEqual([
      'castores',
      'scouts',
      'rovers',
    ])
  })

  test('dentro de una rama las unidades vienen por nombre', async () => {
    // Dos tropas scout: el orden lo decide el nombre y no el de carga, por la
    // misma razon que el orden entre ramas lo decide el catalogo.
    const servicio = montar()
    const distrito = await servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })
    const grupo = await servicio.crearGrupo({ numero: 1, nombre: 'Uno', distritoId: distrito.id })
    await servicio.abrirUnidad({
      grupoId: grupo.id,
      rama: 'scouts',
      sexo: 'masculina',
      nombre: 'San Jorge',
    })
    await servicio.abrirUnidad({
      grupoId: grupo.id,
      rama: 'scouts',
      sexo: 'femenina',
      nombre: 'Ana Frank',
    })

    const arbol = await servicio.listarDistritos(alcanceSinLimites())
    expect(arbol[0]?.grupos[0]?.unidades.map((unidad) => unidad.nombre)).toEqual([
      'Ana Frank',
      'San Jorge',
    ])
  })

  test('un grupo sin unidades abiertas viene con la lista vacia', async () => {
    const servicio = montar()
    const distrito = await servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })
    await servicio.crearGrupo({ numero: 88, nombre: 'Ocho Ocho', distritoId: distrito.id })

    const arbol = await servicio.listarDistritos(alcanceSinLimites())
    expect(arbol[0]?.grupos[0]?.unidades).toEqual([])
  })

  test('un distrito sin grupos viene con la lista vacia', async () => {
    const servicio = montar()
    await servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })
    expect((await servicio.listarDistritos(alcanceSinLimites()))[0]?.grupos).toEqual([])
  })

  test('distritos y grupos vienen ordenados por numero, no por orden de carga', async () => {
    const servicio = montar()
    const sur = await servicio.crearDistrito({ numero: 2, zona: 'Quilmes' })
    await servicio.crearDistrito({ numero: 1, zona: 'Ciudad' })
    await servicio.crearGrupo({ numero: 42, nombre: 'Cuarenta', distritoId: sur.id })
    await servicio.crearGrupo({ numero: 7, nombre: 'Siete', distritoId: sur.id })

    const arbol = await servicio.listarDistritos(alcanceSinLimites())
    expect(arbol.map((distrito) => distrito.numero)).toEqual([1, 2])
    expect(arbol[1]?.grupos.map((grupo) => grupo.numero)).toEqual([7, 42])
  })

  test('dos distritos con el mismo numero no se pueden crear', async () => {
    // La clave natural la impone la base, no el servicio: es lo unico que no
    // se puede saltear.
    const servicio = montar()
    await servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })
    expect(servicio.crearDistrito({ numero: 1, zona: 'Quilmes' })).rejects.toThrow()
  })

  test('una unidad de una rama que ya no esta en el catalogo no se muestra', async () => {
    // Sacar una rama de RAMAS esta descripto como cambio solo de codigo, pero
    // unidades sigue guardando el id viejo. Que se cuele hasta el enum de
    // GraphQL anula la query entera -`rama: Rama!` es no nulo hasta arriba-,
    // asi que el servicio la filtra: se pierde una unidad, no la app.
    const { servicio, bd } = montarConBd()
    const distrito = await servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })
    const grupo = await servicio.crearGrupo({ numero: 1, nombre: 'Uno', distritoId: distrito.id })
    await abrirUnidadDe(servicio, grupo.id, 'scouts')
    bd.run(
      sql.raw(
        `INSERT INTO unidades (id, grupo_id, rama, sexo, nombre, cerrada_en, creado_en, actualizado_en)
         VALUES ('u_vieja', '${grupo.id}', 'pioneros', 'mixta', 'Los Pioneros', NULL, 0, 0)`,
      ),
    )

    const arbol = await servicio.listarDistritos(alcanceSinLimites())
    expect(arbol[0]?.grupos[0]?.unidades.map((unidad) => unidad.rama)).toEqual(['scouts'])
  })
})

describe('obtenerGrupo', () => {
  test('devuelve el grupo con sus unidades abiertas, ordenadas por catalogo', async () => {
    const { servicio } = montarConBd()
    const distrito = await servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })
    const grupo = await servicio.crearGrupo({
      numero: 42,
      nombre: 'Ceferino Namuncurá',
      distritoId: distrito.id,
    })
    // Se abren desordenadas a proposito: el orden de salida tiene que ser el
    // del catalogo, no el de insercion.
    await abrirUnidadDe(servicio, grupo.id, 'scouts')
    await abrirUnidadDe(servicio, grupo.id, 'castores')

    const obtenido = await servicio.obtenerGrupo(grupo.id)
    expect(obtenido?.unidades.map((unidad) => unidad.rama)).toEqual(['castores', 'scouts'])
  })

  test('devuelve null si el grupo no existe', async () => {
    expect(await montarConBd().servicio.obtenerGrupo('grupo_inexistente')).toBeNull()
  })

  test('devuelve null si el grupo esta cerrado', async () => {
    // Para los otros modulos un grupo cerrado no existe, igual que no aparece
    // en listarDistritos. Asi "no se puede inscribir a nadie en un grupo
    // cerrado" no necesita una regla aparte.
    const { servicio } = montarConBd()
    const distrito = await servicio.crearDistrito({ numero: 1, zona: 'Quilmes' })
    const grupo = await servicio.crearGrupo({
      numero: 19,
      nombre: 'San Miguel Arcángel',
      distritoId: distrito.id,
    })
    await servicio.cerrarGrupo(grupo.id)

    expect(await servicio.obtenerGrupo(grupo.id)).toBeNull()
  })

  test('un grupo sin unidades abiertas devuelve la lista vacia', async () => {
    const { servicio } = montarConBd()
    const distrito = await servicio.crearDistrito({ numero: 4, zona: 'Morón' })
    const grupo = await servicio.crearGrupo({
      numero: 88,
      nombre: 'Padre Mario Pantaleo',
      distritoId: distrito.id,
    })
    expect((await servicio.obtenerGrupo(grupo.id))?.unidades).toEqual([])
  })
})

describe('abrirUnidad', () => {
  const montarConGrupo = async () => {
    const { servicio } = montarConBd()
    const distrito = await servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })
    const grupo = await servicio.crearGrupo({ numero: 1, nombre: 'Uno', distritoId: distrito.id })
    return { servicio, grupo }
  }

  test('un grupo puede tener dos tropas scout, que es lo que antes no podia', async () => {
    const { servicio, grupo } = await montarConGrupo()
    await servicio.abrirUnidad({
      grupoId: grupo.id,
      rama: 'scouts',
      sexo: 'femenina',
      nombre: 'Santa Juana',
    })
    expect(
      servicio.abrirUnidad({
        grupoId: grupo.id,
        rama: 'scouts',
        sexo: 'masculina',
        nombre: 'San Jorge',
      }),
    ).resolves.toMatchObject({ nombre: 'San Jorge', sexo: 'masculina' })
  })

  test('dos unidades abiertas de la misma rama no pueden compartir nombre', async () => {
    const { servicio, grupo } = await montarConGrupo()
    const datos = {
      grupoId: grupo.id,
      rama: 'scouts',
      sexo: 'mixta',
      nombre: 'San Jorge',
    } as const
    await servicio.abrirUnidad(datos)
    expect(servicio.abrirUnidad(datos)).rejects.toThrow()
  })

  test('el mismo nombre se puede repetir en otra rama', async () => {
    const { servicio, grupo } = await montarConGrupo()
    await servicio.abrirUnidad({
      grupoId: grupo.id,
      rama: 'scouts',
      sexo: 'mixta',
      nombre: 'San Jorge',
    })
    expect(
      servicio.abrirUnidad({
        grupoId: grupo.id,
        rama: 'raiders',
        sexo: 'mixta',
        nombre: 'San Jorge',
      }),
    ).resolves.toMatchObject({ rama: 'raiders' })
  })

  test('el nombre en blanco no alcanza: es lo unico que distingue dos unidades', async () => {
    const { servicio, grupo } = await montarConGrupo()
    expect(
      servicio.abrirUnidad({ grupoId: grupo.id, rama: 'scouts', sexo: 'mixta', nombre: '   ' }),
    ).rejects.toThrow(UnidadInvalida)
  })

  test('el nombre se guarda sin los espacios de los bordes', async () => {
    const { servicio, grupo } = await montarConGrupo()
    expect(
      servicio.abrirUnidad({
        grupoId: grupo.id,
        rama: 'scouts',
        sexo: 'mixta',
        nombre: '  San Jorge  ',
      }),
    ).resolves.toMatchObject({ nombre: 'San Jorge' })
  })

  test('una rama que no esta en el catalogo no abre unidad', async () => {
    const { servicio, grupo } = await montarConGrupo()
    expect(
      servicio.abrirUnidad({
        grupoId: grupo.id,
        rama: 'pioneros' as never,
        sexo: 'mixta',
        nombre: 'Los Pioneros',
      }),
    ).rejects.toThrow(UnidadInvalida)
  })

  test('un grupo cerrado no abre unidades', async () => {
    const { servicio, grupo } = await montarConGrupo()
    await servicio.cerrarGrupo(grupo.id)
    expect(
      servicio.abrirUnidad({
        grupoId: grupo.id,
        rama: 'scouts',
        sexo: 'mixta',
        nombre: 'San Jorge',
      }),
    ).rejects.toThrow(UnidadInvalida)
  })

  test('un grupo que no existe no abre unidades', async () => {
    const { servicio } = montarConBd()
    expect(
      servicio.abrirUnidad({
        grupoId: 'grupo_inexistente',
        rama: 'scouts',
        sexo: 'mixta',
        nombre: 'San Jorge',
      }),
    ).rejects.toThrow(UnidadInvalida)
  })
})

describe('cerrarUnidad', () => {
  const montarConUnidad = async () => {
    const { servicio } = montarConBd()
    const distrito = await servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })
    const grupo = await servicio.crearGrupo({ numero: 1, nombre: 'Uno', distritoId: distrito.id })
    const unidad = await servicio.abrirUnidad({
      grupoId: grupo.id,
      rama: 'scouts',
      sexo: 'mixta',
      nombre: 'San Jorge',
    })
    return { servicio, grupo, unidad }
  }

  test('una unidad cerrada deja de aparecer entre las del grupo', async () => {
    const { servicio, grupo, unidad } = await montarConUnidad()
    await servicio.cerrarUnidad(unidad.id)
    expect((await servicio.obtenerGrupo(grupo.id))?.unidades).toEqual([])
  })

  test('cerrar libera el nombre: se puede volver a abrir igual', async () => {
    // Es la razon por la que el UNIQUE es parcial y no completo.
    const { servicio, grupo, unidad } = await montarConUnidad()
    await servicio.cerrarUnidad(unidad.id)
    expect(
      servicio.abrirUnidad({
        grupoId: grupo.id,
        rama: 'scouts',
        sexo: 'mixta',
        nombre: 'San Jorge',
      }),
    ).resolves.toMatchObject({ nombre: 'San Jorge' })
  })
})

describe('cerrarGrupo', () => {
  test('un grupo nace activo', async () => {
    const servicio = montar()
    const distrito = await servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })
    const grupo = await servicio.crearGrupo({ numero: 1, nombre: 'Uno', distritoId: distrito.id })
    expect(grupo.cerradoEn).toBeNull()
  })

  test('un grupo cerrado desaparece del arbol', async () => {
    const servicio = montar()
    const distrito = await servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })
    const uno = await servicio.crearGrupo({ numero: 1, nombre: 'Uno', distritoId: distrito.id })
    await servicio.crearGrupo({ numero: 2, nombre: 'Dos', distritoId: distrito.id })
    await servicio.cerrarGrupo(uno.id)

    const arbol = await servicio.listarDistritos(alcanceSinLimites())
    expect(arbol[0]?.grupos.map((grupo) => grupo.numero)).toEqual([2])
  })

  test('un distrito sin grupos activos sigue apareciendo, con la lista vacia', async () => {
    // El distrito no cerro: cerraron sus grupos. La pantalla tiene que poder
    // decir "este distrito no tiene grupos activos" en vez de esconderlo.
    const servicio = montar()
    const distrito = await servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })
    const uno = await servicio.crearGrupo({ numero: 1, nombre: 'Uno', distritoId: distrito.id })
    await servicio.cerrarGrupo(uno.id)

    const arbol = await servicio.listarDistritos(alcanceSinLimites())
    expect(arbol).toHaveLength(1)
    expect(arbol[0]?.grupos).toEqual([])
  })

  test('cerrar refresca actualizadoEn con el reloj de Core y no toca creadoEn', async () => {
    // Es la primera operacion que actualiza una fila: hasta ahora las dos marcas
    // coincidian siempre y nada verificaba que `actualizadoEn` se moviera. El
    // grupo cerrado ya no aparece en el arbol, asi que las marcas se leen de
    // la base con SQL crudo en vez de con listarDistritos.
    let ahora = HORA
    const { servicio, bd } = montarConBd({ ahora: () => ahora })
    const distrito = await servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })
    const grupo = await servicio.crearGrupo({ numero: 1, nombre: 'Uno', distritoId: distrito.id })

    ahora = new Date(HORA.getTime() + 1000)
    await servicio.cerrarGrupo(grupo.id)

    const filas = bd.values<[number, number]>(
      sql`SELECT creado_en, actualizado_en FROM grupos WHERE id = ${grupo.id}`,
    )
    const fila = filas[0]
    expect(fila?.[0]).toBe(HORA.getTime())
    expect(fila?.[1]).toBe(ahora.getTime())
  })

  test('el numero de un grupo cerrado queda quemado, no se reasigna', async () => {
    // Decision del diseno: el UNIQUE de numero es global y no parcial. Si algun
    // dia los numeros se reutilizan, este test es el que va a avisar.
    const servicio = montar()
    const distrito = await servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })
    const grupo = await servicio.crearGrupo({ numero: 42, nombre: 'Uno', distritoId: distrito.id })
    await servicio.cerrarGrupo(grupo.id)

    expect(
      servicio.crearGrupo({ numero: 42, nombre: 'Otro', distritoId: distrito.id }),
    ).rejects.toThrow()
  })
})

describe('listarGrupos', () => {
  test('incluye los cerrados para que sus cuentas no desaparezcan', async () => {
    const servicio = montar()
    const distrito = await servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })
    const grupo = await servicio.crearGrupo({
      numero: 7,
      nombre: 'San Jorge',
      distritoId: distrito.id,
    })
    await servicio.cerrarGrupo(grupo.id)

    expect((await servicio.listarGrupos()).map((uno) => uno.id)).toEqual([grupo.id])
  })
})

describe('gruposAbiertosEn', () => {
  test('un grupo cerrado en octubre sigue estando abierto en mayo', async () => {
    // Es el caso que hace que la pregunta lleve fecha: si devolviera solo los
    // abiertos hoy, se perderia la nomina legitima de mayo.
    const { servicio } = montarConBd({ ahora: () => new Date('1970-10-15T12:00:00Z') })
    const distrito = await servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })
    const grupo = await servicio.crearGrupo({
      numero: 7,
      nombre: 'San Jorge',
      distritoId: distrito.id,
    })
    await servicio.cerrarGrupo(grupo.id)

    expect(await servicio.gruposAbiertosEn('1970-05-01')).toContain(grupo.id)
    expect(await servicio.gruposAbiertosEn('1970-11-01')).not.toContain(grupo.id)
  })

  test('cerrado ese mismo dia todavia cuenta como abierto', async () => {
    // Las dos puntas inclusivas, igual que estaVigente.
    const { servicio } = montarConBd({ ahora: () => new Date('1970-10-15T12:00:00Z') })
    const distrito = await servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })
    const grupo = await servicio.crearGrupo({
      numero: 7,
      nombre: 'San Jorge',
      distritoId: distrito.id,
    })
    await servicio.cerrarGrupo(grupo.id)

    expect(await servicio.gruposAbiertosEn('1970-10-15')).toContain(grupo.id)
  })

  test('un grupo que nunca cerro esta abierto siempre', async () => {
    const servicio = montar()
    const distrito = await servicio.crearDistrito({ numero: 1, zona: 'San Isidro' })
    const grupo = await servicio.crearGrupo({
      numero: 7,
      nombre: 'San Jorge',
      distritoId: distrito.id,
    })

    expect(await servicio.gruposAbiertosEn('2999-12-31')).toContain(grupo.id)
  })
})

describe('listarDistritos y el alcance', () => {
  test('un jefe de grupo ve su grupo, con el distrito que lo contiene', async () => {
    // Su alcance tiene el grupo pero no el distrito: sin esto el árbol le
    // llegaría vacío y la app se vería sin nada.
    const servicio = montar()
    const norte = await servicio.crearDistrito({ numero: 1, zona: 'Norte' })
    const sur = await servicio.crearDistrito({ numero: 2, zona: 'Sur' })
    const suyo = await servicio.crearGrupo({ numero: 1, nombre: 'Uno', distritoId: norte.id })
    await servicio.crearGrupo({ numero: 2, nombre: 'Dos', distritoId: norte.id })
    await servicio.crearGrupo({ numero: 3, nombre: 'Tres', distritoId: sur.id })

    const arbol = await servicio.listarDistritos({
      actor: {
        personaId: 'persona_1',
        roles: [{ rol: 'jefeDeGrupo', ambito: { tipo: 'grupo', id: suyo.id } }],
        esAdministradorDesignado: false,
        estaElevado: false,
      },
      gruposVisibles: [suyo.id],
      distritosVisibles: [],
      esAdministrador: false,
    })

    expect(arbol).toHaveLength(1)
    expect(arbol[0]?.id).toBe(norte.id)
    expect(arbol[0]?.grupos.map((grupo) => grupo.id)).toEqual([suyo.id])
  })

  test('un distrito sin grupos visibles no aparece', async () => {
    const servicio = montar()
    const norte = await servicio.crearDistrito({ numero: 1, zona: 'Norte' })
    await servicio.crearGrupo({ numero: 1, nombre: 'Uno', distritoId: norte.id })

    const arbol = await servicio.listarDistritos({
      actor: {
        personaId: 'persona_1',
        roles: [],
        esAdministradorDesignado: false,
        estaElevado: false,
      },
      gruposVisibles: [],
      distritosVisibles: [],
      esAdministrador: false,
    })
    expect(arbol).toEqual([])
  })
})
