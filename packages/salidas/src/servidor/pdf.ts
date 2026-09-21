import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from 'pdf-lib'
import type { Firma, ParticipanteEmitido, Permiso } from '../dominio/modelos'
import { cuantos } from '../dominio/participantes'
import { numeroDeExpediente } from '../dominio/permisos'
import { deserializar } from '../dominio/trazos'

/** Lo que el PDF necesita saber de una firma pendiente para dibujar su linea. */
export interface LineaDeFirma {
  readonly cargo: string
  readonly nombre: string
  readonly firma: Firma | null
}

const ANCHO = 595 // A4 en puntos
const ALTO = 842
const MARGEN = 46
const CONTENIDO = ANCHO - MARGEN * 2

/** Los grises del diseno. Uno solo para el texto secundario y otro mas claro
 *  para las rayas: el papel se lee de un vistazo cuando la jerarquia la hace el
 *  gris y no el tamano. */
const NEGRO = rgb(0, 0, 0)
const GRIS = rgb(0.42, 0.42, 0.42)
const TENUE = rgb(0.56, 0.56, 0.56)
const RAYA = rgb(0.93, 0.93, 0.93)
const BORDE = rgb(0.85, 0.85, 0.85)
const BANDA = rgb(0.953, 0.953, 0.953)

/** Un instante fijo para los metadatos. pdf-lib pone la hora del sistema en
 *  CreationDate y ModDate: con eso, el mismo permiso generaria bytes distintos
 *  cada vez y el hash que ancla las firmas no serviria para nada.
 *
 *  No sale de core.reloj: no es un hecho del negocio, es un campo que hay que
 *  fijar para que el archivo sea reproducible. La fecha real del permiso esta
 *  impresa adentro. */
const SIN_FECHA = new Date(0)

const ALTO_DE_FILA = 12
const ALTO_DE_ENCABEZADO = 14

/** Las columnas de la nomina, con su ancho en puntos dentro de media pagina. El
 *  nombre se lleva lo que sobra: es lo que mas varia y lo que se busca al leer.
 *
 *  Anchos fijos y no calculados sobre el contenido: asi la tabla se ve igual en
 *  todas las paginas y en todos los permisos, que es lo que hace que se pueda
 *  recorrer con el dedo. */
const ANCHO_DE_COLUMNA = (CONTENIDO - 18) / 2
const CELDAS = [
  { titulo: '#', ancho: 22 },
  { titulo: 'Apellidos y nombres', ancho: ANCHO_DE_COLUMNA - 22 - 42 - 92 },
  { titulo: 'Documento', ancho: 42 },
  // La mas ancha despues del nombre: "Tropa scout San Jorge" es lo normal, no
  // un caso raro, y cortada no dice cual de las dos tropas es.
  { titulo: 'Unidad', ancho: 92 },
] as const

/** aaaa-mm-dd a dd/mm/aaaa, que es como se escribe una fecha en un papel. Parte
 *  el texto en vez de parsear: el dominio ya garantiza que es una fecha real. */
