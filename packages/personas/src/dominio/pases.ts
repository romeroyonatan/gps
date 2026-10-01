import { RAMAS, type Rama, type Unidad } from '@gps/estructura/dominio'
import type { Categoria } from './categorias'
import { calcularEdad } from './modelos'
import type { Problema } from './validaciones'
import { type Pertenencia, problemasDeLaFechaDelCambio } from './vinculos'

/** Lo que de una unidad hace falta para decidir un pase. Un Pick y no la Unidad
 *  entera para que las pantallas puedan pasar lo que les llega de GraphQL, que
 *  no trae las marcas. */
export type UnidadDelPase = Pick<Unidad, 'id' | 'rama' | 'sexo' | 'nombre'>

/** A donde puede ir quien pasa: la unidad y con que categoria queda. La
 *  categoria es parte del destino y no del formulario porque el rover que pasa
 *  a dirigente cambia las dos cosas de una. */
export interface DestinoDelPase {
  readonly unidad: UnidadDelPase
  readonly categoria: Categoria
}

/** La rama que sigue a una, por el orden del catalogo, que es el de edad. No es
 *  un campo de RAMAS: agregarlo seria un dato derivado que puede contradecir al
 *  orden. `undefined` en la ultima, que es Adultos. */
function ramaSiguiente(rama: Rama): Rama | undefined {
  const posicion = RAMAS.findIndex((candidata) => candidata.id === rama)
  return posicion === -1 ? undefined : RAMAS[posicion + 1]?.id
}

/** A donde puede pasar la gente de una unidad.
 *
 *  Lo normal es la rama siguiente, siguiendo de beneficiario. Del Clan hay dos
 *  salidas -es lo que el escultismo hace con los 21-: seguir de beneficiario en
 *  la Tropa de adultos, o quedarse como dirigente en cualquier unidad del
 *  grupo, que es la categoria activo.
 *
 *  Adultos no tiene destinos: es la ultima rama, y de ahi no se pasa a ningun
 *  lado. Devuelve lista vacia y no undefined: la pantalla no ofrece el pase y
 *  no hay un caso mas que distinguir.
 *
 *  La usan la pantalla, para ofrecer, y el servidor, para validar. */
export function destinosDelPase(
  origen: UnidadDelPase,
  unidadesAbiertas: readonly UnidadDelPase[],
): readonly DestinoDelPase[] {
  const siguiente = ramaSiguiente(origen.rama)
  if (siguiente === undefined) return []

  const beneficiario = unidadesAbiertas
    .filter((unidad) => unidad.rama === siguiente)
    .map((unidad) => ({ unidad, categoria: 'beneficiario' as const }))

  if (origen.rama !== 'rovers') return beneficiario

  return [
    ...beneficiario,
    ...unidadesAbiertas.map((unidad) => ({ unidad, categoria: 'activo' as const })),
  ]
}

/** Cual de los destinos viene elegido. Si hay uno solo, ese: elegir entre uno
 *  no es elegir. Si hay varios, el de una unidad del mismo sexo que la de
 *  origen, y solo si es uno solo: de la Manada masculina a la Tropa masculina.
 *
 *  Si no hay forma de saber -una unidad mixta, o dos del mismo sexo-, ninguno,
 *  y la pantalla espera a que alguien elija. La propuesta sale del sexo de la
 *  unidad, que es un dato del grupo: Persona no guarda sexo justamente para que
 *  el sistema no reparta gente por su cuenta. */
export function destinoPropuesto(
  origen: UnidadDelPase,
  destinos: readonly DestinoDelPase[],
): DestinoDelPase | undefined {
  if (destinos.length === 1) return destinos[0]
  const delMismoSexo = destinos.filter((destino) => destino.unidad.sexo === origen.sexo)
  return delMismoSexo.length === 1 ? delMismoSexo[0] : undefined
}

export interface CandidatoAlPase<P> {
  readonly persona: P
  /** Los anios cumplidos a la fecha del pase, no a hoy: la ceremonia se puede
   *  cargar una semana despues. */
  readonly edad: number
}

export interface CandidatosDeLaUnidad<P> {
  readonly unidad: UnidadDelPase
  /** Los que ya tienen la edad de la rama siguiente. Van propuestos. */
  readonly cumplen: readonly CandidatoAlPase<P>[]
  /** Los que la cumplen dentro de los doce meses. Se ofrecen sin proponer: el
   *  que pasa antes de tiempo lo decide la jefatura, no la edad. */
  readonly cerca: readonly CandidatoAlPase<P>[]
}

