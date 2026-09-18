import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Almacenamiento } from '@gps/core'

/** Los bytes en el disco local, un archivo por clave. Es la implementacion de
 *  prototipo: el dia que haga falta durabilidad se cambia por S3 y ningun
 *  modulo se entera, que es para lo que existe la interfaz.
 *
 *  La clave no puede salirse del directorio: la arma `archivos` con ids que
 *  genera Core, pero un `..` que se cuele escribiria en cualquier lado. */
export function crearAlmacenamientoEnDisco(directorio: string): Almacenamiento {
  function rutaDe(clave: string): string {
    const ruta = join(directorio, clave)
    const raiz = join(directorio, '/')
    if (!ruta.startsWith(raiz)) throw new Error(`Clave de archivo invalida: "${clave}".`)
    return ruta
  }

  return {
    async guardar(clave, contenido) {
      const ruta = rutaDe(clave)
      await mkdir(dirname(ruta), { recursive: true })
      await Bun.write(ruta, contenido)
    },

    async leer(clave) {
      return new Uint8Array(await Bun.file(rutaDe(clave)).arrayBuffer())
    },

    async eliminar(clave) {
      await Bun.file(rutaDe(clave)).delete()
    },
  }
}

/** Todo en memoria, para el demo: su base tambien lo es (ver leerRutaDeBd), y
 *  un build de demostracion no tiene que dejar archivos en el disco de nadie. */
export function crearAlmacenamientoEnMemoria(): Almacenamiento {
  const guardados = new Map<string, Uint8Array>()
  return {
    async guardar(clave, contenido) {
      guardados.set(clave, contenido)
    },
    async leer(clave) {
      const contenido = guardados.get(clave)
      if (!contenido) throw new Error(`No hay ningun archivo con la clave "${clave}".`)
      return contenido
    },
    async eliminar(clave) {
      guardados.delete(clave)
    },
  }
}
