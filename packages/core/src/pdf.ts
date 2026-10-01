import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from 'pdf-lib'

/** Lo que comparten los papeles que arma el servidor -el permiso de salida, la
 *  nomina del grupo-: un documento reproducible y las dos letras.
 *
 *  Va en su propio subpath y no en el indice por lo mismo que `fechas`. Un
 *  import de valor de pdf-lib desde el indice lo arrastraria a todos. */

/** Un instante fijo para los metadatos. pdf-lib pone la hora del sistema en
 *  CreationDate y ModDate. Con eso, los mismos datos darian bytes distintos
 *  cada vez, y el hash que ancla las firmas de un permiso no serviria. La
 *  fecha real va impresa adentro, que es donde se lee.
 *
 *  No sale de core.reloj: no es un hecho del negocio, es un campo que hay que
 *  fijar para que el archivo sea reproducible. */
const SIN_FECHA = new Date(0)

const NEGRO = rgb(0, 0, 0)

/** Un documento vacio con los metadatos fijos y Helvetica en sus dos pesos. */
export async function documentoDeterminista(): Promise<{
  documento: PDFDocument
  normal: PDFFont
  negrita: PDFFont
}> {
  const documento = await PDFDocument.create()
  documento.setCreationDate(SIN_FECHA)
  documento.setModificationDate(SIN_FECHA)
  documento.setProducer('GPS')
  documento.setCreator('GPS')

  const normal = await documento.embedFont(StandardFonts.Helvetica)
  const negrita = await documento.embedFont(StandardFonts.HelveticaBold)
  return { documento, normal, negrita }
}

export function texto(
  pagina: PDFPage,
  contenido: string,
  x: number,
  y: number,
  fuente: PDFFont,
  tamano = 10,
  color = NEGRO,
) {
  pagina.drawText(contenido, { x, y, size: tamano, font: fuente, color })
}

/** El texto que entra en `ancho`, con puntos suspensivos si no entra entero. */
export function recortar(
  contenido: string,
  ancho: number,
  fuente: PDFFont,
  tamano: number,
): string {
  if (fuente.widthOfTextAtSize(contenido, tamano) <= ancho) return contenido
  let recortado = contenido
  while (recortado.length > 1 && fuente.widthOfTextAtSize(`${recortado}…`, tamano) > ancho) {
    recortado = recortado.slice(0, -1)
  }
  return `${recortado}…`
}
