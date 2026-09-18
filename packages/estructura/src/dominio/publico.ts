import type { GrupoConUnidades } from './modelos'

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
  /** El grupo con sus unidades abiertas, o null si no existe o esta cerrado.
   *  Las unidades y no las ramas: quien da de alta a alguien necesita saber en
   *  cual de las dos tropas lo pone, y las ramas abiertas salen de ahi con
   *  ramasDeLasUnidades.
   *
   *  Un grupo cerrado devuelve null igual que no aparece en listarDistritos:
   *  para los otros modulos no existe. Asi "no se puede inscribir a nadie en un
   *  grupo cerrado" sale gratis, sin una regla aparte. El dia que alguien
   *  necesite leer un grupo cerrado -el historial de quien estuvo ahi- se
   *  agrega el metodo que lo diga, con su consumidor. */
  obtenerGrupo(grupoId: string): Promise<GrupoConUnidades | null>

  /** Si el distrito existe y sigue abierto. Booleano y no el Distrito entero
   *  porque el unico consumidor -validar el ambito de un cargo distrital- no
   *  necesita mas: el dia que alguien necesite leerlo, se agrega el metodo que
   *  lo devuelva, con su consumidor. */
  distritoEstaAbierto(distritoId: string): Promise<boolean>

  /** Los ids de los grupos que estaban abiertos el dia `fecha` (aaaa-mm-dd).
   *  Cerrado ese mismo dia todavia cuenta como abierto, igual que estaVigente
   *  incluye las dos puntas.
   *
   *  Lleva fecha y obtenerGrupo no, porque las dos preguntas son distintas:
   *  aquella es "se puede inscribir a alguien hoy" y esta es "existia el dia de
   *  la declaracion". Un grupo que cerro en octubre tuvo nomina en mayo. */
  gruposAbiertosEn(fecha: string): Promise<ReadonlySet<string>>
}
