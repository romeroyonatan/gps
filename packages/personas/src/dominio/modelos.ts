import type { Marcas } from '@gps/core'
import type { TipoDeDocumento } from './documentos'

/** Una persona de la asociacion. Por ahora solo los datos personales: la
 *  pertenencia a un grupo y los cargos llegan con la iteracion que los tenga
 *  que mostrar, y viven en estructura, que es la jerarquia que se llena. */
export interface Persona extends Marcas {
  readonly id: string
  readonly tipoDeDocumento: TipoDeDocumento
  readonly numeroDeDocumento: string
  /** En plural y como texto libre: una persona tiene los que tiene. Van en dos
   *  campos y no en uno porque el listado ordena por apellido, y partir un
   *  nombre completo con heuristicas falla con "de la Vega" y "Van Der Berg". */
  readonly nombres: string
  readonly apellidos: string
  /** ISO 8601 sin hora: "2010-05-01".
   *
   *  Texto y no Date a proposito. Una fecha de nacimiento no tiene hora, y
   *  guardarla como instante la ata a una zona horaria: quien nacio el 1 de
   *  mayo aparece como 30 de abril en UTC-3. Como texto el problema no existe,
   *  se ordena igual lexicografica que cronologicamente, y es exactamente lo
   *  que emite y espera un <input type="date">. */
  readonly fechaDeNacimiento: string
}

/** Lo que entra por el alta: la Persona sin lo que pone el servidor. Derivarlo
 *  de Persona en vez de escribirlo aparte es lo que hace que agregar un campo en
 *  la iteracion que viene no se olvide en la mitad de los lugares. */
export type DatosDePersona = Omit<Persona, 'id' | keyof Marcas>

/** Como la pantalla arma el nombre para una lista. Toma lo minimo y no una
 *  Persona entera para que sirva sobre lo que devuelve una query de GraphQL, que
 *  trae solo los campos que se pidieron. */
export function nombreCompleto(persona: Pick<Persona, 'nombres' | 'apellidos'>): string {
  return `${persona.apellidos}, ${persona.nombres}`
}

/** Los anios cumplidos al dia `hoy`.
 *
 *  `hoy` entra por parametro y no se lee del sistema: es la regla de
 *  portabilidad, y ademas permite que los tests afirmen sobre bordes exactos -el
 *  dia del cumpleanios, la vispera- en vez de sobre rangos.
 *
 *  Toma la fecha y no la persona para que el formulario pueda mostrar la edad
 *  mientras se tipea, cuando todavia no hay ninguna Persona creada.
 *
 *  Se compara contra los componentes locales de `hoy` porque la fecha de
 *  nacimiento es una fecha de calendario: el cumpleanios es hoy segun el
 *  almanaque de quien mira, no segun UTC. */
export function calcularEdad(fechaDeNacimiento: string, hoy: Date): number {
  const [anio = 0, mes = 0, dia = 0] = fechaDeNacimiento.split('-').map(Number)
  const mesDeHoy = hoy.getMonth() + 1
  const yaCumplio = mesDeHoy > mes || (mesDeHoy === mes && hoy.getDate() >= dia)
  return hoy.getFullYear() - anio - (yaCumplio ? 0 : 1)
}
