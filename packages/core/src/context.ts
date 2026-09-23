import type { Actor, Alcance } from './actor'
import type { Config } from './core'

/** Contexto de cada request. Cada modulo lo extiende por declaration merging
 *  para publicar sus servicios: ver packages/sistema/src/servidor/index.ts. */
export interface Context {
  readonly actor: Actor | null
  readonly alcance: Alcance | null
  /** La sesion de este pedido, para poder cerrarla. Null si es anonimo. */
  readonly sesionId: string | null
  /** Hasta cuando vale la elevacion de esta sesion. Null si no esta elevada.
   *  Va en el contexto y no en `Actor` porque es un hecho de la sesion: las
   *  politicas deciden con `estaElevado`, que es un booleano, y esto es solo
   *  para que la pantalla pueda mostrar la cuenta regresiva. */
  readonly elevadaHasta: Date | null
  /** Marca del cliente para reconocer una mutation iniciada mientras mostraba
   *  sudo. Es sólo evidencia de intención: nunca participa de autorización. */
  readonly intencionElevada: boolean
  /** La configuracion ya validada. Un resolver que necesita el origen publico
   *  -armar un enlace de invitacion- no tiene otra forma de conocerlo: `Core`
   *  es de los servicios, no del contexto. */
  readonly config: Config
}