export function enDiaMesAnio(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-')
  return dia ? `${dia}/${mes}/${anio}` : fecha
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

/** El mismo texto cortado en renglones que entran en `ancho`. Corta por
 *  palabras: partir una al medio se lee como un error de impresion. */
export function envolver(
  contenido: string,
  ancho: number,
  fuente: PDFFont,
  tamano: number,
): readonly string[] {
  const renglones: string[] = []
  let actual = ''
  for (const palabra of contenido.split(' ')) {
    const probado = actual === '' ? palabra : `${actual} ${palabra}`
    if (fuente.widthOfTextAtSize(probado, tamano) <= ancho) {
      actual = probado
      continue
    }
    if (actual !== '') renglones.push(actual)
    actual = palabra
  }
  if (actual !== '') renglones.push(actual)
  return renglones
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

/** Cuantos van de cada unidad, en el orden en que aparecen. Es la composicion
 *  del contingente del papel: quien lo lee quiere saber que ramas viajan, no
 *  recorrer cuarenta nombres para deducirlo. */
export function composicion(
  participantes: readonly ParticipanteEmitido[],
): readonly { unidad: string; cuantos: number }[] {
  const porUnidad = new Map<string, number>()
  for (const uno of participantes) {
    porUnidad.set(uno.unidad, (porUnidad.get(uno.unidad) ?? 0) + 1)
  }
  return [...porUnidad].map(([unidad, cuantos]) => ({ unidad, cuantos }))
}

function texto(
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

/** Lo mismo pero terminando en `x`: los numeros y las fechas del margen
 *  derecho se alinean por ahi. */
function aLaDerecha(
  pagina: PDFPage,
  contenido: string,
  x: number,
  y: number,
  fuente: PDFFont,
  tamano = 10,
  color = NEGRO,
) {
  texto(
    pagina,
    contenido,
    x - fuente.widthOfTextAtSize(contenido, tamano),
    y,
    fuente,
    tamano,
    color,
  )
}

function raya(pagina: PDFPage, y: number, desde: number, hasta: number, color = RAYA) {
  pagina.drawLine({ start: { x: desde, y }, end: { x: hasta, y }, thickness: 0.7, color })
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
 *  que el hash guardado al emitir sigue valiendo. Por eso tampoco lleva impresa
 *  la fecha de emision: el unico instante que hay a mano -`actualizadoEn`-
 *  cambia despues de guardar el hash, y el PDF dejaria de reproducirse. */
export async function armarPdf(datos: {
  permiso: Permiso
  grupo: { numero: number; nombre: string }
  unidades: readonly string[]
  participantes: readonly ParticipanteEmitido[]
  /** Quien queda a cargo, tal como figura en la nomina emitida. */
  responsable: ParticipanteEmitido | null
  /** La huella de lo que dice este papel. Va impresa en el pie de cada hoja:
   *  es con lo que se comprueba, contra GPS, que el contenido no cambio. */
  huella: string
  /** Si esa huella no es la que se guardo al emitir. El papel lo dice en vez de
   *  callarse: un permiso que no coincide con lo emitido no sirve, y esconderlo
   *  seria peor que no tener huella. */
  alterado: boolean
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

  const { permiso } = datos
  const elGrupo = `Grupo Nº${datos.grupo.numero} — ${datos.grupo.nombre}`
  // Siempre lo tiene: se reserva al emitir y un borrador no llega a armarse.
  // El texto de reserva es para el permiso viejo que la migracion no alcanzo,
  // que es preferible a una hoja con un hueco donde va el numero.
  const expediente = numeroDeExpediente(permiso) ?? 'Sin número'
  // El pie de cada hoja: sirve para volver a juntar un permiso que se
  // desarmo sobre un escritorio.
  const propias: PDFPage[] = []
  const hojaNueva = () => {
    const pagina = documento.addPage([ANCHO, ALTO])
    propias.push(pagina)
    return pagina
  }

  let pagina = hojaNueva()
  let y = ALTO - 62

  // ---- Encabezado ----
  texto(pagina, 'GPS', MARGEN, y, negrita, 16)
  texto(pagina, 'Diócesis · Asociación de Scouts Católicos', MARGEN, y - 13, normal, 9, GRIS)
  aLaDerecha(pagina, 'Expediente', ANCHO - MARGEN, y + 3, normal, 9, GRIS)
  aLaDerecha(pagina, expediente, ANCHO - MARGEN, y - 11, negrita, 12)

  y -= 50
  texto(pagina, 'Autorización de salida', MARGEN, y, negrita, 28)
  y -= 22
  texto(
    pagina,
    `${permiso.lugar} · ${cuantos(datos.participantes.length, 'persona')}`,
    MARGEN,
    y,
    negrita,
    13,
  )

  y -= 20
  for (const renglon of envolver(
    'Autoriza la actividad descripta abajo. Tiene validez con las tres firmas. Una copia queda en el libro del grupo y otra se presenta ante la diócesis.',
    CONTENIDO,
    normal,
    9.5,
  )) {
    texto(pagina, renglon, MARGEN, y, normal, 9.5, GRIS)
    y -= 13
  }

  // ---- Datos de la salida ----
  y -= 10
  texto(pagina, 'Datos de la salida', MARGEN, y, normal, 9, GRIS)
  y -= 16
  for (const [etiqueta, valor] of [
    ['Grupo', elGrupo],
    ['Destino', permiso.lugar],
    ['Dirección', `${permiso.direccion}, ${permiso.localidad}, ${permiso.provincia}`],
    ['Unidades', datos.unidades.join(', ') || '—'],
    ['Salida', enDiaMesAnio(permiso.desde)],
    ['Regreso', enDiaMesAnio(permiso.hasta)],
    ['Medio de transporte', permiso.comoSeViaja ?? '—'],
  ] as const) {
    texto(pagina, etiqueta, MARGEN, y, normal, 9.5, GRIS)
    texto(pagina, recortar(valor, CONTENIDO - 150, negrita, 9.5), MARGEN + 150, y, negrita, 9.5)
    raya(pagina, y - 6, MARGEN, ANCHO - MARGEN)
    y -= 18
  }

  // ---- Composicion y totales, en dos columnas ----
  y -= 8
  const columnaDerecha = MARGEN + CONTENIDO / 2 + 10
  const anchoDeMedia = CONTENIDO / 2 - 10
  texto(pagina, 'Composición del contingente', MARGEN, y, normal, 9, GRIS)
  texto(pagina, 'Quiénes van', columnaDerecha, y, normal, 9, GRIS)

  const dirigentes = datos.participantes.filter((uno) => uno.marca === 'dirigente').length
  const filasIzquierda = composicion(datos.participantes).map(
    (una) => [una.unidad, String(una.cuantos)] as const,
  )
  const filasDerecha = [
    ['Dirigentes', String(dirigentes)],
    ['Beneficiarios', String(datos.participantes.length - dirigentes)],
  ] as const

  let alto = 0
  for (const [x, filas] of [
    [MARGEN, filasIzquierda],
    [columnaDerecha, filasDerecha],
  ] as const) {
    let fila = y - 16
    for (const [etiqueta, numero] of filas) {
      texto(pagina, recortar(etiqueta, anchoDeMedia - 30, normal, 9.5), x, fila, normal, 9.5)
      aLaDerecha(pagina, numero, x + anchoDeMedia, fila, negrita, 9.5)
      raya(pagina, fila - 5, x, x + anchoDeMedia)
      fila -= 15
    }
    texto(pagina, 'Total', x, fila, negrita, 9.5)
    aLaDerecha(pagina, String(datos.participantes.length), x + anchoDeMedia, fila, negrita, 9.5)
    alto = Math.max(alto, y - fila)
  }
  y -= alto + 24

  // ---- Responsable de la actividad ----
  // En su propio recuadro gris y no como un renglon mas de los datos: durante
  // la salida es el unico dato que alguien busca con apuro.
  if (datos.responsable) {
    const alto = 46
    pagina.drawRectangle({ x: MARGEN, y: y - alto, width: CONTENIDO, height: alto, color: BANDA })
    texto(pagina, 'Responsable de la actividad', MARGEN + 14, y - 16, normal, 9, GRIS)
    for (const [indice, [etiqueta, valor]] of (
      [
        ['A cargo', `${datos.responsable.apellidos}, ${datos.responsable.nombres}`],
        [
          'Documento',
          `${datos.responsable.tipoDeDocumento.toUpperCase()} ${datos.responsable.numeroDeDocumento}`,
        ],
        ['Teléfono', permiso.telefono],
      ] as const
    ).entries()) {
      const x = MARGEN + 14 + indice * ((CONTENIDO - 28) / 3)
      texto(pagina, etiqueta, x, y - 30, normal, 8, GRIS)
      texto(pagina, recortar(valor, (CONTENIDO - 28) / 3 - 12, negrita, 10), x, y - 42, negrita, 10)
    }
    y -= alto + 16
  }

  // ---- Declaracion ----
  for (const renglon of envolver(
    'Quienes firman declaran que las personas de la nómina adjunta pertenecen al grupo, que cuentan con autorización de sus padres o tutores cuando corresponde, y que la actividad se realiza conforme a las normas de seguridad de la asociación.',
    CONTENIDO,
    normal,
    9,
  )) {
    texto(pagina, renglon, MARGEN, y, normal, 9, GRIS)
    y -= 12
  }

  // ---- Firmas ----
  // Al pie de la hoja y con lugar garantizado: si no entran, van en una hoja
  // nueva. Es lo que impide que un contingente grande las empuje fuera del
  // papel, y lo que deja el bloque siempre en el mismo lugar del A4 -que es
  // donde la mano lo busca para firmar-.
  const alPie = MARGEN + 12 + 132 + 14
  y -= 12
  if (y < alPie) {
    pagina = hojaNueva()
    y = ALTO - 62
  }
  y = alPie
  if (datos.alterado) {
    texto(
      pagina,
      'ATENCIÓN: el contenido no coincide con el que se emitió y firmó. Verificar en GPS.',
      MARGEN,
      y + 18,
      negrita,
      9,
    )
  }
  texto(pagina, 'Firmas', MARGEN, y, normal, 9, GRIS)
  y -= 14
  dibujarFirmas(pagina, datos.firmas, y, normal, negrita)

  // ---- Anexo con la nomina ----
  const nomina = seccionesDeParticipantes(datos.participantes)
  if (nomina.length > 0) {
    pagina = hojaNueva()
    y = ALTO - 62
    texto(pagina, `Anexo · ${expediente}`, MARGEN, y, normal, 9, GRIS)
    texto(
      pagina,
      `Nómina · ${cuantos(datos.participantes.length, 'persona')}`,
      MARGEN,
      y - 22,
      negrita,
      20,
    )
    aLaDerecha(pagina, recortar(permiso.lugar, 220, normal, 9), ANCHO - MARGEN, y, normal, 9, GRIS)
    aLaDerecha(
      pagina,
      `${enDiaMesAnio(permiso.desde)} al ${enDiaMesAnio(permiso.hasta)}`,
      ANCHO - MARGEN,
      y - 13,
      normal,
      9,
      GRIS,
    )
    y -= 48

    let numero = 1
    for (const seccion of nomina) {
      for (const [indice, tanda] of tandas(seccion.filas, y).entries()) {
        if (indice > 0) {
          pagina = hojaNueva()
          y = ALTO - 62
        }
        // El titulo se repite en cada hoja que continua la seccion: una tabla
        // partida sin el no se puede leer sin volver atras.
        texto(pagina, seccion.titulo, MARGEN, y, negrita, 12)
        texto(
          pagina,
          `${seccion.filas.length}${indice > 0 ? ' · continúa' : ''}`,
          MARGEN + negrita.widthOfTextAtSize(seccion.titulo, 12) + 8,
          y,
          normal,
          9,
          GRIS,
        )
        y -= 16
        y = dibujarTanda(pagina, tanda, y, numero, normal, negrita)
        numero += tanda.length
        y -= 18
      }
    }
  }

  // Los escaneos como paginas anexas: son la prueba de lo que se firmo en papel
  // ese dia, no el documento.
  for (const escaneo of datos.escaneos) {
    await anexar(documento, escaneo, negrita)
  }

  for (const [indice, hoja] of propias.entries()) {
    // Solo el expediente a la izquierda: el grupo ya esta arriba, y la huella
    // del medio necesita el ancho -de las tres cosas del pie, es la larga-.
    texto(hoja, expediente, MARGEN, MARGEN - 14, normal, 8, TENUE)
    // La huella centrada, como el numero de hoja: se lee poco y se compara
    // cuando hace falta.
    texto(
      hoja,
      datos.huella,
      (ANCHO - normal.widthOfTextAtSize(datos.huella, 7)) / 2,
      MARGEN - 14,
      normal,
      7,
      TENUE,
    )
    aLaDerecha(
      hoja,
      `${indice + 1} de ${propias.length}`,
      ANCHO - MARGEN,
      MARGEN - 14,
      normal,
      8,
      TENUE,
    )
  }

  return await documento.save()
}

/** Las tres tarjetas de firma, una al lado de la otra. Vacias son el renglon
 *  para firmar a mano el papel impreso; firmadas en la app llevan el dibujo. */
function dibujarFirmas(
  pagina: PDFPage,
  lineas: readonly LineaDeFirma[],
  y: number,
  normal: PDFFont,
  negrita: PDFFont,
) {
  const alto = 132
  const ancho = (CONTENIDO - 24) / Math.max(lineas.length, 1)

  for (const [indice, linea] of lineas.entries()) {
    const x = MARGEN + indice * (ancho + 12)
    const base = y - alto
    pagina.drawRectangle({
      x,
      y: base,
      width: ancho,
      height: alto,
      borderColor: BORDE,
      borderWidth: 0.7,
    })
    // La banda gris del pie, con el nombre: es lo que se lee cuando el papel
    // pasa de mano en mano.
    pagina.drawRectangle({ x, y: base, width: ancho, height: 38, color: BANDA })

    texto(pagina, linea.cargo, x + 10, y - 16, normal, 8.5, GRIS)
    texto(pagina, recortar(linea.nombre, ancho - 20, negrita, 9.5), x + 10, base + 22, negrita, 9.5)

    const firma = linea.firma
    if (firma?.modo === 'app' && firma.trazos !== null) {
      dibujarTrazos(pagina, firma.trazos, x + 12, base + 56, ancho - 24)
      texto(
        pagina,
        `Firmado en GPS · ${enDiaMesAnio(firma.fecha)}`,
        x + 10,
        base + 46,
        normal,
        7,
        TENUE,
      )
      texto(pagina, 'Firma registrada', x + 10, base + 9, normal, 8, GRIS)
    } else if (firma?.modo === 'papel') {
      // No se recorta el dibujo del escaneo para estamparlo aca: pide detectar
      // donde esta la firma y se rompe con cualquier foto torcida.
      texto(pagina, 'Firmado en papel', x + 10, y - 40, negrita, 9.5)
      texto(pagina, `ver anexo · ${enDiaMesAnio(firma.fecha)}`, x + 10, base + 46, normal, 7, TENUE)
      texto(pagina, 'Firma registrada', x + 10, base + 9, normal, 8, GRIS)
    } else {
      texto(pagina, 'Firma y aclaración · ___/___/______', x + 10, base + 9, normal, 7.5, GRIS)
    }
  }
}

/** Cuantas filas entran en una hoja que empieza en `y`, contando que van en dos
 *  columnas: la nomina se lee mejor angosta y en dos que ancha y en una. */
function tandas(
  filas: readonly (readonly string[])[],
  y: number,
): readonly (readonly (readonly string[])[])[] {
  const primera = Math.max(2, Math.floor((y - MARGEN - 16 - ALTO_DE_ENCABEZADO) / ALTO_DE_FILA) * 2)
  const resto = Math.floor((ALTO - 62 - MARGEN - 16 - ALTO_DE_ENCABEZADO) / ALTO_DE_FILA) * 2
  const partes: (readonly string[])[][] = []
  let pendientes = [...filas]
  while (pendientes.length > 0) {
    const cuantas = partes.length === 0 ? primera : resto
    partes.push(pendientes.slice(0, cuantas))
    pendientes = pendientes.slice(cuantas)
  }
  return partes
}

/** Una tanda de filas, repartida en dos columnas de igual largo. Devuelve donde
 *  sigue el texto. */
function dibujarTanda(
  pagina: PDFPage,
  filas: readonly (readonly string[])[],
  y: number,
  desde: number,
  normal: PDFFont,
  negrita: PDFFont,
): number {
  const mitad = Math.ceil(filas.length / 2)
  const columnas = [filas.slice(0, mitad), filas.slice(mitad)].filter((una) => una.length > 0)
  let fondo = y

  for (const [indice, columna] of columnas.entries()) {
    const x = MARGEN + indice * (ANCHO_DE_COLUMNA + 18)
    let fila = y
    let celda = x
    for (const { titulo, ancho } of CELDAS) {
      texto(pagina, titulo, celda, fila, normal, 7.5, GRIS)
      celda += ancho
    }
    raya(pagina, fila - 4, x, x + ANCHO_DE_COLUMNA, BORDE)
    fila -= ALTO_DE_ENCABEZADO

    for (const [orden, valores] of columna.entries()) {
      const contenidos = [String(desde + indice * mitad + orden), ...valores]
      celda = x
      for (const [posicion, { ancho }] of CELDAS.entries()) {
        const contenido = contenidos[posicion] ?? ''
        const fuente = posicion === 1 ? negrita : normal
        const color = posicion === 0 ? TENUE : posicion === 3 ? GRIS : NEGRO
        texto(pagina, recortar(contenido, ancho - 6, fuente, 8), celda, fila, fuente, 8, color)
        celda += ancho
      }
      raya(pagina, fila - 3.5, x, x + ANCHO_DE_COLUMNA)
      fila -= ALTO_DE_FILA
    }
    fondo = Math.min(fondo, fila)
  }
  return fondo
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
  const titulo = `ANEXO — firmado en papel por ${escaneo.cargo}`

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

/** Los trazos normalizados, escalados al recuadro de la tarjeta de firma. */
function dibujarTrazos(pagina: PDFPage, serializados: string, x: number, y: number, ancho: number) {
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
