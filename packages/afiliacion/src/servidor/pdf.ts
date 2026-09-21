import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from 'pdf-lib'
import { COLUMNAS_DE_LA_NOMINA, type SeccionDeLaNomina } from '../dominio/nomina'

const MARGEN = 50
const ANCHO = 595 // A4 en puntos
const ALTO = 842

/** Un instante fijo para los metadatos, por la misma razón que en el permiso de
 *  salida: pdf-lib pone la hora del sistema en CreationDate y ModDate, y con eso
 *  la misma nómina daría bytes distintos cada vez. La fecha real de la nómina va
 *  impresa adentro, que es donde se lee.
 *
 *  No sale de core.reloj: no es un hecho del negocio, es un campo que hay que
 *  fijar para que el archivo sea reproducible. */
const SIN_FECHA = new Date(0)

/** Los anchos en puntos, en el orden de COLUMNAS_DE_LA_NOMINA. El nombre se
 *  lleva lo que sobra: es lo que más varía y lo que se busca al leer.
 *
 *  Fijos y no calculados sobre el contenido, igual que en el permiso: así la
 *  tabla se ve igual en todas las páginas y en todas las nóminas, que es lo que
 *  permite recorrerla con el dedo. */
const ANCHOS = [26, ANCHO - MARGEN * 2 - 26 - 112 - 80 - 95, 112, 80, 95] as const

const ALTO_DE_FILA = 14

/** Un título, su encabezado y al menos dos filas: menos que eso no vale la pena
 *  empezar la sección al pie de una hoja. */
const ALTO_MINIMO_DE_SECCION = 14 + ALTO_DE_FILA * 3

function texto(
  pagina: PDFPage,
  contenido: string,
  x: number,
  y: number,
  fuente: PDFFont,
  tamano = 10,
) {
  pagina.drawText(contenido, { x, y, size: tamano, font: fuente, color: rgb(0, 0, 0) })
}

/** El texto que entra en `ancho`, con puntos suspensivos si no entra entero. */
function recortar(contenido: string, ancho: number, fuente: PDFFont, tamano: number): string {
  if (fuente.widthOfTextAtSize(contenido, tamano) <= ancho) return contenido
  let recortado = contenido
  while (recortado.length > 1 && fuente.widthOfTextAtSize(`${recortado}…`, tamano) > ancho) {
    recortado = recortado.slice(0, -1)
  }
  return `${recortado}…`
}

/** La línea de títulos, con la raya debajo. Devuelve dónde sigue el texto. */
function encabezadoDeTabla(pagina: PDFPage, y: number, negrita: PDFFont): number {
  let x = MARGEN
  for (const [indice, titulo] of COLUMNAS_DE_LA_NOMINA.entries()) {
    texto(pagina, titulo, x + 4, y, negrita, 8)
    x += ANCHOS[indice] ?? 0
  }
  pagina.drawLine({
    start: { x: MARGEN, y: y - 4 },
    end: { x: ANCHO - MARGEN, y: y - 4 },
    thickness: 0.5,
    color: rgb(0.4, 0.45, 0.5),
  })
  return y - ALTO_DE_FILA - 2
}

/** Una fila. Las pares van con fondo gris clarito: en una nómina de ochenta
 *  personas es lo que evita saltar de renglón al recorrerla con el dedo. */
function filaDeTabla(
  pagina: PDFPage,
  y: number,
  fuente: PDFFont,
  indice: number,
  celdas: readonly string[],
): number {
  if (indice % 2 === 1) {
    pagina.drawRectangle({
      x: MARGEN,
      y: y - 4,
      width: ANCHO - MARGEN * 2,
      height: ALTO_DE_FILA,
      color: rgb(0.96, 0.97, 0.98),
    })
  }

  let x = MARGEN
  for (const [indiceDeColumna, ancho] of ANCHOS.entries()) {
    const contenido = celdas[indiceDeColumna] ?? ''
    // Recortar y no dejar que se pise la columna de al lado: un apellido largo
    // encima del documento hace ilegibles las dos cosas.
    texto(pagina, recortar(contenido, ancho - 8, fuente, 9), x + 4, y, fuente, 9)
    x += ancho
  }
  return y - ALTO_DE_FILA
}

/** La nómina del grupo en papel: el membrete, la fecha y las tres tablas.
 *
 *  Es la hoja que se presenta en el distrito, así que dice desde arriba de qué
 *  grupo es, a qué día y cuántos son: una nómina sin fecha no prueba nada.
 *
 *  Determinístico a propósito, como el del permiso: los mismos datos dan los
 *  mismos bytes. */
export async function armarPdfDeLaNomina(datos: {
  grupo: { numero: number; nombre: string }
  fecha: string
  periodo: number
  secciones: readonly SeccionDeLaNomina[]
}): Promise<Uint8Array> {
  const documento = await PDFDocument.create()
  documento.setCreationDate(SIN_FECHA)
  documento.setModificationDate(SIN_FECHA)
  documento.setProducer('GPS')
  documento.setCreator('GPS')

  const normal = await documento.embedFont(StandardFonts.Helvetica)
  const negrita = await documento.embedFont(StandardFonts.HelveticaBold)

  let pagina = documento.addPage([ANCHO, ALTO])
  let y = ALTO - MARGEN

  texto(pagina, 'NÓMINA DEL GRUPO', MARGEN, y, negrita, 16)
  y -= 28
  texto(
    pagina,
    `Grupo Scout Nº${datos.grupo.numero} - ${datos.grupo.nombre}`,
    MARGEN,
    y,
    normal,
    12,
  )
  y -= 20

  const cuantos = datos.secciones.reduce((suma, seccion) => suma + seccion.filas.length, 0)
  const sinAfiliar = datos.secciones
    .flatMap((seccion) => seccion.filas)
    .filter((fila) => fila.celdas.at(-1) === 'Sin afiliar').length
  texto(
    pagina,
    `Al ${datos.fecha} · ${cuantos} personas · ${sinAfiliar} sin afiliar en ${datos.periodo}`,
    MARGEN,
    y,
    normal,
    10,
  )
  y -= 24

  for (const seccion of datos.secciones) {
    // Que la sección no arranque al pie: un título con su encabezado y una sola
    // fila debajo se lee peor que empezar en la hoja siguiente.
    if (y < MARGEN + ALTO_MINIMO_DE_SECCION) {
      pagina = documento.addPage([ANCHO, ALTO])
      y = ALTO - MARGEN
    }

    texto(pagina, `${seccion.titulo} (${seccion.filas.length})`, MARGEN, y, negrita)
    y -= 14
    y = encabezadoDeTabla(pagina, y, negrita)

    for (const [indice, fila] of seccion.filas.entries()) {
      if (y < MARGEN + ALTO_DE_FILA) {
        pagina = documento.addPage([ANCHO, ALTO])
        y = ALTO - MARGEN
        // Repetir el encabezado: una tabla que sigue en la hoja siguiente sin él
        // no se puede leer sin volver atrás.
        y = encabezadoDeTabla(pagina, y, negrita)
      }
      y = filaDeTabla(pagina, y, normal, indice, [String(fila.numero), ...fila.celdas])
    }
    y -= 12
  }

  return await documento.save()
}
