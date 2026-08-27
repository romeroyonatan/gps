import type { Rama } from './ramas'

/** Cuando se creo y cuando se toco por ultima vez. Las escribe el servicio
 *  con core.reloj.ahora(), nunca la base: ver la regla de portabilidad. */
export interface Marcas {
  readonly creadoEn: Date
  readonly actualizadoEn: Date
}

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

export type GrupoConRamas = Grupo & { readonly ramas: readonly Rama[] }

export interface DistritoConGrupos extends Distrito {
  readonly grupos: readonly GrupoConRamas[]
}
