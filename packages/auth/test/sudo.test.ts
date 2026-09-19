import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { aplicarMigraciones, type Bd, type Core, crearBusDeEventos, type Module } from '@gps/core'
import type { Estructura } from '@gps/estructura/dominio'
import type { Personas } from '@gps/personas/dominio'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migraciones } from '../src/servidor/migraciones'
import type { ProveedorOidc } from '../src/servidor/oidc'
import { crearServicioDeAuth, ElevacionDenegada } from '../src/servidor/servicio'

/** auth sólo le pregunta el nombre de un grupo, para mostrar el ámbito de un
 *  enlace de invitación. */
const estructuraFalsa = {
  obtenerGrupo: async () => null,
} as unknown as Estructura

const personas: Personas = {
  nombreDe: async () => null,
  personaExiste: async () => true,
  grupoVigenteDe: async () => null,
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

function montar() {
  const base = new Database(':memory:')
  base.exec('PRAGMA foreign_keys = ON')
  const bd: Bd = drizzle(base)
  const hora = new Date('1970-01-01T00:00:00Z')
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
    google: proveedorFalso('subject-admin'),
  })
  bd.run(
    sql`INSERT INTO identidades_externas VALUES
        ('identidad_admin', 'persona_admin', 'google', 'subject-admin', NULL, 0, 0)`,
  )
  bd.run(sql`INSERT INTO administrador_del_sistema VALUES (1, 'persona_admin', 0, 0)`)
  return { bd, servicio }
}

describe('elevarSesion', () => {
  test('reautenticar una identidad ya vinculada eleva la sesión de la administradora', async () => {
    const { bd, servicio } = montar()
    const sesion = await servicio.crearSesionParaIdentidad('identidad_admin')
    expect((await servicio.resolverSesion(sesion.secreto))?.estaElevada).toBe(false)

    const inicio = servicio.iniciarLogin('google', 'web', 'https://gps.test/callback')
    await servicio.elevarSesion(sesion.sesionId, {
      transaccion: inicio.transaccion,
      stateRecibido: 'state-real',
      code: 'c',
    })

    expect((await servicio.resolverSesion(sesion.secreto))?.estaElevada).toBe(true)
    const eventos = bd.all<{ tipo: string }>(sql`SELECT tipo FROM eventos_de_seguridad`)
    expect(eventos.map((e) => e.tipo)).toContain('sesion.elevar')
  })

  test('una sesión ordinaria no elevada no da alcance global', async () => {
    const { servicio } = montar()
    const sesion = await servicio.crearSesionParaIdentidad('identidad_admin')
    const resuelta = await servicio.resolverSesion(sesion.secreto)
    expect(resuelta?.estaElevada).toBe(false)
  })

  test('una persona que no es la administradora designada no puede elevarse', async () => {
    const { bd, servicio } = montar()
    bd.run(
      sql`INSERT INTO identidades_externas VALUES
          ('identidad_otra', 'persona_otra', 'google', 'subject-otra', NULL, 0, 0)`,
    )
    const sesionAjena = await servicio.crearSesionParaIdentidad('identidad_otra')
    const inicio = servicio.iniciarLogin('google', 'web', 'https://gps.test/callback')
    await expect(
      servicio.elevarSesion(sesionAjena.sesionId, {
        transaccion: inicio.transaccion,
        stateRecibido: 'state-real',
        code: 'c',
      }),
    ).rejects.toThrow(ElevacionDenegada)
  })
})
