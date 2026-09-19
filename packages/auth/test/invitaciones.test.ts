import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import {
  type Actor,
  aplicarMigraciones,
  type Bd,
  type Core,
  crearBusDeEventos,
  type Module,
} from '@gps/core'
import type { Estructura } from '@gps/estructura/dominio'
import type { Personas } from '@gps/personas/dominio'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migraciones } from '../src/servidor/migraciones'
import type { ProveedorOidc } from '../src/servidor/oidc'
import {
  AutoridadInsuficiente,
  crearServicioDeAuth,
  InvitacionInvalida,
  ProveedorYaVinculado,
} from '../src/servidor/servicio'

const GRUPOS_DE_PERSONA: Record<string, string> = {
  persona_1: 'grupo_1',
  persona_2: 'grupo_2',
}

/** auth sólo le pregunta el nombre de un grupo, para mostrar el ámbito de un
 *  enlace de invitación. */
const estructuraFalsa = {
  obtenerGrupo: async () => null,
} as unknown as Estructura

const personas: Personas = {
  nombreDe: async () => null,
  personaExiste: async (id) => id in GRUPOS_DE_PERSONA,
  grupoVigenteDe: async (id) => GRUPOS_DE_PERSONA[id] ?? null,
  funcionesVigentes: async () => [],
  miembrosActivos: async () => [],
  ocupantesDelCargo: async () => [],
  miembrosDelGrupo: async () => [],
}

function proveedorFalso(subject: string): ProveedorOidc {
  return {
    iniciar: (redirectUri, plataforma) => ({
      url: `https://falso.test/auth?redirect=${redirectUri}&plataforma=${plataforma}`,
      state: 'state-real',
      nonce: 'nonce-real',
      codeVerifier: 'verifier-real',
    }),
    intercambiarCodigo: async () => ({ subject }),
  }
}

function montar(subject = 'subject-nuevo') {
  const base = new Database(':memory:')
  base.exec('PRAGMA foreign_keys = ON')
  const bd: Bd = drizzle(base)
  let hora = new Date('1970-01-01T00:00:00Z')
  let contador = 0
  const core: Core = {
    config: { version: '0.0.0', entorno: 'prueba', puerto: 0 },
    logger: { info: () => {}, error: () => {} },
    reloj: { ahora: () => hora },
    bd,
    eventos: crearBusDeEventos(),
    modulos: ['auth'],
    sellador: {
      sellar: (datos: string) => ({ sello: `sellado:${datos}`, claveId: 'prueba' }),
      verificar: (datos: string, sello) =>
        sello.claveId === 'prueba' && sello.sello === `sellado:${datos}`,
    },
    almacenamiento: {
      guardar: async () => {},
      leer: async () => new Uint8Array(),
      eliminar: async () => {},
    },
    conversorDeImagenes: { aJpeg: async (contenido) => contenido },
    hash: (contenido) => `hash:${typeof contenido === 'string' ? contenido : contenido.join(',')}`,
    nuevoId: (prefijo) => `${prefijo}_${++contador}`,
    nuevoSecreto: () => `secreto_${++contador}`,
  }
  const modulo: Module<object> = {
    name: 'auth',
    dependencies: [],
    migraciones,
    createServices: () => ({}),
    accesoAlModulo: { porDefecto: 'denegado', permitidos: [] },
    registerSchema: () => {},
  }
  aplicarMigraciones(core, [modulo])
  const servicio = crearServicioDeAuth(core, personas, estructuraFalsa, {
    google: proveedorFalso(subject),
  })
  return {
    bd,
    servicio,
    avanzarA: (fecha: string) => {
      hora = new Date(fecha)
    },
  }
}

const jefeDeGrupo1: Actor = {
  personaId: 'jefe_1',
  roles: [{ rol: 'jefeDeGrupo', ambito: { tipo: 'grupo', id: 'grupo_1' } }],
  esAdministradorDesignado: false,
  estaElevado: false,
}
const jefeDeGrupo2: Actor = {
  personaId: 'jefe_2',
  roles: [{ rol: 'jefeDeGrupo', ambito: { tipo: 'grupo', id: 'grupo_2' } }],
  esAdministradorDesignado: false,
  estaElevado: false,
}
const administrador: Actor = {
  personaId: 'admin',
  roles: [],
  esAdministradorDesignado: true,
  estaElevado: true,
}

