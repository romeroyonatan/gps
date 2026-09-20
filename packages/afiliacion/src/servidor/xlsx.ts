// packages/afiliacion/src/servidor/xlsx.ts
//
// Un .xlsx mínimo, sin dependencias. Un xlsx es un ZIP con cinco partes XML, y
// una nómina de cien filas de texto no necesita más que eso: cualquier librería
// de planillas pesa más en el bundle que este archivo entero.
//
// Las entradas del ZIP van "stored" (sin comprimir). Deflate ahorraría unos
// kilobytes y costaría un compresor; la nómina de un grupo entra en un correo
// igual.
//
// Vive en /servidor y no en /dominio por lo mismo que el PDF de salidas: el
// /dominio lo importa el navegador, y esto no tiene nada que hacer ahí.
//
// ponytail: todo entra como texto salvo los números. Si alguna vez hacen falta
// fechas de calendario reales o formato de moneda, hay que sumar styles.xml y
// el serial de 1900; hoy nadie lo pide.

/** Empaqueta enteros little-endian: cada par es `[valor, cuántos bytes]`. Es
 *  todo lo que el formato ZIP necesita para sus cabeceras. */
function empaquetar(campos: readonly (readonly [number, number])[]): Uint8Array {
  const salida = new Uint8Array(campos.reduce((cuantos, [, bytes]) => cuantos + bytes, 0))
  let i = 0
  for (const [valor, bytes] of campos) {
    for (let k = 0; k < bytes; k++) salida[i++] = (valor >>> (8 * k)) & 0xff
  }
  return salida
}

/** CRC-32 (el polinomio de PKZIP), bit a bit y sin tabla: son unos pocos cientos
 *  de kilobytes por archivo y no vale la pena precalcular 256 entradas. */
export function crc32(bytes: Uint8Array): number {
  let acumulado = ~0
  for (const byte of bytes) {
    acumulado ^= byte
    for (let k = 0; k < 8; k++) acumulado = (acumulado >>> 1) ^ (0xedb88320 & -(acumulado & 1))
  }
  return ~acumulado >>> 0
}

/** 1980-01-01 en el formato de fecha del ZIP: el cero no es una fecha válida y
 *  algunas herramientas se quejan. La hora real no se guarda a propósito: es un
 *  archivo generado, y así dos exportaciones iguales dan bytes iguales. */
const FECHA_DEL_ZIP = (1 << 5) | 1

function zip(partes: readonly (readonly [string, string])[]): Uint8Array {
  const texto = new TextEncoder()
  const locales: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const [nombre, contenido] of partes) {
    const nombreEnBytes = texto.encode(nombre)
    const datos = texto.encode(contenido)
    // El bit 11 de las banderas declara que el nombre está en UTF-8.
    const comun = [
      [20, 2],
      [0x0800, 2],
      [0, 2],
      [0, 2],
      [FECHA_DEL_ZIP, 2],
      [crc32(datos), 4],
      [datos.length, 4],
      [datos.length, 4],
      [nombreEnBytes.length, 2],
      [0, 2],
    ] as const

    const local = empaquetar([[0x04034b50, 4], ...comun])
    locales.push(local, nombreEnBytes, datos)
    central.push(
      empaquetar([
        [0x02014b50, 4],
        [20, 2],
        ...comun,
        [0, 2], // comentario
        [0, 2], // disco
        [0, 2], // atributos internos
        [0, 4], // atributos externos
        [offset, 4],
      ]),
      nombreEnBytes,
    )
    offset += local.length + nombreEnBytes.length + datos.length
  }

  const largoDelDirectorio = central.reduce((suma, parte) => suma + parte.length, 0)
  const fin = empaquetar([
    [0x06054b50, 4],
    [0, 2],
    [0, 2],
    [partes.length, 2],
    [partes.length, 2],
    [largoDelDirectorio, 4],
    [offset, 4],
    [0, 2],
  ])

  const todo = [...locales, ...central, fin]
  const salida = new Uint8Array(todo.reduce((suma, parte) => suma + parte.length, 0))
  let donde = 0
  for (const parte of todo) {
    salida.set(parte, donde)
    donde += parte.length
  }
  return salida
}

const ENTIDADES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
}

function escapar(texto: string): string {
  let salida = ''
  for (const caracter of texto) {
    // Los caracteres de control no son XML valido en ninguna forma, ni siquiera
    // como entidad numerica: se descartan en vez de romper el archivo entero.
    const codigo = caracter.codePointAt(0) ?? 0
    if (codigo < 0x20 && caracter !== '\t' && caracter !== '\n' && caracter !== '\r') continue
    salida += ENTIDADES[caracter] ?? caracter
  }
  return salida
}

/** A1, B1 … Z1, AA1. */
function columna(indice: number): string {
  let nombre = ''
  for (let n = indice; n >= 0; n = Math.floor(n / 26) - 1) {
    nombre = String.fromCharCode(65 + (n % 26)) + nombre
  }
  return nombre
}

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const NS_RELS = 'http://schemas.openxmlformats.org/package/2006/relationships'
const NS_DOC = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

export type Celda = string | number

/** La planilla lista para bajar: una hoja, una fila por elemento del arreglo.
 *  La primera fila la arma quien llama, como cualquier otra. */
export function comoXlsx(nombreDeLaHoja: string, filas: readonly (readonly Celda[])[]): Uint8Array {
  const cuerpo = filas
    .map((celdas, f) => {
      const escritas = celdas
        .map((celda, c) => {
          const donde = `${columna(c)}${f + 1}`
          return typeof celda === 'number'
            ? `<c r="${donde}"><v>${celda}</v></c>`
            : `<c r="${donde}" t="inlineStr"><is><t xml:space="preserve">${escapar(celda)}</t></is></c>`
        })
        .join('')
      return `<row r="${f + 1}">${escritas}</row>`
    })
    .join('')

  // Excel rechaza el archivo si el nombre de la hoja pasa de 31 caracteres o
  // lleva alguno de los cinco prohibidos.
  const hoja = escapar(nombreDeLaHoja.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31))

  return zip([
    [
      '[Content_Types].xml',
      `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    ],
    [
      '_rels/.rels',
      `${XML}<Relationships xmlns="${NS_RELS}"><Relationship Id="rId1" Type="${NS_DOC}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    [
      'xl/workbook.xml',
      `${XML}<workbook xmlns="${NS}" xmlns:r="${NS_DOC}"><sheets><sheet name="${hoja}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ],
    [
      'xl/_rels/workbook.xml.rels',
      `${XML}<Relationships xmlns="${NS_RELS}"><Relationship Id="rId1" Type="${NS_DOC}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    ],
    [
      'xl/worksheets/sheet1.xml',
      `${XML}<worksheet xmlns="${NS}"><sheetData>${cuerpo}</sheetData></worksheet>`,
    ],
  ])
}
