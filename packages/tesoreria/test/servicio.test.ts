import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import type { Afiliacion, Declaracion } from '@gps/afiliacion/dominio'
import {
  type Alcance,
  alcanceSinLimites,
  aplicarMigraciones,
  type Bd,
  type Core,
  crearBusDeEventos,
  type Module,
  type Rol,
} from '@gps/core'
import type { Estructura, Grupo } from '@gps/estructura/dominio'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migraciones } from '../src/servidor/migraciones'
import {
  CuotaUtilizada,
  crearServicioDeTesoreria,
  DatosDePagoInvalidos,
  OperacionDenegada,
  PagoNoAnulable,
} from '../src/servidor/servicio'

const HORA = new Date('1970-06-01T12:00:00Z')
const GRUPO: Grupo = {
  id: 'grupo_7',
  numero: 7,
  nombre: 'San Jorge',
  distritoId: 'distrito_1',
  cerradoEn: null,
  creadoEn: HORA,
  actualizadoEn: HORA,
}

const OTRO_GRUPO: Grupo = { ...GRUPO, id: 'grupo_8', numero: 8, nombre: 'San Pablo' }

/** El alcance de una funcion concreta: es lo que distingue leer la cuenta del
 *  propio grupo de leer la del vecino. */
function alcanceDe(rol: Rol, ambitoId: string | null): Alcance {
  const tipo = ambitoId === null ? ('diocesis' as const) : ('grupo' as const)
  return {
    actor: {
      personaId: 'persona_1',
      roles: [{ rol, ambito: { tipo, id: ambitoId } }],
      esAdministradorDesignado: false,
      estaElevado: false,
    },
    gruposVisibles: ambitoId === null ? [GRUPO.id, OTRO_GRUPO.id] : [ambitoId],
    distritosVisibles: [],
    esAdministrador: false,
  }
}

const declaracion = (id: string, periodo = 1970): Declaracion => ({
  id,
  grupoId: GRUPO.id,
  fecha: '1970-05-01',
  periodo,
  creadoEn: HORA,
  actualizadoEn: HORA,
})

function montar(
  opciones: { declaraciones?: Declaracion[]; cantidades?: Record<string, number> } = {},
) {
  const bd: Bd = drizzle(new Database(':memory:'))
  let contador = 0
  const core: Core = {
    config: { version: '0.0.0', entorno: 'prueba', puerto: 0 },
    logger: { info: () => {}, error: () => {} },
    reloj: { ahora: () => HORA },
    bd,
    eventos: crearBusDeEventos(),
    modulos: ['afiliacion', 'estructura', 'tesoreria'],
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
    hash: (contenido) => `hash:${typeof contenido === 'string' ? contenido : contenido.join(',')}`,
    nuevoId: (prefijo) => `${prefijo}_${++contador}`,
    nuevoSecreto: () => `secreto_${++contador}`,
  }
  const modulo: Module<object> = {
    name: 'tesoreria',
    dependencies: [],
    migraciones,
    createServices: () => ({}),
    accesoAlModulo: { porDefecto: 'denegado', permitidos: [] },
    registerSchema: () => {},
  }
  aplicarMigraciones(core, [modulo])

  const declaraciones = opciones.declaraciones ?? []
  const afiliacion: Afiliacion = {
    listarDeclaraciones: async () => declaraciones,
    listarACobrar: async (id) =>
      Array.from({ length: opciones.cantidades?.[id] ?? 0 }, (_, indice) => ({
        declaracionId: id,
        personaId: `persona_${indice}`,
        tipoDeDocumento: 'dni' as const,
        numeroDeDocumento: String(indice),
        nombres: 'Ana',
        apellidos: 'Pérez',
      })),
  }
  const estructura: Estructura = {
    expandirAlcance: async (actor) => ({
      actor,
      gruposVisibles: [GRUPO.id],
      distritosVisibles: [],
      esAdministrador: false,
    }),
    obtenerGrupo: async () => ({ ...GRUPO, unidades: [] }),
    distritoEstaAbierto: async () => true,
    listarGrupos: async () => [GRUPO, OTRO_GRUPO],
    gruposAbiertosEn: async () => new Set([GRUPO.id]),
  }
  return { core, servicio: crearServicioDeTesoreria(core, afiliacion, estructura) }
}

