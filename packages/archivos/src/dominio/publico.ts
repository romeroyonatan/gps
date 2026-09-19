import type { Alcance } from '@gps/core'
import type { Archivo } from './modelos'

/** Lo que archivos le publica a los otros modulos, y nada mas.
 *
 *  Es deliberadamente mas chica que ServicioDeArchivos: los tres pasos de la
 *  subida -pedirla, mandar los bytes, confirmar- existen para el cliente, que
 *  manda los bytes por HTTP sin pasarlos por GraphQL. Un modulo que genera
 *  contenido del lado del servidor, como el PDF de un permiso, ya tiene los
 *  bytes en la mano: para el son un solo paso.
 *
 *  Vive en /dominio y no en /servidor porque /servidor es privado: son tipos
 *  puros, sin estado, que cualquiera puede leer. */
export interface Archivos {
  /** Guarda contenido que produjo el servidor, en un paso. Devuelve el archivo
   *  ya confirmado, con su hash: es lo que el dueño guarda para anclar despues
   *  -el hash del PDF es lo que sellan las firmas de un permiso-. */
  guardarContenido(datos: {
    nombre: string
    tipo: string
    contenido: Uint8Array
    modulo: string
    recursoId: string
  }): Promise<Archivo>

  /** Los bytes, si el modulo dueño autoriza el pedido. Con el nombre: sin el,
   *  guardar el archivo lo deja llamado como su id. */
  descargar(
    id: string,
    alcance: Alcance | null,
  ): Promise<{ contenido: Uint8Array; tipo: string; nombre: string }>

  /** Si ese archivo esta confirmado y es de ese recurso de ese modulo. Lo llama
   *  el dueño antes de asociar un archivo que subio un cliente, para no
   *  quedarse con uno ajeno. */
  esDe(id: string, modulo: string, recursoId: string): Promise<boolean>

  /** Borra un archivo del modulo dueño: primero el registro y despues los
   *  bytes. En ese orden a proposito: si falla en el medio queda un archivo
   *  huerfano, que es basura, y no una fila apuntando a bytes que ya no estan,
   *  que es un link roto.
   *
   *  Pide modulo y recurso, no solo el id: sin eso, cualquier modulo podria
   *  borrar los archivos de otro.
   *
   *  Devuelve si borro algo. `false` cuando no existe o no era suyo, que es lo
   *  mismo desde afuera. */
  eliminar(id: string, modulo: string, recursoId: string): Promise<boolean>

  /** El registro, sin los bytes: como se llama el archivo y de que tipo es.
   *  Null si no existe o no esta confirmado.
   *
   *  Lo necesita el dueño para mostrar sus archivos: una lista que diga
   *  "archivo_01a0..." no le sirve a nadie, y el nombre lo tiene archivos. */
  obtener(id: string): Promise<Archivo | null>
}
