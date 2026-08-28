import { normalizarNumero } from './documentos'
import { calcularEdad, type DatosDePersona } from './modelos'

/** Un problema de validacion, atado a su campo. Por campo y no una lista de
 *  strings sueltos porque el formulario tiene que marcar el input que falla: un
 *  cartel generico arriba obliga a leer y adivinar cual de los cuatro era.
 *
 *  tipoDeDocumento no esta en la union porque no puede fallar: lo garantizan el
 *  tipo TipoDeDocumento del lado de TypeScript y el enum del lado de GraphQL. */
export interface Problema {
  readonly campo: 'numeroDeDocumento' | 'nombres' | 'apellidos' | 'fechaDeNacimiento'
  readonly mensaje: string
}

/** Nadie vivo tiene mas. Es un tope contra el dedazo -escribir 1025 en vez de
 *  2025-, no una afirmacion biologica. */
const MAXIMA_EDAD = 120

const FORMATO = {
  dni: { expresion: /^\d{7,8}$/, esperado: 'Un DNI tiene 7 u 8 dígitos.' },
  pasaporte: {
    expresion: /^[A-Z0-9]{5,15}$/,
    esperado: 'Un pasaporte tiene entre 5 y 15 caracteres alfanuméricos.',
  },
} as const

/** Que la cadena sea una fecha real del almanaque, y no solo que tenga la forma.
 *  Sin el ida y vuelta por Date, "2010-02-30" pasaria la expresion regular.
 *
 *  `new Date(...)` con valores explicitos es determinista y no consulta el
 *  reloj, asi que no toca la regla de portabilidad -y este archivo vive en
 *  /dominio, donde ni siquiera aplica el plugin. */
function esFechaDeCalendario(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false
  const [anio = 0, mes = 0, dia = 0] = texto.split('-').map(Number)
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  return (
    fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
  )
}

/** Las reglas que tiene que cumplir el alta de una persona. Devuelve la lista de
 *  problemas, vacia si esta todo bien. Acumula: no corta en el primero.
 *
 *  Es pura y vive en /dominio porque corre en los dos lados. El formulario la
 *  usa antes de enviar, y eso es la experiencia de uso; el servicio la usa antes
 *  de guardar, y eso es la garantia. No hay dos implementaciones que se puedan
 *  desincronizar, que es el pago de que /dominio sea isomorfo.
 *
 *  `hoy` entra por parametro: la funcion no consulta el reloj. */
export function validarPersona(datos: DatosDePersona, hoy: Date): readonly Problema[] {
  const problemas: Problema[] = []

  if (!datos.nombres.trim()) {
    problemas.push({ campo: 'nombres', mensaje: 'Los nombres no pueden estar vacíos.' })
  }
  if (!datos.apellidos.trim()) {
    problemas.push({ campo: 'apellidos', mensaje: 'Los apellidos no pueden estar vacíos.' })
  }

  // Se valida el numero ya normalizado, que es como se va a guardar: si no, un
  // DNI escrito con puntos -como lo escribe todo el mundo- daria invalido.
  const numero = normalizarNumero(datos.numeroDeDocumento)
  const formato = FORMATO[datos.tipoDeDocumento]
  if (!numero) {
    problemas.push({
      campo: 'numeroDeDocumento',
      mensaje: 'El número de documento no puede estar vacío.',
    })
  } else if (!formato.expresion.test(numero)) {
    problemas.push({ campo: 'numeroDeDocumento', mensaje: formato.esperado })
  }

  if (!esFechaDeCalendario(datos.fechaDeNacimiento)) {
    problemas.push({
      campo: 'fechaDeNacimiento',
      mensaje: 'La fecha de nacimiento tiene que ser una fecha real, con formato aaaa-mm-dd.',
    })
  } else {
    const edad = calcularEdad(datos.fechaDeNacimiento, hoy)
    if (edad < 0) {
      problemas.push({
        campo: 'fechaDeNacimiento',
        mensaje: 'La fecha de nacimiento no puede ser futura.',
      })
    } else if (edad > MAXIMA_EDAD) {
      problemas.push({
        campo: 'fechaDeNacimiento',
        mensaje: `La fecha de nacimiento es de hace más de ${MAXIMA_EDAD} años.`,
      })
    }
  }

  return problemas
}
