import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Almacenamiento } from '@gps/core'
import { crearAlmacenamientoEnDisco, crearAlmacenamientoEnMemoria } from '../src/almacenamiento'

const BYTES = new Uint8Array([1, 2, 3, 250])

/** Las dos implementaciones cumplen el mismo contrato: el mismo cuerpo de
 *  tests corre contra las dos, que es lo unico que garantiza que el demo se
 *  comporte como el backend. */
function contrato(nombre: string, montar: () => Promise<Almacenamiento> | Almacenamiento) {
  describe(nombre, () => {
    test('lo que guarda lo lee igual', async () => {
      const almacenamiento = await montar()
      await almacenamiento.guardar('clave', BYTES)
      expect(await almacenamiento.leer('clave')).toEqual(BYTES)
    })

    test('guardar dos veces la misma clave deja lo ultimo', async () => {
      const almacenamiento = await montar()
      await almacenamiento.guardar('clave', BYTES)
      await almacenamiento.guardar('clave', new Uint8Array([9]))
      expect(await almacenamiento.leer('clave')).toEqual(new Uint8Array([9]))
    })

    test('leer una clave que no existe falla', async () => {
      const almacenamiento = await montar()
      expect(almacenamiento.leer('no-existe')).rejects.toThrow()
    })

    test('eliminar borra', async () => {
      const almacenamiento = await montar()
      await almacenamiento.guardar('clave', BYTES)
      await almacenamiento.eliminar('clave')
      expect(almacenamiento.leer('clave')).rejects.toThrow()
    })
  })
}

contrato('crearAlmacenamientoEnMemoria', crearAlmacenamientoEnMemoria)

describe('crearAlmacenamientoEnDisco', () => {
  let directorio: string

  beforeEach(async () => {
    directorio = await mkdtemp(join(tmpdir(), 'gps-archivos-'))
  })

  afterEach(async () => {
    await rm(directorio, { recursive: true, force: true })
  })

  contrato('contrato', () => crearAlmacenamientoEnDisco(directorio))

  test('guarda en subdirectorios sin que nadie los cree antes', async () => {
    const almacenamiento = crearAlmacenamientoEnDisco(directorio)
    await almacenamiento.guardar('salidas/permiso_1/v0.pdf', BYTES)
    expect(await almacenamiento.leer('salidas/permiso_1/v0.pdf')).toEqual(BYTES)
  })

  test('una clave que se sale del directorio es un error', async () => {
    // La arma archivos con ids de Core, pero un `..` que se cuele escribiria
    // en cualquier lado del disco.
    const almacenamiento = crearAlmacenamientoEnDisco(directorio)
    expect(almacenamiento.guardar('../afuera', BYTES)).rejects.toThrow()
    expect(almacenamiento.leer('../../etc/passwd')).rejects.toThrow()
  })
})
