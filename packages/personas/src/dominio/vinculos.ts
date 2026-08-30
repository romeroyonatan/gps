import type { Marcas } from '@gps/core'
import type { Rama } from '@gps/estructura/dominio'
import type { TipoDeCargo } from './cargos'
import type { Categoria } from './categorias'
import type { Persona } from './modelos'

/** La pertenencia de una persona a un grupo. Es un hecho propio y continuo, con
 *  alta y baja en cualquier momento: no se deriva de la afiliacion, que es
 *  anual (spec base §13.6). */
export interface Pertenencia extends Marcas {
  readonly id: string
  readonly personaId: string
  readonly grupoId: string
  readonly categoria: Categoria
  /** null si y solo si la categoria es adherente: el adherente es el que no
   *  esta en ninguna rama, y es justo lo que lo define. */
  readonly rama: Rama | null
  /** aaaa-mm-dd. Texto y no Date por la misma razon que fechaDeNacimiento: se
   *  ingresa a un grupo un dia del almanaque, no en un instante con zona
   *  horaria. Ver el comentario en modelos.ts. */
  readonly desde: string
  /** aaaa-mm-dd, null si sigue vigente.
   *
   *  Una pertenencia no tiene mandato: el hasta se escribe el dia de la baja y
   *  nunca esta en el futuro. Es la diferencia con Cargo, y es la que hace que
   *  el indice parcial de la tabla pueda decir "una persona, un grupo". */
  readonly hasta: string | null
}

/** Un cargo de una persona en un grupo, con su periodo. */
export interface Cargo extends Marcas {
  readonly id: string
  readonly personaId: string
  /** El grupo del cargo, propio y no derivado de la pertenencia vigente: con
   *  historial, quien se muda tiene dos pertenencias y el cargo pertenece a una
   *  de las dos. Sin esta columna, cerrar una pertenencia cambiaria
   *  retroactivamente el ambito de todos sus cargos. */
  readonly grupoId: string
  readonly cargo: TipoDeCargo
  readonly desde: string
  /** aaaa-mm-dd, null si no tiene fin previsto. A diferencia del de una
   *  Pertenencia, este puede estar en el futuro: un mandato dura cuatro anios y
   *  su fin se conoce el dia que empieza. */
  readonly hasta: string | null
}

/** Una persona con sus vinculos vigentes: lo que devuelve el servicio y lo que
 *  consume la pantalla del grupo. */
export interface PersonaConVinculos extends Persona {
  readonly pertenencia: Pertenencia
  readonly cargos: readonly Cargo[]
}

/** Lo propio de un cargo en el alta. No lleva `desde`: el del cargo es el de la
 *  pertenencia, asi el formulario no pide la misma fecha cinco veces. */
export type DatosDeCargo = Omit<Cargo, 'id' | 'personaId' | 'grupoId' | 'desde' | keyof Marcas>

/** Lo que entra por el alta ademas de los datos personales. Derivado de
 *  Pertenencia por la misma razon que DatosDePersona sale de Persona: agregar un
 *  campo mas adelante no se olvida en la mitad de los lugares. */
export interface DatosDeIngreso
  extends Omit<Pertenencia, 'id' | 'personaId' | 'hasta' | keyof Marcas> {
  readonly cargos: readonly DatosDeCargo[]
}

/** La fecha de calendario de un instante, segun el almanaque de quien lo mira.
 *
 *  Componentes locales y no toISOString por lo mismo que calcularEdad: en UTC-3
 *  el 1 de mayo a las 22:00 seria el 2 de mayo en UTC. */
export function aFechaDeCalendario(instante: Date): string {
  const mes = `${instante.getMonth() + 1}`.padStart(2, '0')
  const dia = `${instante.getDate()}`.padStart(2, '0')
  return `${instante.getFullYear()}-${mes}-${dia}`
}

/** Si el vinculo esta vigente el dia `hoy`, con las dos puntas incluidas.
 *
 *  `hoy` entra por parametro y no se lee del reloj. Ademas de la regla de
 *  portabilidad: el "hoy" correcto es el de quien mira la pantalla, no el del
 *  servidor. Por eso el servidor no filtra por vigencia y manda las filas con
 *  sus fechas, igual que no expone `edad` y la calcula el cliente.
 *
 *  Compara texto contra texto: aaaa-mm-dd ordena igual lexicografica que
 *  cronologicamente, asi que no hay nada que parsear. */
export function estaVigente(vinculo: { desde: string; hasta: string | null }, hoy: Date): boolean {
  const dia = aFechaDeCalendario(hoy)
  return vinculo.desde <= dia && (vinculo.hasta === null || dia <= vinculo.hasta)
}
