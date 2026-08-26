import type { Actor } from './actor'

/** Contexto de cada request. Cada modulo lo extiende por declaration merging
 *  para publicar sus servicios: ver packages/sistema/src/servidor/index.ts. */
export interface Context {
  readonly actor: Actor | null
}
