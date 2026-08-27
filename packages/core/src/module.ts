import type { Builder } from './builder'
import type { Core } from './core'
import type { Migracion } from './migraciones'

/** Un modulo de negocio. Para crear uno nuevo, ver docs/crear-un-modulo.md.
 *  Ojo con el vocabulario: "plugin" en este proyecto significa interceptor
 *  de envelop, no esto. */
export interface Module<S = unknown> {
  readonly name: string
  /** Nombres de otros modulos que este necesita. Determinan el orden de
   *  registro y se validan al arrancar. */
  readonly dependencies: readonly string[]
  /** Migraciones del modulo, en orden. Opcional: un modulo sin tablas no
   *  deberia tener que declarar una lista vacia para decirlo. */
  readonly migraciones?: readonly Migracion[]
  createServices(core: Core): S
  registerSchema(builder: Builder): void
}
