import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { aplicarMigraciones, type Bd, type Core, crearBusDeEventos, type Module } from '@gps/core'
import type { Personas } from '@gps/personas/dominio'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migraciones } from '../src/servidor/migraciones'
import type { ProveedorOidc } from '../src/servidor/oidc'
import {
  crearServicioDeAuth,
  IdentidadNoVinculada,
  ProveedorYaVinculado,
  TransaccionDeLoginInvalida,
} from '../src/servidor/servicio'

const personas: Personas = {
  personaExiste: async () => true,
  grupoVigenteDe: async () => null,
  funcionesVigentes: async () => [],
  miembrosActivos: async () => [],
  ocupantesDelCargo: async () => [],
  miembrosDelGrupo: async () => [],
}

/** Devuelve siempre el mismo `subject`: alcanza para probar la orquestación,
 *  que ya no es responsabilidad de OIDC -eso lo prueba oidc.test.ts-. */
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

function montar(subject = 'subject-1') {
  const base = new Database(':memory:')
  base.exec('PRAGMA foreign_keys = ON')
  const bd: Bd = drizzle(base)
  let contador = 0
  const core: Core = {
    config: { version: '0.0.0', entorno: 'prueba', puerto: 0 },
    logger: { info: () => {}, error: () => {} },
    reloj: { ahora: () => new Date('1970-01-01T00:00:00Z') },
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
  const servicio = crearServicioDeAuth(core, personas, { google: proveedorFalso(subject) })
  return { bd, servicio }
}

describe('iniciarLogin / completarLogin', () => {
  test('una identidad ya vinculada abre sesión al completar el login', async () => {
    const { bd, servicio } = montar()
    bd.run(
      sql`INSERT INTO identidades_externas VALUES
          ('identidad_1', 'persona_1', 'google', 'subject-1', NULL, 0, 0)`,
    )

    const inicio = servicio.iniciarLogin('google', 'web', 'https://gps.test/callback')
    expect(inicio.url).toContain('redirect=https://gps.test/callback')

    const sesion = await servicio.completarLogin({
      transaccion: inicio.transaccion,
      stateRecibido: 'state-real',
      code: 'un-codigo',
    })
    expect(sesion.sesionId).toBeTruthy()
    expect(await servicio.resolverSesion(sesion.secreto)).toEqual({
      sesionId: sesion.sesionId,
      personaId: 'persona_1',
      identidadId: 'identidad_1',
      estaElevada: false,
    })
  })

  test('un subject sin activar no autentica: hace falta invitación', async () => {
    const { servicio } = montar()
    const inicio = servicio.iniciarLogin('google', 'web', 'https://gps.test/callback')
    await expect(
      servicio.completarLogin({
        transaccion: inicio.transaccion,
        stateRecibido: 'state-real',
        code: 'un-codigo',
      }),
    ).rejects.toThrow(IdentidadNoVinculada)
  })

  test('un state que no coincide rechaza la transacción', async () => {
    const { servicio } = montar()
    const inicio = servicio.iniciarLogin('google', 'web', 'https://gps.test/callback')
    await expect(
      servicio.completarLogin({
        transaccion: inicio.transaccion,
        stateRecibido: 'otro-state',
        code: 'un-codigo',
      }),
    ).rejects.toThrow(TransaccionDeLoginInvalida)
  })

  test('una transacción alterada no verifica', async () => {
    const { servicio } = montar()
    await expect(
      servicio.completarLogin({
        transaccion: JSON.stringify({ datos: '{}', sello: 'x', claveId: 'prueba' }),
        stateRecibido: 'state-real',
        code: 'un-codigo',
      }),
    ).rejects.toThrow(TransaccionDeLoginInvalida)
  })
})

describe('reemplazarProveedorPropio', () => {
  test('reemplaza el proveedor sin invitación y preserva a la persona', async () => {
    const { bd, servicio } = montar('subject-nuevo')
    bd.run(
      sql`INSERT INTO identidades_externas VALUES
          ('identidad_vieja', 'persona_1', 'google', 'subject-viejo', NULL, 0, 0)`,
    )
    const inicio = servicio.iniciarLogin('google', 'web', 'https://gps.test/callback')
    await servicio.reemplazarProveedorPropio('persona_1', 'google', {
      transaccion: inicio.transaccion,
      stateRecibido: 'state-real',
      code: 'c',
    })

    const identidades = bd.all<{ subject: string; desactivada_en: number | null }>(
      sql`SELECT subject, desactivada_en FROM identidades_externas WHERE persona_id = 'persona_1' ORDER BY subject`,
    )
    expect(identidades).toEqual([
      { subject: 'subject-nuevo', desactivada_en: null },
      { subject: 'subject-viejo', desactivada_en: 0 },
    ])
  })
})

describe('vincularProveedor', () => {
  test('agrega un segundo proveedor a una persona ya autenticada', async () => {
    const { bd, servicio } = montar()
    const inicio = servicio.iniciarLogin('google', 'web', 'https://gps.test/callback')
    await servicio.vincularProveedor('persona_1', {
      transaccion: inicio.transaccion,
      stateRecibido: 'state-real',
      code: 'c',
    })

    const filas = bd.all<{ persona_id: string }>(
      sql`SELECT persona_id FROM identidades_externas WHERE subject = 'subject-1'`,
    )
    expect(filas).toEqual([{ persona_id: 'persona_1' }])
  })

  test('no se puede vincular un subject que ya es de otra persona activa', async () => {
    const { bd, servicio } = montar()
    bd.run(
      sql`INSERT INTO identidades_externas VALUES
          ('identidad_1', 'persona_1', 'google', 'subject-1', NULL, 0, 0)`,
    )
    const inicio = servicio.iniciarLogin('google', 'web', 'https://gps.test/callback')
    await expect(
      servicio.vincularProveedor('persona_2', {
        transaccion: inicio.transaccion,
        stateRecibido: 'state-real',
        code: 'c',
      }),
    ).rejects.toThrow(ProveedorYaVinculado)
  })
})