describe('emitirInvitacion', () => {
  test('Jefatura invita a alguien de su propio grupo', async () => {
    const { servicio } = montar()
    const invitacion = await servicio.emitirInvitacion(jefeDeGrupo1, {
      tipo: 'activacion',
      personaId: 'persona_1',
    })
    expect(invitacion.secreto).toBeTruthy()
  })

  test('Jefatura no puede invitar fuera de su grupo', async () => {
    const { servicio } = montar()
    await expect(
      servicio.emitirInvitacion(jefeDeGrupo2, { tipo: 'activacion', personaId: 'persona_1' }),
    ).rejects.toThrow(AutoridadInsuficiente)
  })

  test('el administrador elevado invita a cualquiera', async () => {
    const { servicio } = montar()
    await expect(
      servicio.emitirInvitacion(administrador, { tipo: 'activacion', personaId: 'persona_1' }),
    ).resolves.toBeTruthy()
  })
})

describe('consumirActivacion', () => {
  test('vincula el proveedor y abre sesión', async () => {
    const { bd, servicio } = montar()
    const invitacion = await servicio.emitirInvitacion(jefeDeGrupo1, {
      tipo: 'activacion',
      personaId: 'persona_1',
    })
    const sesion = await servicio.consumirActivacion(invitacion.secreto, {
      transaccion: servicio.iniciarLogin('google', 'web', 'https://gps.test/callback').transaccion,
      stateRecibido: 'state-real',
      code: 'c',
    })
    expect(sesion.sesionId).toBeTruthy()
    const filas = bd.all<{ persona_id: string }>(
      sql`SELECT persona_id FROM identidades_externas WHERE persona_id = 'persona_1'`,
    )
    expect(filas).toEqual([{ persona_id: 'persona_1' }])
  })

  test('un secreto ya consumido, revocado o vencido no activa dos veces', async () => {
    const { servicio, avanzarA } = montar()
    const invitacion = await servicio.emitirInvitacion(jefeDeGrupo1, {
      tipo: 'activacion',
      personaId: 'persona_1',
    })
    await servicio.consumirActivacion(invitacion.secreto, {
      transaccion: servicio.iniciarLogin('google', 'web', 'https://gps.test/callback').transaccion,
      stateRecibido: 'state-real',
      code: 'c',
    })
    await expect(
      servicio.consumirActivacion(invitacion.secreto, {
        transaccion: servicio.iniciarLogin('google', 'web', 'https://gps.test/callback')
          .transaccion,
        stateRecibido: 'state-real',
        code: 'c',
      }),
    ).rejects.toThrow(InvitacionInvalida)

    const otra = await servicio.emitirInvitacion(jefeDeGrupo1, {
      tipo: 'activacion',
      personaId: 'persona_1',
    })
    await servicio.revocarInvitacion(jefeDeGrupo1, otra.invitacionId)
    await expect(
      servicio.consumirActivacion(otra.secreto, {
        transaccion: servicio.iniciarLogin('google', 'web', 'https://gps.test/callback')
          .transaccion,
        stateRecibido: 'state-real',
        code: 'c',
      }),
    ).rejects.toThrow(InvitacionInvalida)

    const vencida = await servicio.emitirInvitacion(jefeDeGrupo1, {
      tipo: 'activacion',
      personaId: 'persona_1',
    })
    avanzarA('1970-01-09T00:00:00Z')
    await expect(
      servicio.consumirActivacion(vencida.secreto, {
        transaccion: servicio.iniciarLogin('google', 'web', 'https://gps.test/callback')
          .transaccion,
        stateRecibido: 'state-real',
        code: 'c',
      }),
    ).rejects.toThrow(InvitacionInvalida)
  })

  test('un subject ya vinculado a otra persona no puede activar una segunda', async () => {
    const { bd, servicio } = montar('subject-en-uso')
    bd.run(
      sql`INSERT INTO identidades_externas VALUES
          ('identidad_1', 'persona_2', 'google', 'subject-en-uso', NULL, 0, 0)`,
    )
    const invitacion = await servicio.emitirInvitacion(jefeDeGrupo1, {
      tipo: 'activacion',
      personaId: 'persona_1',
    })
    await expect(
      servicio.consumirActivacion(invitacion.secreto, {
        transaccion: servicio.iniciarLogin('google', 'web', 'https://gps.test/callback')
          .transaccion,
        stateRecibido: 'state-real',
        code: 'c',
      }),
    ).rejects.toThrow(ProveedorYaVinculado)
  })
})

