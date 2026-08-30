import type { GrupoConRamas } from './modelos'

/** Lo que estructura le publica a los otros modulos, y nada mas.
 *
 *  Es deliberadamente mas chica que ServicioDeEstructura: crear un distrito o
 *  cerrar un grupo son operaciones de este modulo y de nadie mas. La regla que
 *  esto impone -interfaz publica declarada, contenido privado- es la de los
 *  package interfaces de SAP y la del modificador `global` de Salesforce, y la
 *  mitad que importa es la segunda.
 *
 *  Vive en /dominio y no en /servidor porque /servidor es privado: son tipos
 *  puros, sin estado, que cualquiera puede leer. */
export interface Estructura {
  /** El grupo con sus ramas abiertas, o null si no existe o esta cerrado.
   *
   *  Un grupo cerrado devuelve null igual que no aparece en listarDistritos:
   *  para los otros modulos no existe. Asi "no se puede inscribir a nadie en un
   *  grupo cerrado" sale gratis, sin una regla aparte. El dia que alguien
   *  necesite leer un grupo cerrado -el historial de quien estuvo ahi- se
   *  agrega el metodo que lo diga, con su consumidor. */
  obtenerGrupo(grupoId: string): Promise<GrupoConRamas | null>
}
