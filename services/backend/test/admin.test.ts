import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { alcanceSinLimites } from '@gps/core'
import { main } from '../scripts/admin'
import { crearAlmacenamientoEnMemoria } from '../src/almacenamiento'
import { crearBd } from '../src/bd'
import { componer } from '../src/composicion'
import { crearConversorDeImagenes } from '../src/conversor'
import { crearSellador } from '../src/sellador'

const ORIGINALES = { ...process.env }
const sellador = crearSellador({ prueba: 'una-clave' }, 'prueba')

afterEach(() => {
  process.env = { ...ORIGINALES }
})

function prepararEntorno(): void {
  process.env.ENTORNO = 'prueba'
  process.env.BD = ':memory:'
  process.env.CLAVES_DE_SELLO = 'prueba=una-clave'
  process.env.CLAVE_DE_SELLO_ACTIVA = 'prueba'
}

describe('bun run admin asignar', () => {
  test('sin --persona termina con error y no cuelga el proceso', async () => {
    prepararEntorno()
    const salidasDeProceso: number[] = []
    const original = process.exit
    // process.exit no vuelve nunca en la vida real; en el test se lo
    // reemplaza para poder seguir corriendo despues de invocarlo.
    process.exit = ((codigo?: number) => {
      salidasDeProceso.push(codigo ?? 0)
      throw new Error('exit')
    }) as typeof process.exit
    try {
      await expect(main(['asignar'])).rejects.toThrow('exit')
    } finally {
      process.exit = original
    }
    expect(salidasDeProceso).toEqual([1])
  })

  test('una persona inexistente termina con error, no crea al administrador en silencio', async () => {
    prepararEntorno()
    const original = process.exit
    let codigo: number | undefined
    process.exit = ((c?: number) => {
      codigo = c
      throw new Error('exit')
    }) as typeof process.exit
    try {
      await expect(main(['asignar', '--persona', 'no-existe'])).rejects.toThrow('exit')
    } finally {
      process.exit = original
    }
    expect(codigo).toBe(1)
  })

  test('asigna a una persona real y queda disponible para próximos arranques', async () => {
    const directorio = await mkdtemp(join(tmpdir(), 'gps-admin-cli-'))
    const ruta = join(directorio, 'gps.db')
    try {
      const config = { version: '0.0.0', entorno: 'prueba' as const, puerto: 0 }
      const { contexto: siembra } = await componer(
        config,
        crearBd(ruta),
        sellador,
        crearAlmacenamientoEnMemoria(),
        crearConversorDeImagenes(),
      )
      const persona = await siembra.personas.crearPersona(
        alcanceSinLimites(),
        {
          tipoDeDocumento: 'dni',
          numeroDeDocumento: '30111222',
          nombres: 'Ana',
          apellidos: 'Pérez',
          fechaDeNacimiento: '1950-01-01',
          domicilio: 'Av. Siempre Viva 742',
          telefonoDeContacto: '11 5555-1234',
        },
        {
          grupoId: (
            await siembra.estructura.crearGrupo({
              numero: 1,
              nombre: 'Uno',
              distritoId: (await siembra.estructura.crearDistrito({ numero: 1, zona: 'Norte' })).id,
            })
          ).id,
          categoria: 'adherente',
          unidadId: null,
          desde: '1970-01-01',
          cargos: [],
        },
      )

      process.env.ENTORNO = 'prueba'
      process.env.BD = ruta
      process.env.CLAVES_DE_SELLO = 'prueba=una-clave'
      process.env.CLAVE_DE_SELLO_ACTIVA = 'prueba'
      await main(['asignar', '--persona', persona.id])

      const { contexto: verificacion } = await componer(
        config,
        crearBd(ruta),
        sellador,
        crearAlmacenamientoEnMemoria(),
        crearConversorDeImagenes(),
      )
      expect(await verificacion.auth.esAdministradorDesignado(persona.id)).toBe(true)
    } finally {
      await rm(directorio, { recursive: true, force: true })
    }
  })
})