describe('consumirRecuperacion', () => {
  test('desactiva el proveedor anterior, vincula el nuevo y revoca todas las sesiones', async () => {
    const { bd, servicio } = montar('subject-nuevo')
    bd.run(
      sql`INSERT INTO identidades_externas VALUES
          ('identidad_vieja', 'persona_1', 'google', 'subject-viejo', NULL, 0, 0)`,
    )
    bd.run(
      sql`INSERT INTO sesiones VALUES
          ('sesion_vieja', 'persona_1', 'identidad_vieja', 'hash-x', 999999999999, NULL, NULL, 0, 0)`,
    )

    const invitacion = await servicio.emitirInvitacion(jefeDeGrupo1, {
      tipo: 'recuperacion',
      personaId: 'persona_1',
      proveedorAReemplazar: 'google',
    })
    const sesion = await servicio.consumirRecuperacion(invitacion.secreto, {
      transaccion: servicio.iniciarLogin('google', 'web', 'https://gps.test/callback').transaccion,
      stateRecibido: 'state-real',
      code: 'c',
    })
    expect(sesion.sesionId).toBeTruthy()

    const identidades = bd.all<{ subject: string; desactivada_en: number | null }>(
      sql`SELECT subject, desactivada_en FROM identidades_externas WHERE persona_id = 'persona_1' ORDER BY subject`,
    )
    expect(identidades).toEqual([
      { subject: 'subject-nuevo', desactivada_en: null },
      { subject: 'subject-viejo', desactivada_en: 0 },
    ])
    const sesionVieja = bd.all<{ revocada_en: number | null }>(
      sql`SELECT revocada_en FROM sesiones WHERE id = 'sesion_vieja'`,
    )
    expect(sesionVieja[0]?.revocada_en).not.toBeNull()
  })
})

describe('mirarInvitacion', () => {
  test('un enlace válido dice de quién es antes de consumirlo', async () => {
    const { servicio } = montar()
    const invitacion = await servicio.emitirInvitacion(jefeDeGrupo1, {
      tipo: 'activacion',
      personaId: 'persona_1',
    })

    const vista = await servicio.mirarInvitacion(invitacion.secreto)
    expect(vista).toMatchObject({ estado: 'valida', tipo: 'activacion' })

    // Y sigue sirviendo: mirar no es consumir.
    expect((await servicio.mirarInvitacion(invitacion.secreto)).estado).toBe('valida')
  })

  test('usado, revocado y vencido se distinguen, y ninguno dice de quién era', async () => {
    const { servicio, avanzarA } = montar()
    const login = () => ({
      transaccion: servicio.iniciarLogin('google', 'web', 'https://gps.test/callback').transaccion,
      stateRecibido: 'state-real',
      code: 'c',
    })

    const usada = await servicio.emitirInvitacion(jefeDeGrupo1, {
      tipo: 'activacion',
      personaId: 'persona_1',
    })
    await servicio.consumirActivacion(usada.secreto, login())
    expect(await servicio.mirarInvitacion(usada.secreto)).toEqual({
      estado: 'usada',
      tipo: null,
      persona: null,
      grupo: null,
      proveedorAReemplazar: null,
    })

    const revocada = await servicio.emitirInvitacion(jefeDeGrupo1, {
      tipo: 'activacion',
      personaId: 'persona_1',
    })
    await servicio.revocarInvitacion(jefeDeGrupo1, revocada.invitacionId)
    expect((await servicio.mirarInvitacion(revocada.secreto)).estado).toBe('revocada')

    const vencida = await servicio.emitirInvitacion(jefeDeGrupo1, {
      tipo: 'activacion',
      personaId: 'persona_1',
    })
    avanzarA('1970-01-09T00:00:00Z')
    expect((await servicio.mirarInvitacion(vencida.secreto)).estado).toBe('vencida')
  })

  test('un secreto inventado se contesta igual que uno vencido', async () => {
    // Distinguirlos dejaría probar secretos contra una consulta que no pide
    // sesión.
    const { servicio } = montar()
    expect(await servicio.mirarInvitacion('no-existe')).toEqual({
      estado: 'vencida',
      tipo: null,
      persona: null,
      grupo: null,
      proveedorAReemplazar: null,
    })
  })
})

describe('doble consumo concurrente', () => {
  /** Dos pedidos que se intercalan en el `await` del proveedor: los dos leen
   *  la invitación sin consumir, y recién después escriben. El cierre está
   *  adentro de la transacción, que es sincrónica.
   *
   *  No alcanza con comparar el instante escrito contra el propio: dos
   *  consumos en el mismo milisegundo leen el mismo `ahora` y los dos creerían
   *  haber ganado. Un timestamp no es una identidad. */
  test('sólo uno gana, y queda una sola identidad', async () => {
    const { bd, servicio } = montar()
    const invitacion = await servicio.emitirInvitacion(jefeDeGrupo1, {
      tipo: 'activacion',
      personaId: 'persona_1',
    })

    const consumir = () =>
      servicio.consumirActivacion(invitacion.secreto, {
        transaccion: servicio.iniciarLogin('google', 'web', 'https://gps.test/callback')
          .transaccion,
        stateRecibido: 'state-real',
        code: 'c',
      })

    const resultados = await Promise.allSettled([consumir(), consumir()])
    expect(resultados.filter((una) => una.status === 'fulfilled')).toHaveLength(1)

    const identidades = bd.all<{ id: string }>(
      sql`SELECT id FROM identidades_externas WHERE persona_id = 'persona_1'`,
    )
    expect(identidades).toHaveLength(1)
  })
})