describe('cuotas y cargos', () => {
  test('genera cantidad por cuota y no duplica la declaracion', async () => {
    const declaracion1 = declaracion('declaracion_1')
    const { servicio } = montar({ declaraciones: [declaracion1], cantidades: { declaracion_1: 3 } })
    await servicio.definirCuota(alcanceSinLimites(), 1970, 20000)

    const cargo = await servicio.generarCargo(declaracion1)
    const repetido = await servicio.generarCargo(declaracion1)

    expect(cargo).toMatchObject({ cantidad: 3, cuota: 20000, importe: 60000 })
    expect(repetido?.id).toBe(cargo?.id)
    expect(await servicio.listarMovimientos(alcanceSinLimites(), GRUPO.id)).toHaveLength(1)
  })

  test('sin cuota queda pendiente y se reconcilia despues', async () => {
    const declaracion1 = declaracion('declaracion_1')
    const { servicio } = montar({ declaraciones: [declaracion1], cantidades: { declaracion_1: 1 } })

    expect(await servicio.generarCargo(declaracion1)).toBeNull()
    expect(await servicio.resumenDePendientes(alcanceSinLimites())).toEqual({
      cantidad: 1,
      periodosSinCuota: [1970],
    })

    await servicio.definirCuota(alcanceSinLimites(), 1970, 20000)
    expect(await servicio.reconciliar(alcanceSinLimites())).toEqual({
      creados: 1,
      cantidad: 0,
      periodosSinCuota: [],
    })
  })

  test('una declaracion sin cobrables no crea cero ni queda pendiente', async () => {
    const declaracion1 = declaracion('declaracion_1')
    const { servicio } = montar({ declaraciones: [declaracion1] })
    await servicio.definirCuota(alcanceSinLimites(), 1970, 20000)

    expect(await servicio.generarCargo(declaracion1)).toBeNull()
    expect(await servicio.resumenDePendientes(alcanceSinLimites())).toEqual({
      cantidad: 0,
      periodosSinCuota: [],
    })
  })

  test('el evento genera el cargo automaticamente', async () => {
    const declaracion1 = declaracion('declaracion_1')
    const { core, servicio } = montar({ cantidades: { declaracion_1: 2 } })
    await servicio.definirCuota(alcanceSinLimites(), 1970, 20000)

    await core.eventos.publicar('AfiliacionDeclarada', declaracion1)

    expect(await servicio.listarMovimientos(alcanceSinLimites(), GRUPO.id)).toHaveLength(1)
  })

  test('solo permite el periodo actual, el siguiente o uno presente en declaraciones', async () => {
    const { servicio } = montar({ declaraciones: [declaracion('declaracion_vieja', 1969)] })

    expect(await servicio.listarPeriodosConfigurables(alcanceSinLimites())).toEqual([
      1969, 1970, 1971,
    ])
    expect(servicio.definirCuota(alcanceSinLimites(), 1, 1)).rejects.toThrow(DatosDePagoInvalidos)
  })

  test('una cuota usada queda bloqueada y las historicas se conservan', async () => {
    const declaracion1 = declaracion('declaracion_1')
    const { servicio } = montar({ cantidades: { declaracion_1: 1 } })
    await servicio.definirCuota(alcanceSinLimites(), 1970, 20000)
    await servicio.generarCargo(declaracion1)

    expect(servicio.definirCuota(alcanceSinLimites(), 1970, 21000)).rejects.toThrow(CuotaUtilizada)
    await servicio.definirCuota(alcanceSinLimites(), 1971, 25000)
    expect((await servicio.listarCuotas()).map((cuota) => cuota.periodo)).toEqual([1971, 1970])
  })
})

describe('pagos y cuentas', () => {
  test('admite pagos parciales y saldo a favor', async () => {
    const declaracion1 = declaracion('declaracion_1')
    const { servicio } = montar({ cantidades: { declaracion_1: 1 } })
    await servicio.definirCuota(alcanceSinLimites(), 1970, 20000)
    await servicio.generarCargo(declaracion1)
    await servicio.registrarPago(alcanceSinLimites(), {
      grupoId: GRUPO.id,
      fecha: '1970-05-02',
      importe: 30000,
      medioDePago: 'transferencia',
    })

    expect((await servicio.listarCuentas(alcanceSinLimites()))[0]?.saldo).toBe(-10000)
  })

  test('muestra grupos sin movimientos con saldo cero', async () => {
    const { servicio } = montar()
    expect(await servicio.listarCuentas(alcanceSinLimites())).toEqual([
      { grupoId: GRUPO.id, numero: 7, nombre: 'San Jorge', cerrado: false, saldo: 0 },
      { grupoId: OTRO_GRUPO.id, numero: 8, nombre: 'San Pablo', cerrado: false, saldo: 0 },
    ])
  })

  test('anula sin editar el pago y no permite repetir', async () => {
    const { servicio } = montar()
    const pago = await servicio.registrarPago(alcanceSinLimites(), {
      grupoId: GRUPO.id,
      fecha: '1970-05-02',
      importe: 50000,
      medioDePago: 'efectivo',
      referencia: ' caja ',
    })
    const anulacion = await servicio.anularPago(alcanceSinLimites(), pago.id)

    expect(anulacion).toMatchObject({ importe: 50000, anulaA: pago.id })
    expect(await servicio.listarMovimientos(alcanceSinLimites(), GRUPO.id)).toHaveLength(2)
    expect(servicio.anularPago(alcanceSinLimites(), pago.id)).rejects.toThrow(PagoNoAnulable)
  })

  test('rechaza pagos con importe o fecha invalidos', async () => {
    const { servicio } = montar()
    expect(
      servicio.registrarPago(alcanceSinLimites(), {
        grupoId: GRUPO.id,
        fecha: '1970-02-30',
        importe: 1.5,
        medioDePago: 'otro',
      }),
    ).rejects.toThrow(DatosDePagoInvalidos)
  })

  test('ordena el extracto por fecha efectiva', async () => {
    const { servicio } = montar()
    await servicio.registrarPago(alcanceSinLimites(), {
      grupoId: GRUPO.id,
      fecha: '1970-05-03',
      importe: 1,
      medioDePago: 'otro',
    })
    await servicio.registrarPago(alcanceSinLimites(), {
      grupoId: GRUPO.id,
      fecha: '1970-05-01',
      importe: 1,
      medioDePago: 'otro',
    })

    expect(
      (await servicio.listarMovimientos(alcanceSinLimites(), GRUPO.id)).map((uno) => uno.fecha),
    ).toEqual(['1970-05-01', '1970-05-03'])
  })
})

