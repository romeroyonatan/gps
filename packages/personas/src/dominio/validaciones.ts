import { aFechaDeCalendario, esFechaDeCalendario } from '@gps/core/fechas'
import type { Unidad } from '@gps/estructura/dominio'
import { ambitoDelCargo, nombreDelCargo, type TipoDeCargo } from './cargos'
import { normalizarNumero } from './documentos'
import { calcularEdad, type DatosDePersona } from './modelos'
import type { DatosDeIngreso } from './vinculos'

/** Un problema de validacion, atado a su campo. Por campo y no una lista de
 *  strings sueltos porque el formulario tiene que marcar el input que falla: un
 *  cartel generico arriba obliga a leer y adivinar cual era.
 *
 *  Ni tipoDeDocumento ni categoria estan en la union: no pueden fallar, lo
 *  garantizan sus tipos del lado de TypeScript y sus enums del lado de GraphQL. */
export interface Problema {
  readonly campo:
    | 'numeroDeDocumento'
    | 'nombres'
    | 'apellidos'
    | 'fechaDeNacimiento'
    | 'domicilio'
    | 'telefonoDeContacto'
    | 'unidad'
    | 'desde'
    | 'cargos'
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
  if (!datos.domicilio.trim()) {
    problemas.push({ campo: 'domicilio', mensaje: 'El domicilio no puede estar vacío.' })
  }
  if (!datos.telefonoDeContacto.trim()) {
    problemas.push({
      campo: 'telefonoDeContacto',
      mensaje: 'El teléfono de contacto no puede estar vacío.',
    })
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

/** Las reglas que tiene que cumplir el ingreso de una persona a un grupo.
 *  Devuelve la lista de problemas, vacia si esta todo bien. Acumula: no corta
 *  en el primero.
 *
 *  `unidadesAbiertas` entra por parametro y no se consulta: del lado del
 *  servidor sale de estructura.obtenerGrupo(grupoId), y del lado del formulario
 *  del arbol que la pantalla ya tiene. Es lo que hace que la regla corra en los
 *  dos lados con una sola implementacion, igual que validarPersona.
 *
 *  Que la unidad este en esa lista es a la vez "existe", "esta abierta" y "es
 *  de este grupo": las tres salen de que obtenerGrupo devuelve solo las
 *  abiertas del grupo, asi que no hacen falta tres reglas.
 *
 *  Lo que no valida, a proposito, es si la persona "corresponde" a esa unidad:
 *  a quien se pone en la tropa femenina y a quien en la masculina lo deciden
 *  los dirigentes, y Persona ni siquiera guarda sexo. */
export function validarIngreso(
  ingreso: DatosDeIngreso,
  unidadesAbiertas: readonly Pick<Unidad, 'id'>[],
  hoy: Date,
): readonly Problema[] {
  const problemas: Problema[] = []
  const esAdherente = ingreso.categoria === 'adherente'

  if (esAdherente && ingreso.unidadId !== null) {
    problemas.push({
      campo: 'unidad',
      mensaje: 'Un adherente no pertenece a ninguna unidad.',
    })
  } else if (!esAdherente && ingreso.unidadId === null) {
    problemas.push({ campo: 'unidad', mensaje: 'Elegí la unidad a la que pertenece.' })
  } else if (
    ingreso.unidadId !== null &&
    !unidadesAbiertas.some((unidad) => unidad.id === ingreso.unidadId)
  ) {
    problemas.push({ campo: 'unidad', mensaje: 'El grupo no tiene abierta esa unidad.' })
  }

  if (!esFechaDeCalendario(ingreso.desde)) {
    problemas.push({
      campo: 'desde',
      mensaje: 'La fecha de ingreso tiene que ser una fecha real, con formato aaaa-mm-dd.',
    })
  } else if (ingreso.desde > aFechaDeCalendario(hoy)) {
    problemas.push({ campo: 'desde', mensaje: 'La fecha de ingreso no puede ser futura.' })
  }

  const vistos = new Set<TipoDeCargo>()
  for (const cargo of ingreso.cargos) {
    const nombre = nombreDelCargo(cargo.cargo)
    // El alta carga cargos del grupo al que ingresa: son los unicos cuyo ambito
    // es ese grupo. Uno de distrito o de diocesis se guardaria con el grupo
    // como ambito, que es un cargo que no existe.
    if (ambitoDelCargo(cargo.cargo) !== 'grupo') {
      problemas.push({ campo: 'cargos', mensaje: `${nombre} no es un cargo del grupo.` })
    }
    if (vistos.has(cargo.cargo)) {
      problemas.push({ campo: 'cargos', mensaje: `${nombre} está cargado dos veces.` })
    }
    vistos.add(cargo.cargo)

    if (cargo.hasta === null) continue
    if (!esFechaDeCalendario(cargo.hasta)) {
      problemas.push({
        campo: 'cargos',
        mensaje: `La fecha de fin de ${nombre} tiene que ser una fecha real, con formato aaaa-mm-dd.`,
      })
    } else if (cargo.hasta <= ingreso.desde) {
      // No se exige que este en el futuro: cargar un mandato ya vencido es
      // valido, es historial.
      problemas.push({ campo: 'cargos', mensaje: `${nombre} no puede terminar antes de empezar.` })
    }
  }

  return problemas
}
