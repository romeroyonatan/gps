import type { Builder } from './builder'
import type { Core } from './core'
import type { Migracion } from './migraciones'

/** Un modulo de negocio. Para crear uno nuevo, ver docs/crear-un-modulo.md.
 *  Ojo con el vocabulario: "plugin" en este proyecto significa interceptor de
 *  envelop, no esto.
 *
 *  `D` es lo que este modulo necesita de otros: un objeto con un servicio por
 *  dependencia, tipado contra la interfaz publica que cada uno declara en su
 *  /dominio/publico.ts. Por omision es vacio, y entonces `dependencies` solo
 *  admite la lista vacia, que es lo que declaran los modulos que no dependen
 *  de nadie. */
export interface Module<S = unknown, D = Record<never, never>> {
  readonly name: string
  /** Nombres de otros modulos que este necesita. Ordenan el registro, se
   *  validan al arrancar, y su tipo son las claves de D: un nombre que no este
   *  en D no compila. */
  readonly dependencies: readonly (keyof D & string)[]
  /** Migraciones del modulo, en orden. Opcional: un modulo sin tablas no
   *  deberia tener que declarar una lista vacia para decirlo. */
  readonly migraciones?: readonly Migracion[]
  createServices(core: Core, dependencias: D): S
  registerSchema(builder: Builder): void
}