describe('autorizacion de tesoreria', () => {
  const unPago = (grupoId: string) => ({
    grupoId,
    fecha: '1970-05-01',
    importe: 10000,
    medioDePago: 'efectivo' as const,
  })

  test('jefatura y secretaria leen la cuenta de su grupo y no la del vecino', async () => {
    const { servicio } = montar()
    await servicio.registrarPago(alcanceDe('tesoreriaDiocesana', null), unPago(GRUPO.id))
    await servicio.registrarPago(alcanceDe('tesoreriaDiocesana', null), unPago(OTRO_GRUPO.id))

    const jefe = alcanceDe('jefeDeGrupo', GRUPO.id)
    expect(await servicio.listarMovimientos(jefe, GRUPO.id)).toHaveLength(1)
    expect(await servicio.listarMovimientos(jefe, OTRO_GRUPO.id)).toEqual([])
    expect((await servicio.listarCuentas(jefe)).map((cuenta) => cuenta.grupoId)).toEqual([GRUPO.id])
  })

  test('tesoreria diocesana ve la diocesis entera', async () => {
    const { servicio } = montar()
    const tesoreria = alcanceDe('tesoreriaDiocesana', null)
    expect((await servicio.listarCuentas(tesoreria)).map((cuenta) => cuenta.grupoId)).toEqual([
      GRUPO.id,
      OTRO_GRUPO.id,
    ])
  })

  test('jefatura y secretaria no escriben la cuenta, ni la propia', async () => {
    const { servicio } = montar()
    const jefe = alcanceDe('jefeDeGrupo', GRUPO.id)
    expect(servicio.registrarPago(jefe, unPago(GRUPO.id))).rejects.toThrow(OperacionDenegada)

    const secretaria = alcanceDe('secretariaDeGrupo', GRUPO.id)
    expect(servicio.registrarPago(secretaria, unPago(GRUPO.id))).rejects.toThrow(OperacionDenegada)
  })

  test('solo tesoreria diocesana anula un pago', async () => {
    const { servicio } = montar()
    const tesoreria = alcanceDe('tesoreriaDiocesana', null)
    const pago = await servicio.registrarPago(tesoreria, unPago(GRUPO.id))
    expect(servicio.anularPago(alcanceDe('jefeDeGrupo', GRUPO.id), pago.id)).rejects.toThrow(
      OperacionDenegada,
    )
    expect(await servicio.anularPago(tesoreria, pago.id)).toMatchObject({ anulaA: pago.id })
  })

  test('definir la cuota y sus periodos es de tesoreria o administracion diocesana', async () => {
    const { servicio } = montar()
    const jefe = alcanceDe('jefeDeGrupo', GRUPO.id)
    expect(servicio.definirCuota(jefe, 1970, 20000)).rejects.toThrow(OperacionDenegada)
    expect(servicio.listarPeriodosConfigurables(jefe)).rejects.toThrow(OperacionDenegada)

    const administracion = alcanceDe('administracionDiocesana', null)
    expect(await servicio.definirCuota(administracion, 1970, 20000)).toMatchObject({
      periodo: 1970,
      importe: 20000,
    })
    expect(await servicio.listarPeriodosConfigurables(administracion)).toContain(1971)
  })

  test('el panorama de deuda de la diocesis no es de un grupo', async () => {
    const { servicio } = montar()
    expect(servicio.resumenDePendientes(alcanceDe('jefeDeGrupo', GRUPO.id))).rejects.toThrow(
      OperacionDenegada,
    )
    expect(servicio.reconciliar(alcanceDe('jefeDeGrupo', GRUPO.id))).rejects.toThrow(
      OperacionDenegada,
    )
  })
})
