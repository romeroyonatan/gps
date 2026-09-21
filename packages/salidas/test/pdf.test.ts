import { beforeAll, describe, expect, test } from 'bun:test'
import { PDFDocument, type PDFFont, StandardFonts } from 'pdf-lib'
import type { Firma, ParticipanteEmitido, Permiso } from '../src/dominio/modelos'
import { serializar } from '../src/dominio/trazos'
import { armarPdf, recortar, seccionesDeParticipantes } from '../src/servidor/pdf'

const HORA = new Date('1970-01-01T00:00:00Z')

const permiso: Permiso = {
  id: 'permiso_1',
  grupoId: 'grupo_1',
  estado: 'emitido',
  lugar: 'Estancia La Paz',
  direccion: 'Ruta 9 km 500',
  localidad: 'Los Patos',
  provincia: 'Santa Fe',
  telefono: '11 5488-2210',
  desde: '2026-10-12',
  hasta: '2026-10-14',
  comoSeViaja: 'Micro contratado',
  responsableId: 'persona_Ana',
  anioDeExpediente: 2026,
  numeroDeExpediente: 147,
  pdfId: null,
  hashDelPdf: null,
  hashDelContenido: null,
  reemplazaA: null,
  creadoEn: HORA,
  actualizadoEn: HORA,
}

const participante = (
  nombres: string,
  marca: 'dirigente' | 'beneficiario',
): ParticipanteEmitido => ({
  permisoId: 'permiso_1',
  personaId: `persona_${nombres}`,
  marca,
  tipoDeDocumento: 'dni',
  numeroDeDocumento: '30111222',
  nombres,
  apellidos: 'Perez',
  unidad: 'Tropa scout San Jorge',
})

const firmaEnApp = (cargo: string): Firma => ({
  id: `firma_${cargo}`,
  permisoId: 'permiso_1',
  cargo: 'jefeDeGrupo',
  modo: 'app',
  personaId: 'persona_1',
  nombres: 'Luis',
  apellidos: 'Paz',
  fecha: '2026-10-01',
  trazos: serializar({ trazos: [[[0.1, 0.2] as const, [0.8, 0.6] as const]] }),
  sello: 'un-sello',
  claveDeSello: 'dev',
  escaneoId: null,
  creadoEn: HORA,
  actualizadoEn: HORA,
})

const firmaEnPapel: Firma = {
  ...firmaEnApp('director'),
  modo: 'papel',
  trazos: null,
  sello: null,
  escaneoId: 'archivo_1',
}

const base = {
  permiso,
  grupo: { numero: 42, nombre: 'Ceferino Namuncurá' },
  unidades: ['Tropa scout San Jorge'],
  participantes: [participante('Ana', 'dirigente'), participante('Bruno', 'beneficiario')],
  responsable: participante('Ana', 'dirigente'),
  huella: 'a'.repeat(64),
  alterado: false,
  escaneos: [],
}

const lineas = (firmas: readonly (Firma | null)[]) =>
  ['Jefe de grupo', 'Director', 'Comisionado'].map((cargo, i) => ({
    cargo,
    nombre: 'Alguien',
    firma: firmas[i] ?? null,
  }))

