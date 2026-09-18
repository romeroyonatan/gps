import { describe, expect, test } from 'bun:test'
import { crearConversorDeImagenes, esHeic } from '../src/conversor'

/** Una foto HEIC de verdad, chica: la genero `sips` -el convertidor de macOS-
 *  a partir de un PNG. Tiene que ser un archivo y no bytes armados a mano
 *  porque lo que se prueba es que libheif la decodifique. */
const foto = async () =>
  new Uint8Array(await Bun.file(new URL('./fixtures/foto.heic', import.meta.url)).arrayBuffer())

const JPEG = [0xff, 0xd8, 0xff]

describe('esHeic', () => {
  test('reconoce una foto HEIC por su contenido, no por lo que declara', async () => {
    expect(esHeic(await foto())).toBe(true)
  })

  test('un JPEG no es HEIC', () => {
    expect(esHeic(new Uint8Array([...JPEG, 0xe0, 0, 16, 74, 70, 73, 70, 0]))).toBe(false)
  })

  test('algo demasiado corto no rompe: es false', () => {
    expect(esHeic(new Uint8Array([1, 2, 3]))).toBe(false)
  })
})

describe('crearConversorDeImagenes', () => {
  test('convierte una foto HEIC a un JPEG legible', async () => {
    const convertida = await crearConversorDeImagenes().aJpeg(await foto())
    expect([...convertida.slice(0, 3)]).toEqual(JPEG)
    expect(convertida.length).toBeGreaterThan(0)
  })

  test('bytes que no se pueden decodificar son un error', async () => {
    // Es lo que hace que confirmarSubida rechace en vez de guardar basura.
    expect(crearConversorDeImagenes().aJpeg(new Uint8Array([0, 1, 2, 3]))).rejects.toThrow()
  })

  test('un HEIC truncado tambien', async () => {
    // Pasa esHeic -la cabecera esta- pero libheif no lo puede leer: el error
    // tiene que venir de la decodificacion, no colarse como archivo valido.
    const truncada = (await foto()).slice(0, 40)
    expect(crearConversorDeImagenes().aJpeg(truncada)).rejects.toThrow()
  })
})
