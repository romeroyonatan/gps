import type { Marcas } from '@gps/core'
import type { Rama } from './ramas'

/** Los distritos en que se divide la diocesis. La diocesis en si no es una
 *  entidad: hay una sola por instancia.
 *
 *  No tiene nombre: con el numero alcanza para identificarlo, y un nombre que
 *  nadie usa es una columna que se llena mal. `zona` hace doble funcion: es el
 *  dato descriptivo y la etiqueta legible debajo de "Distrito 3". */
export interface Distrito extends Marcas {
  readonly id: string
  readonly numero: number
  readonly zona: string
  /** Cuando dejo de estar activo. `null` es activo. Se guarda la fecha y no un
   *  booleano porque el booleano sale de ella, y al reves se pierde el dato:
   *  Afiliacion necesita saber hasta que periodo existio el grupo. */
  readonly cerradoEn: Date | null
}

/** Un grupo scout. A diferencia del distrito si tiene nombre propio -el santo
 *  o el procer-, y va sin el numero ni la palabra "Grupo Scout": el numero
 *  cae en el medio del nombre completo y la pantalla los compone. */
export interface Grupo extends Marcas {
  readonly id: string
  readonly numero: number
  readonly nombre: string
  readonly distritoId: string
  /** Cuando dejo de estar activo. `null` es activo. Se guarda la fecha y no un
   *  booleano porque el booleano sale de ella, y al reves se pierde el dato:
   *  Afiliacion necesita saber hasta que periodo existio el grupo. */
  readonly cerradoEn: Date | null
}

/** Como esta compuesta una unidad. Es un hecho del grupo y no de las personas
 *  que la integran: sirve para nombrarla y nada mas. El sistema no valida a
 *  quien se pone en cual -eso lo deciden los dirigentes-, y por eso Persona no
 *  guarda sexo. */
export type SexoDeUnidad = 'masculina' | 'femenina' | 'mixta'

/** Una unidad del grupo: la Manada, las dos Tropas, el Clan. La rama dice el
 *  tramo de edad y como se llama el tipo de unidad; el nombre lo pone el grupo.
 *
 *  Es tabla y no catalogo, al reves que la rama, por quien la crea: a las
 *  unidades las crea alguien y ningun codigo las nombra de a una. Un grupo
 *  puede tener varias de la misma rama -dos tropas scout, una femenina y una
 *  masculina-, que es justo lo que `ramas_del_grupo` no podia representar. */
export interface Unidad extends Marcas {
  readonly id: string
  readonly grupoId: string
  readonly rama: Rama
  readonly sexo: SexoDeUnidad
  /** El que le puso el grupo: "San Jorge", "Seeonee". Obligatorio: es lo unico
   *  que distingue dos unidades de la misma rama. */
  readonly nombre: string
  /** Cuando dejo de estar abierta. `null` es abierta. Misma razon que en Grupo:
   *  del booleano no se puede volver a la fecha. */
  readonly cerradaEn: Date | null
}

export type GrupoConUnidades = Grupo & { readonly unidades: readonly Unidad[] }

export interface DistritoConGrupos extends Distrito {
  readonly grupos: readonly GrupoConUnidades[]
}