type Candidateable = {
  readonly fechaDeNacimiento: string
  readonly pertenencia: Pick<Pertenencia, 'unidadId' | 'categoria'>
}

/** Un mediodia, no una medianoche: la fecha del pase es de calendario, y a las
 *  00:00 el dia local y el UTC no coinciden. */
function mediodiaDe(fecha: string): Date {
  return new Date(`${fecha}T12:00:00`)
}

/** Quienes pasan de cada unidad elegida, a una fecha.
 *
 *  Se parte en dos listas y no en una con bandera porque la pantalla las dibuja
 *  como dos secciones distintas y con otro estado inicial.
 *
 *  Que alguien este "cerca" es que le falta menos de un anio, y eso es
 *  exactamente tener un anio menos que el limite de su rama: no hay aritmetica
 *  de fechas, alcanza la edad cumplida. Doce meses porque la ceremonia es
 *  anual: el que cumple antes de la proxima ya es candidato a esta.
 *
 *  Los dirigentes y los adherentes no aparecen: los primeros se mueven desde su
 *  ficha, y los segundos no estan en ninguna unidad. */
export function candidatosAlPase<P extends Candidateable>(
  personasDelGrupo: readonly P[],
  unidadesElegidas: readonly UnidadDelPase[],
  fecha: string,
): readonly CandidatosDeLaUnidad<P>[] {
  const dia = mediodiaDe(fecha)

  return unidadesElegidas.map((unidad) => {
    const limite = RAMAS.find((rama) => rama.id === unidad.rama)?.hasta
    const deLaUnidad =
      limite === null || limite === undefined
        ? []
        : personasDelGrupo
            .filter(
              (persona) =>
                persona.pertenencia.categoria === 'beneficiario' &&
                persona.pertenencia.unidadId === unidad.id,
            )
            .map((persona) => ({
              persona,
              edad: calcularEdad(persona.fechaDeNacimiento, dia),
            }))

    return {
      unidad,
      cumplen: deLaUnidad.filter((candidato) => candidato.edad >= (limite ?? 0)),
      cerca: deLaUnidad.filter((candidato) => candidato.edad === (limite ?? 0) - 1),
    }
  })
}

/** Lo que se pide para una persona en la ceremonia: de donde sale y a donde
 *  va. La unidad de origen viaja para que el servidor pueda rechazar una
 *  pantalla desactualizada -alguien ya la paso desde otro telefono- en vez de
 *  cerrar lo que haya. */
export interface Pase {
  readonly personaId: string
  readonly unidadDeOrigenId: string
  readonly unidadDestinoId: string
  readonly categoria: Categoria
}

/** Las reglas de un pase, hermanas de las del cambio de unidad: comparten las
 *  de la fecha y se separan en quien pasa y a donde.
 *
 *  Lo que NO valida es la edad. La pantalla propone por edad, y quien registra
 *  decide: el que paso sin cumplirla todavia pasa igual, y el que la cumplio y
 *  no fue a la ceremonia no pasa. Rechazar por edad seria poner al sistema a
 *  discutirle a los dirigentes. */
export function validarPase(
  pase: Pase,
  pertenencia: Pick<Pertenencia, 'categoria' | 'unidadId' | 'desde'>,
  fecha: string,
  unidadesAbiertas: readonly UnidadDelPase[],
  hoy: Date,
): readonly Problema[] {
  const problemas: Problema[] = []
  const origen = unidadesAbiertas.find((unidad) => unidad.id === pase.unidadDeOrigenId)

  if (pertenencia.categoria !== 'beneficiario') {
    problemas.push({
      campo: 'unidad',
      mensaje: 'Los pases son de beneficiarios: los dirigentes cambian de unidad desde su ficha.',
    })
  } else if (pertenencia.unidadId !== pase.unidadDeOrigenId) {
    problemas.push({
      campo: 'unidad',
      mensaje: 'Ya no está en esa unidad: volvé a cargar la pantalla.',
    })
  } else if (origen === undefined) {
    problemas.push({ campo: 'unidad', mensaje: 'El grupo no tiene abierta esa unidad.' })
  } else if (
    !destinosDelPase(origen, unidadesAbiertas).some(
      (destino) =>
        destino.unidad.id === pase.unidadDestinoId && destino.categoria === pase.categoria,
    )
  ) {
    problemas.push({ campo: 'unidad', mensaje: 'De esa unidad no se pasa a esa otra.' })
  }

  problemas.push(...problemasDeLaFechaDelCambio(fecha, pertenencia.desde, hoy))

  return problemas
}
