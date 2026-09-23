import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { aplicarMigraciones, type Bd, type Core, crearBusDeEventos, type Module } from '@gps/core'
import type { Estructura } from '@gps/estructura/dominio'
import type { Personas } from '@gps/personas/dominio'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migraciones } from '../src/servidor/migraciones'
import { crearServicioDeAuth } from '../src/servidor/servicio'

/** auth sólo le pregunta el nombre de un grupo, para mostrar el ámbito de un
 *  enlace de invitación. */
const estructuraFalsa = {
  obtenerGrupo: async () => null,
} as unknown as Estructura

const personas: Personas = {
  nombreDe: async () => null,
  personaExiste: async (id) => id === 'persona_1',
  grupoVigenteDe: async () => null,
  funcionesVigentes: async () => [],
  miembrosActivos: async () => [],
  ocupantesDelCargo: async () => [],
  miembrosDelGrupo: async () => [],
}

function montar() {
  const base = new Database(':memory:')
  base.exec('PRAGMA foreign_keys = ON')
  const bd: Bd = drizzle(base)
  let ahora = new Date('1970-01-01T00:00:00Z')
  let contador = 0
  const core: Core = {
    config: { version: '0.0.0', entorno: 'prueba', puerto: 0 },
    logger: { info: () => {}, error: () => {} },
    reloj: { ahora: () => ahora },
    bd,
    eventos: crearBusDeEventos(),
    auditoria: { registrar: () => 'evento_de_auditoria_test' },
    modulos: ['auth'],
    sellador: { sellar: () => ({ sello: '', claveId: '' }), verificar: () => true },
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
  bd.run(
    sql`INSERT INTO identidades_externas VALUES
        ('identidad_1', 'persona_1', 'google', 'subject_1', NULL, 0, 0)`,
  )
  return {
    bd,
    servicio: crearServicioDeAuth(core, personas, estructuraFalsa, {}),
    avanzarA: (fecha: string) => {
      ahora = new Date(fecha)
    },
  }
}

describe('sesiones', () => {
  test('persiste sólo el hash y resuelve una sesión opaca vigente', async () => {
    const { bd, servicio } = montar()
    const creada = await servicio.crearSesionParaIdentidad('identidad_1')

    expect(creada).toEqual({ secreto: 'secreto_1', sesionId: 'sesion_2' })
    expect(
      bd.all<{ hash: string }>(sql`SELECT hash_del_secreto AS hash FROM sesiones`)[0]?.hash,
    ).toBe('hash:secreto_1')
    expect(await servicio.resolverSesion(creada.secreto)).toEqual({
      sesionId: 'sesion_2',
      personaId: 'persona_1',
      identidadId: 'identidad_1',
      estaElevada: false,
      elevadaHasta: null,
    })
  })

  test('una sesión revocada o vencida deja de autenticar', async () => {
    const casoRevocado = montar()
    const revocada = await casoRevocado.servicio.crearSesionParaIdentidad('identidad_1')
    await casoRevocado.servicio.revocarSesion(revocada.sesionId)
    expect(await casoRevocado.servicio.resolverSesion(revocada.secreto)).toBeNull()

    const casoVencido = montar()
    const vencida = await casoVencido.servicio.crearSesionParaIdentidad('identidad_1')
    casoVencido.avanzarA('1970-02-01T00:00:00Z')
    expect(await casoVencido.servicio.resolverSesion(vencida.secreto)).toBeNull()
  })
})

describe('restricciones de autenticación', () => {
  test('un subject no se reasigna aunque la identidad anterior esté desactivada', () => {
    const { bd } = montar()
    bd.run(sql`UPDATE identidades_externas SET desactivada_en = 1 WHERE id = 'identidad_1'`)
    expect(() =>
      bd.run(
        sql`INSERT INTO identidades_externas VALUES
            ('identidad_2', 'persona_2', 'google', 'subject_1', NULL, 0, 0)`,
      ),
    ).toThrow()
  })

  test('sólo admite una fila de administrador', () => {
    const { bd } = montar()
    bd.run(sql`INSERT INTO administrador_del_sistema VALUES (1, 'persona_1', 0, 0)`)
    expect(() =>
      bd.run(sql`INSERT INTO administrador_del_sistema VALUES (2, 'persona_2', 0, 0)`),
    ).toThrow()
  })
})
