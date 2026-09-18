import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from 'pdf-lib'
import type { Firma, ParticipanteEmitido, Permiso } from '../dominio/modelos'
import { resumenDeParticipantes } from '../dominio/participantes'
import { deserializar } from '../dominio/trazos'

/** Lo que el PDF necesita saber de una firma pendiente para dibujar su linea. */
export interface LineaDeFirma {
  readonly cargo: string
  readonly nombre: string
  readonly firma: Firma | null
}

const MARGEN = 50
const ANCHO = 595 // A4 en puntos
const ALTO = 842

/** Un instante fijo para los metadatos. pdf-lib pone la hora del sistema en
 *  CreationDate y ModDate: con eso, el mismo permiso generaria bytes distintos
 *  cada vez y el hash que ancla las firmas no serviria para nada.
 *
 *  No sale de core.reloj: no es un hecho del negocio, es un campo que hay que
 *  fijar para que el archivo sea reproducible. La fecha real del permiso esta
 *  impresa adentro. */
const SIN_FECHA = new Date(0)

/** Las columnas de la tabla de participantes, con su ancho en puntos. El nombre
 *  se lleva lo que sobra: es lo que mas varia y lo que se busca al leer.
 *
 *  Anchos fijos y no calculados sobre el contenido: asi la tabla se ve igual en
 *  todas las paginas y en todos los permisos, que es lo que hace que se pueda
 *  recorrer con el dedo. */
const COLUMNAS = [
  { titulo: 'Apellido y nombre', ancho: ANCHO - MARGEN * 2 - 85 - 190 },
  { titulo: 'Documento', ancho: 85 },
  // La mas ancha despues del nombre: "Tropa scout Santa Juana de Arco ·
  // femenina" es lo normal, no un caso raro, y cortada no dice cual de las dos
  // tropas es, que es justo lo que se mira.
  { titulo: 'Unidad', ancho: 190 },
] as const

const ALTO_DE_FILA = 14

/** Un titulo, su encabezado y al menos dos filas: menos que eso no vale la pena
 *  empezar la seccion al pie de una hoja. */
const ALTO_MINIMO_DE_SECCION = 14 + ALTO_DE_FILA * 3

/** La linea de titulos, con la raya debajo. Devuelve donde sigue el texto. */
function encabezadoDeTabla(pagina: PDFPage, y: number, negrita: PDFFont): number {
  let x = MARGEN
  for (const columna of COLUMNAS) {
    texto(pagina, columna.titulo, x + 4, y, negrita, 8)
    x += columna.ancho
  }
  pagina.drawLine({
    start: { x: MARGEN, y: y - 4 },
    end: { x: ANCHO - MARGEN, y: y - 4 },
    thickness: 0.5,
    color: rgb(0.4, 0.45, 0.5),
  })
  return y - ALTO_DE_FILA - 2
}

/** Una fila. Las pares van con fondo gris clarito: en una lista de cuarenta
 *  chicos es lo que evita saltar de renglon al recorrerla con el dedo. */
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
  for (const [indiceDeColumna, columna] of COLUMNAS.entries()) {
    const contenido = celdas[indiceDeColumna] ?? ''
    // Recortar y no dejar que se pise la columna de al lado: un apellido largo
    // encima del documento hace ilegibles las dos cosas.
    texto(pagina, recortar(contenido, columna.ancho - 8, fuente, 9), x + 4, y, fuente, 9)
    x += columna.ancho
  }
  return y - ALTO_DE_FILA
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

/** Como se agrupa y se ordena la lista antes de dibujarla: los dirigentes
 *  primero y aparte, porque quien mira el papel busca quien esta a cargo, y
 *  cada uno como las celdas de su fila.
 *
 *  Una seccion sin nadie no sale: un titulo con su encabezado y ninguna fila
 *  debajo se lee como si la tabla estuviera rota.
 *
 *  Es una funcion aparte y exportada porque es la decision; dibujarla no lo es,
 *  y adentro del PDF los streams van comprimidos, asi que un test que busque
 *  texto ahi no prueba nada. */
export function seccionesDeParticipantes(
  participantes: readonly ParticipanteEmitido[],
): readonly { titulo: string; filas: readonly (readonly string[])[] }[] {
  return (
    [
      ['Dirigentes', 'dirigente'],
      ['Beneficiarios', 'beneficiario'],
    ] as const
  )
    .map(([titulo, marca]) => ({
      titulo,
      filas: participantes
        .filter((uno) => uno.marca === marca)
        .map((uno) => [`${uno.apellidos}, ${uno.nombres}`, uno.numeroDeDocumento, uno.unidad]),
    }))
    .filter((seccion) => seccion.filas.length > 0)
}

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

