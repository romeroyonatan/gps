import type { Actor, Alcance } from './actor'
import type { Config } from './core'

/** Contexto de cada request. Cada modulo lo extiende por declaration merging
 *  para publicar sus servicios: ver packages/sistema/src/servidor/index.ts. */
export interface Context {
  readonly actor: Actor | null
  readonly alcance: Alcance | null
  /** La sesion de este pedido, para poder cerrarla. Null si es anonimo. */
  readonly sesionId: string | null
  /** La configuracion ya validada. Un resolver que necesita el origen publico
   *  -armar un enlace de invitacion- no tiene otra forma de conocerlo: `Core`
   *  es de los servicios, no del contexto. */
  readonly config: Config
}