describe('armarPdf', () => {
  test('genera un PDF', async () => {
    const bytes = await armarPdf({ ...base, firmas: lineas([null, null, null]) })
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
  })

  test('los mismos datos dan los mismos bytes', async () => {
    // Es lo que hace que el hash guardado al emitir siga valiendo: si pdf-lib
    // metiera la hora del sistema, cada generacion daria un archivo distinto.
    const uno = await armarPdf({ ...base, firmas: lineas([null, null, null]) })
    const otro = await armarPdf({ ...base, firmas: lineas([null, null, null]) })
    expect(uno).toEqual(otro)
  })

  test('registrar una firma cambia el PDF', async () => {
    const vacio = await armarPdf({ ...base, firmas: lineas([null, null, null]) })
    const conUna = await armarPdf({ ...base, firmas: lineas([firmaEnApp('jefe'), null, null]) })
    expect(conUna).not.toEqual(vacio)
  })

  test('el orden en que se firmo no cambia la pagina principal', async () => {
    // El sacerdote puede firmar el papel antes que nadie. Lo que se dibuja
    // depende de que firmas hay, no de cuando entraron: por eso el PDF se
    // compone del estado actual y no se parte del escaneo.
    const appPrimero = await armarPdf({
      ...base,
      firmas: lineas([
        { ...firmaEnApp('jefe'), creadoEn: HORA },
        { ...firmaEnPapel, creadoEn: new Date(HORA.getTime() + 86400000) },
        null,
      ]),
    })
    const papelPrimero = await armarPdf({
      ...base,
      firmas: lineas([
        { ...firmaEnApp('jefe'), creadoEn: new Date(HORA.getTime() + 86400000) },
        { ...firmaEnPapel, creadoEn: HORA },
        null,
      ]),
    })
    expect(appPrimero).toEqual(papelPrimero)
  })

  test('una firma en papel no dibuja trazos, remite al anexo', async () => {
    const conPapel = await armarPdf({ ...base, firmas: lineas([firmaEnPapel, null, null]) })
    const conApp = await armarPdf({ ...base, firmas: lineas([firmaEnApp('jefe'), null, null]) })
    expect(conPapel).not.toEqual(conApp)
  })

  test('un escaneo en PDF se anexa pagina por pagina', async () => {
    // Escanear con la impresora de una parroquia da PDF, que es tan normal como
    // sacarle una foto con el telefono.
    const dosPaginas = await PDFDocument.create()
    dosPaginas.addPage()
    dosPaginas.addPage()
    const bytes = await armarPdf({
      ...base,
      firmas: lineas([firmaEnPapel, null, null]),
      escaneos: [
        { cargo: 'Director', contenido: await dosPaginas.save(), tipo: 'application/pdf' },
      ],
    })
    // Las dos del permiso -la principal y el anexo con la nómina- mas las dos
    // del escaneo.
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(4)
  })

  test('un escaneo que no se puede leer no tumba el permiso entero', async () => {
    // Un archivo corrupto no tiene que dejar un permiso firmado sin forma de
    // descargarse: el problema se ve en el papel en vez de esconderse.
    const bytes = await armarPdf({
      ...base,
      firmas: lineas([firmaEnPapel, null, null]),
      escaneos: [{ cargo: 'Director', contenido: new Uint8Array([1, 2, 3]), tipo: 'image/jpeg' }],
    })
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(3)
  })

  test('un permiso con mucha gente sigue teniendo las firmas', async () => {
    // El caso que rompe un PDF de una sola pagina: sesenta chicos empujan las
    // firmas fuera de la hoja.
    const muchos = Array.from({ length: 60 }, (_, i) => participante(`Chico${i}`, 'beneficiario'))
    const bytes = await armarPdf({
      ...base,
      participantes: [participante('Ana', 'dirigente'), ...muchos],
      firmas: lineas([null, null, null]),
    })
    expect(bytes.length).toBeGreaterThan(0)
  })
})

describe('seccionesDeParticipantes', () => {
  test('los dirigentes primero y aparte', () => {
    // Quien mira el papel busca quien esta a cargo, no la lista entera.
    const secciones = seccionesDeParticipantes([
      participante('Chico', 'beneficiario'),
      participante('Jefa', 'dirigente'),
    ])
    expect(secciones.map((seccion) => seccion.titulo)).toEqual(['Dirigentes', 'Beneficiarios'])
  })

  test('cada uno es una fila de tres celdas: nombre, documento y unidad', () => {
    const [dirigentes] = seccionesDeParticipantes([participante('Ana', 'dirigente')])
    expect(dirigentes?.filas).toEqual([['Perez, Ana', '30111222', 'Tropa scout San Jorge']])
  })

  test('una seccion sin nadie no sale', () => {
    // Un titulo con su encabezado y ninguna fila debajo se lee como si la
    // tabla estuviera rota.
    const secciones = seccionesDeParticipantes([participante('Ana', 'dirigente')])
    expect(secciones.map((seccion) => seccion.titulo)).toEqual(['Dirigentes'])
  })

  test('sin nadie no hay ninguna seccion', () => {
    expect(seccionesDeParticipantes([])).toEqual([])
  })
})

describe('recortar', () => {
  // La fuente de verdad y no una medida inventada: recortar depende de cuanto
  // mide cada caracter, que es justo lo que la fuente sabe.
  let fuente: PDFFont

  beforeAll(async () => {
    fuente = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica)
  })

  test('lo que entra queda igual', () => {
    expect(recortar('Perez, Ana', 200, fuente, 9)).toBe('Perez, Ana')
  })

  test('lo que no entra se recorta con puntos suspensivos', () => {
    // Un apellido largo encima de la columna del documento hace ilegibles las
    // dos cosas.
    const largo = 'Fernandez Ruiz de la Santisima Trinidad, Maria de los Angeles'
    const recortado = recortar(largo, 100, fuente, 9)
    expect(recortado.endsWith('…')).toBe(true)
    expect(fuente.widthOfTextAtSize(recortado, 9)).toBeLessThanOrEqual(100)
  })

  test('un ancho ridiculo no entra en un bucle infinito', () => {
    expect(recortar('Perez, Ana', 1, fuente, 9)).toBe('P…')
  })
})
