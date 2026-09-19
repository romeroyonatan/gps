/** Lo que se puede subir.
 *
 *  `archivos` no sabe para que sirve cada uno: eso lo sabe el modulo dueño, y
 *  es el que restringe mas cuando le hace falta. El escaneo de un permiso
 *  firmado tiene que poder anexarse al PDF, asi que salidas exige imagen o PDF;
 *  una planificacion no se anexa a nada y puede ser el .docx que el jefe de
 *  rama ya tenia escrito.
 *
 *  La lista sigue siendo cerrada. Lo que no esta no entra, y sumar algo es una
 *  decision: todo lo que se guarda despues se sirve, y servir cualquier cosa es
 *  como se regala un XSS -por eso no hay text/html ni svg-. */
export const TIPOS_ADMITIDOS = [
  'image/jpeg',
  'image/png',
  // Lo que sale de un iPhone. No se guardan asi: se convierten a JPEG al
  // confirmar, porque pdf-lib no los sabe leer.
  'image/heic',
  'image/heif',
  'application/pdf',
  // Lo que la gente ya tiene escrito: planificaciones, listas de materiales,
  // presupuestos.
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // Las de LibreOffice, que es lo que hay en media parroquia.
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
] as const

export type TipoAdmitido = (typeof TIPOS_ADMITIDOS)[number]

/** Los que se pueden mostrar adentro de un PDF: el escaneo de un papel firmado
 *  se anexa como pagina, asi que tiene que ser imagen o PDF. Un .docx no. */
export const TIPOS_QUE_SE_PUEDEN_ANEXAR: readonly TipoAdmitido[] = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'application/pdf',
]

export function sePuedeAnexar(tipo: string): boolean {
  return (TIPOS_QUE_SE_PUEDEN_ANEXAR as readonly string[]).includes(tipo)
}

/** Veinticinco megas. Alcanza para una foto de 12 MP o un PDF escaneado de
 *  varias paginas, y es bastante menos de lo que tarda en subirse con la señal
 *  de un campamento. */
export const TAMANO_MAXIMO = 25 * 1024 * 1024

export function esTipoAdmitido(tipo: string): tipo is TipoAdmitido {
  return (TIPOS_ADMITIDOS as readonly string[]).includes(tipo)
}

/** Si el tipo se guarda tal cual o se convierte a JPEG primero. */
export function necesitaConversion(tipo: TipoAdmitido): boolean {
  return tipo === 'image/heic' || tipo === 'image/heif'
}
