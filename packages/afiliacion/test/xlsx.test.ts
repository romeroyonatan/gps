import { describe, expect, test } from 'bun:test'
import { type Celda, comoXlsx, crc32 } from '../src/servidor/xlsx'

/** Lee el ZIP por el directorio central, que es como lo lee un descompresor de
 *  verdad: si los offsets o los largos están mal, esto no encuentra nada. */
function abrirElZip(bytes: Uint8Array): Map<string, string> {
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const fin = bytes.length - 22
  expect(vista.getUint32(fin, true)).toBe(0x06054b50)

  const partes = new Map<string, string>()
  const texto = new TextDecoder()
  let donde = vista.getUint32(fin + 16, true)

  for (let cuantas = vista.getUint16(fin + 10, true); cuantas > 0; cuantas--) {
    expect(vista.getUint32(donde, true)).toBe(0x02014b50)
    const largoDelNombre = vista.getUint16(donde + 28, true)
    const nombre = texto.decode(bytes.subarray(donde + 46, donde + 46 + largoDelNombre))
    const local = vista.getUint32(donde + 42, true)
    expect(vista.getUint32(local, true)).toBe(0x04034b50)

    const datosDesde =
      local + 30 + vista.getUint16(local + 26, true) + vista.getUint16(local + 28, true)
    const datos = bytes.subarray(datosDesde, datosDesde + vista.getUint32(local + 22, true))
    expect(crc32(datos)).toBe(vista.getUint32(local + 14, true))

    partes.set(nombre, texto.decode(datos))
    donde += 46 + largoDelNombre
  }
  return partes
}

function armar(filas: readonly (readonly Celda[])[]): Map<string, string> {
  return abrirElZip(comoXlsx('Nómina', filas))
}

describe('xlsx', () => {
  // El vector canónico de CRC-32: si esto da otra cosa, todo archivo sale roto.
  test('el crc32 es el de PKZIP', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })

  test('arma las cinco partes que Excel exige', () => {
    const partes = armar([['a']])
    expect([...partes.keys()].sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/_rels/workbook.xml.rels',
      'xl/workbook.xml',
      'xl/worksheets/sheet1.xml',
    ])
  })

  test('escribe texto y números en celdas distintas', () => {
    const hoja = armar([
      ['Apellidos y nombres', '#'],
      ['Ibarra, Sofía', 7],
    ]).get('xl/worksheets/sheet1.xml')
    expect(hoja).toContain('<c r="A2" t="inlineStr"><is><t xml:space="preserve">Ibarra, Sofía</t>')
    expect(hoja).toContain('<c r="B2"><v>7</v></c>')
  })

  test('escapa lo que rompería el XML', () => {
    const hoja = armar([['Sosa & <Vera>']]).get('xl/worksheets/sheet1.xml')
    expect(hoja).toContain('Sosa &amp; &lt;Vera&gt;')
  })

  test('numera más allá de la columna Z', () => {
    const hoja = armar([Array.from({ length: 27 }, (_, i) => String(i))]).get(
      'xl/worksheets/sheet1.xml',
    )
    expect(hoja).toContain('r="Z1"')
    expect(hoja).toContain('r="AA1"')
  })
})
