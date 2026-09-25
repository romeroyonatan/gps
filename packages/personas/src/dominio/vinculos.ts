import type { Marcas } from '@gps/core'
import { aFechaDeCalendario, esFechaDeCalendario } from '@gps/core/fechas'
import type { TipoDeCargo } from './cargos'
import type { Categoria } from './categorias'
import type { IntegranteDeEquipo, TipoDeEquipo } from './equipos'
import type { Persona } from './modelos'
import type { Problema } from './validaciones'

/** La pertenencia de una persona a un grupo. Es un hecho propio y continuo, con
 *  alta y baja en cualquier momento: no se deriva de la afiliacion, que es
 *  anual (spec base §13.6). */
export interface Pertenencia extends Marcas {
  readonly id: string
  readonly personaId: string
  readonly grupoId: string
  readonly categoria: Categoria
  /** La unidad del grupo a la que pertenece: una de las dos tropas, la manada.
   *  null si y solo si la categoria es adherente: el adherente es el que no
   *  esta en ninguna unidad, y es justo lo que lo define.
   *
   *  La rama no se guarda: sale de la unidad, que ya la tiene. */
  readonly unidadId: string | null
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

/** Un cargo de una persona, con su ambito y su periodo. */
export interface Cargo extends Marcas {
  readonly id: string
  readonly personaId: string
  /** La entidad del ambito del cargo: el grupo, el distrito, o null para los de
   *  la diocesis, que no es una entidad. Cual de los tres lo dice
   *  `ambitoDelCargo(cargo)`, no una columna.
   *
   *  Es propio y no derivado de la pertenencia vigente: con historial, quien se
   *  muda tiene dos pertenencias y el cargo pertenece a una de las dos. Sin esta
   *  columna, cerrar una pertenencia cambiaria retroactivamente el ambito de
   *  todos sus cargos. */
  readonly ambitoId: string | null
  readonly cargo: TipoDeCargo
  readonly desde: string
  /** aaaa-mm-dd, null si no tiene fin previsto. A diferencia del de una
   *  Pertenencia, este puede estar en el futuro: un mandato dura cuatro anios y
   *  su fin se conoce el dia que empieza. */
  readonly hasta: string | null
  /** Remocion efectiva inmediata. El periodo se conserva como historia, pero
   *  un cargo revocado ya no concede acceso ni permite firmar. */
  readonly revocadoEn: Date | null
}

/** Una persona con sus vinculos vigentes: lo que devuelve el servicio y lo que
 *  consume la pantalla del grupo. */
export interface PersonaConVinculos extends Persona {
  readonly pertenencia: Pertenencia
  readonly cargos: readonly Cargo[]
  /** Los equipos que integra hoy. Van acá y no en una consulta aparte porque
   *  el plantel es exactamente esto: quién está, con qué cargo y en qué
   *  equipo. Secretaría no es un cargo, y sin esto no se vería.
   *
   *  Cada uno viaja con su `tipo`: sin él la pantalla no puede distinguir la
   *  Secretaría del grupo de un equipo diocesano, y las dibuja iguales. */
  readonly equipos: readonly (IntegranteDeEquipo & { readonly tipo: TipoDeEquipo })[]
}

/** Lo propio de un cargo en el alta. No lleva `desde`: el del cargo es el de la
 *  pertenencia, asi el formulario no pide la misma fecha cinco veces. */
export type DatosDeCargo = Omit<
  Cargo,
  'id' | 'personaId' | 'ambitoId' | 'desde' | 'revocadoEn' | keyof Marcas
>

/** Lo que entra por el alta ademas de los datos personales. Derivado de
 *  Pertenencia por la misma razon que DatosDePersona sale de Persona: agregar un
 *  campo mas adelante no se olvida en la mitad de los lugares. */
export interface DatosDeIngreso
  extends Omit<Pertenencia, 'id' | 'personaId' | 'hasta' | keyof Marcas> {
  readonly cargos: readonly DatosDeCargo[]
}

/** Si la persona puede cambiar de unidad por la pantalla de cambio de rama.
 *
 *  Solo los activos: el pase de un beneficiario de una rama a la siguiente es
 *  una ceremonia, y va a tener su propia pantalla. Un adherente no esta en
 *  ninguna unidad, que es justo lo que lo define.
 *
 *  Toma lo minimo de la pertenencia y no la Pertenencia entera para que sirva
 *  sobre lo que devuelve una query de GraphQL. */
export function puedeCambiarDeUnidad(pertenencia: Pick<Pertenencia, 'categoria'>): boolean {
  return pertenencia.categoria === 'activo'
}

/** Las reglas de la fecha con que se abre una pertenencia nueva cerrando la
 *  anterior. Las comparten el cambio de unidad de un dirigente y el pase de un
 *  beneficiario, que son la misma escritura con distinta decision arriba.
 *
 *  Tiene que ser posterior al `desde` de la vigente -si no, la que se cierra
 *  naceria terminada- y no futura, porque el indice parcial de la tabla se
 *  apoya en que `hasta IS NULL` y "vigente" sean lo mismo. */
export function problemasDeLaFechaDelCambio(
  fecha: string,
  desdeDeLaVigente: string,
  hoy: Date,
): readonly Problema[] {
  if (!esFechaDeCalendario(fecha)) {
    return [
      {
        campo: 'desde',
        mensaje: 'La fecha del cambio tiene que ser una fecha real, con formato aaaa-mm-dd.',
      },
    ]
  }
  if (fecha > aFechaDeCalendario(hoy)) {
    return [{ campo: 'desde', mensaje: 'La fecha del cambio no puede ser futura.' }]
  }
  if (fecha <= desdeDeLaVigente) {
    return [
      {
        campo: 'desde',
        mensaje: `El cambio tiene que ser posterior al ${desdeDeLaVigente}, que es desde cuándo está en la unidad actual.`,
      },
    ]
  }
  return []
}

/** Las reglas del cambio de unidad de un dirigente, con la misma forma que
 *  `validarIngreso`: pura, con las unidades abiertas y el `hoy` por parametro,
 *  y corriendo en los dos lados. Las de la fecha estan en
 *  `problemasDeLaFechaDelCambio`, que comparte con el pase. */
export function validarCambioDeUnidad(
  pertenencia: Pick<Pertenencia, 'categoria' | 'unidadId' | 'desde'>,
  unidadId: string,
  desde: string,
  unidadesAbiertas: readonly { id: string }[],
  hoy: Date,
): readonly Problema[] {
  const problemas: Problema[] = []

  if (!puedeCambiarDeUnidad(pertenencia)) {
    problemas.push({
      campo: 'unidad',
      mensaje: 'Sólo los dirigentes cambian de unidad por acá.',
    })
  } else if (pertenencia.unidadId === unidadId) {
    problemas.push({ campo: 'unidad', mensaje: 'Ya está en esa unidad.' })
  } else if (!unidadesAbiertas.some((unidad) => unidad.id === unidadId)) {
    problemas.push({ campo: 'unidad', mensaje: 'El grupo no tiene abierta esa unidad.' })
  }

  problemas.push(...problemasDeLaFechaDelCambio(desde, pertenencia.desde, hoy))

  return problemas
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

/** Para autorizacion importa tambien una remocion ocurrida dentro del dia. */
export function estaVigenteParaAcceso(
  vinculo: { desde: string; hasta: string | null; revocadoEn: Date | null },
  hoy: Date,
): boolean {
  return vinculo.revocadoEn === null && estaVigente(vinculo, hoy)
}

/** Quién conduce un grupo, para el directorio de la asociación. Es lo mínimo
 *  para nombrarlo: sin documento, sin fecha de nacimiento, sin pertenencia. */
export interface JefeDeGrupo {
  readonly grupoId: string
  readonly personaId: string
  readonly nombres: string
  readonly apellidos: string
}
