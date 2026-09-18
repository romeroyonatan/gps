/** `heic-convert` no trae tipos. Solo se declara lo que se usa: el resto de su
 *  API (PNG, conversion de todas las imagenes de un HEIC multiple) no entra
 *  hasta que alguien la necesite. */
declare module 'heic-convert' {
  export default function convert(opciones: {
    buffer: Uint8Array
    format: 'JPEG' | 'PNG'
    quality?: number
  }): Promise<ArrayBufferLike>
}
