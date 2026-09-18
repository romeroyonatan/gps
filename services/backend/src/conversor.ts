/// <reference path="./heic.d.ts" />
import type { ConversorDeImagenes } from '@gps/core'
import convert from 'heic-convert'

/** Los magic bytes de un HEIC/HEIF: en el box `ftyp`, que arranca en el byte 4,
 *  la marca de formato. Se mira el contenido y no el tipo MIME declarado porque
 *  el tipo lo manda el cliente y puede mentir, y decodificar como HEIC algo que
 *  no lo es tira un error sin sentido. */
const MARCAS_HEIC = ['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'mif1', 'msf1']

export function esHeic(contenido: Uint8Array): boolean {
  if (contenido.length < 12) return false
  const cabecera = new TextDecoder('latin1').decode(contenido.subarray(4, 12))
  return cabecera.startsWith('ftyp') && MARCAS_HEIC.includes(cabecera.slice(4, 8))
}

/** `heic-convert` es libheif compilado a JS: no trae binarios nativos, asi que
 *  no toca el Dockerfile. `sharp` precompilado no decodifica HEIC -las patentes
 *  de HEVC no vienen en sus builds-, por eso no se usa.
 *
 *  ponytail: convierte dentro del request; una foto de 12 MP tarda uno o dos
 *  segundos. Pasar a una cola si alguna vez se suben de a muchas. */
export function crearConversorDeImagenes(): ConversorDeImagenes {
  return {
    async aJpeg(contenido) {
      if (!esHeic(contenido)) {
        throw new Error('El contenido no es HEIC ni HEIF: no hay nada que convertir.')
      }
      return new Uint8Array(await convert({ buffer: contenido, format: 'JPEG', quality: 0.85 }))
    },
  }
}
