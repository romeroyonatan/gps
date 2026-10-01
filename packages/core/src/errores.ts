/** Un error que la pantalla puede mostrar tal cual: el mensaje es para quien
 *  lo lee y `extensions` es lo que viaja en el error de GraphQL. Yoga enmascara
 *  todo lo demas como "Unexpected error."; el `maskError` del backend deja
 *  pasar sólo a éstos. Extender esta clase es decidir que el mensaje es
 *  publicable: un error que no tiene que llegar al cliente extiende Error.
 *
 *  graphql-js copia `extensions` del error original al envolverlo, así que el
 *  servicio no conoce el framework y el resolver no traduce nada.
 *
 *  El `code` por omisión es el nombre de la clase: renombrarla cambia lo que
 *  lee el cliente. Va en su propio subpath porque es isomorfo y un /dominio
 *  lo puede importar; el índice arrastra drizzle y Pothos. */
export class ErrorDeNegocio extends Error {
  readonly extensions: { readonly code: string; readonly [extra: string]: unknown }

  constructor(mensaje: string, code: string = new.target.name, extra?: Record<string, unknown>) {
    super(mensaje)
    this.name = new.target.name
    this.extensions = { code, ...extra }
  }
}