/** El PDF del permiso, con las firmas que ya esten puestas.
 *
 *  Se compone siempre del estado actual y nunca se parte del escaneo: el
 *  sacerdote puede firmar el papel antes de que firmen en la app, y si el
 *  escaneo fuera el documento final mostraria lineas vacias que en el sistema
 *  ya estan firmadas. La pagina principal dice lo que es cierto hoy, y los
 *  escaneos van como anexo.
 *
 *  Es deterministico a proposito: los mismos datos dan los mismos bytes, asi
 *  que el hash guardado al emitir sigue valiendo. */
export async function armarPdf(datos: {
  permiso: Permiso
  grupo: { numero: number; nombre: string }
  unidades: readonly string[]
  participantes: readonly ParticipanteEmitido[]
  firmas: readonly LineaDeFirma[]
  escaneos: readonly { cargo: string; contenido: Uint8Array; tipo: string }[]
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

  texto(pagina, 'PERMISO DE SALIDA', MARGEN, y, negrita, 16)
  y -= 28
  texto(
    pagina,
    `Grupo Scout Nº${datos.grupo.numero} - ${datos.grupo.nombre}`,
    MARGEN,
    y,
    normal,
    12,
  )
  y -= 24

  for (const [etiqueta, valor] of [
    ['Lugar', datos.permiso.lugar],
    ['Fechas', `${datos.permiso.desde} a ${datos.permiso.hasta}`],
    ['Unidades', datos.unidades.join(', ') || '-'],
    ['Viaje', datos.permiso.comoSeViaja ?? '-'],
  ] as const) {
    texto(pagina, `${etiqueta}:`, MARGEN, y, negrita)
    texto(pagina, valor, MARGEN + 70, y, normal)
    y -= 16
  }

  y -= 12
  texto(
    pagina,
    `PARTICIPANTES (${resumenDeParticipantes(datos.participantes)})`,
    MARGEN,
    y,
    negrita,
    11,
  )
  y -= 18

  for (const seccion of seccionesDeParticipantes(datos.participantes)) {
    // Que la seccion no arranque al pie: un titulo con su encabezado y una
    // sola fila debajo se lee peor que empezar en la hoja siguiente.
    if (y < MARGEN + ALTO_MINIMO_DE_SECCION) {
      pagina = documento.addPage([ANCHO, ALTO])
      y = ALTO - MARGEN
    }

    texto(pagina, seccion.titulo, MARGEN, y, negrita)
    y -= 14
    y = encabezadoDeTabla(pagina, y, negrita)

    for (const [indice, fila] of seccion.filas.entries()) {
      // Se corta al llegar al pie de la hoja y no antes: reservar el lugar de
      // las firmas en cada pagina desperdiciaria un cuarto de todas. Que
      // entren es problema del bloque de firmas, que abre hoja si no le da.
      if (y < MARGEN + ALTO_DE_FILA) {
        pagina = documento.addPage([ANCHO, ALTO])
        y = ALTO - MARGEN
        // Repetir el encabezado: una tabla que sigue en la hoja siguiente sin
        // el no se puede leer sin volver atras.
        y = encabezadoDeTabla(pagina, y, negrita)
      }
      y = filaDeTabla(pagina, y, normal, indice, fila)
    }
    y -= 12
  }

  // Las firmas al pie de la ultima pagina, con lugar garantizado: si no entran,
  // van en una hoja nueva.
  if (y < MARGEN + 140) {
    pagina = documento.addPage([ANCHO, ALTO])
    y = ALTO - MARGEN
  }
  y = Math.max(y, MARGEN + 140)
  texto(pagina, 'FIRMAS', MARGEN, y, negrita, 11)
  y -= 20

  const anchoDeLinea = (ANCHO - MARGEN * 2 - 20) / 3
  for (const [indice, linea] of datos.firmas.entries()) {
    const x = MARGEN + indice * (anchoDeLinea + 10)
    pagina.drawLine({
      start: { x, y: y - 40 },
      end: { x: x + anchoDeLinea, y: y - 40 },
      thickness: 0.5,
    })
    texto(pagina, linea.cargo, x, y - 54, negrita, 8)
    texto(pagina, linea.nombre, x, y - 64, normal, 8)

    if (linea.firma?.modo === 'app' && linea.firma.trazos !== null) {
      dibujarFirma(pagina, linea.firma.trazos, x, y - 40, anchoDeLinea)
      texto(pagina, `Firmado en la app el ${linea.firma.fecha}`, x, y - 74, normal, 7)
    } else if (linea.firma?.modo === 'papel') {
      // No se recorta el dibujo del escaneo para estamparlo aca: pide detectar
      // donde esta la firma y se rompe con cualquier foto torcida.
      texto(pagina, 'Firmado en papel', x, y - 30, negrita, 8)
      texto(pagina, `ver anexo - ${linea.firma.fecha}`, x, y - 74, normal, 7)
    }
  }

  // Los escaneos como paginas anexas: son la prueba de lo que se firmo en papel
  // ese dia, no el documento.
  for (const escaneo of datos.escaneos) {
    await anexar(documento, escaneo, negrita)
  }

  return await documento.save()
}

/** Agrega el escaneo de un papel firmado como anexo.
 *
 *  Puede ser una foto o un PDF: escanear con la impresora de una parroquia da
 *  PDF, que es tan normal como sacarle una foto con el telefono. Un PDF se
 *  copia pagina por pagina y no se aplasta a imagen, asi que se puede leer y
 *  buscar texto adentro.
 *
 *  Si no se puede leer, el anexo sale diciendolo en vez de tumbar el PDF
 *  entero: un archivo corrupto no tiene que dejar un permiso firmado sin forma
 *  de descargarse, y el problema se ve en el papel en vez de esconderse. */
async function anexar(
  documento: PDFDocument,
  escaneo: { cargo: string; contenido: Uint8Array; tipo: string },
  negrita: PDFFont,
): Promise<void> {
  const titulo = `ANEXO - firmado en papel por ${escaneo.cargo}`

  try {
    if (escaneo.tipo === 'application/pdf') {
      const origen = await PDFDocument.load(escaneo.contenido)
      const copiadas = await documento.copyPages(origen, origen.getPageIndices())
      for (const [indice, hoja] of copiadas.entries()) {
        documento.addPage(hoja)
        // El rotulo solo en la primera: en las demas taparia el contenido del
        // escaneo sin agregar nada.
        if (indice === 0) {
          texto(hoja, titulo, MARGEN, hoja.getHeight() - 20, negrita, 9)
        }
      }
      return
    }

    // Incrustar primero y agregar la hoja despues: al reves, una imagen que no
    // se puede leer deja una pagina en blanco antes de la que avisa.
    const imagen =
      escaneo.tipo === 'image/png'
        ? await documento.embedPng(escaneo.contenido)
        : await documento.embedJpg(escaneo.contenido)
    const hoja = documento.addPage([ANCHO, ALTO])
    texto(hoja, titulo, MARGEN, ALTO - MARGEN, negrita, 11)
    const escala = Math.min(
      (ANCHO - MARGEN * 2) / imagen.width,
      (ALTO - MARGEN * 3) / imagen.height,
    )
    hoja.drawImage(imagen, {
      x: MARGEN,
      y: MARGEN,
      width: imagen.width * escala,
      height: imagen.height * escala,
    })
  } catch {
    const hoja = documento.addPage([ANCHO, ALTO])
    texto(hoja, titulo, MARGEN, ALTO - MARGEN, negrita, 11)
    texto(
      hoja,
      `No se pudo mostrar este archivo (${escaneo.tipo}). Está guardado en el sistema.`,
      MARGEN,
      ALTO - MARGEN - 24,
      negrita,
      10,
    )
  }
}

/** Los trazos normalizados, escalados al recuadro de la linea de firma. */
function dibujarFirma(pagina: PDFPage, serializados: string, x: number, y: number, ancho: number) {
  const trazos = deserializar(serializados)
  if (!trazos) return
  const alto = 34

  for (const trazo of trazos.trazos) {
    for (let i = 1; i < trazo.length; i++) {
      const anterior = trazo[i - 1]
      const actual = trazo[i]
      if (!anterior || !actual) continue
      pagina.drawLine({
        // La y se invierte: en el lienzo crece hacia abajo y en el PDF hacia
        // arriba.
        start: { x: x + anterior[0] * ancho, y: y + (1 - anterior[1]) * alto },
        end: { x: x + actual[0] * ancho, y: y + (1 - actual[1]) * alto },
        thickness: 1,
      })
    }
  }
}
